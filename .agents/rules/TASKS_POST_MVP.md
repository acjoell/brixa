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

| Elemento | Estado a 2026-11-07 | Depende de |
|---|---|---|
| T-019 | COMPLETADA | — |
| T-020 | PENDIENTE | T-019 |
| T-021 | EN PROGRESO | T-019 (parcialmente T-020 para cifras) |
| INV-01 a INV-06 (incluidas 04a, 04b, 05a y 05b) | Ejecutadas por Antigravity; resultados reportados. Ver sección 5 | — |
| INV-07 | PENDIENTE | — |
| INV-08 | PENDIENTE | T-020 (versiones resueltas), decisión P-013 |
| T-014-0 | BLOQUEADA | Decisiones de INV-03, INV-04a, INV-04b e INV-05b; P-011 |
| T-017a | BLOQUEADA | Decisiones P-012 y P-013 (T-019 e INV-05a/05b ya hechas) |
| T-017a-ui | BLOQUEADA | T-017a, INV-03 (router) |
| T-017b | BLOQUEADA | T-017a, INV-02; ver cuestión abierta 8 |
| T-018 | BLOQUEADA | T-017b, INV-06 |
| T-014a | BLOQUEADA | T-014-0, T-017b, T-018, INV-01, INV-03, INV-07 |
| T-014a-ui | BLOQUEADA | T-014a, T-017a-ui |
| T-014b1 | BLOQUEADA | T-014a, T-014-0, T-018 |
| T-014b2 | BLOQUEADA | T-014b1, T-014a-ui |
| T-014c | BLOQUEADA | T-014a, T-014-0, T-018, INV-04a |
| T-014d | BLOQUEADA | T-014b1, T-014c |

**Orden de ejecución propuesto (actualizado):**

T-019 ✔ → T-020 y T-021 (en paralelo, sin tocar código) → decisiones P-008, P-012 y P-013 con la evidencia de T-020, INV-07 e INV-08 → T-017a → T-017a-ui → T-017b → T-018 → T-014-0 (puede adelantarse: es diseño sin código) → T-014a → T-014a-ui → T-014b1 → T-014b2 → T-014c → T-014d.

- T-014c y T-014b1 no dependen entre sí. El orden lineal es de conveniencia, no una restricción técnica.
- La decisión de estrategia JavaScript/TypeScript (INV-05b) debe tomarse **antes** de T-017a: si JavaScript se deriva de TypeScript, la composición se implementa una sola vez.
- **Diferencia con la propuesta v3:** la v3 ordena el endurecimiento del backend (redacción, Zod, Nginx) antes de las decisiones de composición. Este archivo mantiene composición antes de seguridad base porque la composición actual reemplaza `app`, `index` y `tsconfig` completos [INSP]: añadir Zod o redacción antes obligaría a repetir el cambio en cada overlay que reemplaza esos archivos. Las partes que no tocan archivos compartidos (por ejemplo, extraer `redact` de los cuatro overlays de base de datos o endurecer `nginx.conf`) podrían adelantarse. Es una decisión pendiente (cuestión abierta 8).

---

## 5. Investigaciones

Cada ficha indica qué pregunta resuelve, qué condiciona, qué evidencia debe entregar Antigravity, si requiere ejecutar proyectos temporales y qué decisión permite.

**Estado a 2026-11-07:** INV-01 a INV-06 fueron ejecutadas y entregaron informes y anexos. Sus resultados son **reportados**, no reproducidos. Los informes originales de INV-01, 02, 03, 04a, 05a, 05b y 06 no estaban disponibles en la revisión de la propuesta v3 (solo anexos y complementos). La tabla siguiente conserva la ficha original; el seguimiento está después de ella.

