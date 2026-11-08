# Propuesta de revisión de arquitectura y plan post-MVP de Brixa — v3

**Estado:** PROPUESTA DE PLANIFICACIÓN ACTUALIZADA. Las decisiones expresamente aprobadas aparecen como **[APROB]**. Las operaciones Git de la sección 9 están **autorizadas para ejecutarse**, pero todavía no se consideran realizadas hasta verificar su resultado.
**Fecha:** 2026-11-07. **Sustituye a la v2** (conservada como referencia).
**IDs:** los identificadores de este documento son **provisionales** (`TP-nn` para tareas, `DP-nn` para decisiones) hasta reconciliarlos con los documentos oficiales. No son T-/D- oficiales.

---

## 1. Resumen ejecutivo

1. **La inspección de Antigravity confirma la base y corrige la v1** (Express 5.3.0, ausencia de React Router y de Zod, `redact` solo en migradores, composición por copia recursiva sin slots, 32 variantes, diferencia de imagen PostgreSQL entre plantillas y arnés, plantillas sin lockfiles).
2. **La versión 0.1.0 queda autorizada para congelarse ahora:** nombre `brixa` sin scope; commit exacto `fc1949068373220cc1048deb6f0f6eb0ac88870f`; CI en verde sobre ese commit, confirmado por el propietario; tag anotado `v0.1.0` y GitHub Release asociado marcado como pre-release. La ejecución todavía debe completar un preflight de Git y verificar el resultado remoto (§9). Después de preservar el tag, `main` puede avanzar.
3. **Orden recomendado:** (a) crear y verificar el tag y el GitHub Release; (b) ejecutar pruebas puntuales agrupadas sin reinspección estática ni `verify:generated` completo; (c) actualizar documentación oficial e IDs; (d) endurecimiento común del backend, incluida Zod; (e) decisiones de composición y estrategia JS/TS; (f) diseño e implementación de autenticación, autorización e identidad.
4. **Hallazgo nuevo de riesgo para auth:** la fusión actual de `package.json` conserva las claves de la base sin detectar conflictos y los overlays reemplazan archivos completos (`app`, `index`, `tsconfig`, `App`, `main`, `vite.config`). Con autenticación, dos capacidades tocarán los mismos archivos; el modelo actual no lo soporta sin pérdida silenciosa.
5. **Las plantillas no tienen lockfile**, así que las versiones probadas en las investigaciones o en `verify:generated` no son necesariamente las que recibirá un usuario. Es una decisión de reproducibilidad pendiente (DP-06).

---

## 2. Alcance, metodología y jerarquía de evidencia

**División de trabajo [APROB]:** Antigravity inspecciona el repositorio, ejecuta pruebas autorizadas e implementa; Claude analiza la evidencia que se le entrega y propone arquitectura, planificación y prompts; ChatGPT realiza una revisión crítica adicional; el propietario aprueba decisiones y operaciones. Ninguna herramienta debe atribuirse inspecciones o pruebas que no haya ejecutado.

**Limitación:** este documento se basa en la propuesta v2 y en el informe de inspección de Antigravity compartido por el propietario. La inspección estática no demuestra comportamiento en ejecución. Los resultados de INV-01…06 siguen siendo resultados reportados por Antigravity; no se consideran reproducidos por esta revisión.

**Etiquetas:**
- **[APROB]** decisión aprobada por el propietario.
- **[INSP]** estado del repositorio reportado por Antigravity (inspección **estática**; no demuestra comportamiento en ejecución).
- **[DOC]** documentación oficial del proyecto.
- **[REP]** resultado reportado por las investigaciones INV-01…06 (no reproducido por mí).
- **[INF]** inferencia mía. **[REC]** recomendación pendiente de aprobación.
- **[VERIF]** por verificar, con la fuente o la prueba que lo resolvería.

No tengo los informes originales de INV-01, 02, 03, 04a, 05a, 05b y 06 (solo anexos y complementos).

---

## 3. Estado actual de Brixa

### 3.1 Git y paquete [INSP]
Según la inspección reportada: rama `main`, HEAD `fc1949068373220cc1048deb6f0f6eb0ac88870f`, sincronizado con `origin/main`, working tree limpio, **sin tags**; `package.json`: `name: brixa`, `version: 0.1.0`. El propietario confirma que no hay cambios pendientes y que CI está en verde sobre ese commit. Ese hash es el estado que se conservará como 0.1.0 **[APROB]**. Antes de crear el tag, Antigravity debe repetir únicamente el preflight de Git para impedir operar si el estado cambió desde la inspección.

### 3.2 Dependencias declaradas [INSP]

| Elemento | Valor declarado | Notas |
|---|---|---|
| Express | 5.3.0 (ambas plantillas backend) | Confirma la hipótesis de la v1 |
| TypeScript (CLI) | 6.0.3 | |
| Drizzle ORM / Kit | 0.45.4 / 0.31.11 | |
| `pg` / `@libsql/client` | 8.23.1 / 0.18.0 | |
| React, React DOM | `^19.3.1` | rango, no versión fija |
| Vite / `@vitejs/plugin-react` | `^8.3.4` / `^6.1.2` | rango |
| `@types/node` | `^24.19.2` (frontend TS) vs 26.x (CLI y backend TS) | diferencia |
| Zod, React Router | **no instalados** | |
| i18next, react-i18next, detector | hardcodeados en el generador | |
| **Lockfiles en plantillas** | **no existen** | las versiones resueltas **no están confirmadas** |

**Importante:** una versión en `package.json` no es la que npm resolverá. Donde hay rango (`^`), el resultado depende del día de instalación. Ninguna versión «resuelta» aparece en este documento porque nadie la ha reportado.

### 3.3 Node y Docker [INSP]
`engines.node`: `^24.0.0 || >=26.0.0`. Backend: `node:24.22.1-slim`. Nginx: `nginxinc/nginx-unprivileged:1.30.6-alpine-slim`. Compose generado: `postgres:17.4-alpine`. **Arnés de verificación: `postgres:17-alpine`** (etiqueta flotante, distinta de la que se genera).

### 3.4 Variantes [INSP]
32 entradas en `src/verified-variants.ts` y 32 en `scripts/verify-generated.js`, sin duplicados; la correspondencia se comprueba al ejecutar. Hay combinaciones generables no declaradas, marcadas como experimentales. Declarar una variante verificada ≠ haberla ejecutado en un momento dado.

