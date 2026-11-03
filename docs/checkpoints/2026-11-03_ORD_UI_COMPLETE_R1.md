# Gastro Core — ORD-UI R1 · Órdenes, POS, Mesas y Cocina
**Fecha:** 2026-11-03
**Repositorio Angular:** `CardonaSantos/new-project-angular-ui`
**Rama:** `feat/orders-pos-ui-20261103`
**PR:** https://github.com/CardonaSantos/new-project-angular-ui/pull/22 (draft)
**Base:** `refactor/organization-design-system-selects-20261103@518c20f`, entrega 3 PR #21, apilada sobre PR #20 y PR #19.
**Servidor verificado:** `CardonaSantos/new-project`, `main@5a864d9`; NestJS ORD-A, `src/modules/orders/presentation/http/orders.controller.ts` y DTOs.
**Backend:** sin cambios. **No fusionar en main** hasta validar los PR de las tres refactorizaciones y este módulo en orden.

## 1. Alcance y pantallas
| UI | Ruta | Funcionalidad |
|---|---|---|
| Inicio por rol | `/orders` | Cajero→POS, cocinero→KDS, mesas→Mesas, lectura→lista; nunca dirigir a pantalla que no le corresponde |
| POS | `/orders/pos` | Menú publicado, categorías, búsqueda, modo Mostrador/Mesas, variantes, extras obligatorios, notas, cantidades, descuento si hay permiso, carrito, precio preliminar, confirmación idempotente |
| Órdenes | `/orders/list` | Filtros sucursal/estado/modalidad, búsqueda, tabla y paginación |
| Detalle | `/orders/list/:id` | Totales reales, líneas, notas con control de versión, añadir/editar/cancelar líneas, envío a cocina, cancelación y cierre |
| Mesas | `/orders/tables` | Salas, mesas, ocupaciones y cuentas abiertas; crear/editar/desactivar sala o mesa, liberar ocupación con confirmación, tomar pedido en una mesa |
| Cocina | `/orders/kitchen` | Tarjetas KDS por estación/estado, polling de cambios, preparar comandas y cantidades parciales, marcar listas y entregadas |
| Configuración | `/orders/settings` | Crear/editar/desactivar estaciones con ubicación de consumo; crear/editar/eliminar rutas por variante/categoría y prioridad |

Se añadieron rutas lazy, pestañas de sección, entrada en menú lateral condicionada a permisos, componentes standalone `gc-pos-product`, `gc-pos-cart`, `gc-order-status`, `gc-kitchen-ticket`.

## 2. Endpoints ORD-A — **32/32 métodos HTTP**
| Subdominio | Métodos/rutas cubiertos |
|---|---|
| Órdenes (10) | `GET /api/orders`, `POST /api/orders`, `GET/PATCH /api/orders/:id`, `POST /api/orders/:id/lines`, `PATCH /api/orders/:id/lines/:lineId`, `POST /api/orders/:id/lines/:lineId/cancel`, `POST /api/orders/:id/send`, `POST /api/orders/:id/cancel`, `POST /api/orders/:id/close` |
| Mesas (7) | `GET/POST /api/tables/rooms`, `PATCH /api/tables/rooms/:id`, `GET/POST /api/tables`, `PATCH /api/tables/:id`, `POST /api/tables/occupancies/:id/close` |
| Cocina (15) | `GET/POST /api/kitchen/stations`, `PATCH /api/kitchen/stations/:id`, `GET/POST /api/kitchen/routes`, `PATCH/DELETE /api/kitchen/routes/:id`, `GET /api/kitchen/changes`, `GET /api/kitchen/tickets`, `GET /api/kitchen/tickets/:id`, `POST /api/kitchen/tickets/:id/start`, `POST /api/kitchen/tickets/:id/ready`, `POST /api/kitchen/lines/:id/start`, `POST /api/kitchen/lines/:id/ready`, `POST /api/kitchen/lines/:id/deliver` |

Client `src/app/features/orders/data-access/orders.api.ts`. Contract tests `orders.api.spec.ts` assert paths/methods/query and payloads for all 32 operations.

