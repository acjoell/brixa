
# Security Guidelines

## 1. Objetivo

Establecer requisitos mínimos de seguridad para el generador y los proyectos que produce.

La seguridad debe formar parte del diseño y de las pruebas, no añadirse como una corrección posterior.

Los requisitos concretos dependen de las capacidades seleccionadas, el tipo de aplicación y sus riesgos.

## 2. Principios generales

- Aplicar el principio de mínimo privilegio.
- Denegar el acceso por defecto cuando exista un mecanismo de autorización.
- Validar y tratar como no confiables los datos recibidos del exterior.
- Aplicar controles de seguridad en el servidor.
- No confiar en las restricciones implementadas únicamente en el frontend.
- Evitar exponer secretos o información interna.
- Mantener las dependencias actualizadas y evaluar sus riesgos.
- Probar los controles de seguridad y sus casos negativos.
- No declarar una funcionalidad segura sin haber verificado los controles relevantes.

## 3. Autenticación

Si se selecciona autenticación, la implementación debe incluir un flujo funcional y documentado.

Se deben definir explícitamente:

- El mecanismo de autenticación.
- El ciclo de vida de las credenciales y sesiones.
- El proceso de cierre de sesión.
- La recuperación de acceso, si está incluida.
- Las políticas de expiración y renovación.
- Los límites de intentos y las medidas contra el abuso.
- El tratamiento de cuentas deshabilitadas o revocadas.

Las credenciales no deben almacenarse en texto plano.

Las contraseñas deben protegerse mediante un algoritmo de hash diseñado para contraseñas, con parámetros apropiados y una biblioteca mantenida.

Los tokens y las sesiones deben protegerse de acuerdo con el mecanismo elegido. Si se utilizan cookies, deben configurarse las opciones de seguridad pertinentes, como `HttpOnly`, `Secure` y `SameSite`, según el entorno y el flujo de autenticación.

No se deben almacenar tokens sensibles en ubicaciones accesibles a JavaScript sin evaluar los riesgos.

Si se implementa renovación de tokens, deben definirse las reglas de expiración, revocación y detección de reutilización cuando corresponda.

Los errores de autenticación no deben revelar innecesariamente si una cuenta existe.

## 4. Autorización y RBAC

Si se selecciona RBAC, el sistema debe distinguir entre autenticación y autorización.

Estar autenticado no implica tener permiso para realizar cualquier operación.

### Catálogo de permisos

Los módulos pueden declarar los permisos que necesitan.

El sistema puede reunirlos en un catálogo central para permitir su consulta, documentación y asignación a roles.

Registrar un permiso en el catálogo no protege automáticamente una ruta ni una operación.

### Aplicación efectiva de permisos

Cada ruta, controlador o caso de uso protegido debe aplicar explícitamente el control de autorización correspondiente.

La implementación debe verificar el permiso requerido antes de ejecutar la operación protegida.

Los controles no deben depender exclusivamente de que el frontend oculte botones o páginas.

### Roles y permisos

Los roles deben agrupar permisos conocidos por el sistema.

La asignación de permisos debe validar que los permisos existen y que quien realiza la asignación está autorizado para hacerlo.

No se deben aceptar permisos arbitrarios enviados por el cliente.

### Alcance sobre recursos

Tener un permiso general no implica necesariamente acceso a todos los recursos.

Cuando corresponda, deben aplicarse restricciones adicionales, como:

- Acceso únicamente a recursos propios.
- Acceso limitado a una organización.
- Acceso limitado a una sucursal.
- Acceso limitado a determinados estados o relaciones del recurso.

Estas restricciones deben verificarse en el servidor y aplicarse también a consultas y modificaciones de datos.

## 5. Multitenancy y aislamiento de datos

Si se selecciona multitenancy, el aislamiento entre organizaciones es un requisito crítico.

El sistema debe determinar el contexto de la organización a partir de una fuente confiable y validada en el servidor.

No debe confiar únicamente en un `tenantId`, `organizationId` o `carWashId` enviado por el cliente.

Todas las operaciones relevantes deben respetar el contexto de la organización, incluidas:

- Lecturas individuales y listados.
- Creación de recursos.
- Actualizaciones y eliminaciones.
- Relaciones entre entidades.
- Consultas agregadas.
- Operaciones en segundo plano.
- Exportaciones y reportes.
- Acciones administrativas, cuando correspondan.

Las modificaciones deben verificar que el recurso pertenece al ámbito autorizado antes de ejecutarse.

