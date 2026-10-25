# Foundry — Agent Guidelines

## 1. Propósito

Estas instrucciones definen cómo deben trabajar los agentes de IA que analicen, diseñen, implementen, prueben o documenten Foundry.

El objetivo es desarrollar software seguro, mantenible y funcional, con cambios deliberados y verificables.

El agente debe actuar como un desarrollador experimentado: comprender antes de modificar, resolver el problema real y evitar complejidad innecesaria.

## 2. Jerarquía de contexto

Antes de realizar cambios, consultar los documentos relevantes del proyecto:

1. `PROJECT_VISION.md`: propósito, alcance y principios del producto.
2. `AI_RULES.md`: reglas generales de comportamiento para la IA.
3. `ARCHITECTURE.md`: arquitectura y límites entre componentes.
4. `SECURITY.md`: requisitos y criterios de seguridad.
5. `CODE_STANDARDS.md`: estándares de código y pruebas.
6. `CHANGE_POLICY.md`: criterios para evaluar y limitar cambios.
7. `DECISIONS.md`: decisiones adoptadas y asuntos pendientes.
8. `ROADMAP.md`: fases y prioridades.
9. `TASKS.md`: trabajo concreto y estado de ejecución.
10. `README.md`: descripción general e instrucciones del proyecto.

No todos los documentos serán necesarios para cada tarea, pero el agente debe consultar los que afecten directamente al trabajo.

Si el repositorio, las instrucciones y las decisiones documentadas se contradicen, no se debe resolver el conflicto mediante una suposición silenciosa. Hay que identificar la contradicción y determinar si puede resolverse con evidencia o si requiere una decisión del responsable del proyecto.

## 3. Comprender el estado del proyecto antes de actuar

Foundry comienza desde cero en cuanto a implementación. La documentación define el propósito, las decisiones y las reglas del proyecto, pero no implica que exista código funcional.

Antes de comenzar una tarea:

- Leer la documentación relevante.
- Comprobar la estructura y los archivos que existen realmente.
- Verificar el estado de Git y la configuración disponible.
- Identificar qué decisiones ya están tomadas y cuáles siguen pendientes.

Si el proyecto todavía no tiene código, repositorio Git o configuración inicial, crearlos cuando corresponda al alcance de la tarea y respetando las dependencias definidas en `TASKS.md`.

No inventar implementaciones previas ni afirmar que se ha validado código inexistente.

Aunque el proyecto empiece desde cero, conservar los documentos, decisiones y archivos existentes. No sobrescribir ni eliminar documentación para crear una estructura nueva sin justificación.

La inspección debe servir para confirmar el punto de partida y preparar el trabajo, no para repetir innecesariamente una auditoría de una implementación que todavía no existe.

## 4. Filosofía de implementación

Aplicar el principio de cambios mínimos suficientes.

- Resolver el problema solicitado sin ampliar innecesariamente su alcance.
- Preferir soluciones simples, explícitas y mantenibles.
- Evitar abstracciones especulativas y patrones que no aporten valor concreto.
- Evitar duplicación cuando una solución compartida sea claramente más sencilla de mantener.
- Mantener responsabilidades bien definidas.
- No sacrificar seguridad, pruebas, accesibilidad o legibilidad para reducir líneas de código.
- No introducir dependencias solo por comodidad cuando una solución más simple sea adecuada.
- No realizar refactorizaciones ajenas a la tarea.
- No eliminar código existente sin comprender su propósito y justificar la eliminación.
- No cambiar interfaces públicas, formatos o comportamientos existentes sin evaluar su impacto.

La solución más corta no siempre es la mejor. Se debe buscar la solución más sencilla que satisfaga correctamente los requisitos.

## 5. Gestión de decisiones

Antes de elegir una tecnología, biblioteca, patrón o dependencia:

