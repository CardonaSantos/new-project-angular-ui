# Gastro Core — R3-C / Checkpoint UI y cierre funcional del Catálogo

**Fecha:** 2026-11-05.
**Rama acumulativa:** `feat/catalog-r3-c-visual-menus-ui-20261105`, [PR #34](https://github.com/CardonaSantos/new-project-angular-ui/pull/34), contiene R1 + R2 + R3-A/B + R3-C.
**Servidor requerido:** `feat/catalog-r3-c-menu-editor-readiness-20261105`, [PR backend #33](https://github.com/CardonaSantos/new-project/pull/33), contiene R2+R3-A/B+C.
**Estado:** PRs draft / QA manual pendiente. main **no** modificado.

## R3-C implementado
- Editor de cartas: secciones visuales con nombre, botones **Subir sección/Bajar sección/Quitar sección**, filas por presentación **Subir/Bajar/Quitar/Mover a sección** (sin depender de arrastrar y soltar).
- Selector reusable `GcCatalogMenuProductPicker`: búsqueda por nombre, filtro en servidor por `categoriaId`, presentaciones de cada producto con casillas, selección múltiple y acción contextual «Agregar N presentaciones». Persistencia de selección entre filtros y deduplicación en el borrador; errores en `role=alert` y controles de 44px.
- Vista rápida del **borrador** dentro del editor, claramente identificada como borrador sin precio confirmado. La **carta publicada real** se consulta desde «Vista de la carta».
- Vista publicada: tarjetas con imagen del producto, variante, precio de servidor, secciones, accesos directos y detalles nativos desplegables para extras. No presenta datos hardcodeados y no mezcla borrador con proyección POS.
- Panel de publicación: `Revisar requisitos` y `Guardar y publicar carta`; el último **siempre** llama a `validate` con borrador y versión actual antes de confirmar. El servidor R2 `commit` vuelve a validar transaccionalmente.
- Problemas legibles por producto/variante/sucursal, acción «Corregir producto» contextual, protección al concurrir, no pierde la publicación previa.
- «Guardar solo borrador» y «Retirar carta publicada» siguen disponibles bajo «Otras acciones de publicación», explícitas para evitar retirar del POS accidentalmente.
- Navegación: «Cartas» y «Vista de la carta» en acceso principal; «Tarifas e historial de precios» pasa a «Más opciones», sin eliminar ruta `/catalog/prices` ni sus endpoints.
- Listado de cartas con tarjetas y acciones legibles «Editar carta» y «Ver carta publicada».
- CSS específico y global para builder y preview, estilos locales para picker para evitar el error previo de encapsulación de Angular. Controles con texto y tamaño mínimo 44px, responsive/teclado/foco visible.

## API y dependencias
- `GET /api/catalog/products/options?search=&categoriaId=&limit=50`, implementado por backend R3-C.
- `POST /api/catalog/menus/:id/validate` no mutante, con `CatalogMenuLayout`.
- `POST /api/catalog/menus/:id/commit` atómico heredado de R2.
- Proyección `GET /api/catalog/menu?sucursalId=&fecha=` heredada de CAT-A, es la única fuente para la vista publicada.
- Rutas previas y página histórica de precios se conservan, sin migraciones ni cambios de stock.

## QA obligatorio antes de main
1. Búsqueda por categoría y nombre, seleccionar varios tamaños, agregar todos una sola vez, quitar/reordenar/mover, mantener foco y edición sin recarga.
2. Crear sección, escribir nombre, agregar productos, ver borrador; prevenir eliminación accidental de secciones con productos.
3. Acceder a «Revisar y publicar» desde el encabezado sin buscar acciones abajo; revisar problemas de receta, foto, precio, extra, stock físico por sucursal.
4. Intentar publicar borrador incompleto: mensaje entendible; publicar correctamente tras corregirlo; confirmar que la carta anterior sigue visible si falla.
5. Vista publicada con foto/fallback, variante, precio GTQ, grupos de extras colapsados inicialmente; cambiar sucursal/fecha y comprobar vigencia.
6. Verificar «Tarifas e historial» a través de Más opciones, ruta directa guardada y permisos.
7. Teclado Tab, Shift+Tab, Enter, Espacio, foco y etiquetas; 390/768/1366px al 80 %, 100 % y 200 % zoom; sin scroll horizontal innecesario, botones >=44px.
8. Pérdida de respuesta HTTP: confirmar versión/publicación antes de repetir cualquier mutación, sin reintentos automáticos.
9. Dos sesiones editando carta; versiones antiguas 409 sin sobreescritura.
10. Pedido POS y Cocina con receta real: no se cambió cálculo de stock por refactor UI.

## Local
Desde directorio Angular:
```powershell
git status
git fetch origin
git switch -c feat/catalog-r3-c-visual-menus-ui-20261105 --track origin/feat/catalog-r3-c-visual-menus-ui-20261105
npm start
```
Desde backend:
```powershell
git status
git fetch origin
git switch -c feat/catalog-r3-c-menu-editor-readiness-20261105 --track origin/feat/catalog-r3-c-menu-editor-readiness-20261105
npm run start:dev
```
Si la rama local ya existe: `git switch <rama>` y `git pull --ff-only origin <rama>`.

**Pendiente** QA visual local y funcional PostgreSQL. Las CI no sustituyen estos escenarios ni autorizan merge automático. Para volver a main en una entrega posterior, revisar el orden de PRs apilados y evitar merges duplicados.