### 3.5 Redacción de secretos [INSP]
`redact` existe en **cuatro archivos** de overlays de base de datos (PostgreSQL JS/TS y SQLite JS/TS) y solo se usa en el `catch` de los migradores. El manejador global de errores de Express hace `console.error(err)` **sin redacción**. No existe redacción general.

### 3.6 Composición de overlays [INSP]
Copia recursiva; overlays que reemplazan archivos completos (API Docs: `src/app`, `src/index`, `tsconfig.json`; i18n: `App`, `main` y otros; fullstack: `vite.config`); **sin slots**; `compose.yaml` copiado entero; configuración de API Docs añadida por sustitución de texto; `package.json` fusionado por secciones **conservando las claves de la base sin detectar conflictos**; dependencias de API Docs duplicadas entre archivos de plantilla y lógica hardcodeada del generador; las de i18n, definidas en el generador.

---

## 4. Hallazgos principales (actualizados)

| # | Hallazgo | Fuente | Estado respecto a v1 |
|---|---|---|---|
| H1 | Nombre `brixa` sin scope; el plan B de D-059 (`@acjoell/brixa`) queda **descartado** | [APROB] | Resuelto: pendiente de registrar |
| H2 | Estrategia de congelación: tag anotado `v0.1.0` + pre-release de GitHub (§9) | [APROB]; ejecución autorizada, pendiente de resultado | Nuevo |
| H3 | Zod: **aprobado**, **no implementado**; versión por verificar | [APROB]+[INSP] | v1 lo trataba como «sin registro»: sigue sin registro, y ahora se sabe que tampoco hay código |
| H4 | Express es **5.3.0** | [INSP] | Confirma H4 de v1. Los resultados de INV-05a sobre Express 4 **no** son aplicables |
| H5 | PHC Base64URL sin corregir en el anexo disponible de INV-01 | [REP] | Se mantiene |
| H6 | INV-05a propone `en.json` siempre presente; contradice D-052 | [REP] vs [DOC] | Se mantiene |
| H7 | INV-04b asume `is_active` y «membership» | [REP] | Se mantiene; el propietario pide no universalizarlo [APROB] |
| H8 | «76 combinaciones» ≠ «76 pares» ≠ 32 variantes | [REP]+[INF] | Se mantiene; ahora hay cifra real de variantes (32) |
| H9 | **32 variantes**; la cifra 34 de D-052 es incorrecta | [INSP] | Resuelto: corregir documentación |
| H10 | Referencia a T-013e inexistente en D-052 (según el TASKS.md que yo tengo) | [DOC] | Sin cambios; ver colisión de IDs §11.1 |
| H11 | `redact` **no** es una solución general: 4 copias, solo migradores | [INSP] | Corrige v1 (que lo trataba como deuda de test); queda abierto si el test del CLI ejecuta la función real |
| H12 | `yaml` como dependencia: sigue sin existir; la composición YAML estructurada **no existe** | [INSP] | Corrige cualquier lectura de v1 que sugiriera lo contrario |
| H13 | **`package.json` se fusiona sin detectar conflictos** | [INSP] | Nuevo |
| H14 | **Plantillas sin lockfile; React/Vite con rango** | [INSP] | Nuevo |
| H15 | **Arnés usa `postgres:17-alpine`, plantillas `17.4-alpine`** | [INSP] | Resuelve la duda de v1 sobre qué etiqueta usa el compose real; D-047/D-049 (`postgres:17`) quedan desactualizados |
| H16 | **`@types/node` 24.x (frontend TS) vs 26.x (backend TS, CLI)** | [INSP] | Nuevo. Ver nota §5.1 |
| H17 | **React Router no existe en Brixa**; INV-03b lo probó (8.5.1) porque lo asumía en la plantilla futura | [INSP] | Nuevo: la elección del router no está decidida |

---

## 5. Evaluación de INV-01 a INV-06 (actualizada)

### 5.1 INV-01 — Hashing
Sin cambios sustanciales respecto a v1: Argon2id `m=19456,t=2,p=1` candidato; scrypt OWASP produce OOM kill en contenedores pequeños [REP]; cola con relevo directo corrige el defecto previo; la cola **no** protege ante ataques distribuidos [REP]; PHC Base64URL sin corregir (H5).

**Nuevo por la inspección:** `engines.node` admite `24.0.0`–`24.6.x`, donde `crypto.argon2` no existe [REP: anexo INV-01]. Además, el backend TS usa `@types/node` 26.x [INSP]: **con esos tipos, `crypto.argon2` compilaría aunque el runtime fuera Node 24.0** [INF]; el type-check no detectaría la incompatibilidad. Si se elige Argon2 nativo, el proyecto generado necesitaría un `engines` propio (≥ 24.7.0 según el anexo) y tipos alineados con él. La estabilidad por versión sigue [VERIF] (páginas oficiales de Node por versión).

### 5.2 INV-02 — Validación, cabeceras, logging
- Resultados con `pg` 8.23.1 y `@libsql/client` 0.18.0 son aplicables (coinciden con las plantillas [INSP]); los del `pg` 8.13.1 y `better-sqlite3` del informe original, no.
- **Zod**: ver §8.2.
- **Fuga de secretos:** confirmada la **ausencia** de redacción en el manejador global (H11). Si la fuga de `@libsql/client` (token en URL) llega a producirse en Brixa depende de qué URLs admite el cliente de la plantilla; **no puedo concluirlo** con lo reportado → prueba puntual TP-02/P3.
- Nginx y `trust proxy`: sin cambios; el estado actual de la plantilla Nginx coincide con lo auditado en INV-02 solo si el archivo no cambió desde entonces [VERIF en TP-01 si es necesario; no lo doy por confirmado].

### 5.3 INV-03b — Sesiones/cookies/frontend
Resultados de navegador (Chromium 156, Firefox 157; Safari no verificado) siguen válidos como evidencia sobre cookies, `__Host-`, `Secure` en loopback y proxy. **React Router no forma parte de Brixa** [INSP]: las conclusiones de accesibilidad (título, foco, anuncios) se aplican al *router que se elija* cuando existan vistas con auth; no a código actual. La elección del router es una decisión no tomada (DP-10b).

### 5.4 INV-04a/04b — RLS e identidad
Sin cambios de evidencia. Recordatorio: el contrato `DATABASE_URL` único actual cambia con RLS (dos roles/URLs). Imagen de prueba `17.4-alpine` **coincide con la de las plantillas** [INSP], lo que refuerza la aplicabilidad de INV-04a a Brixa (no el arnés, que usa `17-alpine`).

