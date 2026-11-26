import { checkRuntimeIdentity, pool } from "./client.js";

export async function checkAuthPrivileges(): Promise<void> {
  await checkRuntimeIdentity();
  const { rows } = await pool.query<{ allowed: boolean }>(`
    SELECT NOT EXISTS (
        SELECT FROM unnest(ARRAY['public.users','public.sessions','public.activation_tokens','public.audit_log_system','public.login_abuse_counters','public.login_identifier_reservations']) AS t(name)
        WHERE (SELECT relowner FROM pg_class WHERE oid = t.name::regclass) <> 'table_owner'::regrole
      )
      AND EXISTS (
        SELECT FROM pg_class
        WHERE oid = to_regclass('public.initial_administrator')
          AND relowner = 'table_owner'::regrole AND relkind = 'r'
          AND has_table_privilege(oid, 'SELECT')
          AND NOT has_table_privilege(oid, 'DELETE,TRUNCATE,TRIGGER,MAINTAIN')
          AND NOT has_any_column_privilege(oid, 'INSERT,UPDATE,REFERENCES,SELECT WITH GRANT OPTION')
      )
      AND has_table_privilege('public.audit_log_system', 'INSERT')
      AND NOT has_table_privilege('public.audit_log_system', 'DELETE,TRUNCATE,TRIGGER,MAINTAIN,INSERT WITH GRANT OPTION')
      AND NOT has_any_column_privilege('public.audit_log_system', 'SELECT,UPDATE,REFERENCES,INSERT WITH GRANT OPTION')
      AND NOT EXISTS (
        SELECT FROM unnest(ARRAY['public.users','public.sessions','public.activation_tokens']) AS t(name)
        WHERE NOT has_table_privilege(t.name, 'SELECT') OR NOT has_table_privilege(t.name, 'INSERT')
           OR NOT has_table_privilege(t.name, 'UPDATE')
           OR has_table_privilege(t.name, 'DELETE,TRUNCATE,TRIGGER,MAINTAIN')
           OR has_any_column_privilege(t.name, 'REFERENCES,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION')
      )
      AND has_table_privilege('public.login_abuse_counters', 'SELECT')
      AND has_table_privilege('public.login_abuse_counters', 'INSERT')
      AND has_table_privilege('public.login_abuse_counters', 'UPDATE')
      AND has_table_privilege('public.login_abuse_counters', 'DELETE')
      AND NOT has_table_privilege('public.login_abuse_counters', 'TRUNCATE,TRIGGER,MAINTAIN,DELETE WITH GRANT OPTION')
      AND NOT has_any_column_privilege('public.login_abuse_counters', 'REFERENCES,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION')
      AND has_table_privilege('public.login_identifier_reservations', 'SELECT')
      AND has_table_privilege('public.login_identifier_reservations', 'INSERT')
      AND has_table_privilege('public.login_identifier_reservations', 'DELETE')
      AND NOT has_table_privilege('public.login_identifier_reservations', 'TRUNCATE,TRIGGER,MAINTAIN,DELETE WITH GRANT OPTION')
      AND NOT has_any_column_privilege('public.login_identifier_reservations', 'UPDATE,REFERENCES,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION')
      AS allowed
  `);
  if (rows[0]?.allowed !== true) throw new Error("Identidad PostgreSQL de ejecución insegura.");

  // Una dependencia de vista se registra en la regla _RETURN, incluso entre vistas.
  const indirect = await pool.query<{ object: string }>(`
    WITH RECURSIVE protected_views(relid, owner_rights, authority) AS (
      SELECT oid, false, relname = 'initial_administrator' FROM pg_class
      WHERE oid IN ('public.audit_log_system'::regclass, 'public.initial_administrator'::regclass)
      UNION
      SELECT r.ev_class, a.owner_rights OR NOT EXISTS (
        SELECT FROM pg_options_to_table(v.reloptions)
        WHERE option_name = 'security_invoker' AND option_value::boolean
      ), a.authority FROM protected_views a
      JOIN pg_depend d ON d.refclassid = 'pg_class'::regclass AND d.refobjid = a.relid
                      AND d.classid = 'pg_rewrite'::regclass
      JOIN pg_rewrite r ON r.oid = d.objid AND r.rulename = '_RETURN'
      JOIN pg_class v ON v.oid = r.ev_class AND v.relkind = 'v'
    ), privileged_routines AS (
      SELECT p.* FROM pg_proc p WHERE p.prosecdef AND p.oid >= 16384
        AND (has_table_privilege(p.proowner, 'public.audit_log_system', 'DELETE,TRUNCATE,TRIGGER')
          OR has_any_column_privilege(p.proowner, 'public.audit_log_system', 'UPDATE')
          OR has_table_privilege(p.proowner, 'public.initial_administrator', 'DELETE,TRUNCATE,TRIGGER')
          OR has_any_column_privilege(p.proowner, 'public.initial_administrator', 'INSERT,UPDATE')
          OR pg_has_role(p.proowner, 'table_owner', 'USAGE'))
    )
    SELECT format('rutina %s', p.oid::regprocedure) AS object FROM privileged_routines p
      WHERE has_schema_privilege(p.pronamespace, 'USAGE') AND has_function_privilege(p.oid, 'EXECUTE')
        AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
    UNION ALL
    SELECT format('trigger %I sobre %s', t.tgname, t.tgrelid::regclass)
      FROM pg_trigger t JOIN privileged_routines p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND t.tgenabled <> 'D'
        AND t.tgrelid IN ('public.users'::regclass,'public.sessions'::regclass,'public.activation_tokens'::regclass,'public.audit_log_system'::regclass,'public.login_abuse_counters'::regclass,'public.login_identifier_reservations'::regclass)
        AND ((t.tgtype::int & 4) <> 0 OR ((t.tgtype::int & 16) <> 0 AND t.tgrelid NOT IN ('public.audit_log_system'::regclass,'public.login_identifier_reservations'::regclass))
          OR ((t.tgtype::int & 8) <> 0 AND t.tgrelid IN ('public.login_abuse_counters'::regclass,'public.login_identifier_reservations'::regclass)))
    UNION ALL
    SELECT format('vista %s', v.oid::regclass) FROM protected_views a
      JOIN pg_class v ON v.oid = a.relid AND v.relkind = 'v'
      WHERE a.owner_rights AND has_schema_privilege(v.relnamespace, 'USAGE')
        AND (((pg_relation_is_updatable(v.oid, true) & 4) <> 0 AND has_any_column_privilege(v.oid, 'UPDATE'))
          OR ((pg_relation_is_updatable(v.oid, true) & 16) <> 0 AND has_table_privilege(v.oid, 'DELETE'))
          OR (a.authority AND (pg_relation_is_updatable(v.oid, true) & 8) <> 0
              AND has_any_column_privilege(v.oid, 'INSERT')))
    ORDER BY object
  `);
  if (indirect.rows.length) {
    throw new Error(
      "Objetos PostgreSQL incompatibles con auditoría o autoridad administrativa: " +
        indirect.rows.map((row) => row.object).join(", "),
    );
  }
}