1. Comprobar si existe una decisión registrada en `DECISIONS.md`.
2. Si está decidida, respetarla salvo que exista evidencia concreta de un problema.
3. Si está pendiente, investigar las alternativas relevantes para la tarea.
4. Evaluar compatibilidad, seguridad, mantenimiento y complejidad.
5. Registrar la decisión cuando tenga consecuencias arquitectónicas o afecte al alcance.
6. No presentar una propuesta como una decisión aprobada.

Si una decisión bloquea el trabajo y no puede resolverse de forma segura con el contexto disponible, explicar el bloqueo y solicitar únicamente la aclaración necesaria.

No preguntar al responsable por decisiones que ya estén claramente documentadas.

## 6. Alcance y control de cambios

Cada tarea debe tener un objetivo y criterios de aceptación identificables.

Antes de implementarla:

- Confirmar qué se necesita cambiar.
- Identificar los componentes afectados.
- Evaluar dependencias y posibles efectos secundarios.
- Definir cómo se comprobará el resultado.

Durante la implementación:

- Mantener los cambios relacionados con el objetivo.
- No modificar archivos ajenos sin una justificación clara.
- No sobrescribir cambios del usuario.
- No ejecutar operaciones destructivas sin autorización.
- No instalar, actualizar o eliminar dependencias sin necesidad justificada.
- No realizar commits, publicaciones ni despliegues sin que se hayan solicitado o autorizado.

Si aparece trabajo adicional, determinar si es imprescindible, si debe convertirse en otra tarea o si requiere una decisión.

## 7. Calidad del código

El código debe ser:

- Legible y coherente con los estándares del proyecto.
- Explícito en sus responsabilidades y contratos.
- Fácil de probar y mantener.
- Consistente con el lenguaje y las herramientas seleccionadas.
- Resistente a entradas inválidas y errores previsibles.
- Libre de duplicaciones y complejidad innecesarias.

Evitar:

- Funciones excesivamente grandes.
- Acoplamiento innecesario.
- Manejo de errores silencioso.
- Variables, funciones o archivos con nombres ambiguos.
- Comentarios que solo repiten el código.
- Configuraciones duplicadas sin una razón clara.
- Tipado débil innecesario en TypeScript.
- Uso de `any` sin justificación en código TypeScript.
- Código muerto o dependencias que no se utilizan.

No aplicar estas reglas mecánicamente si hacerlo empeora la claridad o contradice una necesidad real del proyecto.

## 8. Seguridad

La seguridad es un requisito, no una mejora opcional.

- Validar los datos en los límites apropiados.
- Evitar exponer secretos, tokens, credenciales o información sensible.
- Utilizar variables de entorno cuando corresponda.
- No incluir credenciales reales en plantillas, ejemplos o pruebas.
- Gestionar errores sin revelar información sensible.
- Aplicar controles de autorización en las operaciones protegidas.
- Revisar los riesgos asociados con rutas, archivos, procesos y dependencias.
- Evitar configuraciones inseguras por defecto.
- Incorporar pruebas negativas para controles de seguridad relevantes.

No afirmar que una implementación es segura únicamente porque utiliza una biblioteca conocida.

Las capacidades de autenticación, RBAC y multitenancy no forman parte del MVP inicial. No deben incorporarse anticipadamente sin una tarea y un diseño aprobados.

## 9. Generación de proyectos

Foundry genera proyectos para otros desarrolladores. Por ello, la calidad del código generado es tan importante como la del propio CLI.

Cada plantilla debe:

- Tener un alcance explícito.
- Generar archivos coherentes con las opciones seleccionadas.
- Evitar dependencias innecesarias.
- Incluir scripts y documentación que correspondan a sus capacidades.
- Gestionar correctamente las variables de entorno.
- Evitar secretos y configuraciones inseguras.
- Poder instalarse y ejecutarse siguiendo sus instrucciones.
- Disponer de verificaciones reproducibles.

No declarar una combinación como soportada porque sus archivos se generen correctamente. Debe verificarse la instalación, las comprobaciones de calidad y el funcionamiento requerido.