| ID | Pregunta | Condiciona | Evidencia que debe entregar | Ejecución temporal | Decisión que permite |
|---|---|---|---|---|---|
| INV-05a | ¿Qué mecanismo mínimo permite que varias capacidades modifiquen los mismos archivos del backend y del frontend? | T-017a, T-017a-ui | Inventario real de overlays y archivos compartidos; prototipos por archivo con casos negativos; coste | Sí | Estrategia de composición por archivo |
| INV-05b | ¿Cómo se mantienen JavaScript y TypeScript con el volumen futuro sin reducir JavaScript? | T-017a, T-014-0 | Métricas de duplicación; comparación de dos o tres enfoques sobre módulos reales con diffs | Sí | Estrategia JS/TS |
| INV-04a | ¿Se puede garantizar aislamiento con RLS, roles y contexto por transacción en el stack fijado? | T-014-0, T-014c | Pruebas negativas reproducibles en PostgreSQL; soporte de Drizzle; fugas indirectas; consulta de auditoría | Sí (PostgreSQL) | Modelo de roles de base de datos y contexto por transacción |
| INV-04b | ¿Qué modelo de identidad y organización conviene y cómo viaja el contexto del actor? | T-014-0, T-014b1, T-014c | Esquemas comparados, pruebas de inicio de sesión y cambio de organización, comparación de paso explícito frente a `AsyncLocalStorage`, catálogo de permisos | Sí (PostgreSQL) | Modelo de identidad, forma del contexto, catálogo persistido o no |
| INV-01 | ¿Qué hash resiste carga real sin agotar memoria? | T-014a | Disponibilidad por versión de Node, parámetros de OWASP citados, mediciones con servidor real y límites de contenedor | Sí | Algoritmo y parámetros |
| INV-03 | ¿Credencial opaca o JWT? ¿Bearer seguro en fullstack? ¿CSRF y cookies en cada topología? | T-014-0, T-014a, T-017a-ui | Fuentes oficiales, prototipos, matriz de compatibilidad, opciones de router con peso medido | Sí | Tipo de credencial, renovación, matriz de soporte, CSRF, router |
| INV-02 | ¿Qué Zod, cómo validar y dónde guardar, qué cabeceras y CORS, y qué almacén de abuso es sostenible? | T-017b, T-014a | Pruebas con Express 5, errores reales de Zod, cabeceras y CORS, concurrencia y contención de contadores | Sí | Versión de Zod, política de propiedades, cabeceras, almacén de contadores |
| INV-06 | ¿Cómo se construye un arnés de mutaciones sostenible y cómo se prueba el frontend? | T-018, T-014a-ui | Análisis del arnés actual, prototipo de mutaciones, presupuesto de CI, opciones de pruebas de componentes | Sí | Diseño de `verify:security`, nombres de scripts, pruebas del frontend |
| INV-07 | ¿`crypto.argon2` es estable en cada versión del rango de Node admitido? ¿Qué formato PHC produce o consume la alternativa externa? | T-014a | Páginas oficiales de Node por versión (con URL y fecha), especificación PHC, salida real de la librería candidata | Ligera | Hash: API nativa con `engines` propio o librería externa |
| INV-08 | ¿Se puede derivar JavaScript de TypeScript con diffs legibles y sin dependencias frágiles? | T-017a | Piloto sobre un overlay (por ejemplo base de datos), comparación contra el JavaScript existente, `check:sync`, lint del JavaScript derivado | Sí | Estrategia JS/TS |

### Seguimiento tras las investigaciones ejecutadas

| ID | Qué queda abierto |
|---|---|
| INV-05a | Compose: fusión estructurada o composición nativa (sin versión mínima de Compose verificada). OpenAPI: el test actual depende de `app.router.stack` de Express 5.3.0 y la prueba de subrouters sigue pendiente (T-020, prueba 4). El informe usó Express 4 en parte de sus pruebas: esos resultados no aplican. Su propuesta de `en.json` siempre presente contradice D-052 y no se adopta por defecto |
| INV-05b | Piloto (INV-08). `ts-blank-space` 0.6 exige TypeScript 5.1–5.7 y el CLI usa 6.0.3. El postprocesado de imports por expresiones regulares es frágil; evaluar AST. Prueba hecha con Drizzle 0.45.1 (la plantilla usa 0.45.4) |
| INV-04a | Soporte de políticas RLS y roles en Drizzle 0.45.x y Drizzle Kit 0.31.x sin comprobar. Probado con `postgres:17.4-alpine`, que coincide con la imagen que generan las plantillas |
| INV-04b | Corregir al adoptarlo: no usar `is_active` universal; «membresía» pasa a «concesión de acceso» (D-063); las políticas RLS necesitan `NULLIF(...)::uuid` (INV-04a). Falta el diagrama de flujo del informe |
| INV-01 | INV-07. `engines.node` admite 24.0–24.6, donde la API no existe. PHC con Base64URL sin corregir. Benchmarks en un único host Linux x64 |
| INV-03 | Solo se dispone del complemento INV-03b (Chromium 156, Firefox 157; Safari no verificado). React Router no está instalado en Brixa [INSP]: sus conclusiones de accesibilidad aplican al router que se elija |
| INV-02 | Versión de Zod sin fuente registrada. La fuga de credenciales de `@libsql/client` depende de qué URLs acepta el cliente de la plantilla (T-020, prueba 3). Las versiones de `pg` y `@libsql/client` de las plantillas coinciden con las usadas en el anexo |
| INV-06 | Decisión de D-062 (caché compartida, instalaciones independientes, symlinks aplazados). La reutilización por symlink y el motor de mutaciones están sin verificar en Windows y macOS |

Orden recomendado para las investigaciones restantes: INV-07 e INV-08. Las demás ya están ejecutadas.

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

Calculada con una comprobación por pares: con estas 7 variantes quedan cubiertos los **82 pares válidos** entre las siete dimensiones (modalidad, lenguaje, base de datos, transporte, RBAC, multitenancy, Docker), con dos restricciones: multitenancy exige PostgreSQL y fullstack con Bearer queda excluido hasta ver INV-03.

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
- **Si INV-03 admite Bearer en fullstack**, se añade una variante fullstack con Bearer y se recalcula la cobertura.
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

**Hecho en esta actualización:** `TASKS.md` (T-013, T-014, T-015, referencias); este archivo; `DECISIONS.md` (D-060 a D-065, P-008 a P-017, correcciones de D-047, D-049, D-052 y D-059, sección 5; 34 → 32 variantes).
**Pendiente:** `SECURITY.md` (quitar la referencia a `carWashId`; reflejar los límites reales de RLS, de las colas locales y del rate limiting en memoria; distinguir PostgreSQL de SQLite; indicar que hoy no existe redacción central), `ARCHITECTURE.md` (composición actual frente a la objetivo; contexto explícito del actor si se aprueba), `CODE_STANDARDS.md` (dependencias declaradas directamente; duplicación aceptada solo con motivo), `ROADMAP.md` (endurecimiento y composición antes de autenticación), `README.md` (`npx brixa` aún no funciona; coherencia de cifras), `PROJECT_VISION.md` (§10 con pendientes ya resueltas), `AGENTS.md` y `CLAUDE.md` (quitar «el proyecto comienza desde cero» y el nombre Foundry).
**Criterios de aceptación:** ningún documento contradice a `DECISIONS.md` en cifras, nombre, versiones o estado de la publicación.

