
# Security Guidelines

## 1. Objetivo

Establecer requisitos mínimos de seguridad para el generador y los proyectos que produce.

La seguridad debe formar parte del diseño y de las pruebas, no añadirse como una corrección posterior.

Los requisitos concretos dependen de las capacidades seleccionadas, el tipo de aplicación y sus riesgos.

## 2. Principios generales

- Aplicar el principio de mínimo privilegio.
- Denegar el acceso por defecto cuando exista un mecanismo de autorización.
- Validar y tratar como no confiables los datos recibidos del exterior.
- Aplicar controles de seguridad en el servidor.
- No confiar en las restricciones implementadas únicamente en el frontend.
- Evitar exponer secretos o información interna.
- Mantener las dependencias actualizadas y evaluar sus riesgos.
- Probar los controles de seguridad y sus casos negativos.
- No declarar una funcionalidad segura sin haber verificado los controles relevantes.

## 3. Autenticación

Si se selecciona autenticación, la implementación debe incluir un flujo funcional y documentado.

Se deben definir explícitamente:

- El mecanismo de autenticación.
- El ciclo de vida de las credenciales y sesiones.
- El proceso de cierre de sesión.
- La recuperación de acceso, si está incluida.
- Las políticas de expiración y renovación.
- Los límites de intentos y las medidas contra el abuso.
- El tratamiento de cuentas deshabilitadas o revocadas.

Las credenciales no deben almacenarse en texto plano.

Las contraseñas deben protegerse mediante un algoritmo de hash diseñado para contraseñas, con parámetros apropiados y una biblioteca mantenida (D-091 a D-093: Argon2id mediante `@node-rs/argon2` versión `2.2.2`, `m=19456 KiB`, `t=2`, `p=1`, formato PHC estándar en Base64 sin padding, APIs asíncronas, validación defensiva previa de parámetros, verificación simulada contra enumeración por tiempo y limitador de concurrencia acotado).

Los tokens y las sesiones deben protegerse de acuerdo con el mecanismo elegido. Si se utilizan cookies, deben configurarse las opciones de seguridad pertinentes, como `HttpOnly`, `Secure` y `SameSite`, según el entorno y el flujo de autenticación.

No se deben almacenar tokens sensibles en ubicaciones accesibles a JavaScript sin evaluar los riesgos.

Si se implementa renovación de tokens, deben definirse las reglas de expiración, revocación y detección de reutilización cuando corresponda.

Los errores de autenticación no deben revelar innecesariamente si una cuenta existe.

### Registro, aprovisionamiento y bootstrap

- **Registro administrado por defecto:** El modelo estándar de provisión de cuentas es administrado (alta por un administrador o invitación controlada).
- **Registro público condicionado (D-086):** Si se habilita registro público en proyectos de Auth sin multitenancy, este no debe otorgar privilegios administrativos automáticamente bajo ningún concepto. Debe incorporar controles estrictos de seguridad (rate limiting, mitigación de abuso y validación de contraseñas) y no debe permitir la creación pública de organizaciones.
- **Bootstrap del primer administrador (D-085):** La inicialización de la primera cuenta administrativa debe realizarse exclusivamente mediante comandos de consola locales del proyecto generado. Queda prohibido el uso de credenciales predeterminadas o "de fábrica" y la exposición de endpoints HTTP públicos de configuración inicial. El comando debe ser idempotente y resistente a condiciones de carrera.

## 4. Autorización y RBAC

Si se selecciona RBAC, el sistema debe distinguir entre autenticación y autorización.

Estar autenticado no implica tener permiso para realizar cualquier operación.

### Catálogo de permisos

Los módulos declaran los permisos que necesitan en el código fuente.

El sistema debe definirlos de forma declarativa en el código y sincronizarlos con la base de datos (D-082).

Registrar un permiso en el catálogo no protege automáticamente una ruta ni una operación. Los administradores no pueden definir permisos arbitrarios desde la interfaz o la API sin respaldo en el código.

### Aplicación efectiva de permisos y propagación de contexto

