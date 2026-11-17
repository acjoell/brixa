# Project Decisions

## 1. Propósito

Registrar las decisiones relevantes del proyecto y distinguir entre acuerdos confirmados, propuestas y cuestiones pendientes.

Este documento debe actualizarse cuando se tome una decisión que afecte al alcance, la arquitectura, la seguridad o el comportamiento del generador.

## 2. Estados de las decisiones

Se utilizarán los siguientes estados:

- **Confirmada:** decisión aprobada explícitamente.
- **Propuesta:** alternativa sugerida que todavía requiere aprobación.
- **Pendiente:** cuestión que debe resolverse.
- **Reemplazada:** decisión anterior sustituida por otra posterior.

Una propuesta no debe tratarse como una decisión confirmada.

## 3. Decisiones confirmadas

### D-001 — El producto será un generador de proyectos mediante CLI

**Estado:** Confirmada.

El producto será una herramienta de línea de comandos que permita crear proyectos nuevos a partir de tecnologías y capacidades seleccionadas.

### D-002 — La generación será configurable

**Estado:** Confirmada.

El usuario podrá seleccionar capacidades y opciones para adaptar el proyecto generado a sus necesidades.

### D-003 — Las capacidades deben generar implementaciones funcionales

**Estado:** Confirmada.

El generador no debe limitarse a crear carpetas vacías o esqueletos sin comportamiento real.

Las capacidades seleccionadas deben producir implementaciones coherentes y verificables.

### D-004 — Se contemplan modos simple y avanzado

**Estado:** Confirmada como objetivo de producto.

El generador debe contemplar una experiencia sencilla para usuarios que prefieren valores predeterminados y otra con opciones adicionales.

Los detalles de interfaz y configuración todavía deben definirse.

### D-005 — La primera versión generará proyectos nuevos

**Estado:** Confirmada.

La primera versión se centrará en crear proyectos desde cero.

La modificación de proyectos existentes queda fuera del alcance inicial.

### D-006 — Se priorizarán claridad, seguridad y simplicidad

**Estado:** Confirmada.

El código generado debe ser comprensible, seguro y mantenible.

No se debe introducir complejidad arquitectónica innecesaria.

### D-007 — La IA debe inspeccionar antes de modificar

**Estado:** Confirmada.

Los agentes que trabajen en el proyecto deben comprender el contexto relevante antes de cambiar código, realizar modificaciones justificadas y verificar los resultados.


### D-008 — Generación de frontend, backend o aplicación completa

**Estado:** Confirmada.

El usuario podrá seleccionar solo frontend, solo backend o una aplicación completa.

Las modalidades estarán disponibles únicamente cuando sus combinaciones estén implementadas y verificadas.

### D-009 — JavaScript y TypeScript

**Estado:** Confirmada como objetivo de producto.

El generador ofrecerá JavaScript y TypeScript como opciones para frontend y backend.

La selección del lenguaje para el backend seguirá la misma elección que para el frontend en la experiencia de generación conjunta, sin impedir que el usuario genere un frontend o backend independiente.

### D-010 — React y Vite

**Estado:** Confirmada como stack frontend inicial.

React y Vite serán la base del frontend inicial. Se ofrecerán variantes en JavaScript y TypeScript.

Otros frameworks, incluido Next.js, se evaluarán posteriormente.

### D-011 — Node.js y Express

**Estado:** Confirmada como stack backend inicial.

Node.js y Express serán la base del backend inicial, con JavaScript o TypeScript.

Las versiones concretas se definirán al implementar y verificar la primera versión.

### D-012 — PostgreSQL y SQLite

**Estado:** Confirmada como objetivo de soporte.

Se pretende ofrecer PostgreSQL y SQLite para proyectos con backend y persistencia.

Cada integración debe implementarse y probarse antes de anunciarse como disponible.

### D-013 — Docker opcional

**Estado:** Confirmada.

Docker y Docker Compose serán capacidades opcionales, no requisitos obligatorios de los proyectos generados.

### D-014 — Modo simple antes que modo avanzado

**Estado:** Confirmada.

El MVP incluirá una experiencia interactiva de modo simple.

El modo avanzado se añadirá después de validar que el proceso de generación base es funcional y estable.

### D-015 — Autenticación, RBAC y multitenancy fuera del MVP inicial

**Estado:** Confirmada.

Estas capacidades se incorporarán después de validar la generación base.

La arquitectura podrá facilitar su incorporación futura, pero no debe introducir complejidad innecesaria para anticiparlas.

### D-016 — Estrategia de ORM

**Estado:** Confirmada. Cerrada por D-035.

No se seleccionará definitivamente un ORM hasta comparar una implementación pequeña con las bases de datos previstas y comprobar migraciones, consultas, transacciones, compatibilidad con JavaScript y TypeScript, y estabilidad de las versiones disponibles.

### D-017 — Distribución y versionado

**Estado:** Confirmada como estrategia inicial.

El código fuente se alojará en GitHub y las versiones del CLI se distribuirán mediante npm.

Las publicaciones serán manuales al principio. Se utilizará versionado semántico y se evaluará automatizar el proceso más adelante.

### D-018 — Licencia AGPL-3.0

**Estado:** Reemplazada por D-042.

Se evaluará AGPL-3.0 como licencia para el proyecto.

Antes de confirmarla, se deben revisar sus implicaciones para el uso comercial, las aplicaciones generadas, las contribuciones de terceros y una posible estrategia de licencias comerciales alternativas.

No debe añadirse todavía una licencia definitiva al repositorio.

### D-019 — Nombre provisional Foundry

**Estado:** Reemplazada por D-046.

Se utilizará Foundry como nombre de trabajo del proyecto.

Antes de publicar se comprobará la disponibilidad del nombre en npm, GitHub, dominios y registros de marcas relevantes.

### D-020 — Herramientas de calidad

**Estado:** Confirmada. Cerrada por D-027.

Se evaluaron Vitest para pruebas, ESLint para análisis estático y Prettier para formato, además de la comprobación de tipos cuando se utilice TypeScript.

La selección definitiva quedó registrada en D-027.

### D-021 — Estrategia de composición

**Estado:** Confirmada como principio de trabajo.

La composición de plantillas y capacidades se diseñará de forma iterativa.

Las combinaciones soportadas deberán estar explícitamente definidas y verificadas. No se intentará construir anticipadamente un sistema genérico que cubra todas las combinaciones imaginables.

## 4. Propuestas técnicas pendientes

Este apartado contiene únicamente decisiones técnicas que todavía requieren investigación, pruebas de concepto o aprobación definitiva.

Las decisiones ya adoptadas se registran en la sección correspondiente de este documento. Una decisión adoptada puede seguir pendiente de implementación o validación técnica; esto no significa que vuelva a ser una propuesta.

### P-001 — Selección del ORM y mecanismo de persistencia

**Estado:** Resuelta. Cerrada por D-035 (prueba de concepto de T-011).

Se busca soportar PostgreSQL y SQLite en los proyectos que incluyan persistencia.

Antes de seleccionar un ORM o mecanismo de acceso a datos, se debe realizar una prueba de concepto que evalúe:

- Compatibilidad real con PostgreSQL y SQLite.
- Integración con JavaScript y TypeScript.
- Migraciones y definición del esquema.
- Experiencia de desarrollo y mantenibilidad.
- Pruebas automatizadas y facilidad de configuración en los proyectos generados.

No se debe considerar seleccionado ningún ORM hasta completar esta evaluación.

### P-002 — Versiones y matriz de compatibilidad

**Estado:** Pendiente de definición y validación.

Se deben definir las versiones iniciales compatibles de las tecnologías utilizadas y establecer qué combinaciones de configuración estarán soportadas.

La matriz debe contemplar, como mínimo:

- Modalidad de generación: frontend, backend o aplicación completa.
- Lenguaje: JavaScript o TypeScript.
- Base de datos, cuando corresponda.
- Capacidades opcionales y sus dependencias.
- Versiones de Node.js y de las dependencias principales.

Una combinación solo podrá declararse soportada después de generar el proyecto, instalar sus dependencias, ejecutar las comprobaciones correspondientes y verificar su funcionamiento.

### P-003 — Herramientas y estrategia de generación del CLI

**Estado:** Resuelta. Cerrada por D-023 (librería de prompts), D-024 (mecanismo de generación de archivos) y D-025 (gestor de paquetes).

Se debían seleccionar las bibliotecas y los mecanismos para:

- Construir los prompts interactivos.
- Validar las opciones introducidas por el usuario.
- Generar y combinar plantillas.
- Gestionar archivos existentes y evitar sobrescrituras inesperadas.
- Instalar dependencias y ejecutar las comprobaciones iniciales.

La solución debe ser sencilla de mantener y permitir incorporar nuevas plantillas y capacidades sin acoplamientos innecesarios.

### P-004 — Estructura de las aplicaciones completas

**Estado:** Resuelta (D-034).

Resuelta mediante estructura de carpetas hermanas (`frontend/` y `backend/`), dependencias independientes, proxy de desarrollo en Vite con `BACKEND_URL` (por defecto `http://localhost:3000`), rewrite `/^\/api(?=\/|$)/`, overlay de `vite.config` en `src/templates/fullstack/`, `README.md` raíz y sin `.gitignore` raíz. Matriz de seis combinaciones verificada. P-002 sigue pendiente para confirmación de versiones de dependencias de proyectos generados. Deuda técnica declarada: dos terminales para desarrollar, producción sin resolver y aviso de esbuild.

### P-005 — Criterios de aceptación de 0.1.0

**Estado:** Resuelta. Aprobada por el responsable el 2026-10-28.

La versión `0.1.0` se considera lista cuando se cumple todo lo siguiente:

- Todas las variantes de la matriz (frontend, backend y fullstack; ts y js; sin base de datos, PostgreSQL y SQLite; con y sin las capacidades de T-013) se generan, se instalan, pasan lint, tipos, tests y `npm audit --audit-level=moderate`, y arrancan.
- La CI es verde en Ubuntu, Windows y macOS para las variantes sin Docker, y en Linux para PostgreSQL y Docker.
- Node 26 está verificado o se declara no soportado.
- El tarball de `npm pack` se instala y funciona en un entorno limpio (Linux; Windows se verifica solo mediante la CI, ver D-057).
- El README público incluye combinaciones soportadas, limitaciones y el aviso de que no incluye autenticación, RBAC ni multitenancy.
- `LICENSE`, `GENERATED_CODE_LICENSE.md` y `CONTRIBUTING.md` están presentes y no hay secretos en el historial.
- La deuda de `redact` está cerrada.

### P-006 — Evaluación definitiva de la licencia

**Estado:** Resuelta de forma provisional por D-042 (revisable).

AGPL-3.0 es la licencia candidata, pero su adopción definitiva requiere revisar sus implicaciones para el generador, las plantillas, las contribuciones externas y la distribución de los proyectos generados.

No debe considerarse definitiva hasta completar la evaluación correspondiente.

### P-007 — Confirmación del nombre del proyecto

**Estado:** Resuelta por D-046 (nombre definitivo: Brixa). Histórico: comprobado el 2026-10-28, el paquete npm «foundry» ya existe; «create-foundry-app» está ocupado por otro producto (FoundryDB); «@acjoell/foundry» está libre y no se encontró el repositorio acjoell/foundry en GitHub. Ver D-046.

Foundry es el nombre provisional del proyecto.

Antes de una publicación pública, se debe comprobar su disponibilidad y posibles conflictos en npm, GitHub, dominios y registros de marcas relevantes.


### P-008 — Reproducibilidad de las plantillas generadas

**Estado:** Pendiente.

La inspección del 2026-11-07 indica que las plantillas no tienen lockfile y que React y Vite usan rangos (`^19.3.1`, `^8.3.4`, `@vitejs/plugin-react` `^6.1.2`). Los backends declaran Drizzle 0.45.4, Drizzle Kit 0.31.11, `pg` 8.23.1, `@libsql/client` 0.18.0 y Express 5.3.0. Las versiones resueltas no están confirmadas, y lo que `verify:generated` y `npm audit` comprueban es lo que npm resuelve ese día. Opciones: versiones exactas, lockfile generado o rangos con el riesgo asumido. Las versiones resueltas se medirán en T-020.

### P-009 — Hash de contraseñas y rango de Node

**Estado:** Resuelta (D-091 a D-093).

Resuelta mediante la consolidación de decisiones arquitectónicas tras las investigaciones INV-01 e INV-07: adopción de Argon2id como único algoritmo de hashing para contraseñas en Auth v1 mediante la librería externa `@node-rs/argon2` versión exacta `2.2.2`, incorporada únicamente a los backends generados con Auth y manteniendo `engines.node: "^24.0.0 || >=26.0.0"` sin implementaciones alternativas en `node:crypto`, bcrypt ni scrypt y con paridad funcional entre JS y TS (D-091); parámetros explícitos `m=19456 KiB, t=2, p=1, outputLen=32`, salt criptográficamente aleatorio de 16 bytes, almacenamiento en formato PHC canónico en Base64 convencional sin padding (no Base64URL) y soporte de rehash tras autenticación válida (D-092); y seguridad operativa obligatoria: asincronía estricta en peticiones HTTP, validación defensiva previa de parámetros PHC para evitar DoS por memoria/CPU, verificación ficticia (dummy) contra enumeración por tiempo, limitador de concurrencia acotado independiente del rate limiting, y política de entrada de 128 caracteres / 512 bytes UTF-8 (D-093). Quedan como pendientes técnicos de diseño e implementación los límites defensivos exactos y compatibilidad con rehash, capacidad y saturación del limitador de concurrencia, manejo de errores y mitigación de enumeración, pruebas en contenedores con memoria restringida y verificación de binarios nativos sin dependencias opcionales.

### P-010 — Sesiones, transporte, CSRF y router

**Estado:** Resuelta (D-087 a D-090).

Resuelta mediante la consolidación de decisiones arquitectónicas: sesiones opacas con tokens de 32 bytes criptográficamente aleatorios y hash SHA-256 en base de datos como único modelo en v1 sin JWT (D-087); ciclo de vida con expiración deslizante por inactividad y límite absoluto, revocación efectiva y rotación controlada sin access/refresh rotativo en v1 (D-088); transporte exclusivo por cookies seguras con nombre por proyecto en fullstack, cookies o Bearer seleccionables en backend independiente, protección CSRF obligatoria para cookies y sin soporte general de cookies cross-site en v1 (D-089, precisando el alcance de D-064); y React Router declarativo condicionado a fullstack con Auth, estado centralizado con 4 estados sin credenciales en JS, rutas protegidas para UX con autorización efectiva en Express, accesibilidad explícita y pruebas reales (D-090). Quedan pendientes de especificación detallada las duraciones predeterminadas de expiración, la periodicidad de rotación y la frecuencia de actualización de actividad.

### P-011 — Modelo de acceso: estados, alcances y primer administrador

**Estado:** Resuelta (D-080 a D-086).

Resuelta mediante la consolidación de decisiones: relación N:M entre usuarios y organizaciones, validación de organización por petición y paso explícito de `ActorContext` (D-080); ciclo de vida con `revoked_at` y unicidad parcial (D-081); RBAC dinámico con catálogo en código, sincronizado con BD y alcances de aplicación y organización (D-082); independencia de multitenancy sin roles fijos (D-083); separación de plataforma y organizaciones sin bypass de RLS (D-084); bootstrap seguro local sin credenciales predeterminadas ni endpoint público (D-085); y registro público opcional para Auth sin multitenancy (D-086).

### P-012 — Estrategia de composición de overlays

**Estado:** Pendiente (INV-05a).

Estado real (inspección): copia recursiva; overlays que reemplazan archivos completos (API Docs reemplaza `src/app`, `src/index` y `tsconfig.json`; i18n reemplaza `App` y `main`; fullstack reemplaza `vite.config`); sin slots; `compose.yaml` copiado entero; API Docs modifica configuración por sustitución de texto; la fusión de `package.json` conserva las claves de la base sin detectar conflictos; las dependencias de API Docs están duplicadas entre archivos de plantilla y el generador, y las de i18n están en el generador. Pendiente elegir reglas por archivo, la forma de componer Compose (fusión estructurada o composición nativa) y cómo detectar rutas para OpenAPI en Express 5.3.0. La propuesta de INV-05a de generar siempre `en.json` contradice D-052 y no se adopta por defecto.

### P-013 — Estrategia JavaScript/TypeScript

**Estado:** Confirmada (resuelta en D-098 tras INV-05b, su complemento e INV-08; implementación técnica pendiente en T-023).

Aprobada la estrategia de híbrido versionado con TypeScript como fuente de verdad y JavaScript derivado automáticamente mediante Babel y transformaciones AST con formateo determinista, versionado en Git y verificado con `verify:sync` en CI. El CLI continúa copiando plantillas preconstruidas sin dependencias adicionales en los proyectos generados. Mantenimiento manual acotado a archivos con divergencias estructurales legítimas (`package.json`, Dockerfiles, ESLint, Drizzle config, `tsconfig.json`).

### P-014 — Seguridad base del backend: errores, cabeceras, CORS y contadores

**Estado:** Confirmada (resuelta mediante D-070, D-071, D-073, D-074, D-075 y D-076 en T-017b/T-022; almacén de contadores de autenticación y `trust proxy` transferidos a T-014a conforme a D-086, D-089, D-093, D-099, D-102 y D-107).

Hecho confirmado: Zod 4.6.7 incorporado con validación pura de configuración (D-070); contrato uniforme de errores HTTP y 404 JSON (D-071); `redact` centralizado con mitigación ReDoS y límite de 100 KB en Express (D-073, D-076); Helmet 8.3.0 con CSP estricta, CSP específica en Swagger y CORS restrictivo desactivado por defecto (D-074); cabeceras SPA en Nginx con Docker (D-075). La evaluación de `trust proxy` y el rate limiting específico de endpoints de autenticación quedan transferidos a T-014a.

### P-015 — Alineación de imágenes y tipos

**Estado:** Pendiente.

Los Compose generados usan `postgres:17.4-alpine`; el arnés usa `postgres:17-alpine`, así que no prueba exactamente lo que se entrega. `@types/node` es `^24.19.2` en la plantilla frontend TypeScript y 26.x en el CLI y el backend TypeScript. Decidir la alineación y si los tipos deben seguir el mínimo real de `engines`.

### P-016 — Versión de `package.json` en `main` y guarda de publicación

**Estado:** Pendiente.

Tras el tag (D-060), decidir qué versión declara `main` y si se añade una guarda que impida publicar desde un commit sin tag. Valor por defecto propuesto en TASKS_POST_MVP: una versión de preparación (por ejemplo `0.2.0-dev.0`). Hasta decidirlo, solo se publica desde el checkout del tag.

### P-017 — Pruebas en navegador real

**Estado:** Pendiente.

Incorporar un conjunto mínimo de pruebas E2E (por ejemplo con Playwright, en un único job de Linux) cuando exista autenticación con cookies. Hoy no hay pruebas en navegador real y la plantilla de frontend no incluye pruebas.

## 3b. Decisiones confirmadas en T-002

Las siguientes decisiones resuelven las cuestiones técnicas que bloqueaban el MVP. Quedan registradas aquí por orden de aprobación. Las versiones concretas se verificarán y fijarán al crear `package.json` en T-001.

### D-022 — TypeScript sobre Node.js como lenguaje y runtime del CLI

**Estado:** Confirmada.

**Contexto:** Había que elegir el lenguaje de implementación y el entorno de ejecución del propio CLI antes de poder crear la estructura del proyecto.

**Decisión:** El CLI se implementará en TypeScript ejecutado sobre Node.js. La versión de Node.js a utilizar como baseline se verificará y fijará al crear `package.json` (T-001); candidato provisional: `^24.0.0 || >=26.0.0` (ver hallazgos más abajo).

**Motivo:** El proyecto ya contempla TypeScript como opción para los proyectos generados (D-009). Usar el mismo lenguaje en el CLI aporta coherencia, tipado estático y mejor detección de errores en tiempo de desarrollo. Node.js es la plataforma de referencia para herramientas CLI del ecosistema npm.

**Consecuencias:** Se necesitará configuración de TypeScript (`tsconfig.json`) y un paso de compilación o ejecución con `ts-node` / `tsx`. Las versiones de Node.js soportadas deben respetar los `engines` de todas las dependencias finales.

**Alternativas consideradas:** JavaScript puro (menos complejidad de tooling, pero sin tipado estático, inconsistente con el objetivo de ofrecer TS como opción); Go o Rust (más velocidad de arranque, pero ecosistema completamente distinto y sin sinergia con las plantillas JS/TS).

---

### D-023 — @inquirer/prompts como librería de prompts interactivos

**Estado:** Confirmada.

**Contexto:** Se necesitaba una librería para construir la interfaz interactiva de selección de opciones del CLI (P-003).

**Decisión:** Se utilizará `@inquirer/prompts` para los prompts interactivos. Versión a verificar y fijar al crear `package.json` (T-001).

**Motivo:** Ecosistema maduro y mantenido activamente. API moderna basada en promesas y ESM. Requiere Node.js ≥ 18, compatible con el baseline candidato. Es la evolución oficial del histórico `inquirer`.

**Consecuencias:** Los prompts se construirán con la API de `@inquirer/prompts`. La lógica de validación de opciones debe separarse de la presentación para permitir pruebas unitarias sin dependencia del terminal.

**Alternativas consideradas:** `prompts` (menos mantenido); `clack` (API más moderna, pero ecosistema más pequeño); construcción manual con `readline` (más control, pero más código de infraestructura sin valor diferencial).

---

### D-024 — Generación de archivos mediante copia de plantillas con interpolación simple

**Estado:** Confirmada.

**Contexto:** Se necesitaba definir el mecanismo de generación de archivos de los proyectos (P-003).

**Decisión:** Los archivos de los proyectos generados se crearán copiando plantillas estáticas con sustituciones puntuales de variables (interpolación simple). No se utilizará un motor de templates externo en el MVP.

**Motivo:** Mínima complejidad para el MVP. Las plantillas son legibles como archivos reales. Permite evolucionar el mecanismo si las necesidades lo justifican sin impacto en la interfaz pública del CLI.

**Consecuencias:** Las plantillas vivirán como archivos en el repositorio del CLI. La lógica de interpolación será interna y específica del proyecto. Si la complejidad de las combinaciones crece, se evaluará introducir un motor de templates (ver D-021).

**Alternativas consideradas:** EJS, Handlebars, Mustache (potentes pero añaden dependencia y complejidad para necesidades que en el MVP son simples); `create-vite` interno (demasiado acoplado a un stack específico).

**Nota (2026-11-09):** el mecanismo de copia se amplió con puntos de inserción `@@INSERT:<punto>@@` en `app` e `index` del backend base y con directorios `_fragments/` en los overlays (ver D-069). Los fragmentos son archivos reales del repositorio, no cadenas embebidas en el generador. `copyDir` omite toda entrada que empiece por `_`, salvo `_gitignore` y `_dockerignore`. El principio de «plantillas legibles como archivos reales» se mantiene; los fragmentos son su extensión para contenido que depende del overlay.

---

### D-025 — npm como gestor de paquetes

**Estado:** Confirmada.

**Contexto:** Había que elegir el gestor de paquetes para el CLI y para los proyectos generados.

**Decisión:** Se utilizará npm. Versión a verificar y fijar al crear `package.json` (T-001); se usará la versión incluida con Node.js LTS.