---

### T-014-0 — Diseño del modelo de identidad, organización y contexto

**Estado:** BLOQUEADA (por las decisiones que dependen de INV-03, INV-04a, INV-04b e INV-05b, ya ejecutadas, y por P-011)
**Aprobación:** Aprobado (alcance como tarea de diseño previa a las capacidades). Su contenido depende de evidencia.
**Dependencias:** INV-03, INV-04a, INV-04b, INV-05b (resultados reportados) y P-011.

**Objetivo:** cerrar por escrito las decisiones estructurales que, tomadas tarde, obligarían a rehacer plantillas. Brixa genera proyectos nuevos (D-005): el riesgo no es migrar datos de usuarios, sino rehacer el código de las plantillas.

**Alcance (sin código):**
- Usuarios, organizaciones y **concesiones de acceso** (D-063): cardinalidad. Sin suscripciones, planes ni jerarquías empresariales obligatorias.
- **Estados de la concesión** (borrado de la fila, `revoked_at` o estado explícito; sin `isActive` universal) y **alcances** (sistema y organización en la primera versión; unidad o recurso solo si se decide), P-011.
- Concesión de acceso básica cuando RBAC no está activo (INV-04b propuso roles fijos de propietario y miembro: es una propuesta, no una decisión) y su integración con roles y permisos por organización cuando sí lo está. Con multitenancy, los roles se asignan a la concesión de acceso y no al usuario global (propuesta de INV-04b).
- **Primer administrador:** script dentro del proyecto generado, sin credenciales por defecto y sin depender del CLI de Brixa; en TypeScript con Docker de producción debe poder ejecutarse como JavaScript compilado (propuesta, pendiente).
- **Forma única o variante del esquema** con y sin RBAC y con y sin multitenancy: se decide si las tablas de roles llevan siempre un ámbito de organización opcional o si hay variantes (cada variante multiplica los archivos de esquema, ver T-014a).
- Organización activa y su relación con la credencial.
- Tablas globales frente a tablas con alcance. El inicio de sesión busca al usuario antes de conocer la organización.
- **Identidad externa verificada.** El responsable estableció que multitenancy requiere «autenticación o una identidad externa verificada». Se define el contrato (una función que resuelve al actor verificado) y se decide si T-014c lo implementa en esta etapa (ver «Cuestiones abiertas»).
- Contexto de ejecución (actor, organización, transacción): forma elegida según INV-04b.
- Catálogo de permisos persistido o servido desde el código.
- Estrategia JavaScript/TypeScript, según INV-05b.
- Reglas de validación del CLI (sección 8).
- Actualización del modelo de amenazas con un control asignado a cada amenaza.

**Áreas afectadas:** ninguna de código. Producto: documento de diseño y propuestas de decisión.

**Criterios de aceptación:**
- Cada pregunta del alcance tiene respuesta con referencia a la evidencia de su investigación.
- Existe la lista de tablas globales y con alcance para cada combinación de capacidades.
- Cada amenaza del modelo tiene al menos un control y una prueba negativa asignados.
- Las decisiones salen como propuestas para aprobación.

**Pruebas positivas / negativas:** no aplican. **Verificaciones:** revisión cruzada del modelo de amenazas contra los casos de SECURITY §11.

**Riesgos:** diseñar sin evidencia suficiente (por ejemplo, soporte de RLS en el Drizzle fijado). Si falta evidencia, la tarea no se cierra.

---

### T-017a — Composición de overlays: backend

**Estado:** BLOQUEADA (por las decisiones P-012 y P-013; T-019 y las investigaciones INV-05a e INV-05b ya están hechas)
**Aprobación:** Aprobado (alcance). Mecanismo concreto pendiente de decisión.
**Dependencias:** P-012, P-013, resultados de T-020.

**Objetivo:** permitir que varias capacidades modifiquen los mismos archivos sin pisarse, con el mecanismo más simple que funcione. No es un sistema universal.

**Alcance:** estrategia específica por archivo, cada una por confirmar con INV-05a.

| Archivo | Estrategia propuesta |
|---|---|
| `app` e `index` | Puntos de inserción con orden semántico (por ejemplo: importaciones, preparación, rutas, manejo de errores) y regla de orden entre contribuciones del mismo punto |
| `tsconfig` | Combinación estructurada de JSON con detección de conflictos (comprobar antes si admite comentarios) |
| `openapi.json` | Combinación de rutas y componentes con detección de colisiones |
| `compose.yaml` | Composición de servicios (estructurada o textual: por decidir con evidencia) |
| `.env.example` | Contribuciones ordenadas sin duplicados |
| `package.json` | La fusión actual por secciones conserva el valor de la base y descarta el del overlay sin avisar [INSP]: pasar a detectar y comunicar el conflicto. Además, las dependencias de API Docs están duplicadas entre archivos de plantilla y el generador, y las de i18n están definidas en el generador [INSP]: una única fuente |
| `compose.yaml` (estado actual) | Hoy se copia entero y API Docs añade configuración por sustitución de texto [INSP] |

