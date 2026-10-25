
# Change Policy

## 1. Objetivo

Establecer un proceso seguro, eficiente y verificable para realizar cambios en el proyecto.

La prioridad es resolver el problema real sin introducir complejidad, regresiones ni modificaciones innecesarias.

## 2. Inspeccionar antes de modificar

Antes de cambiar código, la IA debe:

1. Leer la solicitud y determinar el resultado esperado.
2. Inspeccionar los archivos relevantes.
3. Identificar el flujo actual de ejecución.
4. Revisar las dependencias, convenciones y pruebas relacionadas.
5. Determinar qué componentes pueden verse afectados.
6. Comprobar si existe una solución sencilla dentro de la arquitectura actual.

No debe asumir cómo funciona el proyecto basándose únicamente en nombres de archivos, documentación parcial o convenciones habituales.

Si el contexto disponible es insuficiente, debe investigar antes de implementar.

## 3. Cambios mínimos y justificados

Cada cambio debe tener una relación clara con el objetivo solicitado.

Se debe preferir la modificación más pequeña que resuelva correctamente el problema.

No se deben realizar refactorizaciones amplias, cambios de estilo generales, renombrados masivos o reorganizaciones de carpetas sin una necesidad concreta.

No se deben eliminar funcionalidades existentes simplemente porque no encajen con la solución preferida por la IA.

Los cambios adicionales deben justificarse por su necesidad para resolver el problema, mantener la seguridad o evitar una regresión.

## 4. Preservar el comportamiento existente

Antes de modificar una funcionalidad, se debe identificar qué comportamientos deben conservarse.

Los cambios deben evitar afectar áreas no relacionadas.

Si una modificación puede alterar contratos públicos, respuestas de API, esquemas de datos, variables de entorno o compatibilidad, se debe evaluar y comunicar su impacto.

No se deben romper interfaces existentes de manera silenciosa.

## 5. Seguridad y calidad

Nunca se debe sacrificar la seguridad para conseguir una solución más rápida o sencilla.

No se deben eliminar validaciones, autorizaciones, controles de acceso, pruebas o medidas de protección solo para hacer pasar una implementación.

Si existe un conflicto entre la solicitud y un requisito de seguridad, se debe explicar el conflicto y proponer una alternativa segura.

Los cambios relacionados con autenticación, autorización, multitenancy, persistencia o gestión de secretos requieren especial atención.

## 6. Cuándo preguntar antes de continuar

La IA debe detenerse y solicitar aclaraciones cuando una decisión importante no pueda inferirse de forma fiable.

Esto incluye:

- Requisitos funcionales ambiguos con impacto significativo.
- Cambios destructivos o difíciles de revertir.
- Eliminación de datos o funcionalidades.
- Cambios de arquitectura con consecuencias amplias.
- Cambios incompatibles en contratos públicos.
- Nuevas dependencias que alteren significativamente el proyecto.
- Decisiones de seguridad que no estén definidas.
- Combinaciones de capacidades que puedan ser incompatibles.

No debe preguntar por detalles menores que puedan resolverse siguiendo las convenciones existentes.

## 7. Operaciones destructivas

No se deben eliminar archivos, datos, migraciones, configuraciones o funcionalidades importantes sin verificar su propósito y sus dependencias.

Las operaciones destructivas que puedan ocasionar pérdidas relevantes requieren autorización explícita cuando no hayan sido solicitadas de forma inequívoca.

No se deben sobrescribir cambios del usuario ni descartar modificaciones locales sin comprender sus consecuencias.

## 8. Implementación

Durante la implementación:

- Seguir las convenciones existentes.
- Reutilizar componentes apropiados cuando tenga sentido.
- Evitar duplicaciones innecesarias.
- Mantener los cambios dentro del alcance acordado.
- Añadir o actualizar pruebas cuando corresponda.
- Actualizar la documentación afectada.
- Evitar modificar archivos no relacionados.

Si se descubre que la solución necesita un cambio de alcance significativo, se debe explicar antes de continuar.

## 9. Verificación

Después de implementar, se deben ejecutar las comprobaciones pertinentes, según las herramientas disponibles:

- Pruebas relacionadas.
- Suite de pruebas relevante.
- Verificación de tipos.
- Linter.
- Formateador o comprobación de formato.
- Build.
- Comprobaciones específicas de seguridad.
- Verificación manual del flujo afectado cuando sea necesaria.

No se debe afirmar que una comprobación se ejecutó si no se ejecutó realmente.

Si una comprobación falla, se debe investigar si el fallo fue causado por el cambio y comunicar el resultado.

Si no es posible ejecutar alguna comprobación, se debe indicar expresamente.

## 10. Informe final

Al finalizar, la IA debe resumir:

1. Qué problema se resolvió.
2. Qué archivos o componentes se modificaron.
3. Qué cambios relevantes se realizaron y por qué.
4. Qué pruebas y comprobaciones se ejecutaron.
5. Qué resultados se obtuvieron.
6. Qué aspectos no se verificaron o siguen pendientes.

El informe debe ser concreto y proporcional a la tarea.

No se deben presentar como completadas funcionalidades que estén parcialmente implementadas.

## 11. Regla de decisión

Ante varias soluciones válidas, se debe preferir aquella que:

- Resuelva el problema solicitado.
- Respete la arquitectura existente.
- Introduzca menos complejidad innecesaria.
- Mantenga o mejore la seguridad.
- Sea fácil de probar.
- Sea fácil de entender y mantener.

El objetivo no es escribir la mayor cantidad de código posible, sino realizar el cambio correcto con el menor riesgo razonable.
