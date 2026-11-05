# UX POS compacto + impresión de pedido completo (2026-11-05)

**Rama:** `refactor/pos-orders-kds-express-ui-20261105`, Angular PR #28. Contrato backend PR #30 se mantiene.

## Causa verificada de botellas ausentes en comanda
En el backend `src/modules/orders/infrastructure/prisma/kitchen.store.ts` (método `sendTx`):
- `PREPARADO` se agrupa por estación y crea `ComandaLinea`.
- `INVENTARIABLE` se consume directamente por inventario y no genera `ComandaLinea`.
- La UI anterior cargaba `GET /api/kitchen/tickets/:id` e imprimía solo `comandaLineasComoComanda`. **No es una omisión de renderizado.**

## Cambios
- POS: «Ver detalles» y «Cobrar mesa» convertidos en botones compactos, con estilo primario en cobro; también «Pedido completo» y «Imprimir comanda» al haber orden/ticket.
- Buscador de catálogo, Tarjetas/Lista/Actualizar, barra de categorías y espacio del catálogo más densos.
- Nueva ruta `/orders/print/:id` para imprimir **pedido completo** en 80 mm: `GET /api/orders/:id`, todas las líneas no canceladas, modificadores, cantidades, mesa y observaciones, incluyendo botellas de agua y otros productos directos.
- Desde impresión de Cocina se ofrece enlace «Pedido completo (incluye botellas)», manteniendo la comanda de cocina estrictamente de preparación.
- Detalle de la orden y confirmación de nueva orden también tienen acceso a impresión completa.
- Control de permisos `OrdersAccess.canViewDetail()` y sucursal activa antes de exponer el pedido en la ruta de impresión.
- Sin alteraciones backend, base de datos, contabilidad, caja o semántica KDS.

## QA
- Probar mesa con capuchino y dos botellas: comanda de cocina muestra solamente capuchino, pedido completo imprime tres unidades, sin crear KDS para inventariables.
- Probar pedido con líneas canceladas, varias comandas, sin cocina, y usuario sin permisos.
- Probar layout POS en 390, 768, 1366 px y Firefox a zoom 90%.
- GitHub Actions lint/build/tests (incluye `printableOrderLines`).
