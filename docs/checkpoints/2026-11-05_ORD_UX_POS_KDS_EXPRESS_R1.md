# Gastro Core — ORD-UX Express R1 (Angular 22, 2026-11-05)

**Angular:** `CardonaSantos/new-project-angular-ui`, PR #29 (draft), rama `feat/pos-orders-kds-express-ui-20261105`, apilada en `feat/thermal-receipts-pos-ui-20261104` / UI PR #27.
**Backend requerido:** `CardonaSantos/new-project` PR #30 (draft), rama `feat/pos-orders-kitchen-express-20261105`. No probar los nuevos endpoints con `main` del servidor hasta fusionar #30. Ambos PR permanecen sin merge.

## Convenciones
- UI basada en patrones operativos habituales (ventas rápidas, carrito fijo, KDS y mesa), no en reproducción de una marca.
- Mantener Cappuccino/DS, modales accesibles con `CdkTrapFocus`, avisos `role=status` y `role=alert`, acciones primarias claras, pantallas responsivas.
- Todos los importes definitivos llegan de NestJS en cadenas decimales; no usar números JavaScript para contabilidad.
- Mantener permisos, sucursales, autorizaciones de tarjetas, cargos de caja, idempotencia, sin llamadas POST automáticas de reintento.
- No mezclar «lista», «entregada» y «cobrada». La caja sigue calculando sus propias cifras.

## Cambios UI
### POS `/orders/pos`
- Carrito y catálogo siguen visibles. Para carrito exclusivo de productos `INVENTARIABLE` y `SERVICIO` de mostrador/para llevar: acción destacada «Cobrar», abre diálogo integrado de `gc-pos-express-checkout` en vez de navegar por 2+ páginas.
- El diálogo consulta `POST /api/orders/quote` con líneas y modificadores para conocer subtotal/total autoritativo y moneda; no reserva inventario. Obtiene turno del cajero de `CashContext` y requiere Caja abierta. Efectivo recibido y vuelto, tarjeta con autorización externa y Otro con referencia. Transferencia no se permite por no estar confirmada; se usa PAY-A normal.
- Confirmar usa `POST /api/pos/quick-checkout` con `claveOperacion` fija para el mismo contenido y en reintentos tras fallos. Si servidor devuelve `ventaId`, muestra toast y acceso a comprobante interno 80 mm / nueva venta, vacía carrito SOLO tras confirmación real. Si hay error, deja carrito intacto y alerta visible.
- Una cotización pertenece al carrito y sucursal exactos; si cambian se bloquea confirmación. Escape y botón Cerrar; foco retenido; diálogo usable por teclado y táctil.
- Al seleccionar una mesa ocupada, `GET /api/orders/:id` obtiene la orden real y deja agregar productos con el mismo carrito; `POST /api/orders/:id/lines` sin crear otra orden. Productos actuales y toppings visibles dentro de `details`; cobro existente accesible.
- Si hay carrito de mesa activo, se bloquea cambiar accidentalmente de mesa/contexto sin guardar; si el carrito se armó antes de elegir mesa, se conserva para la mesa elegida.
- Productos preparados y mesas mantienen el flujo normal con «Confirmar pedido»; no se usa `quick-checkout` para esos casos.

### Órdenes y Mesas
- En listado de órdenes abiertas, `GET /api/orders/worklist` trae saldos y resumen del progreso en una sola página server-side; estados históricos usan `GET /api/orders` existente.
- Órdenes de mesa abierta ofrecen acceso «Añadir productos» directo al POS en la mesa correspondiente.
- Tablero de Mesas ofrece «Añadir productos» en mesa ocupada sin navegar antes al detalle. Restricciones de liberar mesa con órdenes abiertas se mantienen.

### Cocina
- `GET /api/kitchen/queue` para filtros por estación/sucursal/estado, ordenación global y conteos auténticos; no suma dos páginas paginadas y no inventa prioridades.
- Tabs: Por preparar, Listas para entregar, Entregadas, Todas. Tickets incluyen elapsed time en minutos (actualiza cada 7 segundos).
- Acción «Marcar lista» separada de «Lista y entregada» tanto en tarjetas como diálogo; para la segunda se confirma entrega física y usa `POST /api/kitchen/tickets/:id/ready-deliver` o línea `/api/kitchen/lines/:id/ready-deliver` de manera **atómica**. Un solo POST, clave estable por intención para reintento.
- Mostrar en toast respuesta correcta; error no se borra al refrescar la cola. Modificadores y notas visibles como snapshots.

### Cobros
- En `/payments/order/:id`, si una única cuenta tiene saldo a cobrar completo, no hay transferencias pendientes y existen líneas sin procesar: acción «Cobrar y enviar a Cocina», `POST /api/orders/:id/pay-and-send`, una transacción para pago y despacho. Mantiene formulario complejo original para abonos, transferencias y cuentas divididas.
- No indica «cerrada» cuando se paga y faltan comandas o entrega.

## QA local
- [ ] NestJS en rama PR #30, Angular en rama PR #29, PostgreSQL real; CI verde en heads correctos.
- [ ] Ventas mostrador INV/servicio: precio server, Caja abierta, efectivo exacto, recibido mayor -> vuelto, saldo/Kardex/venta única, sin KDS.
- [ ] Crear venta directa con Caja cerrada: no permitir; dar enlace a Caja.
- [ ] Simular error de red tras confirmación, reintentar con misma clave sin duplicar stock/pago/venta; no vaciar carrito ante error.
- [ ] Tarjeta sin autorización y Otro sin referencia bloqueados; transferencias solo Cobros normal.
- [ ] Preparado + toppings: POS envío a KDS y notas, sin quick-checkout.
- [ ] Mesa ocupada: abrir directamente, ver líneas actuales y toppings, añadir una línea, verificar mismo ID y nuevas comandas sin duplicar.
- [ ] Alternar mesa/modo con carrito no pierde pedido ni envía líneas a contexto incorrecto.
- [ ] Worklist: importe/saldo desde servidor y búsqueda paginada; estados cerrados/cancelados via ruta histórica.
- [ ] KDS >30 comandas: cola global y totales consistentes; cambiar estación y sucursal sin datos cruzados.
- [ ] «Marcar lista» NO crea evento de entrega; «Lista y entregada» sí y una sola vez; pruebas con ticket parcialmente preparado.
- [ ] Cobrar y enviar en sucursal con pago-antes-de-preparación: saldo completo, turno válido, cocina pendiente; cierre no adelantado.
- [ ] Cobros con partes/transferencias no cambian comportamiento.
- [ ] Formatos GTQ, vista móvil 390px, tableta 768px y escritorio 1440px, Firefox, zoom 80–125%, lector de pantalla, teclado F2 y Escape, modo claro/oscuro.

## Comandos locales
Primera vez:
```powershell
git status
git fetch origin
git switch -c feat/pos-orders-kds-express-ui-20261105 --track origin/feat/pos-orders-kds-express-ui-20261105
npm ci
npm start
```
Si ya existe:
```powershell
git fetch origin
git switch feat/pos-orders-kds-express-ui-20261105
git pull --ff-only origin feat/pos-orders-kds-express-ui-20261105
npm start
```
**Servidor:** PR #30 rama `feat/pos-orders-kitchen-express-20261105`. Mantener cambios locales no versionados antes de cambiar de rama; no hacer `reset --hard`.