**Motivo:** Incluido con Node.js sin dependencia adicional. Suficiente para el MVP. Reduce la fricción de instalación para los usuarios del CLI.

**Consecuencias:** Los proyectos generados incluirán `package-lock.json`. El CLI asumirá que npm está disponible en el entorno del usuario. Si en el futuro se necesita soporte para pnpm o yarn, deberá evaluarse como una opción explícita.

**Alternativas consideradas:** pnpm (más eficiente en disco, pero dependencia adicional para el usuario); yarn (dos versiones con comportamientos distintos, mayor complejidad de soporte).

---

### D-026 — Primera combinación a implementar: frontend React + Vite + TypeScript

**Estado:** Confirmada.

**Contexto:** Había que acordar qué combinación tecnológica se implementará primero para validar el flujo completo de generación (P-003, D-021).

**Decisión:** La primera combinación será frontend con React, Vite y TypeScript. Las versiones concretas se verificarán y fijarán al crear `package.json` (T-001).

**Motivo:** Es la combinación más autocontenida: no requiere backend ni base de datos, lo que reduce el riesgo en la primera implementación. Está alineada con D-010 y D-009. Permite validar el flujo completo de generación, instalación y ejecución antes de añadir complejidad.

**Consecuencias:** T-006 implementará esta combinación. Las combinaciones backend y aplicación completa se abordarán en fases posteriores (D-008, D-011). Esta combinación no puede declararse soportada hasta superar las verificaciones de T-006 y T-007 (D-021).

**Alternativas consideradas:** Backend Node.js + Express (requiere más decisiones sobre estructura de servidor); aplicación completa (mayor complejidad para la primera iteración); React + Vite + JavaScript (se priorizó TypeScript por coherencia con D-009 y D-022).

---

### D-027 — Herramientas de calidad: Vitest, ESLint 9, Prettier, tsc --noEmit

**Estado:** Confirmada. Cierra D-020.

**Contexto:** D-020 registraba como propuesta la evaluación de estas herramientas. Quedan confirmadas con este registro.

**Decisión:** Las herramientas de calidad del propio CLI serán: Vitest (pruebas unitarias e integración), ESLint 9 con flat config (`eslint.config.js`) (análisis estático), Prettier (formato de código) y `tsc --noEmit` (verificación de tipos). Las versiones concretas se verificarán y fijarán al crear `package.json` (T-001).

**Motivo:** Vitest comparte API con Jest y está optimizado para proyectos TypeScript modernos. ESLint 9 es la versión actual; el formato `.eslintrc` fue eliminado y ya no está soportado. Prettier automatiza el formato sin debate de estilo. `tsc --noEmit` garantiza que el código TypeScript es correcto sin necesidad de compilar.

**Consecuencias:** La configuración de ESLint deberá usar `eslint.config.js` (flat config). No se usará el formato `.eslintrc.*`. La compatibilidad de `typescript-eslint` con la versión de TypeScript elegida debe verificarse antes de fijar versiones (ver hallazgos más abajo). La herramienta de lint para los proyectos frontend generados (React + Vite) es una cuestión separada que se evaluará en T-008.

**Alternativas consideradas:** Jest (mayor fricción con ESM y TypeScript); Mocha + Chai (más configuración manual); ESLint 8 con `.eslintrc` (obsoleto y sin soporte en v9).

---

### D-028 — Saltos de línea normalizados a LF

**Estado:** Confirmada.

**Contexto:** Los archivos existentes contienen saltos de línea CRLF. Era necesario establecer una convención para nuevos archivos y para el repositorio.

**Decisión:** Todos los archivos de texto usarán LF. La normalización se aplica a los archivos nuevos mediante `.gitattributes` (`* text=auto eol=lf`). Los archivos existentes no se renormalizan ahora; se normalizarán en un commit dedicado cuando el responsable lo apruebe.

**Motivo:** LF es la convención estándar en proyectos Node.js/TypeScript publicados en npm y en entornos Linux/macOS. Evita ruido en los diffs y problemas de compatibilidad en scripts.

**Consecuencias:** Los nuevos archivos creados a partir de ahora tendrán LF. Los archivos existentes con CRLF seguirán así hasta que se ejecute la renormalización explícita.

**Alternativas consideradas:** CRLF (incompatible con entornos Unix y convención del ecosistema); sin política (`text=auto` sin `eol`): deja la elección al entorno de cada desarrollador, genera inconsistencias.

---

## 3c. Hallazgos a re-verificar antes de fijar versiones en T-001

Estas cuestiones surgieron durante la investigación de versiones en T-002. No bloquean T-002, pero deben resolverse antes de crear `package.json`.

**1. Compatibilidad TypeScript / typescript-eslint:**
`typescript-eslint@latest` declara como peer dependency `typescript <6.1.0`. La versión de TypeScript publicada en npm puede estar en una serie mayor. Antes de fijar versiones, verificar:
```
npm view typescript-eslint version peerDependencies --json
npm view typescript version --json
```
Si `typescript@latest > 5.x`, fijar TypeScript en la serie compatible con `typescript-eslint@latest` o usar la versión de `typescript-eslint` que soporte la versión de TypeScript elegida.

**2. Herramienta de lint para el frontend generado (React + Vite):**
La plantilla `react-ts` de `create-vite` usa `oxlint` en lugar de ESLint. D-027 aplica al CLI; la herramienta de lint que llevará el frontend generado es una decisión separada. Se anota como cuestión pendiente para T-008: evaluar si el frontend generado usará ESLint, oxlint u otra herramienta, y con qué configuración.

**3. Baseline de Node.js:**
Node.js 22 LTS (Jod) llega a End-of-Life el 2027-04-30. El candidato provisional para el baseline del CLI es `^24.0.0 || >=26.0.0`. Node.js 26 pasa a Active LTS el 2026-10-28. El baseline definitivo debe respetar los `engines` de todas las dependencias finales. Verificar con:
```
https://nodejs.org/dist/index.json
npm view <paquete> engines --json   # para cada dependencia del CLI
```

## 3d. Decisiones confirmadas en T-001


### D-029 — Versiones exactas fijadas para el toolchain del CLI

**Estado:** Confirmada.

**Contexto:** T-001 requería fijar versiones concretas para el `package.json` del CLI. Las versiones se verificaron el 2026-10-24 con `npm view <paquete> version engines peerDependencies --json` y cruzando con `nodejs.org/dist/index.json`.

**Decisión:** Las versiones fijadas son:

| Paquete | Versión |
|---|---|
| `typescript` | `6.0.3` |
| `typescript-eslint` | `8.72.0` |
| `eslint` | `10.13.0` |
| `@eslint/js` | `10.0.1` |
| `prettier` | `3.9.10` |
| `eslint-config-prettier` | `10.1.8` |
| `vitest` | `5.0.5` |
| `@inquirer/prompts` | `8.7.4` |
| `@types/node` | `26.6.5` |
| `tsx` | `4.23.15` |

`typescript` fijado en `6.0.3` (máximo compatible con `typescript-eslint@8.72.0`, que exige `typescript <6.1.0`). `typescript@7.0.2` (latest en npm) no es compatible con `typescript-eslint@8.72.0`.

`engines.node`: `"^24.0.0 || >=26.0.0"`. Verificado paquete por paquete; ninguna dependencia contradice este rango. Node.js 22 se excluye porque llega a EOL el 2027-04-30.

Estas versiones aplican al toolchain del propio CLI. Las versiones de las dependencias de los proyectos generados se determinarán en T-006 y posteriores (P-002 sigue pendiente).

**Consecuencias:** El campo `engines` del `package.json` es `"^24.0.0 || >=26.0.0"`. Se revisarán las versiones cuando `typescript-eslint` publique soporte para TypeScript >=6.1.0.

---

### D-030 — Estrategia de build: tsc para distribución, tsx para desarrollo

**Estado:** Confirmada.

**Contexto:** Había que elegir entre usar solo `tsx`, añadir `tsup` u otro bundler para distribuir el CLI compilado.

**Decisión:** `tsc` compila el código a `dist/` para distribución (usando `tsconfig.build.json`). `tsx` se usa exclusivamente en desarrollo (`npm run dev`). No se añade `tsup` ni ningún bundler externo.

**Motivo:** `tsc` no añade dependencias extra, no eleva el piso de Node.js y produce salida ES module estándar compatible con el `"type": "module"` del proyecto. `tsx` es suficiente para el ciclo de desarrollo sin paso de compilación.

**Consecuencias:** El script `build` ejecuta `tsc --project tsconfig.build.json`. Las plantillas y otros activos estáticos que no sean TypeScript deberán copiarse a `dist/` por un script adicional cuando existan (T-006). La distribución npm incluirá `dist/` en lugar de fuentes TypeScript.

**Alternativas consideradas:** `tsup` (eleva el piso de Node a `^22.18.0 || ^24.11.0 || >=26.0.0`, añade dependencia, descartado por el responsable del proyecto).

---

### D-031 — Protección de destino: fallo temprano si el directorio no está vacío

**Estado:** Confirmada.

**Contexto:** Evitar sobrescritura accidental en carpetas existentes con archivos (T-005).

**Decisión:** Validar el directorio antes de escribir. Si existe y contiene archivos, abortar con error tipado (`not_empty`). Si no existe, crearlo de forma recursiva.

**Motivo:** Garantizar seguridad de datos sin prompts destructivos ni sobreescrituras silenciosas.

---

### D-032 — Interpolación mínima de plantillas con token fijo

**Estado:** Confirmada.

**Contexto:** Personalizar el nombre del proyecto en `package.json` y archivos clave sin dependencias complejas (T-006).

**Decisión:** Uso de `replaceAll("foundry-tpl", projectName)` y renombrado de `_gitignore` a `.gitignore` durante la copia recursiva con `fs.cp`.

**Motivo:** Evita incluir motores de plantillas pesados (e.g. Handlebars, EJS), manteniendo la filosofía de cero dependencias innecesarias en el generador.

---

### D-033 — Soporte de 4 plantillas independientes para frontend y backend (JS y TS)

**Estado:** Confirmada.

**Contexto:** Implementación de plantillas base para Frontend (React + Vite) y Backend (Express) en JS y TS (T-008, T-009).

**Decisión:** Cuatro carpetas de plantillas completas y verificadas: `frontend-react-ts`, `frontend-react-js`, `backend-express-ts` y `backend-express-js`. Cada una incluye scripts (`dev`, `build`, `test`, `lint`), configuración de ESLint flat y tests unitarios.

**Motivo:** Proporciona proyectos listos para usar y aislados, cumpliendo los criterios de aceptación de T-008 y T-009.

---

### D-034 — Estructura y composición de aplicaciones completas (Fullstack)

**Estado:** Confirmada.

**Contexto:** Resolución de P-004 para la generación de proyectos completos (T-010).

**Decisión:** 
- Estructura de carpetas hermanas (`frontend/` y `backend/`) con dependencias y `package.json` independientes.
- Proxy de desarrollo en Vite usando `BACKEND_URL` (por defecto `http://localhost:3000`) con rewrite `/^\/api(?=\/|$)/`.
- Overlay de configuración de Vite en `src/templates/fullstack/` aplicado sobre la plantilla frontend.
- `README.md` raíz explicativo sin `.gitignore` raíz (cada subproyecto mantiene su propio `.gitignore`).
- Matriz de seis combinaciones verificada (frontend ts/js, backend ts/js, fullstack ts/js). P-002 sigue pendiente para la confirmación de versiones de proyectos generados.

**Deuda técnica declarada:**
- Requiere dos terminales para desarrollar (uno para frontend y otro para backend).
- Modo de producción unificado sin resolver (fuera del alcance del MVP).
- Aviso cosmético de esbuild al ejecutar pruebas o compilación.

**Hallazgos verificados por el responsable:**
- (a) Drizzle 0.45.4 con PostgreSQL 17 pasa en TypeScript y en JavaScript (3 tests cada uno) ejecutando los archivos por separado, y con SQLite pasa (6 tests).
- (b) Los archivos de test que comparten una misma base de datos PostgreSQL y se ejecutan en paralelo chocan al crear el esquema "drizzle" (carrera de CREATE SCHEMA); el informe original (24/24) no era reproducible con el comando del README por esto y por la falta de prisma generate --schema por motor.
- (c) Riesgo para T-012: los tests de un proyecto generado contra una misma base de datos deben ejecutarse en serie o usar una base de datos por archivo.

### D-035 — Drizzle ORM como capa de acceso a datos

**Estado:** Confirmada. Cierra D-016 y P-001.

**Contexto:** T-011 evaluó el mecanismo de persistencia mediante una prueba de concepto con PostgreSQL y SQLite en JavaScript y TypeScript.

**Decisión:** Drizzle ORM es la única capa de acceso a datos de los proyectos generados con base de datos. Migraciones con `drizzle-kit` (solo desarrollo) y el migrador de `drizzle-orm`. La prueba de concepto se ejecutó con Drizzle 0.45.4: PostgreSQL 17 pasa en TypeScript y JavaScript, y SQLite pasa (ver hallazgos de D-034).

**Consecuencias:** Una base de datos solo se declara soportada cuando su integración está implementada y verificada en `verify:generated` (D-021). PostgreSQL cumple esto desde T-012a; SQLite queda para T-012b. El driver de SQLite no está decidido (ver T-012b).

---

### D-036 — Base de datos opcional en backend y aplicación completa

**Estado:** Confirmada.

**Decisión:** El CLI pregunta "¿Base de datos?" solo para backend y aplicación completa: "Ninguna" (por defecto) o PostgreSQL. SQLite no se ofrece hasta T-012b. "Ninguna" genera lo mismo que antes.

**Motivo:** No imponer persistencia a quien no la necesita y no multiplicar combinaciones sin verificar (D-021).

---

### D-037 — Esquema vacío y migraciones explícitas

**Estado:** Confirmada.

**Decisión:** El esquema se genera vacío, con comentarios guía; no hay tabla de ejemplo ni usuarios (la autenticación queda para T-014). Las migraciones se ejecutan con `npm run db:generate` (drizzle-kit, solo desarrollo) y `npm run db:migrate` (migrador de drizzle-orm); el servidor nunca migra al arrancar. `db:migrate` falla si no existe `drizzle/` y avisa claramente si existe pero no contiene migraciones.

**Motivo:** Arrancar la aplicación no debe modificar la base de datos por sorpresa, y un despliegue no debe instalar `drizzle-kit`.

**Nota:** para el comportamiento de copia de migraciones en Docker y `Dockerfile.db`, ver D-068.

---

### D-038 — Cliente de base de datos sin Proxy y errores sin credenciales

**Estado:** Confirmada.

**Decisión:** `src/db/client` lee y valida `DATABASE_URL` al importarse y exporta `pool` y `db` directamente; el servidor no lo importa ni se conecta al arrancar. Los errores de `db:migrate` incluyen la causa real y enmascaran las credenciales de la URL (todo lo que hay entre `://` y el último `@` anterior a la primera `/`).

**Motivo:** Un Proxy con instanciación perezosa ligaba el `this` de `pool.query()` y bloqueaba el pool (el test de conexión agotaba 5 s). Corregido y verificado.

**Verificación:** con `DATABASE_URL=postgresql://u:SECR@ETO@127.0.0.1:1/d` (puerto cerrado), ni `db:migrate` ni el test de conexión emiten `SECR` ni `ETO` por stdout o stderr.

**Nota (2026-11-09):** esta decisión no se modifica. La validación de `DATABASE_URL` al importar el cliente sigue vigente. La redacción de credenciales en el manejador global de errores se centralizó en `src/redact.ts` (ver D-067 y D-071); el cliente de base de datos no es el único punto que enmascara URLs. El contrato de errores (D-071) tampoco altera la lectura de `DATABASE_URL`.

---

### D-039 — Cadena de suministro de las plantillas con base de datos

**Estado:** Confirmada.

**Decisión:** `overrides` de `@esbuild-kit/core-utils` a `esbuild ^0.25.0` para eliminar 4 vulnerabilidades moderadas (GHSA-67mh-4wv8-2f99, que afecta al servidor de desarrollo de esbuild, no usado por `drizzle-kit`); `allowScripts: { esbuild: false }`; `npm audit --audit-level=moderate` forma parte de `verify:generated`. Los avisos de deprecación de `@esbuild-kit` no se pueden evitar con `drizzle-kit` 0.31 y están explicados en el README del backend.

**Consecuencias:** `npm audit` puede fallar en el futuro por avisos nuevos sin que cambie el código (no sería un bug de Brixa). `drizzle-kit` 1.0.0-rc.5 ya no depende de `@esbuild-kit`: reevaluar cuando 1.0 sea la versión estable (`latest`).

---

### D-040 — Pruebas con base de datos

**Estado:** Confirmada.

**Decisión:** Los proyectos generados ejecutan los archivos de test en serie (`fileParallelism: false`, ver hallazgo (c) de D-034) y el test de conexión se omite si falta `DATABASE_URL` (Docker es opcional). `verify:generated` usa `VERIFY_DATABASE_URL` o un contenedor desechable, con una base de datos aislada por variante; si no hay Docker, informa "NO VERIFICADO: PostgreSQL". Con T-012a verifica 12 variantes, incluidas backend y fullstack en ts y js con PostgreSQL.

---

### D-041 — Driver de SQLite: @libsql/client

**Estado:** Confirmada.

**Contexto:** T-012b requería elegir el driver de SQLite para Drizzle. Las pruebas se realizaron con caché de npm limpia en Linux x64 con Node 24.

**Decisión:** Se utiliza `@libsql/client` con `drizzle-orm/libsql` y `DATABASE_URL=file:./data/app.db`. La plantilla crea la carpeta de la base de datos si no existe y excluye `data/` mediante el `.gitignore` generado.

**Motivo:** La instalación no requiere scripts de compilación ni toolchain nativa y la integración supera las pruebas de consultas reales, generación de migraciones y ejecución del migrador. `better-sqlite3` sin su script de instalación no dispone del binario necesario; al permitir el script, requiere compilación en el entorno probado.

**Consecuencias:** Verificado en Linux x64 con Node 24; otras plataformas no probadas. La ruta `file:` es relativa al directorio de ejecución. Los avisos de deprecación de `@esbuild-kit` y el override de D-039 siguen aplicando.

**Alternativas consideradas:** `better-sqlite3` con script de instalación denegado (no funciona en el entorno probado) y con script permitido (requiere compilación).

---

### D-042 — Licencia AGPL-3.0 y concesión sobre el código generado

**Estado:** Confirmada (provisional, revisable). Reemplaza a D-018 y resuelve P-006 de forma provisional.

**Contexto:** D-018 dejaba AGPL-3.0 como propuesta. El responsable quiere una herramienta abierta y comunitaria, sin restringir las aplicaciones creadas con ella.

**Decisión:** El CLI y las plantillas se distribuyen bajo AGPL-3.0. El código generado por Brixa puede usarse, modificarse, distribuirse y licenciarse libremente, incluso con fines comerciales y bajo la licencia que elija quien lo genera. La concesión se documenta en el README público y en `GENERATED_CODE_LICENSE.md`, junto al `LICENSE`.

**Motivo:** Las plantillas forman parte del CLI y se copian a los proyectos de los usuarios. Sin una concesión expresa, esa copia podría interpretarse como material AGPL.

**Consecuencias:**
- La concesión solo cubre código del que el responsable sea titular. Las contribuciones de terceros a las plantillas deben aceptar la concesión (ver D-043 y CONTRIBUTING.md).
- Sin CLA no podrá relicenciarse el código aportado por terceros sin su consentimiento.
- Algunas empresas prohíben instalar herramientas AGPL. Puede frenar la adopción corporativa.
- Se recomienda una revisión legal del texto de la concesión antes de endurecer la política de licencias. No bloquea `0.1.0`.

**Alternativas consideradas:** MIT o Apache-2.0 (más permisivas, sin protección frente a versiones modificadas cerradas); licencia dual con licencia comercial (descartada por ahora para no complicar el proyecto).

---

### D-043 — Contribuciones con DCO, sin CLA

**Estado:** Confirmada (temporal, revisable).

**Decisión:** Se aceptan issues y pull requests. Cada commit lleva `Signed-off-by` (Developer Certificate of Origin, `git commit -s`). No hay CLA ni licencia comercial alternativa. El mantenedor decide qué se incorpora. Al contribuir, la persona acepta que su aportación se distribuye bajo AGPL-3.0 y con la concesión sobre código generado de D-042.

**Consecuencias:** Mínima burocracia. No se puede ofrecer licencia comercial del código ajeno sin pedir permiso. Si esa opción se quiere abrir en el futuro habrá que introducir un CLA.

---

### D-044 — Alcance de 0.1.0 y orden de entrega

**Estado:** Confirmada.

**Decisión:** La primera versión pública es `0.1.0` y contiene el MVP técnico (T-001 a T-012) más T-013 (Docker y Docker Compose, documentación de API e i18n), T-016 (CI multiplataforma) y T-015 (publicación). Orden: T-013 → T-016 → T-015 → T-014. Autenticación, RBAC y multitenancy (T-014) se publican en una versión posterior.

**Motivo:** Mostrar una versión útil, documentada y verificada cuanto antes, sin esperar a la parte de seguridad. El README debe indicar explícitamente que `0.1.0` no incluye autenticación, RBAC ni multitenancy.

**Consecuencias:** D-015 sigue vigente: esas capacidades quedan fuera del MVP técnico y de `0.1.0`. `ROADMAP.md` ejecuta la Fase 6 antes que la Fase 5. «Configuración adicional de pruebas» (antes en T-013) no forma parte de `0.1.0`.

---

### D-045 — Publicación gradual: repositorio, CI y npm

**Estado:** Confirmada.

**Decisión:** El repositorio se hace público en GitHub antes de publicar en npm. Antes de `npm publish` se comprueba el CLI en Ubuntu, Windows y macOS mediante GitHub Actions (T-016) (la instalación manual en Windows a partir del tarball se retiró como requisito, ver D-057). Las variantes con PostgreSQL o Docker solo se verifican en Linux.

**Consecuencias:** Los fallos de compatibilidad que aparezcan se corrigen o se documentan como limitaciones antes de publicar. Hasta entonces, la compatibilidad declarada sigue siendo Linux x64 con Node 24.

---

### D-046 — Nombre del proyecto

**Estado:** Confirmada (2026-11-02). Reemplaza a D-019 y resuelve P-007.

**Contexto:** Comprobado por el responsable el 2026-10-28: `foundry` ya existe en npm; `create-foundry-app` pertenece a FoundryDB; «Foundry» es además el nombre de otros productos conocidos (confusión en buscadores y marca).

**Decisión:** El proyecto se llama **Brixa**. Paquete npm `brixa` (sin scope; comprobado libre el 2026-11-03, igual que `create-brixa`) y repositorio `acjoell/brixa`. Se prefiere `npx brixa` a `npx @acjoell/brixa` por comodidad de uso; el comando instalado es `brixa`.

**Consecuencias:** Los metadatos del paquete, la documentación y el repositorio usan Brixa. Comprobar que no quedan referencias a «Foundry» en el código y las plantillas (incluido el token `foundry-tpl` de D-032, si sigue en uso). El nombre no se ha comprobado en registros de marcas. El paquete `create-brixa` (para `npm create brixa`) queda sin publicar; se podrá añadir después como paquete aparte. Un nombre ya publicado en npm no se puede mover.

---

### D-047 — Docker y Docker Compose opcionales en backend (T-013a, fase 1)

**Estado:** Confirmada.

