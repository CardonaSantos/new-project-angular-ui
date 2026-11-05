# Gastro Core — Consolidación POS Express (UI #28 + UI #29)
**Fecha:** 2026-11-05  
**Rama principal:** `refactor/pos-orders-kds-express-ui-20261105` (PR UI #28); integra la historia de `feat/pos-orders-kds-express-ui-20261105` (PR UI #29) mediante merge de dos padres con resolución manual.  
**Backend obligatorio:** `CardonaSantos/new-project` PR #30 en `feat/pos-orders-kitchen-express-20261105`. Ambos son draft, sin fusionar a main.

## Decisiones de resolución
- Conservamos el flujo de UI #28 para POS, checkout, detalle por `ordenId`, mesas y Cocina, incluida protección ante carga asíncrona e intento de crear orden duplicada.
- Incorporamos de UI #29 la acción «Añadir productos» para mesas ocupadas y duración transcurrida de comandas, sin reemplazar los formularios accesibles ni la navegación de UI #28.
- Las órdenes existentes (con mesa o sin mesa) solo permiten **Añadir productos**. No se muestra ni ejecuta `quick-checkout` sobre una orden existente.
- La venta directa únicamente aparece en MOSTRADOR/PARA_LLEVAR, carrito INVENTARIABLE/SERVICIO, permisos `orders.create` y `payments.collect`; no en MESA/DELIVERY.
- Si hay productos nuevos sin guardar al cambiar de mostrador/mesa se exige confirmación. La modalidad de una orden existente se fija por el servidor y la UI no la cambia.
- En mesa ocupada se impide guardar hasta cargar la orden correspondiente. Si la carga falla se permite volver a intentar la misma mesa.
- No ofrecer «Cobrar ahora» tras una Venta Express ya pagada/cerrada.
- Se conserva el diálogo de cotización con desglose, la regeneración manual de precios y los atajos F2/F4; los reintentos de mutaciones usan claves estables y no son automáticos.
- En Cocina «Marcar lista» y «Lista y entregada» siguen separados. Se mantiene la vista de canceladas y se añade tiempo transcurrido.

## Contratos y calidad
- Solo consume los 7 endpoints Express de PR backend #30.
- Stock, precios, saldos, pagos, idempotencia y permisos finales se validan y ejecutan en NestJS.
- Sin cambios de Prisma ni migraciones.
- CI Angular: lint, build y tests deben aprobar el merge-HEAD.
- Pendiente de aceptación local: PostgreSQL real, caja abierta/cerrada, pagos/recetas, mesa ocupada, orden sin mesa, ramas y permisos cruzados, doble click y caídas de red, KDS, impresión 80 mm, móvil y accesibilidad.

## Comandos locales
```powershell
# Backend (en su repositorio)
git status
git fetch origin
git switch feat/pos-orders-kitchen-express-20261105
git pull --ff-only origin feat/pos-orders-kitchen-express-20261105
npm run start:dev

# Angular (en su repositorio)
git status
git fetch origin
git switch refactor/pos-orders-kds-express-ui-20261105
git pull --ff-only origin refactor/pos-orders-kds-express-ui-20261105
npm ci
npm start
```
Si la rama aún no existe localmente: `git switch -c <rama> --track origin/<rama>`.
