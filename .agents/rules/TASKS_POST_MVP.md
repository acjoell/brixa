# Brixa — Tasks post-MVP

**Estado del documento:** actualizado el 2026-11-07 tras crear el tag `v0.1.0`, incorporar la inspección estática de Antigravity (HEAD `fc1949068373220cc1048deb6f0f6eb0ac88870f`) y contrastarlo con la propuesta de revisión v3. Las decisiones aprobadas están registradas en `DECISIONS.md` (D-060 a D-065). Lo marcado «propuesto» o «pendiente» no debe copiarse a `DECISIONS.md` como confirmado.
**Base:** `TASKS.md`, `DECISIONS.md` (hasta D-065 y P-017), `ROADMAP.md`, el modelo de amenazas de T-014 (borrador, aún fuera del repositorio), las respuestas del responsable del 2026-11-04 y 2026-11-07, y los informes INV-01 a INV-06 (resultados reportados por Antigravity; no reproducidos).
**Ubicación y nombre:** junto a `TASKS.md`, en `.agents/rules/`. El nombre sigue la convención de los documentos existentes (mayúsculas con guion bajo: `AI_RULES`, `CODE_STANDARDS`, `CHANGE_POLICY`, `PROJECT_VISION`). Si prefieres otro nombre, hay que cambiar las referencias.

**Leyenda de procedencia:** **[L]** consta en el listado del paquete npm; **[INSP]** confirmado por la inspección estática de Antigravity del 2026-11-07 (no demuestra comportamiento en ejecución); **[I]** lo afirmó una auditoría anterior de Antigravity y la inspección no lo ha reconfirmado; **[REP]** resultado reportado por una investigación INV-xx, no reproducido; **por determinar** no se ha comprobado y no se inventa.

---

## 1. Propósito y relación con otros documentos

- `TASKS.md` conserva el historial del MVP y de la etapa hasta 0.1.0 (T-001 a T-016).
- Este archivo recoge las tareas, investigaciones y fases posteriores. Es la continuación, no una copia.
- `DECISIONS.md` sigue siendo el único registro de decisiones. No hay archivos de decisiones por versión.
- `ROADMAP.md` resume el producto y enlazará a este archivo.
- **Numeración global.** Los identificadores `T-xxx` no se reinician. Las subtareas usan sufijo (`T-014a`, `T-017a-ui`).
- **Investigaciones.** Se identifican como `INV-xx`. No se usa `P-xxx` porque ese prefijo ya identifica las cuestiones pendientes de `DECISIONS.md` (P-001 a P-007).
- **Correspondencia con la propuesta v3.** Los identificadores `TP-nn` y `DP-nn` de la propuesta son provisionales; su equivalencia con los identificadores de este archivo está en la sección 13. Las decisiones pendientes se registran como `P-008` a `P-017` en `DECISIONS.md`.
- **Los prompts de investigación no se guardan en el repositorio.** Este archivo conserva solo la ficha de cada investigación (pregunta, evidencia, decisión). Los resultados relevantes se resumen en `DECISIONS.md` cuando se apruebe la decisión que fundamentan.

## 2. Estados y aprobación

Se mantienen los estados de `TASKS.md` (`PENDIENTE`, `EN PROGRESO`, `BLOQUEADA`, `COMPLETADA`), como exige su sección 2. Para distinguir el nivel de acuerdo se añade el campo **Aprobación**:

| Aprobación | Significado |
|---|---|
| **Aprobado (alcance)** | El responsable confirmó el objetivo y el alcance funcional el 2026-11-04. Aún no está registrado en `DECISIONS.md`. |
| **Propuesto** | Sugerencia de diseño no aprobada. |
| **Pendiente de evidencia** | Depende del resultado de una investigación. No se decide sin ella. |
| **Pendiente de decisión** | Necesita decisión del responsable. |

Una tarea aprobada en alcance conserva detalles propuestos o pendientes de evidencia. Se indican dentro de cada tarea.

## 3. Reglas específicas de esta etapa

- Ninguna capacidad se considera segura porque compile, genere archivos o pase `verify:generated`. Solo cuenta lo comprobado por pruebas negativas.
- Cada capacidad de seguridad llega con sus pruebas positivas y negativas. No se añaden después.
- Una combinación con autenticación, RBAC o multitenancy que no haya superado `verify:security` se marca EXPERIMENTAL (D-053).
- Las mutaciones y los controles negativos viven en el arnés de Brixa sobre copias temporales. No forman parte del proyecto que recibe el usuario (ver sección 6).
- Brixa no promete proteger código que el desarrollador escriba sin usar los mecanismos que genera.
- Las rutas de archivos solo se citan con su procedencia. Lo demás figura como «por determinar».
- Multitenancy **no** depende de RBAC.
- La referencia de T-019 ya existe (tag `v0.1.0`, D-060): los cambios de plantillas y del generador pueden avanzar en `main`. El tag nunca se mueve ni se reutiliza, y la publicación en npm solo se hace desde un checkout limpio del tag.
- Una versión declarada en un `package.json` no es la que npm resolverá: las plantillas no tienen lockfile [INSP] (P-008). Ningún resultado se presenta como «versión resuelta» sin que lo haya medido una prueba.
- La promesa de generar JavaScript y TypeScript se mantiene. Ninguna capacidad se declara «solo TypeScript» sin aprobación.

---

## 4. Mapa de dependencias

| Elemento | Estado (T-018 actualizado a 2026-11-17) | Depende de |
|---|---|---|
| T-019 | COMPLETADA | — |
| T-020 | PENDIENTE | T-019 |
| T-021 | EN PROGRESO | T-019 (parcialmente T-020 para cifras) |
| INV-01 a INV-06 (incluidas 04a, 04b, 05a y 05b) | Ejecutadas por Antigravity; resultados reportados. Ver sección 5 | — |
| INV-07 | COMPLETADA | — |
| INV-08 | COMPLETADA | Piloto técnico realizado; decisión P-013 aprobada en D-098 (límites técnicos en Docker y PostgreSQL real pendientes en etapas de integración) |
| T-023 | COMPLETADA | D-098 implementada y verificada en ambas variantes de lenguaje y en CI |
| T-014-0 | COMPLETADA (DISEÑO) | Decisiones consolidadas en D-080 a D-107; modelo integral de amenazas en SECURITY.md §14 y contratos de arquitectura en §15; diseño completado sin código; validaciones técnicas de implementación diferidas a T-014a/c |
| T-017a | COMPLETADA | Decisiones D-069, D-077 y D-078 (composición de archivos compartidos de overlays actuales cerrada) |
| T-017a-ui | COMPLETADA | T-017a, D-079 (composición de main, App y vite.config cerrada) |
| T-017b | COMPLETADA (2026-11-17; D-070, D-071, D-073, D-074, D-075 y D-076/T-022) | T-017a, INV-02 |
| T-013e | PENDIENTE | D-052 y cobertura existente de T-013d |
| T-018 | COMPLETADA | Implementación e integración completadas; CI normal aprobado y CI Full con SV-5, Docker y PostgreSQL aprobado según confirmación del desarrollador |
| T-014a | BLOQUEADA | T-014-0 (diseño completado), T-017b (completada), T-018 y T-023 (derivador y verify:sync verificados antes de implementar Auth en ambas variantes; composición backend disponible vía D-069; D-080 a D-103 y D-107 consolidadas) |
| T-014a-ui | BLOQUEADA | T-014a, T-017a-ui |
| T-014b1 | BLOQUEADA | T-014a, T-014-0 (diseño completado), T-018, T-023 (composición backend disponible vía D-069; D-105 y D-106 consolidadas) |
| T-014b2 | BLOQUEADA | T-014b1, T-014a-ui |
| T-014c | BLOQUEADA | T-014a, T-014-0 (diseño completado), T-018; decisiones de arquitectura RLS consolidadas en D-094 a D-097 y D-104 (comprobación de sintaxis Drizzle Kit pendiente en implementación) |
| T-014d | BLOQUEADA | T-014b1, T-014c |

**Orden de ejecución propuesto (actualizado):**

T-019 ✔ → T-020 y T-021 (en paralelo, sin tocar código) → decisiones P-008, P-012 y P-013 (aprobada en D-098 tras INV-08) → T-017a ✔ → T-017a-ui ✔ → T-017b ✔ → T-018 y T-023 (derivador JS/TS y verify:sync en verde antes de implementar plantillas de Auth/RBAC) → T-014-0 (diseño de identidad, organización y modelo de amenazas sin código) → T-014a → T-014a-ui → T-014b1 → T-014b2 → T-014c → T-014d.

- T-014c y T-014b1 no dependen entre sí. El orden lineal es de conveniencia, no una restricción técnica.
- T-017a y T-017a-ui ya están completadas; la incorporación de T-023 no altera ni reabre la composición de overlays existente, sino que se integra con el mecanismo existente.
- La implementación de T-023 debe completarse y verificarse (`verify:sync` en CI) antes de implementar los módulos Auth y RBAC (T-014a, T-014b1) en ambas variantes.
- T-014-0 es una tarea de diseño arquitectónico sin código; su avance no se detiene por la implementación de T-023, pero su cierre definitivo requiere completar el modelo integral de amenazas y las especificaciones pendientes.
- **Diferencia con la propuesta v3:** la v3 ordena el endurecimiento del backend (redacción, Zod, Nginx) antes de las decisiones de composición. Este archivo mantiene composición antes de seguridad base porque la composición actual reemplaza `app`, `index` y `tsconfig` completos [INSP]: añadir Zod o redacción antes obligaría a repetir el cambio en cada overlay que reemplaza esos archivos. Las partes que no tocan archivos compartidos (por ejemplo, extraer `redact` de los cuatro overlays de base de datos o endurecer `nginx.conf`) podrían adelantarse. Es una decisión pendiente (cuestión abierta 8).

---

## 5. Investigaciones

Cada ficha indica qué pregunta resuelve, qué condiciona, qué evidencia debe entregar Antigravity, si requiere ejecutar proyectos temporales y qué decisión permite.

**Estado a 2026-11-07:** INV-01 a INV-06 fueron ejecutadas y entregaron informes y anexos. Sus resultados son **reportados**, no reproducidos. Los informes originales de INV-01, 02, 03, 04a, 05a, 05b y 06 no estaban disponibles en la revisión de la propuesta v3 (solo anexos y complementos). La tabla siguiente conserva la ficha original; el seguimiento está después de ella.

| ID | Pregunta | Condiciona | Evidencia que debe entregar | Ejecución temporal | Decisión que permite |
|---|---|---|---|---|---|
| INV-05a | ¿Qué mecanismo mínimo permite que varias capacidades modifiquen los mismos archivos del backend y del frontend? | T-017a, T-017a-ui | Inventario real de overlays y archivos compartidos; prototipos por archivo con casos negativos; coste | Sí | Estrategia de composición por archivo |
| INV-05b | ¿Cómo se mantienen JavaScript y TypeScript con el volumen futuro sin reducir JavaScript? | T-017a, T-014-0 | Métricas de duplicación; comparación de dos o tres enfoques sobre módulos reales con diffs | Sí | Estrategia JS/TS (resuelta en D-098 tras INV-08) |
| INV-04a | ¿Se puede garantizar aislamiento con RLS, roles y contexto por transacción en el stack fijado? | T-014-0, T-014c | Pruebas negativas reproducibles en PostgreSQL; soporte de Drizzle; fugas indirectas; consulta de auditoría | Sí (PostgreSQL) | Modelo de roles de base de datos y contexto por transacción |
| INV-04b | ¿Qué modelo de identidad y organización conviene y cómo viaja el contexto del actor? | T-014-0, T-014b1, T-014c | Esquemas comparados, pruebas de inicio de sesión y cambio de organización, comparación de paso explícito frente a `AsyncLocalStorage`, catálogo de permisos | Sí (PostgreSQL) | Modelo de identidad, forma del contexto, catálogo persistido o no |
| INV-01 | ¿Qué hash resiste carga real sin agotar memoria? | T-014a | Disponibilidad por versión de Node, parámetros de OWASP citados, mediciones con servidor real y límites de contenedor | Sí | Algoritmo y parámetros |
| INV-03 | ¿Credencial opaca o JWT? ¿Bearer seguro en fullstack? ¿CSRF y cookies en cada topología? | T-014-0, T-014a, T-017a-ui | Fuentes oficiales, prototipos, matriz de compatibilidad, opciones de router con peso medido | Sí | Tipo de credencial, renovación, matriz de soporte, CSRF, router |
| INV-02 | ¿Qué Zod, cómo validar y dónde guardar, qué cabeceras y CORS, y qué almacén de abuso es sostenible? | T-017b, T-014a | Pruebas con Express 5, errores reales de Zod, cabeceras y CORS, concurrencia y contención de contadores | Sí | Versión de Zod, política de propiedades, cabeceras, almacén de contadores |
| INV-06 | ¿Cómo se construye un arnés de mutaciones sostenible y cómo se prueba el frontend? | T-018, T-014a-ui | Análisis del arnés actual, prototipo de mutaciones, presupuesto de CI, opciones de pruebas de componentes | Sí | Diseño de `verify:security`, nombres de scripts, pruebas del frontend |
| INV-07 | ¿`crypto.argon2` es estable en cada versión del rango de Node admitido? ¿Qué formato PHC produce o consume la alternativa externa? | T-014a | Páginas oficiales de Node por versión (con URL y fecha), especificación PHC, salida real de la librería candidata | Ligera | Hash: API nativa con `engines` propio o librería externa |
| INV-08 | ¿Se puede derivar JavaScript de TypeScript con diffs legibles y sin dependencias frágiles? | T-023, T-014a | Piloto sobre un overlay (por ejemplo base de datos), comparación contra el JavaScript existente, `check:sync`, lint del JavaScript derivado | Sí | Completada (D-098) |

### Seguimiento tras las investigaciones ejecutadas

