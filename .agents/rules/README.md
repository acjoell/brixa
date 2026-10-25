
# Contexto del proyecto

Documentación de referencia para definir la visión, arquitectura, seguridad y criterios de desarrollo de un CLI generador de aplicaciones.

## Estado

Estos documentos son un borrador inicial. Deben revisarse y aprobarse antes de utilizarlos como especificación definitiva.

Las decisiones marcadas como pendientes no deben tratarse como requisitos confirmados.

## Documentos

| Archivo | Propósito |
|---|---|
| `PROJECT_VISION.md` | Define el propósito, alcance y principios del producto. |
| `AI_RULES.md` | Establece cómo debe trabajar la IA sobre el proyecto. |
| `ARCHITECTURE.md` | Define los criterios de arquitectura del código generado. |
| `SECURITY.md` | Establece los requisitos de seguridad. |
| `CODE_STANDARDS.md` | Define los estándares de calidad y legibilidad. |
| `CHANGE_POLICY.md` | Regula cómo analizar, ejecutar y verificar cambios. |
| `DECISIONS.md` | Registra decisiones confirmadas y asuntos pendientes. |
| `ROADMAP.md` | Define las fases de desarrollo y sus criterios de salida. |
| `TASKS.md` | Organiza el trabajo en tareas concretas y verificables. |
| `AGENTS.md` | Define las reglas de trabajo para los agentes de IA. |


## Decisiones generales del producto

- Nombre provisional: Foundry.
- CLI interactiva con modo simple para el MVP.
- Generación de frontend, backend o aplicación completa.
- Frontend inicial: React + Vite.
- Backend inicial: Node.js + Express.
- JavaScript y TypeScript como lenguajes seleccionables.
- PostgreSQL y SQLite como objetivos de soporte para persistencia.
- Docker opcional.
- Autenticación, RBAC y multitenancy previstos para etapas posteriores.
- Código fuente en GitHub y distribución mediante npm.
- Licencia AGPL-3.0 bajo evaluación, todavía no confirmada.

Consulta `DECISIONS.md` para conocer el estado y la justificación de cada decisión.

## Principios generales

- No inventar requisitos ni asumir decisiones pendientes.
- Priorizar la seguridad, la claridad y la mantenibilidad.
- Generar únicamente las capacidades seleccionadas por el usuario.
- Preferir soluciones sencillas y funcionales antes que abstracciones innecesarias.
- Inspeccionar el código existente antes de modificarlo.
- Verificar los cambios con pruebas y herramientas disponibles.
- Comunicar las limitaciones y los aspectos que no se hayan verificado.

## Documentos adicionales

`ROADMAP.md`, `TASKS.md` y `AGENTS.md` ya forman parte de la documentación del proyecto.