### 5.5 INV-05a — Composición
La v1 ya señalaba que era propuesta. Ahora está confirmado el punto de partida real (§3.6). Reevaluación:
- **Compose:** hoy copia completa. Cualquier capacidad que necesite un servicio adicional (p. ej. un servicio de sesiones, un rol de BD) requiere composición. Alternativa Compose nativa (varios ficheros/`include`) o fusión semántica: aún sin decidir, [VERIF] versión mínima de Compose.
- **`package.json`:** la fusión que conserva silenciosamente la clave de la base es **el riesgo más concreto**: un overlay que intente cambiar un script o una dependencia existente **no lo hará** y nadie se enterará [INF a partir de INSP].
- **Archivos reemplazados:** con auth (que toca `app`, `index`, `tsconfig`, `.env.example`, compose, `package.json` y, en frontend, `App`/`main`), solo una de las capacidades puede reemplazar cada archivo [INF].
- **Duplicación de dependencias entre plantilla y generador:** API Docs e i18n definen versiones en dos sitios; riesgo de divergencia (por ejemplo, subir una versión en un lado). Candidato a unificar sin necesidad de un motor general [INF].
- **i18n con `en.json` obligatorio** (H6): sigue contradiciendo D-052.

### 5.6 INV-05b — JS/TS
Sin cambios, con una precisión: `ts-blank-space` exige TS 5.1–5.7 y el CLI usa 6.0.3 [REP+INSP]. La derivación también debe tener en cuenta que `@types/node` difiere entre plantillas (H16).

### 5.7 INV-06 — Verificación
- Matriz: 32 declaradas = 32 en el arnés [INSP]. **Cobertura pairwise real: no calculada**; la computación es estática sobre la lista y entra en la prueba agrupada (TP-02/P7).
- **Plantillas sin lockfile** implican que `verify:generated` prueba lo que npm resuelva ese día; los resultados no son reproducibles bit a bit [INF a partir de INSP]. Esto matiza la afirmación de «reproducible» en D-040/D-053.
- Arnés con `postgres:17-alpine` frente a `17.4-alpine` generado: la verificación no prueba exactamente lo que se entrega [INSP/INF].
- Instalaciones independientes y caché compartida **[APROB]**; no se revisa más aquí.

---

## 6. Discrepancias y su estado tras la inspección

| Elemento | v1 | Estado actual | Qué falta |
|---|---|---|---|
| Express | 4.21.2 vs 5.3.0 | **5.3.0** [INSP] | Prueba puntual de recorrido de subrouters en 5.3.0 (TP-02/P4) |
| `pg` | 8.13.1 vs 8.23.1 | **8.23.1** [INSP] | — |
| SQLite | tres drivers | **`@libsql/client` 0.18.0** [INSP] | — |
| Postgres en Docker | 17 / 17.4-alpine / 17-alpine | Plantillas `17.4-alpine`; arnés `17-alpine`; D-047/049 dicen `17` [INSP+DOC] | Decisión de alineación (DP-15) |
| React / Vite | 19.3.1 / 8.3.x | `^19.3.1` / `^8.3.4` (rangos) | Versión **resuelta**: TP-02/P1 |
| Drizzle | 0.45.1 vs 0.45.4 | 0.45.4 en plantilla [INSP]; prototipo INV-05b con 0.45.1 | Repetir derivación en el piloto si se adopta |
| TypeScript | 5.7.x vs 6 | CLI 6.0.3; versión en plantillas generadas: **no reportada** | TP-02/P1 |
| `@types/node` | — | 24.x frontend TS vs 26.x resto | DP-15 |
| Argon2/Node | estabilidad variable | `engines` admite 24.0; API desde 24.7.0 | [VERIF] documentación oficial (TP-09) |
| PHC | Base64URL vs estándar | sin corregir | [VERIF] especificación y librería (TP-09) |
| OpenAPI | stack por versión | Express 5.3.0, test con `app.router.stack` [DOC+INSP] | TP-02/P4 |
| Variantes | 32 vs 34 | **32** [INSP] | Corregir docs (TP-02) |
| `yaml` | dev vs runtime | no existe | Si se adopta, runtime |
| `redact` | deuda de test | 4 copias, solo migradores, sin general [INSP] | ¿El test usa la función real? (TP-02/P5) |

**Sobre las cifras (H8):** combinaciones válidas = 76 [REP, coincide con D-053]; variantes verificadas = **32** [INSP]; pares de valores válidos entre dominios = 76 según mi cálculo [INF]; ejecuciones reales = las que Antigravity/CI realicen. Cobertura pairwise = fracción de esos pares cubierta por las 32 variantes: **no calculada todavía**.

---

## 7. Revisión transversal (con el estado real)

```
Congelar 0.1.0 (TP-01) ──► main puede avanzar
          │
          ▼
Pruebas puntuales agrupadas (TP-02) ──► higiene documental (TP-03)
          │                                      │
          └──────────────────┬───────────────────┘
                             ▼
        ┌─────────────────────────┼──────────────────────────┐
        ▼                         ▼                          ▼
Endurecimiento backend      Reproducibilidad /        Composición + JS/TS
(redacción, Zod, Nginx)     alineación versiones      (decisiones y piloto)
        │                         │                          │
        └──────────────► Modelo de amenazas / T-014 diseño ◄─┘
                                  │
                   Auth → Identidad → RBAC → Multi-organización (PG)
```

- **La composición actual no soporta N capacidades sobre los mismos archivos** (§5.5). Es prerrequisito de auth, no una mejora opcional.
- **Zod y la redacción central** no dependen de auth, mejoran todas las variantes backend y **cambian los archivos que auth también tocará**; conviene hacerlos *antes* para que auth construya sobre ellos.
- **Reproducibilidad (lockfiles/versiones fijas)** condiciona cómo se interpretan todas las verificaciones futuras.
- **RLS cambia el contrato de base de datos** (roles, `MIGRATION_DATABASE_URL`); SQLite queda fuera de RLS.

---

## 8. Estado de las decisiones relevantes

