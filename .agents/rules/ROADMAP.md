# Foundry — Roadmap

## 1. Propósito

Este documento define la evolución prevista de Foundry, un generador de proyectos web configurable mediante una CLI interactiva.

El roadmap establece prioridades y dependencias. No implica que una funcionalidad esté implementada ni que una fecha de entrega esté garantizada.

El estado real del proyecto debe verificarse en el repositorio y contrastarse con `TASKS.md`.

Por decisión D-044, la Fase 6 (publicación) se ejecuta antes que la Fase 5 (seguridad y autorización), de modo que la versión `0.1.0` se publica sin autenticación, RBAC ni multitenancy.

## 2. Principios de planificación

- Priorizar un MVP funcional antes de incorporar capacidades avanzadas.
- Implementar incrementos pequeños, verificables y coherentes.
- Evitar generar proyectos que aparenten estar completos sin funcionar realmente.
- Incorporar únicamente combinaciones tecnológicas probadas.
- Mantener una separación clara entre el CLI, las plantillas y la lógica de generación.
- No introducir dependencias o abstracciones sin una justificación concreta.
- Posponer las funcionalidades de seguridad avanzadas hasta disponer de una base de generación estable.
- Actualizar el roadmap cuando las pruebas o la experiencia de desarrollo justifiquen cambios.

## 3. Fases de desarrollo

### Fase 0 — Preparación y diseño técnico

**Objetivo:** establecer una arquitectura mínima y resolver las decisiones que bloquean el desarrollo.

Actividades:

- Inspeccionar el repositorio y comprobar qué existe realmente.
- Confirmar las decisiones documentadas en `DECISIONS.md`.
- Definir el stack de implementación del propio CLI.
- Seleccionar la biblioteca para los prompts interactivos.
- Definir la estrategia inicial de plantillas y composición.
- Establecer los criterios de aceptación del MVP.
- Definir una primera combinación tecnológica que pueda implementarse y probarse de extremo a extremo.

**Criterio de salida:** existe un diseño técnico suficientemente concreto para implementar el primer flujo funcional, sin decisiones críticas ocultas.

### Fase 1 — CLI mínimo funcional

**Objetivo:** crear el flujo básico de Foundry y comprobar que puede generar un proyecto utilizable.

Alcance:

- Comando de ejecución de Foundry.
- Interfaz interactiva sencilla.
- Selección de modalidad: frontend, backend o aplicación completa.
- Selección de JavaScript o TypeScript.
- Validación de las opciones seleccionadas.
- Selección y resolución de la carpeta de destino.
- Generación inicial de archivos.
- Manejo de errores y protección frente a sobrescrituras inesperadas.
- Mensajes finales con instrucciones para continuar.
- Pruebas automatizadas de la lógica principal.

La primera versión puede soportar una cantidad limitada de combinaciones, siempre que se indiquen explícitamente.

**Criterio de salida:** el CLI puede generar al menos una combinación admitida, y el proyecto resultante puede instalarse, iniciarse y verificarse siguiendo las instrucciones generadas.

### Fase 2 — Plantillas base de frontend y backend

**Objetivo:** ampliar la generación sin perder la fiabilidad conseguida en la fase anterior.

Frontend:

- React y Vite.
- JavaScript y TypeScript.
- Estructura inicial clara.
- Scripts de desarrollo y compilación.
- Herramientas de calidad de código seleccionadas.

Backend:

- Node.js y Express.
- JavaScript y TypeScript.
- Estructura inicial clara.
- Configuración de entorno.
- Validación de entradas y manejo coherente de errores cuando corresponda.
- Scripts de desarrollo, pruebas y ejecución.

Aplicación completa:

- Generación conjunta del frontend y backend.
- Estructura de directorios definida.
- Configuración coherente de scripts y dependencias.
- Configuración documentada de la comunicación entre componentes, cuando corresponda.

**Criterio de salida:** cada combinación publicada como soportada supera sus comprobaciones de generación, instalación y ejecución.

### Fase 3 — Persistencia y bases de datos

**Objetivo:** incorporar persistencia de datos de forma mantenible y verificable.

Actividades:

- Ejecutar una prueba de concepto del ORM o mecanismo de persistencia.
- Evaluar PostgreSQL y SQLite.
- Verificar la compatibilidad con JavaScript y TypeScript.
- Definir la estrategia de configuración y variables de entorno.
- Incorporar migraciones y gestión del esquema, si la solución elegida las requiere.
- Crear pruebas de integración para las combinaciones soportadas.
- Documentar los requisitos específicos de cada base de datos.

