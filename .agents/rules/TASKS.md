# Brixa — Tasks

## 1. Propósito

Este documento organiza el trabajo de desarrollo de Brixa en tareas pequeñas, verificables y ordenadas por dependencias.

`TASKS.md` complementa a `ROADMAP.md`:

- `ROADMAP.md` define las fases y los objetivos.
- `TASKS.md` registra el trabajo concreto.
- `DECISIONS.md` registra las decisiones adoptadas y pendientes.
- `AGENTS.md` define las reglas de trabajo para los agentes de IA.

## 2. Estados

Utilizar únicamente estos estados:

- `PENDIENTE`: no se ha iniciado.
- `EN PROGRESO`: se está trabajando en ella.
- `BLOQUEADA`: depende de una decisión, tarea o requisito no resuelto.
- `COMPLETADA`: cumple sus criterios de aceptación y se han ejecutado las verificaciones correspondientes.

No marcar una tarea como completada basándose únicamente en que se hayan creado archivos.

## 3. Reglas de ejecución

- Trabajar primero en las tareas de mayor prioridad que no estén bloqueadas.
- Resolver las dependencias antes de comenzar una tarea que las requiera.
- Mantener los cambios acotados al objetivo de la tarea.
- Definir o confirmar los criterios de aceptación antes de implementar.
- Ejecutar las comprobaciones relevantes después de cada incremento.
- Registrar las decisiones nuevas en `DECISIONS.md`.
- Actualizar los estados y añadir tareas derivadas cuando sea necesario.
- No marcar como soportada una combinación tecnológica que no se haya verificado.
- Orden de ejecución vigente (D-044): T-013 → T-016 → T-015 → T-014. Los identificadores no se renumeran.

## 4. Inventario inicial del repositorio

### T-001 — Inicializar el repositorio y la estructura base

**Estado:** COMPLETADA
**Prioridad:** P0
**Fase:** 0

**Contexto:** Foundry comienza desde cero. No existe todavía un repositorio Git inicializado ni una implementación del CLI.

Actividades:

- Revisar la documentación existente del proyecto.
- Inicializar Git en el directorio raíz, si todavía no está inicializado.
- Crear la estructura mínima del proyecto.
- Definir los archivos de configuración iniciales necesarios.
- Preparar el `package.json` y la configuración del entorno de desarrollo, una vez definido el stack del propio CLI.
- Configurar las herramientas de calidad y pruebas seleccionadas.
- Establecer un `.gitignore` apropiado.
- Verificar que los archivos de contexto y documentación quedan organizados correctamente.

**Criterios de aceptación:**

- Existe un repositorio Git inicializado.
- La estructura base del proyecto está creada.
- La configuración inicial es coherente con las decisiones documentadas.
- Los archivos generados por herramientas, las dependencias instaladas y los secretos locales quedan excluidos del control de versiones cuando corresponda.
- Las herramientas configuradas pueden ejecutarse correctamente.
- No se incorporan funcionalidades del generador antes de definir la estructura y el entorno necesarios.

**Verificación (2026-10-24):**

- Repositorio Git inicializado (sin commits). `git status` confirma rama `main`, sin commits.
- `.gitignore`, `.gitattributes` (LF, D-028), `.node-version` (24) creados.
- `package.json` con versiones exactas verificadas mediante `npm view` (D-029). `engines.node: "^24.0.0 || >=26.0.0"`.
- `tsconfig.json` y `tsconfig.build.json` (ESM, strict, NodeNext).
- `eslint.config.js` (ESLint 10 flat config, typescript-eslint strictTypeChecked).
- `.prettierrc` y `.prettierignore` creados.
- `vitest.config.ts` creado.
- `src/index.ts` (stub mínimo) y `src/index.test.ts` (smoke test).
- `npm install`: 0 vulnerabilidades. `package-lock.json` generado. `node_modules/` ignorado por `.gitignore`.
- `npm run typecheck`: sin errores.
- `npm run lint`: sin errores.
- `npm run format:check`: todos los archivos de código pasan. `.md` excluidos por `.prettierignore` (renormalización CRLF pendiente de aprobación, D-028).
- `npm run build`: `dist/` generado. `dist/` ignorado por `.gitignore`.
- `npm test`: 2/2 tests pasan.
- D-029 (versiones fijadas) y D-030 (estrategia build tsc+tsx) registradas en `DECISIONS.md`.