**Decisión:** El CLI pregunta «¿Docker?» (por defecto No) solo para backend. Con Docker genera `Dockerfile` multi-etapa (`node:24.22.1-slim`, usuario no root, solo dependencias de producción), `.dockerignore` y `compose.yaml` (servicio `backend`, más `postgres:17` o un volumen para `data/` en SQLite). Sin Docker, la generación no cambia. Frontend y fullstack quedan para la fase 2.

**Nota (2026-11-07):** la inspección estática del repositorio (HEAD `fc19490…`) indica que los Compose generados usan `postgres:17.4-alpine`, no `postgres:17`, y que el arnés de verificación usa `postgres:17-alpine`. El texto original de la decisión se conserva; la alineación queda pendiente en P-015.

**Nota (2026-11-08):** para la copia de migraciones en Docker con base de datos (`Dockerfile.db`), ver D-068. Se confirma mediante inspección que las plantillas usan `postgres:17.4-alpine` mientras que el arnés (`scripts/verify-generated.js`) usa `postgres:17-alpine`.

**Migraciones:** explícitas, como en D-037. En JavaScript: `docker compose run --rm backend npm run db:migrate`. En TypeScript: `docker compose run --rm backend node dist/db/migrate.js` (ejecuta el JS compilado; `tsx` es una devDependency y no existe en la imagen de producción). `db:generate` se ejecuta en el host antes de construir la imagen para que `drizzle/` exista en ella.

**Secretos:** `compose.yaml` no contiene valores de contraseña; `POSTGRES_PASSWORD` es obligatoria y debe ser alfanumérica.

**Requisitos:** Docker Compose v2 (`docker compose`). Sin una versión mínima verificada.

**Alternativas consideradas:** etapa o servicio de migración aparte (más complejidad); `tsx` en dependencias de producción (contradice D-037); fallback `node ... || tsx ...` (comportamiento implícito).

**Consecuencias:** `verify:generated` verifica las 6 variantes de backend con Docker; sin Docker informa «NO VERIFICADO». Los comandos de migración difieren entre ts y js y están documentados en el README del backend.

---

### D-048 — Docker solo en backend y aplicación completa

**Estado:** Confirmada (revisable).

**Decisión:** Docker y Docker Compose se ofrecen únicamente en backend y aplicación completa. La modalidad «solo frontend» no ofrece Docker.

**Motivo:** Un frontend estático suele desplegarse en hosting estático o CDN; un contenedor solo para él añade complejidad sin valor claro. En la aplicación completa, Docker permite levantar todos los servicios con un comando.

**Consecuencias:** T-013a fase 2 cubre solo fullstack. Se reevaluará si aparece una necesidad concreta.

---

### D-049 — Docker y Docker Compose en aplicación completa (T-013a, fase 2)

**Estado:** Confirmada.

**Decisión:** El CLI pregunta «¿Docker?» (por defecto No) también en aplicación completa. Con Docker genera `compose.yaml` en la raíz con los servicios `backend`, `frontend` y, según la base de datos, `postgres:17` o un volumen para `data/` en SQLite. El backend reutiliza su `Dockerfile` (D-047). El frontend se construye con `node:24.22.1-slim` y se sirve con `nginxinc/nginx-unprivileged:1.30.6-alpine-slim`, sin privilegios, con fallback SPA y proxy de `/api/` al backend quitando el prefijo (misma semántica que el rewrite de Vite de D-034). Solo el frontend publica puerto al host (8080); backend y PostgreSQL permanecen internos. Sin Docker, la generación no cambia.

**Nota (2026-11-07):** igual que en D-047, la imagen de PostgreSQL generada es `postgres:17.4-alpine` según la inspección; ver P-015.

**Nota (2026-11-08):** para la copia de migraciones en Docker con base de datos (`Dockerfile.db`), ver D-068. Se confirma que las plantillas usan `postgres:17.4-alpine` en `compose.yaml` mientras que el arnés usa `postgres:17-alpine`.

**Secretos y `.gitignore` raíz:** `POSTGRES_PASSWORD` es obligatoria, sin valor por defecto. Como Compose lee el `.env` de la raíz y los `.gitignore` de `frontend/` y `backend/` no lo cubren, con Docker se genera un `.gitignore` raíz que contiene solo `.env`. Esto matiza D-034 (fullstack sin `.gitignore` raíz): sigue sin existir cuando no se elige Docker. La plantilla se guarda como `_gitignore` y se copia con renombrado explícito, porque `copyDir()` (D-032) solo se aplica a las subcarpetas y npm descarta los `.gitignore` en los paquetes publicados.

**Lockfile:** el CLI no genera `package-lock.json`. El `Dockerfile` mantiene el fallback a `npm install`; los README y las instrucciones finales indican ejecutar `npm install` antes de `docker compose build` para fijar versiones.

**Migraciones:** explícitas, desde la raíz, con los comandos de D-047 (ts: `node dist/db/migrate.js`; js: `npm run db:migrate`).

**Consecuencias:** `verify:generated` verifica 28 variantes, con las 6 de fullstack con Docker (incluidos `/`, `/api/health` por nginx y que el backend no es accesible desde el host). Se descarta Docker para frontend solo (D-048). Verificado solo en Linux x64 con Node 24 y Docker Compose v2. La etiqueta de nginx debe revisarse periódicamente por parches de seguridad.

---

### D-050 — Documentación de API opcional con OpenAPI y Swagger UI (T-013b)

**Estado:** Confirmada.

**Decisión:** El CLI pregunta «¿Documentación de API?» (por defecto No) en backend y aplicación completa. Con ella se genera una especificación OpenAPI 3 escrita a mano y se sirve con `swagger-ui-express` en `/docs` (en fullstack, `/api/docs/`). La ruta solo se monta si `ENABLE_API_DOCS=true`; por defecto está desactivada y devuelve 404. Un test compara las rutas registradas en Express con las documentadas y falla si hay alguna sin documentar. `/docs` redirige a la ruta relativa `docs/`, de modo que la redirección funciona tras el proxy de Vite y el de nginx sin configuración adicional.

**Cadena de suministro:** `@scarf/scarf` (dependencia transitiva de `swagger-ui-dist`) declara un `postinstall` de telemetría; se deniega con `"@scarf/scarf": false` en `allowScripts`, igual que `esbuild` en D-039. Licencias: MIT y Apache-2.0.

**Motivo:** Es la opción más pequeña, estable y auditable, funciona sin red externa y no obliga a las plantillas a usar una librería de esquemas. Se descartaron Scalar (versión 0.x, 10 dependencias directas, JS desde CDN por defecto y 1.941 archivos en producción) y JSDoc (27 dependencias transitivas y parseo en ejecución).

**Consecuencias:** La especificación se mantiene a mano. El test reduce el riesgo de desincronización, pero depende de `app.router.stack`, estructura interna de Express que puede cambiar. Con la documentación activada se expone la estructura de la API: no habilitarla en producción sin una decisión explícita (su protección futura queda para T-014). Verificado en 4 variantes de `verify:generated` (32 en total) solo en Linux x64 con Node 24. En fullstack, la pasada automática no comprueba el 404 por defecto.

**Nota (2026-11-09):** con la composición de fase 1 (D-069, commit `3db1992`), `api-docs` ya no reemplaza `app.{ts,js}` ni `index.{ts,js}`. En su lugar, aporta fragmentos en `_fragments/` que se resuelven en los puntos de inserción de la base (`imports`, `routes`, `startup`). Sigue reemplazando `tsconfig.json` completo en TypeScript (ver P-012).

---

### D-051 — Override de minimatch por GHSA-g3hv-75wg-m249

**Estado:** Confirmada (temporal).

**Decisión:** Todas las plantillas base (frontend y backend, ts y js) y Brixa fijan `overrides: { "minimatch": "11.0.1" }`, que coexiste con el override de `esbuild-kit` de D-039. Todas las variantes de `verify:generated` ejecutan `npm audit --audit-level=moderate`.

**Motivo:** `minimatch <11.0.1` tiene un aviso de denegación de servicio por amplificación. Ninguna versión publicada de `eslint`, `@eslint/config-array` ni `@typescript-eslint/typescript-estree` depende ya de `minimatch >=11`, por lo que el override es la única forma de dejar `npm audit` en 0. El riesgo práctico es bajo (los patrones los escribe el desarrollador), pero un proyecto nuevo no debe mostrar avisos en el primer `npm install`.

**Consecuencias:** Es una dependencia forzada y puede quedar obsoleta. Retirar el override cuando ESLint publique versiones que dependan de `minimatch >=11.0.1`. `npm audit` puede volver a fallar por avisos nuevos sin que cambie el código. Verificado solo en Linux x64 con Node 24.

---

### D-052 — Internacionalización opcional con i18next

**Estado:** Confirmada.

**Deuda:** V1–V4 y N1–N7 se ejecutaron una vez; falta integrarlos en verify:generated.

**Contexto:** T-013c. Se compararon react-i18next, react-intl, Lingui e `Intl` + Context propio con `vite build` real (informe de investigación, 2026-10-31).

**Decisión:** i18n es opcional, desactivada por defecto, y solo se ofrece en frontend y aplicación completa. Usa `i18next` 26.5.12, `react-i18next` 17.1.9 e `i18next-browser-languagedetector` 8.2.4 (dependencias de producción, solo en proyectos que la activan).

Comportamiento: idiomas `en` y `es`, respaldo `en`, `supportedLngs` con resolución al idioma base (`es-CO` → `es`), detector restringido a `['localStorage','navigator']` con persistencia en `localStorage`, recursos JSON empaquetados con inicialización síncrona, `<html lang>` actualizado en cada cambio, selector `<select>` con etiqueta accesible que usa `resolvedLanguage`. En TypeScript, claves tipadas con `CustomTypeOptions` y `es` validado con `satisfies`. Script `check:i18n` (Node, sin dependencias) que compara claves y marcadores entre idiomas.

**Motivo:** Ecosistema maduro, formato JSON estándar, y camino de crecimiento (más idiomas, namespaces) sin reescribir los puntos de uso. El coste (+18.6 KB gzip, +6 paquetes) solo lo asume quien activa la capacidad. Se descartó la opción propia (`Intl` + Context, +0.84 KB) porque obligaría a migrar si el proyecto crece; Lingui, por su integración incompleta con Vite 8 y +80 paquetes; react-intl, porque no se necesita ICU extensivo.

**Consecuencias:**
- Brixa debe revisar las subidas de versión mayor de las tres librerías.
- Límites documentados: `<title>` estático, solo idiomas de izquierda a derecha, backend sin traducir, sin carga diferida ni namespaces.
- Variable de interpolación `val` (no `count`) para evitar plurales implícitos.
- No se necesita `resolveJsonModule` con `moduleResolution: bundler`.

**No verificado:** clic real en el selector en un navegador (comprobación manual del responsable pendiente); e2e en navegador; SSR de producción.

**Alcance de verificación (reducido):** `verify:generated` (32 variantes; corregido el 2026-11-07, el texto original decía 34) cubre i18n en 2: frontend ts y fullstack js con SQLite. Comprueba `check:i18n`, render en servidor por idioma, detección y persistencia, y cadenas en `dist/`. Quedan fuera las variantes js de frontend, fullstack ts y la de Docker. Los controles negativos (N1–N7) se ejecutaron una vez en T-013c y no son repetibles en el arnés, por lo que este no demuestra por sí mismo que detectaría un fallo de i18n. Esta deuda sigue abierta: la referencia original a T-013e no corresponde a ninguna tarea de `TASKS.md`; falta decidir si se abre esa tarea o si T-018 (`TASKS_POST_MVP.md`) absorbe el trabajo.
Nota sobre cifras: 34 era el recuento de pasos del arnés (variantes + 2 pasos auxiliares). Cifras históricas citadas en documentación previa como 16/16, 28/28 o 32/32 corresponden a pasos del arnés en distintas etapas del desarrollo, siendo 32 las variantes reales verificadas.

---

### D-053 — Combinaciones no verificadas marcadas como experimentales

**Estado:** Confirmada.

**Contexto:** El CLI permite 76 combinaciones de modalidad, lenguaje y capacidades, y 32 están verificadas por `verify:generated`. ARCHITECTURE §13 exige que las no verificadas estén deshabilitadas o identificadas como experimentales.

**Aclaración sobre magnitudes (2026-11-08):** «76 combinaciones» y «76 pares válidos» son magnitudes distintas que coinciden numéricamente:
- Las **76 combinaciones** del CLI corresponden al espacio de proyectos generables respetando las restricciones del CLI: 4 en frontend (2 lenguajes × 1 bd:none × 1 docker:false × 1 docs:false × 2 i18n), 24 en backend (2 lenguajes × 3 bd × 2 docker × 2 docs × 1 i18n:false) y 48 en fullstack (2 lenguajes × 3 bd × 2 docker × 2 docs × 2 i18n).
- Los **76 pares válidos** (denominador de cobertura pairwise 2-a-2) surgen de los 81 pares teóricos entre los 6 parámetros menos 5 pares inválidos por restricciones del CLI (frontend con postgres/sqlite/docker/docs, y backend con i18n).
- De los 76 pares válidos, las 32 variantes verificadas cubren **73 pares (96,05%)**.
- Los **3 pares sin cubrir** son: `database=postgres & i18n=true`, `docker=true & i18n=true` y `apiDocs=true & i18n=true`. La causa es que en `VERIFIED_VARIANTS` solo 2 variantes activan i18n (`frontend+ts+i18n` y `fullstack+js+sqlite+i18n`), ambas con `docker: false`, `apiDocs: false`, y con bases de datos `none` y `sqlite`. Ninguna variante verificada combina `i18n: true` con `postgres`, `docker` o `apiDocs`.

**Decisión:** El CLI no bloquea las combinaciones no verificadas, pero las identifica como EXPERIMENTALES en el resumen previo a la generación y en el mensaje final. Hay una lista única de variantes verificadas (`src/verified-variants.ts`) y el arnés comprueba que coincide exactamente con sus variantes; si difieren, falla.

**Consecuencias:** Los usuarios mantienen la libertad de elegir. Al añadir una variante al arnés hay que añadirla a la lista. P-005 se reformula: las combinaciones declaradas como soportadas pasan la verificación y el resto son experimentales.

---

### D-054 — Aviso de terceros de create-vite y plantillas generadas

**Estado:** Confirmada (revisable).

**Contexto:** Las plantillas de frontend derivan de `create-vite` 9.3.3 (licencia MIT): `App.*`, `*.css`, `assets/*` (incluido `hero.png`), `public/*`, `index.html`, `package.json`, `README.md` y configuraciones. `eslint.config.js` no procede de create-vite (usa `_oxlintrc.json`).

**Decisión:** El paquete de Brixa incluye `THIRD_PARTY_NOTICES.md` con el aviso de copyright y el texto de la licencia MIT copiados del paquete `create-vite`. Los proyectos generados no incluyen ese aviso.

**Motivo:** El responsable prevé sustituir la página de inicio y los logotipos de la plantilla al añadir las capacidades posteriores (T-014), por lo que no quedaría material sustancial de create-vite en los proyectos generados.

**Consecuencias:** La licencia MIT exige conservar su aviso en copias y partes sustanciales; mientras los proyectos generados mantengan archivos derivados de create-vite, la omisión es un riesgo bajo asumido y no consta revisión legal. Reevaluar cuando se sustituya la plantilla o si se decide incluir el aviso en los proyectos generados. Los logotipos de Vite y React quedan sujetos a las condiciones de sus proyectos (no verificado).

---

### D-055 — CI con GitHub Actions y verificación por alcance

