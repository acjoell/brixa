DO $$
BEGIN
  IF current_user <> 'table_owner' OR session_user <> current_user OR EXISTS (
    SELECT FROM pg_class WHERE oid IN ('public.users'::regclass, 'public.sessions'::regclass,
      'public.audit_log_system'::regclass) AND relowner <> current_user::regrole
  ) THEN
    RAISE EXCEPTION 'Se requiere table_owner como migrador y propietario de las tablas Auth';
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON TABLE public.users, public.sessions, public.audit_log_system FROM PUBLIC, app_exec;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE public.users, public.sessions TO app_exec;
--> statement-breakpoint
GRANT INSERT ON TABLE public.audit_log_system TO app_exec;
--> statement-breakpoint
DO $$
DECLARE
  col name;
BEGIN
  SELECT attname INTO col FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.audit_log_system'::regclass AND attnum > 0 AND NOT attisdropped
    AND has_column_privilege('app_exec', attrelid, attnum, 'SELECT,UPDATE,REFERENCES,INSERT WITH GRANT OPTION')
  ORDER BY attnum LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ACL residual en public.audit_log_system.% para app_exec. Revisar otorgantes antes de migrar.', col;
  END IF;
END
$$;