### T-002 — Resolver las decisiones técnicas que bloquean el MVP

**Estado:** COMPLETADA  
**Prioridad:** P0  
**Fase:** 0  
**Dependencia:** T-001

Actividades:

- Definir el lenguaje y el entorno de ejecución del propio CLI.
- Seleccionar la biblioteca para la interfaz interactiva.
- Definir el mecanismo inicial de generación de archivos.
- Acordar la primera combinación tecnológica que se implementará.
- Definir las comprobaciones necesarias para validar el resultado.

**Criterios de aceptación:**

- Las decisiones bloqueantes quedan documentadas en `DECISIONS.md`.
- Las opciones seleccionadas tienen justificación suficiente.
- No se amplía el alcance con funcionalidades innecesarias.

**Verificación:**

- D-022 (TypeScript/Node.js), D-023 (@inquirer/prompts), D-024 (generación de archivos), D-025 (npm), D-026 (primera combinación React+Vite+TS), D-027 (herramientas de calidad, cierra D-020), D-028 (LF con .gitattributes): todas confirmadas en `DECISIONS.md`.
- D-020 actualizada a Confirmada (cerrada por D-027). P-003 actualizada a Resuelta (cerrada por D-023, D-024, D-025).
- P-002 (versiones y matriz) y P-005 (criterios de aceptación del MVP) permanecen sin confirmar.
- No se creó package.json, no se instalaron dependencias, no se escribió código.

### T-003 — Definir la estructura inicial del CLI

**Estado:** COMPLETADA
**Prioridad:** P0
**Fase:** 0
**Dependencia:** T-002

Actividades:

- Definir la organización inicial del código.
- Separar, cuando resulte útil, la interfaz interactiva, la validación, la resolución de opciones y la generación.
- Definir el manejo de errores.
- Establecer cómo se probará la lógica sin depender de interacciones manuales.

**Criterios de aceptación:**

- La estructura responde a las necesidades reales del MVP.
- Cada componente tiene responsabilidades claras.
- No se introducen capas ni abstracciones sin utilidad demostrable.

**Estructura definida:**

```
src/
  index.ts          # Punto de entrada del CLI (actualmente stub)
  index.test.ts     # Test de humo del toolchain
  prompts/          # Interfaz interactiva (@inquirer/prompts)
    questions.ts    # Definición de preguntas y flujo de prompts
  validation/       # Validación de opciones seleccionadas
    options.ts      # Valida y normaliza las opciones del usuario
  generator/        # Orquestación de la generación
    generate.ts     # Coordina copiado de plantillas e interpolación
    files.ts        # Operaciones de sistema de archivos (detección, escritura)
  templates/        # Plantillas estáticas (se añaden en T-006)
    react-vite-ts/  # Primera combinación (D-026)
  types.ts          # Tipos compartidos (opciones, combinaciones, errores)
```

**Separación de responsabilidades:**

- `prompts/`: solo construye y ejecuta los prompts. No valida reglas de negocio ni escribe archivos.
- `validation/`: recibe las respuestas del usuario y devuelve opciones validadas o un error tipado. No interactúa con el terminal ni el sistema de archivos.
- `generator/`: recibe opciones validadas, orquesta la copia de plantillas y la interpolación. No interactúa con prompts.
- `templates/`: archivos estáticos. No contienen lógica.
- `types.ts`: contrato entre módulos. Sin dependencias internas.

Esta separación permite probar `validation/` y `generator/` sin terminal ni sistema de archivos real (usando mocks de Node.js `fs`).

**Manejo de errores:**

- Los errores se representan como tipos discriminados (`Result<T, E>` o `{ ok: true, value } | { ok: false, error }`), sin lanzar excepciones en la lógica de dominio.
- Solo el punto de entrada (`index.ts`) captura errores no manejados y los presenta al usuario con un mensaje comprensible antes de salir con código de error no-cero.
- Los errores de sistema de archivos (permisos, directorio no vacío) se detectan en `generator/files.ts` y se propagan como errores tipados.

**Estrategia de pruebas:**

