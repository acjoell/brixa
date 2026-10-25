# Reglas de trabajo para asistentes de IA

Estas reglas se aplican al analizar, diseñar, escribir, modificar, revisar y probar el generador. Si una tarea contradice estas reglas, señala el conflicto. Pide aclaración cuando afecte a seguridad, arquitectura o alcance.

## 1. No inventar requisitos
- No presentar como decidido algo que no figure en la documentación o no haya aprobado el usuario.
- Si falta información, identificar la laguna y preguntar o presentar opciones explícitas.
- Distinguir **confirmado**, **propuesta** y **pendiente de decisión**.
- No ampliar el alcance por iniciativa propia ni implementar funcionalidades «por si acaso».
- No cambiar silenciosamente decisiones técnicas aprobadas.

## 2. Comprender antes de actuar
- Leer las instrucciones pertinentes y revisar el código existente antes de proponer cambios.
- Seguir el flujo real de datos y llamadas; no inferir la arquitectura solo por nombres de archivos.
- Buscar implementaciones, utilidades, componentes, patrones y dependencias existentes antes de añadir otros.
- Si el repositorio contradice la documentación, informar de la discrepancia y proponer cómo resolverla; no adivinar qué fuente prevalece.

## 3. Cambio mínimo suficiente — filosofía Lazy Senior
- Hacer el cambio más pequeño que resuelva correctamente el requerimiento.
- Evitar refactorizaciones no solicitadas, formateos masivos, renombrados amplios y reescrituras completas.
- No tocar módulos ajenos salvo que exista una dependencia real y se explique.
- No crear capas, interfaces, fábricas, utilidades, configuraciones o dependencias sin necesidad concreta.
- Preferir las capacidades existentes y de la plataforma antes de añadir una dependencia, siempre que sean adecuadas.
- No comprimir el código a costa de legibilidad. Menos líneas no significa mejor código.

## 4. Seguridad y calidad no negociables
- No eliminar validación, autorización, manejo de errores, protección de datos, accesibilidad ni pruebas para simplificar.
- No desactivar pruebas o debilitar reglas para que pase una implementación.
- No exponer secretos, credenciales, tokens ni datos sensibles en código, logs o ejemplos.
- Validar datos en límites de confianza y aplicar autorización en el servidor.
- Si una petición introduce una vulnerabilidad o contradice un requisito de seguridad, explicar el riesgo antes de implementarla.

## 5. Cambios destructivos
Antes de eliminar o reemplazar código, archivos, migraciones, datos o configuración:
1. Identificar quién los utiliza y qué comportamiento depende de ellos.
2. Confirmar que la eliminación es necesaria.
3. Explicar impacto y alternativas menos disruptivas.
4. Pedir aprobación si la acción es amplia, irreversible o puede causar pérdida de datos.

No borrar una implementación funcional solo por preferir otra organización.

## 6. Transparencia
Al terminar, resumir qué cambió y por qué, archivos afectados, pruebas ejecutadas y resultados, qué no se comprobó y qué riesgos subsisten. No afirmar que una prueba pasó si no se ejecutó ni que una función está terminada si solo se creó su estructura.

## 7. Preguntar antes de decisiones relevantes
Pedir aclaración antes de decisiones no documentadas que cambien alcance, experiencia importante, arquitectura, modelo de datos, límites entre módulos, autenticación/autorización, dependencias principales, seguridad, privacidad, migraciones o compatibilidad.

Para decisiones locales, reversibles y de bajo impacto cubiertas por convenciones aprobadas, elegir la opción más simple y documentarla si importa.

## 8. Registro de permisos no equivale a proteger rutas
- Un permiso declarado en un módulo no protege automáticamente una ruta.
- Las rutas deben conectar explícitamente con middleware o políticas de autorización.
- El registro de módulos y permisos seguirá un mecanismo documentado y comprobable.
- No introducir escaneo mágico de archivos ni carga dinámica sin aprobación y justificación.

## 9. Protocolo proporcional por tarea
1. Reformular brevemente objetivo y restricciones.
2. Inspeccionar implementación y pruebas relacionadas.
3. Proponer un plan corto si afecta varios archivos o decisiones.
4. Implementar solo el alcance aprobado.
5. Ejecutar verificaciones pertinentes.
6. Revisar el diff por cambios accidentales, duplicación y complejidad innecesaria.
7. Informar resultados, límites y riesgos.

En tareas pequeñas y claras, aplicar el protocolo sin añadir burocracia.