Cada ruta, controlador o caso de uso protegido debe aplicar explícitamente el control de autorización correspondiente.

La implementación debe verificar el permiso requerido antes de ejecutar la operación protegida.

El contexto del actor (`ActorContext`) debe propagarse de forma estrictamente explícita como argumento en servicios, casos de uso, repositorios y transacciones (D-080). Queda descartado el uso de `AsyncLocalStorage` (ALS) para comprobaciones de autorización o decisiones de aislamiento.

Los controles no deben depender exclusivamente de que el frontend oculte botones o páginas.

### Roles y permisos dinámicos

Los roles agrupan permisos conocidos del catálogo y pueden crearse, editarse y asignarse dinámicamente desde el panel o la API administrativa (D-082).

Los alcances de autorización admitidos en esta etapa son exclusivamente de **aplicación** (sistema) y de **organización** (D-082). Se descarta la implementación de motores genéricos ABAC o ReBAC.

La asignación de permisos debe validar que los permisos existen en el catálogo y que quien realiza la asignación está autorizado para hacerlo.

No se deben aceptar permisos arbitrarios enviados por el cliente.

### Extensibilidad modular

Las capacidades Auth, RBAC y multitenancy deben permitir incorporar módulos de negocio, permisos nuevos y validaciones adicionales sin modificar sus mecanismos internos ni la lógica del núcleo de seguridad.

### Alcance sobre recursos

Tener un permiso general no implica necesariamente acceso a todos los recursos.

Cuando corresponda, deben aplicarse restricciones adicionales, como:

- Acceso únicamente a recursos propios.
- Acceso limitado a una organización.
- Acceso limitado a una sucursal.
- Acceso limitado a determinados estados o relaciones del recurso.

Estas restricciones deben verificarse en el servidor y aplicarse también a consultas y modificaciones de datos.

## 5. Multitenancy y aislamiento de datos

Si se selecciona multitenancy, el aislamiento entre organizaciones es un requisito crítico.

### Obligatoriedad de PostgreSQL RLS y exclusión de SQLite (D-064, D-094)

El aislamiento a nivel de base de datos mediante Row-Level Security (RLS) en PostgreSQL es obligatorio para todas las variantes con multitenancy. SQLite queda terminantemente excluido de multitenancy en esta etapa.

### Roles, privilegios y separación de credenciales (D-094)