### 8.1 Confirmadas por el propietario [APROB]
Nombre `brixa` sin scope; versión 0.1.0; commit `fc19490…` como punto de conservación; esperar al ticket de npm; caché npm compartida con `node_modules` independientes y symlinks aplazados; Zod obligatorio en backend; modelo genérico usuario/organización/concesión de acceso/roles/permisos/alcances, sin suscripciones ni jerarquías impuestas ni `isActive` universal.

### 8.2 Zod: tres estados separados
| Aspecto | Estado |
|---|---|
| Decisión de producto | **Aprobada** [APROB] |
| Implementación | **Pendiente**: no está en plantillas ni en el CLI [INSP] |
| Versión concreta | **Por verificar** (INV-02 menciona 4.6.7 sin fuente registrada) |
| Integración | **Por diseñar**: variables de entorno (evitar `z.coerce.number()` con `""`), validación de `body/params/query` y datos validados en `req.validated` (Express 5, `req.query` de solo lectura) [REP] |
Decisión pendiente asociada: cómo se declara la dependencia (¿en la plantilla base o vía el generador, como hoy en API Docs/i18n?) → ver DP-07.

### 8.3 Modelo de identidad (conservado de v1)
Conceptos: **usuario** (global), **organización** (frontera de datos y administración, solo con multi-organización), **concesión de acceso** (evitar «membership» por su connotación comercial), **rol**, **permiso** (catálogo en código), **alcance** (v1: sistema/organización). Sucursales y unidades: tablas de la aplicación, no primitiva de Brixa en v1. **Pendientes de decisión:** estado de la concesión (borrado, `revoked_at` o `status`; sin `is_active` universal), columna de alcance desde el inicio o migración manual futura (un proyecto generado no recibe migraciones de Brixa), multi-organización solo con PostgreSQL (SQLite sin RLS), identidad externa (solo contrato), primer admin mediante script del proyecto generado (credenciales por entrada interactiva/stdin, sin contraseñas por defecto, sin depender del CLI, ejecutable como JS compilado en Docker). Contexto explícito (no ALS) y validación de la concesión en cada petición. Detalle completo en la v1 §8; no ha cambiado por la inspección.

---

## 9. Congelación de 0.1.0 y GitHub Release

**Estado: APROBADO Y AUTORIZADO PARA EJECUCIÓN [APROB].** El propietario autorizó el 2026-11-07 preservar el commit `fc1949068373220cc1048deb6f0f6eb0ac88870f` mediante un tag anotado `v0.1.0` y crear el GitHub Release asociado como *pre-release*. El propietario confirmó que CI está en verde para ese commit. La autorización no significa que las operaciones ya se hayan realizado: el resultado debe verificarse y reportarse.

### 9.1 Identidad de la versión

| Elemento | Valor esperado |
|---|---|
| Nombre del paquete | `brixa` |
| `package.json` version en el commit | `0.1.0` |
| Commit objetivo | `fc1949068373220cc1048deb6f0f6eb0ac88870f` |
| Tag anotado | `v0.1.0` |
| GitHub Release | `Brixa v0.1.0`, inicialmente marcado como pre-release |
| Publicación npm | Pendiente de que npm resuelva la solicitud/ticket |

No se utilizará `v0.1.0-rc.1`. El sufijo `-rc.1` sería parte de la versión SemVer y normalmente exigiría que `package.json` declarara `0.1.0-rc.1`. Aquí queremos conservar y publicar exactamente el snapshot cuyo `package.json` ya declara `0.1.0`.

La marca *pre-release* pertenece al GitHub Release. No altera el tag, el commit ni la versión declarada en `package.json`. Por ello, el Release puede pasar más adelante a estable sin mover el tag.

### 9.2 Preflight obligatorio antes de crear el tag

Aunque el propietario ya confirmó que el estado estaba limpio, sincronizado y que CI está verde, Antigravity debe volver a comprobar inmediatamente antes de operar:

1. Rama actual `main`.
2. `HEAD` exactamente igual a `fc1949068373220cc1048deb6f0f6eb0ac88870f`.
3. Working tree limpio.
4. `origin/main` apunta al mismo commit.
5. El `package.json` contenido en ese commit declara `name: brixa` y `version: 0.1.0`.
6. No existe `v0.1.0` local ni remoto.
7. `origin` y el repositorio GitHub resuelto por `gh` corresponden al repositorio correcto.

Si cualquier condición falla, **detenerse sin crear, mover, borrar ni forzar tags** y reportar la discrepancia. No intentar corregirla automáticamente.

### 9.3 Ejecución autorizada

Con el preflight satisfecho:

1. Crear un tag **anotado** `v0.1.0` apuntando al hash completo `fc1949068373220cc1048deb6f0f6eb0ac88870f`, no a un `HEAD` implícito.
2. Verificar localmente que `v0.1.0^{commit}` resuelve exactamente al hash objetivo.
3. Subir únicamente ese tag a `origin`. No hacer push de `main` ni crear commits.
4. Verificar que la referencia remota del tag y su commit asociado coinciden con el hash objetivo.
5. Crear el GitHub Release `Brixa v0.1.0`, asociado a `v0.1.0`, con la opción *pre-release* activada.
6. Incluir notas honestas: el código fuente de esta versión queda preservado, pero el paquete todavía no está publicado en npm debido a la revisión pendiente del nombre. `npx brixa` no estará disponible hasta la publicación.
7. Reportar URL del Release, hash del commit, objeto del tag, estado de publicación y cualquier paso que no haya podido completarse.

Si el tag se crea y sube correctamente, pero falla la creación del Release, **no borrar ni mover el tag**. Reportar el estado parcial y completar el Release en una operación posterior.

No adjuntar un tarball construido sin verificarlo. El código fuente del tag y el tarball que se publique en npm son artefactos distintos; no afirmar igualdad byte a byte.

### 9.4 Protección del tag

La política operativa es no mover ni reutilizar `v0.1.0`. Se recomienda proteger el patrón `v*` mediante las reglas de tags del repositorio si la configuración disponible lo permite.

La creación o modificación de reglas de protección de GitHub es un cambio de configuración del repositorio y **no está incluida automáticamente en la operación autorizada**. Antigravity debe comprobar si ya existe una regla aplicable y reportarlo. Si no existe, debe indicarlo para que el propietario la configure o autorice expresamente ese cambio. No modificar reglas del repositorio sin autorización adicional.

### 9.5 Publicación futura en npm

Cuando npm autorice la publicación:

1. Hacer checkout limpio del tag `v0.1.0` en un directorio de trabajo separado.
2. Confirmar que el commit coincide con `fc1949068373220cc1048deb6f0f6eb0ac88870f`.
3. Confirmar que `package.json` declara `brixa@0.1.0`.
4. Ejecutar `npm ci`, `npm pack --dry-run` y las comprobaciones de contenido del paquete que correspondan.
5. Publicar desde ese checkout del tag, nunca desde un `main` posterior.
6. Verificar la versión publicada en npm y probar la instalación desde un directorio limpio.
7. Cambiar el GitHub Release de *pre-release* a estable sin modificar el tag.

No se publicará desde una rama `main` que haya avanzado respecto al tag. La versión que `main` debe declarar para el siguiente ciclo y la conveniencia de una guarda `prepublishOnly` quedan pendientes de decisión. Hasta resolverlo, la regla es publicar exclusivamente desde el checkout verificado del tag.

### 9.6 Cambios posteriores y correcciones

Una vez creado `v0.1.0`, ese tag representa permanentemente el snapshot original.

- Los cambios nuevos se realizan en `main`.
- No se modifica ni reutiliza `v0.1.0`.
- Si se detecta un defecto en el código congelado y todavía no se publicó, se evalúa una nueva versión y un nuevo commit/tag. No se mueve `v0.1.0` para apuntar a código distinto.
- Si la corrección corresponde a una versión patch posterior, se utilizará el siguiente número de versión aprobado (por ejemplo, `0.1.1`), con su propio commit y tag.
- La decisión de versión para el siguiente ciclo de desarrollo se toma antes de la siguiente publicación, no como parte de la creación de `v0.1.0`.

### 9.7 Restricción anterior de D-059

La restricción «no tocar plantillas hasta publicar 0.1.0» deja de ser necesaria para proteger el snapshot una vez creado y verificado el tag `v0.1.0`. Después del tag, `main` puede avanzar. La documentación oficial debe actualizar D-059/T-014 para que el bloqueo sea «0.1.0 preservada por tag» y no «0.1.0 publicada en npm», siempre que el tag y Release hayan sido creados correctamente.

---

## 10. Riesgos y garantías de seguridad (cambios)

La tabla de garantías de la v1 §10.1 se mantiene. Añadidos por la inspección:

| Riesgo | Hecho | Consecuencia |
|---|---|---|
| Errores con secretos en logs del servidor | `console.error(err)` sin redacción [INSP] | Cualquier mensaje de error de driver o de validación que contenga URL/token se imprime tal cual [INF] |
| Redacción duplicada | 4 copias en overlays [INSP] | Riesgo de divergencia; una corrección debe hacerse 4 veces [INF] |
| Fusión de `package.json` sin conflictos | [INSP] | Un overlay de seguridad (p. ej. subida de una dependencia) puede no aplicarse sin aviso [INF] |
| Versiones sin lockfile | [INSP] | Una dependencia vulnerable resuelta hoy puede no coincidir con la verificada; `npm audit` en `verify:generated` mide lo resuelto ese día |
| Docker `COPY drizzle*` sin `drizzle/` | **comportamiento desconocido** [DOC+incertidumbre] | Podría fallar el build o producir imagen sin migraciones: [VERIF] TP-02/P2 |

---

## 11. Reorganización de tareas

### 11.1 Reconciliación de IDs

El `TASKS.md` descrito por la v2 llega a T-016, contiene T-013d y tiene una referencia a T-013e que no aparece. En conversaciones previas también se propuso T-019 para el tag/pre-release. Como este documento no tiene acceso al estado actual de `TASKS.md`/`DECISIONS.md`, los IDs aquí son provisionales (`TP-nn`/`DP-nn`).

**No asignar IDs oficiales ni modificar los documentos oficiales hasta reconciliar las series existentes.** La reconciliación documental se realizará después de preservar `v0.1.0`; Antigravity puede ayudar a identificar referencias al ejecutar la tarea documental, pero no forma parte del encargo de tag.

### 11.2 Tareas provisionales

| ID prov. | Referencia v1/v2 | Tipo | Descripción | Estado | Depende de |
|---|---|---|---|---|---|
| TP-01 | T-019 propuesto previamente | Operación Git/GitHub | Crear tag anotado `v0.1.0` sobre el commit exacto y GitHub Release pre-release. Preflight, push del tag y verificación remota. | **APROBADA Y AUTORIZADA; pendiente de ejecución** | Preflight §9.2 |
| TP-02 | T-017 (parte técnica) | Verificación puntual | Resolver versiones resueltas, `COPY drizzle*`, fuga de secretos con URLs ficticias/loopback, subrouters Express 5.3.0, test de `redact` y cobertura pairwise. No repetir auditoría estática ni ejecutar `verify:generated` completo. | PROPUESTA; no bloquea TP-01 | TP-01 recomendado para preservar primero la versión |
| TP-03 | T-017 (parte documental) | Documentación | Higiene documental: 34→32; D-047/049 y etiqueta PostgreSQL; T-013e/IDs; duplicados en T-013; `AGENTS.md`/`CLAUDE.md` «desde cero» y Foundry; `SECURITY.md` `carWashId`; `PROJECT_VISION` §10; registrar decisiones aprobadas y el tag una vez creado. | PROPUESTA | TP-01; TP-02 para datos que requieran prueba |
| TP-04 | T-015 | Seguimiento/publicación | Esperar la respuesta del ticket de npm. Cuando autoricen, publicar estrictamente desde el checkout de `v0.1.0`. | EN ESPERA | TP-01 y autorización de npm |
| TP-05 | T-020 (parte) | Implementación | Redacción central: extraer `redact` (4 copias) a un único punto y usarlo también en el manejador global de errores. | PROPUESTA | TP-02/P3; decisión DP-04 |
| TP-06 | T-020 (parte) | Implementación | Zod: dependencia, validación de entorno y peticiones, datos validados en `req.validated`, versión verificada. Zod obligatorio en backend ya está aprobado. | PROPUESTA | Decisión de producto aprobada; versión y diseño técnico por resolver |
| TP-07 | T-021 | Investigación/diseño | Nginx y `trust proxy` por topología; evaluar `helmet` frente a configuración manual. | PROPUESTA | Evidencia INV-02; pruebas puntuales necesarias |
| TP-08 | Nuevo | Decisión | Reproducibilidad de plantillas: versiones exactas, lockfile generado o rangos con riesgo asumido. | PENDIENTE | TP-02/P1 |
| TP-09 | T-025 | Verificación documental/técnica | Estabilidad de `crypto.argon2` por versión de Node y compatibilidad PHC estándar/`@node-rs/argon2`. | PROPUESTA | Fuentes oficiales y pruebas específicas |
| TP-10 | T-023 | Investigación/piloto | Derivación TS→JS sobre un overlay, con comparación contra el JS existente. | PROPUESTA | Decisión DP-08; versiones reales confirmadas |
| TP-11 | T-024 | Investigación/prototipo | Composición: fusión estricta de `package.json`, slots mínimos y alternativa de Compose nativo frente a fusión semántica. | PROPUESTA | TP-10 y decisión DP-07 |
| TP-12 | T-022 | Verificación | OpenAPI/Express 5.3.0: método de detección de rutas y subrouters. | Absorbida como prueba en TP-02/P4; diseño posterior separado si es necesario | TP-02/P4 |
| TP-13 | T-026 / parte de T-014 | Diseño | Modelo de amenazas y contrato de capacidades `auth`/`rbac`/`multi-org`. | PROPUESTA | Diseño independiente; hashing condiciona implementación, no todo el modelo |
| TP-14 | T-027 | Verificación/implementación | Informe de cobertura de pares en el arnés; convertir el cálculo de TP-02/P6 en control automático si aporta valor. | PROPUESTA | TP-02/P6 |
| TP-15 | T-028+ | Implementación/verificación | Auth, RBAC, multi-organización, primer admin y E2E. Desglosar después de aprobar decisiones de arquitectura. | NO DEFINIDA | Decisiones DP-09…DP-13 aprobadas y composición preparada |