**Estado:** Confirmada. Matriz completa en verde el 2026-11-02 (run #8, commit `9ece94d`): Ubuntu, Windows y macOS con Node 24 y 26.

**Decisión:**
- Workflow `.github/workflows/ci.yml` con `permissions: contents: read`, acciones fijadas por SHA de commit (comprobado con `git ls-remote`), `fail-fast: false` y `shell: bash` por defecto.
- Job `test` en matriz: `npm ci`, typecheck, lint, format:check, test, build, `npm pack` con comprobación de contenido y `VERIFY_SCOPE=portable npm run verify:generated` (15 variantes sin Docker ni PostgreSQL). Matriz: Ubuntu, Windows y macOS con Node 24 y 26 (6 jobs).
- Job `verify-full` (Docker y PostgreSQL, `VERIFY_SCOPE=full`) solo con `workflow_dispatch`, en Ubuntu.
- `verify:generated` acepta `VERIFY_SCOPE=portable|full` (por defecto `full`). La comprobación de D-053 compara siempre contra la lista completa antes de filtrar. El contenedor de PostgreSQL solo se arranca si alguna variante seleccionada lo necesita.
- Arnés adaptado a Windows (`npm.cmd` con `shell: true`, `pathToFileURL` en `import()` dinámicos, rutas con `path`, cierre del árbol de procesos con `taskkill`, directorio temporal en ruta larga). Verificado en la CI de Windows con Node 24 y 26 para las variantes portable, incluidas las de SQLite.

**Defectos encontrados y lecciones:**
- `NODE_ENV` heredado: `createServer` de Vite dejaba `NODE_ENV=development` en el proceso del arnés y los builds posteriores empaquetaban React en modo desarrollo. Toda verificación que use Vite dentro del arnés se ejecuta en un subproceso (V2 y V3 de i18n).
- Lockfile desactualizado: al añadir el override de `minimatch` (D-051) no se regeneró `package-lock.json` y `npm ci` falló en la CI. Tras cambiar `overrides`, ejecutar `npm install` y comprobar `npm ci --dry-run` antes de subir.
- `npm pack` con `prepack`: la salida de `build` se mezclaba con stdout y el nombre del tarball salía corrupto; además `! tar | grep` no hacía fallar el paso. Se usa `npm pack --ignore-scripts` y un `if` explícito.
- Timeout de Vite en el runner: el arnés arranca ahora Vite con `--host 127.0.0.1` y sondea esa misma dirección; al agotar el tiempo muestra la salida de Vite y del backend. La causa exacta no está confirmada (hipótesis: `localhost` resolvía a `::1`); el cambio resolvió el fallo.

- Tests con rutas POSIX: seis tests comparaban rutas literales como `/home/user/...` y fallaron en Windows; los valores esperados se calculan con `path.resolve`.
- Ruta temporal corta de Windows: la carpeta temporal del runner (`C:\Users\RUNNER~1\...`) hacía que Vite rechazara servir el proyecto («outside of Vite serving allow list»), y la limpieza posterior fallaba con `EPERM` porque Vite seguía vivo y ocultaba el error original. Se corrigió en el arnés con la ruta larga y el cierre del árbol de procesos (commit `9ece94d`).
- `format:check` también revisa `.github/workflows/ci.yml`: formatear el workflow con Prettier antes de subirlo.
- Las acciones fijadas (`checkout` v4.2.2 y `setup-node` v4.2.0) usan Node 20 y GitHub avisa de su deprecación (hoy se ejecutan forzadas en Node 24). El aviso de caché 409 entre jobs de la matriz es inocuo.

**Consecuencias:** Un fallo de la CI puede deberse a avisos nuevos de `npm audit` sin que cambie el código. Las variantes con PostgreSQL y Docker solo se verifican en Linux, de forma manual (D-045); el job `verify-full` pasó en verde el 2026-11-02 (32 variantes, Ubuntu, Node 24). Compatibilidad verificada: Ubuntu, Windows y macOS con Node 24 y 26 para las 15 variantes portable. La instalación del tarball en un Windows real no se prueba (D-057).

---

### D-056 — Contenido del paquete npm

**Estado:** Confirmada.

**Decisión:** `package.json` define `files` con `dist/` (que incluye las plantillas copiadas por `build`) y los documentos de licencia, aviso de terceros, seguridad y README. `prepack` ejecuta `npm run build` para que el tarball nunca salga sin `dist/`. El tarball no contiene `src/`, pruebas, `scripts/`, `.agents/` ni archivos de configuración del repositorio. Comprobado con `npm pack --dry-run` (158 archivos, 87,5 kB) y con una instalación del `.tgz` en un directorio temporal que llega al primer prompt.

**Motivo:** Sin `files`, npm usaba `.gitignore` como lista de exclusión, omitía `dist/` y publicaba el código fuente y la documentación interna.

**Consecuencias:** La instalación del tarball en Windows no se prueba en un equipo real (D-057). `engines` (`^24.0.0 || >=26.0.0`) queda confirmado por la CI: Node 26 pasa en los tres sistemas.

---

### D-057 — Windows real no es criterio de aceptación de 0.1.0

**Estado:** Confirmada (2026-11-02). Matiza D-045 y P-005.

**Decisión:** No se exige instalar el tarball en un Windows real antes de publicar `0.1.0`. La compatibilidad con Windows se declara solo con lo verificado en la CI (`windows-latest`, Node 24 y 26, 15 variantes sin Docker ni PostgreSQL).

**Motivo:** El responsable no dispone de una máquina con Windows y la CI ya ejecuta en Windows el generador, sus pruebas y los proyectos generados.

**Consecuencias:** Queda sin cubrir la instalación global del paquete publicado y el uso interactivo del CLI en una terminal real de Windows; el README lo indica como limitación. Se reevalúa si llegan reportes de usuarios de Windows. Una prueba de humo del binario instalado desde el tarball en la CI sería una alternativa barata.

---

### D-058 — Banner de arranque y avisos experimentales más breves

**Estado:** Confirmada.

**Contexto:** El arranque del CLI era un prompt seco y el aviso de combinación experimental (D-053) salía dos veces, en bloque y con un tono que sugería más inestabilidad de la real.

**Decisión:** Al iniciar en una terminal interactiva, el CLI muestra un banner en un recuadro de ancho fijo (47 columnas) con el logo, la versión y el lema, en índigo y gris. No se muestra si la salida no es una terminal (`isTTY`) ni con `TERM=dumb`. `NO_COLOR` quita el color pero no el banner. En terminales de menos de 53 columnas se muestra sin recuadro. Los avisos experimentales pasan a una línea antes de generar y otra al final, esta con enlace a los issues. D-053 y ARCHITECTURE §13 siguen cumplidos: las combinaciones no verificadas se identifican como experimentales.

**Motivo:** Mejor primera impresión sin dependencias nuevas (solo códigos ANSI), y avisos honestos pero menos alarmantes.

**Consecuencias:** El banner no tiene animaciones ni emojis. Los tests comprueban el texto nuevo de los avisos. El GIF del README se regenera con `docs/demo.tape` (requiere VHS) si cambia el banner o el flujo de preguntas. Una combinación verificada no muestra ningún aviso.

---

### D-059 — Publicación de 0.1.0 bloqueada por similitud de nombre; espera y plan B

**Estado:** Reemplazada parcialmente por D-060 (2026-11-07). Siguen vigentes el contexto del bloqueo y lo relativo a 2FA y token; dejan de aplicar el plan B con scope, la prohibición de etiquetar `v0.1.0` y la restricción de no tocar plantillas hasta publicar. Matiza D-046.

**Contexto:** El 2026-11-02 `npm publish` de `brixa` devolvió 403: «Package name too similar to existing package urix». `npm view brixa` no detecta esta política; solo aparece al publicar. `urix` está obsoleto (última publicación en 2022, repositorio archivado en 2023), hace otra cosa (normalizar rutas de Windows) y es de otro autor.

**Decisión:** Se envía una reclamación a soporte de npm y se espera hasta el 2026-11-09. Si no hay respuesta favorable, el paquete se publica como `@acjoell/brixa` con acceso público; el comando instalado sigue siendo `brixa` y el producto y el repositorio siguen llamándose Brixa. Mientras tanto no se etiqueta `v0.1.0` ni se cambia la versión de `package.json`. El diseño de T-014 puede empezar sin tocar código del paquete.

**Consecuencias:** Si se publica con scope hay que cambiar `name` en `package.json`, el lockfile, el README (`npx @acjoell/brixa`) y T-015, y repetir `npm publish --dry-run`. El README actual dice `npx brixa`, que no funciona hasta resolverlo. La cuenta de npm solo ofrece llaves de seguridad como método de 2FA y no hay hardware disponible; el intento de publicación usó un token granular temporal con omisión de 2FA, ya revocado. Para publicar habrá que crear otro token con caducidad corta y revocarlo después. Pendiente: configurar la 2FA y evaluar Trusted Publishing.

---

### D-060 — Congelación de 0.1.0 mediante tag y pre-release; nombre `brixa` sin scope

**Estado:** Confirmada (2026-11-07). Reemplaza parcialmente a D-059.

**Contexto:** `npm publish` de `brixa@0.1.0` devolvió 403 por similitud de nombre (D-059). El propietario decidió mantener el nombre y esperar la respuesta de npm, sin detener el desarrollo.

**Decisión:**
- El paquete se llama `brixa`, sin scope. El plan B `@acjoell/brixa` queda descartado. Si npm rechazara el nombre de forma definitiva se abrirá una decisión nueva; no hay alternativa asumida.
- El commit `fc1949068373220cc1048deb6f0f6eb0ac88870f` (CI en verde confirmada por el propietario; `package.json` en `0.1.0`) se conserva como versión 0.1.0 mediante un tag anotado `v0.1.0` y un GitHub Release `Brixa v0.1.0` marcado como pre-release.
- No se usa `v0.1.0-rc.1`: el sufijo `-rc.1` formaría parte de la versión SemVer y exigiría otro `package.json`, de modo que lo publicado ya no coincidiría con lo etiquetado. La marca de pre-release es un atributo del Release de GitHub, no de la versión ni del tag.
- `main` puede avanzar. El tag no se mueve, no se borra y no se reutiliza. Si hay que corregir el código congelado, se crea otro commit y otro tag con la versión que se apruebe (por ejemplo `0.1.1`).
- Cuando npm autorice, la publicación se hace desde un checkout limpio del tag, nunca desde un `main` posterior. Después, el Release pasa de pre-release a estable sin tocar el tag.

**Estado de ejecución:** el propietario informó el 2026-11-07 de que el tag está creado y de que se completaron las verificaciones de T-019. Los datos del informe de Antigravity (objeto del tag, URL del Release, estado de la protección de tags `v*`) no figuran en los documentos revisados al redactar esta entrada: deben registrarse en T-019.

**Consecuencias:**
- La restricción de D-059 y de T-014 («no tocar plantillas hasta publicar 0.1.0») pasa a ser «0.1.0 preservada por tag».
- El README del tag dice `npx brixa`, que no funciona hasta publicar; las notas del Release lo advierten.
- El código fuente del tag y el tarball publicado en npm son artefactos distintos: no se afirma igualdad byte a byte.
- Crear reglas de protección de tags es un cambio de configuración del repositorio que no estaba incluido en la autorización de la operación.
- La versión que declara `package.json` en `main` tras el tag y una guarda contra publicaciones accidentales desde `main` siguen pendientes (P-016).

---

### D-061 — Zod obligatorio en el backend

**Estado:** Confirmada como decisión de producto. Implementación pendiente.

**Decisión:** Todo proyecto con backend incluirá Zod como dependencia, usada desde el inicio para validar la configuración central del servidor (no como dependencia sin uso), y para validar `body`, `params` y `query`.

**Estado real (inspección 2026-11-07):** Zod no está instalado en las plantillas ni en el CLI. La implementación se planifica en T-017b.

**Pendiente de evidencia:** versión concreta (INV-02 estudió 4.6.7 sin fuente registrada); validación de variables de entorno (una cadena vacía no debe convertirse en 0, p. ej. `PORT`); dónde guardar los datos validados, porque `req.query` es de solo lectura en Express 5 (reportado en INV-02); política de propiedades desconocidas; que los errores no filtren datos.

---

### D-062 — Dependencias de verificación: caché npm compartida e instalaciones independientes

**Estado:** Confirmada. Optimización aplazada, no descartada para siempre.

**Decisión:** Los proyectos de prueba conservan su propio `node_modules`, cada instalación es independiente y se reutiliza la caché compartida de npm. La reutilización de `node_modules` mediante symlinks se aplaza y no forma parte de ningún plan actual.

**Motivo:** Priorizar la reproducibilidad y el aislamiento físico de cada variante.

---

### D-063 — Modelo genérico de identidad y acceso (dirección)

**Estado:** Confirmada como dirección. Detalles resueltos en D-080 a D-086 (P-011).

**Decisión:** Las futuras capacidades de autenticación, autorización y multitenancy se modelan con estos conceptos separados: **usuario** (identidad global), **organización** (contexto de administración y aislamiento de datos), **concesión de acceso** (relación que determina a qué organización puede acceder un usuario; se evita el término «membresía» por su connotación comercial), **roles**, **permisos** y **alcances** de autorización (sistema, organización y, si se decide, unidad o recurso).

**No se presupone:** suscripciones, planes ni límites comerciales; que cada usuario pertenezca a una sola organización; que cada organización sea un cliente que paga; una jerarquía empresarial obligatoria; un campo `isActive` universal. Los roles globales y los organizacionales no se mezclan automáticamente.

**Detalles consolidados:** los estados de la concesión de acceso (`revoked_at`), los alcances de la primera versión (aplicación y organización), la relación N:M, el paso explícito de `ActorContext` y el primer administrador (bootstrap local seguro) quedan fijados en las decisiones D-080 a D-086.

---

### D-064 — Alcance de seguridad y autorización posterior a 0.1.0

**Estado:** Confirmada en alcance (aprobada por el propietario el 2026-11-04; registrada el 2026-11-07; alcance de registro público modificado formalmente por D-086; alcance de transporte precisado por D-089). Los detalles técnicos pendientes continúan resolviéndose según evidencia y decisión.

**Decisión:** El trabajo de T-014 se divide y se registra en `TASKS_POST_MVP.md`: diseño previo (T-014-0); autenticación con dos opciones en el CLI, cookies o Bearer, sobre un núcleo común (T-014a) y sus vistas en aplicación completa (T-014a-ui); RBAC con motor, API administrativa y auditoría mínima (T-014b1) y panel de administración (T-014b2); multitenancy con PostgreSQL RLS, **independiente de RBAC** (T-014c); integración de RBAC con multitenancy (T-014d). Antes de ellas: composición de overlays (T-017a, T-017a-ui), seguridad base con Zod (T-017b) y arnés de verificación (T-018).

**Reglas de alcance aprobadas:** multitenancy solo con PostgreSQL en esta etapa (SQLite sin multitenancy); multitenancy requiere autenticación de Brixa o una identidad externa verificada; se mantienen JavaScript y TypeScript para toda capacidad; quedan fuera de esta etapa MFA, OAuth/SSO, auditoría avanzada, registro público y recuperación de contraseña (salvo razón importante), integración con proveedores de identidad externos (solo contrato) y MongoDB.

**Nota de modificación de alcance (D-086):** El alcance relativo al registro público fue modificado expresamente por D-086: se admite como opción en el CLI exclusivamente para proyectos con autenticación sin multitenancy (manteniendo registro administrado como predeterminado), implementado de forma posterior al núcleo de Auth y sujeto a controles de seguridad. Se mantiene fuera de alcance la creación pública de organizaciones y el registro público para multitenancy.

**Nota de precisión de alcance sobre transporte (D-089):** El alcance relativo a los transportes de autenticación fue precisado expresamente por D-089: en fullstack (React + Express) se generan exclusivamente cookies en v1 (Bearer no se ofrece en fullstack); en backend independiente se selecciona entre cookies o Bearer, sin admitir mezcla simultánea en un mismo proyecto ni soporte automático general de cookies cross-site en v1.

**Nota de consolidación de decisiones RLS (D-094 a D-097):** Las cuatro decisiones arquitectónicas de PostgreSQL RLS (roles y privilegios separados, contexto transaccional, políticas e integridad, y verificación con auditoría operativa y de acciones) quedan fijadas en D-094 a D-097 tras INV-04a.

**Nota de aprobación de estrategia JS/TS (D-098):** La estrategia JavaScript/TypeScript queda aprobada formalmente como híbrido versionado con TypeScript como fuente de verdad y derivación determinista mediante Babel/AST (D-098 tras INV-05b e INV-08); la implementación del derivador y su comando de verificación (`verify:sync`) permanece pendiente en T-023 como requisito previo a la codificación de las plantillas de Auth y RBAC.

**Pendiente de evidencia o decisión:** versión de Zod, almacén de contadores de abuso, comprobación de soporte de sintaxis RLS en el Drizzle Kit fijado (T-014c), parámetros específicos de expiración y rotación de sesiones, reglas de delegación e invitaciones, y forma del esquema (ver P-008 a P-017; hash de contraseñas resuelto por D-091 a D-093; RLS y auditorías resueltas por D-094 a D-097; estrategia JS/TS resuelta en D-098 con implementación en T-023).

---

### D-065 — Verificación de capacidades de seguridad

**Estado:** Confirmada en alcance (2026-11-04; registrada el 2026-11-07).

**Decisión:** Cada capacidad de seguridad llega con pruebas positivas y negativas. Se distinguen `verify:generated` (matriz base), `verify:security` (pruebas profundas) y `verify:all` (ambas; una publicación lo exige en verde). Las mutaciones y los controles negativos viven en el arnés de Brixa sobre copias temporales y no forman parte del proyecto generado. Una combinación con autenticación, RBAC o multitenancy que no haya superado `verify:security` se marca EXPERIMENTAL (D-053).

**Motivo:** Ninguna capacidad se considera segura por compilar, generar archivos o pasar `verify:generated`.

---

### D-066 — Versiones exactas y cadencia de actualización

**Estado:** Confirmada (2026-11-08).

**Contexto:** En la prueba P1 se constató que el backend fijaba versiones exactas mientras el frontend utilizaba rangos (`^`, `~`). Esto generaba deriva de versiones entre subproyectos de una misma aplicación fullstack (`eslint` 10.14.0 en frontend vs 10.13.0 en backend, `typescript-eslint` 8.72.1 vs 8.72.0, `@types/node` 24 vs 26). Las dependencias transitivas permanecen sin fijar porque las plantillas no incluyen lockfile, y `verify:generated` prueba lo que npm resuelve el día en que se ejecuta.

**Decisión:** Las dependencias directas de TODAS las plantillas se fijan con versión exacta, como ya hace el backend. Las imágenes Docker mantienen etiqueta exacta. Las versiones se actualizan con un proceso periódico explícito (revisión de avisos y versiones, npm audit y `verify:generated` antes de adoptar). No se genera lockfile en el CLI. No se añade Dependabot/Renovate (pendiente de decisión).

**Motivo:** El riesgo en una herramienta de generación de código (scaffolding) está en no actualizar, no en fijar. Fijar versiones directas exactas garantiza reproducibilidad determinista día a día y evita que subidas menores o de parche rompan proyectos generados inesperadamente.

**Consecuencias:** Alguien debe ejecutar la revisión periódica explícita; sin ella las versiones quedan obsoletas con el tiempo. La política de D-049 (no generar lockfile en el CLI) se mantiene. La deriva existente de versiones entre frontend y backend queda registrada como cuestión pendiente de alineación.

**Alternativas descartadas:**
- Rangos (`^`, `~`) o etiquetas flotantes en imágenes: descartados por romper la reproducibilidad y provocar fallos imprevistos en proyectos generados.
- Lockfile por variante en el repositorio/plantillas: descartado porque el CLI compone y fusiona dependencias dinámicamente; sincronizar 32+ lockfiles añadiría una alta fragilidad y coste de mantenimiento.
- `npm install --package-lock-only` en el CLI durante la generación: descartado para no ralentizar la ejecución con llamadas de red ni asumir acceso continuo a Internet.

---

### D-067 — Redacción central de secretos

**Estado:** Confirmada.

**Contexto y Decisión:** Se centraliza la redacción de secretos en un único módulo `src/redact.{ts,js}` dentro de la plantilla base de backend, importado por los migradores y utilizado en el manejador global de errores mediante `redact(inspect(err, { depth: 5 }))`. Cubre credenciales en URLs (sección `userinfo`) y parámetros `authToken=` / `token=`. NO cubre cabeceras `Authorization`, `password=`, tokens de sesión ni errores de arranque fuera de peticiones HTTP. Ampliar este alcance es requisito obligatorio antes de incorporar autenticación.

**Commit:** `1b6f7ad86ddbbc4283713cea2d063157cc5d15de` (`1b6f7ad`). Cierra la deuda de T-012a al importar el test la función real de la plantilla en lugar de una copia local.

---

### D-068 — Dockerfile con base de datos copia solo drizzle/

**Estado:** Confirmada.

**Contexto y Decisión:** Para variantes con base de datos (PostgreSQL o SQLite) y Docker, el archivo `Dockerfile` (copiado desde `docker/{ts,js}/Dockerfile.db`) realiza `COPY drizzle/` de forma estricta, fallando la construcción si el directorio no existe en el host (debe ejecutarse `npm run db:generate` antes de `docker compose build`). Anteriormente se copiaba con comodín `drizzle*`, lo cual capturaba `drizzle.config.*` cuando `drizzle/` no existía, permitiendo que la construcción pasara y `db:migrate` terminara con éxito ficticio sin aplicar migraciones. Para variantes sin base de datos no existe referencia a `drizzle`.

**Commit:** `9783be7909859a9a4797d6361724e8c5647ab8c1` (`9783be7`).

---

### D-069 — Composición de overlays: fase 1 (backend)

**Estado:** Confirmada (2026-11-09).

**Contexto:** Los overlays reemplazaban archivos completos de la plantilla base o los modificaban mediante sustituciones frágiles de texto. Se necesitaba un mecanismo determinista y seguro para que múltiples capacidades puedan contribuir a los mismos archivos de backend sin pisarse (T-017a).

**Decisión:**
- Marcadores de inserción con nombre en `src/app.{ts,js}` y `src/index.{ts,js}` de las plantillas backend base: `// @@INSERT:imports@@`, `// @@INSERT:routes@@` y `// @@INSERT:startup@@`.
- Resolución implementada en `src/generator/insertions.ts` (`validateContributions`, `resolveInsertionPoints`, `cleanupInsertionPoints`).
- Orden determinista entre contribuciones de un mismo punto ordenado por punto de código UTF-16 del nombre del contribuyente (`compareCodePoints`, no `localeCompare`).
- Validación estricta: contribución duplicada (mismo punto y contribuyente), contribución a un punto inexistente o marcador desconocido/sin resolver en la salida lanzan error inmediato.
- Marcadores declarados sin contribuyentes se eliminan limpiamente de la salida sin dejar rastro ni líneas en blanco.
- Fragmentos como archivos reales: `api-docs` aporta fragmentos en `_fragments/` (`app.imports`, `app.routes`, `index.imports`, `index.startup`), excluidos automáticamente de la copia recursiva (`copyDir` omite toda entrada con prefijo `_`, salvo `_gitignore` y `_dockerignore`).
- Fusión determinista de `package.json` en `src/generator/generate.ts` (`mergeSection`): compara claves comunes mediante igualdad profunda (`deepEqual`). Si coinciden, conserva el valor; si difieren, lanza error indicando la clave en conflicto y el contribuyente.
- Criterio de verificación: las 32 variantes verificadas generan un árbol idéntico al estado previo, salvo por la introducción de `validate-env` en `api-docs`.

**Límites de la fase 1:**
- `api-docs` todavía reemplaza `tsconfig.json` completo en TypeScript.
- `.env.example`, `compose.yaml` y los archivos de frontend (`App`, `main`, `vite.config`) permanecen sin puntos de inserción.
- El orden por nombre de contribuyente es arbitrario; cuando un overlay dependa semánticamente de otro será necesario declarar un orden de dependencias explícito.

**Commit:** `3db19925c2ffd13da06f0b5b02cc618269877bbc` (`3db1992`).

---

### D-070 — Validación de configuración con Zod 4.6.7 en backend

**Estado:** Confirmada (2026-11-09).

**Contexto:** Se requería dotar a los proyectos backend de validación estricta de variables de entorno y tipos comprobados sin imponer configuraciones estáticas monolíticas ni dependencias de esquemas en handlers sin uso (T-017b).

**Decisión:**
- Zod 4.6.7 fijado con versión exacta como dependencia obligatoria de producción en todas las plantillas backend (`backend-express-ts` y `backend-express-js`).
- Cada capacidad valida su propia configuración (descentralizada): el núcleo base valida `PORT` en `src/config.{ts,js}`; `api-docs` valida `ENABLE_API_DOCS` en `src/docs/validate-env.{ts,js}`.
- Ayudas compartidas en `src/config.{ts,js}`: `portSchema` (entero entre 0 y 65535, por defecto 3000; cadena vacía no se transforma en 0), `strictBooleanSchema` (acepta booleano o `"true"`/`"false"` explícitos, nunca `z.coerce.boolean`), y `formatConfigError`.
- `parseConfig` es puro y devuelve la configuración tipada; solo `src/index.{ts,js}` captura el error y llama a `process.exit(1)`.
- Los mensajes de error de configuración nunca imprimen valores recibidos ni variables sensibles.
- No se genera middleware validador automático ni esquemas vacíos de `body`/`params`/`query`: la validación se realiza en el handler mediante `schema.parse` o la ayuda `parseInput`.
- Convención de propiedades desconocidas (documentada y probada): `body` y `params` se validan con `z.strictObject` (rechaza desconocidas); `query` se valida descartando propiedades desconocidas (`z.object` normal).
- La validación de `DATABASE_URL` al importar el cliente de base de datos no cambia y sigue rigiéndose por D-038.

**Commit:** `702f477b2f79cb91b5afa05481e80221678d86aa` (`702f477`).

---

### D-071 — Contrato uniforme de errores HTTP y 404 en JSON

**Estado:** Confirmada (2026-11-09).

**Contexto:** Los proyectos backend carecían de un contrato de errores consistente: las rutas inexistentes devolvían el 404 HTML por defecto de Express y los errores internos podían filtrar trazas o mensajes no deseados al cliente (T-017b).

**Decisión:**
- Módulo central `src/errors.{ts,js}` en las plantillas backend.
- Clase `ValidationError` propia: solo almacena `path` y `code` por incidencia a partir de `z.ZodError`; no incluye `cause` ni valores ingresados.
- `ValidationError` produce exclusivamente respuestas HTTP 400 (`{"error": "Bad Request", "details": [...]}`).
- Un `ZodError` no capturado que alcance el manejador global responde 500 para evitar fugas no intencionadas.
- Respuestas 4xx con texto fijo según estado: `400` ("Bad Request"), `401` ("Unauthorized"), `403` ("Forbidden"), `404` ("Not Found") y `413` ("Payload Too Large").
- Cualquier otro código o error no controlado responde `500` ("Internal Server Error"). Nunca se devuelve `err.message` ni trazas de pila al cliente.
- Manejador `notFoundHandler` registrado antes de `errorHandler` que responde `404` en formato JSON (`{"error": "Not Found"}`).
- Si `res.headersSent` es verdadero, se delega al mecanismo predeterminado de Express llamando a `next(err)`.
- El registro de errores en consola (`console.error`) aplica siempre `redact(inspect(err, { depth: 5 }))`.

**Commit:** `2bd09b9437e0261c5eedc2b257c1a2a046fbd508` (`2bd09b9`).

---

### D-072 — Prettier en plantillas backend y format:check en el arnés

**Estado:** Confirmada (2026-11-09).

**Contexto:** Las plantillas backend incorporaron archivos con líneas superiores a 80 caracteres. Aunque v0.1.0 superaba la verificación porque las plantillas cumplían las reglas de estilo de manera accidental, el arnés de verificación (`scripts/verify-generated.js`) no ejecutaba `format:check` en los proyectos generados y el `.prettierignore` del CLI excluía `src/templates/`. Al ejecutarse comprobaciones de formato en proyectos generados, surgieron fallos de formato.

**Decisión:**
- Añadir `.prettierrc` (`printWidth: 100`, idéntico en el resto al CLI) y `.prettierignore` (`dist/`, `node_modules/`, `coverage/`, `package-lock.json`, `*.md`) a las plantillas backend (`backend-express-ts` y `backend-express-js`).
- Declarar `prettier` (versión exacta 3.9.10) en `devDependencies` y el script `"format:check": "prettier --check ."` en `package.json` de las plantillas backend.
- El arnés de verificación (`scripts/verify-generated.js`) ejecuta `npm run format:check` en todas las variantes con backend (backend independiente y subproyecto backend en fullstack).
- La plantilla frontend no declara `prettier` ni script `format:check` en esta etapa (cuestión pendiente).

**Commit:** `2bd09b9437e0261c5eedc2b257c1a2a046fbd508` (`2bd09b9`).

---

### D-073 — Ampliación de redact y aplicación en arranque y cierre

**Estado:** Confirmada (2026-11-14).

**Contexto:** `src/redact.{ts,js}` cubría únicamente URLs con credenciales y los parámetros de query `authToken=` / `token=` (D-067). Antes de conectarlo al manejador global de errores era necesario ampliar las reglas para cubrir cabeceras de autorización, cookies y tokens comunes. Las cuatro plantillas de base de datos importaban el módulo central ya existente; no hay copias locales.

**Decisión:**
- `redact` ampliado con cinco grupos de reglas (en orden de aplicación):
  1. URLs con credenciales (esquema`://user:pass@`).
  2. Cabeceras `Authorization` y `Proxy-Authorization` (soporta `Bearer`, `Basic` y valor sin esquema).
  3. Tokens Bearer independientes (`Bearer <valor>`).
  4. Cabeceras `Cookie` y `Set-Cookie` (valor único, entrecomillado o array).
  5. Claves sensibles por nombre: `password`, `access_token` / `accessToken`, `refresh_token` / `refreshToken`, `auth_token` / `authToken`, `token`, y cualquier clave que termine en `_secret` o `secret` — valores entrecomillados (5a) y sin comillas (5b).
- El módulo `redact` se aplica también en los mensajes de error de arranque (`parseConfig` en `src/index.{ts,js}`) y en el mensaje de cierre (`server.close`).
- Las cuatro plantillas de base de datos siguen importando el módulo central `src/redact` sin copias locales (ya era así desde D-067).
- `express.json({ limit: "100kb" })` sustituye a `express.json()` sin límite. Las respuestas 413 y 400 siguen el contrato uniforme de D-071.
- Nginx: `server_tokens off;` en el bloque `server` de la plantilla fullstack Docker. Verificado con `curl -I` por el propietario: la cabecera `Server` responde `nginx` sin versión en 200 y en 404.

**Motivo:** `redact` era el único punto de acción antes de tener un manejador global completo; ampliar su cobertura reduce el riesgo de exposición en los mensajes de log más críticos (arranque, cierre) sin añadir dependencias.

**Consecuencias:** `redact` cubre las cabeceras y tokens más habituales. No es un filtro universal: nombres de clave como `apiKey`, `privateKey`, `clientSecretKey` o valores PEM multilínea no están cubiertos (pendiente, ver sección 5). Existen riesgos de ReDoS en la regla de URLs (sin límite de longitud de esquema) y en la regla de valores entrecomillados con comilla sin cierre (ver sección 5). `redact` es una defensa adicional, no la única barrera contra la fuga de secretos.

**Alternativas consideradas:** filtrado por clave en un mapa fijo (descartado por rigidez ante nombres no estándar); uso de una biblioteca de redacción de terceros (descartado por no justificar la dependencia en este momento).

**Commit:** `4295376` (2026-11-14).

---

### D-074 — Helmet, CORS y CSP en el backend generado

**Estado:** Confirmada (2026-11-14).

**Contexto:** Los proyectos backend generados no emitían cabeceras de seguridad HTTP ni tenían política de CORS. Se añaden como parte del endurecimiento de T-017b, usando las bibliotecas evaluadas en INV-02.

**Decisión:**
- **Helmet 8.3.0** instalado con versión exacta como dependencia de producción en `backend-express-ts` y `backend-express-js`. `cors 2.8.6` como dependencia de producción. `@types/cors 2.8.19` en `devDependencies` de la variante TypeScript.
- **CSP global del backend** (aplica a todas las rutas salvo `/docs`): `useDefaults: false`, `default-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`. Sin otras directivas por defecto.
- **HSTS desactivado** (`hsts: false`) a propósito: Brixa no controla dónde termina TLS; activar HSTS en un servidor que puede estar detrás de un proxy sin TLS introduciría un riesgo en lugar de mitigarlo.
- **CSP específica de Swagger** (ruta `/docs`): `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (única excepción, necesaria para Swagger UI), `img-src 'self' data:`, `connect-src 'self'`, `font-src 'self' data:`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. `validatorUrl: null` en la configuración de Swagger UI para evitar solicitudes externas.
- **CORS desactivado por defecto.** Si `CORS_ALLOWED_ORIGINS` no está definida o está vacía, el middleware no se registra. La variable se valida con Zod: solo acepta URLs HTTP o HTTPS válidas sin rutas, barras finales ni comodines; rechaza `*` y `null`. Se añade `Vary: Origin` solo cuando el middleware está activo y autoriza un origen. Sin `credentials: true`.
- Zod ya era dependencia de producción desde D-070 (`702f477`); en este commit se añade `corsAllowedOriginsSchema` al esquema de configuración existente.
- **X-Frame-Options del backend** es `SAMEORIGIN` (valor por defecto de Helmet), distinto del `DENY` de la SPA. Esta diferencia es conocida y está pendiente de unificar (ver sección 5).

**Motivo:** Helmet con CSP estricta y CORS denegado por defecto son el mínimo razonable antes de añadir autenticación. El valor `'none'` para `default-src` en la API REST no tiene impacto funcional (el backend no sirve recursos cargados por el navegador) y aporta la máxima restricción.

**Consecuencias:** Proyectos generados con backend emiten cabeceras de seguridad desde el primer arranque. El desarrollador debe declarar `CORS_ALLOWED_ORIGINS` explícitamente para habilitar CORS. HSTS no se activa: quien termine TLS en el servidor debe configurarlo en su proxy o añadirlo manualmente. Los tests del generador verifican la presencia y el contexto de las cabeceras.

**Verificaciones realizadas [NO VERIFICADO EN NAVEGADOR / PENDIENTE]:** verify:generated completo (todas las variantes): realizado por el propietario, en verde. CSP de Helmet en `/api/health` con el stack Docker actual (`curl`): realizado por el propietario — CSP estricta (`default-src 'none'`), una sola cabecera. Navegador real sin violaciones CSP en `/` (selector de idioma) y en `/api/docs/` con `ENABLE_API_DOCS=true`: realizado por el propietario — sin violaciones CSP; Swagger y Try it out funcionan. Estos resultados son reportados por el propietario, no reproducidos por el agente.

**Alternativas consideradas:** cabeceras nativas de Express sin Helmet (descartado por mayor coste de mantenimiento); HSTS activo (descartado por riesgo en entornos sin TLS en la terminación del servidor).

**Commit:** `4295376` (2026-11-14).

---

### D-075 — Cabeceras de seguridad de la SPA mediante Nginx

**Estado:** Confirmada (2026-11-14).

**Contexto:** La plantilla fullstack Docker sirve la SPA con `nginxinc/nginx-unprivileged`. El frontend no emitía cabeceras de seguridad. Para evitar duplicar cabeceras (Nginx + Helmet), las cabeceras se definen solo donde corresponde: en Nginx para la SPA y en Helmet para la API.

**Decisión:**
- `server_tokens off;` en el bloque `server` (también cubierto en D-073).
- Las cabeceras de seguridad se definen **exclusivamente dentro de `location /`**, con la directiva `always`:
  - `Content-Security-Policy`: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
- `location /api/` no lleva `add_header` para no duplicar las cabeceras de Helmet/Swagger, que el backend ya emite correctamente.
- **CSP de la SPA sin `unsafe-inline` ni `unsafe-eval`**: Vite extrae el CSS en archivos separados en producción. El `style={{}}` del componente `LanguageSelector` aplica estilos mediante la API DOM y no requiere `unsafe-inline` en `style-src`.
- **Descartadas y por qué:** HSTS (mismo motivo que D-074: Brixa no controla la terminación TLS), `Permissions-Policy` (sin uso de APIs sensibles en la plantilla base; añadirla sin valor concreto introduce mantenimiento sin beneficio claro), `COOP`/`CORP` (no se sirven recursos de orígenes cruzados en la plantilla base; se reevaluarán con autenticación).
- Los tests del generador usan un analizador de bloques Nginx (`src/generator/generate.test.ts`) para verificar que cada `add_header` aparece en el contexto correcto.

**Motivo:** Definir las cabeceras solo en `location /` evita duplicarlas en `/api/` (donde Helmet ya las emite) y mantiene un único punto de verdad por capa. `X-Frame-Options: DENY` es más restrictivo que el `SAMEORIGIN` del backend: se acepta como diferencia conocida pendiente de unificar (ver sección 5).

**Consecuencias y limitaciones:**
- Las cabeceras de la SPA **solo están presentes con Docker**: el servidor de desarrollo de Vite no las emite, y la variante frontend sin Docker tampoco dispone de Nginx.
- Quien despliegue la SPA en un hosting diferente de este Nginx debe configurar las cabeceras en su propia infraestructura.
- Las respuestas 502 generadas por Nginx cuando el backend cae no incluyen las cabeceras de seguridad del `location /`.
- El arnés de `verify:generated` no comprueba las cabeceras de seguridad HTTP en las respuestas reales: una regresión en este área solo la detectarían los tests unitarios del generador. Mejora pendiente (ver sección 5).

**Alternativas consideradas:** emitir las cabeceras también desde el backend en `/api/` y depender de Nginx para suprimirlas (descartado por mayor complejidad y riesgo de duplicación).

**Commit:** `4295376` (2026-11-14).

---

### D-076 — Mitigación del ReDoS en redact y límites de la redacción

**Estado:** Confirmada.

**Contexto:** T-022. `redact` recibe en el manejador global de errores texto derivado de entradas de red (`err.body` de JSON malformado, vía `inspect()`).

**Decisión:** La regla de URLs usa prefiltro `includes("://")` y esquema `{0,63}`; la de valores entrecomillados usa clases negadas con escapes y cubre `'`, `"` y backticks. Las pruebas de redacción pasan por `inspect()` real y con `maxStringLength` ilimitado.

**Motivo:** `util.inspect` elige backticks cuando el valor contiene ambos tipos de comillas, y la regla anterior no los cubría (fuga real). Además, el retroceso cuadrático bloqueaba el event loop ≈ 74 ms por petición malformada con solo 10 KB.

**Consecuencias / limitaciones:**
- `{0,63}` es una decisión interna defensiva, no un requisito de RFC 3986 ni de RFC 1035.
- Valores entrecomillados con saltos de línea literales sin escapar no se enmascaran.
- `inspect()` no es la barrera de seguridad: la redacción debe funcionar aunque cambie `inspect.defaultOptions`.
- `redact` vive en un único archivo por lenguaje (redact.ts y redact.js); una corrección debe aplicarse en ambos.

---

### D-077 — Eliminación de sobrescritura de tsconfig.json e inserción en Docker Compose

**Estado:** Confirmada (2026-11-15).

**Contexto:** La auditoría de overlays identificó que el overlay `api-docs` reemplazaba completamente `backend/tsconfig.json` únicamente para declarar `"resolveJsonModule": true`. Asimismo, la inyección de `ENABLE_API_DOCS` en Docker Compose dependía de una sustitución frágil con expresión regular en `appendComposeApiDocsEnv`, y `applyApiDocsOverlay` mutaba imperativamente `allowScripts["@scarf/scarf"]`.

**Decisión:**
- Añadir `"resolveJsonModule": true` a la plantilla base `src/templates/backend-express-ts/tsconfig.json` y eliminar definitivamente el archivo `src/templates/api-docs/ts/tsconfig.json`, sin requerir un motor de combinación estructural de JSON para un solo campo.
- Sustituir la sustitución regex en Compose por el marcador `# @@INSERT:api-docs-env@@` en las plantillas `compose.*.yaml`, resuelto mediante inserción explícita y limpieza vía `cleanupComposeInsertionPoints`.
- Integrar la clave `allowScripts` dentro del esquema de fusión determinista `PackageJsonOverlay` y `mergeSection` en `mergePackageJson`.

**Consecuencias:** Desaparece la sobrescritura silenciosa de `tsconfig.json` en backend; la inyección de entorno en Compose falla ruidosamente si falta el marcador en lugar de fallar en silencio o mutar bloques inesperados.

---

### D-078 — Fusión determinista e idempotente de .env.example

**Estado:** Confirmada (2026-11-15).

**Contexto:** Los overlays (`postgres`, `sqlite`, `docker-postgres`, `api-docs`) agregaban variables a `.env.example` mediante concatenaciones textuales simples, lo que impedía detectar variables duplicadas o inconsistencias de configuración entre capacidades.

**Decisión:**
- Implementar `parseEnvAssignments` y `mergeEnvExample` en `src/generator/generate.ts`.
- Las asignaciones activas se identifican por nombre de variable mediante `/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/`, ignorando líneas vacías y comentarios (`#`).
- Si todas las variables de un bloque ya existen con idéntico valor, la operación es idempotente y no añade duplicados.
- Si una variable ya existe con un valor diferente, lanza un error explícito identificando al contribuyente en conflicto.
- Se preservan intactos el formato, los comentarios de documentación y los saltos de línea de los bloques existentes y añadidos.

---

### D-079 — Composición no destructiva de frontend (main, App y vite.config)

**Estado:** Confirmada (2026-11-15).

**Contexto:** La auditoría de composición reveló que el overlay `i18n` reemplazaba completamente `src/main.{jsx,tsx}` para añadir un import de inicialización y mantenía una copia de `src/App.{jsx,tsx}` que duplicaba aproximadamente el 90 % del componente base para inyectar `LanguageSelector` y llamadas a `t()`. Además, la modalidad `fullstack` reemplazaba completamente `vite.config.{js,ts}` para configurar el proxy.

**Decisión:**
- `main.{jsx,tsx}`: se añadió el marcador `// @@INSERT:imports@@` a las plantillas base. El overlay `i18n` inyecta `import './i18n.${ext}'` mediante `resolveInsertionPoints`.
- `App.{jsx,tsx}`: se extrajo el contenido variable y el selector a un hook `useAppContent.{jsx,tsx}`. La plantilla base provee textos en inglés por defecto y `LanguageSelector: () => null`. El overlay `i18n` provee la implementación reactiva con `useTranslation`, `Trans` y `LanguageSelector`. `App.{jsx,tsx}` es único y común para todas las combinaciones, eliminando la duplicación en `i18n`.
- `vite.config.{js,ts}`: se declararon los marcadores `// @@INSERT:imports@@` y `// @@INSERT:config@@`. `applyFullstackViteProxy` inyecta el proxy únicamente en modalidad `fullstack`, eliminando los archivos duplicados de `src/templates/fullstack/`.
- Limpieza determinista: se implementó `cleanupUnresolvedFrontendInsertionPoints` con `KNOWN_FRONTEND_INSERTION_POINTS = new Set(["imports", "config"])` para remover limpiamente los marcadores no utilizados en frontend independiente o sin i18n.

---

### D-080 — Identidad global, organizaciones N:M y propagación explícita de ActorContext

**Estado:** Confirmada (2026-11-16; consolidación de P-011 e INV-04b).

**Contexto:** Se requería definir la relación estructural entre identidades de usuario y organizaciones, el mecanismo para seleccionar y validar la organización activa por petición y cómo viaja el contexto de ejecución del actor en el backend.

**Decisión:**
- Desacoplamiento entre identidad global (usuarios) y organizaciones mediante una relación N:M a través de concesiones de acceso (`access grants`). Un usuario puede pertenecer a múltiples organizaciones y una organización agrupar a múltiples usuarios.
- La organización activa se selecciona por petición (mediante cabecera o parámetro explícito) y se valida obligatoriamente contra la base de datos en cada solicitud comprobando que el actor posee una concesión de acceso vigente hacia dicha organización.
- El contexto del actor (`ActorContext`) se propaga de forma estrictamente explícita como argumento en llamadas a servicios, casos de uso, repositorios y transacciones.
- Se descarta el uso de `AsyncLocalStorage` (ALS) para comprobaciones de autorización y aislamiento de datos.

**Motivo:** La propagación explícita de `ActorContext` es determinista, comprobable en tiempo de compilación y análisis estático, y elimina riesgos de fugas de contexto o retención residual en entornos asíncronos y pools de conexiones.

**Consecuencias:** Todo servicio y repositorio que realice operaciones sensibles o dependientes de organización debe recibir `ActorContext` como argumento.

---

### D-081 — Ciclo de vida de concesiones de acceso con revoked_at y unicidad parcial

**Estado:** Confirmada (2026-11-16; consolidación de P-011).

**Contexto:** Se necesitaba definir el ciclo de vida de las concesiones de acceso entre usuarios y organizaciones, evitando campos `isActive` universales que enmascaran el estado real.

**Decisión:**
- La baja o revocación de una concesión de acceso se registra mediante una marca temporal `revoked_at`.
- La revocación es definitiva: la fila revocada no se reactiva ni se limpia `revoked_at`.
- Si se vuelve a conceder acceso a un usuario previamente revocado en una organización, se inserta una nueva fila de concesión independiente, la cual no hereda ningún rol ni asignación previa.
- En PostgreSQL se aplica un índice de unicidad parcial para concesiones vigentes (`WHERE revoked_at IS NULL`) que garantiza a nivel de base de datos que solo exista una concesión activa por par `(user_id, organization_id)`.

**Motivo:** Proporciona un registro histórico inmutable y auditable del ciclo de vida del acceso, previene la reactivación accidental de privilegios obsoletos y asegura la integridad relacional en la base de datos.

---

### D-082 — RBAC dinámico con catálogo en código, sincronización en BD y alcances

**Estado:** Confirmada (2026-11-16; consolidación de P-011 e INV-04b).

**Contexto:** Se requería definir el balance entre rigidez del código y flexibilidad operativa para la definición de roles y permisos en proyectos generados.

**Decisión:**
- RBAC dinámico. El catálogo canónico de permisos se define de manera declarativa en el código fuente del proyecto generado y se sincroniza con la base de datos.
- Los administradores no pueden inventar ni registrar permisos arbitrarios desde la API o el panel que no existan previamente en el código fuente.
- Los roles, las asignaciones de permisos a roles y las asignaciones de roles a concesiones de acceso son dinámicos y administrables desde el panel y la API administrativa.
- Los alcances de autorización admitidos en esta etapa son exclusivamente dos: **aplicación** (sistema) y **organización**.
- Se descarta expresamente la implementación de un motor genérico ABAC (Attribute-Based Access Control) o ReBAC (Relationship-Based Access Control).

**Motivo:** Garantiza que los permisos correspondan a capacidades reales implementadas por el desarrollador, dotando a la vez de flexibilidad operativa para configurar roles según las necesidades del despliegue, sin incurrir en la complejidad de motores de políticas dinámicas.

---

### D-083 — Independencia de Multitenancy respecto a RBAC y ausencia de roles fijos

**Estado:** Confirmada (2026-11-16; consolidación de P-011).

**Contexto:** La propuesta INV-04b sugería introducir roles fijos de `owner` y `member` cuando multitenancy estuviera activo sin RBAC.

**Decisión:**
- Multitenancy es completamente independiente de RBAC (en concordancia con D-064).
- Cuando un proyecto se genera con multitenancy pero sin RBAC, existen organizaciones y concesiones de acceso organizacionales, pero NO se crean roles fijos `owner` ni `member`.
- La autorización en multitenancy sin RBAC se limita a verificar la existencia de una concesión de acceso válida y vigente hacia la organización seleccionada.

**Motivo:** Preserva la ortogonalidad de las capacidades y evita imponer modelos de roles prescriptivos o artificiales cuando el desarrollador solo requiere aislamiento de datos entre organizaciones.

---

### D-084 — Separación estricta entre administración de plataforma y organizacional

**Estado:** Confirmada (2026-11-16; consolidación de P-011).

**Contexto:** Se requería delimitar si un administrador con alcance global de plataforma podría consultar datos de cualquier organización o eludir Row-Level Security (RLS).

**Decisión:**
- La administración de plataforma está estrictamente separada de la administración organizacional.
- Los administradores de plataforma operan exclusivamente a nivel de alcance de sistema (p. ej., aprovisionamiento de organizaciones o gestión global de usuarios) y no poseen acceso global automático a los datos de negocio de las organizaciones ni cuentan con bypass genérico de Row-Level Security (RLS).
- Si un usuario con privilegios de plataforma requiere operar sobre los datos internos de una organización, debe contar con una concesión de acceso explícita y vigente en dicha organización.

**Motivo:** Aplicación rigurosa del principio de mínimo privilegio y prevención de fugas de aislamiento o accesos no autorizados a través de cuentas de infraestructura/sistema.

---

### D-085 — Bootstrap seguro mediante comandos locales y aprovisionamiento organizacional

**Estado:** Confirmada (2026-11-16; consolidación de P-011).

**Contexto:** Definir cómo se crea el primer administrador del sistema y las organizaciones iniciales sin introducir vulnerabilidades de arranque o endpoints desprotegidos.

**Decisión:**
- La inicialización (bootstrap) de la primera cuenta administrativa se realiza exclusivamente mediante comandos de consola (CLI / scripts) del propio proyecto generado.
- Queda prohibido el uso de credenciales predeterminadas o "de fábrica".
- Queda prohibida la exposición de endpoints HTTP públicos o asistentes web de inicialización para el primer administrador.
- El comando de bootstrap debe ser idempotente y resistente a condiciones de carrera y concurrencia.
- El aprovisionamiento de organizaciones iniciales se realiza igualmente mediante herramientas y comandos locales del proyecto generado.
- El desarrollo de un panel global de administración de plataforma queda fuera del alcance de la versión v1.

**Motivo:** Cierra vectores de ataque críticos en el despliegue inicial y elimina riesgos derivados de credenciales por defecto o endpoints de instalación accesibles desde la red.

---

### D-086 — Registro público opcional para Auth sin multitenancy (modificación de alcance de D-064)

**Estado:** Confirmada (2026-11-16; modifica formalmente el alcance de D-064).

**Contexto:** D-064 dejó fuera de alcance el registro público ("quedan fuera de esta etapa MFA, OAuth/SSO, auditoría avanzada, registro público y recuperación de contraseña"). Se evaluó la necesidad de permitir auto-registro en aplicaciones mono-organización o de consumo general.

**Decisión:**
- Se admite el registro público de usuarios como opción configurable en el CLI exclusivamente para proyectos que incluyan Auth sin multitenancy (tanto Auth básica como Auth combinada con RBAC).
- El registro administrado (creación de usuarios por un administrador o invitación) se mantiene como la opción predeterminada.
- El registro público nunca otorga privilegios administrativos de manera automática.
- Queda terminantemente excluida la creación pública de organizaciones en proyectos con multitenancy.
- La implementación del registro público se realizará de forma posterior a la entrega y verificación del núcleo de autenticación (T-014a), incorporando controles de seguridad obligatorios (limitación de tasa / rate limiting, validación robusta y mitigación de abuso).

**Motivo:** Brindar flexibilidad para proyectos orientados al público sin comprometer el modelo de multitenancy ni la seguridad de privilegios iniciales.

**Relación con D-064:** Esta decisión modifica formalmente la exclusión absoluta de registro público establecida en D-064, limitándola a proyectos con multitenancy y fijando las condiciones de seguridad requeridas.

---

### D-087 — Credenciales de autenticación: sesiones opacas con tokens de 32 bytes y hash SHA-256 en base de datos

**Estado:** Confirmada (2026-11-16; consolidación de P-010.1).

**Contexto:** Se requería definir el modelo de credenciales para la autenticación en v1, evaluando la disyuntiva entre credenciales opacas referenciadas en base de datos frente a tokens autocontenidos (JWT), así como los algoritmos de generación y almacenamiento seguro.

**Decisión:**
- Sesiones opacas como **único modelo de autenticación en v1**, descartando JWT.
- Los tokens de sesión se generan utilizando 32 bytes criptográficamente aleatorios (`crypto.randomBytes(32)` o equivalente de la Web Crypto API).
- En la base de datos se almacena **únicamente el hash SHA-256** del token, nunca el token en claro ni codificado de forma reversible.
- La validación de sesiones y su revocación residen enteramente en el servidor contra la base de datos.
- El token es puramente un identificador aleatorio opaco: no contiene información de identidad de usuario, roles, permisos ni organización.
- El mecanismo de sesiones opacas constituye un núcleo común aplicable indistintamente tanto al transporte por cookies como a Bearer.

**Motivo:** Las sesiones opacas con almacenamiento por hash garantizan revocación instantánea, evitan fugas de información sensible dentro del token y protegen la base de datos frente a la exposición de tokens activos en caso de volcado no autorizado, sin la complejidad ni los problemas de revocación inherentes a JWT.

---

### D-088 — Ciclo de vida de sesiones: expiración por inactividad, límite absoluto y rotación sin esquema access/refresh

**Estado:** Confirmada (2026-11-16; consolidación de P-010.2).

**Contexto:** Se requería establecer las reglas de ciclo de vida, renovación y caducidad de las sesiones activas, abordando los riesgos medidos en INV-03b respecto a peticiones concurrentes y refresh rotativo.

**Decisión:**
- Ciclo de vida de sesión gobernado por doble control temporal: expiración deslizante por inactividad (desplazamiento al registrar actividad del usuario) y límite de vida absoluto e improrrogable desde la creación de la sesión.
- Revocación efectiva inmediata que impide el acceso en la siguiente petición.
- Actualizaciones de actividad en base de datos diseñadas para ser eficientes y seguras frente a concurrencia (evitando contención o bloqueos en peticiones paralelas simultáneas).
- Rotación controlada del identificador de sesión en eventos de seguridad relevantes (como cambio de contraseña o elevación de privilegios).
- Se descarta el esquema de pares access token + refresh token rotativo en v1.
- Las duraciones predeterminadas de expiración, la periodicidad de rotación y la frecuencia de actualización de actividad quedan pendientes de especificación detallada.

**Motivo:** Evita condiciones de carrera detectadas en navegadores al rotar tokens con múltiples peticiones concurrentes (reportado en INV-03b) y proporciona un control estricto del tiempo máximo de vida de la sesión sin degradar el rendimiento de la base de datos.

---

### D-089 — Transporte de credenciales y protección CSRF: cookies en fullstack, selección en backend y precisión de alcance de D-064

**Estado:** Confirmada (2026-11-16; consolidación de P-010.3 y precisión de alcance de D-064).

**Contexto:** Se requería definir qué transportes se ofrecen según la modalidad del proyecto generado, las propiedades de seguridad de las cookies y la mitigación de ataques CSRF.

**Decisión:**
- **Modalidad fullstack (React + Express):** utiliza **exclusivamente cookies** en v1 (Bearer no se ofrece para fullstack).
- **Modalidad backend independiente:** permite seleccionar en el CLI entre **cookies** o **Bearer**, sin admitir mezcla simultánea de transportes en un mismo proyecto.
- Configuración estricta de cookies de sesión: `HttpOnly`, `Secure` (obligatorio), `SameSite=Lax`, `Path=/`, y ausencia de atributo `Domain` (para restringir el ámbito al host emisor). Cada proyecto generado utiliza un **nombre de cookie específico** para evitar colisiones en `localhost` entre proyectos locales.
- **Protección CSRF obligatoria** en el servidor para todas las operaciones mutables autenticadas mediante cookies, utilizando validación estricta de cabeceras de origen (`Origin` / `Referer`) y mecanismos adicionales de defensa cuando corresponda.
- El transporte Bearer se transmite exclusivamente mediante la cabecera estándar `Authorization: Bearer <token>`.
- **Sin soporte automático general de cookies cross-site en v1.**
- Esta decisión precisa formalmente el alcance original de D-064 en relación con la disponibilidad de transportes por modalidad.

**Motivo:** Mantener el modelo más seguro y simple para cada arquitectura: cookies seguras con CSRF son la mejor práctica para aplicaciones web en el mismo origen, mientras que Bearer satisface clientes de API puros sin introducir la fragilidad de cookies entre dominios o almacenamiento inseguro en frontend.

---

### D-090 — Frontend y navegación protegida: React Router declarativo condicionado a Auth, estado centralizado y accesibilidad explícita

**Estado:** Confirmada (2026-11-16; consolidación de P-010.4).

**Contexto:** La arquitectura base de frontend no incluía router ni estado de sesión. Se requería definir cómo se gestionan la navegación, las rutas protegidas, la sincronización de sesión y la accesibilidad en aplicaciones completas con autenticación.

**Decisión:**
- Se adopta **React Router en modo declarativo**, incorporado condicionalmente **únicamente cuando la aplicación fullstack incluya autenticación**. Los proyectos que no incluyan Auth no incorporan router de forma obligatoria.
- Estado de sesión centralizado en frontend que distingue explícitamente cuatro estados: verificación inicial (cargando), autenticado, no autenticado y error de comunicación.
- La sesión se recupera y valida mediante consulta al backend; ninguna credencial de sesión se almacena en memoria accesible a JavaScript ni en almacenamiento del navegador (`localStorage` / `sessionStorage`).
- Las rutas protegidas en frontend actúan exclusivamente como **mecanismo de experiencia de usuario y navegación defensiva**; la autorización efectiva reside siempre de forma inmutable en el backend Express.
- Integración compositiva limpia con los overlays de internacionalización (`i18n`), RBAC y futuros módulos sin acoplamiento monolítico.
- Accesibilidad explícita obligatoria en la navegación: actualización dinámica de `document.title`, gestión de foco del teclado en cambios de ruta y anuncios de navegación para lectores de pantalla.
- La verificación de esta capacidad exige pruebas reales de navegación, redirecciones, recargas de página y controles de accesibilidad.

**Motivo:** Garantiza una arquitectura limpia y accesible sin sobrecargar variantes sencillas que no requieran enrutamiento, manteniendo al mismo tiempo la estricta barrera de seguridad en el servidor.

---

### D-091 — Algoritmo de hash de contraseñas: Argon2id mediante @node-rs/argon2 2.2.2 y mantenimiento del rango de Node.js

**Estado:** Confirmada (2026-11-16; consolidación de P-009.1 tras INV-01 e INV-07).

**Contexto:** Se requería definir el algoritmo e implementación para el hash de contraseñas en Auth v1, evaluando la disponibilidad de `crypto.argon2` en Node.js, la compatibilidad con el rango declarado en `engines.node` (`^24.0.0 || >=26.0.0`), las discrepancias de tipos en TypeScript y la necesidad de dependencias externas.

**Decisión:**
- Se adopta **Argon2id como único algoritmo de hashing para contraseñas en Auth v1**.
- Se utiliza la biblioteca externa **`@node-rs/argon2` versión exacta `2.2.2`**.
- La dependencia se incorpora **únicamente a los backends generados que incluyan autenticación** (Auth).
- Se mantiene inalterado el rango de Node.js en los proyectos generados: **`engines.node: "^24.0.0 || >=26.0.0"`**, sin elevar el mínimo de Node.js a 24.7.0.
- No se generará ninguna implementación alternativa mediante `node:crypto`, bcrypt o scrypt.
- Mismo comportamiento funcional idéntico para las variantes en JavaScript y TypeScript.

**Motivo:** La investigación INV-07 verificó en fuentes oficiales y en ejecución que `crypto.argon2` no existe en Node 24.0.0–24.6.x (incorporado en v24.7.0), y que con `@types/node` 26.x el compilador TypeScript no detectaría la incompatibilidad en tiempo de compilación, provocando fallos en ejecución para usuarios en versiones de Node inferiores a 24.7.0. `@node-rs/argon2` ofrece bindings nativos Rust (NAPI-RS) con binarios precompilados multiplataforma, no contiene scripts de instalación en npm (`postinstall: false`, compatible con la política de seguridad y `allowScripts` de Brixa), proporciona formato PHC canónico sin código artesanal y preserva el rango amplio de compatibilidad de Node.js.

---

### D-092 — Parámetros de Argon2id, formato PHC canónico y estrategia de rehash

**Estado:** Confirmada (2026-11-16; consolidación de P-009.2 tras INV-01 e INV-07).

**Contexto:** Se requería establecer los parámetros de coste computacional y de memoria de Argon2id, el formato de serialización para almacenamiento en base de datos y la capacidad de evolución ante futuros incrementos de coste.

**Decisión:**
- Parámetros criptográficos fijados:
  - **Memory cost ($m$):** `19456 KiB` (19 MiB).
  - **Time cost ($t$):** `2` pasadas.
  - **Parallelism ($p$):** `1` hilo.
  - **Output length:** `32 bytes`.
  - **Salt:** `16 bytes` criptográficamente aleatorios por credencial.
- Todos los parámetros se establecen de manera **explícita en el código generado**, sin depender de los valores por defecto de la biblioteca.
- Almacenamiento en **formato PHC estándar** canónico (`$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`), codificado en **Base64 convencional sin padding** (`[A-Za-z0-9+/]`). Queda expresamente descartado el uso de Base64URL (`-` y `_`), corrigiendo la variante reportada en el anexo de INV-01.
- Soporte de **rehash transparente**: el sistema debe identificar hashes almacenados con parámetros o versiones antiguas y actualizar su coste rehasheando la contraseña en la base de datos inmediatamente después de una autenticación válida.

**Motivo:** Los parámetros adoptan las recomendaciones de seguridad actuales y el equilibrio medido en INV-01 (~60 ms de CPU y 19 MiB por hash en entornos contenidos). El formato PHC canónico con Base64 sin padding garantiza interoperabilidad total entre herramientas y librerías estándar. El rehash permite evolucionar la seguridad en el tiempo sin requerir restablecimientos forzados de contraseñas.

---

### D-093 — Seguridad operativa del módulo de hash: asincronía, validación defensiva, limitación de concurrencia y mitigación de enumeración

**Estado:** Confirmada (2026-11-16; consolidación de P-009.3 tras INV-01 e INV-07).

**Contexto:** Se requería definir los controles de seguridad operativa para prevenir ataques de denegación de servicio (DoS) por consumo de CPU o memoria, bloqueos del bucle de eventos y ataques de canal lateral / enumeración por temporización.

**Decisión:**
- **Asincronía estricta:** utilizar exclusivamente las APIs asíncronas (`argon2.hash`, `argon2.verify`) para operaciones de hashing y verificación en peticiones HTTP, garantizando la delegación a hilos de fondo sin bloquear jamás el Event Loop de Express.
- **Validación defensiva previa de parámetros PHC:** antes de invocar la verificación sobre un hash existente, se deben parsear y validar defensivamente sus parámetros (`m`, `t`, `p`, longitud de salt y hash). Si los parámetros superan los límites defensivos permitidos, la verificación se aborta inmediatamente sin ejecutar Argon2id, evitando ataques DoS de agotamiento de memoria o CPU mediante hashes adulterados (evidencia INV-07).
- Los límites defensivos deben ser **explícitos y compatibles con una futura actualización de parámetros**, no valores máximos universales inmutables.
- **Mitigación de enumeración por temporización (hash ficticio / dummy):** cuando una cuenta solicitada en el login no exista, el backend debe ejecutar una verificación ficticia con un hash Argon2id dummy previamente preparado en memoria, haciendo que el tiempo de respuesta sea indistinguible respecto a una cuenta existente.
- **Limitador de concurrencia:** restringir las operaciones Argon2id concurrentes en el proceso Node.js mediante una cola acotada con manejo seguro de saturación (rechazo controlado cuando la cola esté llena), protegiendo al contenedor frente a OOM kills bajo ráfagas de peticiones.
- **Independencia de rate limiting:** el limitador de concurrencia protege la memoria local del proceso y no sustituye al rate limiting de autenticación, que debe operar de forma independiente en capas previas.
- **Política inicial de entrada:** contraseñas entrantes limitadas a un máximo de **128 caracteres** y **512 bytes UTF-8**, rechazando excesos con error de validación sin truncamiento silencioso.
- **Pendientes técnicos por concretar en diseño e implementación (T-014-0 / T-014a):**
  - Límites defensivos exactos para parámetros PHC y su compatibilidad con la política de rehash.
  - Capacidad de la cola y política de saturación del limitador de concurrencia.
  - Manejo unificado de errores y mitigación de enumeración.
  - Comportamiento en contenedores con memoria restringida.
  - Compatibilidad de binarios nativos y manejo de instalaciones sin dependencias opcionales.
  - Batería de pruebas: hashing, verificación, Unicode, manipulación PHC y rehash.

**Motivo:** La evaluación empírica de INV-01 e INV-07 demostró que hashes no validados con $m$ excesivo saturan instantáneamente la memoria del proceso, y que la concurrencia descontrolada agota los límites del contenedor. Los controles establecidos mitigan DoS por memoria, DoS por CPU, enumeración por timing y desbordamiento de entrada.

---

### D-094 — PostgreSQL RLS: Roles de base de datos, privilegios mínimos y credenciales separadas (RLS.1)

**Estado:** Confirmada (2026-11-16; consolidación de RLS.1 tras INV-04a).

**Contexto:** En arquitecturas multitenant con PostgreSQL, el aislamiento de datos exige garantías de base de datos que impidan a la aplicación acceder a datos fuera de su ámbito asignado. Era necesario definir el modelo de identidades y roles en PostgreSQL, los privilegios otorgados y la separación de credenciales para garantizar que las políticas RLS se apliquen de forma ineludible.

**Decisión:**
- Row-Level Security (RLS) en PostgreSQL es **obligatorio** en todos los proyectos generados que incluyan multitenancy.
- SQLite queda **terminantemente excluido** de multitenancy en esta etapa (en concordancia con D-064).
- Se establece una **separación estricta de identidades** en PostgreSQL entre el tiempo de ejecución y la gestión del esquema:
  - **Identidad de ejecución (`app_exec`):** utilizada por el servidor de aplicaciones en sus operaciones cotidianas.
  - **Identidad de migraciones (`table_owner`):** utilizada exclusivamente durante la ejecución de migraciones y cambios de esquema DDL.
- El rol de ejecución (`app_exec`):
  - No puede ser superusuario ni poseer el atributo `BYPASSRLS`.
  - No puede ser propietario de tablas protegidas por RLS (el propietario elude RLS por defecto en PostgreSQL).
  - No posee privilegios de definición de datos (DDL) ni permiso `TRUNCATE` sobre tablas protegidas.
  - Únicamente posee privilegios DML mínimos (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) en las tablas requeridas.
- **Credenciales separadas:** el proyecto generado debe utilizar cadenas de conexión independientes (`DATABASE_URL` con el rol `app_exec` para el servicio Express y `MIGRATION_DATABASE_URL` con el rol `table_owner` para las migraciones de Drizzle).
- **Aprovisionamiento documentado:** se proporciona documentación y scripts de aprovisionamiento claros para proveedores administrados de PostgreSQL (RDS, Cloud SQL, Supabase, Neon, etc.) donde el usuario debe configurar los dos roles y sus permisos.
- **Fallo explícito ante privilegios insuficientes:** si en el arranque o verificación no se pueden garantizar los privilegios y restricciones requeridos para `app_exec` (por ejemplo, si se conecta como superusuario o propietario de las tablas), el sistema debe **fallar explícitamente**. Bajo ninguna circunstancia se debe desactivar RLS como solución o degradación permisiva.

**Motivo:** Las políticas RLS de PostgreSQL solo se evalúan obligatoriamente si el usuario conectado no es superusuario ni propietario de la tabla. Separar `table_owner` de `app_exec` garantiza que la aplicación esté técnica y formalmente forzada a someterse a las políticas RLS, limitando drásticamente el impacto de posibles errores en la capa de aplicación.

**Consecuencias:** Todo despliegue de un proyecto multitenant exige la configuración previa de dos roles y dos credenciales de base de datos.

---

### D-095 — Contexto organizacional transaccional, set_config local y aislamiento en Drizzle (RLS.2)

**Estado:** Confirmada (2026-11-16; consolidación de RLS.2 tras INV-04a).

**Contexto:** Se requería definir el mecanismo seguro para transmitir el identificador de la organización activa a PostgreSQL para la evaluación de RLS, compatible con pools de conexiones y el ORM Drizzle, evitando retención residual de estado entre peticiones y fugas de contexto.

**Decisión:**
- La organización activa se **selecciona explícitamente por petición** (vía cabecera o parámetro explícito) y se valida obligatoriamente contra la base de datos en cada solicitud, comprobando la identidad del actor y la vigencia de su concesión de acceso (D-080).
- Queda terminantemente prohibido confiar ciegamente en identificadores de organización enviados por el cliente sin validación previa en el servidor.
- El contexto organizacional en PostgreSQL se establece exclusivamente a nivel local de transacción mediante:
  `SELECT set_config('app.current_organization_id', ?, true)`
  con el parámetro `is_local = true`, utilizando **parámetros enlazados (bound parameters)** y transacciones de Drizzle ORM (`db.transaction(async (tx) => { ... })`).
- **Una organización por transacción:** cada transacción organizacional corresponde estrictamente a una única organización.
- Los servicios y repositorios organizacionales reciben el objeto transaccional explícitamente autorizado (`tx`) como argumento, manteniendo la propagación explícita de `ActorContext` (D-080) y descartando `AsyncLocalStorage` (ALS) para transmitir autorización.
- **Denegación por defecto:** si una consulta sobre una tabla protegida opera sin contexto organizacional o con un valor nulo/vacío, las políticas RLS deniegan el acceso devolviendo cero filas.
- **Separación de operaciones globales y organizacionales:** las operaciones globales de identidad y autorización (autenticación de usuario, recuperación de concesiones) se ejecutan en transacciones o consultas globales sin fijar contexto organizacional. Las operaciones de negocio multitenant operan siempre dentro de una transacción organizacional con contexto fijado.
- **Agregaciones legítimas multiorganización:** cuando una funcionalidad requiera consultar o agregar datos de varias organizaciones para un actor autorizado en todas ellas, se debe ejecutar mediante consultas independientes y autorizadas para cada organización; queda prohibido cualquier bypass general o global de RLS.
- **Compatibilidad con pooling por transacción:** el uso de `set_config` con `is_local = true` dentro de transacciones garantiza compatibilidad total con pools de conexiones y poolers en modo transacción (como PgBouncer), sin hacer obligatorio el uso de PgBouncer. Al finalizar la transacción (`COMMIT` o `ROLLBACK`), PostgreSQL limpia automáticamente la variable GUC local, evitando contaminación entre peticiones que compartan conexión.
- **Limitación conocida documentada:** la ejecución de SQL arbitrario puede modificar la variable GUC (`set_config`). RLS proporciona defensa en profundidad contra filtros olvidados o errores lógicos de aplicación; **RLS no sustituye la prevención de inyección SQL**.

**Motivo:** La asignación local por transacción con `is_local = true` y propagación explícita de `tx` es atómica, previene fugas de contexto entre conexiones de un pool y asegura un comportamiento determinista y verificable sin depender de contextos globales o hilos asíncronos opacos.

**Nota de aclaración técnica (2026-11-17, T-014-0 B-8):** Se corrige la imprecisión del informe preliminar: ejecutar `SET LOCAL` o `set_config(..., true)` fuera de una transacción explícita en PostgreSQL no implica automáticamente una contaminación persistente de la conexión del pool; el fallo técnico real es que en modo autocommit el efecto finaliza inmediatamente al completarse la sentencia y el contexto local no permanece disponible para las operaciones posteriores, provocando denegación por defecto (cero filas). Por ello, todas las operaciones sobre tablas organizacionales (incluidas lecturas `SELECT` y endpoints `GET`) deben ejecutarse invariablemente dentro de una transacción explícita (`db.transaction`).

**Consecuencias:** Todo acceso a entidades organizacionales debe envolverse en una transacción con contexto organizacional establecido.

---

### D-096 — Políticas de Row-Level Security, clasificación de tablas e integridad relacional (RLS.3)

**Estado:** Confirmada (2026-11-16; consolidación de RLS.3 tras INV-04a).

**Contexto:** Se requería definir la taxonomía de tablas, las cláusulas de las políticas RLS, la gestión del identificador de organización, la integridad referencial y las restricciones de base de datos para garantizar que el aislamiento no se degrade por operaciones especiales o dependencias relacionales cruzadas.

**Decisión:**
- **Clasificación explícita de tablas:** cada tabla del esquema debe clasificarse de forma inequívoca como **global** (sin pertenencia a organización, p. ej. `users`, `sessions`, `roles`, `permissions`) u **organizacional** (perteneciente a un tenant).
- **Entidades organizacionales protegidas:** toda tabla organizacional debe contener obligatoriamente una columna `organization_id` no nula, y debe tener RLS habilitado y forzado explícitamente:
  `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
  `ALTER TABLE <table> FORCE ROW LEVEL SECURITY;`
- **Políticas de lectura y escritura:**
  - Lectura (`SELECT`): cláusula `USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)` (cuando el identificador sea UUID) o su tipo correspondiente.
  - Escritura (`INSERT`, `UPDATE`): cláusula `WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)`.
  - La barrera organizacional restrictiva se combina adecuadamente con políticas permisivas si existen reglas adicionales de autorización. Queda terminantemente prohibido el uso de políticas permisivas abiertas (`USING (true)`) en tablas organizacionales.
- **Manejo seguro de contexto ausente o vacío:** la expresión `NULLIF(current_setting('app.current_organization_id', true), '')::uuid` asegura que ante una variable no definida o vacía se devuelva `NULL`, evitando errores de conversión y denegando la comparación frente a `organization_id`.
- **Claves primarias simples:** se mantienen claves primarias simples por defecto (p. ej. `id uuid PRIMARY KEY`), sin imponer claves primarias compuestas universalmente (`organization_id, id`).
- **Integridad referencial y claves foráneas (FK):**
  - Se utilizan claves foráneas para garantizar la integridad referencial.
  - En relaciones entre entidades organizacionales que deban permanecer estrictamente aisladas, se deben utilizar claves foráneas compuestas que incluyan `organization_id` (`FOREIGN KEY (organization_id, parent_id) REFERENCES parent_table(organization_id, id)`), impidiendo a nivel de motor de base de datos que una fila de la organización A enlace con un padre de la organización B.
  - Solo se permiten diseños avanzados sin claves foráneas físicas cuando existan garantías alternativas explícitas y verificables.
- **Restricciones únicas por organización:** las restricciones de unicidad sobre datos de negocio organizacionales deben tener alcance de tenant (p. ej. `UNIQUE (organization_id, slug)`).
- **Restricción de operaciones especiales:**
  - `TRUNCATE` no respeta políticas RLS en PostgreSQL; el rol `app_exec` no debe poseer privilegios de `TRUNCATE`.
  - `COPY FROM` elude ciertas comprobaciones RLS y no se admite para operaciones de aplicación sujetas a RLS.
  - Las vistas sobre tablas organizacionales deben crearse obligatoriamente con `WITH (security_invoker = true)`.
  - Las funciones con `SECURITY DEFINER` deben restringirse rigurosamente y fijar explícitamente un `search_path` seguro para evitar escaladas de privilegios.
- **Separación de capas:** la autorización efectiva y las comprobaciones RBAC permanecen en Express; RLS actúa como garantía estricta de aislamiento de filas a nivel de datos.
- **Consultas parametrizadas:** todas las consultas SQL se construyen y parametrizan mediante Drizzle ORM; cualquier fragmento SQL personalizado debe validarse y tratarse de forma segura.
- **Extensibilidad modular:** los nuevos módulos de negocio generados o desarrollados deben poder incorporar entidades organizacionales registrando sus tablas y políticas bajo este patrón, sin necesidad de reescribir Auth ni desactivar RLS.

**Motivo:** Aborda metódicamente los hallazgos empíricos de INV-04a (comportamiento de `FORCE ROW LEVEL SECURITY`, cláusulas `WITH CHECK`, fallo de tipo con UUID vacíos, fuga por claves foráneas cruzadas, vulnerabilidades en vistas sin `security_invoker` y operaciones no aisladas como `TRUNCATE`).

**Consecuencias:** Las tablas organizacionales requieren la columna `organization_id`, políticas RLS completas (`USING` y `WITH CHECK`) y claves foráneas compuestas cuando se requiera garantizar aislamiento referencial entre entidades del mismo tenant.

---

### D-097 — Verificación estructural, evaluación de rendimiento, auditoría operativa y auditoría de acciones (RLS.4)

**Estado:** Confirmada (2026-11-16; consolidación de RLS.4 tras INV-04a e INV-04b).

**Contexto:** Se requería definir el marco de verificación automática del aislamiento RLS, la metodología de evaluación de rendimiento, la infraestructura de auditoría operativa de seguridad y la auditoría de acciones de negocio como capacidad transversal.

**Decisión:**
- **A. Auditoría estructural:**
  - Verificaciones automáticas de roles, privilegios de PostgreSQL, tablas protegidas, políticas activas, restricciones de integridad y aislamiento.
  - Inspección programática de catálogos del sistema PostgreSQL (`pg_tables`, `pg_roles`, `pg_policies`, etc.) combinada con pruebas funcionales reales sobre conexiones de prueba.
  - Detección automática de tablas organizacionales sin protección o con políticas permisivas (`USING (true)`) que comprometan el aislamiento.
  - Pruebas negativas y de concurrencia obligatorias: peticiones concurrentes de distintas organizaciones con contexto transaccional para verificar que no existan interferencias ni fugas de datos.
  - Fallos en verificaciones estructurales críticas bloquean la integración continua (CI).
  - Garantías y paridad funcional equivalentes en variantes JavaScript y TypeScript.
  - Integración futura en el sistema de verificación de seguridad previsto (`verify:security`, T-018).
  - Las comprobaciones estructurales de catálogo son de verificación y prueba; no deben ejecutarse en cada petición HTTP en producción.
- **B. Evaluación de rendimiento:**
  - Benchmarks representativos con y sin RLS ejecutados exclusivamente en laboratorios de prueba aislados.
  - Comparación formal de consultas equivalentes con filtros organizacionales e índices adecuados en `organization_id`.
  - Métricas obligatorias: `EXPLAIN (ANALYZE, BUFFERS)` para descartar escaneos secuenciales involuntarios, latencias p50 y p95, y consumo de recursos de memoria y CPU.
  - Documentación sistemática de degradaciones observadas y optimizaciones de índices recomendadas.
  - Queda terminantemente prohibido ofrecer una variante pública multitenant sin RLS.
- **C. Auditoría operativa de seguridad:**
  - Infraestructura centralizada en el backend para registrar eventos relevantes de seguridad: intentos de autenticación fallidos/exitosos, decisiones de autorización denegadas y accesos denegados a organizaciones.
  - Correlación obligatoria mediante identificador de petición (`requestId` / `correlationId`).
  - Recolección de evidencia suficiente para investigar anomalías o intentos repetidos sospechosos (IP de origen, actor, timestamp, recurso intentado).
  - Posibilidad de generar alertas ante patrones configurables de anomalía o abuso.
  - Principio de diseño: no asumir que PostgreSQL RLS informa automáticamente de consultas que devuelven cero filas por filtrado.
  - Minimización de datos: prohibido registrar contraseñas, tokens de sesión o datos sensibles innecesarios.
  - En la versión v1 no se incluye dashboard visual de seguridad empresarial ni integración obligatoria con SIEM.
- **D. Auditoría de acciones de negocio:**
  - **Capacidad transversal** disponible para proyectos que incluyan Auth, no exclusiva de multitenancy.
  - Registro estructurado de auditoría: quién ejecutó la acción (actor autenticado), cuándo (timestamp UTC), sobre qué recurso (tipo e ID) y qué campos relevantes cambiaron (valores anteriores/posteriores relevantes).
  - Identidad del actor extraída siempre de forma inmutable del `ActorContext` autenticado y validado, nunca de campos arbitrarios del cliente.
  - Instrumentación de operaciones críticas del sistema: cambios en Auth, asignación/revocación de roles y permisos en RBAC, aprovisionamiento/revocación de concesiones de acceso organizacionales.
  - Mecanismo reutilizable y sencillo para que futuros módulos de negocio registren sus eventos críticos.
  - **Atomicidad transaccional:** la operación de negocio y su correspondiente evento de auditoría deben persistirse atómicamente dentro de la misma transacción de base de datos.
  - Minimización de datos: evitar almacenar secretos o copias completas innecesarias de datos sensibles.
  - Distinción explícita entre acciones ejecutadas por humanos y procesos automatizados del sistema.
  - **Historial de solo adición (*append-only*):** la tabla de auditoría no admite modificaciones ni borrados.
  - Administradores autorizados: únicamente pueden visualizar los eventos de auditoría correspondientes a su ámbito (alcance de sistema o de su respectiva organización).
  - Prohibición de controles visuales o endpoints de API para editar o borrar entradas del historial de auditoría.
  - Privilegios de base de datos: el rol `app_exec` carece de permisos `UPDATE` y `DELETE` sobre las tablas de auditoría de acciones.
  - Rechazo explícito de intentos de manipulación de registros de auditoría, registrando dichos intentos observables como incidentes de seguridad.
  - Definición de políticas de retención, protección de registros y acceso autorizado.
  - Limitación documentada: no se promete inmutabilidad absoluta frente a administradores con privilegios de superusuario en el motor de base de datos.
  - Extensiones futuras: paneles visuales avanzados de auditoría y detección especializada de fraudes.
- **Documentación para desarrolladores (requisito de implementación):**
  - Se establecen como entregables obligatorios dos niveles de documentación:
    1. **Guía práctica breve:** orientada al desarrollador, con ejemplos concretos de cómo agregar nuevas tablas organizacionales, ejecutar operaciones autorizadas en transacciones y registrar eventos en la auditoría de acciones.
    2. **Referencia técnica:** descripción detallada de políticas RLS, permisos de roles PostgreSQL, análisis de amenazas mitigadas, batería de pruebas de aislamiento, garantías formales y limitaciones conocidas.

**Motivo:** El aislamiento mediante RLS exige verificación automatizada rigurosa para evitar degradaciones silenciosas del aislamiento. Asimismo, la seguridad operativa y la trazabilidad de negocio proporcionan visibilidad y rendición de cuentas indispensables para mitigar riesgos internos, manteniendo una implementación pragmática sin sobreingeniería para v1.

**Consecuencias:** La CI debe incorporar verificaciones estructurales de catálogo PostgreSQL y pruebas de concurrencia RLS. Los módulos críticos de Auth/RBAC deben registrar eventos de negocio atómicamente. Se requiere elaborar la guía práctica y la referencia técnica para desarrolladores.

---

### D-098 — Estrategia JavaScript/TypeScript: Híbrido versionado con derivación determinista desde TypeScript

**Estado:** Confirmada (2026-11-16; fundamentada en INV-05b, su complemento e INV-08; implementación pendiente en T-023).

**Contexto:** Mantener de forma manual plantillas duplicadas completas en JavaScript y TypeScript genera costes crecientes de sincronización y riesgo de discrepancias lógicas a medida que se incorporan capacidades complejas (Auth, RBAC, multitenancy). Era necesario definir un modelo que redujera la duplicación manteniendo las garantías de legibilidad, calidad y paridad funcional de ambas variantes, sin penalizar a los proyectos generados ni añadir sobrecarga de compilación al CLI.

**Decisión:**
- **Modelo aprobado: Híbrido versionado.**
  - **TypeScript como fuente de verdad:** el código aplicativo y las pruebas de las plantillas se implementan y evolucionan en TypeScript.
  - **Derivación automática a JavaScript:** los archivos JavaScript correspondientes se derivan automáticamente desde las fuentes TypeScript.
  - **Archivos JavaScript versionados:** los archivos JavaScript derivados permanecen versionados en Git en el repositorio de Brixa.
  - **Transformación AST con Babel:** la eliminación de tipos y transformaciones se realiza mediante Babel y transformaciones sobre el AST con formateo determinista, descartando transformaciones estructurales mediante expresiones regulares frágiles.
  - **Preservación de artefactos y semántica:** la derivación conserva comentarios, JSX, semántica original, marcadores de inserción de overlays (p. ej. `// @@INSERT:...@@`) e imports correctos.
  - **Disciplina de `import type`:** uso obligatorio de `import type` en TypeScript para importaciones utilizadas exclusivamente como tipos, asegurando su elisión limpia sin dejar imports vacíos o huérfanos en JavaScript.
  - **Mantenimiento manual acotado:** se mantienen manualmente los archivos con diferencias legítimas y estructurales entre lenguajes: `package.json`, Dockerfiles, configuraciones de ESLint (`eslint.config.js`), configuraciones de Drizzle (`drizzle.config.js` vs `drizzle.config.ts`) y archivos exclusivos de TypeScript (como `tsconfig.json`).
  - **Tratamiento explícito de excepciones:** gestión específica de cadenas literales y referencias a nombres de archivo o extensiones (p. ej. rutas a módulos `.js` vs `.ts` en configuraciones o migradores).
  - **CLI desacoplado del derivador:** el CLI continuará copiando plantillas preconstruidas desde disco; no ejecuta Babel ni TypeScript durante la generación del proyecto. El tiempo de generación permanece inalterado.
  - **Cero dependencias adicionales:** los proyectos JavaScript generados no incorporan dependencias adicionales por este mecanismo.
  - **Paridad y garantías idénticas:** se mantienen intactas todas las garantías de seguridad y paridad funcional en ambas variantes (JavaScript y TypeScript), especialmente para Auth, RBAC y multitenancy.