| ID | Qué queda abierto |
|---|---|
| INV-05a | Compose: fusión estructurada o composición nativa (sin versión mínima de Compose verificada). OpenAPI: el test actual depende de `app.router.stack` de Express 5.3.0 y la prueba de subrouters sigue pendiente (T-020, prueba 4). El informe usó Express 4 en parte de sus pruebas: esos resultados no aplican. Su propuesta de `en.json` siempre presente contradice D-052 y no se adopta por defecto |
| INV-05b | Resuelta formalmente mediante D-098 tras su complemento e INV-08. Se aprueba la estrategia de híbrido versionado con derivación determinista mediante Babel/AST |
| INV-08 | Completada. Piloto técnico realizado sobre overlays y código aplicativo demostrando derivación limpia por AST con Babel, preservando comentarios, JSX, marcadores de overlays e imports (disciplina `import type`). Límites conocidos: el piloto no prueba compatibilidad integral con Docker ni con PostgreSQL real (pendientes en la verificación de implementación). La herramienta de derivación y `verify:sync` se implementarán en T-023 antes de codificar Auth/RBAC |
| INV-04a | Decisiones arquitectónicas aprobadas y consolidadas en D-094 a D-097: roles `app_exec`/`table_owner` con credenciales separadas (D-094), contexto organizacional transaccional mediante `set_config` local sin ALS (D-095), políticas RLS, clasificación de tablas y FKs compuestas (D-096), y verificación estructural, benchmarks en laboratorio y auditoría de seguridad y acciones (D-097). Pendiente de comprobación técnica en implementación: soporte de sintaxis de políticas RLS en Drizzle 0.45.x y Drizzle Kit 0.31.x |
| INV-04b | Corregir al adoptarlo: no usar `is_active` universal; «membresía» pasa a «concesión de acceso» (D-063); las políticas RLS necesitan `NULLIF(...)::uuid` (INV-04a). Falta el diagrama de flujo del informe |
| INV-01 | Cerrada mediante INV-07 y decisiones D-091 a D-093 (Argon2id con `@node-rs/argon2` 2.2.2, formato PHC estándar con Base64 sin padding, rehash y controles defensivos). Benchmarks originales considerados definitivos para v1 |
| INV-07 | Completada. Resuelta P-009 en D-091 a D-093: adoptado `@node-rs/argon2` versión 2.2.2 manteniendo `engines.node: "^24.0.0 || >=26.0.0"` sin alternativas en `node:crypto`, formato PHC canónico con Base64 sin padding (no Base64URL), rehash tras login y controles de seguridad (asincronía estricta, validación defensiva previa de parámetros, dummy hash y limitador de concurrencia). Quedan como pendientes técnicos de diseño/implementación los límites numéricos defensivos exactos, capacidad del limitador y pruebas en Docker / sin dependencias opcionales |
| INV-03 | Solo se dispone del complemento INV-03b (Chromium 156, Firefox 157; Safari no verificado). React Router no está instalado en Brixa [INSP]: sus conclusiones de accesibilidad aplican al router que se elija |
| INV-02 | Versión de Zod sin fuente registrada. La fuga de credenciales de `@libsql/client` depende de qué URLs acepta el cliente de la plantilla (T-020, prueba 3). Las versiones de `pg` y `@libsql/client` de las plantillas coinciden con las usadas en el anexo |
| INV-06 | Decisión de D-062 (caché compartida, instalaciones independientes, symlinks aplazados). La reutilización por symlink y el motor de mutaciones están sin verificar en Windows y macOS |

Orden recomendado para las investigaciones restantes: Todas las investigaciones clave (INV-01 a INV-08) están completadas o resueltas con decisiones aprobadas.

---

## 6. Distinción de pruebas y matriz de verificación

### 6.1 Quién ejecuta qué

| Tipo | Quién lo ejecuta | Se entrega al usuario | Ejemplos |
|---|---|---|---|
| **Pruebas del proyecto generado** | El desarrollador (`npm test` y, si procede, un script de seguridad con base de datos) | Sí | Contrato de errores, validación, flujo de autenticación, ayudas reutilizables de aislamiento, auditoría estructural de tablas registradas |
| **Verificación de plantillas por Brixa** | `verify:generated` y `verify:security` | No | Generación, instalación, lint, arranque, topología real con nginx |
| **Mutaciones y controles negativos** | `verify:security`, sobre copias temporales | No | Quitar un middleware, cambiar un atributo de cookie, eliminar una política RLS, conectar con un rol privilegiado |

Las mutaciones no son una dependencia del proyecto generado. Los nombres de los scripts del proyecto se deciden con INV-06.

### 6.2 Comandos

- `verify:generated`: matriz base (generación, instalación y funcionamiento básico).
- `verify:security`: pruebas profundas de las capacidades de seguridad.
- `verify:all`: ambas baterías. Una publicación exige `verify:all` en verde. Los cambios ejecutan las baterías que tocan.

### 6.3 Matriz provisional de `verify:security`

Calculada con una comprobación por pares: con estas 7 variantes quedan cubiertos los **82 pares válidos** entre las siete dimensiones (modalidad, lenguaje, base de datos, transporte, RBAC, multitenancy, Docker), con dos restricciones: multitenancy exige PostgreSQL y fullstack con Bearer queda excluido (confirmado por D-089: fullstack utiliza exclusivamente cookies en v1).

| # | Modalidad | Lenguaje | Base de datos | Transporte | RBAC | Multitenancy | Docker |
|---|---|---|---|---|---|---|---|
| SV-1 | backend | TS | PostgreSQL | Bearer | sí | sí | sí |
| SV-2 | backend | JS | PostgreSQL | Bearer | no | no | no |
| SV-3 | backend | TS | SQLite | Bearer | no | no | no |
| SV-4 | backend | TS | SQLite | cookie | no | no | sí |
| SV-5 | fullstack | JS | PostgreSQL | cookie | no | sí | sí |
| SV-6 | fullstack | TS | PostgreSQL | cookie | sí | sí | no |
| SV-7 | fullstack | JS | SQLite | cookie | sí | no | no |

Notas:
- **Comprobación (2026-11-07):** un script sobre la matriz tal como está escrita (siete dimensiones y las dos restricciones) da 72 combinaciones válidas y 82 pares válidos, y las siete variantes los cubren todos (0 sin cubrir). La cifra 82 pertenece a esta matriz de seguridad y no debe confundirse con las **76 combinaciones** del CLI actual (modalidad, lenguaje, base de datos, Docker, API Docs e i18n), de las que hay **32 variantes verificadas** [INSP]. La matriz de seguridad no incluye API Docs, i18n ni frontend: las combinaciones con esas capacidades quedan EXPERIMENTALES.
- **Cobertura por pares no es cobertura de todas las combinaciones.** Las demás quedan EXPERIMENTALES (D-053). Las interacciones críticas (autenticación con RBAC, con multitenancy y con ambas) están cubiertas por SV-1 y SV-6.
- **Variantes muy cargadas** (SV-1) dificultan aislar un fallo. Por eso las pruebas por capacidad viven en el proyecto generado y no solo en estas variantes.
- **Activación gradual.** Cada variante entra en `verify:security` cuando existe la última capacidad que incluye. Hasta entonces se ejecuta su proyección sin las capacidades aún inexistentes.
- **Ámbito.** SV-3, SV-4 y SV-7 (SQLite sin Docker) son candidatas a `portable` (Ubuntu, Windows, macOS). Las que usan PostgreSQL o Docker, a `full` (Linux). SV-4 usa Docker: pasa a `full`.
- **Fullstack exclusivamente cookies (D-089):** Bearer queda formalmente excluido en fullstack para v1; no se añade variante fullstack con Bearer.
- **Vistas y panel.** No hay pruebas en navegador real hoy. Hasta que existan, no pueden declararse verificados, solo comprobados manualmente (ver T-014a-ui).

---

## 7. Tareas

### T-019 — Preservar 0.1.0: tag `v0.1.0` y GitHub Release (pre-release)

**Estado:** COMPLETADA (según el propietario, 2026-11-07: tag creado y verificaciones de T-019 realizadas). **Por registrar:** hash del objeto del tag, URL del Release, confirmación de pre-release y estado de la protección de tags `v*`, que constan en el informe de Antigravity y no figuran en los documentos revisados.
**Aprobación:** Aprobado (D-060).
**Dependencias:** ninguna.

**Objetivo:** conservar la correspondencia entre el commit verificado, su tag y su Release mientras `main` avanza y el 403 de npm sigue sin resolverse.

**Alcance ejecutado (D-060):**
- Tag anotado `v0.1.0` sobre `fc1949068373220cc1048deb6f0f6eb0ac88870f` (el hash completo, no un `HEAD` implícito). `package.json` en ese commit: `brixa` `0.1.0`.
- GitHub Release `Brixa v0.1.0`, pre-release, con la advertencia de que el paquete no está publicado en npm y de que `npx brixa` no funciona hasta publicar.
- Sin rama `release/0.1`. Sin cambio de nombre. Las etiquetas no se mueven ni se reescriben.
- Sustituye a la propuesta anterior de `v0.1.0-rc.1`, descartada: `rc.1` formaría parte de la versión SemVer, exigiría otro `package.json` y desvincularía lo publicado de lo etiquetado.

**Regla de publicación posterior:** cuando npm autorice, checkout limpio del tag; confirmar commit y `brixa@0.1.0`; `npm ci`, `npm pack --dry-run` y comprobación del contenido; publicar desde ese checkout, nunca desde un `main` posterior; verificar con `npx` desde un directorio limpio; pasar el Release a estable sin mover el tag. «Misma versión» significa mismo commit y mismas fuentes: no se promete un `.tgz` idéntico bit a bit.

**Cambios posteriores:** los cambios nuevos van a `main`. Un defecto del código congelado se corrige con otro commit, otro tag y la versión que se apruebe (por ejemplo `0.1.1`); `v0.1.0` no se reutiliza.

**Áreas afectadas:** ninguna de código. Documentos: D-059 (reemplazada parcialmente), T-014 y T-015 de `TASKS.md`.

**Criterios de aceptación:**
- El tag apunta exactamente al commit verificado, local y remotamente.
- El Release está marcado como pre-release y declara que npm sigue pendiente.
- La CI en verde corresponde al SHA etiquetado (confirmado por el propietario).

**Pruebas / verificaciones:** comprobación manual del SHA del tag y del Release (realizada según el propietario).

**Riesgos y limitaciones:** el README del tag dice `npx brixa`; las notas del Release lo advierten. Si npm rechaza el nombre de forma definitiva se abre una decisión nueva: no hay plan B asumido. La protección de tags `v*` es un cambio de configuración del repositorio que no estaba incluido en la autorización: queda a decisión del propietario.

**Pendiente de decisión (P-016):** qué versión declara `package.json` en `main` y si se añade una guarda contra publicaciones desde commits sin tag. Valor por defecto propuesto: una versión de preparación (por ejemplo `0.2.0-dev.0`) para que dos códigos distintos no declaren `0.1.0`.

---

### T-020 — Verificaciones puntuales agrupadas

**Estado:** PENDIENTE
**Aprobación:** Propuesto (la inspección estática ya está hecha; esta tarea solo ejecuta pruebas en directorios temporales, sin modificar el repositorio).
**Dependencias:** T-019.

**Objetivo:** cerrar en un solo encargo las incertidumbres de ejecución que la inspección estática no resuelve, sin repetir esa inspección y sin ejecutar `verify:generated` completo.

**Pruebas (con el CLI compilado y proyectos temporales):**
1. **Versiones resueltas.** Generar `frontend+ts`, `backend+ts+postgres`, `backend+js+sqlite` y `fullstack+ts+sqlite+i18n`; reportar versiones declaradas y resueltas de las dependencias directas relevantes, y la presencia de lockfiles antes y después. Instalar con `npm install --ignore-scripts`; registrar Node, npm y fecha. No presentar el resultado como versión fijada.
2. **Docker `COPY drizzle*`.** `docker build` de `backend+ts+postgres+docker` y `backend+js+sqlite+docker` sin `drizzle/` y con una `drizzle/` generada con una tabla de prueba solo en el proyecto temporal. Limpiar imágenes y directorios creados.
3. **Fuga de secretos.** Con credenciales ficticias, URLs codificadas y conexiones fallidas solo a `127.0.0.1`: fallo del cliente real y error HTTP que llegue al manejador global; reportar si los fragmentos aparecen en stdout o stderr.
4. **Subrouters en Express 5.3.0.** En un `backend+ts+api-docs` temporal, montar un subrouter con una ruta no documentada; reportar qué expone `app.router.stack` y si el test de documentación detecta la ruta.
5. **Test de `redact`.** Comprobar si el test del CLI importa la función real del overlay o una copia.
6. **Cobertura por pares.** Con un script temporal sobre `src/verified-variants.ts`: denominador, pares cubiertos y no cubiertos entre modalidad, lenguaje, base de datos, Docker, API Docs e i18n, con las restricciones reales del CLI.

**Criterios de aceptación:** informe que separa `[EJECUCIÓN]` de `[CÓDIGO]`, con variante, entorno, operación, resultado y limitaciones de cada prueba; repositorio sin modificar; temporales limpiados.
**Alimenta:** P-008, P-012, P-014, T-017a, T-017b y T-018.

---

### T-021 — Higiene documental

**Estado:** EN PROGRESO
**Aprobación:** Aprobado (alcance: la actualización de documentos antes de pasar tareas a Antigravity).
**Dependencias:** T-019.

**Hecho en esta actualización:** `TASKS.md` (T-013, T-014, T-015, referencias); este archivo; `DECISIONS.md` (D-060 a D-065, P-008 a P-017, correcciones de D-047, D-049, D-052 y D-059, sección 5; 34 → 32 variantes). **Hecho en 2026-11-14 (commit documental pendiente):** `DECISIONS.md` (D-073, D-074, D-075; sección 5 actualizada); `TASKS_POST_MVP.md` (T-017b, T-022); `SECURITY.md` (garantías reales del endurecimiento base); `README.md` raíz (limitaciones de seguridad: CORS, HSTS, cabeceras SPA); `README.md` de plantilla backend (variables nuevas y comportamiento de Helmet).
**Pendiente:** `ARCHITECTURE.md` (composición actual frente a la objetivo; contexto explícito del actor si se aprueba), `CODE_STANDARDS.md` (dependencias declaradas directamente; duplicación aceptada solo con motivo), `ROADMAP.md` (endurecimiento y composición antes de autenticación), `PROJECT_VISION.md` (§10 con pendientes ya resueltas), `AGENTS.md` y `CLAUDE.md` (quitar «el proyecto comienza desde cero» y el nombre Foundry).
**Criterios de aceptación:** ningún documento contradice a `DECISIONS.md` en cifras, nombre, versiones o estado de la publicación.

---

### T-022 — Corrección del ReDoS en redact

**Estado:** COMPLETADA (2026-11-15)
**Prioridad:** P1
**Dependencias:** ninguna de código.

**Objetivo:** eliminar el comportamiento cuadrático de dos reglas de `redact` antes de exponerla a entradas no controladas.

