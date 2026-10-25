
# Code Standards

## 1. Objetivo

Establecer estándares para el código del generador y para los proyectos que produce.

El objetivo es lograr código legible, seguro, coherente, verificable y fácil de mantener.

## 2. Legibilidad primero

El código debe poder comprenderse sin reconstruir mentalmente una cadena de abstracciones.

Se debe preferir:

- Nombres claros y específicos.
- Funciones con responsabilidades definidas.
- Condiciones fáciles de seguir.
- Flujo de ejecución explícito.
- Tipos que representen correctamente los datos.
- Estructuras consistentes dentro de cada proyecto.

Se deben evitar nombres ambiguos, abreviaturas innecesarias y funciones excesivamente extensas.

No se debe comprimir el código para reducir líneas si eso perjudica su comprensión.

## 3. Simplicidad y abstracciones

Antes de crear una abstracción, debe existir una necesidad identificable.

No se deben añadir clases, interfaces, fábricas, adaptadores, utilidades o capas solo por seguir una convención.

Se deben evitar:

- Código duplicado sin una razón válida.
- Abstracciones prematuras.
- Funciones que solo delegan sin aportar valor.
- Utilidades genéricas con responsabilidades no relacionadas.
- Configuración innecesariamente flexible.
- Patrones de diseño que aumenten la complejidad sin resolver un problema real.

La duplicación debe evaluarse según el contexto. No se debe crear una abstracción incorrecta únicamente para eliminar unas pocas líneas repetidas.

## 4. TypeScript y tipado

Cuando se seleccione TypeScript, debe aprovecharse su sistema de tipos para reducir errores y hacer explícitos los contratos.

Se debe:

- Preferir tipos específicos a `any`.
- Utilizar `unknown` cuando el tipo de un dato externo sea desconocido.
- Validar los datos externos en tiempo de ejecución.
- Evitar conversiones de tipo que oculten problemas reales.
- Mantener los tipos relacionados cerca de la funcionalidad que los utiliza.
- Exportar tipos compartidos únicamente cuando exista una necesidad real.

Los tipos de TypeScript no sustituyen la validación en tiempo de ejecución.

No se deben duplicar innecesariamente los tipos entre capas si existe una forma clara de mantener sus contratos.

## 5. Nombres y convenciones

Cada proyecto generado debe utilizar convenciones consistentes.

Se deben definir y respetar criterios para:

- Archivos y directorios.
- Componentes.
- Funciones y variables.
- Tipos e interfaces.
- Constantes.
- Rutas y endpoints.
- Variables de entorno.
- Pruebas.

Las convenciones específicas deben adaptarse al lenguaje y al ecosistema seleccionado.

No se debe imponer una única convención a tecnologías que tienen prácticas diferentes.

## 6. Manejo de errores

Los errores deben tratarse de manera explícita y coherente.

Se debe evitar:

- Capturar excepciones sin tratarlas.
- Ignorar errores silenciosamente.
- Devolver respuestas ambiguas.
- Exponer detalles internos al cliente.
- Utilizar excepciones como sustituto de toda lógica de control.

Los errores esperados deben manejarse según el contrato de cada operación.

Los errores inesperados deben poder diagnosticarse sin revelar información sensible.

## 7. Validación de datos

La validación debe realizarse en los límites apropiados del sistema.

Los datos procedentes de solicitudes HTTP, variables de entorno, archivos y servicios externos deben considerarse no confiables hasta ser validados.

Las reglas de validación deben estar organizadas de forma que puedan entenderse y probarse.

No se debe repetir la misma validación en todas las capas si existe una separación clara entre validación de entrada, reglas de negocio y persistencia.

## 8. Dependencias

Cada dependencia debe justificar su presencia.

Antes de añadir una biblioteca, se debe evaluar si la funcionalidad puede resolverse razonablemente con las herramientas existentes.

La evaluación debe considerar:

- Mantenimiento.
- Seguridad.
- Compatibilidad.
- Licencia.
- Tamaño y complejidad añadidos.
- Alternativas disponibles.

No se deben incorporar dependencias solo por conveniencia si introducen un coste desproporcionado.

Las versiones y combinaciones admitidas deben definirse explícitamente para el generador.

## 9. Pruebas

Las pruebas deben comprobar comportamientos relevantes y prevenir regresiones.

Se deben priorizar:

- Reglas de negocio.
- Casos de uso críticos.
- Validaciones.
- Autorización.
- Aislamiento de datos.
- Integraciones entre capacidades.
- Flujos principales del proyecto generado.

Las pruebas no deben depender innecesariamente del orden de ejecución ni de servicios externos cuando puedan aislarse de forma razonable.

No se deben modificar o eliminar pruebas únicamente para conseguir que una ejecución termine correctamente.

Si una prueba existente está desactualizada, se debe entender el motivo y justificar el cambio.

En el generador, las pruebas también deben comprobar que las combinaciones soportadas producen proyectos funcionales.

Cuando corresponda, se verificará la generación de archivos, la instalación de dependencias, la ejecución de comprobaciones de calidad y el inicio de la aplicación generada.

Las pruebas de cada combinación deben ser proporcionales a su alcance. No es necesario ejecutar todas las combinaciones posibles si algunas todavía no están soportadas.

La selección definitiva de herramientas de pruebas y calidad se registrará en `DECISIONS.md`.

## 10. Herramientas de calidad

Cuando las tecnologías seleccionadas lo permitan, se utilizarán herramientas apropiadas para:

- Formateo.
- Análisis estático.
- Verificación de tipos.
- Ejecución de pruebas.
- Detección de problemas de dependencias.

Las herramientas concretas dependerán del stack aprobado.

El generador no debe añadir herramientas redundantes que cumplan exactamente la misma función sin una razón clara.

## 11. Documentación

La documentación debe explicar cómo utilizar y mantener el proyecto.

Como mínimo, cada proyecto generado debe documentar:

- Requisitos previos.
- Instalación.
- Configuración.
- Variables de entorno.
- Ejecución en desarrollo.
- Pruebas disponibles.
- Capacidades seleccionadas.
- Limitaciones o pasos manuales necesarios.

Los comentarios deben explicar decisiones, restricciones o comportamientos no evidentes.

No se deben añadir comentarios que repitan literalmente lo que hace una línea de código.

La documentación debe mantenerse coherente con la implementación real.

## 12. Accesibilidad y frontend

Cuando se genere una interfaz, se deben seguir prácticas básicas de accesibilidad.

Se debe prestar atención a:

- Uso semántico de HTML.
- Navegación mediante teclado.
- Etiquetas asociadas a los campos.
- Contraste y legibilidad.
- Estados de carga, error y confirmación.
- Uso correcto de controles interactivos.
- Información comprensible para tecnologías de asistencia cuando corresponda.

La accesibilidad no debe tratarse como una mejora opcional posterior.

## 13. Criterio de aceptación

El código debe ser coherente con los estándares definidos y las herramientas disponibles.

Antes de declarar una tarea completada, se deben ejecutar las verificaciones relevantes y comunicar:

- Qué se verificó.
- Qué resultados se obtuvieron.
- Qué no pudo verificarse.
- Qué problemas permanecen pendientes.

No se debe afirmar que el código funciona si únicamente se ha revisado visualmente o por inspección.