- **Requisitos de sincronización y validación (a implementar en T-023):**
  - **Comando de derivación explícito:** script/herramienta en el repositorio para actualizar los archivos JavaScript derivados.
  - **Comando `verify:sync` (solo lectura):** comprobación determinista que compare la derivación esperada con los archivos JavaScript versionados, verificando contenido y detectando cualquier modificación de lógica interna.
  - **Integración de `verify:sync` en CI:** bloqueo automático de pull requests si se detecta desincronización entre TypeScript y JavaScript.
  - **Verificaciones obligatorias:**
    - `typecheck` obligatorio de las fuentes TypeScript.
    - `eslint` y ejecución de pruebas en ambas variantes generadas (JavaScript y TypeScript).
    - Verificación de combinaciones y overlays mediante el arnés existente de Brixa (`verify:generated`).
    - Fallo explícito ante imports inválidos, diferencias de sincronización o archivos derivados incorrectos.

**Límites conocidos y pendientes:**
- El piloto técnico INV-08 validó la viabilidad de la derivación sobre overlays y código aplicativo; no presupone la comprobación integral en Docker ni sobre bases de datos PostgreSQL reales (verificaciones que continúan pendientes en sus respectivas etapas).
- El derivador, el comando `verify:sync` y las verificaciones en CI no están implementados todavía; su construcción e integración constituyen un prerrequisito obligatorio antes de implementar los módulos Auth y RBAC.

