
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
- Código fuente en GitHub (público antes de publicar en npm) y distribución mediante npm.
- Licencia AGPL-3.0 para el CLI y las plantillas; el código generado puede usarse y licenciarse libremente, incluso comercialmente (D-042).
- Contribuciones con DCO, sin CLA (D-043).
- Versión 0.1.0: MVP técnico + Docker, documentación de API e i18n; autenticación, RBAC y multitenancy después (D-044).
- Nombre: Foundry es provisional y el paquete `foundry` ya existe en npm (D-046).

Consulta `DECISIONS.md` para conocer el estado y la justificación de cada decisión.

## Principios generales

- No inventar requisitos ni asumir decisiones pendientes.
- Priorizar la seguridad, la claridad y la mantenibilidad.
- Generar únicamente las capacidades seleccionadas por el usuario.
- Preferir soluciones sencillas y funcionales antes que abstracciones innecesarias.
- Inspeccionar el código existente antes de modificarlo.
- Verificar los cambios con pruebas y herramientas disponibles.
- Comunicar las limitaciones y los aspectos que no se hayan verificado.
