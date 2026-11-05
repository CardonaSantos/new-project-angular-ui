# Gastro Core CAT-R2 — Ergonomía y operaciones atómicas
**Fecha:** 2026-11-05
**Base Angular:** `feat/catalog-guided-product-ui-r1-20261105`, PR #31 (R1, no fusionado).
**Backend requerido:** `CardonaSantos/new-project` PR #31, rama `feat/catalog-r2-atomic-setup-readiness-20261105`.

## Alcance de esta entrega

- **Producto único:** el usuario introduce nombre y precio; la variante «Única» sigue existiendo en la base de datos, pero su edición se oculta mientras no haya tamaños.
- **Producto inventariable:** alterna «Crear artículo ahora» y «Usar uno existente» dentro de la ficha. Un nuevo artículo `PRODUCTO_TERMINADO` recibe código autogenerado y nombre comercial; stock inicial **cero**, sin escritura de movimiento ni falsificación de existencias. Controles de lote/vencimiento opcionales en un desplegable avanzado.
- **Alta atómica:** UI llama `POST /api/catalog/products/setup`, no realiza llamadas individuales después: producto, variantes, nuevos artículos físicos y precios se confirman juntos o se revierten todos.
- **Permisos:** `catalog.manage`, `inventory.articles.manage` global para artículo físico nuevo, `catalog.prices.manage` en sucursal para precio. La UI oculta opciones no autorizadas; el backend vuelve a validar todos los permisos dentro de la misma transacción.
- **Estado reactivo:** después de crear se muestran los precios confirmados por el servidor y faltantes por tipo. No declara publicación automática en POS.
- **Menú publicado:** botón «Guardar y publicar» ejecuta `POST /api/catalog/menus/:id/commit` con control de versión y comprobación de receta, estación, foto y precio antes de sustituir la configuración. Un error revierte el cambio y mantiene la versión anterior publicada.
- **Precios batch:** endpoint `POST /api/catalog/prices/variants/batch` disponible para más pantallas; en R2 el alta guiada ya almacena todos los precios dentro de setup, por lo que no necesita hacer una llamada batch adicional.
- Editor avanzado y endpoints anteriores permanecen sin cambios. Sin migraciones nuevas.

## Riesgos/decisiones
- El servidor busca una unidad base `UNIDAD` configurada al crear artículo inline; si no existe, devuelve error explícito y revierte toda la operación.
- La creación nueva puede ser no idempotente si se pierde la respuesta: el código único evita duplicación pero se debe consultar el catálogo antes de un nuevo intento.
- No hay stock inicial: la entrada real se registra posteriormente desde Inventario.
- Imágenes siguen siendo requisito duro para publicar y las recetas se editan desde su módulo (R3 integrará esas operaciones inline).
- «Guardar borrador» continúa disponible, pero advierte explícitamente cuando retirará una carta publicada.

## QA local de aceptación
1. Inventariable único «Flan» Q20, artículo nuevo: una operación SQL, artículos activos, cantidad 0, precio Q20 y ausencia de comanda de Cocina.
2. Inventariable con artículo existente: no crea uno adicional. Usuario sin permiso `inventory.articles.manage`: solamente vincular.
3. Dos tamaños de preparado, precio por tamaño, sin artículo físico; requiere receta publicada y estación con ubicación de consumo.
4. Servicio sin artículo ni receta, precio por sucursal.
5. Simular duplicado de código o precio inválido: no persisten ni artículo ni producto huérfano.
6. Menu ya publicado: agregar variante incompleta -> `409` y el menú anterior sigue visible en POS; corregir foto/receta/precio/ruta -> publicar en una sola operación.
7. Dos sesiones editan misma carta: segunda recibe conflicto de versión y no pisa la primera.
8. Navegación por teclado, 390/768/1366 px, zoom Firefox 90 %, foco de búsqueda, apertura de detalles opcionales, pantalla de error sin pérdida del borrador.
9. Todas las llamadas de escritura excluidas de reintento automático.

## Arranque local
```powershell
# Angular
git fetch origin
git switch feat/catalog-r2-ergonomic-setup-20261105
git pull --ff-only origin feat/catalog-r2-ergonomic-setup-20261105
npm start

# Backend (su propio directorio)
git fetch origin
git switch feat/catalog-r2-atomic-setup-readiness-20261105
git pull --ff-only origin feat/catalog-r2-atomic-setup-readiness-20261105
npm run start:dev
```
No mezclar con `main` antes de revisar tests y QA.
