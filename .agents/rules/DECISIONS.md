
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

**Estado:** Pendiente de prueba técnica.

No se seleccionará definitivamente un ORM hasta comparar una implementación pequeña con las bases de datos previstas y comprobar migraciones, consultas, transacciones, compatibilidad con JavaScript y TypeScript, y estabilidad de las versiones disponibles.

### D-017 — Distribución y versionado

**Estado:** Confirmada como estrategia inicial.

El código fuente se alojará en GitHub y las versiones del CLI se distribuirán mediante npm.

Las publicaciones serán manuales al principio. Se utilizará versionado semántico y se evaluará automatizar el proceso más adelante.

### D-018 — Licencia AGPL-3.0

**Estado:** Propuesta pendiente de revisión.

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

**Estado:** Pendiente de prueba de concepto.

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

### P-005 — Criterios de aceptación del MVP

**Estado:** Pendiente de definición.

Se deben establecer criterios verificables para considerar funcional cada combinación soportada.

Como mínimo, las pruebas deben comprobar la generación de archivos, la instalación de dependencias, la ejecución de herramientas de calidad, el inicio de la aplicación y las pruebas automatizadas que correspondan.

### P-006 — Evaluación definitiva de la licencia

**Estado:** Pendiente de revisión.

AGPL-3.0 es la licencia candidata, pero su adopción definitiva requiere revisar sus implicaciones para el generador, las plantillas, las contribuciones externas y la distribución de los proyectos generados.

No debe considerarse definitiva hasta completar la evaluación correspondiente.

### P-007 — Confirmación del nombre del proyecto

**Estado:** Pendiente de verificación.

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

## 5. Cuestiones pendientes

- P-002: confirmación definitiva de versiones de dependencias de proyectos generados.
- Selección definitiva del ORM mediante una prueba técnica.
- Confirmación de la licencia AGPL-3.0 y sus implicaciones legales.
- Política para contribuciones de terceros y posibles licencias comerciales alternativas.
- Disponibilidad definitiva del nombre Foundry.


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
