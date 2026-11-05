# Gastro Core — R3-A + R3-B, UX guiada y consumo físico

**Fecha:** 2026-11-05
**UI branch:** `feat/catalog-r3-extras-recipe-composer-20261105`, PR #33 (basado en UI R2 PR #32, que incluye R1).
**Backend requerido:** `CardonaSantos/new-project` PR #32, `feat/catalog-r3-extras-recipes-safe-20261105` (incluye R2).
**Estado:** CI automatizada y QA local por verificar. NO merge aún.

## 1. Entrega A — Categorías y extras accesibles
- Categorías: creación/edición en la propia página; solo nombre en el camino normal. Jerarquía y orden en un desplegable «Organización avanzada»; operación de activación/desactivación permanece independiente, validada por el servidor. R1 mantiene crear y seleccionar categoría sin salir de alta producto.
- Extras: editor reusable `GcCatalogQuickExtraEditor` en `/catalog/extras` y dentro de cada variante en `/catalog/products/:id`. Captura nombre de grupo, política opcional/obligatoria/múltiple, opciones y recargos.
- Extra que agrega ingrediente físico: se selecciona artículo, unidad y cantidad adicional por unidad vendida en la misma pantalla. Solo PREPARADO y solo usuarios con `recipes.manage`. Consumir físicamente y cobrar recargo son conceptos distintos.
- `POST /api/catalog/modifier-groups/setup` crea grupo, opciones, composición SUMAR y vínculo opcional de variante en **una transacción**. Se conservan `/catalog/modifier-groups`, `/catalog/modifiers`, `PUT /catalog/variants/:id/modifier-groups` para clientes antiguos.
- Restricción deliberada: RESTAR/SUSTITUIR permanecen en REC-A editor avanzado, **no** en alta simplificada, para proteger ingrediente origen, conversiones y balance de materiales. Edición de un extra existente no permite marcar «requiere composición» sin crear ingredientes.
- Al navegar o cambiar variante, la UI avisa si hay un grupo sin guardar. Evita perder datos del formulario.

## 2. Entrega B — Receta de venta dentro de la ficha
Componente reusable `GcCatalogInlineRecipe`:
- Aparece tras crear un PREPARADO y también en el detalle de su presentación, sin cambiar de módulo.
- Muestra fórmula publicada actual (si existe) y ofrece «Crear nueva versión», no permite modificar una versión publicada directamente.
- Formulario de rendimiento, unidad UNIDAD, ingredientes (artículo físico, unidad, cantidad), merma opcional. Cantidades decimal strings (no JS floating point para persistencia).
- Crear receta y fórmula inicial: contrato existente `POST /api/recipes` con `version` y `publicar` opcional. Nueva versión `POST /api/recipes/:id/versions` con `publicar` opcional. La operación es atómica en servidor y requiere permiso `recipes.manage`; publicar requiere `recipes.publish`.
- Confirmación previa antes de publicación: cambios aplican a nuevas órdenes; órdenes ya aceptadas conservan versión e ingredientes congelados.
- `GET /api/recipes/versions/:id/preview`: consulta el consumo previsto y disponibilidad si la sucursal/ubicación permite cotizar; **no registra movimientos de Inventario**.
- El editor no ofrece receta para INVE/SERVICIO. El servidor valida unidades, conversión y reglas antes de permitir publicación. Si faltan datos se informa junto al formulario.
- Guardas de cambios pendientes para evitar descartar composiciones/recetas accidentalmente.
- Si se pierde la respuesta HTTP a una escritura, no reintentar automáticamente: comprobar versiones antes de repetir.

## 3. Core: cuándo se descuenta stock
- La UI **no** descuenta ingredientes al crear producto, extras o recetas.
- Al registrar la orden el backend congela `recetaVersionId` y la composición de modificadores; durante el flujo de preparación Cocina registra consumos vía `InventoryPostingEngine`.
- El consumo de PREPARADO toma cantidades/rendimiento y merma, conversiones de unidades y composición SUMAR/RESTAR/SUSTITUIR donde esté validada. No se reduce un litro como si fuera una pieza.
- Los grupos con consumo físico incompleto o incompatibles con producto inventariable/servicio deben bloquear `readiness` y publicación.
- Auditoría, permisos, stock real, lotes, FEFO e idempotencia de órdenes se mantienen.

## 4. QA manual
1. Categoría «Postres» en alta desde producto sin salir de página. Categoría avanzada con parent y orden, sin perder datos.
2. Grupo «Toppings» y opciones gratis/con recargo, una opción con 20g de crema. Confirmar en POS que se ofrece, cotiza y genera un consumo adicional solo cuando se procesa.
3. Grupo «Sin azúcar» usa editor avanzado RESTAR tras configurar receta base, no un flag de precio.
4. Preparado con 2 variantes, receta distinta por tamaño, ingrediente/unidad/rendimiento, publicación de una versión por variante.
5. Orden creada con versión N, editar a N+1: la orden anterior y su snapshot siguen intactos.
6. Validación cliente y servidor de cantidad cero, decimal de más de seis lugares, artículo/unidad incompatibles, ingrediente duplicado y merma inválida.
7. Permisos separados `catalog.manage`, `recipes.read`, `recipes.manage`, `recipes.publish`; no hay atajos.
8. Red interrumpida antes/después de guardar; verificar versiones en servidor antes de repetir.
9. Firefox zoom 90%, teclado, 390/768/1366 px, errores en `role=alert`, restaurar foco al cerrar compositores y guardas de salida.
10. Verificar disponibilidad de stock sin generar movimientos, después confirmar stock consumido al procesar en Cocina.
11. Contraejemplo: INVE + extra con consumo físico debe fallar el publish, nunca descontar ingredientes silenciosamente.

## 5. Archivos principales
- `src/app/features/catalog/components/catalog-quick-extra-editor.ts`
- `src/app/features/catalog/components/catalog-inline-recipe.ts`
- `src/app/features/catalog/data-access/catalog-r3-validation.ts` y `.spec.ts`
- `src/app/features/catalog/pages/catalog-extras-page.ts`
- `src/app/features/catalog/pages/catalog-categories-page.ts`
- `src/app/features/catalog/pages/catalog-product-detail-page.ts`
- `src/app/features/catalog/pages/catalog-product-guide-page.ts`
- `src/app/features/catalog/data-access/catalog.api.ts`
- `src/app/core/http/api-endpoints.ts`

## 6. Comandos para QA local
Desde el directorio Angular:
```powershell
git status
git fetch origin
git switch -c feat/catalog-r3-extras-recipe-composer-20261105 --track origin/feat/catalog-r3-extras-recipe-composer-20261105
npm start
```
Desde backend, seleccionar rama R3 del servidor:
```powershell
git status
git fetch origin
git switch -c feat/catalog-r3-extras-recipes-safe-20261105 --track origin/feat/catalog-r3-extras-recipes-safe-20261105
npm run start:dev
```
Cuando la rama exista localmente, reemplazar `git switch -c ... --track` por `git switch <rama>` y `git pull --ff-only`.

**R3-C pendiente:** constructor y vista visual de carta, reorganización de Precios como herramienta avanzada. No fue implementada aquí.
