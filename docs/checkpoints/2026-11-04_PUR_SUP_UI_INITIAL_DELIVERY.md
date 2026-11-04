# Gastro Core — PUR/SUP UI: entrada de inventario y abastecimiento
Fecha: 2026-11-04
Branch Angular: `feat/purchases-supply-ui-20261104`
PR (draft): https://github.com/CardonaSantos/new-project-angular-ui/pull/25
Base PR #24: `refactor/orders-ux-r1-20261104@29d1444d72c882ddc0195bbd3a263993068e02d8`
Backend contractual: `CardonaSantos/new-project@main@5a864d9b3b65efd874e5fda55841049a64192020`

## Intención UX
El operador no debe aprender tecnicismos ni mezclar ajustes de inventario, recepciones, ventas, cocina y requisiciones. Pantallas independientes; acciones visibles según permisos; formularios compactos, selectores buscables, validaciones locales y mensajes del servidor.

## Dos rutas de ingreso, totalmente distintas
**Entrada rápida** `/purchases/quick`
- `POST /api/inventory/operations/inbound` (no llama Compras).
- Requiere `inventory.adjust` + `inventory.costs.manage` sobre sucursal.
- Artículo, almacén, ubicación, lote según configuración, cantidad positiva en unidad base, costo por unidad base, motivo y clave idempotente.
- Confirmación visual previa; backend genera inmediatamente `AJUSTE_ENTRADA` y modifica existencias/Kardex.
- Permite crear artículo `POST /api/inventory/articles` y lote `POST /api/inventory/lots` si el usuario tiene permiso **global** `inventory.articles.manage`.
- No confundir «entrada rápida» con recepción documentada de proveedor.

**Recepción documentada** `/purchases/receipts/new`
- `POST /api/purchases/receipts` o `PUT /api/purchases/receipts/:id` deja el documento en BORRADOR; todavía no suma stock.
- «Guardar e ingresar stock» encadena creación/edición seguida de `POST /api/purchases/receipts/:id/confirm`, solo si tiene `purchases.receipts.confirm`.
- Si la confirmación falla después de guardar, el borrador persiste y se abre su detalle para reintentar; no se atribuye ingreso.
- Detalle `/purchases/receipts/:id`: modificar y cancelar solo BORRADOR; confirmación irreversible que crea movimientos tipo COMPRA.
- Filtrar y paginar en servidor por sucursal/proveedor; **no inventar** búsqueda por número/fecha no soportada.
- Proveedor/almacén/artículo/ubicación obligatorios; directo sin OC exige referencia o motivo.
- Lotes y caducidad condicionales; unidad base por defecto (factor 1); comprar por caja requiere presentación activa y compatible con proveedor/factor.
- Permite alta contextual de artículo y proveedor (solo cuando autorizado) sin perder el resto del formulario.
- Para compra contra OC, `ordenCompraId` y `ordenCompraLineaId` obligatorios y deben coincidir exactamente con proveedor, sucursal, precio/impuestos y factor de la orden.

## UI restante
- `/purchases/suppliers`: directorio, búsqueda y paginación reales, alta y edición compacta, activación/desactivación conforme a permisos.
- `/purchases/orders`, `/purchases/orders/new`, `/purchases/orders/:id`: catálogo de órdenes; creación con varias líneas; confirmación, cancelación, cierre; acceso a recepción de pendientes.
- `/purchases/presentations`: cajas/paquetes y factores registrados; crear/desactivar (backend no expone PATCH de edición).
- `/purchases/requisitions` y `/:id`: crear solicitud a almacén, ver cantidades solicitadas/recibidas/en tránsito/pendientes; consultar disponibilidad de otro almacén; enviar insumos o realizar transferencia inmediata (con permisos de origen y destino); enlace a compra del faltante.
- `/purchases/transfers/:id`: recibir total/parcial según pendiente; no se registra recepción antes de `POST /api/supply/transfers/:id/receive`.
- `/purchases/orders/new?requisitionId=id`: creación vinculada mediante `POST /api/supply/requisitions/:id/purchase-draft` con validación de faltantes comprometidos.

## Garantías backend
- El Inventario se alimenta por `InventoryPostingEngine.post`. Sin bypass de costos, lotes, movimientos, permisos, idempotencia, compras activas ni requisiciones.
- Una OC CONFIRMADA no es una recepción; no suma stock.
- Una recepción COMPRA confirmada registra movimientos atómicos por línea y no se edita/cancela después.
- Una requisición con faltante comprado no se marca atendida hasta recepción en **almacén destino de requisición**.
- Comandas PREPARADO consumen ingredientes al iniciar preparación (`kitchen.store.ts` → `consumption.store.ts`), verificando versión de receta publicada y ubicación de consumo de estación. Las existencias en otro almacén o ubicación no cuentan para esa receta.
- Crear un artículo no suma existencias. No usar el costo de referencia como costo real de entrada.

## UI/DS
- Reutiliza `GcInventoryPicker`, `GcSearchSelect`, `ConfirmDialogService`, `GcNotificationService`, guard `gcUnsavedChangesGuard`, `GcBranchContext` y validadores decimales sin conversión por número JS.
- Contratos tipados y todas las mutaciones PUR/SUP pasan por interceptor de errores visible; lecturas automáticas son silenciosas.
- Paneles separados por tarea y campos avanzados ocultos bajo `details`; móvil usa tarjetas en listados en vez de columnas comprimidas.

## QA obligatorio antes de merge
- [ ] CI en el HEAD final: `npm ci`, lint, build y Vitest.
- [ ] Entrada rápida: artículo inexistente / creación / lote / fecha / costo cero / incremento de stock / Kardex / repetición de clave.
- [ ] Recepción: guardar BORRADOR sin stock; guardar y confirmar con stock; rechazo de lote, factor, impuesto o ubicación; fallo entre crear y confirmar sin duplicar documento.
- [ ] Recepción vinculada a OC confirmada, con pendiente parcial; impedimento de sobre-recibir.
- [ ] Proveedor inactivo, permisos globales y de sucursal, controles de costo, duplicados y 409.
- [ ] Requisición con envíos inmediatos y en tránsito, recepción parcial/final, compra comprometida sin doble cobertura.
- [ ] Vista accesible, teclado, tab order, contrate claro/oscuro, 1366/1024/768/390px.
- [ ] Probar real NestJS+PostgreSQL, no declarar validado solo por mocks.

## Local
Primera vez:
```powershell
git status
git fetch origin
git switch -c feat/purchases-supply-ui-20261104 --track origin/feat/purchases-supply-ui-20261104
npm ci
npm start
```
Si la rama ya existe local:
```powershell
git fetch origin
git switch feat/purchases-supply-ui-20261104
git pull --ff-only origin feat/purchases-supply-ui-20261104
npm start
```
Rutas: `/purchases`, `/purchases/quick`, `/purchases/receipts`, `/purchases/suppliers`, `/purchases/orders`, `/purchases/presentations`, `/purchases/requisitions`.