**Motivo:** Las investigaciones INV-05b e INV-08 demostraron que la derivación por AST/Babel proporciona diffs limpios, conserva fidelidad con el código original, elimina la duplicación manual y garantiza paridad estricta entre variantes sin añadir latencia de generación al CLI ni dependencias a los proyectos generados.

**Consecuencias:** Se formaliza la tarea T-023 para implementar el derivador y `verify:sync`, la cual debe completarse y verificarse antes de abordar la codificación de las plantillas de Auth y RBAC.

---

### D-099 — Cookies y desarrollo local: Secure obligatorio en producción, excepción HTTP controlada y prefijo __Host- (T-014-0 A-1)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 A-1).

**Contexto:** D-089 fijó las opciones base de cookies (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sin `Domain` y nombre específico por proyecto). Sin embargo, era necesario reglamentar formalmente los entornos de desarrollo local sobre HTTP, el comportamiento ante proxies de terminación TLS y las condiciones de emisión del prefijo `__Host-`.

**Decisión:**
- **Producción:** HTTPS y cookies con atributo `Secure` estrictamente obligatorias. Cualquier configuración que intente emitir cookies de sesión sin `Secure` en producción o staging debe fallar de forma temprana y explícita al arrancar el servidor (mediante validación Zod en `src/config`), sin degradación silenciosa ni permisiva.
- **Desarrollo HTTP local:** Se autoriza una excepción explícita y acotada únicamente cuando `NODE_ENV === 'development'` sobre orígenes locales (`localhost` o `127.0.0.1`), permitiendo omitir el atributo `Secure`. Esta excepción debe emitir un aviso técnico visible en la consola de arranque; queda prohibido silenciarla. La excepción nunca aplica a entornos staging ni producción.
- **HttpOnly y SameSite=Lax:** Se mantienen rigurosamente obligatorios en todos los entornos sin excepción alguna, incluido desarrollo local sobre HTTP.
- **Prefijo `__Host-`:** Se utilizará única y exclusivamente cuando se cumplan de forma acumulativa y estricta todos sus requisitos formales: conexión sobre origen seguro HTTPS (atributo `Secure` activo), ruta raíz (`Path=/`) y ausencia total del atributo `Domain`. En desarrollo local sobre HTTP donde `Secure` no esté habilitado, el prefijo `__Host-` no se emitirá para evitar el rechazo de la cookie por el navegador.
- **Terminación TLS mediante proxy:** En topologías con terminación TLS en proxies inversos o balanceadores de carga confiables (p. ej. Nginx, Cloudflare, AWS ALB), Express debe configurarse explícitamente con `trust proxy` acotado a la red interna confiable para inspeccionar cabeceras `X-Forwarded-Proto` y validar el protocolo seguro.
- **Separación conceptual de HSTS:** No confundir la configuración de cookies seguras con la cabecera HSTS (`Strict-Transport-Security`). De acuerdo con D-074, HSTS no es configurado por Brixa en la aplicación Express y debe ser gestionado por el operador en el proxy de terminación TLS.