La validación de identificadores aislada no sustituye el control de autorización.

Las relaciones entre entidades también deben respetar el mismo ámbito. No debe ser posible asociar un recurso de una organización con otro recurso perteneciente a una organización diferente, salvo que exista una regla explícita y segura que lo permita.

Los accesos administrativos globales deben estar definidos de forma explícita y contar con controles apropiados.

## 6. Validación de entradas

Los datos externos deben validarse en los límites del sistema.

La validación debe comprobar el tipo, formato, longitud, rango y restricciones pertinentes.

Las operaciones de escritura deben validar los campos permitidos y evitar asignaciones masivas de propiedades no autorizadas.

La validación de datos no sustituye la autorización.

Las consultas a bases de datos deben utilizar mecanismos seguros de parametrización o las protecciones equivalentes de la biblioteca utilizada.

No se deben construir consultas mediante concatenación insegura de datos externos.

## 7. Protección de sesiones y solicitudes

Cuando corresponda, se deben considerar:

- Protección frente a CSRF en flujos basados en cookies.
- Configuración segura de CORS.
- Limitación de solicitudes y operaciones sensibles.
- Invalidación de sesiones.
- Protección de cookies.
- HTTPS en entornos de producción.
- Políticas de seguridad del navegador apropiadas para la aplicación.

Estas medidas deben configurarse según el mecanismo utilizado. No todas se aplican de la misma forma a todos los proyectos.

## 8. Secretos y configuración

Los secretos no deben aparecer en:

- El código fuente.
- Los archivos de ejemplo del entorno.
- Los registros.
- Los mensajes de error.
- Las respuestas de la API.
- Los repositorios públicos.

Los archivos `.env` con valores reales deben excluirse del control de versiones cuando corresponda.

Los archivos `.env.example` deben contener nombres de variables y valores ilustrativos no sensibles.

La configuración debe validarse al iniciar la aplicación.

## 9. Errores y registros

Los mensajes de error públicos deben ser útiles sin exponer detalles internos.

Las trazas completas y los detalles técnicos pueden registrarse de forma controlada en el servidor, evitando secretos y datos sensibles.

Los registros deben evitar almacenar contraseñas, tokens de autenticación u otras credenciales.

La información personal debe tratarse con criterios de minimización y protección adecuados al contexto.

## 10. Dependencias y cadena de suministro

Las dependencias deben elegirse considerando su mantenimiento, reputación, licencia y necesidad real.

Se deben evitar paquetes innecesarios.

El proyecto debe permitir revisar las dependencias y detectar vulnerabilidades mediante herramientas apropiadas.

No se debe considerar que una dependencia es segura únicamente porque es popular.

Los cambios de dependencias deben evaluarse y verificarse con las pruebas disponibles.

## 11. Pruebas de seguridad

Cuando existan controles de autenticación, autorización o multitenancy, las pruebas deben cubrir tanto el acceso permitido como el denegado.

Casos importantes:

- Usuario no autenticado intenta acceder a un recurso protegido.
- Usuario autenticado carece del permiso requerido.
- Usuario intenta acceder a un recurso ajeno.
- Usuario de una organización intenta acceder a datos de otra.
- Usuario intenta modificar el identificador de organización.
- Usuario intenta asociar entidades de organizaciones diferentes.
- Usuario intenta asignar permisos que no puede administrar.
- Usuario deshabilitado intenta continuar usando una sesión, según el mecanismo implementado.

Las pruebas deben verificar el resultado observable y que no se produzcan cambios indebidos en los datos.


## 12. Incorporación gradual de capacidades de seguridad

La autenticación, RBAC y multitenancy quedan fuera del MVP inicial.

Su incorporación posterior debe realizarse como capacidades funcionales, documentadas y verificables.

No se deben generar implementaciones incompletas que aparenten ofrecer seguridad sin aplicar los controles necesarios.

Antes de habilitar cada capacidad, deben definirse:

- Sus dependencias y requisitos.
- Las operaciones y recursos que protege.
- Los controles de autorización aplicables.
- Las interacciones con otras capacidades.
- Las pruebas de acceso permitido y denegado.
- Los riesgos y limitaciones conocidos.

La arquitectura inicial debe mantenerse sencilla. No se deben añadir capas o abstracciones de seguridad sin una necesidad concreta, pero tampoco se deben diseñar las capacidades futuras de forma que resulte innecesariamente difícil implementarlas de manera segura.