### 11.3 Prioridad

1. **Preservar la versión aprobada:** TP-01.
2. Resolver incertidumbres técnicas puntuales relevantes: TP-02. No bloquean la creación del tag y no deben convertirse en una reinspección general.
3. Actualizar los documentos oficiales y reconciliar IDs: TP-03.
4. Endurecer las plantillas actuales: TP-05, TP-06 y TP-07, después de aprobar sus diseños concretos.
5. Resolver reproducibilidad, composición y estrategia JS/TS: TP-08, TP-09, TP-10 y TP-11.
6. Diseñar y posteriormente implementar autenticación, autorización y multi-organización: TP-13 y TP-15.

---

## 12. Dependencias, orden y siguientes encargos

### 12.1 Orden de ejecución

1. **TP-01:** crear y verificar `v0.1.0` y el GitHub Release pre-release. Esta operación está autorizada y es el primer paso.
2. **TP-02:** ejecutar pruebas puntuales agrupadas en directorios temporales. No ejecutar `verify:generated` completo.
3. **TP-03:** corregir documentación oficial, reconciliar IDs y registrar decisiones aprobadas, usando resultados de TP-01/TP-02.
4. **TP-05/TP-06/TP-07:** endurecimiento común del backend, con tareas y criterios de aceptación separados.
5. **TP-08/TP-09/TP-10/TP-11:** cerrar decisiones de reproducibilidad, hashing, composición y JS/TS.
6. **TP-13:** completar el diseño de amenazas, capacidades y autorización.
7. **TP-15:** implementar auth/RBAC/multi-organización después de aprobar el diseño y tener una composición de overlays capaz de integrar capacidades sin sobrescrituras destructivas.

### 12.2 Qué no se hace

- No se implementan symlinks de `node_modules`; siguen aplazados.
- No se ejecuta `verify:generated` completo; lo ejecuta el propietario.
- No se repite la auditoría estática de dependencias, variantes, Docker y composición ya realizada.
- No se publica en npm hasta que se resuelva el ticket.
- No se modifica ni se reutiliza el tag `v0.1.0` una vez creado.

### 12.3 Incertidumbres abiertas y cómo se cierran

| Incertidumbre | Cómo se cierra |
|---|---|
| Estado real del tag y Release | TP-01: verificación local y remota tras crear |
| Versiones resueltas de dependencias de plantillas | TP-02/P1 en variantes temporales, con `npm` y Node reportados |
| `COPY drizzle*` sin `drizzle/` | TP-02/P2, builds Docker temporales |
| Fuga de secretos en drivers y middleware global | TP-02/P3, secretos ficticios y loopback |
| Detección de subrouters con Express 5.3.0 | TP-02/P4 |
| ¿El test de `redact` usa la función real? | TP-02/P5 |
| Cobertura pairwise de las 32 variantes | TP-02/P6 |
| Estabilidad de Argon2 por versión; PHC | TP-09 |
| Variantes experimentales completas | No ejecutar ahora; decidir con la matriz futura qué combinaciones merecen promoción |
| IDs documentales | TP-03 al actualizar los documentos; no forma parte de las pruebas técnicas |

### 12.4 Prompt TP-01 para Antigravity: crear tag y GitHub Release

**Este encargo está autorizado por el propietario.** Ejecutar solo las operaciones indicadas después del preflight. No realizar cambios de código ni documentación.