**Áreas afectadas:** **[L]** plantillas backend (`src/templates/backend-express-ts`, `backend-express-js`) y sus `app`/`index`; overlay `api-docs` (ts y js) con `app`, `index`, `tsconfig.json` y `docs/openapi.json`; overlay `docker` (`compose.*.yaml`); `.env.example` de las plantillas backend; `src/generator/generate.test.ts`. **[I]** `src/generator/generate.ts` (copia, fusión de `package.json`, funciones de añadido de `.env.example` y README), `scripts/verify-generated.js`, `src/verified-variants.ts`.

**Criterios de aceptación:**
- Orden determinista: la misma entrada produce la misma salida, byte a byte.
- Un punto de inserción sin contribuyente se elimina sin dejar rastro.
- Un marcador sin resolver en la salida hace fallar una prueba.
- Una contribución duplicada o una colisión de claves produce un error que nombra a los contribuyentes.
- El overlay `api-docs` deja de reemplazar `app` e `index`.
- Las 32 variantes verificadas generan un árbol idéntico al anterior a la tarea y `verify:generated` da el mismo resultado.

**Pruebas positivas:** composición de los subconjuntos de overlays existentes (documentación, base de datos, Docker) con lint, tipos y tests en verde.
**Pruebas negativas:** dos contribuciones con la misma clave; punto de inserción inexistente; JSON inválido en una contribución; contribución que viola el orden declarado; permutar el orden de entrada no cambia el resultado.
**Verificaciones:** `typecheck`, `lint`, `format:check`, `test`, `build` y `verify:generated` completo.

**Estado real [INSP]:** copia recursiva; sin slots; el overlay de API Docs reemplaza `src/app`, `src/index` y `tsconfig.json`. El test de documentación depende de `app.router.stack`, un detalle interno de Express 5.3.0 (T-020, prueba 4); la alternativa es un registro declarativo de rutas.

**Riesgos y limitaciones:** un orden semántico mal definido es peor que no tenerlo. Las contribuciones dependientes entre sí (documentación protegida por autenticación) necesitan su orden declarado. Sin AST ni motor de plantillas, salvo evidencia contraria.

---

### T-017a-ui — Composición de overlays: frontend

**Estado:** BLOQUEADA (por T-017a y por la decisión del router, P-010)
**Aprobación:** Aprobado (alcance).
**Dependencias:** T-017a, INV-03 (decisión del router).

**Objetivo:** que las vistas de autenticación y el panel convivan con i18n y con el proxy de la aplicación completa.

**Alcance:**
- Composición de `App` y `main` para proveedores y, si INV-03 lo recomienda, router (React Router no está instalado en Brixa [INSP]). El overlay de i18n los reemplaza hoy [INSP].
- Sin i18n no se añaden archivos de traducción: la propuesta de INV-05a de generar siempre `en.json` contradice D-052 («sin cambiar la generación de quien no la selecciona») y no se adopta salvo decisión expresa.
- Combinación de archivos de traducción por clave, sin sobrescritura silenciosa.
- Composición del overlay de `vite.config` de la aplicación completa.

**Áreas afectadas:** **[L]** `src/templates/frontend-react-ts` y `frontend-react-js` (`App`, `main`), `src/templates/i18n/{ts,js}` (`App`, `main`, `locales/en.json`, `locales/es.json`), `src/templates/fullstack/vite.config.{ts,js}`.

**Criterios de aceptación:** los de T-017a aplicados al frontend. Las variantes con i18n verificadas hoy siguen pasando `check:i18n`, el renderizado por idioma y la persistencia.
**Pruebas negativas:** clave de traducción duplicada con valores distintos; idioma con claves faltantes tras la composición; marcador sin resolver.
**Pruebas positivas / verificaciones:** igual que T-017a, más las variantes con i18n.

**Riesgos:** T-014a-ui queda bloqueada si esta tarea no está completa.

---

### T-017b — Seguridad base y Zod

**Estado:** BLOQUEADA (por T-017a e INV-02; ver cuestión abierta 8 sobre el orden)
**Aprobación:** Aprobado (alcance: Zod obligatorio en todo proyecto con backend; configuración central; validación; contrato de errores; protección general; cabeceras, CORS, `trust proxy` y límites como parte de la seguridad base). La implementación de cada control queda pendiente de evidencia.
**Dependencias:** T-017a, INV-02.

**Objetivo:** que todo backend generado tenga configuración validada, validación reutilizable de entradas, errores uniformes y las protecciones mínimas por defecto.

