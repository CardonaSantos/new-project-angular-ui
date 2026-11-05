# Gastro Core — PAY-UI R3 · Ventas filtradas y comprobante de cierre
Fecha: 2026-11-04.

## Repositorios y dependencias
- Backend: `CardonaSantos/new-project`
  - Rama: `feat/sales-filters-pay-a-20261104`
  - PR borrador: https://github.com/CardonaSantos/new-project/pull/27
  - CI aprobada: https://github.com/CardonaSantos/new-project/actions/runs/41859043787
- Frontend Angular: `CardonaSantos/new-project-angular-ui`
  - Rama: `feat/payments-cash-ui-20261103`
  - PR borrador apilado: https://github.com/CardonaSantos/new-project-angular-ui/pull/23
  - Base PR #22 Órdenes (que a su vez sigue a PR #21-#19).
- **Ambos PR deben mantenerse sin fusionar mientras se realizan pruebas funcionales locales.**
- Ninguna migración de Prisma ni cambio de cálculo de saldo/caja.

## BACKEND: GET /api/sales ampliado (retrocompatible)
Query: `sucursalId` requerida, `page` 1.., `limit` 1..100, filtros opcionales:
- `search`: número parcial de **venta o pedido** (hasta 100 caracteres, insensible a mayúsculas/minúsculas).
- `desde` y `hasta`: fechas `AAAA-MM-DD` inclusivas, resueltas según `Sucursal.zonaHoraria` (DST incluido), con validación de fechas inexistentes, orden invertido y rango máximo de 367 días.
- `minTotal`, `maxTotal`: valores monetarios >=0 con máximo dos decimales, límite mínimo <= máximo.
- Prisma `VentaWhereInput` incluye necesariamente `sucursalId`, mismos criterios en `findMany` **y** `count`; orden más reciente con desempate ID.
- Se conserva autorización `sales.read`. Sale list incluye `cuenta.orden.numero` para mostrar pedido sin peticiones N+1.
- Pruebas: `src/modules/payments/domain/sales-filter.policy.spec.ts` y validaciones de `test/payments.e2e-spec.ts`.

## FRONTEND: Ventas R3
- `/payments/sales`: búsqueda por venta/pedido, fechas desde/hasta, filtro opcional por importe, selector de 10/20/50 filas.
- Búsquedas, filtros y conteos **en servidor antes de paginar**; no simular filtrado de la página actual.
- Grid compacto en PC/tablet; resultados como tarjetas con atributos de celda en móvil.
- Ver detalle abre **MatDialog** centrado, con scroll interno, foco y cierre accesible; no agrega un bloque al final de la página.
- Descripciones reales de `VentaLinea.descripcion` en vez del inexistente `nombreSnapshot`. Modal muestra descuentos, línea, cantidades, totales y pedido original.
- Validaciones locales de rangos/importe para mensajes útiles; backend conserva autoridad.
- El endpoint original sigue funcionando sin filtros para clientes antiguos.
- Tests `payments.api.spec.ts`: verifica serialización de fechas, importes, número y límite sin filtros vacíos.

## FRONTEND: cierre de caja y comprobante R3
- Después de `POST /api/cash/shifts/:id/close` se redirige a
  `/payments/cash/shift/:id/receipt`.
- Comprobante interno independiente, imprimible desde navegador, legible en escritorio y móvil.
- Muestra la caja, fecha de cierre, importe **esperado del servidor** (`efectivoEsperado`), efectivo declarado (`efectivoContado`), diferencia, fondo, entradas, salidas y nota.
- El importe contado NO se transfiere al nuevo turno: la apertura toma un `fondoInicial` explícito y separado. Un faltante no se oculta.
- Comprobantes consultables en el historial de turnos y en su detalle.
- La impresión aclara que NO es factura ni documento tributario.
- `payments.routes.spec.ts` cubre la ruta.
- Se preservan las reglas de idempotencia, permisos y conciliación financieras existentes.

## QA — validación local pendiente
1. Arrancar NestJS usando rama backend del PR #27 antes de activar filtros frontend. Mantener PostgreSQL de pruebas.
2. Arrancar Angular usando rama del PR #23.
3. Ventas: consultar sin filtros, buscar venta real por prefijo, buscar por número de pedido, filtrar día exacto y rango inclusivo.
4. Ventas: mínimo y máximo de total, 10/20/50 filas, cambiar página verificando total real, limpiar filtros.
5. Ventas: abrir detalle sin scrollear, revisar descripción de producto, precio, descuento y enlace a pedido.
6. Comprobar 390/768/1024/1366 px, teclado y tema claro/oscuro. Especialmente diálogo móvil y selector de página.
7. Caja: cerrar un turno de prueba: esperado Q66, contado Q64, diferencia −Q2; consultar comprobante e imprimir.
8. Abrir un nuevo turno con fondo Q50, comprobar que no arrastre Q64 contado ni diferencia.
9. Comprobar que pagos y caja siguen registrándose una sola vez (nunca usar pago real como prueba).
10. Roles: `sales.read`, `cash.read`, `cash.close`, accesos restringidos por sucursal.

## CI
- Backend CI aprobado en PR #27.
- Frontend comprobar último run del PR #23 tras merge de commits de R3.
- No se ha validado visualmente con navegador real desde esta herramienta; aceptación local sigue pendiente.