**Motivo:** Proporciona una clara frontera defensiva que impide que excepciones de desarrollo degraden la seguridad de producción, respetando los estándares de navegadores modernos sin romper la experiencia del desarrollador en local.

---

### D-100 — Proveedor de identidad en Auth v1: identidad interna exclusiva y desacoplamiento para extensiones futuras (T-014-0 A-2)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 A-2).

**Contexto:** Se requería delimitar si Auth v1 contemplaría autenticación externa o federada y cómo se vincula la identidad global con el modelo de multitenancy.

**Decisión:**
- **Identidad interna exclusiva en v1:** Auth v1 utiliza única y exclusivamente el proveedor de identidad interno de Brixa (usuarios creados y autenticados localmente en el backend del proyecto generado).
- **Multitenancy acoplado a la identidad global interna:** El modelo multitenant de Brixa v1 depende exclusivamente de esta identidad global interna y sus concesiones de acceso (`access_grants`).
- **Fuera de alcance en v1:** Quedan terminantemente excluidos en v1 protocolos OAuth 2.0, OIDC, SAML, SSO empresarial y la autenticación mediante proveedores externos de identidad (Google, GitHub, Microsoft, etc.).
- **Preservación arquitectónica:** La arquitectura de identidad desacopla limpiamente la entidad de usuario (`users`) y la propagación de `ActorContext` (D-080) respecto a los casos de uso y la autorización. No se generan adaptadores, interfaces ni hooks especulativos en v1, pero la estructura de datos no asume que el identificador global deba provenir irremediablemente de una contraseña local, facilitando adaptaciones futuras sin refactorizaciones destructivas.

**Motivo:** Enfocar los recursos y garantías en un núcleo seguro, comprobable y sin dependencias externas de red o servicios de terceros para el hito v1.

---

### D-101 — Ciclo de vida y expiración de sesiones: doble control temporal, persistencia desacoplada y revocación inmediata (T-014-0 B-1)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 B-1 y especificación de D-088).

**Contexto:** D-088 estableció el modelo general de sesiones opacas con expiración deslizante y límite absoluto. Era necesario fijar los parámetros operativos predeterminados, los mecanismos de actualización en base de datos para evitar contención por concurrencia y las garantías formales de expiración.

**Decisión:**
- **Doble control temporal predeterminado:**
  - **Inactividad máxima deslizante (`idle_timeout`):** 30 minutos.
  - **Duración absoluta e improrrogable (`max_lifetime`):** 12 horas desde la creación original de la sesión.
  - Ambos parámetros son configurables mediante variables de entorno validadas con Zod (`SESSION_IDLE_TIMEOUT_MINUTES`, `SESSION_MAX_LIFETIME_HOURS`).
- **Validación del lado servidor en cada petición:** PostgreSQL es la única autoridad sobre la vigencia y estado de las sesiones. Cada solicitud autenticada verifica en la base de datos que la sesión no esté expirada por inactividad, que no haya superado el límite absoluto y que no haya sido revocada explícitamente.
- **Actualización diferida de actividad con umbral de 60 segundos:**
  - Para evitar saturación y contención por bloqueos en bases de datos ante ráfagas de solicitudes concurrentes de un mismo usuario, la actualización de `last_activity_at` en base de datos solo se persiste si han transcurrido al menos **60 segundos** desde la última actualización persistida.
  - Las peticiones intermedias leen y validan la sesión en memoria/BD sin emitir sentencias `UPDATE`.
- **Garantías estrictas de expiración en actualización diferida:**
  - El mecanismo de actualización diferida nunca puede extender la vida de la sesión más allá del límite absoluto (`created_at + max_lifetime`).
  - La expiración efectiva por inactividad se evalúa siempre contra el valor persistido de `last_activity_at` y el umbral configurado. El retraso máximo en la persistencia (60 s) es conocido y acotado, no compromete la seguridad y se contempla en la validación.
- **Exclusión de tráfico de mantenimiento:** Las consultas automáticas de mantenimiento (tales como sondeos de salud `/health`, polling periódico de interfaz o telemetría) **no prolongan la sesión**. Solo solicitudes que correspondan a interacción intencional o mutaciones de negocio actualizan la marca de actividad.
- **Sin rotación periódica de tokens en v1:** Se ratifica D-088. No se realiza rotación automática periódica de tokens de sesión durante peticiones ordinarias para evitar condiciones de carrera en navegadores. La rotación del identificador de sesión se reserva estrictamente para eventos de seguridad sensibles (cambio de credenciales o elevación de privilegios).
- **Revocación inmediata:** La invalidación de una sesión (vía borrado o marca `revoked_at` en BD) surte efecto instantáneo e ineludible en la petición inmediatamente posterior.

**Motivo:** Equilibrio riguroso entre seguridad estricta (revocación inmediata, caducidad absoluta improrrogable) y eficiencia operativa en PostgreSQL, evitando problemas de contención de filas detectados en pruebas de carga concurrentes.

---

### D-102 — Límites defensivos criptográficos y operativos de Argon2id (T-014-0 B-2)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 B-2 y concreción de parámetros de D-092/D-093).

**Contexto:** D-091 a D-093 fijaron Argon2id (`@node-rs/argon2` 2.2.2) y sus parámetros de coste base (`m=19456`, `t=2`, `p=1`). Se requería establecer los límites defensivos de verificación de formato PHC, los parámetros del limitador de concurrencia y la política de protección frente a saturación de memoria en contenedores.

**Decisión:**
- **Límites defensivos para verificación PHC (validación previa antes de invocar `verify()`):**
  - **Algoritmo:** estrictamente `argon2id`, versión `19` (`v=19`).
  - **Longitud máxima del string PHC:** 512 bytes.
  - **Rango de memoria permitido ($m$):** `19456 KiB` a `65536 KiB` (19 MiB a 64 MiB).
  - **Rango de iteraciones ($t$):** `2` a `4` pasadas.
  - **Rango de paralelismo ($p$):** `1` a `2` hilos.
  - **Longitud de salt:** `16` a `32` bytes (en Base64 sin padding).
  - **Longitud de hash de salida:** exactamente `32` bytes (en Base64 sin padding).
  - Hashes que no cumplan estos límites o presenten sintaxis corrupta se rechazan inmediatamente **sin ejecutar Argon2id**, registrando un aviso técnico estructurado que omite secretos y contraseñas.
- **Configuración operativa del limitador de concurrencia por proceso:**
  - Máximo de **2 operaciones simultáneas** de Argon2id por proceso Node.js.
  - Cola de espera acotada a un máximo de **8 solicitudes** por proceso.
  - Ante saturación (cola llena > 8): rechazo inmediato y controlado con **HTTP 503 (Service Unavailable)** y cabecera `Retry-After: 5`.
  - Este limitador aplica a todas las operaciones computacionales de Argon2id: `hash()`, `verify()` y la verificación simulada (*dummy hash*) contra enumeración por tiempo.
- **Independencia de capas de rate limiting:** El limitador de concurrencia local protege la memoria y la CPU del contenedor ante ráfagas. En la capa HTTP previa opera de forma independiente el rate limiting de autenticación, respondiendo con **HTTP 429 (Too Many Requests)** ante exceso de intentos por IP o identificador de cuenta.
- **Estrategia de rehash transparente:** La actualización de coste se ejecuta únicamente tras una verificación exitosa de credenciales y cuando los parámetros del hash almacenado difieran de los parámetros operativos vigentes (D-092), pero sigan dentro del rango defensivo aprobado.
- **Ajustes operativos y restricciones:** Los valores operativos de concurrencia y cola pueden ajustarse mediante variables de entorno según la capacidad del host/contenedor, pero queda prohibida la ampliación arbitraria de los límites criptográficos defensivos máximos ($m > 65536$ KiB, $t > 4$).
- **Limitación documentada:** El limitador es local a la memoria de cada proceso Node.js. En despliegues multinodo o multi-proceso (clustering, PM2, réplicas de Kubernetes), la concurrencia global simultánea equivale a $N \times 2$. La protección global ante ataques distribuidos recae en el rate limiting perimetral.
- **Sin preguntas individuales en el CLI:** Los parámetros se generan con valores predeterminados seguros sin añadir prompts redundantes al generador.

**Motivo:** Garantiza que un atacante no pueda provocar la muerte del proceso por falta de memoria (OOM kill) enviando hashes manipulados con parámetros extremos, manteniendo la disponibilidad del servicio mediante colas acotadas y degradación elegante con HTTP 503.

---

### D-103 — Protección CSRF multicapa para cookies sin sincronizador en topología same-origin (T-014-0 B-3)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 B-3; complementa D-089).

**Contexto:** D-089 determinó el uso exclusivo de cookies para aplicaciones fullstack y selección en backend independiente, obligando a proteger contra falsificación de solicitudes entre sitios (CSRF). Se requería definir el contrato técnico exacto de protección CSRF para la topología de Brixa.

**Decisión:**
- **Middleware centralizado de protección CSRF:** Se implementa un middleware centralizado obligatorio en Express aplicado a todas las rutas que alteren estado (`POST`, `PUT`, `PATCH`, `DELETE`) autenticadas mediante cookies de sesión.
- **Validación estricta de origen:**
  - Verificación obligatoria de las cabeceras `Origin` (prioritaria) o `Referer` (como alternativa si `Origin` está ausente) contra la lista estricta de orígenes autorizados del proyecto (`CORS_ALLOWED_ORIGINS` y el propio origen de la aplicación).
  - Si la cabecera está ausente o su valor no coincide con un origen autorizado, la petición se deniega inmediatamente por defecto con **HTTP 403 (Forbidden)**.
- **Fetch Metadata complementario:** Utilización de cabeceras estándar de metadatos de petición del navegador (`Sec-Fetch-Site: same-origin` o `same-site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest`) como capa adicional de defensa en profundidad donde estén soportadas por el cliente.
- **Cabecera personalizada obligatoria en mutaciones de API:** Las peticiones mutables dirigidas a la API deben incluir obligatoriamente una cabecera personalizada (p. ej. `X-Requested-With: XMLHttpRequest` o cabecera declarativa de cliente). Dado que las peticiones entre orígenes inducidas por HTML estándar (`<form>`, `<img>`, `<iframe>`) no pueden adjuntar cabeceras personalizadas sin activar preflight CORS, esta regla bloquea vectores tradicionales de explotación CSRF.
- **CORS restrictivo (D-074):** CORS permanece restringido estrictamente a orígenes explícitos; denegación absoluta de comodines (`*`) o valor `null`.
- **Sin token CSRF sincronizador adicional en v1:** En la topología fullstack generada por Brixa (mismo origen bajo Nginx en producción y proxy Vite en desarrollo), la combinación rigurosa de cookies con `SameSite=Lax`, validación de `Origin`/`Referer`, Fetch Metadata y cabecera personalizada obligatoria proporciona protección robusta y suficiente sin la sobrecarga ni los problemas de desincronización de tokens CSRF en memoria/sesión.
- **Cobertura de operaciones de autenticación:** La protección CSRF aplica también a los endpoints de inicio de sesión (`/login`), cierre de sesión (`/logout`) y activación de cuentas, impidiendo ataques de *login CSRF* o revocaciones forzadas de sesión.
- **Idempotencia de métodos seguros:** Se garantiza contractualmente que los métodos `GET` y `HEAD` nunca realicen mutaciones de negocio ni alteren el estado de recursos o sesiones.
- **Defensa en profundidad y distinción frente a XSS:** La protección CSRF mitiga únicamente solicitudes no autorizadas originadas en otros sitios; no sustituye ni protege contra ataques XSS. Si un atacante ejecuta JavaScript en el mismo origen, puede eludir la protección CSRF. Por ello, las defensas contra XSS (CSP estricta D-074/D-075, atributos `HttpOnly` en cookies y escape en React) son obligatorias e independientes.