## 3. UX idiomática — reglas
- Desktop: productos y carrito simultáneos; tablet/móvil: catálogo flexible y carrito inferior; controles táctiles, navegación por teclado, labels claros y textos cortos.
- `GcSearchSelect` reutilizado: búsqueda integrada, opciones completas, seleccionados truncados, tema Cappuccino oscuro/claro.
- POS visual y compacto, Mostrador/Mesas, preferencia en `localStorage` **por usuario y sucursal** (no tokens ni permisos). Elegir una mesa no sobrescribe la preferencia Mesas.
- Detalle y KDS muestran frases legibles, no enums de DTO ni errores técnicos; decisiones especiales requieren confirmación.
- Cart: `claveOperacion` estable en reintentos con el mismo contenido. Bloquear modificaciones del pedido mientras se confirma. Los errores HTTP conservan el carrito.
- Importe **estimado** en UI; total real del backend. Cantidades monetarias y parciales se calculan con `decimal.js`, no con floats.
- Modal de modificadores con foco encerrado y Escape. Móvil con panel inferior, `prefers-reduced-motion`, responsive en CSS.
- KDS polling `/api/kitchen/changes` cada 7 s, con cursor; se pausa si la pestaña está oculta. No se inventaron sockets.

## 4. Reglas operativas validadas contra el backend
- `CreateOrderDto` admite `MESA`, `MOSTRADOR`, `PARA_LLEVAR`, `DELIVERY`. Mesa requiere `mesaId`, otras no.
- Si `exigeCobroAntesPreparar`, creación no envía automáticamente cocina, incluso si el operador pidió enviar; el UI explica el pago previo.
- Alta de órdenes, edición/adición de líneas, envíos y preparación parcial incluyen idempotencia. No cambiar claves en reintento de idéntico payload.
- Marcar listo/iniciar en KDS puede consumir ingredientes; se advierte antes de acciones que disparan consumo.
- Cancelar con ingredientes preparados requiere clasificación, motivo y permiso especial; cancelaciones de líneas con consumo real pueden rechazarse.
- Cerrar orden es transición en backend dependiente de Pagos/Caja; sin PAY-A UI no se simulan cobros ni se salta autorización.
- El menú publicado es disponibilidad **comercial**; la disponibilidad física y la receta se validan en backend al operar.
- `orders.read`, `tables.read`, `kitchen.read` se validan por separado de permisos de creación/gestión.

## 5. Checklist QA local antes de fusionar
- [ ] Firefox PC: `/orders` elige experiencia autorizada por rol. Navegar pestañas sin pérdida accidental.
- [ ] POS: cambiar Mostrador/Mesas, recargar y verificar persistencia; cambiar sucursal y comprobar que la preferencia no se hereda.
- [ ] POS: cambiar Tarjetas/Lista; búsqueda con `/` o `F2`, modificadores mínimo/máximo, nombre largo y Focus Trap.
- [ ] POS: crear pedido simple y con extras, comprobar importe definitivo en `/orders/list/:id`. Simular error 409/timeout, reintentar sin duplicación.
- [ ] POS: mesa desde `/orders/tables` abre carrito en contexto de mesa; mesa ocupada abre orden activa.
- [ ] POS: sucursal con `exigeCobroAntesPreparar=true`, pedido queda pendiente y sin envío automático de cocina.
- [ ] Órdenes: filtros, estados, versión concurrente 409, descuentos por permiso, cancelar, enviar y cerrar.
- [ ] Mesas: crear sala, mesa, editar, desactivar, ocupar/liberar solo cuando el backend lo permita.
- [ ] KDS: estaciones, rutas, nueva comanda, iniciar, cantidad parcial, listo, entrega; consumir stock solo donde lo autorice backend.
- [ ] KDS: cambios incrementales, reconectar/pestaña oculta, error de permisos, sin duplicar peticiones de mutación.
- [ ] Responsive 1366/1024/768/390 px; nombre largo, scroll, menú abierto, teclado y touch.
- [ ] Temas claro/oscuro; permisos cajero/mesero/cocinero/admin por sucursal.
- [ ] Probar pantallas reales con servidor NestJS y PostgreSQL. CI confirma contratos simulados, no la base de datos.

## 6. Entregas pendientes / dependencias
**PAY-A UI todavía no está construida.** La interfaz muestra cuentas pagadas pero el pago, división, cobro y cierre efectivo requieren conectar el módulo Pagos/Caja en su próxima entrega. Si el backend rechaza un cierre por pagos o preparación pendientes, el UI mostrará el error y no inventará un resultado.

**Estado R1:** implementación de todas las rutas ORD-A y UX responsiva, con CI automática; *draft* hasta validación con el operador.
