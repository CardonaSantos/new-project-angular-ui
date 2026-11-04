# Gastro Core — ORD-UI UX: entrega conjunta de POS, detalle, mesas y KDS

Fecha: 2026-11-04
Angular: `CardonaSantos/new-project-angular-ui`
Rama: `refactor/orders-ux-r1-20261104`
PR: https://github.com/CardonaSantos/new-project-angular-ui/pull/24 (draft)
Base: `feat/payments-cash-ui-20261103@83c3d06` (PR #23)

## Objetivo y contratos
Mejorar de una sola vez el módulo Órdenes ya funcional, según convenciones UX establecidas en Caja/Cobros/Ventas, sin reescribirlo ni alterar NestJS, Prisma, las validaciones/autoridad monetaria del backend ni los 32 endpoints integrados.

## Listado de órdenes (R1 previo, incluido en este PR)
- `/orders/list`: búsqueda explícitamente aplicada, filtros estables al paginar, 10/20/50 filas, refresco y limpieza, tarjetas móviles.
- `GET /api/orders` mantiene búsqueda, modalidad, estado, paginación y `meta.total` calculados por NestJS.

## POS
- `/orders/pos`: contador de líneas del pedido, cantidad de variantes encontradas, limpiar búsqueda del catálogo, búsqueda de mesa/sala, contadores de mesas ocupadas y disponibles, estado operativo de mesa.
- Resumen del pedido mejor organizado, importe estimado explícitamente identificado como *no definitivo*, acción Vaciar carrito con confirmación local sin realizar operaciones sobre órdenes del servidor.
- Confirmación de pedido mantiene DTO, `claveOperacion`, rutas a cobro y pedido; actualización de mesas ignora respuestas tardías de peticiones anteriores.
- Mantenimiento de guard de carrito sin guardar, atajos existentes y selector unificado.

## Detalle de orden
- `/orders/list/:id`: acción Actualizar, formulario de nuevos productos abierto solo bajo demanda, lectura y edición de observaciones diferenciadas.
- La edición de línea y la cancelación ahora se presentan en diálogos con foco atrapado, cierre por Escape y opciones de cancelar edición.
- Cancelación continúa requiriendo motivo, clasificación disponible, confirmación y autoridad de NestJS.
- Se evita sobrescribir detalles con respuestas de consulta obsoletas. No se altera la lógica de saldo, `version`, comanda ni cierre.

## Mesas
- `/orders/tables`: tablero operativo con totales de mesas, disponibles, ocupadas e inactivas; acceso a órdenes abiertas y toma de pedidos.
- `/orders/tables/manage`: **ruta independiente** para administrar salas y mesas con pestañas dedicadas, sin mezclar la edición administrativa con el tablero operativo.
- Se conservan los endpoints de salas, mesas y liberación, incluidas confirmaciones. Administración según `canTablesManage()`.
- Las mesas inactivas se identifican expresamente en el tablero.

## Cocina y configuración
- `/orders/kitchen`: actualización automática pausada/activada con control visible, tamaño de página 15/30/50, contadores por estados derivados **solo de los tickets cargados**, agrupación de listas pendientes y ya entregadas dentro del historial, protección contra respuestas tardías del detalle.
- Se mantiene diferencia estricta entre PREPARANDO, LISTA, y entregada por línea; no se introduce estado ficticio en el backend. Las operaciones que afectan inventario siguen requiriendo confirmación.
- Se corrige la sincronización reactiva de selección local de sucursal para no sobrescribirla con el contexto global.
- `/orders/settings`: estaciones y rutas en pestañas separadas, formularios mostrados únicamente al crear/editar, cancelación disponible, recuento de estaciones activas sin ubicación de ingredientes.

## QA pendiente antes de aprobar
- [ ] Verificar CI final del head del PR #24: npm ci, lint, build y test.
- [ ] POS: mostrador, mesa disponible/ocupada, buscar mesa, catálogo, grupos modificadores, descuento permitido, reinicio de carrito, error 409 de receta/precio/ruta, pedido real y enlace a cobro.
- [ ] Detalle: edición de cantidad/descuento/notas, motiva cancelación, nuevas líneas, envío a cocina, saldo, intento de cierre antes de pagar, cierre válido.
- [ ] Mesas: roles, salas, mesa ocupada/única orden abierta, liberar con validación, crear/editar/desactivar desde /tables/manage.
- [ ] Cocina: pendientes, preparando, listas, entregadas, parciales, comienzo/listo/entrega, estaciones, búsqueda y paginación con suficientes datos, polling activo y pausado.
- [ ] Estaciones/rutas: permisos, selector remoto, creación/edición/desactivación, prioridad, y errores de consumo.
- [ ] Firefox y Chrome: 1366, 1024, 768 y 390px; teclado, foco, modal, tema claro/oscuro.
- [ ] NestJS+Postgres de pruebas con inventario/recetas/precios verdaderos y permisos operativos.

## Límites conscientes
1. El backend de Órdenes no ofrece por ahora filtros de fechas/importes equivalentes a Ventas: no se inventaron.
2. `sortKitchenQueue` prioriza **solo los resultados de cada página del backend**, no todos los tickets globales; esto sigue requiriendo solución de backend si la cantidad supera la página. La vista activa consulta estados PENDIENTE y PREPARANDO separadamente y no supone una clasificación global estable entre ambos.
3. Ningún resultado de CI ni prueba con backend real debe darse por aprobado sin verificar su ejecución final.
4. Mantener PR en draft y la cadena #19 → #20 → #21 → #22 → #23 → #24 hasta QA y aceptación.

## Actualizar local
```powershell
git status
git fetch origin
git switch refactor/orders-ux-r1-20261104
git pull --ff-only origin refactor/orders-ux-r1-20261104
npm ci
npm start
```
Si no existe local: `git switch -c refactor/orders-ux-r1-20261104 --track origin/refactor/orders-ux-r1-20261104`.

Rutas a revisar: `/orders/pos`, `/orders/list`, `/orders/tables`, `/orders/tables/manage`, `/orders/kitchen`, `/orders/settings`.