> Sigue AGENTS.md. Sin commits. No leas ni actualices ningún .md. No ejecutes verify:generated completo: lo ejecuto yo.
>
> ## Objetivo
>
> Crear y publicar el tag anotado `v0.1.0` sobre el commit exacto `fc1949068373220cc1048deb6f0f6eb0ac88870f` y crear el GitHub Release asociado como pre-release.
>
> El propietario autorizó expresamente esta operación. El propietario confirmó que CI está en verde para ese commit. No cambies ningún archivo del repositorio, no crees commits y no publiques en npm.
>
> ## Preflight obligatorio
>
> Comprueba y reporta antes de operar:
>
> 1. Rama actual `main`.
> 2. `git rev-parse HEAD` es exactamente `fc1949068373220cc1048deb6f0f6eb0ac88870f`.
> 3. Working tree limpio (`git status --porcelain` sin salida).
> 4. `origin/main` apunta al mismo commit.
> 5. El `package.json` leído directamente desde ese commit declara `name: brixa` y `version: 0.1.0`.
> 6. No existe `v0.1.0` local ni remoto.
> 7. `origin` y el repositorio que reconoce GitHub CLI corresponden al repositorio esperado.
>
> Si alguna condición falla, detente. No corrijas el estado, no cambies de rama, no muevas tags, no hagas force push y no continúes parcialmente sin reportar la discrepancia.
>
> ## Crear tag
>
> Si el preflight está satisfecho:
>
> 1. Crea un tag anotado `v0.1.0` que apunte explícitamente a `fc1949068373220cc1048deb6f0f6eb0ac88870f`.
> 2. Verifica que `git rev-parse 'v0.1.0^{commit}'` devuelve ese hash.
> 3. Sube únicamente `refs/tags/v0.1.0` a `origin`. No hagas push de ramas.
> 4. Verifica el tag remoto y el commit al que apunta con `git ls-remote`.
>
> No utilices `--force` ni elimines tags.
>
> ## Crear GitHub Release
>
> Comprueba que no exista ya un Release `v0.1.0`. Si el tag remoto está correcto y el Release no existe, crea:
>
> - Título: `Brixa v0.1.0`.
> - Tag: `v0.1.0`.
> - Pre-release: activado.
> - No marcar como latest estable.
>
> Notas sugeridas:
>
> `This pre-release preserves the Brixa 0.1.0 source snapshot at commit fc1949068373220cc1048deb6f0f6eb0ac88870f. The package has not yet been published to npm while the package-name review is pending. The npx brixa command will not be available until the npm publication is completed. To test this source snapshot, clone the v0.1.0 tag and run npm ci followed by npm run build.`
>
> Si el tag se creó y subió, pero falla la creación del Release, no borres ni muevas el tag. Reporta el estado parcial y el error.
>
> ## Protección del tag
>
> Comprueba si ya existe una regla de protección aplicable a `v*`. No modifiques reglas, settings ni rulesets del repositorio en este encargo. Si no existe protección, indícalo para que el propietario decida configurarla.
>
> ## Informe final
>
> Reporta:
>
> - Hash del commit objetivo.
> - Estado del preflight.
> - Tag local y remoto, y hash de commit al que apunta.
> - URL del GitHub Release.
> - Confirmación de que está marcado como pre-release.
> - Estado de la regla de protección de tags.
> - Cualquier operación que no se haya podido completar.
>
> No ejecutes `npm publish`, no cambies `package.json`, no modifiques archivos, no crees commits y no hagas push de `main`.

### 12.5 Prompt TP-02 para Antigravity: pruebas puntuales agrupadas

Este encargo se ejecuta **después de preservar `v0.1.0`**. No modifica el repositorio; utiliza directorios temporales y los limpia al terminar.

> Sigue AGENTS.md. Sin commits. No leas ni actualices ningún .md. No ejecutes verify:generated completo: lo ejecuto yo.
>
> ## Objetivo
>
> Resolver incertidumbres de ejecución detectadas en la revisión de Brixa. La inspección estática del repositorio ya fue realizada; no la repitas. No implementes correcciones.
>
> Trabaja con el CLI compilado y proyectos temporales. Conserva el repositorio y su working tree sin modificaciones. Registra versión de Node, npm, Docker (cuando aplique), sistema operativo y fecha.
>
> **P1 — Versiones resueltas.** Genera `frontend+ts`, `backend+ts+postgres`, `backend+js+sqlite` y `fullstack+ts+sqlite+i18n`. Reporta versiones declaradas y resueltas de dependencias directas relevantes. Identifica lockfiles antes y después. Utiliza `npm install --ignore-scripts` en los directorios temporales para resolver dependencias sin ejecutar scripts de instalación. Registra la versión de Node/npm y la fecha de resolución. No presentes esos resultados como versiones fijadas para futuras instalaciones.
>
> **P2 — Docker `COPY drizzle*`.** En un `backend+ts+postgres+docker` y `backend+js+sqlite+docker`, ejecuta `docker build` sin carpeta `drizzle/`. Repite con una carpeta `drizzle/` generada mediante `db:generate` usando una tabla de prueba solo en el proyecto temporal. Reporta éxito/fallo y contenido relevante de la imagen. Limpia imágenes y directorios temporales que hayas creado.
>
> **P3 — Fuga de secretos.** En `backend+ts+sqlite` y `backend+ts+postgres`, utiliza exclusivamente credenciales ficticias. Codifica correctamente los caracteres reservados de las URLs (por ejemplo, `@` como `%40` cuando corresponda). Fuerza conexiones fallidas solo a `127.0.0.1` en puertos no disponibles; no conectes a servicios externos. Provoca un fallo del cliente real y un error HTTP que llegue al middleware global. Captura stdout/stderr y reporta si los fragmentos ficticios aparecen. Si un cliente no acepta el formato, explica por qué no se pudo completar ese escenario.
>
> **P4 — Subrouters en Express 5.3.0.** En un `backend+ts+api-docs` temporal, monta un subrouter (`app.use('/x', router)`) con una ruta no documentada. Reporta qué expone `app.router.stack` y si el test de documentación detecta la ruta no documentada.
>
> **P5 — Test de `redact`.** Lee el test correspondiente y comprueba si importa la función real del overlay o si prueba una copia. No modifiques el test.
>
> **P6 — Cobertura pairwise.** Con un script temporal, lee `src/verified-variants.ts` y calcula el total de pares válidos, pares cubiertos y no cubiertos entre modalidad, lenguaje, base de datos, Docker, API Docs e i18n. Respeta las restricciones reales del CLI. Reporta el denominador, el método, el script y la lista de pares no cubiertos.
>
> ## Informe
>
> Separa resultados `[EJECUCIÓN]` de observaciones `[CÓDIGO]`. Para cada prueba indica variante, entorno, comando/operación relevante, resultado y limitaciones. No impongas un límite arbitrario de líneas: prima que podamos auditar las conclusiones.
>
> No leas documentación Markdown, no cambies código, no ejecutes `verify:generated` completo, no hagas commits ni tags.

---

## 13. Mapa de impacto documental (no modificar todavía)