**Contexto:** el hallazgo se reprodujo desde HTTP. Un `POST` con JSON malformado (dentro del límite de 100 KB) hace que `body-parser` añada el cuerpo crudo a `err.body`; el manejador global de errores lo pasa por `inspect()` y luego por `redact`. Mediciones de Antigravity antes de la corrección: regla de URLs, 10 KB ≈ 74 ms y 100 KB ≈ 7,4 s (cuadrático); regla de valores entrecomillados con comilla sin cierre, ≈ 1,9 s con 50 KB, atribuido en buena parte a la regla de URLs que se ejecutaba antes.

**Cambios realizados:**
- Regla de URLs: prefiltro `includes("://")` y esquema acotado a `{0,63}`. Es un límite interno defensivo para acotar el retroceso, no un requisito de RFC 3986 ni de RFC 1035.
- Regla de valores entrecomillados: clases de caracteres negadas, con soporte de escapes (`\\.`), para comillas simples, dobles y backticks.
- Revisión posterior (GPT y pruebas con `inspect()` real): se encontraron dos huecos reales de filtración. Un valor con `'` y `"` se muestra entre backticks, y uno con los tres tipos aparece con `\'` escapada. Ambos quedaron corregidos y con prueba.
- Paridad TS/JS mantenida.

**Verificación:**
- `typecheck`, `lint`, `format:check` y `test` en Brixa: 132 pruebas en verde.
- `lint` y `test` (46 pruebas) en `backend+ts` y `backend+js` temporales.
- Pruebas adversariales con `node:worker_threads` y timeout, incluida la integración HTTP (JSON malformado de 50 KB → 400 sin detalles internos).
- Pruebas con `inspect()` real y con `inspect.defaultOptions.maxStringLength = Infinity`: ningún fragmento del secreto aparece en la salida.
- `npm run verify:generated` completo: en verde (ejecutado por el responsable).

**Limitaciones conocidas:**
- Los valores entrecomillados con saltos de línea literales sin escapar no se enmascaran (en `inspect()` y JSON los saltos van escapados).
- La seguridad no depende de la truncación de `inspect()` (`maxStringLength`), pero el cuerpo que llega a `redact` sigue acotado por el límite de 100 KB de `express.json`.
- Esquemas de más de 64 caracteres se enmascaran solo por sus últimos 64.
- El criterio original «< 10 ms con 100 KB» no se adoptó. La regla de URLs con esquema sin credenciales mide ≈ 28 ms con 100 KB (antes ≈ 7,4 s) y crece de forma lineal. Las pruebas comprueban linealidad y un tope amplio por timeout, no un umbral de 10 ms.
- Las mediciones de tiempo son de Antigravity, no reproducidas de forma independiente.

**Áreas afectadas:** `src/templates/backend-express-{ts,js}/src/redact.{ts,js}`, sus tests y `src/generator/generate.test.ts`.

---

### T-023 — Derivador JavaScript/TypeScript y verificación de sincronización (verify:sync)

**Estado:** COMPLETADA. Los 29 pares y cuatro fragmentos están sincronizados. Pasaron 26 pruebas del derivador, la prueba de composición Vite, tipos, lint y formato. El responsable confirmó la validación integral (34/34 pasos, 32 variantes, código 0 en 902,55 s), las auditorías y todos los jobs de CI. [Matriz de aceptación e historial](../../docs/t023-pilot.md).

**Historial previo al cierre.** Los estados pendientes de las siguientes entradas corresponden a la revisión indicada.

**Revalidación (2026-11-19):** npm audit reporta cero vulnerabilidades en Brixa y en las variantes generadas, manteniendo picomatch 4.0.7 y los controles estrictos. La ejecución completa terminó con mensaje de éxito en 1152,19 s, sin omisiones ni errores; su código numérico de shell no se recuperó por el reinicio del servidor. La repetición integral de backend PostgreSQL JS/TS terminó con código 0 en 28,77 s. Los únicos avisos restantes son dos deprecaciones de @esbuild-kit y la notificación de nueva versión de npm, sin actualizaciones aplicadas. No se cambiaron dependencias, lockfiles ni código funcional. Los resultados del 2026-11-17 siguientes se conservan como historial, no como bloqueo vigente.

**Actualización de validación (2026-11-17):** el mismo arnés dispone de modos explícitos funcional y auditoría, conservando el modo integral estricto por defecto. `verify:generated:functional` completó backend y fullstack JS/TS con PostgreSQL, más backend Docker JS/TS (seis variantes). Las auditorías JS/TS independientes y el comando integral conservan código 1 por picomatch. Tipos, lint, formato, sincronización y 172 pruebas locales correctos; sin defectos adicionales del derivador. CI informa funcionamiento y auditoría en pasos separados, sin tolerar errores de seguridad; ejecución remota pendiente. T-023 continúa EN PROGRESO; criterios originales intactos y T-018 independiente.
**Incremento React main (2026-11-19):** derivación TSX → JSX habilitada con el Babel existente y sincronización compartida, limitada a main.tsx/main.jsx. Preserva JSX para Vite y adapta referencias relativas por AST; el diff de main.jsx es solo de formato. Pasan 16 pruebas focalizadas (cinco nuevas), tipos de Brixa, lint, formato y verify:sync. La CI del piloto previo está verde según confirmación del responsable; el incremento nuevo requiere validación manual/CI. No se ejecutaron instalaciones ni verificaciones integrales, no se añadieron dependencias y T-018 sigue intacta. App/useAppContent y los demás pares de código/pruebas permanecen fuera de este incremento. Véase el informe para los comandos manuales y los límites del lint ligero JSX. T-023 continúa EN PROGRESO.

**Revisión para commit React:** el responsable confirmó sin errores `verify:generated -- frontend+ts frontend+js` y `verify:generated -- frontend+ts+i18n fullstack+js+sqlite+i18n`; no se repitieron. La revisión estática delimita 21 pares de código aplicativo/pruebas y dos configuraciones equivalentes aún sin derivación/sincronización, detallados en docs/t023-pilot.md, además del control de igualdad de cuatro fragmentos api-docs al incorporar ese overlay. Son cobertura de D-098 pendiente; no se exige un resolver universal ni código futuro de Auth/RBAC. CI del incremento pendiente; T-023 sigue EN PROGRESO. No se implementaron nuevas derivaciones durante esta revisión.

**Aprobación:** Aprobado en alcance y arquitectura (D-098 tras INV-05b, su complemento e INV-08).
**Dependencias:** D-098. Requisito previo obligatorio para la implementación de módulos de Auth y RBAC (T-014a, T-014b1).

**Continuidad respecto a T-018 (2026-11-17):** T-023 puede continuar de forma independiente; esto no cierra T-018 ni autoriza excepciones de seguridad. Sus verificaciones específicas deben distinguirse de las verificaciones globales (`verify:generated` y `verify:all`), que pueden seguir condicionadas por el bloqueo externo y la integración pendiente descritos en T-018. No se declara paridad integral ni CI satisfactoria mientras falte esa evidencia.

**Objetivo:** proporcionar la herramienta de derivación automática TypeScript → JavaScript basada en AST/Babel con formateo determinista, junto con el comando `verify:sync` para verificar en CI y localmente la sincronización exacta y la paridad lógica entre ambas variantes.

**Alcance:**
- Implementación de la herramienta/script de derivación explícito en el repositorio para generar y actualizar los archivos JavaScript versionados a partir de las fuentes TypeScript.
- Derivación mediante transformaciones de AST con Babel y formateo determinista, descartando transformaciones estructurales mediante expresiones regulares frágiles.
- Preservación íntegra de comentarios, sintaxis JSX, semántica de ejecución, marcadores de inserción de overlays (`// @@INSERT:...@@`) e imports correctos.
- Adopción estricta de la disciplina de `import type` en TypeScript para asegurar la elisión limpia de tipos sin dejar importaciones vacías o huérfanas en JavaScript.
- Exclusión explícita de archivos mantenidos manualmente por divergencias legítimas entre lenguajes: `package.json`, Dockerfiles, configuraciones de ESLint (`eslint.config.js`), configuraciones de Drizzle (`drizzle.config.{js,ts}`) y archivos exclusivos de TypeScript (`tsconfig.json`).
- Tratamiento explícito de excepciones relacionadas con cadenas literales y nombres de archivos o extensiones (p. ej. rutas a módulos `.js` vs `.ts` en configuraciones o migradores).
- Implementación del comando `verify:sync` (solo lectura) que compare byte a byte o a nivel de contenido la derivación esperada frente a los archivos JavaScript versionados en Git.
- Integración de `verify:sync` en la matriz de CI para bloquear pull requests con discrepancias de sincronización o ediciones manuales directas en JavaScript.
- Integración con el sistema existente de composición de overlays (T-017a y T-017a-ui ya completados), sin modificar ni reconstruir los mecanismos existentes.
- Verificaciones de calidad requeridas: `typecheck` obligatorio en TypeScript, `eslint` y ejecución de tests en ambas variantes.

**Criterios de aceptación:**
- `verify:sync` finaliza con éxito cuando todos los archivos JavaScript coinciden exactamente con la derivación desde sus fuentes TypeScript.
- `verify:sync` falla con error explícito ante cualquier diferencia de contenido, import inválido o archivo derivado desactualizado.
- Los archivos JavaScript derivados permanecen versionados en Git y superan `eslint` y las pruebas de las plantillas.
- El CLI mantiene su comportamiento de copia de plantillas preconstruidas desde disco, sin ejecutar Babel ni TypeScript en tiempo de generación.
- Los proyectos JavaScript generados no incorporan dependencias adicionales de compilación ni librerías asociadas al derivador.
- Paridad funcional completa entre variantes verificada mediante el arnés existente (`verify:generated`).

**Límites conocidos y pendientes:**
- El piloto INV-08 cubrió overlays y código aplicativo. T-023 verificó posteriormente Docker y PostgreSQL real mediante el arnés integral.
- La integración de T-023 debe completarse y verificarse antes de comenzar la codificación de las plantillas de Auth y RBAC (T-014a, T-014b1).

---

### T-014-0 — Diseño del modelo de identidad, organización y contexto

**Estado:** COMPLETADA (DISEÑO DOCUMENTAL) (2026-11-17; todas las decisiones estructurales y operativas consolidadas en D-080 a D-107; modelo integral de amenazas en SECURITY.md §14 y contratos de arquitectura en §15; tarea completada sin código ni modificaciones de plantillas; las verificaciones técnicas de implementación se transfieren a T-014a y T-014c).
**Aprobación:** Aprobado (arquitectura y decisiones confirmadas por el responsable).
**Dependencias:** Ninguna pendiente para el diseño. Prerrequisito cumplido para las especificaciones de T-014a, T-014b1 y T-014c. (Nota: la implementación de plantillas de Auth/RBAC continúa condicionada por T-018 tras completarse T-023).

**Objetivo:** cerrar por escrito las decisiones estructurales que, tomadas tarde, obligarían a rehacer plantillas. Brixa genera proyectos nuevos (D-005): el riesgo no es migrar datos de usuarios, sino rehacer el código de las plantillas.

