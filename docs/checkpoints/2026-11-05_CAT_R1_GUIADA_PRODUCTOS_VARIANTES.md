# Gastro Core CAT-R1 — Alta guiada producto + variantes + precios

**Fecha:** 2026-11-05
**Rama:** `feat/catalog-guided-product-ui-r1-20261105` (desde UI main @ 2fbbf50).
**Backend:** main @ a6eaab6 (sin cambios).

## Cambios de la entrega R1
- Ruta actual `/catalog/products/new` sustituye el antiguo formulario separado por un alta guiada accesible.
- Un solo formulario solicita nombre, tipo (PREPARADO / INVENTARIABLE / SERVICIO), categoría opcional, descripción y código generado que puede editarse.
- Categoría creable y seleccionable desde el formulario sin abandonar el alta.
- Presentaciones juntas, con acción de Pequeño/Mediano/Grande, datos dinámicos por tipo.
- `INVENTARIABLE` exige artículo de inventario activo de tipo PRODUCTO_TERMINADO por variante. PREPARADO y SERVICIO no muestran este selector.
- Precio contextual en la sucursal seleccionada únicamente si hay `catalog.prices.manage`. Precio vacío = sin precio, no tarifa cero inventada.
- `POST /api/catalog/products` incluye `variantes[]`, operación **atómica ya existente** de NestJS.
- Si se introducen precios, se registran secuencialmente con el endpoint individual existente. El producto persistido se conserva, se registran resultados individuales, y un fallo deja acciones de revisión sin reintento automático. El batch atómico se reserva para backend R2.
- Pantalla posterior con enlaces por variante a recetas de venta (mediante `?varianteId=`), fotos, extras, precios y menús. No declara publicación automática de producto ni carta.
- El editor avanzado de productos existentes `/catalog/products/:id` queda intacto, al igual que el historial de precios y las recetas versionadas.
- Validación pura y pruebas unitarias para códigos, variantes múltiples, vínculo físico, precio decimal y duplicados.
- No se añadieron migraciones, endpoints ni cambios a backend o al POS.

## Límites intencionales
- **R2:** revisión real de receta y estación en readiness, publicación/actualización de menú sin estado intermedio despublicado y precios batch.
- **R3:** creación integral de receta y asignación al menú dentro de la ficha, fotos/extras inline y vista previa de POS.
- Las solicitudes HTTP mutantes nunca se reintentan automáticamente. Si se pierde la respuesta a la creación, revisar el listado antes de repetirla.
- Sin permisos de gestión de precios se crea el producto sin precio; configuración posterior requiere usuario autorizado.
- El diagnóstico de readiness actual todavía no revisa receta publicada; la UI no debe presentar el alta como producto ya vendible.

## QA manual pendiente
1. PREPARADO con tamaños Mediano/Grande y precios distintos -> un solo producto, dos variantes, enlaces a recetas.
2. INVENTARIABLE sin artículo físico no permite guardar; vinculando PRODUCTO_TERMINADO sí permite.
3. SERVICIO no solicita artículo físico ni receta.
4. Código generado con acentos/espacios, edición manual, categoría nueva en contexto.
5. Precio mal formado y variante repetida generan mensajes entendibles sin perder lo escrito.
6. Probar roles con `catalog.manage` pero sin `catalog.prices.manage`; verificar sucursal y estado de precios.
7. Pérdida de respuesta del producto y fallo al crear el segundo precio; no duplicar producto.
8. Verificar pantalla a 390/768/1366 px, 90% zoom, teclado, NVDA/VoiceOver y estados de error.

## Local
```powershell
git status
git fetch origin
git switch feat/catalog-guided-product-ui-r1-20261105
git pull --ff-only origin feat/catalog-guided-product-ui-r1-20261105
npm ci
npm start
```

**No fusionar a main antes del QA visual/local.**
