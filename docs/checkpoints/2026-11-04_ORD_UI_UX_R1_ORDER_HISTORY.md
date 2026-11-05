# Gastro Core — ORD-UI UX R1: listado de órdenes
Fecha: 2026-11-04.

## Dependencias y protección
- UI: `CardonaSantos/new-project-angular-ui`, rama `refactor/orders-ux-r1-20261104`, a partir de `feat/payments-cash-ui-20261103@83c3d06` (PR #23, draft).
- Backend: `CardonaSantos/new-project` sin modificaciones; filtros de Ventas del PR #27 siguen separados.
- Mantener este PR apilado sobre #23 y en borrador hasta revisión local.
- Sin cambios en `Prisma`, cobros, caja, consumos de cocina, estados ni mutaciones monetarias.

## Problemas detectados y solución R1
1. El listado de Órdenes reutilizaba el texto aún no aplicado al cambiar la página. Separamos la búsqueda editable (`search`) de `appliedSearch` para que Buscar o Enter establezcan el filtro de servidor. Cambiar página, estado o modalidad conserva la última búsqueda aplicada.
2. Las páginas estaban limitadas a 20 filas sin configuración. Se añaden 10, 20 y 50 filas por página; al cambiar el límite se reinicia a página 1.
3. Se añaden Actualizar y Limpiar filtros sin duplicar búsquedas o redefinir el contrato.
4. La tabla de escritorio sigue mostrando número, tipo, fecha, importe, estado y acciones. En pantallas estrechas (<=640 px) cada fila pasa a una tarjeta vertical etiquetada; no se comprimen seis columnas ni se altera el orden.
5. `GET /api/orders` sigue enviando `sucursalId`, `search`, `estado`, `modalidad`, `page`, `limit`. Los filtros y el total dependen exclusivamente de NestJS.
6. Se protege el resultado de peticiones anteriores mediante generación y comprobación de sucursal; el selector de sucursal global no debe sobrescribir una selección local de forma reactiva accidental.

## Fuera de alcance
- No se añaden filtros de fechas/importes a Órdenes: el DTO `OrderListDto` actual no los contempla. Si hacen falta, primero se diseña la extensión del servidor, filtrando antes de paginar y respetando la zona horaria, como en Ventas.
- El detalle, POS, Mesas, KDS y configuración quedan para revisiones R2/R3; no se declaran refactorizados por los cambios de esta R1.

## QA
- [ ] CI lint, build y tests (incluyendo query paginada).
- [ ] Con NestJS/PostgreSQL de pruebas: buscar por número, Enter, cambiar página sin aplicar nuevo texto, filtrar estado/modalidad, limpiar.
- [ ] Comprobar 10/20/50 y conteo real `meta.total`, cambio de sucursal y respuestas asíncronas.
- [ ] Revisar 1366/1024/768/390 px, tema claro/oscuro, navegación con teclado y enlaces al cobro.
- [ ] Realizar aceptación visual y funcional antes del merge.

## Próxima revisión
- POS y detalle: distribución catálogo-carrito, información comercial, continuidad al cobro, notas y formularios secundarios según responsabilidades.
- Mesas: tablero operativo y gestión de salas/mesas separada visualmente.
- Cocina: cola de preparación y de entrega, prioridades, estados y control de inventario por transición.