**Alcance consolidado y decisiones aprobadas (sin código):**
- **Identidad, organizaciones y concesiones N:M (D-080):** usuarios globales y organizaciones desacoplados. La organización activa se selecciona por petición y se valida obligatoriamente contra la base de datos comprobando que existe una concesión vigente. Propagación de `ActorContext` de forma estrictamente explícita como argumento en servicios, repositorios y transacciones; se descarta `AsyncLocalStorage` (ALS) para autorización y aislamiento.
- **Ciclo de vida de concesiones con `revoked_at` (D-081):** revocación definitiva mediante marca temporal, sin `isActive` universal. Volver a conceder acceso inserta una nueva fila que no hereda roles anteriores. Unicidad parcial de concesiones vigentes en PostgreSQL (`WHERE revoked_at IS NULL`).
- **RBAC dinámico (D-082):** catálogo canónico de permisos definido en código y sincronizado con BD. Roles, asignaciones y permisos administrables desde el panel/API. Alcances de aplicación y organización. Se descarta expresamente un motor genérico ABAC/ReBAC.
- **Multitenancy independiente de RBAC (D-083):** sin RBAC, existen concesiones organizacionales pero no se imponen roles fijos `owner/member`.
- **Administración de plataforma separada de la organizacional (D-084):** sin acceso global automático a datos de organizaciones ni bypass genérico de RLS.
- **Bootstrap seguro y aprovisionamiento local (D-085):** comandos CLI locales del proyecto generado, sin credenciales por defecto, resistente a concurrencia y sin endpoint público. Aprovisionamiento organizacional mediante herramientas locales; panel de plataforma fuera de v1.
- **Registro público opcional para Auth sin multitenancy (D-086):** configurable en el CLI exclusivamente para Auth sin multitenancy (registro administrado como predeterminado), sin privilegios administrativos automáticos y sin creación pública de organizaciones. Posterior al núcleo Auth y con controles de seguridad.
- **Credenciales de sesión opacas con hash SHA-256 (D-087):** sesiones opacas generadas con 32 bytes criptográficamente aleatorios como único modelo de Auth v1, sin JWT. Almacén exclusivo de hashes SHA-256 en BD; validación y revocación en servidor; token opaco sin identidad, roles, permisos ni organización; núcleo común para cookies y Bearer.
- **Ciclo de vida de sesiones (D-088, D-101):** expiración deslizante por inactividad (30 min por defecto) y límite absoluto e improrrogable (12 h desde creación); revocación efectiva inmediata; actualización diferida de actividad en BD con umbral de 60 segundos para evitar contención concurrente; preservación estricta de las garantías de expiración (el cálculo diferido nunca supera el límite absoluto); exclusión de tráfico de mantenimiento; sin rotación periódica de tokens en v1.
- **Transporte y cookies (D-089, D-099):** fullstack exclusivamente cookies en v1; backend independiente con cookies o Bearer seleccionables (sin mezcla simultánea); cookies HttpOnly, Secure (obligatorio en producción; fallo explícito si se intenta emitir sin Secure en producción; excepción controlada con aviso visible únicamente en `NODE_ENV=development` sobre localhost), SameSite=Lax, Path=/, sin Domain, con nombre específico por proyecto; prefijo `__Host-` únicamente cuando se cumplen rigurosamente sus tres requisitos; configuración explícita de `trust proxy` para terminación TLS en proxies; separación conceptual de HSTS.
- **Proveedor de identidad interno exclusivo (D-100):** Auth v1 opera únicamente con la identidad interna de Brixa; OAuth, OIDC, SSO y proveedores externos quedan fuera de alcance en v1, manteniendo desacoplado el diseño para extensiones futuras.
- **Protección CSRF multicapa (D-103):** middleware centralizado para operaciones mutables con cookies; validación estricta de `Origin` (o `Referer`); Fetch Metadata (`Sec-Fetch-Site`); cabecera personalizada obligatoria en mutaciones de API (`X-Requested-With`); CORS restrictivo; sin sincronizador de tokens adicional en la topología fullstack same-origin de v1; protección de endpoints `/login`, `/logout` y activación; métodos GET y HEAD estrictamente de solo lectura; distinción explícita frente a defensas XSS.
- **Frontend y navegación protegida (D-090):** React Router en modo declarativo cuando fullstack incluya Auth; estado de sesión centralizado con 4 estados; recuperación de sesión mediante consulta al backend sin almacenar credenciales en JavaScript; rutas protegidas para UX con autorización siempre en Express; integración compositiva con i18n, RBAC y futuros módulos; accesibilidad explícita obligatoria.
- **Hash de contraseñas con Argon2id (D-091, D-092, D-093, D-102):** `@node-rs/argon2` 2.2.2 en backends con Auth manteniendo `engines.node: "^24.0.0 || >=26.0.0"` inalterado y paridad JS/TS; parámetros base explícitos $m=19456\text{ KiB}, t=2, p=1$, salt de 16B y salida de 32B en formato PHC canónico Base64 sin padding con rehash transparente tras login válido; validación defensiva previa de PHC ($m \in [19456, 65536]\text{ KiB}, t \in [2,4], p \in [1,2]$, salt 16-32B, hash 32B, longitud $\le 512$B) rechazando sin invocar Argon2id ante anomalías; limitador de concurrencia de 2 operaciones simultáneas y cola máxima de 8 peticiones con rechazo 503 y `Retry-After: 5`; mitigación de enumeración por temporización mediante verificación simulada (*dummy hash*); política de entrada de 128 caracteres y 512 bytes UTF-8; rate limiting HTTP independiente (429).
- **Roles y privilegios de PostgreSQL RLS (D-094):** RLS obligatorio en multitenancy; SQLite excluido; separación estricta entre `app_exec` (sin superusuario, sin `BYPASSRLS`, sin propiedad de tablas protegidas, sin DDL/TRUNCATE, solo DML acotado) y `table_owner` (migraciones); credenciales independientes (`DATABASE_URL` y `MIGRATION_DATABASE_URL`); aprovisionamiento documentado; fallo explícito ante privilegios inadecuados sin desactivar jamás RLS.
- **Migraciones PostgreSQL RLS (D-104):** Drizzle Schema como fuente de verdad del modelo; directivas RLS, políticas y privilegios implementados como migraciones SQL personalizadas versionadas en `drizzle/` ejecutadas con `npm run db:migrate` bajo el rol `table_owner`.
- **Contexto organizacional transaccional y pooling (D-095, B-8):** organización activa validada por petición contra la BD comprobando concesión vigente (D-080); contexto fijado mediante `set_config('app.current_organization_id', ?, true)` con `is_local = true` en transacciones Drizzle (`tx`); **todas las operaciones sobre tablas organizacionales (incluidos SELECT y GET) se ejecutan dentro de transacciones explícitas** (en autocommit el contexto local no permanece disponible); una organización por transacción; propagación estrictamente explícita de `tx` sin `AsyncLocalStorage`; denegación por defecto (cero filas); operaciones globales desacopladas de las de tenant; agregaciones multiorganización legítimas mediante consultas autorizadas independientes; compatibilidad nativa con pooling por transacción; limitación documentada: RLS no sustituye la prevención de inyección SQL.
- **Políticas RLS, clasificación e integridad relacional (D-096):** clasificación explícita entre tablas globales y organizacionales; entidades organizacionales con `organization_id` obligatorio y `FORCE ROW LEVEL SECURITY`; políticas de lectura (`USING`) y escritura (`WITH CHECK`) restrictivas con `NULLIF(..., '')::uuid`; PK simples por defecto; FK compuestas con `organization_id` para aislar relaciones organizacionales; restricciones UNIQUE por organización; restricción de `TRUNCATE`, `COPY FROM`, vistas con `security_invoker = true` y `SECURITY DEFINER` acotado; extensibilidad modular sin desactivar RLS.
- **Auditoría de dos ámbitos con integridad transaccional (D-097, D-105):** taxonomía en dos tablas *append-only*: `audit_log_system` (global: autenticación, seguridad, administración de plataforma e intentos de acceso indebido) y `audit_log_org` (organizacional con `organization_id` y RLS forzado); PostgreSQL con privilegios efectivos separados de ejecución y migración y `app_exec` sin UPDATE ni DELETE, incluso sin multitenancy; SQLite con auditoría obligatoria y garantías limitadas pendientes de especificación y verificación, sin equivalencia de privilegios; mutaciones de negocio y auditoría persistidas atómicamente en la misma transacción; persistencia de denegaciones y anomalías de seguridad fuera de transacciones revertidas; correlación obligatoria por `requestId`; en proyectos sin multitenancy opera únicamente el ámbito global; limitación documentada frente a superusuarios.
- **Delegación administrativa y salvaguardas RBAC (D-106):** autorización explícita; principio de autoridad delegable (solo delegar lo que se posee dentro de la autoridad delegable); comprobación de permisos efectivos sin depender de nombres literales de roles; prohibición de automodificación directa de roles/permisos/concesiones; protección del último administrador efectivo mediante transacción con bloqueo pesimista (`SELECT FOR UPDATE`); gestión de concesiones administrada y prohibición de abandono voluntario de organizaciones (sin endpoints de auto-abandono).
- **Aprovisionamiento administrado y activación segura de cuentas (D-107):** alta administrada con reutilización de identidades globales existentes y concesión directa de acceso; sin invitaciones obligatorias ni SMTP en el núcleo; cuentas nuevas en `pending_activation`; token criptográfico aleatorio de 32 bytes con caducidad y de un solo uso; almacén exclusivo de su hash SHA-256 en BD; enlace entregado de forma controlada al administrador para canal privado; enlace permite únicamente fijar contraseña inicial (Argon2id) sin otorgar sesión ni acceso a negocio; consumo y validación atómicos en una transacción; posibilidad de revocar y regenerar enlaces pendientes; prohibido registrar tokens en logs o errores; rate limiting y respuestas uniformes en activación; multitenancy: concesiones no utilizables hasta completar activación; duración configurable según D-107 (`ACTIVATION_TOKEN_EXPIRY_HOURS`).
- **Estrategia JavaScript/TypeScript: Híbrido versionado (D-098):** TypeScript como fuente de verdad para el código aplicativo y pruebas de plantillas, derivando automáticamente JavaScript mediante AST/Babel con formateo determinista y manteniendo los archivos derivados versionados en Git. Mantenimiento manual acotado a archivos estructuralmente divergentes (`package.json`, Dockerfiles, ESLint, Drizzle config, `tsconfig.json`). Disciplina estricta de `import type`. Verificación determinista en CI con `verify:sync`. Prerrequisito de implementación (T-023) antes de codificar Auth/RBAC.
- **Modelo integral de amenazas y contratos de arquitectura:** Consolidada la matriz de 15 amenazas mínimas y la especificación de contratos en `SECURITY.md` §14 y §15.
- **Pendientes técnicos transferidos a implementación:**
  - Verificación empírica de compatibilidad de sintaxis de políticas RLS en Drizzle Kit 0.31.x sobre PostgreSQL 17 real (asignada a T-014c).
  - Verificación de la caducidad de los tokens conforme a D-107 y pruebas de saturación Argon2id (asignadas a T-014a).
  - Implementación del derivador AST y comando `verify:sync` (asignada a T-023).

**Áreas afectadas:** Documentación arquitectónica (`SECURITY.md`, `DECISIONS.md`, `TASKS_POST_MVP.md`). Ningún archivo de código ni plantilla modificado.

**Criterios de aceptación satisfechos:**
- Todas las preguntas técnicas y decisiones estructurales (A-1, A-2, B-1 a B-8, más la activación inicial de cuentas) tienen respuesta formalizada y aprobada en `DECISIONS.md` (D-080 a D-107).
- La taxonomía de tablas (globales y organizacionales) y los esquemas de auditoría de dos ámbitos están formalizados.
- La matriz completa de 15 amenazas cuenta con escenario, activo, impacto, controles aprobados, verificaciones, riesgo residual y estado en `SECURITY.md` §14.
- Los contratos de arquitectura, límites de confianza y taxonomía de capacidades están detallados en `SECURITY.md` §15.
- La tarea se cierra como completada en su alcance de diseño documental, sin anticipar código ni pruebas técnicas no ejecutadas.

---

### T-017a — Composición de overlays: backend

**Estado:** COMPLETADA (2026-11-15)
**Aprobación:** Aprobado (D-069, D-077, D-078).
**Dependencias:** Fase 1 completada (D-069). Fase 2 completada (D-077, D-078).

**Objetivo:** permitir que varias capacidades modifiquen los mismos archivos sin pisarse, con el mecanismo más simple que funcione. No es un sistema universal.

**Alcance y estado por archivo:**

| Archivo | Estrategia | Estado a 2026-11-15 |
|---|---|---|
| `app` e `index` | Puntos de inserción (`imports`, `routes`, `startup`) con orden por punto de código UTF-16 | **COMPLETADO (Fase 1, D-069)** en `src/generator/insertions.ts` y plantillas backend |
| `package.json` | Fusión determinista con detección de conflicto por igualdad profunda (`mergeSection`) | **COMPLETADO (Fase 1, D-069, D-077)** en `src/generator/generate.ts` |
| `tsconfig` | Declaración de `resolveJsonModule: true` en plantilla base y eliminación del archivo en overlay | **COMPLETADO (D-077)** en `src/templates/backend-express-ts/tsconfig.json` |
| `openapi.json` | Combinación de rutas y componentes con detección de colisiones | PENDIENTE (actualmente solo aportado por `api-docs`; diferido a T-014a/b cuando múltiples capacidades aporten rutas) |
| `compose.yaml` | Inserción explícita de variables de entorno mediante `# @@INSERT:api-docs-env@@` y limpieza | **COMPLETADO (D-077)** en `src/templates/docker/` y `generate.ts` |
| `.env.example` | Fusión determinista e idempotente por nombre de variable con detección de colisiones | **COMPLETADO (D-078)** (`parseEnvAssignments` y `mergeEnvExample`) |

**Áreas afectadas:** **[L]** plantillas backend (`src/templates/backend-express-ts`, `backend-express-js`) y sus `app`/`index`; overlay `api-docs` (ts y js) con `_fragments/` y `docs/openapi.json`; overlay `docker` (`compose.*.yaml`); `.env.example` de las plantillas backend; `src/generator/generate.test.ts`. **[I]** `src/generator/generate.ts`, `src/generator/insertions.ts`, `scripts/verify-generated.js`, `src/verified-variants.ts`.

**Criterios de aceptación satisfechos:**
- Orden determinista: la misma entrada produce la misma salida, byte a byte (orden por `compareCodePoints`).
- Un punto de inserción sin contribuyente se elimina sin dejar rastro.
- Un marcador sin resolver o desconocido en la salida hace fallar el generador.
- Una contribución duplicada o colisión en `package.json` o `.env.example` produce un error que nombra a los contribuyentes.
- El overlay `api-docs` deja de reemplazar `app`, `index` y `tsconfig.json`.
- Fusión idempotente de `.env.example` que preserva comentarios y formato.
- Inserción en Compose falla con ruido si falta el marcador.
- Verificación: 140 pruebas en verde (`npm test`), `typecheck`, `lint`, `format:check`, `build` y `verify:generated` completo superados.

**Riesgos y limitaciones:** el orden determinista por nombre de contribuyente es arbitrario; cuando un overlay dependa de otro se requerirá orden explícito. La combinación estructural de múltiples documentos OpenAPI queda pendiente para cuando Auth o RBAC añadan rutas documentadas.

---

### T-017a-ui — Composición de overlays: frontend

**Estado:** COMPLETADA (2026-11-15)
**Aprobación:** Aprobado (D-079).
**Dependencias:** T-017a.

**Objetivo:** que las capacidades opcionales convivan con i18n y con el proxy de la aplicación completa sin reemplazar archivos de plantilla base ni duplicar componentes.

**Alcance:**
- Composición de `main.{jsx,tsx}`: punto de inserción `// @@INSERT:imports@@` en la plantilla base; el overlay `i18n` inyecta la inicialización de i18n sin sustituir el archivo completo.
- Composición de `App.{jsx,tsx}`: extracción del contenido dependiente de idioma y del selector al hook `useAppContent.{jsx,tsx}`. La base proporciona valores por defecto y selector nulo; `i18n` proporciona la integración reactiva con `useTranslation` y `Trans`. `App` permanece como fuente única de verdad sin duplicaciones.
- Composición de `vite.config.{js,ts}`: declaración de marcadores `imports` y `config`. En modalidad fullstack se compone el proxy mediante `applyFullstackViteProxy`; en frontend independiente los marcadores se limpian mediante `cleanupUnresolvedFrontendInsertionPoints`.
- Auditoría de overlays: completada, sin sobrescrituras silenciosas de archivos compartidos.

**Áreas afectadas:** **[L]** `src/templates/frontend-react-ts` y `frontend-react-js` (`App`, `main`, `useAppContent`, `vite.config`), `src/templates/i18n/{ts,js}` (`useAppContent`, eliminados `App` y `main`), `src/templates/fullstack/` (eliminados `vite.config.{js,ts}`). **[I]** `src/generator/generate.ts`, `src/generator/insertions.ts`, `src/generator/generate.test.ts`.

**Criterios de aceptación satisfechos:**
- Ausencia de marcadores sin resolver en `main` y `vite.config` en variantes con y sin i18n / fullstack.
- Variantes con i18n pasan `check:i18n`, renderizado SSR bilingüe (inglés/español con `scripts/verify-i18n-v2.js`) y `verify:generated`.
- Pruebas unitarias de composición frontend añadidas a `generate.test.ts`.
- Pruebas negativas: marcadores no declarados en frontend lanzan error explícito.

**Nota sobre Router:** la selección y configuración de un router para vistas de autenticación se abordará en `T-014a-ui` cuando se requieran rutas de interfaz adicionales.

---

### T-017b — Seguridad base y Zod

**Estado:** COMPLETADA (2026-11-17; todas las protecciones base implementadas y verificadas con D-070, D-071, D-073, D-074, D-075 y T-022/D-076; `trust proxy` y rate limiting específico de autenticación transferidos a T-014a)
**Aprobación:** Aprobado (alcance). D-070, D-071, D-073, D-074 y D-075 confirmadas.
**Dependencias:** T-017a (Fase 1 backend completada).