- `prompts/` se prueba con mocks del módulo `@inquirer/prompts` (vi.mock en Vitest).
- `validation/` se prueba con entradas directas; no requiere mocks.
- `generator/files.ts` se prueba con `memfs` o equivalente para evitar I/O real.
- `generator/generate.ts` se prueba con mocks de `files.ts`.
- Los tests de integración de extremo a extremo se añadirán en T-007 usando un directorio temporal real.



### T-004 — Implementar el flujo interactivo mínimo

**Estado:** COMPLETADA  
**Prioridad:** P0  
**Fase:** 1  
**Dependencia:** T-003

Actividades:

- Crear el punto de entrada del CLI.
- Solicitar la modalidad de generación: frontend, backend o aplicación completa.
- Solicitar JavaScript o TypeScript.
- Validar las opciones.
- Gestionar la cancelación y las entradas inválidas.

**Criterios de aceptación:**

- El flujo puede completarse desde la terminal.
- Las opciones inválidas no provocan una generación inconsistente.
- La cancelación se gestiona de manera clara.

**Verificación (2026-10-24):**

Archivos creados siguiendo la estructura de T-003:
- `src/types.ts`: tipos compartidos (`Modality`, `Language`, `RawOptions`, `UserOptions`, `Result<T,E>`).
- `src/prompts/questions.ts`: flujo de prompts con `@inquirer/prompts`. Cancelación gestionada mediante detección de `ExitPromptError` sin importar la clase concreta.
- `src/validation/options.ts`: validación pura (sin I/O). Tipos de error discriminados y formatter de mensajes.
- `src/index.ts`: orquestación del flujo; sale con código 1 en error de validación; generación diferida a T-005.
- `src/prompts/questions.test.ts`: 4 tests (happy path ×2, cancelación, error inesperado).
- `src/validation/options.test.ts`: 7 tests (combinaciones válidas, modalidad inválida, lenguaje inválido, formatters).
- `src/index.test.ts`: smoke test actualizado para `main` async (2 tests).
- `tsconfig.json`: añadido `"types": ["node"]` para disponibilizar `console` y `process` en el código del CLI.

Verificaciones ejecutadas:
- `npm run typecheck`: 0 errores.
- `npm run lint`: 0 errores.
- `npm run format:check`: todos los archivos pasan.
- `npm test`: 13/13 tests pasan en 3 ficheros.
- `npm run build`: `dist/` generado sin errores.

### T-005 — Implementar la selección del destino y la protección de archivos

**Estado:** COMPLETADA  
**Prioridad:** P0  
**Fase:** 1  
**Dependencia:** T-004

Actividades:

- Solicitar o resolver el directorio de destino.
- Validar la ruta.
- Detectar archivos existentes.
- Definir un comportamiento seguro ante directorios no vacíos.
- Evitar sobrescrituras inesperadas.
- Manejar errores de permisos y escritura.

**Criterios de aceptación:**

- La generación no destruye silenciosamente archivos existentes.
- Los errores se explican de forma comprensible.
- Las operaciones sobre archivos pueden probarse.

### T-006 — Crear la primera plantilla funcional

**Estado:** COMPLETADA  
**Prioridad:** P0  
**Fase:** 1  
**Dependencia:** T-005

Actividades:

- Implementar la primera combinación tecnológica acordada.
- Generar los archivos mínimos necesarios.
- Incluir scripts y dependencias coherentes.
- Generar instrucciones para instalar y ejecutar el proyecto.
- Evitar incluir capacidades opcionales que no se hayan solicitado.

**Criterios de aceptación:**

- El proyecto generado contiene los archivos esperados.
- Las dependencias y los scripts son coherentes.
- El proyecto se instala y ejecuta siguiendo las instrucciones generadas.

### T-007 — Incorporar pruebas automatizadas del flujo de generación

**Estado:** COMPLETADA  
**Prioridad:** P0  
**Fase:** 1  
**Dependencia:** T-006

Actividades:

- Probar las opciones válidas e inválidas.
- Probar la selección del destino.
- Probar la detección de archivos existentes.
- Verificar los archivos generados.
- Comprobar los errores previsibles.
- Ejecutar las comprobaciones del proyecto generado.

**Criterios de aceptación:**

- Las pruebas cubren los flujos críticos.
- Los errores previsibles se manejan correctamente.
- Existe un procedimiento reproducible para verificar la generación.

