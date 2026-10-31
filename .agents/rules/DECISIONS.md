
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

**Estado:** Propuesta provisional.

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
- El tarball de `npm pack` se instala y funciona en un entorno limpio, incluido Windows.
- El README público incluye combinaciones soportadas, limitaciones y el aviso de que no incluye autenticación, RBAC ni multitenancy.
- `LICENSE`, `GENERATED_CODE_LICENSE.md` y `CONTRIBUTING.md` están presentes y no hay secretos en el historial.
- La deuda de `redact` está cerrada.
### P-006 — Evaluación definitiva de la licencia

**Estado:** Resuelta de forma provisional por D-042 (revisable).

AGPL-3.0 es la licencia candidata, pero su adopción definitiva requiere revisar sus implicaciones para el generador, las plantillas, las contribuciones externas y la distribución de los proyectos generados.

No debe considerarse definitiva hasta completar la evaluación correspondiente.

### P-007 — Confirmación del nombre del proyecto

**Estado:** Pendiente. Comprobado el 2026-10-28: el paquete npm «foundry» ya existe; «create-foundry-app» está ocupado por otro producto (FoundryDB); «@acjoell/foundry» está libre y no se encontró el repositorio acjoell/foundry en GitHub. Ver D-046.

Foundry es el nombre provisional del proyecto.

Antes de una publicación pública, se debe comprobar su disponibilidad y posibles conflictos en npm, GitHub, dominios y registros de marcas relevantes.


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

---

### D-038 — Cliente de base de datos sin Proxy y errores sin credenciales

**Estado:** Confirmada.

**Decisión:** `src/db/client` lee y valida `DATABASE_URL` al importarse y exporta `pool` y `db` directamente; el servidor no lo importa ni se conecta al arrancar. Los errores de `db:migrate` incluyen la causa real y enmascaran las credenciales de la URL (todo lo que hay entre `://` y el último `@` anterior a la primera `/`).

**Motivo:** Un Proxy con instanciación perezosa ligaba el `this` de `pool.query()` y bloqueaba el pool (el test de conexión agotaba 5 s). Corregido y verificado.

**Verificación:** con `DATABASE_URL=postgresql://u:SECR@ETO@127.0.0.1:1/d` (puerto cerrado), ni `db:migrate` ni el test de conexión emiten `SECR` ni `ETO` por stdout o stderr.

---

### D-039 — Cadena de suministro de las plantillas con base de datos

**Estado:** Confirmada.

**Decisión:** `overrides` de `@esbuild-kit/core-utils` a `esbuild ^0.25.0` para eliminar 4 vulnerabilidades moderadas (GHSA-67mh-4wv8-2f99, que afecta al servidor de desarrollo de esbuild, no usado por `drizzle-kit`); `allowScripts: { esbuild: false }`; `npm audit --audit-level=moderate` forma parte de `verify:generated`. Los avisos de deprecación de `@esbuild-kit` no se pueden evitar con `drizzle-kit` 0.31 y están explicados en el README del backend.

**Consecuencias:** `npm audit` puede fallar en el futuro por avisos nuevos sin que cambie el código (no sería un bug de Foundry). `drizzle-kit` 1.0.0-rc.5 ya no depende de `@esbuild-kit`: reevaluar cuando 1.0 sea la versión estable (`latest`).

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

**Decisión:** El CLI y las plantillas se distribuyen bajo AGPL-3.0. El código generado por Foundry puede usarse, modificarse, distribuirse y licenciarse libremente, incluso con fines comerciales y bajo la licencia que elija quien lo genera. La concesión se documenta en el README público y en `GENERATED_CODE_LICENSE.md`, junto al `LICENSE`.

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

**Decisión:** El repositorio se hace público en GitHub antes de publicar en npm. Antes de `npm publish` se comprueba el CLI en Ubuntu, Windows y macOS mediante GitHub Actions (T-016) y mediante una instalación manual en Windows a partir del tarball de `npm pack`. Las variantes con PostgreSQL o Docker solo se verifican en Linux.

**Consecuencias:** Los fallos de compatibilidad que aparezcan se corrigen o se documentan como limitaciones antes de publicar. Hasta entonces, la compatibilidad declarada sigue siendo Linux x64 con Node 24.

---

### D-046 — Nombre del proyecto

**Estado:** Propuesta (pendiente de aprobación).

**Contexto:** Comprobado por el responsable el 2026-10-28: `foundry` ya existe en npm; `create-foundry-app` pertenece a FoundryDB; `@acjoell/foundry` está libre; no se encontró `acjoell/foundry` en GitHub. «Foundry» también es el nombre de otros productos conocidos (confusión en buscadores y marca).

**Decisión pendiente:** elegir un nombre definitivo. Hasta que se apruebe, no se renombra nada (`package.json`, `bin`, token `foundry-tpl` de D-032, documentación, repositorio).

**Criterios:** que `@acjoell/<nombre>` esté libre (el scope evita colisiones de paquete), que el nombre de comando no choque con herramientas existentes, que no haya un producto conocido con el mismo nombre y que el repositorio `acjoell/<nombre>` esté libre.

**Candidatos (sin verificar):** Fragua, Moldkit, Forjakit, Smeltkit, Castwork, Crisol. Lista y script de comprobación en la sección 6.

**Consecuencias:** Renombrar es más barato antes de publicar. Afecta a metadatos del paquete, comando, token de plantillas, documentación y nombre del repositorio.

---

### D-047 — Docker y Docker Compose opcionales en backend (T-013a, fase 1)

**Estado:** Confirmada.

**Decisión:** El CLI pregunta «¿Docker?» (por defecto No) solo para backend. Con Docker genera `Dockerfile` multi-etapa (`node:24.22.1-slim`, usuario no root, solo dependencias de producción), `.dockerignore` y `compose.yaml` (servicio `backend`, más `postgres:17` o un volumen para `data/` en SQLite). Sin Docker, la generación no cambia. Frontend y fullstack quedan para la fase 2.

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

---

### D-051 — Override de minimatch por GHSA-g3hv-75wg-m249

**Estado:** Confirmada (temporal).

**Decisión:** Todas las plantillas base (frontend y backend, ts y js) y Foundry fijan `overrides: { "minimatch": "11.0.1" }`, que coexiste con el override de `esbuild-kit` de D-039. Todas las variantes de `verify:generated` ejecutan `npm audit --audit-level=moderate`.

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
- Foundry debe revisar las subidas de versión mayor de las tres librerías.
- Límites documentados: `<title>` estático, solo idiomas de izquierda a derecha, backend sin traducir, sin carga diferida ni namespaces.
- Variable de interpolación `val` (no `count`) para evitar plurales implícitos.
- No se necesita `resolveJsonModule` con `moduleResolution: bundler`.

**No verificado:** clic real en el selector en un navegador (comprobación manual del responsable pendiente); e2e en navegador; SSR de producción.

---

## 5. Cuestiones pendientes

- P-002: confirmación definitiva de versiones de dependencias de proyectos generados, incluida la verificación del baseline de Node.js con Node 26 (`^24.0.0 || >=26.0.0` es el candidato; solo se declara lo verificado).
- P-007 / D-046: nombre definitivo.
- Revisión legal de la concesión sobre código generado (D-042). No bloquea `0.1.0`.
- Deuda de T-012a: comprobar que el test de `redact` ejecuta la función real de la plantilla y no una copia.
- Reevaluar Drizzle Kit 1.0 estable por los avisos de `@esbuild-kit` (D-039).


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