**Objetivo:** que todo backend generado tenga configuración validada, validación reutilizable de entradas, errores uniformes y las protecciones mínimas por defecto.

**Alcance y estado:**
- **Zod 4.6.7 y configuración [COMPLETADO - D-070, commit `702f477`]:** Zod fijado en versión exacta como dependencia obligatoria en backend ts y js. Validación descentralizada de configuración al arrancar (`src/config.{ts,js}` y `src/docs/validate-env.{ts,js}`) con `parseConfig` puro. Mensajes de error claros sin imprimir valores sensibles. `portSchema` (entero 0..65535, vacío no es 0), `strictBooleanSchema` (no usa `z.coerce.boolean`).
- **Validación de entradas y propiedades desconocidas [COMPLETADO - D-070, D-071, commits `702f477`, `2bd09b9`]:** Convención documentada y probada con `parseInput`: `body` y `params` se validan con `z.strictObject` (rechaza desconocidas); `query` descarta propiedades desconocidas (`z.object`). No se genera middleware validador automático ni esquemas vacíos: validación explícita en handler.
- **Contrato uniforme de errores [COMPLETADO - D-071, commit `2bd09b9`]:** Módulo `src/errors.{ts,js}`. Clase `ValidationError` propia (solo `path` y `code`, sin `cause`) que responde exclusivamente 400. Estados 400, 401, 403, 404 y 413 conservan código con texto fijo; resto 500 genérico sin filtrar `err.message` ni pilas. `notFoundHandler` devuelve 404 en JSON para rutas no registradas. `res.headersSent` delega a `next(err)`.
- **Redacción centralizada [COMPLETADO - D-067, D-071, D-073, D-076/T-022, commits `1b6f7ad`, `2bd09b9`, `4295376`, `fc19490`]:** Módulo central `src/redact.{ts,js}` aplicado en migradores y en el manejador global (`console.error(redact(inspect(err, { depth: 5 })))`). Ampliado para cubrir `Authorization`, `Proxy-Authorization`, Bearer, `Cookie`/`Set-Cookie`, `password`, tokens y secretos comunes. Aplicado también en arranque y cierre (`src/index.{ts,js}`). Límite de cuerpo `express.json({ limit: "100kb" })`. Mitigación de ReDoS verificada en T-022 (D-076).
- **Cabeceras de seguridad (Helmet) [COMPLETADO - D-074, commit `4295376`]:** Helmet 8.3.0 con CSP estricta (`default-src 'none'`) en todas las rutas del backend; CSP específica con `style-src 'unsafe-inline'` solo en `/docs` (Swagger UI). HSTS desactivado a propósito. `cors 2.8.6` con validación Zod de `CORS_ALLOWED_ORIGINS`; desactivado por defecto; sin `*` ni `null`. `x-powered-by` desactivado.
- **Cabeceras de seguridad (Nginx/SPA) [COMPLETADO - D-075, commit `4295376`]:** `server_tokens off`, CSP sin `unsafe-inline`/`unsafe-eval`, `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy no-referrer` en `location /`. Solo con Docker. `location /api/` sin `add_header`.
- **`trust proxy` [DIFERIDO A T-014a]:** En la plantilla base Express opera de forma segura con `trust proxy: false` por defecto para prevenir IP spoofing sin consumidores de IP ni protocolo en v1 base. Su parametrización y evaluación en topologías con terminación TLS se formaliza como prerrequisito de las cookies de sesión y rate limiting en T-014a (D-089, D-099).
- **Protección general de la API / rate limiting [DIFERIDO A T-014a]:** La plantilla base solo expone `/health` y no requiere contadores globales en memoria ni dependencias adicionales. El rate limiting específico de autenticación, activación y registro se implementará en T-014a conforme a D-086, D-093, D-102 y D-107.

**Áreas afectadas:** **[L]** `src/templates/backend-express-{ts,js}` (`src/app`, `src/index`, `src/config`, `src/errors`, `src/redact`, `tests/config.test`, `tests/cors.test`, `tests/errors.test`, `tests/health.test`, `package.json`), overlay `api-docs` (`swagger.{ts,js}`, `docs.test.{ts,js}`), `src/templates/docker/fullstack/frontend/nginx.conf`, `src/generator/generate.test.ts`.

**Criterios de aceptación comprobados:**
- Una variable ausente o mal formada impide arrancar con mensaje claro sin valores.
- Errores 400 uniformes mediante `ValidationError` en `parseInput`.
- Errores 401, 403, 404, 413 conservan código; ningún error interno devuelve trazas ni mensaje original.
- 404 JSON para rutas no encontradas.
- No existen archivos de esquema vacíos ni dependencias sin uso.
- CSP estricta en `/api/health`; CSP específica en `/docs`. Una sola cabecera por ruta (sin duplicación).
- CORS rechaza `*` y `null`; CORS inactivo por defecto.
- `express.json` rechaza cuerpos superiores a 100 KB con 413 en contrato uniforme.

**Pruebas positivas y negativas:** Batería completa de pruebas unitarias en `tests/config.test.{ts,js}`, `tests/errors.test.{ts,js}`, `tests/cors.test.{ts,js}` y `tests/health.test.{ts,js}` en verde. Tests del generador (`generate.test.ts`) verifican contexto de cabeceras en Nginx.

**Riesgos y limitaciones:** Riesgo de ReDoS en `redact` resuelto en T-022 (D-076). `ValidationError` y `parseInput` quedan provistos y verificados para consumo de futuras rutas de negocio (en plantilla base solo existe `/health`). Cabeceras de la SPA solo disponibles con Docker. `trust proxy` y rate limiting de autenticación quedan transferidos a T-014a para su integración con transporte de cookies y endpoints protegidos.

---

### T-013e — Controles negativos repetibles de i18n

**Estado:** PENDIENTE.