### T-008 — Implementar y verificar las plantillas frontend

**Estado:** COMPLETADA  
**Prioridad:** P1  
**Fase:** 2  
**Dependencias:** T-007 y las decisiones tecnológicas correspondientes

Actividades:

- Implementar React y Vite.
- Incorporar las variantes JavaScript y TypeScript.
- Configurar scripts y herramientas de calidad seleccionadas.
- Verificar la instalación, el desarrollo y la compilación.

**Criterios de aceptación:**

- Cada variante implementada se genera y ejecuta correctamente.
- Las variantes no implementadas se identifican como no soportadas.

### T-009 — Implementar y verificar las plantillas backend

**Estado:** COMPLETADA  
**Prioridad:** P1  
**Fase:** 2  
**Dependencias:** T-007 y las decisiones tecnológicas correspondientes

Actividades:

- Implementar Node.js y Express.
- Incorporar las variantes JavaScript y TypeScript.
- Configurar scripts, variables de entorno y manejo básico de errores.
- Incorporar pruebas y herramientas de calidad seleccionadas.

**Criterios de aceptación:**

- Cada variante implementada se instala y ejecuta correctamente.
- La configuración no expone secretos.
- Las instrucciones de uso son suficientes para iniciar el servidor.

### T-010 — Implementar la generación de aplicaciones completas

**Estado:** COMPLETADA  
**Prioridad:** P1  
**Fase:** 2  
**Dependencias:** T-008 y T-009

Actividades:

- Definir la estructura conjunta del frontend y el backend.
- Integrar sus scripts y dependencias.
- Documentar la configuración necesaria para la comunicación entre ambos.
- Verificar la generación y ejecución de la aplicación completa.

**Criterios de aceptación:**

- Ambos componentes pueden instalarse y ejecutarse.
- La estructura no duplica innecesariamente la configuración.
- La aplicación completa tiene instrucciones reproducibles.

**Cierre de Fase 2:** Con T-010 completada, la Fase 2 queda cerrada y los seis criterios de salida de la matriz de combinaciones (frontend ts/js, backend ts/js, fullstack ts/js) quedan superados.

### T-011 — Evaluar el ORM y la persistencia

**Estado:** COMPLETADA  
**Prioridad:** P1  
**Fase:** 3

Actividades:

- Comparar alternativas adecuadas para PostgreSQL y SQLite.
- Probar la compatibilidad con JavaScript y TypeScript.
- Evaluar configuración, migraciones, pruebas y mantenimiento.
- Documentar resultados y limitaciones.
- Registrar la decisión en `DECISIONS.md`.

**Criterios de aceptación:**

- Existe una prueba de concepto reproducible.
- La elección se basa en resultados y no solo en preferencias.
- Se documentan las combinaciones verificadas y las limitaciones.

### T-012 — Implementar y verificar la persistencia seleccionada

**Estado:** COMPLETADA (T-012a y T-012b completadas y verificadas el 2026-10-27)  
**Prioridad:** P1  
**Fase:** 3  
**Dependencia:** T-011

**T-012a — PostgreSQL opcional con Drizzle ORM (COMPLETADA):**

- Backend y aplicación completa ofrecen «Ninguna» (por defecto) o PostgreSQL. Esquema vacío con comentarios guía; migraciones explícitas (`db:generate` y `db:migrate`); `DATABASE_URL` validada al importar el cliente; test de conexión que se omite sin `DATABASE_URL`; `fileParallelism: false`.
- Corregido el cliente con Proxy que bloqueaba el pool. Ajustadas las instrucciones del CLI para no recomendar `db:migrate` con un esquema vacío.
- Las vulnerabilidades moderadas de `esbuild` introducidas por `drizzle-kit` se resolvieron mediante un override.
- Verificación: `npm run verify:generated`, con PostgreSQL en backend y fullstack, JavaScript y TypeScript. Migraciones, creación de tablas, tests y proxy `/api/health` verificados.
- Enmascarado de credenciales comprobado para `db:migrate` y el test de conexión.
- Pendiente técnico no bloqueante: comprobar que el test del CLI sobre `redact` ejecuta la función real de la plantilla y no una copia; si utiliza una copia, valorar extraer `redact` a un archivo sin dependencias.
- Los avisos de deprecación de `@esbuild-kit` siguen presentes en las instalaciones que utilizan `drizzle-kit`. Reevaluar cuando Drizzle Kit 1.0 estable esté disponible.