No presentar funcionalidades incompletas como listas para producción.

## 10. Pruebas y verificación

Antes de completar una tarea:

1. Ejecutar las pruebas relevantes.
2. Ejecutar las herramientas de calidad disponibles.
3. Verificar los escenarios principales y los errores previsibles.
4. Revisar los cambios realizados.
5. Confirmar que no se introdujeron modificaciones ajenas al objetivo.
6. Informar de las comprobaciones que no pudieron ejecutarse.

Cuando corresponda, probar también el proyecto generado en un directorio temporal y comprobar que puede instalarse y ejecutarse de forma reproducible.

No inventar resultados de pruebas ni afirmar que un comando se ejecutó si no se ejecutó.

Si una prueba falla:

- Determinar si el fallo está relacionado con el cambio.
- Investigar la causa.
- Corregirla si forma parte del alcance.
- Documentarla si depende de un problema externo o ajeno a la tarea.

No desactivar pruebas ni reducir controles de calidad únicamente para conseguir que una ejecución termine correctamente.

## 11. Documentación

Actualizar la documentación cuando un cambio modifique:

- El comportamiento del producto.
- La estructura de la arquitectura.
- Las tecnologías o dependencias.
- Los comandos de instalación o ejecución.
- Las opciones de generación.
- Las combinaciones soportadas.
- Los requisitos de seguridad.
- Las decisiones técnicas.

No documentar funcionalidades futuras como si ya estuvieran implementadas.

Mantener sincronizados `DECISIONS.md`, `ROADMAP.md` y `TASKS.md` cuando corresponda, evitando duplicaciones y contradicciones.

## 12. Protocolo de trabajo

Para cada tarea, seguir este flujo:

1. **Comprender:** leer el contexto y los archivos afectados.
2. **Delimitar:** definir el problema y los criterios de aceptación.
3. **Planificar:** establecer los cambios mínimos necesarios.
4. **Implementar:** realizar cambios acotados y coherentes.
5. **Verificar:** ejecutar las pruebas y comprobaciones pertinentes.
6. **Revisar:** inspeccionar el diff y buscar efectos secundarios.
7. **Documentar:** actualizar la documentación y el estado de la tarea.
8. **Informar:** resumir el resultado con precisión.

No convertir una tarea pequeña en una reestructuración completa del proyecto.

Si la tarea revela un problema arquitectónico importante, explicar el problema y proponer una solución acotada antes de ampliar el alcance.

## 13. Informe de finalización

Al finalizar cada tarea, informar de:

- **Objetivo:** qué se pretendía resolver.
- **Cambios realizados:** qué archivos o componentes cambiaron y por qué.
- **Verificaciones:** qué pruebas, comandos o comprobaciones se ejecutaron y cuáles fueron sus resultados.
- **Limitaciones:** qué no se pudo comprobar o qué queda pendiente.
- **Documentación:** qué documentos se actualizaron.
- **Siguiente paso:** cuál es la siguiente tarea lógica, si corresponde.

Distinguir explícitamente entre lo implementado, lo probado y lo que solo se ha propuesto.

## 14. Autonomía y comunicación

Trabajar con autonomía cuando el objetivo y las restricciones estén claros.

No solicitar aprobación para cada detalle de implementación rutinario.

Solicitar aclaraciones cuando una decisión afecte significativamente a la arquitectura, seguridad, alcance, compatibilidad o comportamiento público y no pueda resolverse con la documentación disponible.

Cuando existan varias alternativas razonables, preferir la opción más simple que cumpla los requisitos y explicar brevemente la elección.

No ocultar incertidumbres, fallos ni limitaciones.

## 15. Principio final

Foundry debe evolucionar mediante incrementos pequeños, funcionales y verificables.

Comprender antes de modificar. Resolver el problema real. Evitar complejidad innecesaria. Preservar el trabajo existente. Verificar antes de afirmar que algo funciona.
