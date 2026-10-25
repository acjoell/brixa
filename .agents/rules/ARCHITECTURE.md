
# Architecture Guidelines

## 1. Objetivo

Definir criterios arquitectónicos para los proyectos generados por el CLI.

La arquitectura debe facilitar la comprensión, las pruebas, la evolución y el mantenimiento del código, sin introducir complejidad que no esté justificada por los requisitos.

Estas directrices son principios generales. La estructura concreta dependerá de las tecnologías y capacidades seleccionadas.

## 2. Principios fundamentales

### Separación de responsabilidades

Cada módulo y componente debe tener una responsabilidad clara.

La lógica de negocio no debe depender innecesariamente de detalles de infraestructura, como Express, una base de datos específica o un proveedor externo.

### Dirección de dependencias

Cuando se aplique una arquitectura por capas, las dependencias deben orientarse de forma que la lógica central no quede acoplada a los detalles externos.

Las dependencias entre módulos deben ser explícitas y justificadas.

### Simplicidad pragmática

No se deben crear capas, interfaces, servicios, fábricas, repositorios o adaptadores solo para cumplir un patrón.

Cada abstracción debe resolver una necesidad real, como aislar una dependencia, facilitar las pruebas, encapsular una regla de negocio o permitir sustituir una implementación.

### Cohesión y bajo acoplamiento

Los componentes relacionados deben permanecer juntos cuando eso facilite su comprensión.

Los módulos no deben depender de detalles internos de otros módulos si existe una interfaz de integración más apropiada.

## 3. Organización por módulos

Cuando el tamaño y las funcionalidades lo justifiquen, se preferirá una organización por módulos funcionales o dominios.

Ejemplos de módulos potenciales:

- `users`
- `auth`
- `organizations`
- `services`
- `vehicles`

Estos nombres son ilustrativos. Solo deben existir los módulos que correspondan a las capacidades seleccionadas.

Cada módulo debe tener una responsabilidad definida y límites comprensibles.

No se deben crear módulos vacíos para anticipar funcionalidades futuras.

## 4. Capas y responsabilidades

Cuando la complejidad lo justifique, podrán distinguirse las siguientes responsabilidades.

### Presentación o interfaz

Gestiona la interacción con el exterior.

En un backend HTTP puede incluir rutas, controladores, validación de entrada y transformación de respuestas.

No debe concentrar reglas de negocio complejas.

### Aplicación

Coordina casos de uso y operaciones del sistema.

Puede encargarse de verificar precondiciones, coordinar componentes y definir el flujo de una operación.

No debe convertirse en una capa de delegación sin lógica ni valor.

### Dominio

Contiene las reglas y conceptos de negocio que requieren independencia de los detalles técnicos.

No es obligatorio crear una capa de dominio extensa cuando la aplicación es pequeña y sus reglas son sencillas.

### Infraestructura

Contiene integraciones con tecnologías externas, como bases de datos, servicios de terceros, sistemas de archivos y mecanismos de comunicación.

Los detalles específicos de infraestructura no deben filtrarse innecesariamente hacia las reglas de negocio.

## 5. Persistencia y repositorios

La persistencia debe implementarse de acuerdo con las necesidades reales de la aplicación.

Un repositorio es apropiado cuando permite aislar consultas, operaciones de persistencia o detalles de una base de datos.

No es obligatorio crear una interfaz y una implementación separadas para cada entidad.

Cuando se utilicen abstracciones de persistencia, deben tener un propósito claro y facilitar la sustitución de implementaciones o las pruebas cuando sea necesario.

Las consultas y modificaciones de datos deben respetar las reglas de autorización y el aislamiento entre usuarios u organizaciones.


## 6. Integración de tecnologías y capacidades

El generador debe permitir seleccionar frontend, backend o aplicación completa.

Las combinaciones disponibles deben estar definidas y verificadas explícitamente.

### Frontend

La base inicial será React con Vite.

El usuario podrá seleccionar JavaScript o TypeScript.

No se mantendrán dos arquitecturas independientes si las mismas plantillas y componentes pueden compartirse de manera clara y segura.

### Backend

La base inicial será Node.js con Express.

El usuario podrá seleccionar JavaScript o TypeScript.

Las responsabilidades de rutas, validación, lógica de aplicación y persistencia deben organizarse de acuerdo con la complejidad real del proyecto.

