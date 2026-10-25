# Foundry — Tasks

## 1. Propósito

Este documento organiza el trabajo de desarrollo de Foundry en tareas pequeñas, verificables y ordenadas por dependencias.

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

**Estado:** EN PROGRESO (estructura definida; implementación pendiente en T-004 y siguientes)
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

**Estado:** PENDIENTE  
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

**Estado:** PENDIENTE  
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

**Estado:** PENDIENTE  
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

**Estado:** PENDIENTE  
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

**Estado:** PENDIENTE  
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

**Estado:** PENDIENTE  
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

### T-011 — Evaluar el ORM y la persistencia

**Estado:** PENDIENTE  
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

**Estado:** PENDIENTE  
**Prioridad:** P1  
**Fase:** 3  
**Dependencia:** T-011

Actividades:

- Incorporar la solución elegida.
- Configurar las variables necesarias.
- Implementar los mecanismos de esquema y migraciones que correspondan.
- Crear pruebas de integración.
- Verificar las bases de datos realmente soportadas.

**Criterios de aceptación:**

- La persistencia funciona en las combinaciones declaradas como compatibles.
- Las pruebas pueden reproducirse.
- La documentación refleja el comportamiento real.

### T-013 — Incorporar capacidades opcionales de desarrollo

**Estado:** PENDIENTE  
**Prioridad:** P2  
**Fase:** 4

Posibles actividades, que deben evaluarse individualmente:

- Docker y Docker Compose.
- Configuración adicional de pruebas.
- Documentación de API.
- Internacionalización.

**Criterios de aceptación:**

- Cada capacidad tiene alcance y dependencias documentados.
- Se puede activar sin incorporar dependencias innecesarias a otros proyectos.
- Las combinaciones afectadas se verifican.

### T-014 — Diseñar e implementar autenticación y autorización

**Estado:** PENDIENTE  
**Prioridad:** P2  
**Fase:** 5

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

**Estado:** PENDIENTE  
**Prioridad:** P1  
**Fase:** 6

Actividades:

- Revisar los metadatos y archivos de distribución.
- Configurar el comando ejecutable del CLI.
- Definir el versionado semántico.
- Preparar el procedimiento de publicación manual.
- Verificar el paquete en un entorno limpio.
- Confirmar la licencia antes de publicar.

**Criterios de aceptación:**

- El paquete puede instalarse y ejecutarse desde su distribución.
- Las instrucciones de instalación están actualizadas.
- El proceso de publicación es reproducible.
- No se publican secretos ni archivos innecesarios.

## 5. Regla de actualización

Cuando una tarea se complete:

1. Actualizar su estado.
2. Registrar las verificaciones ejecutadas.
3. Documentar cualquier limitación pendiente.
4. Actualizar las tareas dependientes cuando corresponda.
5. Actualizar `DECISIONS.md` si se adoptó una decisión nueva.
6. Actualizar `ROADMAP.md` si cambió el alcance o la planificación.

Se pueden dividir las tareas en subtareas cuando el trabajo lo requiera. No se deben marcar como completadas las tareas que solo tengan parte de sus criterios de aceptación satisfechos.
