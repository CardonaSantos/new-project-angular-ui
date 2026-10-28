# Form Engine & Advanced UX (PR #5)

## Alcance y contratos

Los formularios de creación y edición van en páginas completas. Los diálogos solo confirman o descartan, nunca contienen formularios.

- `GcFormWizard`: pasos Formly, avance bloqueado por validaciones de controles, retroceso, revisión, Zod y confirmación. Emite `completed` y expone `hasUnsavedChanges()`.
- `GcFormActions`: acciones Anterior/Siguiente/Confirmar con busy.
- `GcFormReview`: presentación de valores y etiquetas sin formato de dominio.
- `GcFormErrorSummary`: lista de problemas que permite regresar al paso de corrección.
- `gcValidateSchema` y `gcApplyServerErrors`: validación cruzada y errores normalizados del servidor. No se supone un envelope de NestJS.
- `GcMaskedInput`: Maskito sobre FormControl<string>, independiente de validación del contenido.
- `GcFileUpload`: tipo MIME declarado, límites de cantidad y peso, vista previa por object URL y revocación al reemplazar/destruir.
- `gcCheckFiles`: validador local puro. El backend debe volver a inspeccionar cada archivo.

## Playground

La ruta `/lab/forms` permite: tres pasos, campos requeridos, comprobación de costo y precio con Zod, edición de pasos anteriores, máscara de teléfono, imágenes y mensajes de validación simulados.
No hay escrituras al backend ni almacenamiento de preferencias. Los valores monetarios son demostrativos.

## Convenciones de UX

- No introducir Signal Forms y Formly en el mismo formulario; Formly trabaja sobre Reactive Forms.
- El usuario debe poder regresar, cancelar la confirmación, corregir datos y salir con advertencia si hay cambios pendientes.
- No convertir cada clic en confirmación: confirmar acciones que comprometen datos o estado. Menús, búsquedas y filtros no requieren diálogo.
- Las máscaras y previsualizaciones ayudan a ingresar datos, pero no sustituyen validación del servidor.
- Respetar accesibilidad por teclado, foco, zoom y prefers-reduced-motion.

## Verificación

    npm ci
    npm run lint
    npm run build
    npm test -- --watch=false

No integrar DTOs reales hasta verificar Swagger del backend.