### Persistencia

PostgreSQL y SQLite son los objetivos iniciales de soporte.

La integración con cada base de datos debe utilizar un mecanismo de persistencia seleccionado después de una prueba técnica.

La elección de un ORM no garantiza que todas las bases de datos sean intercambiables sin modificaciones.

Las particularidades de las bases de datos, sus migraciones, consultas y transacciones deben tenerse en cuenta.

### Capacidades futuras

Autenticación, RBAC y multitenancy se incorporarán después de validar la generación base.

Docker y Docker Compose serán opcionales.

Las capacidades futuras no deben introducir dependencias ni archivos innecesarios en los proyectos que no las seleccionen.

## 7. Contratos entre módulos

Las integraciones entre módulos deben ser explícitas.

Un módulo no debe acceder indiscriminadamente a los detalles internos de otro.

Los contratos compartidos deben limitarse a los tipos, funciones o interfaces que realmente necesiten varios módulos.

No se deben crear directorios de código compartido que terminen convirtiéndose en un depósito de utilidades sin cohesión.

## 8. Configuración y variables de entorno

La configuración debe mantenerse separada del código fuente.

Los valores sensibles no deben estar codificados directamente en el código ni incluirse en el repositorio.

El proyecto generado debe proporcionar:

- Un archivo de ejemplo para las variables de entorno.
- Validación de la configuración requerida al iniciar.
- Mensajes de error comprensibles cuando falte una variable necesaria.
- Documentación sobre las variables utilizadas.

Los secretos reales deben quedar fuera de los archivos de ejemplo.

## 9. Manejo de errores y observabilidad

Los errores deben manejarse de forma consistente.

La aplicación debe distinguir entre errores esperados y fallos inesperados cuando esa distinción sea relevante.

Las respuestas HTTP no deben exponer trazas internas, secretos, consultas sensibles ni detalles innecesarios de infraestructura.

Los registros deben facilitar el diagnóstico sin almacenar información sensible de forma indiscriminada.

No se debe añadir una plataforma compleja de observabilidad si el proyecto no la necesita.

## 10. Pruebas y testabilidad

La arquitectura debe permitir probar las reglas de negocio y los flujos críticos sin depender siempre de servicios externos.

Se priorizarán pruebas para:

- Casos de uso relevantes.
- Validaciones y reglas de negocio.
- Autorización.
- Aislamiento entre organizaciones, si existe multitenancy.
- Integraciones críticas.
- Comportamiento de las capacidades seleccionadas.

Las pruebas deben comprobar comportamientos reales, no limitarse a verificar que una función fue llamada.

## 11. Criterio para elegir una estructura

La estructura debe responder a la complejidad real del proyecto.

Para aplicaciones pequeñas se preferirá una organización sencilla con límites claros.

Para aplicaciones con varios módulos, reglas de negocio importantes o múltiples adaptadores, podrá justificarse una separación más estricta de capas.

No se debe imponer una estructura extensa por el solo hecho de que el generador aspire a producir proyectos profesionales.

## 12. Revisión arquitectónica

Antes de añadir una abstracción o cambiar la estructura, debe responderse:

1. ¿Qué problema concreto resuelve?
2. ¿Existe una alternativa más sencilla?
3. ¿Mejora la separación de responsabilidades o la testabilidad?
4. ¿Introduce nuevas dependencias o complejidad?
5. ¿Es necesaria para los requisitos actuales?

Si el beneficio no está claro, se debe preferir la solución más sencilla.


## 13. Matriz de combinaciones soportadas

El generador debe mantener una definición explícita de las combinaciones que puede generar.

Como mínimo, la matriz tendrá en cuenta:

- Modalidad: frontend, backend o aplicación completa.
- Lenguaje: JavaScript o TypeScript.
- Persistencia: ninguna, PostgreSQL o SQLite, cuando corresponda.
- Capacidades opcionales disponibles.
- Dependencias entre capacidades.
- Herramientas y versiones compatibles.
- Pruebas de generación, instalación y ejecución.

Una combinación no debe anunciarse como soportada solo porque sus plantillas existan.

Debe poder generarse, instalarse y ejecutarse siguiendo las instrucciones documentadas, y superar las comprobaciones definidas para esa combinación.

Las combinaciones no verificadas deben permanecer deshabilitadas o identificarse claramente como experimentales.
