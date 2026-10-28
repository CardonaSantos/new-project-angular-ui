# Design System — Hardening y controles

## Correcciones

- El perfil usa MatMenu con clase CSS aplicada al panel real, soporte CDK de Escape, clic fuera y foco.
- ConfirmDialogService mantiene diálogos exclusivamente para confirmaciones y usa el mismo espaciado semántico que las cards, width 420 px con límites al viewport y botones adaptables.
- GcPagination envuelve el selector en una etiqueta en vez de generar un id estático repetible.
- Token global: --gc-space-{1,2,3,4,6,8} y --gc-card-padding.

## Layout

- GcCard: header opcional, descripción, área de acciones, cuerpo y footer.
- GcPageContainer: anchuras narrow/normal/wide con margen centrado.
- GcFormGrid: 1, 2 o 3 columnas con puntos de ruptura responsive.

## Controles

- GcTextInput, GcTextarea, GcSelect: aceptan FormControl de Angular, labels y controles con semántica nativa.
- GcMultiSelect: autocomplete Angular Material, chips con botones accesibles para quitar; emite cambios a FormControl<string[]>.
- GcBarcodeInput: lectores USB/Bluetooth en modo teclado; completa por Enter, elimina espacios periféricos, evita lecturas duplicadas en una ventana breve. No captura teclas globales.
- GcDecimalInput: usa decimal.js y FormControl<string>; normaliza a los decimales configurados sin redondeos silenciosos. Es un control de formato local; los validadores de Angular/Zod y NestJS siguen siendo obligatorios.
- GcMediaManager: agrega imágenes en varias selecciones, descarta duplicadas, valida tamaño/MIME/cantidad, elige principal, permite quitar y reordenar, revoca object URLs para evitar fugas.

## Límites

Sin subida de archivos ni endpoints reales. Los filtros, roles, validaciones y reglas finales del servidor no se adivinan. Todos los controles funcionan localmente y no guardan configuración.
No reemplazar el Formly Material nativo indiscriminadamente: wrappers externos como estos se utilizan cuando el control de negocio los necesita. Los DTO se validan por separado.

## Comprobación

npm ci, npm run lint, npm run build, npm test -- --watch=false.
Probar visualmente perfil, confirmaciones, cards y todos los controles con zoom, teclado y modo oscuro.