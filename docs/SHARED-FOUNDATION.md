# Gastro Core UI — Utilidades y layout transversales

## Propósito

Esta base es independiente de módulos de negocio. Los parsers viven en `src/app/shared/formatting`; el shell y las tablas continúan bajo `shells` y `design-system`. Cada feature puede importar funciones puntuales desde `shared/formatting`.

## Dinero y cantidades (Decimal.js)

```ts
import { formatCurrency, formatDecimal, parseApiDecimal, roundDecimal, toApiDecimal } from '../../shared/formatting';

formatCurrency('1234567.50');          // 'Q 1,234,567.50'
formatCurrency('-22.4', 'USD');        // '-US$ 22.40'
formatDecimal('1.2500');              // '1.25'
roundDecimal('1.005', 2);             // '1.01'
parseApiDecimal('0.10').plus('0.20'); // Decimal, nunca JS number
toApiDecimal('0001.25');             // Error: entrada no canónica (evita ambigüedad)
```

**Reglas:** el backend decide precios, impuestos, redondeos operativos y estado de pago. Las funciones son para validación/formato y cálculos locales explícitos. La API usa strings decimales sin separadores `Q`, comas ni notación exponencial. Evitar `Number()` y `parseFloat()` en valores monetarios. No depender del locale del navegador para separar miles o decimales.

## Fecha civil vs instante (Day.js)

```ts
import { formatCalendarDate, formatInstant, calendarDateAtBranch } from '../../shared/formatting';

formatCalendarDate('2026-10-31'); // '31/10/2026'
formatInstant('2026-10-31T01:00:00Z', 'America/Guatemala'); // '30/10/2026 19:00'
calendarDateAtBranch('2026-10-31T01:00:00Z', 'America/Guatemala'); // '2026-10-30'
```

- **Fecha civil:** `YYYY-MM-DD`, validada estrictamente; nunca convertirla a UTC para mostrarla. Útil para `fechaOperativa`, rangos de informes y vencimientos.
- **Instante:** ISO con `Z` o offset, explícito. La zona IANA debe venir de la sucursal/empresa; no se deduce del navegador.
- **Fechas operativas:** no se derivan arbitrariamente de un instante si el backend tiene corte operativo propio. Usar el campo `fechaOperativa` que entregue el servidor.
- Para formularios con fecha + hora local y cambios de horario de verano, no fabricar instantes sin una política del backend.

## Layout

`GcAppShell` deja crecer `.gc-content` hasta el espacio disponible en escritorio, incluida pantalla ancha. El sidebar conserva su rejilla `minmax(0,1fr)`. En móvil el menú es overlay; las tablas usan su scroll horizontal propio sin desbordar el documento.

Si una página debe limitar ancho para lectura o un wizard, envolver su contenido con `class="gc-page-narrow"`. No aplicar `max-width` global a pantallas operativas con tablas.

## Tablas

```ts
import { GcDataTable } from '../../design-system/data/gc-data-table';
import { GcTableCellDirective } from '../../design-system/data/gc-table-cell.directive';
```

Para formateo de texto plano (ejemplo: monto monetario):

```ts
const columns = [
  { key: 'total', label: 'Total', numeric: true,
    format: (value: string | number | boolean | null | undefined) =>
      typeof value === 'string' ? formatCurrency(value) : '—' },
];
```

Para acciones y componentes visuales, proyectar una plantilla en la tabla:

```html
<gc-data-table [rows]="rows()" [columns]="columns">
  <ng-template gcTableCell="status" let-row let-value="value">
    <span>{{ value }}</span>
  </ng-template>
</gc-data-table>
```

Los ejemplos de plantillas requieren importar `GcTableCellDirective` en el componente feature; los componentes visuales deben usar los inputs efectivos de su versión. No mezclar el estado de UI con mutaciones del servidor.

La tabla existente conserva el comportamiento de scroll horizontal para anchos reducidos; columnas configurables, paginación y filtros siguen bajo control de la feature y la URL. El sort no debe aplicarse a una única página de respuesta si el servidor es dueño de la ordenación.

## Calidad

```bash
npm ci
npm run lint
npm run build
npm test -- --watch=false
```

Las nuevas pruebas cubren importes superiores al máximo entero seguro, sumar 0.1+0.2 sin floats, fecha civil inválida, formato en zona IANA y cambios de día entre UTC y sucursal.