**Origen:** [D-052](DECISIONS.md#d-052--internacionalización-opcional-con-i18next). N1–N7 se ejecutaron una vez en T-013c y quedaron fuera del cierre con alcance reducido de T-013d.

**Alcance:** incorporar N1–N7 a `verify:generated` para frontend TypeScript y fullstack JavaScript con SQLite. Esta tarea queda fuera de T-018 y de los prerrequisitos de T-014a.

**Criterios de aceptación:**

- Ejecutar N1–N7 de forma repetible y registrar el resultado por control y variante.
- Demostrar que retirar o alterar la protección correspondiente hace fallar la aserción esperada de cada control.
- Reportar mutaciones ausentes, duplicadas y errores de infraestructura como errores e impedir que cuenten como detecciones válidas.

### T-018 — Infraestructura de verificación avanzada

**Estado:** IMPLEMENTACIÓN E INTEGRACIÓN COMPLETADAS. La validación conjunta de T-018 + T-023 está COMPLETADA. CI normal y CI Full con SV-5 (fullstack JS + PostgreSQL y Docker) aprobados según confirmación del desarrollador.

**Revisión de integración (2026-11-19):** se corrige SV-5 para conservar Docker en fullstack JS + PostgreSQL, como exige §6.3. La regresión comprueba la configuración exacta, tres verificaciones Docker en la orquestación simulada y su representación en el informe JS/TS (JS aprobado, TS no declarado para esa configuración). Tipos, ESLint, Prettier y pruebas focalizadas aprobados. Las verificaciones integrales locales comunicadas por el responsable preceden a esta corrección; no acreditan su ejecución real con Docker. El responsable confirma que la CI normal de main está verde. El desarrollador confirma que la ejecución CI Full posterior a la corrección cubrió SV-5 con Docker y PostgreSQL y finalizó exitosamente. No se dispone aquí de un informe o identificador de ejecución local. Las notas de CI pendiente anteriores son historial; esta revisión define el estado vigente.
**Aprobación:** Aprobado (alcance).
**Dependencias:** T-017b, INV-06.

**Objetivo:** disponer del arnés de seguridad **antes** de las capacidades, para que cada una llegue con sus controles negativos.

**Alcance:**
- Scripts `verify:generated` (se mantiene), `verify:security` y `verify:all`.
- Motor de mutaciones en el arnés de Brixa sobre copias temporales. Cada mutación comprueba que se aplicó exactamente una vez; si no, el arnés falla.
- Dos listas de variantes verificadas (generación y seguridad), con la lógica de EXPERIMENTAL de D-053.
- Separación, en el proyecto generado, entre las pruebas rápidas y las que requieren base de datos. Nombres de scripts: según INV-06.
- Jobs de CI correspondientes.
- Piloto del motor sobre los controles de T-017b (contrato de errores, cabeceras, CORS). Las variantes de la sección 6.3 se incorporan con cada capacidad.
- Clasificación de resultados de mutación (reportada en INV-06): solo cuenta como eliminada la mutación que hace fallar la aserción esperada; un error de sintaxis, de importación o un tiempo agotado es un error de infraestructura que bloquea, y una mutación que no se aplica exactamente una vez es un error del motor. Ejecución en serie o con un máximo de dos procesos.
- Informe de cobertura por pares de `src/verified-variants.ts` como control automático (resultado de T-020, prueba 6), distinguiendo combinaciones válidas, variantes declaradas, variantes ejecutadas y pares cubiertos.
- Alinear la imagen de PostgreSQL del arnés (`postgres:17-alpine`) con la que generan las plantillas (`postgres:17.4-alpine`) o documentar la diferencia (P-015).
- Instalaciones independientes y caché compartida de npm (D-062); sin symlinks.

**Deuda relacionada:** D-052 asigna N1–N7 a T-013e, fuera del alcance de T-018.

**Áreas afectadas:** **[I]** `scripts/verify-generated.js`, `src/verified-variants.ts` y su test; **[L]** `package.json` del CLI (scripts); `.github/workflows/ci.yml`. Archivos incorporados en `fe41218`: `scripts/mutation-engine.js`, `scripts/mutation-engine.test.js`, `scripts/security-mutations.js` y `scripts/verify-security.js`.

**Criterios de aceptación:**
- Una mutación deliberada hace fallar `verify:security`; una mutación que no se aplica o se aplica dos veces también falla el arnés.
- El piloto cubre al menos una variante backend TypeScript, una backend JavaScript y una fullstack.
- La CI ejecuta lo que corresponde a cada tipo de cambio, y una publicación exige `verify:all`.
- Las mutaciones no aparecen en ningún proyecto generado.

**Pruebas positivas:** línea base sin mutación pasa. **Pruebas negativas:** mutación sin efecto, mutación doble y mutación cuyo texto desapareció de la plantilla.
**Verificaciones:** batería local, `verify:generated` completo y `verify:security` piloto.

**Historial de implementación a 2026-11-17 (incidentes superados):**
Las referencias a correcciones sin commit, CI pendiente y auditoría bloqueada en este apartado describen exclusivamente aquella ejecución. El estado vigente figura en la revisión final de aceptación.
- **Historial confirmado:** `f5f4a23` incorporó a `verify:generated` límites por comando, medición de tiempos y ajustes de cierre de procesos/servidores; `a9ab244` añadió particiones Windows A/B con pruebas de partición y separó instalación (`--no-audit`) de auditoría explícita (`npm audit --audit-level=moderate`). Se conserva el control estricto; `--no-audit` durante la instalación no lo sustituye. `fe41218a35e7a97be8f2cb8f7f82069d37bfb634` incorporó el piloto de T-018.
- **Validación local registrada en esta sesión (Linux, Node 24.22.1):** 41 pruebas del motor y 201 pruebas generales aprobadas; lint, formato, tipos, build y `git diff --check` satisfactorios. Una ejecución de `verify:security` completó las tres líneas base (46/46 tests cada una) y las nueve mutaciones en 46,78 s: `http-500-contract`, `cors-origin-null` y `helmet-csp-header` detectadas por la aserción prevista en `backend+ts`, `backend+js` y el backend de `fullstack+ts`. Son resultados locales, no evidencia de una matriz CI completa.
- **Garantías verificadas localmente:** clasificación estructurada de Vitest; rechazo de causas adicionales, reportes inválidos, señales y timeouts; respaldo antes de escribir, reemplazo mediante temporal y restauración byte a byte; fallos de escritura/restauración clasificados como infraestructura. Control con mutación sin efecto: salida 1. Temporales del piloto eliminados. El patrón CSP se ajustó al mensaje escapado de Vitest sin modificar las pruebas generadas. El antiguo fallo de línea base de un test no se reprodujo ni conserva reporte suficiente para atribuirle una causa.
- **Windows, evidencia de CI reportada:** en la [ejecución 44135365877](https://github.com/acjoell/brixa/actions/runs/44135365877), los cuatro jobs Windows (Node 24/26, A/B) fallaron en `mutation-engine.test.js:278`: se esperaba `SPAWN_ERROR` y se obtuvo `UNPARSEABLE_REPORT`. Con `shell: true`, un comando inexistente falla dentro de un shell que sí arrancó. La corrección local usa Node con un directorio de trabajo inexistente y exige `ENOENT`, provocando un error real de creación de proceso sin mezclar categorías. El test afectado, la suite del motor, las 201 pruebas, lint y formato pasaron después de la corrección; esta permanece sin commit y no está confirmada en Windows CI.
- **Ubuntu, evidencia reportada y reproducción mínima:** los jobs Node 24 (`134223305256`) y Node 26 (`134223305779`) de esa ejecución fallaron en `verify:generated`, primera variante `frontend+ts`, al ejecutar `npm audit --audit-level=moderate`. No se recuperaron sus logs directamente en esta sesión (`gh` no disponible y consulta web sin acceso a logs). La auditoría JSON de un único frontend TS temporal reprodujo exit 1 y 11 paquetes con severidad alta por el advisory siguiente; su build independiente pasó. No se volvió a ejecutar `verify:generated` completo y no hay evidencia nueva que declare verde la matriz actual. El paso `verify:security` de Ubuntu/Node 24 está después de `verify:generated`: el fallo previo impide acreditar ese piloto en CI.

**Bloqueo externo de auditoría (histórico del 2026-11-17; superado según revalidación de T-023):**
- [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): ReDoS por patrones extglob repetidos controlados por un atacante. El advisory oficial consultado afecta `picomatch <=4.0.7` y declara que no hay versiones corregidas. npm solo publicaba versiones hasta `4.0.7`; no se confirmó parche oficial para este aviso. Esta conclusión está fechada, no garantiza el estado futuro del registro.
- La reproducción instaló `picomatch@4.0.7`, compartido por `vite@8.3.6`, `tinyglobby@0.2.17` y `fdir@6.5.0`; `typescript-eslint@8.72.1` llega por `typescript-estree → tinyglobby`. Fullstack reutiliza la plantilla frontend. Los 11 hallazgos son paquetes afectados transitivamente por un mismo advisory, no once vulnerabilidades independientes. El tooling del propio Brixa también está afectado mediante Vitest/Vite y typescript-eslint.
- Exposición demostrada: componente vulnerable instalado en dependencias de desarrollo usadas en lint/build/tests. No se identificó una ruta en las plantillas que entregue patrones glob de usuarios no confiables a picomatch; no se demostró explotación. Sigue existiendo riesgo potencial al procesar código/configuraciones no confiables. La auditoría productiva del frontend temporal (`--omit=dev`, solo diagnóstico) dio cero hallazgos, no se encontró el componente en el bundle inspeccionado y Docker fullstack copia solo `dist/` a Nginx. Esto no demuestra riesgo cero ni sustituye la auditoría completa.
- Actualizaciones consultadas: Vite `8.3.8` conserva `picomatch ^4.0.7` y typescript-eslint `8.73.0` conserva tinyglobby. No se verificó una actualización compatible que elimine la cadena ni se adoptaron downgrades, forks u overrides. El fallo corresponde a una dependencia externa y al funcionamiento esperado de la auditoría estricta; por sí mismo no demuestra que las pruebas funcionales de Brixa estén corruptas.
- Se mantiene la política vigente (D-065/D-066): sin excepciones, bypasses, `audit fix --force` ni sustitución del control completo por `--omit=dev`. Las posibles mitigaciones de exposición y una eventual aceptación temporal de riesgo fueron propuestas, no implementadas ni autorizadas; el bloqueo de auditoría permanecía en aquella ejecución.

**Revalidación tras integrar main/T-023 (2026-11-19, Linux Node 24.22.1):**
- Resolución del manifest por unión de scripts: conserva `verify:security` y `verify:all`, los modos funcional/auditoría y `derive:js`/`check:sync`/`verify:sync`. Dependencias y lockfile de T-023 conservados; metadatos raíz del lockfile y referencias locales/de scripts comprobados. CI conserva sincronización, auditorías estrictas portable/full y el piloto Ubuntu Node 24. No se rebajan controles ni se cambian dependencias.
- `npm run verify:security`: código 0 en 37,65 s; líneas base 46/46 en backend TS, backend JS y backend de fullstack TS. Las nueve mutaciones (HTTP 500, Origin null y CSP en cada variante) detectadas por la aserción esperada; auditoría estricta de cada backend, lint y build/typecheck TS correctos. Temporales eliminados por el arnés.
- 100/100 pruebas focalizadas en siete archivos: motor de mutaciones (41), modos, particiones, derivador PostgreSQL/React/inventario y variantes verificadas. Incluyen patrones ausentes/duplicados, supervivencia, fallos ajenos, reportes inválidos, restauración y creación de proceso con cwd inexistente (`ENOENT` → `SPAWN_ERROR`). La corrección Windows ya está versionada en la rama; esta ejecución Linux no acredita Windows.
- Tipos, lint, formato, build de Brixa y `verify:sync` correctos. No se ejecutaron la suite general, `verify:generated`, `verify:all`, matrices completas ni Docker. La retirada del advisory y el CI verde de T-023 constan en su informe y fueron confirmados por el responsable; no equivalen al CI de este merge.

**Matriz de aceptación revisada (fuentes originales en Alcance, Criterios de aceptación y §6.3):**
| Criterio | Evidencia / pendiente |
|---|---|
| Mutación detectada, sobreviviente, ausente y doble | Piloto 9/9 y controles negativos del motor aprobados |
| Backend TS, backend JS y fullstack | Tres líneas base y tres mutaciones por variante aprobadas |
| CI por tipo de cambio y publicación con `verify:all` | Responsable confirma workflow completo verde, incluidos Windows Node 24/26 A/B y Verify Generated Full Scope con Docker/PostgreSQL. `verify:all` local pasó. D-065 exige `verify:all` antes de publicar; no hay workflow de publicación que automatice esa exigencia |
| Mutaciones fuera del proyecto generado | Catálogo/motor en `scripts/` de Brixa; el piloto solo modifica copias temporales y restaura originales |
| Scripts, listas y clasificación (Alcance y D-065) | `package.json` enlaza ambas baterías mediante `verify:all`. `src/verified-variants.ts` contiene ambas listas. `mutation-engine.test.js` comprueba clasificación estricta, restauración y coincidencia del piloto con la lista de seguridad. 41/41 aprobadas |
| Ejecución en serie e instalaciones independientes (Alcance y D-062) | `verify-security.js` recorre variantes y mutaciones en serie, instala en temporales independientes y elimina cada directorio en `finally`. CI configura caché npm compartida |
| Mutaciones con BD y proyecciones (§6.3) | Implementadas las siete proyecciones conservando modalidad, lenguaje, BD y Docker. Se mantienen los tres controles HTTP 500/CORS/CSP del piloto. `verify-security.js` reutiliza las verificaciones de BD y Docker sobre el proyecto temporal y evita reinstalar su backend. Pruebas de orquestación con procesos simulados comprueban 10 variantes, 30 mutaciones previstas y limpieza en éxito/fallo. Ejecución real pendiente |
| Separación de pruebas con BD | Implementados `test:unit` (excluye `tests/db.test.*`) y `test:db` (solo conexión) en los manifests correspondientes. `npm test` conserva ambos grupos. El arnés integral ejecuta ambos scripts con la URL de BD apropiada. Generación focalizada PostgreSQL/SQLite JS/TS y selección real de archivos con Vitest aprobadas sin instalaciones |
| Cobertura por pares automática | `verification-report.js` calcula 76 combinaciones y 76 pares válidos, 73 pares declarados y los tres huecos de D-053. Ambos arneses emiten tabla JS/TS y JSON con selección, ejecución, resultado, parejas incompletas/fallidas y diferencias de estado. Pruebas focalizadas verifican que el fallo interrumpe y se informa de variantes pendientes. El modo funcional/auditoría queda explícito. La falta de infraestructura obligatoria produce fallo global |
| PostgreSQL del arnés y plantillas | Diferencia documentada como permite P-015: arnés `postgres:17-alpine`, plantillas `postgres:17.4-alpine` |

**Validación focalizada del incremento residual:** 42 pruebas aprobadas en cinco archivos (`security-residuals.test.js`, `security-projections.test.js`, `verify-modes.test.js`, `verify-partitions.test.js` y `verified-variants.test.ts`). Incluyen generación temporal de cuatro combinaciones PostgreSQL/SQLite JS/TS sin instalar dependencias, selección real de tests con Vitest, reporte ante fallo o infraestructura ausente y orquestación simulada de las diez variantes. Tipos, ESLint y Prettier correctos. Los nombres `test:unit`/`test:db` se adoptan como elección local porque el informe original INV-06 no está disponible. Los resultados anteriores de 9/9 y CI verde corresponden al piloto, y la validación real de las nuevas proyecciones sigue pendiente.

**Cierre administrativo T-018 + T-023:** T-023 está COMPLETADA. T-018 está IMPLEMENTADA e INTEGRADA en main. La CI normal de main fue aprobada según el responsable. Queda completo el resultado del workflow full que ejecuta SV-5 con Docker y PostgreSQL. Se puede avanzar a T-014a sin reabrir T-018 por asuntos administrativos. T-013e permanece PENDIENTE e independiente, sin bloquear T-014a.

**Pendiente de validación:**
1. Incorporar las proyecciones acreditadas a `VERIFIED_SECURITY_VARIANTS` conforme a D-053 y D-065.
2. La activación gradual se implementa quitando únicamente las capacidades aún inexistentes de SV-1 a SV-7. `VERIFY_SCOPE=portable` selecciona cinco variantes (piloto y dos proyecciones SQLite sin Docker), y `full` selecciona diez (piloto y siete proyecciones). Las mutaciones RLS corresponden a la futura implementación de T-014c.
3. Tras completar el alcance pendiente, ejecutar las verificaciones pertinentes y actualizar la matriz. La validación integral local y CI remota del piloto ya están confirmadas por el responsable.
4. T-023 permanece COMPLETADA. T-018 está COMPLETADA, con validación conjunta T-018 + T-023 completada según confirmación del desarrollador.

**Revisión final de aceptación (2026-11-19; evidencia comunicada por el responsable):** `npm test`, `verify:sync` y `VERIFY_SCOPE=full npm run verify:all` aprobaron localmente; CI está verde, incluido Windows Node 26 Group A tras corregir la prueba de timeout, y la verificación Full Scope con Docker/PostgreSQL; auditoría de dependencias satisfactoria; nueve mutaciones detectadas y 41/41 pruebas del motor aprobadas. No se repitieron estas ejecuciones durante la revisión documental. Esta evidencia cierra los pendientes de integración/CI y el incidente Windows, pero deja pendientes los requisitos y decisiones de alcance detallados en la matriz; por tanto, la validación full de SV-5 queda aprobada según confirmación del desarrollador.

**Riesgos:** mutaciones frágiles frente a cambios de plantilla; coste de minutos de CI. Advertencia DEP0190 en Windows (`shell: true` con argumentos en `execFileSync`): deuda técnica del arnés (`scripts/verify-generated.js` y `scripts/verify-i18n.js`), a evaluar durante el mantenimiento de la infraestructura de verificación sin alterar el comportamiento de las plantillas generadas ni refactorizar el manejo de procesos en esta etapa.

**Reconciliación final tras `b1e61aa6f910929271419ecae9232ffe99a47022`:** el responsable confirma CI completamente verde en Windows Node 24/26 A/B, Linux y macOS después de publicar la corrección. El fallo de los cuatro jobs Windows de `44565892050` sobre `80082ed` queda como antecedente resuelto. La prueba usa un archivo `.cjs`, `process.execPath` y `shell: false`, observa el cierre y el marcador persistente y exige `timedOut=true`, `TIMEOUT` y PID terminado. La opción `shell` conserva su valor predeterminado anterior. Caso focalizado, 41/41 pruebas y controles estáticos locales aprobados. Se incorpora la confirmación del responsable como evidencia remota, sin atribuirle un identificador de ejecución verde no facilitado. El cierre sigue pendiente de la separación de pruebas con BD, el informe automático por pares y las decisiones de alcance indicadas arriba.

---

### T-014a — Autenticación seleccionable

**Estado:** BLOQUEADA (por T-014-0, T-017b, T-018; T-023 completada)
**Aprobación:** Aprobado (núcleo común; cookies en fullstack y selección en backend sin mezcla simultánea, D-089; hash de contraseñas resuelto por D-091 a D-093). Parámetros temporales de sesión resueltos por D-101.
**Dependencias:** T-014-0, T-017b, T-018 y T-023 (derivador y verify:sync en verde antes de implementar plantillas de Auth en ambas variantes). Decisiones de diseño consolidadas en D-080 a D-098. La composición de backend base requerida (`app`, `index`, `package.json`) ya está disponible y verificada (D-069, D-077, D-078).

**Objetivo:** cuentas y credenciales funcionales y verificadas, con una modalidad elegida por proyecto.

**Opciones en el CLI:** **A.** Sesiones mediante cookies (exclusiva para aplicación completa / fullstack; seleccionable en backend independiente). **B.** Autenticación mediante tokens Bearer (exclusivamente para backend independiente). Sin mezcla simultánea de transportes (D-089).

**Alcance común:**
- Núcleo de identidad y gestión de cuentas compartido; sin duplicar tablas de usuarios ni la lógica de cuentas.
- Sesiones opacas generadas con 32 bytes criptográficamente aleatorios y hashes SHA-256 en base de datos como único modelo de v1, sin JWT (D-087). Validación y revocación en servidor; token sin identidad, roles ni organización; núcleo común para cookies y Bearer.
- Hash de contraseñas: **resuelto por D-091 a D-093 (P-009)** tras INV-01 e INV-07. Argon2id mediante `@node-rs/argon2` versión exacta `2.2.2` en backends generados con Auth; `engines.node: "^24.0.0 || >=26.0.0"` inalterado sin alternativas en `node:crypto`, bcrypt ni scrypt y con paridad JS/TS (D-091); parámetros explícitos `m=19456 KiB, t=2, p=1, outputLen=32`, salt aleatorio de 16 bytes, formato PHC canónico en Base64 convencional sin padding (no Base64URL) y rehash tras login válido (D-092); y controles de seguridad obligatorios: asincronía estricta en HTTP, validación defensiva previa de parámetros PHC para evitar DoS por memoria/CPU, verificación simulada (dummy) contra enumeración por tiempo, limitador de concurrencia acotado independiente del rate limiting, y política de entrada de 128 caracteres / 512 bytes UTF-8 (D-093). Quedan como pendientes técnicos de concreción en diseño/implementación los límites numéricos defensivos exactos y pruebas en Docker / sin dependencias opcionales.
- Ciclo de vida de sesión con expiración deslizante por inactividad (30 min por defecto) y límite absoluto e improrrogable (12 h desde creación); revocación efectiva inmediata; actualización diferida de actividad en BD con umbral de 60 segundos; sin rotación periódica en v1 (D-088, D-101).
- Cookies de sesión con configuración estricta: `HttpOnly`, `Secure` (obligatorio en producción; excepción explícita con aviso visible únicamente en `NODE_ENV=development` sobre localhost), `SameSite=Lax`, `Path=/`, sin `Domain`, prefijo `__Host-` únicamente si cumple requisitos acumulativos, y nombre específico por proyecto (D-089, D-099).
- Proveedor de identidad interno exclusivo en v1 (D-100).
- Protección CSRF obligatoria en operaciones mutables autenticadas por cookies mediante middleware centralizado, validación de `Origin`/`Referer`, Fetch Metadata y cabecera personalizada de API (`X-Requested-With`), sin sincronizador en topología same-origin (D-089, D-103).
- Bearer mediante cabecera estándar `Authorization: Bearer <token>` (D-089).
- Límite de intentos de autenticación sin bloqueo permanente de cuentas (nivel 2 de abuso).
- Mensajes de error que no revelan si una cuenta existe.
- Aprovisionamiento administrado y activación segura de cuentas: token criptográfico de un solo uso según D-107, con historial persistente de digests y como máximo un token abierto por usuario; enlace entregado al administrador sin SMTP obligatorio; consumo atómico para contraseña inicial; sin contraseñas predeterminadas.
- Bootstrap seguro del primer administrador mediante comando de consola local idempotente (D-085).
- Protección de la documentación de API cuando está activa.

**Fuera de alcance:** JWT en v1 (D-087), Bearer en fullstack en v1 (D-089), access+refresh rotativo en v1 (D-088), cookies cross-site en v1 (D-089), registro público en proyectos con multitenancy (excluido terminantemente por D-086; admisible como opción en Auth sin multitenancy con registro administrado como predeterminado tras consolidar el núcleo), creación pública de organizaciones (D-086), recuperación de contraseña (salvo que aparezca una razón importante), MFA y OAuth/SSO.

**Matriz de compatibilidad (modalidad × backend/fullstack × cliente):** definida según D-089 (fullstack exclusivo cookies; backend independiente con cookies o Bearer sin mezcla simultánea).

**Áreas afectadas:** **[I]** pregunta y validación del CLI (`src/prompts/questions.ts`, `src/validation/options.ts`, `src/types.ts`), generador, `src/verified-variants.ts`, arnés. **[L]** plantillas backend, overlays de base de datos (cuatro archivos de esquema por tabla: dos motores por dos lenguajes). Rutas nuevas: por determinar.

**Criterios de aceptación:**
- Alta, inicio y cierre de sesión funcionan en cada combinación declarada soportada.
- Credenciales no almacenadas en texto plano (ni la credencial de sesión ni las contraseñas). En sesión, únicamente hash SHA-256 en BD (D-087).
- Revocación efectiva en la petición siguiente. En PostgreSQL y SQLite en archivo se comprueban por petición expiración y revocación y se conservan las reglas de actividad de D-101.
- La BD persistente seleccionada es autoridad para Auth sin multitenancy. `:memory:` no acredita persistencia; libSQL remoto requiere evidencia específica de consistencia.
- Auditoría global obligatoria en ambos motores, atómica con las mutaciones y con denegaciones independientes del rollback. PostgreSQL exige privilegios separados; la protección limitada SQLite requiere especificación y verificación (D-105).
- Ninguna credencial ni secreto en el proyecto generado; secretos obligatorios validados al arrancar.

**Pruebas positivas:** flujo completo en cada modalidad; renovación según la decisión; cierre de sesión.
**Pruebas negativas (SECURITY §11):** no autenticado accede a recurso protegido; credencial caducada, revocada o manipulada; usuario deshabilitado con credencial viva; enumeración de cuentas por mensaje o por tiempo; fuerza bruta con respuesta 429 y **recuperación del acceso tras la espera** (sin bloqueo permanente); solicitud entre orígenes sin CSRF (cookie); credencial anterior tras cambio de contraseña; la credencial en reposo no aparece en la base de datos en claro; contraseña por encima del máximo rechazada; campos como `role` o `isActive` enviados por el cliente sin efecto; ninguna respuesta ni registro contiene hashes o secretos.
**Verificaciones:** batería local, `verify:generated` y `verify:security` en las variantes de la sección 6.3 que incluyan autenticación.

**Riesgos y limitaciones (reportado en INV-03b):** los navegadores no aíslan cookies por puerto en `localhost`, mitigado mediante nombre específico de cookie por proyecto (D-089); `__Host-` exige `Secure`, `Path=/` y ausencia de `Domain`; Nginx no reescribe el `Path` de `Set-Cookie`; Safari no está verificado. La cookie `Secure` no se envía por HTTP fuera de `localhost` y los proyectos generados no terminan TLS; el comportamiento de cada navegador debe comprobarse. Un límite de intentos en memoria no se comparte entre instancias.

---

### T-014a-ui — Vistas de autenticación (aplicación completa)

**Estado:** BLOQUEADA (por T-014a y T-017a-ui)
**Aprobación:** Aprobado (arquitectura frontend: React Router declarativo condicionado a Auth, componentes pequeños, presentación separada de la lógica, accesibilidad explícita, D-090). Estilos y pruebas de componentes pendientes.
**Dependencias:** T-014a, T-017a-ui.

**Objetivo:** vistas funcionales, accesibles y fáciles de modificar. Solo en aplicación completa; en backend solo se generan los endpoints.

**Alcance consolidado (D-090):**
- React Router en modo declarativo adoptado cuando fullstack incluya Auth; proyectos sin Auth no incorporan router obligatorio.
- Estado de sesión centralizado con 4 estados explícitos: verificación inicial (cargando), autenticado, no autenticado y error de comunicación.
- Recuperación de sesión mediante consulta al backend; ninguna credencial almacenada en JavaScript (`localStorage`/`sessionStorage`).
- Rutas protegidas como mecanismo de experiencia de usuario y navegación defensiva; autorización efectiva siempre en Express.
- Integración compositiva con i18n, RBAC y futuros módulos.
- Accesibilidad explícita obligatoria (CODE_STANDARDS §12): actualización dinámica de `document.title`, gestión de foco del teclado en navegación y anuncios de cambio de ruta para lectores de pantalla.
- Pruebas reales de navegación, redirecciones, recargas de página y accesibilidad.

**Áreas afectadas:** **[L]** plantillas de frontend y overlay i18n. Rutas nuevas: por determinar.

**Criterios de aceptación:**
- Disponible en JavaScript y TypeScript.
- Con i18n activo, las vistas usan sus claves; sin i18n, texto fijo, sin duplicar vistas.
- Accesibilidad obligatoria: etiquetas, teclado, estados de error y carga, foco dinámico y anuncios de ruta (D-090).
- El acceso HTTP, el estado de autenticación y la presentación están en archivos separados; sin componentes que mezclen todo.
- Pruebas reales de navegación y recarga ejecutables en frontend.

**Pruebas positivas:** inicio de sesión correcto; estado de autenticación tras recargar; navegación entre rutas públicas y protegidas.
**Pruebas negativas:** credenciales inválidas con mensaje uniforme; acceso a una vista protegida sin sesión redirige; respuesta 401 del backend limpia el estado; en modalidad cookie no se guarda ninguna credencial en el almacenamiento accesible a JavaScript; sin `dangerouslySetInnerHTML`.
**Verificaciones:** compilación, lint, pruebas de componentes y pruebas reales de navegación y accesibilidad.

**Riesgos:** introducir un router en fullstack con Auth agrega una dependencia nueva; debe mantenerse estrictamente desacoplada y accesible (gestión de `document.title`, foco al navegar y anuncios de cambio de ruta, D-090).

---

### T-014b1 — Motor RBAC, API administrativa y auditoría mínima

**Estado:** BLOQUEADA (por T-014a, T-014-0, T-018; T-023 completada)
**Aprobación:** Aprobado (alcance).
**Dependencias:** T-014a, T-014-0, T-018 y T-023.

**Objetivo:** autorización efectiva en el servidor, administrable sin interfaz.

**Compatibilidad prevista:** Auth + RBAC con SQLite y PostgreSQL. SQLite sin multitenancy; multitenancy exclusivamente PostgreSQL. T-014b1 conserva su dependencia de T-014a. Las combinaciones permanecen experimentales hasta cumplir las verificaciones exigidas (D-053).

**Alcance aprobado:**
- Motor de autorización.
- Catálogo declarativo de recursos y acciones. El desarrollador registra los módulos y acciones reales que implementa en el backend. El administrador no puede crear permisos arbitrarios.
- Endpoints administrativos y gestión de usuarios.
- Creación y edición de roles; asignación de permisos a roles y de roles a usuarios.
- Autorización invocable desde servicios y casos de uso, no solo desde middleware HTTP.
- Auditoría mínima: quién cambió roles, permisos y asignaciones.

**Decisiones consolidadas (D-080, D-082, D-083, D-084):** paso estrictamente explícito de `ActorContext` (descartando `AsyncLocalStorage` para autorización); RBAC dinámico con catálogo de permisos en código sincronizado con BD; roles, asignaciones y permisos administrables desde el panel/API; alcances de aplicación y organización; sin motor genérico ABAC/ReBAC; con multitenancy, los roles se asignan a la concesión de acceso y no al usuario global; administración de plataforma separada de la organizacional sin bypass de RLS ni acceso global automático.
**Propuesto / pendientes de diseño en T-014-0:** regla «solo se otorgan permisos que se poseen» y reglas de delegación; prohibir editar el propio rol; invariante del último administrador comprobada dentro de una transacción con bloqueo; permisos leídos por petición, sin caché local entre instancias; invitaciones a organizaciones.

**Áreas afectadas:** **[I]** CLI y generador. **[L]** plantillas backend y overlays de base de datos (cuatro archivos de esquema por tabla). Rutas nuevas: por determinar.

**Criterios de aceptación:**
- Cada ruta o caso de uso protegido aplica explícitamente su permiso. Declarar un permiso en el catálogo no protege nada por sí solo (AI_RULES §8).
- El servidor valida cada asignación contra el catálogo y rechaza permisos desconocidos.
- Toda modificación administrativa deja un registro de solo añadir.
- Un cambio de permisos surte efecto en la petición siguiente.

**Pruebas positivas:** usuario con permiso accede; rol creado y asignado; registro de auditoría con el actor.
**Pruebas negativas:** sin sesión (401) y sin permiso (403); una prueba que recorre las rutas y falla si alguna no es pública ni protegida de forma explícita; asignación de permiso inexistente; escalada de privilegios; edición del propio rol; degradación simultánea del último administrador; acción administrativa sin registro; los datos no cambian tras un intento denegado.
**Verificaciones:** batería local, `verify:generated` y `verify:security` en las variantes con RBAC.

**Riesgos:** una auditoría alterable desde la API no es auditoría. Un catálogo persistido choca con que el servidor no ejecute migraciones al arrancar (D-037).

---

### T-014b2 — Panel de administración

**Estado:** BLOQUEADA (por T-014b1 y T-014a-ui)
**Aprobación:** Aprobado (alcance).
**Dependencias:** T-014b1, T-014a-ui.

**Alcance:** panel React solo en aplicación completa: usuarios, roles, matriz de permisos a partir del catálogo y asignaciones. Modular, accesible, sencillo y personalizable.

**Áreas afectadas:** plantillas de frontend y composición de T-017a-ui. Rutas nuevas: por determinar.

**Criterios de aceptación:** JavaScript y TypeScript; accesible (tablas, formularios y diálogos); usa el motor de T-014b1; ningún control depende solo de ocultar elementos en la interfaz.
**Pruebas positivas:** crear un rol y asignarle permisos del catálogo; asignarlo a un usuario.
**Pruebas negativas:** acceso directo a rutas del panel sin permiso; operaciones administrativas por la API con una credencial sin permiso; el panel no ofrece crear identificadores de permiso arbitrarios.
**Verificaciones:** compilación, lint y pruebas de componentes (según INV-06). Sin navegador real: declarado como comprobado manualmente.

**Riesgos:** un XSS o un CSRF contra este panel equivale a una escalada de privilegios. Es la pieza con mayor coste de mantenimiento si JavaScript y TypeScript se duplican.

---

### T-014c — Multitenancy con PostgreSQL RLS

**Estado:** BLOQUEADA (por T-014a, T-014-0, T-018 y comprobación de soporte de sintaxis RLS en Drizzle Kit; arquitectura cerrada en D-094 a D-097)
**Aprobación:** Aprobado (alcance y arquitectura en D-064 y D-094 a D-097). **No depende de RBAC.**
**Dependencias:** T-014a, T-014-0, T-018. Decisiones consolidadas en D-080 a D-097. La composición de backend requerida ya está disponible (D-069).

**Objetivo:** aislamiento obligatorio por organización en PostgreSQL mediante Row-Level Security (RLS) para todas las variantes con multitenancy. SQLite no tiene multitenancy en esta etapa (D-064, D-094).

**Requisitos de identidad y acceso:** autenticación de Brixa **o una identidad externa verificada**. Sin RBAC activo, concesiones de acceso organizacionales N:M con ciclo de vida gobernado por `revoked_at` y unicidad parcial (D-080, D-081), sin roles fijos `owner/member` (D-083). Organización seleccionada por petición y validada contra la BD comprobando la vigencia de la concesión; propagación estrictamente explícita de `ActorContext` sin ALS (D-080). Administración de plataforma separada sin bypass genérico de RLS ni acceso global automático (D-084). La integración con identidad externa depende de la decisión de T-014-0 (ver «Cuestiones abiertas»).

**Alcance consolidado (D-094 a D-097):**
- **Roles y privilegios de base de datos (D-094):** separación estricta entre `app_exec` (ejecución sin superusuario, sin `BYPASSRLS`, sin propiedad de tablas protegidas, sin DDL/TRUNCATE, solo DML acotado) y `table_owner` (migraciones). Credenciales independientes (`DATABASE_URL` y `MIGRATION_DATABASE_URL`). Aprovisionamiento documentado para entornos administrados. Fallo explícito si no se garantizan los privilegios; nunca desactivar RLS.
- **Contexto organizacional transaccional y pooling (D-095):** contexto fijado exclusivamente mediante `SELECT set_config('app.current_organization_id', ?, true)` con `is_local = true`, parámetros enlazados y transacciones Drizzle (`tx`). Una organización por transacción. Paso estrictamente explícito de `tx` como argumento en servicios sin `AsyncLocalStorage`. Denegación por defecto (cero filas ante contexto ausente o vacío). Operaciones globales desacopladas de las organizacionales. Agregaciones multiorganización mediante consultas independientes y autorizadas sin bypass general de RLS. Compatibilidad con pooling por transacción (PostgreSQL limpia automáticamente la variable GUC al terminar la transacción). Limitación documentada: RLS no sustituye la prevención de inyección SQL.
- **Políticas RLS e integridad relacional (D-096):** clasificación explícita entre tablas globales y organizacionales. Tablas organizacionales con columna `organization_id` obligatoria y `FORCE ROW LEVEL SECURITY`. Políticas `USING` y `WITH CHECK` con expresión segura `NULLIF(current_setting('app.current_organization_id', true), '')::uuid`. Prohibición de `USING (true)`. PK simples por defecto. Claves foráneas compuestas con `organization_id` (`FOREIGN KEY (organization_id, parent_id) REFERENCES parent_table(organization_id, id)`) para garantizar aislamiento entre entidades organizacionales. Restricciones UNIQUE por organización. Restricción de `TRUNCATE`, `COPY FROM`, vistas obligatoriamente con `security_invoker = true` y funciones `SECURITY DEFINER` acotadas con `search_path` seguro. Autorización efectiva y RBAC en Express, aislamiento de filas en PostgreSQL. Extensibilidad modular para nuevos módulos sin tocar el núcleo de seguridad.
- **Verificación estructural, rendimiento y auditoría (D-097):** auditoría estructural automática de catálogos PG (`pg_tables`, `pg_roles`, `pg_policies`) y pruebas de concurrencia que bloquean CI ante fallos críticos; benchmarks de rendimiento en laboratorio aislado con `EXPLAIN (ANALYZE, BUFFERS)` y métricas p50/p95 sin variante pública multitenant sin RLS; auditoría operativa de seguridad centralizada correlacionada por `requestId`; y auditoría de acciones de negocio transversal para Auth append-only en la misma transacción sin permisos UPDATE/DELETE para `app_exec`.

**Entregables:**
1. Patrón reutilizable de acceso a datos con contexto transaccional en Drizzle.
2. Dos niveles obligatorios de documentación técnica para desarrolladores (D-097): guía práctica breve (ejemplos de tablas organizacionales, operaciones transaccionales y auditoría de acciones) y referencia técnica (políticas, permisos, amenazas, pruebas, garantías y limitaciones).
3. Pruebas negativas y de concurrencia reutilizables.
4. Auditoría estructural de tablas, roles y políticas RLS que inspecciona catálogos de PostgreSQL y bloquea CI ante fallos críticos.
5. Evaluación de rendimiento representativa en laboratorio aislado: cargas realistas, comparación con/sin RLS, índices en `organization_id` y análisis sistemático de planes de ejecución (`EXPLAIN (ANALYZE, BUFFERS)`).
6. Infraestructura de auditoría operativa de seguridad y auditoría de acciones de negocio append-only integrada con transacciones.

**Áreas afectadas:** **[L]** overlay `database-postgres` (ts y js), `compose.postgres.yaml` y variante fullstack (roles de base de datos en el arranque del contenedor: por determinar). **[I]** CLI y generador. Rutas nuevas: por determinar.

**Criterios de aceptación:**
- La aplicación se conecta exclusivamente con el rol `app_exec` sin privilegios; una prueba falla si el rol es superusuario, propietario de tabla o tiene `BYPASSRLS`.
- Una tabla del registro organizacional sin RLS habilitado y forzado, o sin política, o con política permisiva abierta (`USING (true)`), hace fallar la auditoría estructural y bloquea CI.
- Los controles negativos del arnés detectan la eliminación de una política y la conexión con un rol privilegiado.
- Se entregan pruebas de rendimiento representativas en laboratorio aislado que comparan escenarios con y sin RLS, validando que los índices definidos eviten escaneos secuenciales innecesarios mediante análisis de planes de ejecución (`EXPLAIN (ANALYZE, BUFFERS)`).
- La auditoría operativa registra accesos denegados con correlación de peticiones; la auditoría de acciones persiste eventos atómicamente y rechaza modificaciones/borrados.
- Se entregan la guía práctica breve y la referencia técnica para desarrolladores.

**Pruebas positivas:** cada organización lee y escribe sus datos; cambio de organización activa con concesión de acceso válida; operaciones transaccionales con contexto local; registro atómico de acciones de negocio.
**Pruebas negativas (SECURITY §11):** usuario de una organización lee, modifica o elimina datos de otra; envía un identificador de organización propio; asocia entidades de organizaciones distintas (violación de FK compuesta); consulta sin contexto o con contexto vacío (cero filas); contexto residual tras reutilizar una conexión del pool; exportaciones y agregados; cambio a una organización sin concesión de acceso; concesión de acceso retirada; intento de conexión con rol privilegiado; intento de manipulación de variable GUC; intento de `UPDATE` o `DELETE` sobre la tabla de auditoría.
**Verificaciones:** requieren PostgreSQL, por tanto el ámbito `full` (Linux). No se verifica en Windows ni macOS. Incluye ejecución de pruebas de rendimiento con/sin RLS y análisis de planes de ejecución (`EXPLAIN ANALYZE`).

**Riesgos y limitaciones:** **RLS no protege frente a SQL arbitrario ni inyección SQL** (reportado en INV-04a e INV-04b): es defensa en profundidad contra filtros olvidados, y el servidor sigue siendo responsable de autenticar al actor, validar su acceso y establecer el contexto. El aislamiento solo cubre tablas registradas y el acceso que pasa por el patrón generado. Tareas en segundo plano, cachés, archivos y vistas del desarrollador quedan bajo su responsabilidad. En bases gestionadas, el desarrollador debe crear los dos roles. Comprobación de soporte de sintaxis de políticas RLS en el Drizzle Kit fijado: pendiente en implementación. Sobrecoste de rendimiento de RLS en consultas complejas o filtros masivos sin los índices adecuados.

---

### T-014d — Integración de RBAC con multitenancy

**Estado:** BLOQUEADA (por T-014b1 y T-014c)
**Aprobación:** Propuesto. Tarea nueva que evita que multitenancy dependa de RBAC.
**Dependencias:** T-014b1, T-014c.

**Objetivo:** cuando ambas capacidades están activas, los roles y permisos pasan a ser por organización, se asignan a la concesión de acceso y sustituyen a los roles fijos de la concesión básica (si se aprueban).

**Áreas afectadas:** las de T-014b1 y T-014c; panel de T-014b2 si procede (por determinar en T-014-0).

**Criterios de aceptación:** un administrador de una organización no ve ni modifica roles de otra; la combinación solo se declara soportada tras `verify:security` (SV-1 y SV-6).
**Pruebas positivas:** un rol por organización con sus permisos.
**Pruebas negativas:** administrador de la organización A edita un rol de B; asigna a un usuario de B un permiso de A; el último administrador de una organización no puede dejarla sin administrador.
**Verificaciones:** `verify:security` (ámbito `full`).

**Riesgos:** la forma del esquema con y sin multitenancy se fija en T-014-0; si no se decide allí, esta tarea obliga a reescribir las tablas de RBAC.

---

### Tarea recurrente — Revisión periódica de dependencias e imágenes

**Estado:** RECURRENTE (activa)  
**Aprobación:** Aprobada (D-066).  
**Frecuencia:** Mensual y obligatoria previa a cada publicación de versión.

**Objetivo:** Mantener la seguridad, estabilidad y actualidad de las dependencias directas de todas las plantillas y de las imágenes base Docker, detectando a tiempo avisos de vulnerabilidad, roturas de compatibilidad y deprecaciones.

**Checklist mensual y previo a cada publicación:**
1. **Avisos de seguridad y versiones base de imágenes Docker:**
   - Comprobar nuevas versiones o parches de seguridad para `node` (actualmente `node:24.22.1-slim`), `nginx` (`nginxinc/nginx-unprivileged:1.30.6-alpine-slim`) y `postgres` (`postgres:17.4-alpine`).
   - Evaluar vulnerabilidades conocidas en imágenes base (mediante `docker scout` o `trivy` cuando estén disponibles).
2. **Revisión de versiones directas de plantillas:**
   - Revisar avisos de obsolescencia o cambios mayores en dependencias clave (`react`, `react-dom`, `vite`, `eslint`, `typescript`, `express`, `drizzle-orm`, `@libsql/client`, `pg`, `i18next`, etc.).
   - Contrastar con las versiones resueltas por npm y evaluar si procede actualizar las versiones exactas fijadas en las plantillas.
3. **Auditoría de seguridad (`npm audit`):**
   - Ejecutar `npm audit --audit-level=moderate` en cada plantilla y en el CLI. Verificar que no aparezcan vulnerabilidades nuevas sin mitigar.
4. **Verificación completa del arnés (`verify:generated`):**
   - Ejecutar la batería de verificación sobre las 32 variantes verificadas para comprobar que las dependencias compilan, arrancan y pasan los tests e integración antes de publicar o confirmar la actualización.

---

## 8. Reglas de validación del CLI (propuesta)

Se rechaza con mensaje claro y no se fuerzan valores en silencio (PROJECT_VISION §6). Las opciones que no aplican a una modalidad hoy se ignoran en silencio [I]: las dependencias nuevas necesitan un patrón distinto.

- Autenticación requiere backend y base de datos.
- Bearer en fullstack: según INV-03.
- RBAC requiere autenticación.
- Multitenancy requiere PostgreSQL y **autenticación o identidad externa verificada** (esta última, según la decisión de T-014-0). SQLite se rechaza. **No requiere RBAC.**
- Vistas de autenticación requieren aplicación completa y autenticación.
- Panel de administración requiere aplicación completa y RBAC.

## 9. Fuera del alcance de esta etapa

- MFA, OAuth/SSO, auditoría avanzada y SEO.
- Registro público y recuperación de contraseña (salvo que aparezca una razón importante).
- Multitenancy con SQLite.
- Administrador de plataforma entre organizaciones (propuesto).
- MongoDB: descartado en esta etapa; no forma parte del roadmap. PostgreSQL y SQLite siguen siendo las bases de datos (D-012).
- Integración con proveedores de identidad externos (solo se define el contrato).

## 10. Lo que Brixa no promete

- Protección distribuida contra abuso con contadores locales.
- TLS, que lo termina el despliegue.
- IP real detrás de un CDN o de varios proxies.
- Aislamiento de código, tablas, vistas, tareas o cachés que el desarrollador añada sin usar los mecanismos generados.
- Seguridad de credenciales sin HTTPS.
- Cumplimiento normativo.
- Que una vista o el panel estén verificados en navegador real mientras no existan esas pruebas.

## 11. Cuestiones abiertas de la etapa

Para decisión del responsable (con valor por defecto cuando se propone uno):

1. **Identidad externa en T-014c.** Resuelta por D-100: Auth v1 opera únicamente con identidad interna propia de Brixa; proveedores externos (OAuth, OIDC, SSO) quedan fuera de alcance en v1 manteniendo desacoplamiento arquitectónico para extensiones futuras.
2. **Administrador de plataforma entre organizaciones.** Resuelta por D-084 y D-085: administración de plataforma estrictamente separada de la organizacional, sin acceso global automático a datos de organizaciones ni bypass genérico de RLS; aprovisionamiento local seguro sin panel global en v1.
3. **Propiedades desconocidas en validación** (descartar o rechazar). Tras INV-02.
4. **Router, estilos y pruebas del frontend.** Resuelta en arquitectura de Router por D-090 (P-010): React Router declarativo condicionado a fullstack con Auth, 4 estados explícitos de sesión, rutas protegidas solo para navegación/UX y accesibilidad obligatoria; estilos y pruebas específicas pendientes de INV-05a e INV-06 (P-017).
5. **Versión de `package.json` en `main`** tras el tag (P-016). Por defecto: versión de preparación.
6. **T-013e.** Asignación resuelta en D-052. La implementación de N1–N7 queda pendiente en T-013e.
7. **Relación con la decisión de validar `DATABASE_URL` sin que el servidor lo importe.** Tras INV-02.
8. **Orden entre composición y seguridad base.** Este archivo ordena T-017a antes de T-017b; la propuesta v3 propone endurecer antes. ¿Se adelantan solo las partes que no tocan archivos compartidos (`redact` en los overlays de base de datos, `nginx.conf`)?
9. **Multitenancy con SQLite.** Resuelta por D-064 y ratificada en D-094: SQLite queda terminantemente excluido de multitenancy en esta etapa.
10. **Estados de la concesión de acceso y alcances de la primera versión.** Resuelta por D-080 a D-083 (P-011): ciclo de vida con `revoked_at` definitivo sin `isActive` universal, unicidad parcial en PostgreSQL (`WHERE revoked_at IS NULL`), alcances de aplicación y organización, y multitenancy sin roles fijos `owner/member`.
11. **Reproducibilidad de las plantillas** (P-008) tras las versiones resueltas de T-020.
12. **Protección de tags `v*`** en el repositorio (cambio de configuración no autorizado en T-019).
13. **Parámetros de sesión, Argon2id, CSRF, RLS, auditoría, delegación y activación.** Resueltas por D-099 a D-107: inactividad 30m, duración 12h, umbral diferido 60s (D-101); límites PHC y limitador 2/8 (D-102); CSRF multicapa sin synchronizer en same-origin (D-103); migraciones RLS SQL versionadas (D-104); auditoría de dos ámbitos (D-105); reglas de delegación, protección del último admin y no abandono voluntario (D-106); aprovisionamiento administrado y activación segura sin SMTP (D-107).

Dependen de evidencia (no se deciden antes): versión de Zod, almacén de contadores de abuso, comprobación de soporte de sintaxis RLS en Drizzle Kit fijado sobre PostgreSQL real (asignada a T-014c), y parametrización configurable de la duración exacta del token de activación (asignada a T-014a).

## 12. Regla de actualización

Al completar una tarea: actualizar su estado y su aprobación, registrar las verificaciones ejecutadas y las limitaciones pendientes, actualizar las tareas dependientes y registrar en `DECISIONS.md` las decisiones aprobadas. No marcar como completada una tarea que solo tenga parte de sus criterios.

## 13. Correspondencia con la propuesta de revisión v3 (IDs provisionales)

| ID provisional (v3) | Equivale a | Nota |
|---|---|---|
| TP-01 (tag y Release) | T-019 | COMPLETADA |
| TP-02 (pruebas puntuales) | T-020 | Las pruebas P1–P6 de la v3 son las pruebas 1–6 de T-020 |
| TP-03 (higiene documental) | T-021 | En progreso con esta actualización |
| TP-04 (publicación npm) | T-015 de `TASKS.md` | Bloqueada por el ticket |
| TP-05 (redacción central) | T-017b | Parte del alcance aprobado |
| TP-06 (Zod) | T-017b | D-061 |
| TP-07 (Nginx y `trust proxy`) | T-017b | Verificar contra el archivo actual |
| TP-08 (reproducibilidad) | P-008 | Decisión; se informa con T-020 |
| TP-09 (Argon2 y PHC) | INV-07 | COMPLETADA (resuelta P-009 en D-091 a D-093) |
| TP-10 (piloto TS→JS) | INV-08 / T-023 | Piloto completado en INV-08; decisión P-013 aprobada en D-098; tarea de implementación T-023 creada |
| TP-11 (composición) | T-017a y T-017a-ui | |
| TP-12 (OpenAPI y Express 5.3.0) | T-020, prueba 4 | Diseño posterior dentro de T-017a |
| TP-13 (modelo de amenazas) | T-014-0 | |
| TP-14 (cobertura por pares) | T-020, prueba 6; T-018 | Control automático previsto en T-018, todavía pendiente |
| TP-15 (auth, RBAC, multi-org) | T-014a a T-014d | |
| (no figuraba en la v3) | T-018 | Aprobada en alcance el 2026-11-04; infraestructura de `verify:security` |
| DP-04 … DP-17 | P-014, P-015, P-008, P-012, P-013 (D-098), P-009, P-010, P-011, P-017, P-016 | Ver `DECISIONS.md` |