| Documento | Qué debe cambiar | De qué depende |
|---|---|---|
| DECISIONS.md | Registrar: nombre sin scope; tag `v0.1.0` una vez creado; Zod (decisión aprobada, implementación pendiente); caché npm/symlinks aplazados; corregir 34→32 y las imágenes PostgreSQL; reconciliar referencias | TP-01, TP-02, TP-03 |
| TASKS.md | T-015 (sin plan B con scope; seguimiento npm); T-014 (dependencia sobre 0.1.0 congelada por tag); nuevas tareas con IDs definitivos; limpiar duplicados y referencias | TP-02, TP-03 |
| ROADMAP.md | Reflejar que el endurecimiento común y la composición preceden a auth | DP-07, DP-08 |
| SECURITY.md | Quitar `carWashId`; límites de RLS/colas/rate limiting (v1 §10.1); distinguir PostgreSQL/SQLite; documentar ausencia actual de redacción central hasta que TP-05 exista | DP-12 |
| ARCHITECTURE.md | Composición actual (copia recursiva) vs objetivo; contexto explícito del actor | DP-07 |
| CODE_STANDARDS.md | Regla de dependencias declaradas directamente; duplicación aceptada solo con motivo (p. ej. `redact`) | TP-05 |
| README.md | `npx brixa` mientras npm no autorice; 32 variantes; limitaciones | TP-02, TP-04 |
| AGENTS.md / CLAUDE.md | Quitar «desde cero» y «Foundry» | TP-03 |

---

## 14. Decisiones técnicas pendientes

Las decisiones de nombre, congelación de 0.1.0, Zod obligatorio y caché npm/symlinks ya están aprobadas. También está aprobada la dirección de que `main` pueda avanzar una vez creado y verificado el tag, sin esperar la publicación npm. No deben aparecer aquí como preguntas abiertas.

| ID provisional | Tema | Recomendación / cuestión pendiente |
|---|---|---|
| DP-04 | Redacción central de secretos | Un único módulo reutilizable y uso en el manejador global; delimitar cobertura tras TP-02/P3 |
| DP-05 | Nginx y `trust proxy` | Configuración por topología, no global; evaluar `helmet` frente a configuración manual |
| DP-06 | Reproducibilidad de plantillas | Elegir versiones exactas, lockfile generado o rangos con riesgo asumido, tras TP-02/P1 |
| DP-07 | Modelo de composición | Reglas explícitas por archivo, fusión de `package.json` con error ante conflicto, slots solo donde haya archivos compartidos; unificar dependencias duplicadas |
| DP-08 | Estrategia JS/TS | Piloto de TS→JS derivado con comprobación; herramienta y reescritura de imports por AST |
| DP-09 | Hash de contraseñas | Resolver tras TP-09; considerar `engines` propio del proyecto generado y tipos alineados |
| DP-10 | Sesiones y router | Comparar sesiones opacas, cookies y alternativas; la elección del router y la accesibilidad siguen pendientes |
| DP-11 | Identidad: estados de acceso y alcance | Elegir entre borrado, `revoked_at` o `status`; decidir alcance sistema/organización y futura extensión a sucursales/recursos |
| DP-12 | Multi-organización y SQLite | Decidir entre PostgreSQL+RLS exclusivamente o permitir SQLite con aislamiento de aplicación y garantías distintas |
| DP-13 | E2E con navegador real | Incorporarlo cuando exista autenticación con cookies y flujos que lo requieran |
| DP-15 | Alineación de PostgreSQL y `@types/node` | Alinear imagen de arnés y plantilla; evaluar tipos respecto al mínimo real de Node |
| DP-17 | Versión de desarrollo de `main` | Decidir cómo evitar publicaciones accidentales desde `main` y qué versión declara para el ciclo siguiente; hasta entonces, publicar exclusivamente desde checkout de tag |

---

## 15. Qué cambió respecto a la primera propuesta

1. Se establece el tag `v0.1.0` y el GitHub Release pre-release como operación aprobada y autorizada, sujeta únicamente al preflight y a la verificación de ejecución.
2. Se incorpora la confirmación del propietario de que CI está en verde para el commit candidato.
3. Se reordena el trabajo: primero preservar 0.1.0; después pruebas puntuales, documentación y cambios de código en `main`.
4. Se separa el encargo de tag/release (TP-01) de las pruebas técnicas agrupadas (TP-02).
5. Se eliminan IDs de tareas y decisiones presentados como definitivos; se mantienen provisionales hasta reconciliar los documentos oficiales.
6. Se conserva la inspección estática ya realizada y no se solicita repetirla.

## 16. Conclusiones de v1 corregidas por la inspección

- «Express probablemente 5.3.0» → **confirmado**; INV-05a (Express 4) no aplica.
- «`redact` deuda de test» → en realidad **cuatro copias, solo migradores**, sin solución general; el test sigue por revisar.
- «Variantes 32 o 34» → **32**.
- «Postgres: contradicción» → plantillas `17.4-alpine`, arnés `17-alpine`; docs `17` desactualizadas.
- «React Router 8.5.1 en INV-03b» → **no existe en Brixa**; no es base de decisión sobre código actual.
- «Zod sin registro» → aprobado, **sin implementación**.
- «Composición estructurada de YAML» (de INV-05a) → **no existe**; es solo propuesta.
- «Versiones probadas ≈ versiones usadas» → **no se puede asumir** (rangos y sin lockfile).

## 17. Decisiones ya confirmadas

- Mantener el paquete `brixa` sin scope y esperar la respuesta de npm.
- Conservar el commit `fc1949068373220cc1048deb6f0f6eb0ac88870f` como versión `0.1.0`.
- CI está en verde para ese commit, confirmado por el propietario.
- Crear el tag anotado `v0.1.0` y el GitHub Release asociado como pre-release. La operación está autorizada, pendiente de ejecución y verificación.
- Una vez verificado el tag, permitir que `main` avance sin esperar la publicación en npm; D-059/T-014 deben actualizarse para reflejarlo.
- Mantener caché compartida de npm e instalaciones independientes; symlinks aplazados.
- Zod obligatorio en backend; implementación y versión concreta pendientes.
- Modelo genérico de usuario, organización, concesión de acceso, roles, permisos y alcances, sin suscripciones, jerarquías obligatorias ni `isActive` universal.

## 18. Decisiones que todavía hay que discutir

Las de §14, especialmente reproducibilidad de plantillas, composición, estrategia JS/TS, hashing, sesiones, alcance de autorización y multiorganización con SQLite.

## 19. Tareas a ejecutar primero

1. TP-01: tag anotado `v0.1.0` y GitHub Release pre-release (autorizado).
2. TP-02: pruebas puntuales agrupadas (sin `verify:generated` completo).
3. TP-03: higiene documental e IDs oficiales.
4. Después, endurecimiento común del backend y decisiones de arquitectura que desbloquean auth.

## 20. Prompt operativo inmediato

El prompt TP-01 de §12.4 es el encargo que debe enviarse ahora a Antigravity. No necesita una nueva revisión de Claude antes de ejecutarlo.

*Fin de la v3.*