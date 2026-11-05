# Gastro Core — REP-A Dashboard + Analítica Angular (2026-11-04)

**UI:** `CardonaSantos/new-project-angular-ui` rama `feat/reports-dashboard-ui-20261104`, apilada sobre `feat/purchases-supply-ui-20261104` PR #25 (no merge).
**Backend fuente:** `CardonaSantos/new-project@main@5a864d9b3b65efd874e5fda55841049a64192020`.
**Sin cambios a NestJS o Prisma.**

## Contratos backend verificados
- `GET /api/reports/operational/dashboard?sucursalId`: `freshness=LIVE_READ`, `generatedAt`, 8 indicadores operativos (pedidos abiertos, comandas pendientes/preparando, mesas ocupadas, entregas en reparto, reservas próximas 120 min, cajas abiertas).
- `GET /api/reports/analytics/overview?sucursalId&periodo=DIA|SEMANA|MES|PERSONALIZADO[&fecha][&desde&hasta]`: `currency`, `periodo` con `horaCorte` y zona IANA, `kpis` monetarios como strings decimal, `serieDiaria` con ventas, cobros, reembolsos, gastos, tickets, por fecha operativa. 366 días máximo.
- `GET /api/reports/analytics/payments-by-method`: EFECTIVO/TARJETA/TRANSFERENCIA/OTRO, bruto, reembolsos, neto y cantidad por método.
- `GET /api/reports/analytics/expenses-by-category`: categorías/tipo con montos y número de registros.
- `GET /api/reports/analytics/tickets`: ventas cerradas, paginación real por servidor.
- `GET /api/reports/analytics/cash-shifts`: turnos y arqueos, paginación real y diferencia nullable.
- `GET /api/reports/analytics/sources/:source`: 15 fuentes domain-specific, permisos adicionales específicos; SALES_LINES trae `porProducto`, `porCategoria`, `porVariante`, `porModalidad` para desgloses.
- `GET /api/reports/analytics/exports/:source?format=CSV|XLSX|PDF`: binario generado y auditado en servidor; máximo 1000 filas (límite de bytes/PDF también). Se descarga el blob sin reconstruir informes con datos parciales.

## Navegación
- `/workspace`: dashboard operativo, accesos directos según permisos, indicadores en vivo y ventas/cobros/gastos del día operativo. Sin `reports.read`, solo accesos permitidos y mensaje de permisos.
- `/reports`: filtros, resumen KPI, gráficas accesibles con tablas de datos, tickets, arqueos y fuentes detalladas/exportación.
- Todos los elementos de sidebar usan iconos Lucide independientes y con `aria-hidden`, conservando etiquetas visibles y de lector; el acceso a Analítica exige `reports.read`.

## Reglas de negocio
- Ventas (cierre de Venta), cobros (fecha de Pago), reembolsos (fecha de Reembolso), gastos (fecha de registro): no sumar ni restar familias distintas como caja/utilidad ficticia.
- `margenBruto` y `resultadoNeto` son null en el resumen, por lo que mostrar **No disponible**.
- `ticketPromedio` null cuando no hay tickets, no se transforma a cero.
- `diferenciaCajaCerrada` null si no hay cierres o hay arqueos incompletos, no se presenta como Q0.
- Se toma la fecha operativa, corte y zona de sucursal del servidor; no se intenta interpretar "DIA" como medianoche del dispositivo local.
- Moneda `GTQ`: Q 1,234.56, `USD`: US$ 1,234.56. Decimal strings preservados (Decimal.js) en totales; Number solo para proyecciones de gráficas, nunca para cálculo de importes.
- Las 15 fuentes requieren permiso `reports.read` y permisos de la fuente; SANITIZED scalar projection evita mostrar IDs internos o serializar JSON personal/sensible en tablas genéricas.
- Lecturas no disparan toasts masivos; cada panel presenta errores recuperables. Datos entre sucursales y actualizaciones tardías se descartan por generación.
- ECharts/ngx-echarts ya están en package.json, no hay nuevas dependencias.

## Checklist de QA local
- [ ] Sidebar: iconos adecuados y accesibles con estado colapsado/móvil; Analítica solo con reports.read.
- [ ] Dashboard sin permisos de reportes: accesos autorizados y sin consultas no permitidas.
- [ ] Dashboard con permiso: métricas reales, hora de servidor, cambio de sucursal sin datos arrastrados.
- [ ] Analítica: MES, DIA, SEMANA y PERSONALIZADO; máximo 366 días e inversión de fechas.
- [ ] Cobros, Ventas, Reembolsos, Gastos son cifras distintas; no se calcula utilidad falsa.
- [ ] Margen, ticket promedio sin tickets y diferencia de caja incompleta muestran «No disponible».
- [ ] Gráficas responsivas; tabla accesible de fechas e importes coincide con serie del servidor.
- [ ] Reporte SALES_LINES: productos destacados reales y posibilidad de descargar CSV, XLSX y PDF (si <=1000 filas).
- [ ] Ver páginas 2/3 de tickets, turnos y fuente; paginación del backend.
- [ ] Cambiar sucursal en una carga en curso; no aparecen datos de la sucursal anterior.
- [ ] Ver en móvil 390px, Firefox a 90%, tema claro/oscuro y navegación por teclado.
- [ ] Lint, build, tests y QA contra NestJS/PostgreSQL (sin mocks) antes de merge.

## Local
```powershell
git status
git fetch origin
git switch -c feat/reports-dashboard-ui-20261104 --track origin/feat/reports-dashboard-ui-20261104
npm ci
npm start
```
Si ya existe la rama local:
```powershell
git fetch origin
git switch feat/reports-dashboard-ui-20261104
git pull --ff-only origin feat/reports-dashboard-ui-20261104
npm start
```