**Alcance aprobado:**
- Zod como dependencia obligatoria, usada desde el inicio para validar la configuración central del servidor. No es una dependencia sin uso.
- Validación de variables de entorno al arrancar, con mensajes comprensibles que no revelan valores.
- Validación reutilizable de `body`, `params` y `query`, con errores 400 uniformes.
- Esquemas junto a cada módulo funcional. Sin carpetas ni esquemas vacíos.
- Tipos inferidos en TypeScript y validación en ejecución en JavaScript.
- **Contrato de errores:** un error con estado 4xx conserva su código (400, 401, 403, 404, 413), con cuerpo JSON uniforme y mensajes fijos; 404 en JSON para rutas no registradas; 500 genérico sin detalles. Hoy todo error se devuelve como 500 y el 404 devuelve HTML **[I]**; es prerrequisito de autenticación y RBAC.
- Cabeceras de seguridad, CORS (denegado por defecto), `trust proxy` por topología y límites de cuerpo.
- Redacción de datos sensibles en registros y errores. Estado real [INSP]: `redact` existe en cuatro copias (overlays de PostgreSQL y SQLite, JS y TS), se usa solo en el `catch` de los migradores, y el manejador global de errores ejecuta `console.error(err)` sin redacción. Se extrae a un único punto y se aplica también al manejador global. La deuda de T-012a (comprobar que el test ejecuta la función real) se resuelve aquí o como tarea propia; T-020 comprueba primero si usa una copia.
- Zod no está instalado en las plantillas ni en el CLI [INSP] (D-061): esta tarea lo incorpora.
- Protección general de la API (nivel 1 de abuso).

**Pendiente de evidencia (INV-02):** versión de Zod (INV-02 estudió 4.6.7 sin fuente registrada); una cadena vacía no debe convertirse en 0 (`z.coerce.number()` con `PORT=""`); configuración de Nginx (`server_tokens`, resolución del upstream al arrancar, herencia de `add_header`) y `trust proxy` por topología, verificadas contra el archivo actual; comportamiento de `req.query` en Express 5 y dónde guardar los datos validados; política de propiedades desconocidas (descartar o rechazar); cómo evitar filtrar datos en errores de Zod; cabeceras nativas frente a biblioteca; biblioteca de CORS; almacén de contadores.
**Pendiente de decisión:** relación con la decisión que hoy valida `DATABASE_URL` al importar el cliente de base de datos sin que el servidor lo importe (D-038). Propiedades desconocidas (SECURITY §6).

**Protección contra abuso (tres niveles):**
1. General de API: en esta tarea.
2. Específica de autenticación: en T-014a.
3. Endpoints sensibles: con las capacidades que los crean.

El almacén de contadores **no está decidido**. No se acepta la base de datos del proyecto como almacén hasta evaluar concurrencia, atomicidad, contención en SQLite y bloqueo malicioso de cuentas. No se aceptan bloqueos permanentes de cuentas.

**Áreas afectadas:** **[L]** `src/templates/backend-express-{ts,js}` (`src/app`, `src/index`, `tests/health.test`, `package.json`, `.env.example`, `README.md`), overlay `api-docs`, `src/templates/docker/fullstack/frontend/nginx.conf`, `compose.*.yaml`. **[I]** generador y arnés. Nuevos módulos: por determinar.

**Criterios de aceptación:**
- Una variable obligatoria ausente o mal formada impide arrancar, con mensaje claro sin valores.
- Una entrada inválida produce el mismo formato 400 en `body`, `params` y `query`.
- Un error con estado 401, 403, 404 o 413 conserva su código; ninguno devuelve pila, valores recibidos ni `err.message`.
- No existen archivos de esquema vacíos en ninguna variante.
- La documentación declara con precisión qué cubre la limitación de peticiones (una instancia, varias, detrás de proxy).

**Pruebas positivas:** configuración válida arranca; entradas válidas pasan; los tipos inferidos compilan en TypeScript; paridad ts y js.
**Pruebas negativas:** variable faltante, vacía o mal formada (`PORT=""` no produce el puerto 0); propiedad desconocida según la política elegida; campos no permitidos; ráfaga que supera el límite; origen no permitido en CORS y preflight; error con cadena de conexión en el mensaje sin que salga por la respuesta ni por el registro.
**Verificaciones:** batería local, `verify:generated` completo y `npm audit --audit-level=moderate`. Sin variantes nuevas: estas pruebas viven en las plantillas.

**Riesgos y limitaciones:** un límite en memoria no se comparte entre instancias y se reinicia con el proceso; sin `trust proxy` correcto todos los clientes comparten una IP. El cambio altera el comportamiento de los proyectos generados: implica una versión nueva.

---

### T-018 — Infraestructura de verificación avanzada

**Estado:** BLOQUEADA (por T-017b e INV-06)
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

**Deuda relacionada:** D-052 cita una tarea T-013e que no existe en `TASKS.md` (la inspección y la revisión no la encontraron); los controles negativos de i18n se ejecutaron una vez y no son repetibles. Se decide si se abre T-013e o si T-018 absorbe el trabajo.

**Áreas afectadas:** **[I]** `scripts/verify-generated.js`, `src/verified-variants.ts` y su test; **[L]** `package.json` del CLI (scripts); `.github/workflows/ci.yml`. Nuevos archivos del arnés: por determinar.

**Criterios de aceptación:**
- Una mutación deliberada hace fallar `verify:security`; una mutación que no se aplica o se aplica dos veces también falla el arnés.
- El piloto cubre al menos una variante backend TypeScript, una backend JavaScript y una fullstack.
- La CI ejecuta lo que corresponde a cada tipo de cambio, y una publicación exige `verify:all`.
- Las mutaciones no aparecen en ningún proyecto generado.