No se debe seleccionar un ORM únicamente por popularidad ni declarar ambas bases de datos compatibles sin pruebas.

**Criterio de salida:** las opciones de persistencia implementadas funcionan y disponen de instrucciones y pruebas reproducibles.

### Fase 4 — Capacidades opcionales de desarrollo

**Objetivo:** ofrecer opciones adicionales sin convertirlas en dependencias obligatorias.

Alcance de 0.1.0:

- Docker y Docker Compose.
- Documentación de API para los proyectos backend.
- Internacionalización.

Posteriores a 0.1.0:

- Configuración adicional de pruebas.
- Configuraciones adicionales de herramientas de desarrollo.

Cada capacidad debe tener dependencias, criterios de compatibilidad y pruebas definidos antes de incorporarse.

**Criterio de salida:** las capacidades se pueden activar de forma explícita y no alteran las combinaciones que no las necesitan.

### Fase 5 — Seguridad y autorización

**Objetivo:** incorporar funcionalidades de seguridad después de estabilizar la generación base.

Posibles capacidades:

- Autenticación.
- Autorización basada en roles (RBAC).
- Multitenancy.
- Políticas de autorización y control de acceso a recursos.
- Configuración segura de sesiones o tokens, según la solución elegida.
- Pruebas de acceso permitido y denegado.

Estas capacidades no deben tratarse como simples fragmentos de código. Cada una requiere un diseño coherente, documentación y pruebas de seguridad.

**Criterio de salida:** cada capacidad tiene un alcance explícito, controles aplicados a las operaciones pertinentes y pruebas negativas que comprueban que el acceso no autorizado se rechaza.

### Fase 6 — Publicación y mantenimiento

**Objetivo:** distribuir Foundry de forma reproducible y facilitar su evolución.

Actividades:

- Preparar el paquete npm.
- Configurar metadatos, comandos y archivos incluidos en la distribución.
- Establecer versionado semántico (SemVer).
- Definir un procedimiento de publicación manual.
- Publicar el código fuente en GitHub.
- Documentar instalación, uso, limitaciones y combinaciones soportadas.
- Revisar la licencia antes de publicar.
- Verificar que el paquete publicado funciona en un entorno limpio.
- Configurar CI en Ubuntu, Windows y macOS antes de publicar (T-016).
- Hacer público el repositorio antes de publicar en npm, tras revisar el historial y los documentos de licencia y contribución.
- Verificar el tarball de `npm pack` en Windows antes de `npm publish`.

**Criterio de salida:** una versión puede instalarse y utilizarse desde su distribución publicada siguiendo la documentación.

## 4. Criterios transversales

Todas las fases deben cumplir los siguientes principios:

- Código legible y mantenible.
- Validación de entradas y manejo explícito de errores.
- Pruebas proporcionales al riesgo y la complejidad.
- Ausencia de secretos o credenciales en los proyectos generados.
- Documentación actualizada con el comportamiento real.
- Dependencias justificadas y versiones compatibles verificadas.
- Cambios acotados, sin refactorizaciones ajenas al objetivo.
- Compatibilidad comprobada antes de anunciar soporte.

## 5. Alcance fuera del MVP

No forman parte de la versión 0.1.0, salvo que se apruebe expresamente:

- Autenticación, RBAC y multitenancy (T-014, versión posterior).

No forman parte del MVP inicial, salvo que se apruebe expresamente:

- Un modo avanzado con gran cantidad de opciones.
- Un catálogo extenso de módulos opcionales.
- Soporte universal para cualquier combinación tecnológica.
- Publicación automática de versiones.
- Sistemas complejos de plugins o extensiones.
- Abstracciones arquitectónicas que todavía no resuelvan una necesidad real.

## 6. Gestión de cambios

El roadmap es un documento vivo.

Para incorporar una nueva capacidad se debe:

1. Identificar la necesidad y el problema que resuelve.
2. Evaluar su impacto sobre la arquitectura y las combinaciones existentes.
3. Definir criterios de aceptación.
4. Registrar las decisiones relevantes en `DECISIONS.md`.
5. Actualizar `TASKS.md` si el cambio se aprueba.
6. Ajustar esta planificación cuando cambien las prioridades o dependencias.

Ninguna fase se considera completada únicamente porque existan archivos de código. Debe cumplir sus criterios de salida verificables.
