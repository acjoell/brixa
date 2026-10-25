
# Project Vision

## 1. Propósito

Crear una herramienta CLI que permita generar la base de aplicaciones web mediante la selección de tecnologías y capacidades funcionales.

El objetivo es reducir el tiempo dedicado a configurar proyectos nuevos sin imponer una plantilla monolítica, una arquitectura innecesariamente compleja o funcionalidades que el usuario no necesita.

El generador debe producir código real, funcional, comprensible y mantenible; no solamente carpetas vacías o ejemplos incompletos.

## 2. Problema que resuelve

Al iniciar un proyecto, los desarrolladores suelen repetir tareas como:

- Configurar el entorno y las herramientas de desarrollo.
- Organizar la estructura inicial del código.
- Configurar autenticación y autorización.
- Preparar validación, manejo de errores y pruebas.
- Integrar una base de datos.
- Configurar Docker y otros servicios opcionales.
- Aplicar criterios consistentes de seguridad y calidad.

El generador busca automatizar estas tareas sin obligar a todos los proyectos a utilizar exactamente las mismas capacidades.

## 3. Usuario objetivo

Desarrolladores que quieren iniciar aplicaciones web con una base técnica sólida y adaptable.

La herramienta debe ser accesible para desarrolladores que están aprendiendo, sin dejar de producir una estructura adecuada para proyectos profesionales.


## 4. Experiencia de uso

### Modo simple

Será la modalidad disponible en el MVP.

La CLI guiará al usuario mediante preguntas claras, opciones comprensibles y valores predeterminados razonables.

El usuario podrá seleccionar el tipo de proyecto, el lenguaje y las capacidades compatibles con la generación elegida.

Antes de generar archivos, la CLI validará las selecciones y mostrará un resumen de lo que va a crear.

### Modo avanzado

Se incorporará en una etapa posterior.

Permitirá personalizar más detalles técnicos una vez que el flujo básico de generación sea funcional, estable y verificable.

No forma parte del alcance inicial.



## 5. Tecnologías y capacidades potenciales

### Frontend

- React.
- Vite como herramienta de desarrollo y construcción.
- JavaScript o TypeScript, seleccionable por el usuario.

### Backend

- Node.js.
- Express.
- JavaScript o TypeScript, seleccionable por el usuario.

### Persistencia

- PostgreSQL.
- SQLite.
- Un ORM o mecanismo de persistencia que se seleccionará después de una prueba técnica.

### Capacidades opcionales

- Autenticación y gestión de sesiones.
- Autorización mediante roles y permisos (RBAC).
- Multitenancy.
- Registro público de usuarios.
- Internacionalización (i18n).
- Docker y Docker Compose.
- Pruebas automatizadas.
- Documentación de API.

Esta lista define la dirección prevista del producto, no significa que todas las opciones estarán disponibles en el MVP.

Next.js, otros frameworks backend y bases de datos adicionales se evaluarán en versiones posteriores.

Las capacidades de autenticación, RBAC y multitenancy se incorporarán después de validar el proceso de generación base.

## 5.1 Modalidades de generación

El usuario podrá elegir entre:

- Solo frontend.
- Solo backend.
- Aplicación completa con frontend y backend.

La persistencia se ofrecerá cuando se genere un backend y la integración con la base de datos seleccionada esté implementada y verificada.

La aplicación completa combinará componentes compatibles del frontend y backend.

El generador no debe presentar una modalidad como disponible hasta que pueda generar y verificar un proyecto funcional para ella.


## 6. Generación por capacidades

Cada capacidad seleccionada debe producir una implementación coherente y funcional.

El generador debe:

- Incluir únicamente las dependencias necesarias.
- Crear solamente los archivos requeridos por las capacidades elegidas.
- Configurar correctamente las integraciones entre capacidades.
- Evitar archivos vacíos, funciones ficticias y código que no tenga utilidad.
- Informar de las limitaciones conocidas.
- Rechazar combinaciones incompatibles cuando no exista una integración válida.

No debe incluir una funcionalidad solo porque sea habitual en otros proyectos.

## 7. Principios de diseño técnico

### Simplicidad con criterio

La solución más sencilla que satisfaga los requisitos debe ser la preferida, siempre que cumpla los criterios de seguridad, calidad y mantenibilidad.

### Arquitectura pragmática

Se aplicarán principios de separación de responsabilidades y dirección clara de dependencias.

No se crearán capas, interfaces, fábricas o abstracciones sin una necesidad concreta.

### Seguridad desde el diseño

Las capacidades relacionadas con autenticación, autorización y aislamiento de datos deben tener requisitos de seguridad explícitos y pruebas apropiadas.

### Legibilidad

El código generado debe resultar comprensible para otro desarrollador sin depender de explicaciones del autor original.

### Consistencia

Los proyectos generados deben seguir convenciones coherentes en nombres, estructura, errores, validaciones, pruebas y documentación.

### Configuración explícita

Las decisiones importantes deben ser visibles y comprensibles. Se evitarán comportamientos implícitos que puedan generar riesgos o confusión.


## 8. Alcance inicial: MVP

El MVP se centrará en una CLI interactiva con modo simple que permita generar proyectos nuevos.

El usuario podrá seleccionar:

- Solo frontend, solo backend o aplicación completa.
- JavaScript o TypeScript.
- Las capacidades que estén implementadas y sean compatibles con la modalidad seleccionada.

La primera versión debe priorizar un conjunto limitado de combinaciones que puedan generarse, instalarse, ejecutarse y verificarse correctamente.

La generación de backend con persistencia dependerá de que la integración seleccionada haya sido validada mediante una prueba técnica y pruebas automatizadas.

Las siguientes capacidades quedan fuera del alcance inicial y se incorporarán posteriormente:

- Modo avanzado.
- Autenticación.
- RBAC.
- Multitenancy.
- Frameworks adicionales, como Next.js.
- Bases de datos y combinaciones que no hayan sido verificadas.

La lista anterior no impide diseñar el generador para facilitar futuras ampliaciones. Sin embargo, no se deben implementar anticipadamente abstracciones complejas para funcionalidades que todavía no forman parte del alcance.

La primera versión debe demostrar que el proceso de selección, composición, generación y ejecución funciona de principio a fin.


## 9. Criterios de éxito

El generador debería:

- Producir proyectos que puedan instalarse y ejecutarse siguiendo sus instrucciones.
- Generar código funcional para las capacidades seleccionadas.
- Evitar incluir capacidades no solicitadas.
- Mantener una estructura fácil de comprender.
- Incorporar controles de seguridad apropiados para cada capacidad.
- Ejecutar las verificaciones disponibles antes de declarar una generación como válida.
- Explicar qué se generó, qué configuración requiere el usuario y qué limitaciones existen.


## 10. Decisiones pendientes

- Confirmar el nombre definitivo y comprobar disponibilidad antes de publicar.
- Seleccionar el ORM después de una prueba técnica.
- Definir las versiones estables y combinaciones exactas de Node.js, React, Vite, Express y las herramientas asociadas.
- Definir la matriz inicial de combinaciones soportadas.
- Confirmar la licencia del proyecto después de evaluar AGPL-3.0 y las implicaciones para colaboradores y aplicaciones generadas.
- Definir la política de contribuciones y gestión de derechos sobre el código aportado por terceros.
- Determinar las herramientas y el proceso para verificar cada combinación generada.

Las decisiones confirmadas y propuestas deben mantenerse registradas en `DECISIONS.md`.