**T-012b — SQLite opcional con Drizzle ORM (COMPLETADA):**

- Backend y aplicación completa ofrecen SQLite en JavaScript y TypeScript mediante `@libsql/client` y `drizzle-orm/libsql`.
- Configuración inicial: `DATABASE_URL=file:./data/app.db`. La plantilla crea recursivamente la carpeta contenedora cuando corresponde; `data/` se excluye mediante el `.gitignore` generado.
- Incluye esquema vacío con comentarios guía, cliente con validación de `DATABASE_URL`, generación y ejecución explícita de migraciones, y test de conexión que se omite cuando no hay `DATABASE_URL`.
- `db:migrate` falla si no existe `drizzle/` y no informa de éxito cuando el directorio existe pero no contiene migraciones.
- Dependencias fijadas en versiones exactas: `@libsql/client` 0.18.0, `drizzle-orm` 0.45.4 y `drizzle-kit` en la versión estable fijada por la plantilla. Se aplica el override de `esbuild` de D-039.
- Verificación: `npm run verify:generated` completado correctamente, 16/16 variantes. Las cuatro variantes SQLite (backend y fullstack, JavaScript y TypeScript) pasaron instalación, lint, comprobaciones de tipos cuando correspondía, auditoría, generación y ejecución de migraciones, comprobación de tablas y tests. Las variantes fullstack también verificaron `GET /api/health` mediante el proxy de Vite.
- La creación de la carpeta `data/` se comprobó después de eliminarla antes de ejecutar la migración.
- `npm audit --audit-level=moderate` informó cero vulnerabilidades en las variantes generadas.
- Compatibilidad verificada únicamente en Linux x64 con Node 24. Las demás plataformas no se han probado. La ruta `file:./data/app.db` es relativa al directorio de ejecución.
- Decisión del driver registrada en D-041. `better-sqlite3` queda descartado para esta implementación por los problemas de instalación y compilación observados en las pruebas.

**Criterios de aceptación:**

- La persistencia funciona en las combinaciones declaradas como compatibles: PostgreSQL y SQLite, backend y fullstack, JavaScript y TypeScript. **Cumplido; 16/16 variantes verificadas.**
- Las pruebas son reproducibles mediante `npm run verify:generated`, utilizando el entorno PostgreSQL configurado por el script.
- Las migraciones, las consultas reales y las comprobaciones de conexión funcionan en las variantes verificadas.
- La documentación refleja el comportamiento real y las limitaciones de compatibilidad conocidas.

### T-013 — Incorporar capacidades opcionales de desarrollo (incluidas en 0.1.0)

**Estado:** COMPLETADA
**Prioridad:** P1
**Fase:** 4
**Dependencia:** T-012

Alcance de 0.1.0 (D-044): Docker y Docker Compose, documentación de API e internacionalización. «Configuración adicional de pruebas» queda fuera de 0.1.0.

Regla común: cada subtarea requiere antes un diseño breve y una decisión registrada en `DECISIONS.md` (alcance, herramienta elegida, compatibilidad, qué genera cada modalidad). Cada capacidad es opcional, no añade dependencias ni archivos a los proyectos que no la seleccionan, y solo se declara soportada tras verificarse en `verify:generated`.

**T-013a — Docker y Docker Compose opcionales**

**Estado de T-013a:** COMPLETADA. Docker y Docker Compose opcionales en backend y aplicación completa (ts y js; sin base de datos, PostgreSQL y SQLite), verificados en `verify:generated` (28/28 variantes). Frontend solo queda sin Docker (D-048). Compatibilidad verificada solo en Linux x64 con Node 24.

- Definir qué genera cada modalidad (frontend, backend, aplicación completa) y su integración con PostgreSQL y SQLite.
- Sin secretos en los archivos generados; variables de entorno documentadas.
- Criterios: sin Docker seleccionado, la generación no cambia; con Docker, el proyecto arranca con `docker compose up` según las instrucciones generadas; verificación en `verify:generated` (si no hay Docker, informa «NO VERIFICADO»).

