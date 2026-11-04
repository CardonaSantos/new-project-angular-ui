# Gastro Core — POS venta sin preparación + impresión térmica (2026-11-04)

**UI branch:** `feat/thermal-receipts-pos-ui-20261104`, basada en `feat/reports-dashboard-ui-20261104` PR #26. No merge.
**Backend:** `main@5a864d9b3b65efd874e5fda55841049a64192020`.

## Contratos y semántica comprobada

### Producto sin cocina
- `POST /api/orders` requiere una orden interna con líneas, independientemente de la preparación; la venta (Venta) se genera tras liquidar cuentas, por lo que una orden abierta **no equivale a una venta cerrada**.
- El payload incluye `enviarCocina` (default true). Es el proceso para TODOS los productos:
  - `PREPARADO`: exige receta publicada, enrutamiento a estación y crea `Comanda`.
  - `INVENTARIABLE`: exige variante/artículo asociados (unidad UNIDAD), consume stock con `ConsumptionStore.direct` al procesar, sin `Comanda`.
  - `SERVICIO`: se marca línea procesada, sin comanda.
- Si `enviarCocina=false`, hay líneas con `cantidadEnviada<can­tidad`; cierre/venta puede fallar con «Hay productos sin enviar».
- Si `config.exigeCobroAntesPreparar`, el procesamiento de la orden nueva se difiere hasta después del cobro; luego puede requerirse `POST /api/orders/:id/send`.
- POS detecta carrito exclusivamente INVENTARIABLE/SERVICIO desde el catálogo actual y fuerza `enviarCocina=true` para estos productos. La UI oculta el checkbox confuso y describe que no hay comanda.
- Con preparados se permite dejar pendiente; se avisa que debe procesarse desde detalle antes de cerrar.
- Tras crear, POS lee `cantidadEnviada` del servidor para distinguir «Pendiente de procesar» de «Procesada sin comanda», en lugar de presumir siempre una comanda.
- No se alteran contabilidad, recepción, cobros, stock ni NestJS.

### Comprobante interno de venta
- `/payments/sales/:id/receipt` consulta `GET /api/sales/:id`, disponible solo con `sales.read` y en sucursal activa. Se permite imprimir únicamente `Venta` ya registrada (no proforma ni carrito).
- Los importes son cadenas decimales del servidor, sin sumas cliente. `formatCurrency` para GTQ/USD solo si el API de configuración verifica la moneda. Si no, números agrupados SIN símbolo y aviso visible.
- Ticket no contiene medios de pago ni impuestos que el endpoint no suministra. Advierte con claridad **no es factura electrónica ni documento fiscal**.

### Comanda interna de cocina
- `/orders/kitchen/tickets/:id/print` consulta `GET /api/kitchen/tickets/:id`, permiso `kitchen.read`.
- Contiene orden, estación, fecha, mesa, líneas no canceladas, modificadores snapshots y notas.
- Desde Cocina/Detalle de orden/POS (si servidor creó comandas), enlace al formato impreso; no se imprime en automático.

### Impresora
- Papel previsto: **80 mm** en driver de Windows. La vista y el CSS de impresión están dimensionados en mm, tipografía monocroma, sin sidebar ni acciones al imprimir.
- `window.print()` abre el selector nativo de Firefox/Windows. No se usa WebUSB, dispositivos ESC/POS ni agentes locales; impresión silenciosa, apertura de gaveta y corte automático son opciones/funciones del driver, no garantizadas por Angular.
- Impresora térmica USB/network: seleccionar una cola instalada para 80 mm y ajustar márgenes a 0, escala 100%.
- Nunca se genera una factura fiscal desde cliente sin un servicio SAT/FEL aprobado.

## Checklist
- [ ] PR UI sobre PR #26; backend P2028 PR separado #29.
- [ ] Lint, build y tests de commit HEAD.
- [ ] POS: seleccionar SOLO INVENTARIABLE (p. ej. botella) y confirmar; no debe crear comanda, debe registrar salida de inventario al procesar, y debe poder cobrarse/cerrarse.
- [ ] POS: PREPARADO crea comanda; combinación de PREPARADO + INVENTARIABLE descuenta cada insumo exactamente una vez.
- [ ] POS: con exigeCobroAntesPreparar, verificar que mensaje diga pendiente y que el operador pueda procesar tras cobro.
- [ ] POS: con checkbox desmarcado en preparado, confirmación indica «Pendiente de procesar».
- [ ] Cocina: abrir comanda y botón «Imprimir comanda»; verificar extras, notas y estación en formato 80 mm.
- [ ] Ventas: abrir venta cerrada y «Imprimir comprobante»; revisar número, lineas, descuentos y total.
- [ ] Orden sin Venta: no mostrar comprobante de venta cerrada.
- [ ] Acceso de ventas/kitchen sin permiso: no exponer botón o respuesta.
- [ ] Impresión Firefox Windows: anchura 80 mm, sin botones/navegación, verificar control de corte en driver, reimpresión sin duplicar contabilidad.