- **Separación estricta de identidades:** se separan la identidad de ejecución de la aplicación (`app_exec`) y la identidad de migraciones y gestión de esquema (`table_owner`).
- **Restricciones del rol de ejecución (`app_exec`):** no puede ser superusuario ni poseer el atributo `BYPASSRLS`; no puede ser propietario de tablas protegidas por RLS; no posee privilegios de DDL ni `TRUNCATE` sobre tablas protegidas; y opera con privilegios DML mínimos (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
- **Credenciales separadas:** el servicio de aplicación Express utiliza `DATABASE_URL` (con rol `app_exec`) y las herramientas de migración Drizzle utilizan `MIGRATION_DATABASE_URL` (con rol `table_owner`).
- **Aprovisionamiento administrado:** se documenta y proporciona aprovisionamiento claro para proveedores de PostgreSQL administrados (RDS, Cloud SQL, Neon, Supabase, etc.).
- **Fallo explícito ante privilegios inadecuados:** si en el arranque o verificación no se garantizan las restricciones requeridas para `app_exec`, el sistema debe fallar explícitamente. Queda prohibido desactivar RLS como solución o degradación permisiva.

### Contexto organizacional y transacciones (D-080, D-095)

- **Determinación y validación:** la organización activa se selecciona explícitamente por petición y se valida obligatoriamente contra la base de datos en cada solicitud, comprobando la existencia de una concesión de acceso vigente (D-080). Queda prohibido confiar en identificadores provistos por el cliente.
- **Contexto local por transacción:** el contexto en PostgreSQL se establece exclusivamente mediante `SELECT set_config('app.current_organization_id', ?, true)` con `is_local = true`, parámetros enlazados y transacciones de Drizzle ORM (`db.transaction`).
- **Una organización por transacción:** cada transacción organizacional corresponde estrictamente a una única organización.
- **Propagación explícita:** los servicios organizacionales reciben explícitamente el objeto transaccional autorizado (`tx`). Se descarta `AsyncLocalStorage` (ALS) para transmitir autorización o aislamiento.
- **Denegación por defecto:** ante la ausencia o vacío de contexto organizacional, las políticas RLS deniegan el acceso devolviendo cero filas.
- **Separación de operaciones:** las operaciones globales (identidad, autenticación, validación de concesiones) se ejecutan sin contexto organizacional; las operaciones de tenant operan en transacciones con contexto fijado.
- **Agregaciones legítimas multiorganización:** agregaciones que requieran datos de múltiples organizaciones para un actor autorizado se realizan mediante consultas independientes y autorizadas por organización; sin bypass general de RLS.
- **Compatibilidad con pooling por transacción:** compatible con transaction pooling (como PgBouncer); al finalizar la transacción (`COMMIT` o `ROLLBACK`), PostgreSQL limpia automáticamente la variable GUC local, impidiendo contaminación entre clientes en conexiones reutilizadas.
- **Limitación documentada:** la ejecución de SQL arbitrario puede alterar el GUC (`set_config`). RLS actúa como defensa en profundidad contra filtros olvidados; **RLS no sustituye la prevención de inyección SQL**.

### Políticas de aislamiento e integridad relacional (D-096)

- **Clasificación de tablas:** clasificación explícita entre tablas globales y tablas organizacionales.
- **Protección de tablas organizacionales:** columna `organization_id` obligatoria, con RLS habilitado y forzado mediante `FORCE ROW LEVEL SECURITY`.
- **Políticas de lectura y escritura:**
  - Lectura (`SELECT`): `USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)`.
  - Escritura (`INSERT`, `UPDATE`): `WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)`.
  - Barrera restrictiva combinada con políticas permisivas; prohibición expresa de políticas permisivas abiertas (`USING (true)`) en tablas organizacionales.
- **Manejo seguro de contexto ausente/vacío:** la expresión `NULLIF(..., '')::uuid` asegura evaluación a `NULL` ante variable ausente o vacía, denegando el acceso.
- **Claves primarias simples:** se mantienen claves primarias simples por defecto (`id uuid PRIMARY KEY`), sin imponer PK compuestas universales.
- **Integridad referencial (FK):** claves foráneas estándar para garantizar integridad relacional. En relaciones entre entidades organizacionales que deban permanecer aisladas, claves foráneas compuestas con `organization_id` (`FOREIGN KEY (organization_id, parent_id) REFERENCES parent_table(organization_id, id)`). Diseños sin FK física solo admisibles con garantías alternativas explícitas y verificables.
- **Restricciones UNIQUE:** alcance por organización (`UNIQUE (organization_id, ...)`).
- **Operaciones especiales restringidas:** prohibición de permiso `TRUNCATE` para `app_exec`; `COPY FROM` no admitido con RLS; vistas obligatoriamente con `WITH (security_invoker = true)`; funciones `SECURITY DEFINER` restringidas y con `search_path` explícito y seguro.
- **Separación de capas:** la autorización efectiva y las comprobaciones RBAC permanecen en Express; RLS garantiza aislamiento de filas en datos. Consultas SQL parametrizadas en Drizzle.
- **Extensibilidad modular:** los nuevos módulos de negocio deben poder incorporar entidades organizacionales registrando sus tablas y políticas bajo este patrón, sin necesidad de reescribir Auth ni desactivar RLS.

### Independencia de RBAC

Multitenancy es completamente independiente de RBAC (D-064, D-083). Cuando multitenancy opera sin RBAC, existen organizaciones y concesiones de acceso organizacionales para vincular al usuario con la organización, pero NO se crean roles fijos `owner/member`. La autorización básica consiste en verificar la existencia de una concesión de acceso válida y vigente.

### Ciclo de vida de concesiones de acceso

Las concesiones de acceso entre usuarios y organizaciones se gobiernan mediante una marca temporal `revoked_at` (D-081). La revocación es definitiva; una reconcesión posterior genera una nueva fila independiente sin heredar roles previos. En PostgreSQL se debe aplicar un índice de unicidad parcial para concesiones vigentes (`WHERE revoked_at IS NULL`). Queda descartado el uso de campos booleanos universales `isActive`.

### Separación estricta de administración de plataforma

La administración de plataforma está estrictamente separada de la administración organizacional (D-084). Los administradores de plataforma operan a nivel de sistema y no poseen acceso global automático a los datos de negocio de las organizaciones ni cuentan con bypass genérico de Row-Level Security (RLS). Para operar sobre datos internos de una organización, requieren una concesión de acceso explícita y vigente en dicha organización.

### Operaciones bajo aislamiento

Todas las operaciones relevantes deben respetar el contexto de la organización, incluidas:

- Lecturas individuales y listados.
- Creación de recursos.
- Actualizaciones y eliminaciones.
- Relaciones entre entidades.
- Consultas agregadas.
- Operaciones en segundo plano.
- Exportaciones y reportes.
- Acciones administrativas, cuando correspondan.

Las modificaciones deben verificar que el recurso pertenece al ámbito autorizado antes de ejecutarse.

La validación de identificadores aislada no sustituye el control de autorización.

Las relaciones entre entidades también deben respetar el mismo ámbito. No debe ser posible asociar un recurso de una organización con otro recurso perteneciente a una organización diferente, salvo que exista una regla explícita y segura que lo permita.

## 6. Validación de entradas

Los datos externos deben validarse en los límites del sistema.

La validación debe comprobar el tipo, formato, longitud, rango y restricciones pertinentes.

Las operaciones de escritura deben validar los campos permitidos y evitar asignaciones masivas de propiedades no autorizadas.

La validación de datos no sustituye la autorización.

Las consultas a bases de datos deben utilizar mecanismos seguros de parametrización o las protecciones equivalentes de la biblioteca utilizada.

No se deben construir consultas mediante concatenación insegura de datos externos.

## 7. Protección de sesiones y solicitudes

Cuando corresponda, se deben considerar:

- Protección frente a CSRF en flujos basados en cookies.
- Configuración segura de CORS.
- Limitación de solicitudes y operaciones sensibles.
- Invalidación de sesiones.
- Protección de cookies.
- HTTPS en entornos de producción.
- Políticas de seguridad del navegador apropiadas para la aplicación.

Estas medidas deben configurarse según el mecanismo utilizado. No todas se aplican de la misma forma a todos los proyectos.

## 8. Secretos y configuración

Los secretos no deben aparecer en:

- El código fuente.
- Los archivos de ejemplo del entorno.
- Los registros.
- Los mensajes de error.
- Las respuestas de la API.
- Los repositorios públicos.

Los archivos `.env` con valores reales deben excluirse del control de versiones cuando corresponda.

Los archivos `.env.example` deben contener nombres de variables y valores ilustrativos no sensibles.

La configuración debe validarse al iniciar la aplicación.

## 9. Errores, registros y auditoría (D-097)

Los mensajes de error públicos deben ser útiles sin exponer detalles internos.

Las trazas completas y los detalles técnicos pueden registrarse de forma controlada en el servidor, evitando secretos y datos sensibles.

Los registros deben evitar almacenar contraseñas, tokens de autenticación u otras credenciales.

La información personal debe tratarse con criterios de minimización y protección adecuados al contexto.

### Auditoría operativa de seguridad (D-097)

- **Infraestructura centralizada:** registro centralizado de eventos relevantes de seguridad: intentos de autenticación exitosos y fallidos, decisiones de autorización denegadas y accesos denegados a organizaciones.
- **Correlación de peticiones:** correlación obligatoria mediante identificadores de petición (`requestId` / `correlationId`) para trazabilidad de extremo a extremo.
- **Evidencia forense:** evidencia suficiente para investigar anomalías o ataques repetidos (actor, timestamp UTC, IP de origen, recurso solicitado y resultado).
- **Ganchos de alertas:** capacidad de disparar alertas ante patrones sospechosos o anómalos configurables.
- **Principio de no presunción:** no asumir que PostgreSQL RLS informa automáticamente de consultas filtradas que retornan cero filas.
- **Minimización estricta:** prohibición de registrar contraseñas, tokens de sesión o datos sensibles innecesarios. Sin obligación de SIEM ni dashboard empresarial en v1.

### Auditoría de acciones de negocio (D-097)

- **Capacidad transversal:** disponible para todos los proyectos generados que incluyan Auth (no exclusiva de multitenancy).
- **Contenido del registro:** quién ejecutó la acción (actor autenticado), cuándo (timestamp UTC), sobre qué recurso (tipo e identificador) y qué campos relevantes cambiaron (valores anteriores y posteriores relevantes).
- **Origen fidedigno de identidad:** la identidad del actor se extrae exclusivamente del `ActorContext` autenticado y validado, nunca de campos arbitrarios enviados por el cliente.
- **Instrumentación de operaciones críticas:** cambios en Auth, asignación/revocación de roles y permisos en RBAC, aprovisionamiento/revocación de concesiones de acceso organizacionales.
- **Mecanismo reutilizable:** interfaz sencilla para que futuros módulos de negocio registren sus eventos críticos.
- **Atomicidad transaccional:** la operación de negocio y su evento de auditoría deben persistirse atómicamente en la misma transacción de base de datos.
- **Minimización:** evitar almacenar secretos o copias completas innecesarias de datos sensibles.
- **Distinción de actores:** diferenciar explícitamente entre acciones humanas y procesos automatizados del sistema.
- **Historial de solo adición (*append-only*):** la tabla de auditoría no admite modificaciones ni borrados.
- **Visualización acotada:** administradores autorizados acceden exclusivamente a los eventos correspondientes a su ámbito (alcance de sistema o de su organización).
- **Sin controles de edición:** no generar controles visuales ni endpoints de API para editar o borrar entradas de auditoría.
- **Protección de base de datos:** el rol `app_exec` carece de permisos `UPDATE` y `DELETE` sobre las tablas de auditoría de acciones.
- **Rechazo de manipulación:** rechazar explícitamente intentos de modificación o borrado y registrar los intentos observables como incidentes de seguridad.
- **Gestión de ciclo de vida:** definir políticas de retención, archivado, protección de registros y acceso autorizado.
- **Limitación documentada:** no se promete inmutabilidad absoluta frente a superusuarios del motor de base de datos. Paneles avanzados de auditoría y detección de fraudes quedan como extensiones futuras.

## 10. Dependencias y cadena de suministro

Las dependencias deben elegirse considerando su mantenimiento, reputación, licencia y necesidad real.

Se deben evitar paquetes innecesarios.

El proyecto debe permitir revisar las dependencias y detectar vulnerabilidades mediante herramientas apropiadas.

No se debe considerar que una dependencia es segura únicamente porque es popular.

Los cambios de dependencias deben evaluarse y verificarse con las pruebas disponibles.

## 11. Pruebas y verificación de seguridad (D-097)

Cuando existan controles de autenticación, autorización o multitenancy, las pruebas deben cubrir tanto el acceso permitido como el denegado.

### Auditoría estructural de RLS (D-097)

- **Verificaciones automáticas:** comprobación automática de roles, privilegios de PostgreSQL, tablas protegidas, políticas activas, restricciones de integridad y aislamiento.
- **Inspección de catálogo:** inspección programática de catálogos del sistema PostgreSQL (`pg_tables`, `pg_roles`, `pg_policies`, etc.) combinada con pruebas funcionales reales sobre conexiones de prueba.
- **Detección de vulnerabilidades:** detección de tablas organizacionales sin protección o con políticas permisivas (`USING (true)`) que comprometan el aislamiento.
- **Bloqueo de CI:** las verificaciones estructurales críticas fallidas bloquean la integración continua.
- **Paridad funcional:** garantías equivalentes en variantes JavaScript y TypeScript.
- **Integración futura:** integración en el sistema de verificación de seguridad previsto (`verify:security`, T-018).
- **Separación de entornos:** las comprobaciones estructurales pesadas de catálogo no deben ejecutarse en cada petición HTTP en producción.

### Evaluación de rendimiento de RLS (D-097)

- **Entorno aislado:** benchmarks representativos con y sin RLS ejecutados exclusivamente en laboratorios de prueba aislados.
- **Comparación formal:** comparar consultas equivalentes con filtros organizacionales e índices adecuados en `organization_id`.
- **Métricas obligatorias:** análisis de planes de ejecución mediante `EXPLAIN (ANALYZE, BUFFERS)` para descartar escaneos secuenciales innecesarios, latencias p50/p95 y consumo de memoria/CPU.
- **Documentación:** documentar degradaciones observadas y optimizaciones de índices recomendadas.
- **Prohibición:** no ofrecer una variante pública multitenant sin RLS.

### Casos de prueba negativos críticos:

- Usuario no autenticado intenta acceder a un recurso protegido.
- Usuario autenticado carece del permiso requerido.
- Usuario intenta acceder a un recurso ajeno.
- Usuario de una organización intenta acceder a datos de otra.
- Usuario intenta modificar el identificador de organización.
- Usuario intenta asociar entidades de organizaciones diferentes (violación de FK compuesta).
- Usuario intenta asignar permisos que no puede administrar.
- Usuario deshabilitado intenta continuar usando una sesión, según el mecanismo implementado.
- Usuario con concesión de acceso revocada (`revoked_at` registrado) intenta acceder a la organización.
- Administrador de plataforma intenta acceder directamente a datos organizacionales sin concesión explícita o intenta eludir RLS.
- Intento de asignación de privilegios administrativos o creación no autorizada de organizaciones en el registro público.
- Ejecución concurrente o repetida del comando de bootstrap del primer administrador.
- Conexión de aplicación con rol superusuario, propietario de tabla o con `BYPASSRLS` (debe fallar explícitamente).
- Consulta a tabla organizacional sin contexto organizacional o con contexto vacío (debe retornar cero filas).
- Peticiones concurrentes entre organizaciones compartiendo conexión de pool (sin contaminación cruzada de GUC).
- Intento de mutación de variable GUC mediante inyección o datos arbitrarios.
- Intento de `UPDATE` o `DELETE` sobre la tabla de auditoría de acciones (rechazado por base de datos).

Las pruebas deben verificar el resultado observable y que no se produzcan cambios indebidos en los datos.

## 12. Incorporación gradual de capacidades de seguridad

La autenticación, RBAC y multitenancy quedan fuera del MVP inicial.

Su incorporación posterior debe realizarse como capacidades funcionales, documentadas y verificables.

No se deben generar implementaciones incompletas que aparenten ofrecer seguridad sin aplicar los controles necesarios.

Antes de habilitar cada capacidad, deben definirse:

- Sus dependencias y requisitos.
- Las operaciones y recursos que protege.
- Los controles de autorización aplicables.
- Las interacciones con otras capacidades.
- Las pruebas de acceso permitido y denegado.
- Los riesgos y limitaciones conocidos.

La arquitectura inicial debe mantenerse sencilla. No se deben añadir capas o abstracciones de seguridad sin una necesidad concreta, pero tampoco se deben diseñar las capacidades futuras de forma que resulte innecesariamente difícil implementarlas de manera segura.

### Requisitos de documentación para desarrolladores (D-097)

Toda implementación de seguridad debe incluir dos niveles obligatorios de documentación técnica:

1. **Guía práctica breve:** orientada al desarrollador, con ejemplos concretos de cómo agregar nuevas tablas organizacionales, ejecutar operaciones autorizadas en transacciones y registrar eventos en la auditoría de acciones.
2. **Referencia técnica:** descripción detallada de políticas RLS, permisos de roles PostgreSQL, análisis de amenazas mitigadas, batería de pruebas de aislamiento, garantías formales y limitaciones conocidas.

## 13. Endurecimiento base implementado (commit 4295376, 2026-11-14)

Este apartado describe las garantías reales del endurecimiento de seguridad de la plantilla backend y de la SPA a fecha de las decisiones D-073, D-074 y D-075. Distingue explícitamente lo implementado, lo verificado y lo pendiente.

### Redacción de secretos (`src/redact.{ts,js}`)

**Implementado [CÓDIGO]:** `redact` cubre URLs con credenciales, cabeceras `Authorization` y `Proxy-Authorization` (Bearer, Basic y valor sin esquema), tokens Bearer independientes, cabeceras `Cookie`/`Set-Cookie`, y claves sensibles por nombre (`password`, `access_token`, `refresh_token`, `auth_token`, `token`, claves que terminen en `_secret`). Se aplica en arranque (`src/index`), cierre (`server.close`) y en el manejador global de errores (`console.error(redact(inspect(err, { depth: 5 })))`). Las cuatro plantillas de base de datos importan el módulo central; no hay copias.

**Límites conocidos:** no cubre `apiKey`, `privateKey`, `clientSecretKey` ni valores PEM multilínea. `redact` es una defensa adicional, no la única barrera. Los riesgos de ReDoS medidos en D-073 quedaron mitigados en T-022 (D-076): prefiltro `includes("://")`, esquemas `{0,63}`, clases negadas con escapes en comillas y backticks, con pruebas adversariales en Worker y pruebas de integración HTTP con JSON malformado.

### Límite de cuerpo de petición

**Implementado [CÓDIGO]:** `express.json({ limit: "100kb" })`. Respuestas 413 con el contrato uniforme de D-071.

### Cabeceras HTTP del backend (Helmet 8.3.0)

**Implementado [CÓDIGO]:** CSP global `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`. CSP específica de Swagger en `/docs` con `style-src 'self' 'unsafe-inline'` como única excepción. `x-powered-by` desactivado.

**No activado a propósito:** HSTS (`hsts: false`). Brixa no sabe dónde termina TLS; quien termine TLS en el servidor debe configurar HSTS en su proxy o servidor web.

**Verificado por el propietario [NO REPRODUCIDO POR EL AGENTE]:** CSP en `/api/health` con Docker: CSP estricta (`default-src 'none'`), una sola cabecera. Navegador sin violaciones CSP en `/` y en `/api/docs/` con `ENABLE_API_DOCS=true`.

### CORS (`cors 2.8.6`)

**Implementado [CÓDIGO]:** desactivado por defecto. `CORS_ALLOWED_ORIGINS` validada con Zod: solo acepta URLs HTTP o HTTPS válidas sin rutas, barras finales ni comodines; rechaza `*` y `null`. `Vary: Origin` solo cuando el middleware está activo. Sin `credentials: true`.

### Cabeceras de la SPA (Nginx, solo con Docker)

**Implementado [CÓDIGO]:** `server_tokens off` en bloque `server`. En `location /` con `always`: `Content-Security-Policy` (sin `unsafe-inline` ni `unsafe-eval`), `X-Content-Type-Options nosniff`, `X-Frame-Options DENY`, `Referrer-Policy no-referrer`. `location /api/` sin `add_header`.

**Limitaciones:** estas cabeceras solo están presentes con Docker. El servidor de desarrollo de Vite no las emite. Quien despliegue la SPA sin el Nginx generado debe configurarlas. Las respuestas 502 de Nginx (backend caído) no incluyen las cabeceras de `location /`.

**Diferencia conocida:** `X-Frame-Options` es `DENY` en la SPA y `SAMEORIGIN` en el backend (Helmet por defecto). Pendiente de unificar.

### Lo que no existe todavía

- `trust proxy`: no configurado.
- Rate limiting / protección de abuso: no implementado.
- HSTS: no activado.
- Autenticación, RBAC, multitenancy: fuera del alcance de 0.1.x.