**Pruebas positivas:** línea base sin mutación pasa. **Pruebas negativas:** mutación sin efecto, mutación doble y mutación cuyo texto desapareció de la plantilla.
**Verificaciones:** batería local, `verify:generated` completo y `verify:security` piloto.

**Riesgos:** mutaciones frágiles frente a cambios de plantilla; coste de minutos de CI.

---

### T-014a — Autenticación seleccionable

**Estado:** BLOQUEADA (por T-014-0, T-017b, T-018 e INV-07)
**Aprobación:** Aprobado (dos opciones en el CLI, núcleo común, no se generan ambas por defecto). Detalles técnicos pendientes de evidencia.
**Dependencias:** T-014-0, T-017b, T-018, INV-01 e INV-03 (resultados reportados), INV-07.

**Objetivo:** cuentas y credenciales funcionales y verificadas, con una modalidad elegida por proyecto.

**Opciones en el CLI:** **A.** sesiones mediante cookies. **B.** autenticación mediante tokens Bearer.

**Alcance común:**
- Núcleo de identidad y gestión de cuentas compartido; sin duplicar tablas de usuarios ni la lógica de cuentas.
- Credencial opaca almacenada por huella frente a JWT: **no decidido** (INV-03). Bearer y JWT son conceptos distintos.
- Hash de contraseñas: **no decidido** (INV-01, INV-07; P-009). `crypto.argon2` existe desde Node 24.7.0 y `engines.node` admite `^24.0.0`; con `@types/node` 26.x el type-check no detectaría el uso en una versión anterior. Si se elige la API nativa, el proyecto generado necesita su propio `engines` y tipos alineados. No llamar «PHC» a un formato con Base64URL sin aclararlo.
- Renovación o refresh: pendiente de evidencia.
- CSRF y atributo `Secure` de las cookies según las tres topologías reales: pendiente de evidencia.
- Límite de intentos de autenticación sin bloqueo permanente de cuentas (nivel 2 de abuso).
- Mensajes de error que no revelan si una cuenta existe.
- A decidir en T-014-0: cambio de contraseña, primera cuenta administradora sin credenciales por defecto, creación de usuarios sin registro público, listado y cierre de sesiones, desactivación y reactivación de cuentas, normalización de identificadores, limpieza de credenciales caducadas, caducidad absoluta o por inactividad.
- Protección de la documentación de API cuando está activa.
- Bearer en fullstack: no se descarta ni se admite hasta ver la matriz de INV-03.

**Fuera de alcance:** registro público y recuperación de contraseña (salvo que aparezca una razón importante), MFA y OAuth/SSO.

**Matriz de compatibilidad (modalidad × backend/fullstack × cliente):** la entrega INV-03; define qué combinaciones se soportan inicialmente.

**Áreas afectadas:** **[I]** pregunta y validación del CLI (`src/prompts/questions.ts`, `src/validation/options.ts`, `src/types.ts`), generador, `src/verified-variants.ts`, arnés. **[L]** plantillas backend, overlays de base de datos (cuatro archivos de esquema por tabla: dos motores por dos lenguajes). Rutas nuevas: por determinar.

**Criterios de aceptación:**
- Alta, inicio y cierre de sesión funcionan en cada combinación declarada soportada.
- Credenciales no almacenadas en texto plano (ni la credencial de sesión ni las contraseñas).
- Revocación efectiva en la petición siguiente.
- Ninguna credencial ni secreto en el proyecto generado; secretos obligatorios validados al arrancar.

**Pruebas positivas:** flujo completo en cada modalidad; renovación según la decisión; cierre de sesión.
**Pruebas negativas (SECURITY §11):** no autenticado accede a recurso protegido; credencial caducada, revocada o manipulada; usuario deshabilitado con credencial viva; enumeración de cuentas por mensaje o por tiempo; fuerza bruta con respuesta 429 y **recuperación del acceso tras la espera** (sin bloqueo permanente); solicitud entre orígenes sin CSRF (cookie); credencial anterior tras cambio de contraseña; la credencial en reposo no aparece en la base de datos en claro; contraseña por encima del máximo rechazada; campos como `role` o `isActive` enviados por el cliente sin efecto; ninguna respuesta ni registro contiene hashes o secretos.
**Verificaciones:** batería local, `verify:generated` y `verify:security` en las variantes de la sección 6.3 que incluyan autenticación.

**Riesgos y limitaciones (reportado en INV-03b):** los navegadores no aíslan cookies por puerto en `localhost`, así que dos proyectos con el mismo nombre de cookie se pisan; `__Host-` exige `Secure`, `Path=/` y ausencia de `Domain`; Nginx no reescribe el `Path` de `Set-Cookie`; el refresh rotativo con peticiones simultáneas puede destruir la sesión; Safari no está verificado. La cookie `Secure` no se envía por HTTP fuera de `localhost` y los proyectos generados no terminan TLS; el comportamiento de cada navegador debe comprobarse. Un límite de intentos en memoria no se comparte entre instancias.

---

### T-014a-ui — Vistas de autenticación (aplicación completa)

**Estado:** BLOQUEADA (por T-014a y T-017a-ui)
**Aprobación:** Aprobado (vista de producto: componentes pequeños, presentación separada de la lógica, fáciles de personalizar). Router, estilos y pruebas del frontend, pendientes.
**Dependencias:** T-014a, T-017a-ui.

