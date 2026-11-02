# Contribuir

Gracias por querer contribuir. Las contribuciones se aceptan mediante issues y pull requests. El mantenedor decide qué se incorpora.

## Antes de empezar

- Para una funcionalidad nueva, abre antes un issue y espera confirmación del alcance.
- Los cambios deben ser pequeños y estar relacionados con un único objetivo.
- No añadas dependencias sin justificarlas en el pull request.
- Las vulnerabilidades no se reportan en issues públicos. Usa el reporte privado de vulnerabilidades del repositorio.

## Requisitos del pull request

- Pasan `npm run typecheck`, `npm run lint`, `npm run format:check` y `npm test`.
- Si tocas plantillas, ejecuta `npm run verify:generated` para las variantes afectadas e indica el resultado.
- Los cambios de plantillas y dependencias reciben una revisión más estricta, porque llegan a todos los proyectos generados.

## Licencia y DCO

Al contribuir aceptas que tu aportación se distribuye bajo la AGPL-3.0 y con la excepción sobre código generado descrita en `GENERATED_CODE_LICENSE.md`.

Cada commit debe llevar la línea `Signed-off-by` (Developer Certificate of Origin, https://developercertificate.org). Se añade con `git commit -s`.