**Motivo:** Solución estandarizada, de alto rendimiento y cero mantenimiento de estado de tokens en el servidor, adaptada a la arquitectura fullstack moderna en el mismo origen.

---

### D-104 — Migraciones PostgreSQL RLS: Drizzle Schema y migraciones SQL versionadas con separación de privilegios (T-014-0 B-4)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 B-4 y especificación de D-094 a D-096).

**Contexto:** D-094 a D-096 establecieron el diseño de roles (`app_exec` / `table_owner`), políticas RLS y directivas `FORCE ROW LEVEL SECURITY`. Se requería definir el flujo de migraciones y compatibilidad con Drizzle ORM y Drizzle Kit.

**Decisión:**
- **Drizzle Schema como fuente de verdad estructural:** El modelo de tablas, columnas, tipos de datos, índices y relaciones continúa definiéndose y manteniéndose exclusivamente en el esquema Drizzle (`schema.ts` / `schema.js`).
- **Migraciones SQL versionadas y personalizadas para RLS:** Las directivas que escapan a la definición declarativa de Drizzle ORM —tales como `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`, `ALTER TABLE ... FORCE ROW LEVEL SECURITY;`, `CREATE POLICY ...` y concesiones de privilegios (`GRANT`/`REVOKE`) a roles PostgreSQL— se implementan como **migraciones SQL personalizadas y versionadas**.
- **Integración con el flujo de migraciones de Drizzle:** Estas sentencias SQL se incorporan en la carpeta de migraciones estándar (`drizzle/`) como archivos `.sql` versionados y registrados en el manifiesto de Drizzle, asegurando su ejecución ordenada y reproducible mediante el comando estándar del proyecto (`npm run db:migrate`).
- **Separación estricta de credenciales en migraciones (D-094):**
  - Las migraciones (`npm run db:migrate`) se ejecutan exclusivamente utilizando `MIGRATION_DATABASE_URL` conectada con el rol propietario del esquema (`table_owner`).
  - La aplicación en ejecución opera estrictamente con `DATABASE_URL` conectada con el rol de privilegios mínimos `app_exec`.
- **Aprovisionamiento previo de roles separado de las migraciones:** La creación de los roles de base de datos (`app_exec`, `table_owner`) y la asignación inicial de contraseñas constituyen tareas de aprovisionamiento de infraestructura externa (documentadas con scripts SQL de aprovisionamiento para el operador), independientes de las migraciones de esquema de la aplicación. Las migraciones asumen la existencia previa de estos roles.
- **Verificación en PostgreSQL real:** La compatibilidad de las políticas RLS y de las migraciones SQL personalizadas debe verificarse empíricamente contra instancias reales de PostgreSQL 17 utilizando la versión exacta fijada de Drizzle Kit en el proyecto.
- **Prohibición absoluta:** Bajo ninguna circunstancia se desactivará RLS ni se otorgarán privilegios de superusuario a `app_exec` para eludir fallos de configuración de migraciones.

**Motivo:** Preserva la elegancia y tipado de Drizzle para la definición del esquema mientras asegura la aplicación reproducible, determinista e inmutable de las políticas de seguridad a nivel de motor de base de datos.

---

### D-105 — Auditoría de dos ámbitos: sistema global y organizacional con integridad transaccional (T-014-0 B-5)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 B-5 y especificación de D-097).

**Contexto:** D-097 aprobó la auditoría operativa y de acciones de negocio. Se requería estructurar la taxonomía de registros distinguiendo claramente los ámbitos de plataforma frente a los de tenant, el comportamiento transaccional y la inmutabilidad relacional.

**Decisión:**
- **Taxonomía en dos ámbitos de auditoría:**
  1. **Auditoría global o de sistema (`audit_log_system`):**
     - Registra eventos de autenticación y seguridad (inicios de sesión exitosos y fallidos, logouts, activación de cuentas, cambios de contraseña, intentos de fuerza bruta detectados), operaciones administrativas globales (creación y desactivación de usuarios globales, aprovisionamiento de organizaciones, bootstrap inicial) e intentos no autorizados de acceso a organizaciones.
     - Ámbito global sin columna obligatoria `organization_id`.
     - Acceso de consulta restringido estrictamente a operadores y administradores de plataforma autorizados.
  2. **Auditoría organizacional (`audit_log_org`):**
     - Registra acciones relevantes y mutaciones de recursos dentro de cada organización (cambios de configuración de tenant, asignación/revocación de roles RBAC a concesiones, altas/bajas de concesiones de acceso, eventos críticos de negocio).
     - Contiene obligatoriamente la columna `organization_id` no nula.
     - Protegida obligatoriamente mediante PostgreSQL RLS (`ENABLE` y `FORCE ROW LEVEL SECURITY`), asegurando que ningún tenant pueda consultar eventos de auditoría de otra organización.
     - Acceso de consulta disponible para administradores autorizados de la propia organización.
- **Garantías de inmutabilidad y privilegios de base de datos:**
  - Tablas estrictamente *append-only* (solo inserción).
  - El rol de base de datos de ejecución (`app_exec`) carece contractualmente de privilegios `UPDATE` y `DELETE` sobre las tablas de auditoría.
  - Queda prohibida la generación de endpoints o interfaces que permitan modificar o eliminar entradas de auditoría.
- **Atomicidad transaccional y registro de fallos:**
  - Las acciones de negocio exitosas y su correspondiente evento de auditoría se persisten atómicamente dentro de la misma transacción de base de datos (`tx`). Si la operación de negocio falla, el evento de auditoría de negocio no se persiste.
  - Los **eventos de seguridad y operaciones rechazadas** (p. ej. denegación de autorización 403, accesos no autorizados, anomalías) se persisten **fuera de la transacción revertida**, utilizando una transacción o conexión de registro independiente para garantizar que el intento hostil o anómalo quede registrado de forma indeleble.
- **Correlación y trazabilidad:** Cada entrada de auditoría incluye obligatoriamente el identificador de correlación `requestId` extraído de la petición HTTP, marca temporal UTC de alta precisión y el `actor_id` extraído del `ActorContext` autenticado.
- **Proyectos sin multitenancy:** Cuando un proyecto se genera con Auth pero sin multitenancy, la auditoría opera exclusivamente bajo el ámbito global (`audit_log_system`), sin generar la tabla ni la infraestructura RLS de `audit_log_org`.
- **Limitación documentada:** La inmutabilidad relacional protege contra ataques a nivel de aplicación; no se promete inmutabilidad absoluta frente a superusuarios o administradores con acceso físico a PostgreSQL (D-097 ratificado).
- **Alcance v1:** Sin panel empresarial de visualización masiva de auditoría ni integración obligatoria con sistemas SIEM en la versión v1.

**Motivo:** Garantiza trazabilidad forense completa, separación estricta de responsabilidades entre plataforma y organizaciones y resistencia técnica frente a intentos de borrado de huellas por actores comprometidos.

---

### D-106 — Delegación administrativa, RBAC efectivo, protección del último administrador y no abandono voluntario (T-014-0 B-6)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 B-6 y especificación de D-082/D-084).

**Contexto:** Se requería definir el modelo de autoridad delegable para operaciones administrativas, las salvaguardas de integridad en asignación de roles y la política formal respecto al abandono de organizaciones.

**Decisión:**
- **Autorización administrativa explícita:** Toda operación administrativa (creación de usuarios, asignación de roles, modificación o revocación de accesos) requiere permisos específicos e inequívocos en el catálogo de permisos.
- **Principio de autoridad delegable:** Poseer un permiso no otorga automáticamente la facultad de concederlo a otros. La asignación de roles y permisos exige un permiso explícito de delegación administrativa y está restringida a conceder únicamente capacidades que formen parte de la autoridad delegable del actor. Nadie puede otorgar privilegios superiores a los que posee.
- **Verificación de permisos efectivos:** El motor de autorización comprueba los permisos efectivos y vigentes del actor tras resolver su jerarquía/asignación, nunca basándose en comparaciones directas de nombres literales de roles (p. ej. `role.name === 'ADMIN'`).
- **Prohibición de automodificación de privilegios:** Ningún actor autenticado puede modificar directamente sus propios roles, permisos o concesiones de acceso, ni alterar los privilegios de otros actores con el fin de auto-escalarse privilegios o auto-degradarse sin supervisión.
- **Separación rigurosa de plataforma y organización (D-084 ratificado):** Los administradores de plataforma operan estrictamente en el ámbito de sistema y no administran roles internos de organizaciones salvo que cuenten con una concesión explícita en el tenant respectivo.
- **Protección del último administrador efectivo:**
  - En cada ámbito que requiera administración (nivel global de plataforma y en cada organización con RBAC activo), se garantiza la invariante de que **siempre debe existir al menos un administrador activo y efectivo**.
  - Cualquier intento de revocar la concesión, degradar el rol o eliminar la cuenta del último administrador efectivo debe ser rechazado inmediatamente con error explícito de regla de negocio.
  - La verificación de esta invariante debe realizarse dentro de una transacción de base de datos con bloqueo de concurrencia (`SELECT ... FOR UPDATE` o bloqueo pesimista equivalente) para prevenir condiciones de carrera cuando dos administradores intenten revocarse mutuamente de forma concurrente.
- **Multitenancy sin RBAC (D-083 ratificado):** En proyectos generados con multitenancy pero sin RBAC, no se generan administradores basados en roles ni jerarquías artificiales en las organizaciones.
- **Gestión de concesiones administrada y prohibición de auto-abandono:**
  - **Decisión adicional expresa:** Los usuarios no pueden abandonar voluntariamente una organización ni autorrevocar sus propias concesiones de acceso.
  - Las concesiones de acceso (`access_grants`) son creadas, administradas y revocadas exclusivamente por actores formalmente autorizados mediante las operaciones administrativas de la organización.
  - Queda expresamente prohibido generar endpoints o interfaces de autoservicio para "abandonar organización" (*leave organization*).
- **Trazabilidad:** Toda modificación, concesión o revocación administrativa se registra de forma obligatoria en la auditoría correspondiente (D-105).

**Motivo:** Elimina vectores críticos de escalada de privilegios y previene el bloqueo irreversible de organizaciones por desadministración o carreras concurrentes.

---

### D-107 — Aprovisionamiento administrado y activación segura de cuentas sin contraseñas predeterminadas ni SMTP (T-014-0 B-7 y Decisión Adicional de Activación)

**Estado:** Confirmada (2026-11-17; consolidación de T-014-0 B-7 y resolución formal del pendiente de activación inicial de cuentas).

**Contexto:** Se requería definir el flujo de aprovisionamiento de identidades globales en Auth v1 y resolver el mecanismo para el establecimiento inicial de credenciales de forma segura, sin introducir contraseñas predeterminadas ni dependencias externas de correo electrónico (SMTP).

**Decisión:**
- **Modelo de aprovisionamiento administrado en Auth v1:**
  - El alta de usuarios se realiza de forma administrada: un administrador autorizado inicia la creación de la identidad global a través del endpoint administrativo correspondiente.
  - **Reutilización de identidad global:** Si la dirección de correo o identificador global ya existe en el sistema, se reutiliza su identidad global única sin crear registros duplicados.
  - **Concesión directa de acceso organizacional:** El administrador puede asignar directamente una concesión de acceso (`access_grants`) al usuario sobre la organización correspondiente. Si RBAC está activo, los roles organizacionales se asignan a dicha concesión.
  - **Independencia en revocación:** Revocar el acceso a una organización afecta únicamente a la concesión (`revoked_at` en `access_grants`), sin destruir la identidad global del usuario.
  - **Invitaciones fuera de alcance en v1:** No se genera un sistema de invitaciones con aceptación voluntaria ni enlaces de invitación para unirse a organizaciones. Las invitaciones voluntarias quedan como evolución futura.
  - **Sin dependencia de SMTP en el núcleo:** Brixa Auth v1 no exige servidores de correo saliente ni bibliotecas de envío de emails.
- **Activación segura de cuentas creadas administrativamente:**
  1. Al crear administrativamente un nuevo usuario, la cuenta permanece en estado **pendiente de activación** (`pending_activation`).
  2. El backend genera un token de activación de alta entropía compuesto por **32 bytes criptográficamente aleatorios** (`crypto.randomBytes(32)` o Web Crypto API), con tiempo de caducidad limitado y de **un solo uso**.
  3. En la base de datos se almacena **exclusivamente el hash SHA-256** del token de activación; bajo ninguna circunstancia se persiste el token en claro ni de forma reversible.
  4. El enlace de activación completo (conteniendo el token en claro en el fragmento o parámetro) se entrega al administrador de forma controlada y segura en la respuesta del comando o API administrativa, para que sea compartido con el destinatario final mediante un canal privado y confiable (mensajería segura, entrega directa, etc.).
  5. **Propósito estrictamente acotado:** El enlace de activación únicamente permite acceder al formulario para establecer la contraseña inicial; no otorga acceso a datos de negocio, no permite omitir la autenticación y no inicia automáticamente una sesión autenticada.
  6. **Consumo atómico y validación:** El endpoint de activación valida el token contra su hash en base de datos, comprueba que no haya expirado ni haya sido utilizado, procesa la contraseña inicial mediante Argon2id (D-091/D-092) y **consume el token de forma estrictamente atómica** dentro de la misma transacción (marcado como consumido o eliminado).
  7. **Transición a estado activo:** Una vez completada la activación, la cuenta pasa a estado activo y el usuario puede iniciar sesión normalmente a través del flujo ordinario de autenticación.
  8. **Revocación y regeneración administrativa:** Un administrador autorizado puede invalidar en cualquier momento un enlace de activación pendiente y generar un nuevo token de activación sin necesidad de eliminar ni recrear la identidad del usuario.
  9. **Protección de confidencialidad:** Prohibición absoluta de registrar el token de activación en claro en logs, registros de auditoría o respuestas de error de la API.
  10. **Defensa contra abuso y enumeración:** El endpoint de activación aplica rate limiting riguroso contra ataques de fuerza bruta y devuelve respuestas uniformes ante tokens inválidos o expirados para mitigar la enumeración de estados de cuentas.
  11. **Auditoría:** Todos los eventos del ciclo de vida de la cuenta (creación de identidad, generación de token de activación, consumo exitoso, revocación y expiración) se registran de forma obligatoria en la auditoría global de sistema (D-105).
- **Comportamiento con usuarios existentes y multitenancy:**
  - Si una identidad global ya completó su activación previamente, el administrador puede concederle acceso a nuevas organizaciones directamente sin generar nuevos enlaces de activación.
  - En proyectos multitenant, las concesiones organizacionales pueden preconfigurarse para una cuenta, pero permanecen inutilizables hasta que la cuenta complete satisfactoriamente su activación inicial.
- **Parámetros configurables en implementación:** La duración de validez del enlace de activación (valor de referencia propuesto: 48 horas) se define como una variable de entorno validada con Zod (`ACTIVATION_TOKEN_EXPIRY_HOURS`), sin inventar una decisión histórica rígida.

**Motivo:** Resuelve de forma segura, elegante y autocontenida el aprovisionamiento de identidades sin credenciales predeterminadas ni falsas dependencias de infraestructura SMTP, cerrando el modelo de autenticación y autorización de Brixa.

---

## 5. Cuestiones pendientes

- P-002: confirmación definitiva de versiones de dependencias de proyectos generados. El baseline de Node.js `^24.0.0 || >=26.0.0` queda verificado en la CI con Node 24 y 26 (D-055). Ver además P-008 y D-066.
- Subir `actions/checkout` y `actions/setup-node` a versiones que no usen Node 20, con SHA comprobados (D-055).
- Revisar la omisión del aviso de create-vite en los proyectos generados al sustituir la plantilla (D-054).
- Revisión legal de la concesión sobre código generado (D-042). No bloquea `0.1.0`.
- Deuda de T-012a: cerrada por D-067 (commit `1b6f7ad`), el test importa ahora la función real de la plantilla.
- Reevaluar Drizzle Kit 1.0 estable por los avisos de `@esbuild-kit` (D-039).
- D-060: respuesta de soporte de npm sobre el nombre `brixa`. La publicación se hará desde el checkout del tag `v0.1.0`. Recordar que el nombre puede rechazarse por similitud aunque `npm view` dé 404.
- Registrar en T-019 los datos del tag y del Release (objeto del tag, URL, estado de protección de tags).
- Cifras: el número de variantes verificadas es 32 (inspección 2026-11-07). Cualquier documento que diga 34 está desactualizado.
- Dependabot / Renovate: evaluar conveniencia y configuración para automatizar alertas sin introducir ruido excesivo (pendiente de decisión, D-066).
- Alineación de `@types/node`, `eslint` y `typescript-eslint` entre frontend, backend y CLI (actualmente `eslint` 10.14.0 en frontend vs 10.13.0 en backend; `typescript-eslint` 8.72.1 vs 8.72.0; `@types/node` 24 en frontend vs 26 en backend y CLI).
- Etiqueta de PostgreSQL: alinear la imagen usada por las plantillas (`postgres:17.4-alpine`) frente a la usada por el arnés de verificación (`postgres:17-alpine`, D-047, D-049).
- Variante nueva para cubrir los 3 pares faltantes de cobertura pairwise: candidata `fullstack+js+postgres+docker+apiDocs+i18n`, que elevaría las variantes verificadas de 32 a 33 cubriendo los 76 pares válidos al 100%.
- Revisión periódica de imágenes Docker base (`node:24.22.1-slim`, `nginxinc/nginx-unprivileged:1.30.6-alpine-slim`, `postgres:17.4-alpine`) con herramientas como Docker Scout o Trivy (no ejecutado actualmente).
- Versiones transitivas sin fijar en proyectos generados (las plantillas no contienen lockfile, D-049, D-066).
- Node 26: no probado en la ejecución local P1 (probado localmente en P1 solo con Node v24.22.1; la CI sí lo cubre en la matriz de `.github/workflows/ci.yml`).
- Cuestiones técnicas abiertas posteriores a 0.1.0: P-008 a P-017 (salvo P-009, resuelta en D-091 a D-093; P-010, resuelta en D-087 a D-090 y D-101; P-011, resuelta en D-080 a D-086 y D-106; RLS/multitenancy/auditorías resueltas en D-094 a D-097, D-104 y D-105; estrategia JS/TS P-013 resuelta en D-098 tras INV-08 con implementación pendiente en T-023; y cuestiones A-1, A-2 y B-1 a B-8 de T-014-0 resueltas formalmente en D-099 a D-107). Permanecen abiertas como validaciones de implementación: la comprobación de soporte de sintaxis de políticas RLS en Drizzle Kit 0.31.x sobre PostgreSQL real (T-014c) y la parametrización configurable de la duración exacta del token de activación (T-014a).
- Propuesta de backlog en evaluación (sin implementación aprobada): generación de aplicaciones móviles reutilizando React y Vite mediante Capacitor y evaluación de Progressive Web Apps (PWA), con soporte inicial propuesto para Android y posterior evaluación de iOS; requiere análisis futuro de autenticación móvil, almacenamiento seguro en dispositivo, comunicación con backend y modo offline (Brixa no soporta actualmente aplicaciones móviles).
- `tsconfig.json` de `api-docs`: resuelto por D-077 (eliminada la duplicación añadiendo `resolveJsonModule: true` a la plantilla base).
- Composición de archivos compartidos: resuelta en backend y frontend por D-077, D-078 y D-079 (`.env.example`, Compose, `main`, `App`, `vite.config`). Queda pendiente únicamente la combinación de rutas OpenAPI cuando una segunda capacidad aporte especificaciones (T-014a/b).
- Orden explícito entre overlays: la ordenación por punto de código del nombre del contribuyente (`compareCodePoints`) es determinista pero arbitraria si un overlay depende semánticamente de otro.
- Frontend sin Prettier: las plantillas de frontend no incluyen `.prettierrc`, dependencia de Prettier ni script `format:check`.
- Alcance de `redact` (D-073): cubre URLs con credenciales, cabeceras `Authorization` / `Proxy-Authorization`, tokens Bearer, cookies, `password`, `access_token`, `refresh_token`, `auth_token`, `token` y claves que terminen en `_secret`. No cubre: `apiKey`, `privateKey`, `clientSecretKey`, valores PEM multilínea. Decidir con errores reales antes de ampliar las regex indiscriminadamente.
- ReDoS en `redact`: resuelto por D-076 y verificado en T-022 (prefiltro `includes("://")`, esquemas `{0,63}`, clases negadas con escapes en comillas y backticks, aserciones en Worker y pruebas HTTP con JSON malformado).
- X-Frame-Options: el backend emite `SAMEORIGIN` (valor por defecto de Helmet, D-074) mientras que la SPA emite `DENY` (D-075). Diferencia conocida pendiente de unificar.
- Cabeceras de la SPA solo con Docker (D-075): el servidor de desarrollo de Vite no las emite; quien despliegue sin el Nginx generado debe configurarlas en su hosting. Las respuestas 502 de Nginx (backend caído) no incluyen las cabeceras de `location /`.
- El arnés de `verify:generated` no comprueba cabeceras de seguridad HTTP en las respuestas reales (D-075): una regresión solo la detectarían los tests unitarios. Mejora opcional.
- Arnés `verify:generated`: usa puertos fijos (8080, 3000) y falla si están ocupados o si se borran `/tmp` o los contenedores durante la pasada. Mejora menor: comprobar puertos libres al inicio con un mensaje claro. No usar Docker ni limpiar `/tmp` mientras corre.
- Capas Docker (`RUN mkdir -p data && chown -R node:node /app`): pueden tardar entre 26 s y 152 s. Posible mejora con `COPY --chown`. Sin acción ahora.
- HSTS no activado (D-074, D-075): quien termine TLS en el servidor debe configurarlo en su proxy o servidor web.
- Consumo de `ValidationError` y `parseInput`: están provistos y testeados en la plantilla base, pero actualmente no existen rutas de negocio que los consuman (solo existe `/health`).
- Versión a publicar tras el desbloqueo de npm: el tag `v0.1.0` contiene el defecto de Docker corregido en `9783be7` (y posteriores); publicar `0.1.1` desde un tag nuevo es la opción coherente con la regla de no mover ni reutilizar tags (decisión del responsable).

## 6. Registro de nuevas decisiones

Cuando se apruebe una decisión importante, se debe añadir una entrada con este formato:

### D-XXX — Título de la decisión

**Estado:** Confirmada.

**Contexto:** Qué problema o necesidad motivó la decisión.

**Decisión:** Qué se ha aprobado.

**Motivo:** Por qué se ha elegido esta alternativa.

**Consecuencias:** Qué implica para la arquitectura, el desarrollo, la seguridad o el mantenimiento.

**Alternativas consideradas:** Otras opciones relevantes y por qué no se eligieron.

No es obligatorio completar todos los campos si no aportan valor, pero deben quedar claros la decisión y su justificación.