**T-013b — Documentación de API (backend)**

**Estado de T-013b:** COMPLETADA. Documentación de API opcional (OpenAPI manual + Swagger UI, desactivada por defecto) en backend y aplicación completa, ts y js, verificada en `verify:generated` (32/32 variantes). Compatibilidad verificada solo en Linux x64 con Node 24.

- Evaluar herramientas (por ejemplo OpenAPI con una interfaz de consulta) y registrar la elección.
- Definir su comportamiento por defecto en producción (no exponer información de la API sin una decisión explícita).
- Criterios: opcional, solo backend y aplicación completa, JavaScript y TypeScript, documentación coherente con las rutas reales.

**T-013c — Internacionalización (frontend)**

- Evaluar la librería, el formato de mensajes y los idiomas iniciales, y registrar la elección.
- Criterios: opcional, solo frontend y aplicación completa, JavaScript y TypeScript, sin cambiar la generación de quien no la selecciona.

**Criterios de aceptación globales:**

- Cada capacidad tiene alcance y dependencias documentados.
- Se activa sin incorporar dependencias innecesarias a otros proyectos.
- Las combinaciones afectadas se verifican y la matriz de combinaciones se actualiza.

**Criterios de aceptación:**

- Cada capacidad tiene alcance y dependencias documentados.
- Se puede activar sin incorporar dependencias innecesarias a otros proyectos.
- Las combinaciones afectadas se verifican.

**T-013d — Integrar la verificación de i18n en verify:generated**

**Estado:** COMPLETADA (alcance reducido, 2026-11-01)
**Prioridad:** P1
**Fase:** 4
**Dependencia:** T-013c
**Bloquea:** T-016 (criterio P-005: todas las variantes con capacidades verificadas)

- Añadir al arnés V1–V4 con el mínimo de variantes (frontend ts, frontend js, fullstack ts SQLite, fullstack js SQLite).
- Convertir N1–N7 en controles repetibles.
- Comprobar por variante typecheck, lint, format:check, build y audit.
- Comprobar `tsc --showConfig` sobre `resolveJsonModule`.

### T-014 — Diseñar e implementar autenticación y autorización

**Estado:** PENDIENTE  
**Prioridad:** P2  
**Fase:** 5
**Dependencia:** T-015 (versión 0.1.0 publicada). Antes de escribir código se requiere el modelo de amenazas (SECURITY.md §12) y su desglose en autenticación, RBAC y multitenancy, cada uno con su decisión y sus pruebas negativas.

Actividades:

- Definir el alcance de autenticación, RBAC y multitenancy.
- Documentar amenazas y controles requeridos.
- Diseñar las políticas de autorización.
- Implementar las capacidades aprobadas.
- Incorporar pruebas de acceso permitido y denegado.

**Criterios de aceptación:**

- Los controles de autorización se aplican a las operaciones protegidas.
- Se prueban casos positivos y negativos.
- La configuración generada no contiene credenciales ni secretos.
- Las limitaciones están documentadas.

### T-015 — Preparar la distribución mediante npm y GitHub

**Estado:** EN PROGRESO
**Prioridad:** P1
**Fase:** 6
**Dependencias:** T-013 y T-016

Hecho:
- README público con logo y GIF de demostración (`docs/assets/`, guion reproducible en `docs/demo.tape`, generado con VHS); sección «Uso» con `npx brixa`; banner de arranque y avisos experimentales más breves (D-058).
Pendiente:
- Comprobaciones previas a la publicación, `npm publish` de `0.1.0` y verificación del paquete publicado.

Actividades:

- Revisar los metadatos y archivos de distribución.
- Configurar el comando ejecutable del CLI.
- Definir el versionado semántico.
- Preparar el procedimiento de publicación manual.
- Verificar el paquete en un entorno limpio.
- Confirmar la licencia antes de publicar.
- Publicar la versión `0.1.0` (SemVer) con el nombre definitivo (D-046). El paquete se publica sin scope (D-046).
- Publicar manualmente con 2FA activada en npm y GitHub.
- Confirmar que la licencia y la concesión sobre código generado (D-042) figuran en el paquete.

**Criterios de aceptación:**

- El paquete puede instalarse y ejecutarse desde su distribución.
- Las instrucciones de instalación están actualizadas.
- El proceso de publicación es reproducible.
- No se publican secretos ni archivos innecesarios.