**Objetivo:** vistas funcionales, accesibles y fáciles de modificar. Solo en aplicación completa; en backend solo se generan los endpoints.

**Alcance:** inicio de sesión, formularios y componentes reutilizables, estado de autenticación, integración con el backend y navegación protegida **como mecanismo de experiencia de usuario** (no es una barrera de seguridad). Router, estilos e integración con i18n según INV-03, INV-05a e INV-06.

**Áreas afectadas:** **[L]** plantillas de frontend y overlay i18n. Rutas nuevas: por determinar.

**Criterios de aceptación:**
- Disponible en JavaScript y TypeScript.
- Con i18n activo, las vistas usan sus claves; sin i18n, texto fijo, sin duplicar vistas.
- Accesibilidad básica (CODE_STANDARDS §12): etiquetas, teclado, estados de error y carga.
- El acceso HTTP, el estado de autenticación y la presentación están en archivos separados; sin componentes que mezclen todo.

**Pruebas positivas:** inicio de sesión correcto; estado de autenticación tras recargar.
**Pruebas negativas:** credenciales inválidas con mensaje uniforme; acceso a una vista protegida sin sesión redirige; respuesta 401 del backend limpia el estado; en modalidad cookie no se guarda ninguna credencial en el almacenamiento accesible a JavaScript; sin `dangerouslySetInnerHTML`.
**Verificaciones:** compilación, lint y pruebas de componentes según la herramienta que se decida con INV-06. **Hoy no hay pruebas en navegador real y la plantilla de frontend no incluye pruebas**: sin ellas, el comportamiento visual solo puede declararse comprobado manualmente.

**Riesgos:** introducir un router y una herramienta de pruebas son dependencias nuevas en el frontend (hoy no hay router [INSP]); solo deben entrar cuando se eligen las vistas. Un router no resuelve por sí solo la accesibilidad (reportado en INV-03b): hay que programar la actualización de `document.title`, el foco al navegar y los anuncios de cambio de ruta, y no se afirma compatibilidad con lectores de pantalla sin pruebas reales.

---

### T-014b1 — Motor RBAC, API administrativa y auditoría mínima

**Estado:** BLOQUEADA (por T-014a, T-014-0 y T-018)
**Aprobación:** Aprobado (alcance).
**Dependencias:** T-014a, T-014-0, T-018.

**Objetivo:** autorización efectiva en el servidor, administrable sin interfaz.

**Alcance aprobado:**
- Motor de autorización.
- Catálogo declarativo de recursos y acciones. El desarrollador registra los módulos y acciones reales que implementa en el backend. El administrador no puede crear permisos arbitrarios.
- Endpoints administrativos y gestión de usuarios.
- Creación y edición de roles; asignación de permisos a roles y de roles a usuarios.
- Autorización invocable desde servicios y casos de uso, no solo desde middleware HTTP.
- Auditoría mínima: quién cambió roles, permisos y asignaciones.

**Pendiente de decisión (INV-04b ejecutada):** forma del contexto del actor y de la organización. INV-04b reportó 0 fugas en 200 tareas concurrentes con paso explícito y con `AsyncLocalStorage`, y recomienda el paso explícito (propuesta, no aprobada). Catálogo de permisos en el código y roles en la base de datos (propuesta de INV-04b). Con multitenancy, los roles se asignan a la concesión de acceso, no al usuario global.
**Propuesto:** regla «solo se otorgan permisos que se poseen»; prohibir editar el propio rol; invariante del último administrador comprobada dentro de una transacción con bloqueo; permisos leídos por petición, sin caché local entre instancias.
**Pendiente de decisión:** administrador de plataforma entre organizaciones (propuesto: excluido en esta etapa).

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

**Estado:** BLOQUEADA (por T-014a, T-014-0, T-018 e INV-04a)
**Aprobación:** Aprobado (alcance). **No depende de RBAC.**
**Dependencias:** T-014a, T-014-0, T-018, INV-04a.

**Objetivo:** aislamiento por organización en PostgreSQL con RLS. SQLite no tiene multitenancy en esta etapa.

**Requisitos de identidad:** autenticación de Brixa **o una identidad externa verificada**. Sin RBAC activo, concesión de acceso básica (D-063); los roles fijos de propietario y miembro son una propuesta de INV-04b, no una decisión. La integración con identidad externa depende de la decisión de T-014-0 (ver «Cuestiones abiertas»).

**Alcance a confirmar con INV-04a:**
- Rol propietario para migraciones y rol de ejecución sin privilegios ni `BYPASSRLS`.
- `FORCE ROW LEVEL SECURITY`.
- Contexto por transacción (`SET LOCAL` o `set_config`) compatible con pools de conexiones.
- Operaciones fuera de transacción: sin contexto, ninguna fila.
- Políticas y relaciones entre organizaciones.
- Hallazgos reportados en INV-04a que condicionan el diseño: el rol de la aplicación puede reescribir la variable de contexto si ejecuta SQL arbitrario; la política con columna `uuid` necesita `NULLIF(current_setting(...,true),'')::uuid`; `ALTER DEFAULT PRIVILEGES` exige `FOR ROLE` del propietario de las migraciones; una política `USING (true)` anula las demás; `COPY FROM` no se admite con RLS; `TRUNCATE`, las secuencias, las FK y UNIQUE simples y las vistas sin `security_invoker` no quedan aislados.
- Contrato de base de datos: hoy `db:migrate` y el cliente usan una sola `DATABASE_URL` (D-037, D-038). Con dos roles hará falta una segunda conexión para migraciones (inferencia).

