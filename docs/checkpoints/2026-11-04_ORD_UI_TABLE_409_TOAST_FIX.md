# ORD-UI — Mesa ocupada, HTTP 409 y notificaciones visibles
Fecha: 2026-11-04
PR UI: https://github.com/CardonaSantos/new-project-angular-ui/pull/24
Base UI: `feat/payments-cash-ui-20261103`
Backend de referencia: `CardonaSantos/new-project@main`

## Reproducción
- Mesa 1: ocupación abierta y orden `ABIERTA`, cuenta `pagada`, comanda aún `PENDIENTE`.
- Antes de la corrección, `POST /api/tables/occupancies/:id/close` contestaba 409 y no aparecía toast, pese a que el backend enviaba un mensaje.
- Mensaje que emite `src/modules/orders/infrastructure/prisma/table.store.ts`: `Mesa con orden abierta: liquide o cancele la orden antes de cerrar`.

## Causa (backend, sin cambiar)
- `TableStore.close()` comprueba `tx.orden.count({where:{ocupacionMesaId:id,estado:'ABIERTA'}})`. Rechaza cualquier orden abierta; cuenta pagada no equivale a orden cerrada.
- `PaymentsStore.readyToSettle()` requiere líneas enviadas, cero comandas PENDIENTE/PREPARANDO y cuentas pagadas, además de otras reglas según modalidad.
- `PaymentsStore.settleTx()` marca la orden `CERRADA` y libera la ocupación si no quedan otras órdenes abiertas asociadas. No se debe forzar ni duplicar liberación desde Angular.
- `OrdersApi` aplicaba `gcSilentRequest()` a todas las operaciones, incluida la liberación. `gcApiErrorInterceptor` respeta `GC_SILENT_ERROR` y no emitía toast. El error solo se guardaba en un mensaje en la parte superior del tablero, potencialmente fuera de la vista.

## Ajustes de interfaz
1. `/orders/tables` muestra un aviso en la mesa ocupada con pedidos abiertos: primero terminar preparación y cerrar las órdenes. Se conservan los enlaces a cada orden y acceso a Cocina según permiso.
2. `Liberar mesa` queda desactivado mientras existan órdenes abiertas, y la acción contiene también un guard propio. Backend continúa siendo autoridad definitiva ante condiciones de carrera.
3. Cuando no haya orden abierta pero persista una ocupación, la acción solicita confirmación y llama al mismo `POST /api/tables/occupancies/:id/close`.
4. Las mutaciones ORD-A (POST/PATCH/DELETE) ya no usan el contexto silencioso; errores HTTP 4xx pasan por el interceptor global y se muestran en `GcNotificationCenter`. GET y consultas automáticas conservan contexto silencioso para evitar spam.
5. La liberación manual confirmada muestra toast de éxito, pero nunca se muestra si hay fallo en la API.
6. Sin cambios en permisos, DTOs, Prisma, estados, pagos ni reglas de inventario.

## Flujo de aceptación manual
1. Mesa 1 con orden `ABIERTA`/comanda `PENDIENTE`: se ve bloqueo explicativo. No puede dispararse POST de cierre de ocupación.
2. Abrir la orden y su preparación. Marcar comanda `LISTA` cuando realmente esté preparada (las acciones pueden consumir insumos).
3. En el detalle del pedido, con cuentas pagadas y sin cocina pendiente, **Cerrar pedido**. El backend libera automáticamente la ocupación si es el último abierto.
4. Volver a Mesas > Actualizar: Mesa 1 debe estar disponible; no debe necesitar el botón Liberar.
5. Para una ocupación que persiste sin órdenes abiertas, `Liberar mesa` debe habilitarse; probar confirmación, éxito y mensaje.
6. Probar conflicto simulado 409 en cualquier escritura ORD-A y confirmar toast con mensaje legible; no reintentar POST automáticamente.
7. Comprobar que un GET de lectura o polling fallido no genere avisos flotantes repetidos.
8. Probar tablet/móvil y roles; confirmar ausencia de acciones de administración sin permisos.

## Pruebas automáticas añadidas
- `orders.helpers.spec.ts`: selección de órdenes abiertas; no tratar `CERRADA` ni `CANCELADA` como bloqueo.
- `orders-notifications.spec.ts`: rechazo 409 de liberación visible en toast; lectura silenciosa; error POST de cocina visible.
- CI: lint, build y suite de Vitest en cabeza del PR. No dar por aprobado sin verificar el último SHA.

## Local
```powershell
git status
git fetch origin
git switch refactor/orders-ux-r1-20261104
git pull --ff-only origin refactor/orders-ux-r1-20261104
npm ci
npm start
```