### T-016 — CI multiplataforma y preparación del repositorio público

**Estado:** COMPLETADA (2026-11-02)
**Prioridad:** P1
**Fase:** 6
**Dependencia:** T-013
**Bloquea:** T-015

**Avance (2026-11-02):**

- Hecho: historial revisado sin secretos ni `.env` (el correo del autor permanece en el historial); nombre definitivo Brixa (D-046); `LICENSE.md` (AGPL-3.0), `GENERATED_CODE_LICENSE.md`, `CONTRIBUTING.md`, `SECURITY.md` corto en la raíz, `THIRD_PARTY_NOTICES.md` (D-054) y README público; guía interna de seguridad en `.agents/rules/`; `files` y `prepack` en `package.json` (D-056); arnés con `VERIFY_SCOPE` y adaptaciones para Windows (D-055); repositorio `acjoell/brixa` creado y subido; reporte privado de vulnerabilidades activado.
- CI en GitHub Actions: matriz completa en verde (run #8, 2026-11-02): Ubuntu, Windows y macOS con Node 24 y 26, con las 15 variantes portable en cada job.
- Job manual `verify-full` (Docker y PostgreSQL en Linux, Node 24) ejecutado en verde el 2026-11-02: 32 variantes en 10 min 37 s. La prueba en un Windows real queda fuera de los criterios (D-057).
- Limitaciones registradas: Windows y macOS solo verifican las 15 variantes portable; los avisos de deprecación de Node 20 en las acciones de GitHub quedan como mejora futura.

Actividades:

- Preparar el repositorio para hacerlo público: revisar el historial de git en busca de secretos y archivos `.env`; añadir `LICENSE` (AGPL-3.0), `GENERATED_CODE_LICENSE.md`, un README público (instalación, uso, combinaciones soportadas, limitaciones, aviso de que 0.1.0 no incluye autenticación ni RBAC ni multitenancy) y `CONTRIBUTING.md` con DCO.
- `SECURITY.md`: el corto en la raíz (política de reporte de vulnerabilidades); la guía interna ya estaba en `.agents/rules/`. Reporte privado de vulnerabilidades de GitHub activado.
- Nombre definitivo decidido (D-046) y repositorio creado.
- Crear `.github/workflows/ci.yml`: matriz `ubuntu-latest`, `windows-latest` y `macos-latest`, con Node 24 y Node 26. Pasos: instalar con `npm ci`, `typecheck`, `lint`, `format:check`, `test`, `build`, `npm pack` y comprobación de su contenido, y `verify:generated` para las variantes que no requieren Docker (frontend, backend sin base de datos y backend/fullstack con SQLite).
- Job aparte en Linux con PostgreSQL y las variantes que dependen de Docker.
- Permisos mínimos del workflow (`contents: read`) y acciones fijadas a una versión concreta.
- Si `verify:generated` no permite seleccionar variantes ni ejecutarse sin Docker, añadir el filtro mínimo necesario (tarea derivada, justificada).
- Registrar los fallos de compatibilidad encontrados (rutas, renombrado de `_gitignore` de D-032, rutas `file:` de SQLite, scripts de `package.json`, finales de línea) y corregirlos o documentarlos como limitaciones.

**Criterios de aceptación:**

- La CI pasa en Ubuntu, Windows y macOS para las variantes sin Docker, y en Linux para PostgreSQL y Docker.
- Se verifica Node 26 o se declara explícitamente que no está soportado.
- El repositorio no contiene secretos y los documentos de licencia y contribución están presentes.
- La compatibilidad declarada en el README coincide con lo verificado.

## 5. Regla de actualización

Cuando una tarea se complete:

1. Actualizar su estado.
2. Registrar las verificaciones ejecutadas.
3. Documentar cualquier limitación pendiente.
4. Actualizar las tareas dependientes cuando corresponda.
5. Actualizar `DECISIONS.md` si se adoptó una decisión nueva.
6. Actualizar `ROADMAP.md` si cambió el alcance o la planificación.

Se pueden dividir las tareas en subtareas cuando el trabajo lo requiera. No se deben marcar como completadas las tareas que solo tengan parte de sus criterios de aceptación satisfechos.