**Entregables:**
1. Patrón reutilizable de acceso a datos.
2. Guía y ejemplo práctico probado (en documentación y pruebas, no como código de negocio ficticio).
3. Pruebas negativas reutilizables.
4. Auditoría estructural de tablas y políticas RLS que trabaja con un **registro explícito** de tablas con aislamiento. No descubre por sí sola qué tablas deben ser multiempresa.

**Áreas afectadas:** **[L]** overlay `database-postgres` (ts y js), `compose.postgres.yaml` y variante fullstack (roles de base de datos en el arranque del contenedor: por determinar). **[I]** CLI y generador. Rutas nuevas: por determinar.

**Criterios de aceptación:**
- La aplicación se conecta con un rol sin privilegios; una prueba falla si el rol es superusuario, propietario o tiene `BYPASSRLS`.
- Una tabla del registro sin RLS habilitado y forzado, o sin política, hace fallar la auditoría.
- Los controles negativos del arnés detectan la eliminación de una política y la conexión con un rol privilegiado.

**Pruebas positivas:** cada organización lee y escribe sus datos; cambio de organización activa con concesión de acceso válida.
**Pruebas negativas (SECURITY §11):** usuario de una organización lee, modifica o elimina datos de otra; envía un identificador de organización propio; asocia entidades de organizaciones distintas; consulta sin contexto; contexto residual tras reutilizar una conexión del pool; exportaciones y agregados; cambio a una organización sin concesión de acceso; concesión de acceso retirada.
**Verificaciones:** requieren PostgreSQL, por tanto el ámbito `full` (Linux). No se verifica en Windows ni macOS.

**Riesgos y limitaciones:** **RLS no protege frente a SQL arbitrario ni inyección SQL** (reportado en INV-04a e INV-04b): es defensa en profundidad contra filtros olvidados, y el servidor sigue siendo responsable de autenticar al actor, validar su acceso y establecer el contexto. El aislamiento solo cubre tablas registradas y el acceso que pasa por el patrón generado. Tareas en segundo plano, cachés, archivos y vistas del desarrollador quedan bajo su responsabilidad. En bases gestionadas, el desarrollador debe crear los dos roles. Soporte de políticas en el Drizzle fijado: sin comprobar.

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

1. **Identidad externa en T-014c.** ¿Se implementa un adaptador (opción del CLI y función `resolveActor`) en esta etapa o solo el contrato? Propuesta: solo el contrato.
2. **Administrador de plataforma entre organizaciones.** Propuesta: excluirlo. La propuesta v3 deja abierto el alcance «sistema»; hay que aclarar si equivale a este administrador (P-011).
3. **Propiedades desconocidas en validación** (descartar o rechazar). Tras INV-02.
4. **Router, estilos y pruebas del frontend.** Tras INV-03, INV-05a e INV-06 (P-010, P-017).
5. **Versión de `package.json` en `main`** tras el tag (P-016). Por defecto: versión de preparación.
6. **T-013e.** ¿Se abre o T-018 absorbe el trabajo?
7. **Relación con la decisión de validar `DATABASE_URL` sin que el servidor lo importe.** Tras INV-02.
8. **Orden entre composición y seguridad base.** Este archivo ordena T-017a antes de T-017b; la propuesta v3 propone endurecer antes. ¿Se adelantan solo las partes que no tocan archivos compartidos (`redact` en los overlays de base de datos, `nginx.conf`)?
9. **Multitenancy con SQLite.** D-064 la deja fuera de esta etapa según el alcance aprobado el 2026-11-04; la propuesta v3 la lista como abierta. Confirmar que queda excluida.
10. **Estados de la concesión de acceso y alcances de la primera versión** (P-011), incluida la columna de alcance desde el inicio.
11. **Reproducibilidad de las plantillas** (P-008) tras las versiones resueltas de T-020.
12. **Protección de tags `v*`** en el repositorio (cambio de configuración no autorizado en T-019).

Dependen de evidencia (no se deciden antes): hash (INV-07), credencial opaca o JWT, Bearer en fullstack, CSRF, versión de Zod, almacén de abuso, catálogo de permisos, contexto del actor, estrategia JS/TS (INV-08), mecanismo de composición, forma del esquema con y sin RBAC y multitenancy.

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
| TP-09 (Argon2 y PHC) | INV-07 | |
| TP-10 (piloto TS→JS) | INV-08 | |
| TP-11 (composición) | T-017a y T-017a-ui | |
| TP-12 (OpenAPI y Express 5.3.0) | T-020, prueba 4 | Diseño posterior dentro de T-017a |
| TP-13 (modelo de amenazas) | T-014-0 | |
| TP-14 (cobertura por pares) | T-020, prueba 6; T-018 | Convertida en control automático en T-018 |
| TP-15 (auth, RBAC, multi-org) | T-014a a T-014d | |
| (no figuraba en la v3) | T-018 | Aprobada en alcance el 2026-11-04; infraestructura de `verify:security` |
| DP-04 … DP-17 | P-014, P-015, P-008, P-012, P-013, P-009, P-010, P-011, P-017, P-016 | Ver `DECISIONS.md` |