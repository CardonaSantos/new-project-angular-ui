import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';
import { gcErrorMessage } from '../../../core/http/api-error';
import { formatCalendarDate, formatInstant } from '../../../shared/formatting';
import { GcReportsNav } from '../../reports/components/reports-nav';
import { ReportingApi } from '../data-access/reporting.api';
import { ReportingAccess } from '../data-access/reporting-access';
import {
  REPORTING_LABELS, reportMoney, reportingFilename, reportingFiltersValid, reportingFormShape,
  reportingPeriodLabel,
} from '../data-access/reporting.helpers';
import { REPORTING_TYPES } from '../data-access/reporting.models';
import type {
  CashSessionReportSnapshot, CustomerReportSnapshot, DailyReportSnapshot, InventoryReportSnapshot,
  ProfitabilityReportSnapshot, ReportingFilters, ReportingFormat, ReportingPeriod, ReportingType,
  SalesReportSnapshot,
} from '../data-access/reporting.models';

// Large tables (kardex, clientes, turnos, productos) can run into the hundreds or
// thousands of rows — the backend's own PDF/Excel split already treats full detail as
// Excel-only (see each *-report-pdf.ts's "Summary-only PDF" comment). The on-screen
// preview follows the same policy: show a manageable slice, point to the download for
// the rest, never silently truncate without saying so.
const PREVIEW_ROWS = 40;

@Component({
  selector: 'gc-reporting-page',
  imports: [RouterLink, GcReportsNav],
  template: `<main class="rep-page">
    <gc-reports-nav />
    <header class="rep-heading">
      <div>
        <span class="rep-kicker">Reportería · {{ branch.active()?.nombre ?? 'Sucursal' }}</span>
        <h1>Reportes para descarga</h1>
      </div>
    </header>
    @if (!access.canRead()) {
      <section class="rep-card" role="status">
        <h2>Sin acceso a reportería</h2>
        <p class="rep-muted">Se necesita el permiso «reports.read» en la sucursal activa.</p>
        <a class="rep-text-link" routerLink="/workspace">Regresar al inicio</a>
      </section>
    } @else {
      <section class="rep-card rep-filters" aria-label="Filtros del reporte">
        <div class="rep-filter-grid">
          <div class="rep-field">
            <label for="rpt-type">Tipo de informe</label>
            <select id="rpt-type" [value]="type()" (change)="chooseType($any($event.target).value)">
              @for (t of types; track t) {
                <option [value]="t">{{ labels[t] }}</option>
              }
            </select>
          </div>
          @if (shape().periodo) {
            <div class="rep-field">
              <label for="rpt-period">Período</label>
              <select id="rpt-period" [value]="periodo()" (change)="setPeriod($any($event.target).value)">
                <option value="DIA">Día</option>
                <option value="SEMANA">Semana</option>
                <option value="MES">Mes</option>
                <option value="ANIO">Año</option>
                <option value="PERSONALIZADO">Personalizado</option>
              </select>
            </div>
          }
          @if (shape().periodo && periodo() === 'PERSONALIZADO') {
            <div class="rep-field">
              <label for="rpt-from">Desde</label>
              <input id="rpt-from" type="date" [value]="from()" (change)="from.set($any($event.target).value)" />
            </div>
            <div class="rep-field">
              <label for="rpt-to">Hasta</label>
              <input id="rpt-to" type="date" [value]="to()" (change)="to.set($any($event.target).value)" />
            </div>
          } @else if (shape().fechaOnly || shape().periodo) {
            <div class="rep-field">
              <label for="rpt-date">Fecha de referencia (opcional)</label>
              <input id="rpt-date" type="date" [value]="date()" (change)="date.set($any($event.target).value)" />
            </div>
          }
          @if (shape().soloActivos) {
            <div class="rep-field">
              <label for="rpt-active">
                <input id="rpt-active" type="checkbox" [checked]="onlyActive()"
                  (change)="onlyActive.set($any($event.target).checked)" />
                Solo clientes activos
              </label>
            </div>
          }
          @if (shape().limite) {
            <div class="rep-field">
              <label for="rpt-limit">Máximo de filas (opcional)</label>
              <input id="rpt-limit" type="number" min="1" max="2000" placeholder="500"
                [value]="limit() ?? ''" (change)="limit.set($any($event.target).valueAsNumber || null)" />
            </div>
          }
          <div class="rep-filter-submit">
            <button type="button" class="rep-primary" [disabled]="busy() || !valid()" (click)="refresh()">
              {{ busy() ? 'Consultando…' : 'Aplicar filtros' }}
            </button>
          </div>
        </div>
        @if (!valid()) {
          <p class="rep-alert" role="alert">
            Verifica las fechas. El máximo permitido es 366 días y «Desde» no puede superar «Hasta».
          </p>
        }
        <div class="rep-actions">
          <button type="button" [disabled]="downloading() || !valid() || busy()" (click)="download('XLSX')">
            Excel
          </button>
          <button type="button" [disabled]="downloading() || !valid() || busy()" (click)="download('PDF')">
            PDF
          </button>
        </div>
        @if (downloadError()) {
          <p role="alert" class="rep-alert">{{ downloadError() }}</p>
        }
      </section>
      @if (error()) {
        <p class="rep-alert" role="alert">
          {{ error() }} <button type="button" (click)="refresh()">Reintentar</button>
        </p>
      }
      @if (busy()) {
        <p role="status" class="rep-muted">Consultando al servidor…</p>
      }

      @switch (type()) {
        @case ('DAILY') {
          @if (daily(); as r) {
            <section class="rep-card rep-section">
              <div class="rep-section-header">
                <div><h2>Reporte del día</h2><p class="rep-muted">{{ displayDate(r.fecha) }} · {{ r.sucursal.nombre }}</p></div>
              </div>
              <div class="rep-metrics">
                <div class="rep-metric"><span>Ventas netas</span><strong>{{ money(r.ventas.totalNeto, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Costo consumo</span><strong>{{ money(r.ganancias.costoConsumoInventario, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Margen bruto estimado</span><strong>{{ money(r.ganancias.margenBrutoEstimado, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Clientes atendidos</span><strong>{{ r.clientes.atendidosHoy }}</strong><small>{{ r.clientes.nuevosHoy }} nuevos</small></div>
              </div>
              <p class="rep-footnote">{{ r.ganancias.nota }}</p>
              <h3>Ventas por método de pago</h3>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Método</th><th>Cobrado</th><th>Reembolsado</th><th>Neto</th><th>Cantidad</th></tr></thead>
                <tbody>
                  @for (m of r.ventas.porMetodoPago; track m.metodo) {
                    <tr><td>{{ m.metodo }}</td><td>{{ money(m.cobrado, r.currency) }}</td>
                      <td>{{ money(m.reembolsado, r.currency) }}</td><td>{{ money(m.neto, r.currency) }}</td><td>{{ m.cantidad }}</td></tr>
                  } @empty { <tr><td colspan="5">Sin ventas en el período.</td></tr> }
                </tbody>
              </table></div>
              <h3>Top clientes del día</h3>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Cliente</th><th>Total gastado</th><th>Ventas</th></tr></thead>
                <tbody>
                  @for (c of r.clientes.topGasto; track c.clienteId) {
                    <tr><td>{{ c.nombre }}</td><td>{{ money(c.totalGastado, r.currency) }}</td><td>{{ c.cantidadVentas }}</td></tr>
                  } @empty { <tr><td colspan="3">Sin clientes identificados.</td></tr> }
                </tbody>
              </table></div>
              <h3>Top artículos movidos (inventario)</h3>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Artículo</th><th>Costo total movido</th></tr></thead>
                <tbody>
                  @for (a of r.inventario.topArticulos; track a.articuloId) {
                    <tr><td>{{ a.nombre }}</td><td>{{ money(a.costoTotalMovido, r.currency) }}</td></tr>
                  } @empty { <tr><td colspan="2">Sin movimientos en el período.</td></tr> }
                </tbody>
              </table></div>
            </section>
          }
        }
        @case ('SALES') {
          @if (sales(); as r) {
            <section class="rep-card rep-section">
              <div class="rep-section-header">
                <div><h2>Ventas — {{ periodLabel(r.periodo.tipo) }}</h2>
                  <p class="rep-muted">{{ displayDate(r.periodo.desde) }} al {{ displayDate(r.periodo.hasta) }} · {{ r.sucursal.nombre }}</p></div>
              </div>
              <div class="rep-metrics">
                <div class="rep-metric"><span>Ventas netas</span><strong>{{ money(r.resumen.ventasNetas, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Dinero entrante</span><strong>{{ money(r.resumen.dineroEntrante, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Cantidad de ventas</span><strong>{{ r.resumen.cantidadVentas }}</strong></div>
                <div class="rep-metric"><span>Órdenes cerradas</span><strong>{{ r.resumen.ordenesCerradas }}</strong><small>{{ r.resumen.ordenesCanceladas }} canceladas</small></div>
              </div>
              <h3>Por método de pago</h3>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Método</th><th>Cobrado</th><th>Reembolsado</th><th>Neto</th><th>Cantidad</th></tr></thead>
                <tbody>
                  @for (m of r.porMetodoPago; track m.metodo) {
                    <tr><td>{{ m.metodo }}</td><td>{{ money(m.cobrado, r.currency) }}</td>
                      <td>{{ money(m.reembolsado, r.currency) }}</td><td>{{ money(m.neto, r.currency) }}</td><td>{{ m.cantidad }}</td></tr>
                  } @empty { <tr><td colspan="5">Sin pagos en el período.</td></tr> }
                </tbody>
              </table></div>
              <div class="rep-card-header">
                <h3>Serie diaria</h3>
                @if (r.serieDiaria.length > previewRows) {
                  <span class="rep-muted">Mostrando los primeros {{ previewRows }} de {{ r.serieDiaria.length }} días — el Excel trae el período completo.</span>
                }
              </div>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Fecha</th><th>Ventas netas</th><th>Dinero entrante</th><th>Ventas</th></tr></thead>
                <tbody>
                  @for (d of r.serieDiaria.slice(0, previewRows); track d.fecha) {
                    <tr><td>{{ displayDate(d.fecha) }}</td><td>{{ money(d.ventasNetas, r.currency) }}</td>
                      <td>{{ money(d.dineroEntrante, r.currency) }}</td><td>{{ d.cantidadVentas }}</td></tr>
                  } @empty { <tr><td colspan="4">Sin ventas en el período.</td></tr> }
                </tbody>
              </table></div>
            </section>
          }
        }
        @case ('CUSTOMERS') {
          @if (customers(); as r) {
            <section class="rep-card rep-section">
              <div class="rep-section-header">
                <div><h2>Clientes</h2><p class="rep-muted">{{ r.sucursal.nombre }}</p></div>
              </div>
              <div class="rep-metrics">
                <div class="rep-metric"><span>Total clientes</span><strong>{{ r.resumen.totalClientes }}</strong></div>
                <div class="rep-metric"><span>Activos</span><strong>{{ r.resumen.clientesActivos }}</strong></div>
                <div class="rep-metric"><span>Inactivos</span><strong>{{ r.resumen.clientesInactivos }}</strong></div>
                <div class="rep-metric"><span>Con compras</span><strong>{{ r.resumen.clientesConCompras }}</strong></div>
              </div>
              <div class="rep-card-header">
                <h3>Clientes</h3>
                @if (r.clientes.length > previewRows) {
                  <span class="rep-muted">Mostrando los primeros {{ previewRows }} de {{ r.clientes.length }} — el Excel trae el listado completo.</span>
                }
              </div>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Cliente</th><th>Teléfono</th><th>Activo</th><th>Total gastado</th><th>Ventas</th><th>Última compra</th></tr></thead>
                <tbody>
                  @for (c of r.clientes.slice(0, previewRows); track c.clienteId) {
                    <tr><td>{{ c.nombre }}</td><td>{{ c.telefono || '—' }}</td><td>{{ c.activo ? 'Sí' : 'No' }}</td>
                      <td>{{ money(c.totalGastado, r.currency) }}</td><td>{{ c.cantidadVentas }}</td>
                      <td>{{ c.ultimaCompra ? instant(c.ultimaCompra) : '—' }}</td></tr>
                  } @empty { <tr><td colspan="6">Sin clientes registrados en esta sucursal.</td></tr> }
                </tbody>
              </table></div>
            </section>
          }
        }
        @case ('INVENTORY') {
          @if (inventory(); as r) {
            <section class="rep-card rep-section">
              <div class="rep-section-header">
                <div><h2>Inventario y kardex</h2>
                  <p class="rep-muted">Movimientos: {{ periodLabel(r.periodo.tipo) }} {{ displayDate(r.periodo.desde) }} al {{ displayDate(r.periodo.hasta) }} · Stock: a la fecha de generación</p></div>
              </div>
              <div class="rep-metrics">
                <div class="rep-metric"><span>Artículos con stock</span><strong>{{ r.resumen.articulosConStock }}</strong></div>
                <div class="rep-metric"><span>Valor total de inventario</span><strong>{{ money(r.resumen.valorTotalInventario, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Movimientos en el período</span><strong>{{ r.kardex.length }}{{ r.kardexTruncado ? '+' : '' }}</strong></div>
              </div>
              <h3>Movimientos por tipo</h3>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Tipo</th><th>Cantidad</th><th>Costo total</th></tr></thead>
                <tbody>
                  @for (m of r.resumen.movimientosPorTipo; track m.tipo) {
                    <tr><td>{{ m.tipo }}</td><td>{{ m.cantidad }}</td><td>{{ money(m.costoTotal, r.currency) }}</td></tr>
                  } @empty { <tr><td colspan="3">Sin movimientos en el período.</td></tr> }
                </tbody>
              </table></div>
              <h3>Top artículos por valor movido</h3>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Artículo</th><th>Costo total movido</th></tr></thead>
                <tbody>
                  @for (a of r.topMovidos.slice(0, previewRows); track a.articuloId) {
                    <tr><td>{{ a.nombre }}</td><td>{{ money(a.costoTotalMovido, r.currency) }}</td></tr>
                  } @empty { <tr><td colspan="2">Sin movimientos en el período.</td></tr> }
                </tbody>
              </table></div>
              <p class="rep-footnote">El stock actual y el kardex completo (cada movimiento) están en el Excel.</p>
            </section>
          }
        }
        @case ('CASH_SESSIONS') {
          @if (cashSessions(); as r) {
            <section class="rep-card rep-section">
              <div class="rep-section-header">
                <div><h2>Cierre de caja / arqueo por sesión</h2>
                  <p class="rep-muted">{{ periodLabel(r.periodo.tipo) }} {{ displayDate(r.periodo.desde) }} al {{ displayDate(r.periodo.hasta) }} · {{ r.sucursal.nombre }}</p></div>
              </div>
              <div class="rep-metrics">
                <div class="rep-metric"><span>Total de turnos</span><strong>{{ r.resumen.totalTurnos }}</strong><small>{{ r.resumen.abiertos }} abiertos · {{ r.resumen.cerrados }} cerrados</small></div>
                <div class="rep-metric"><span>Turnos con diferencia</span><strong>{{ r.resumen.turnosConDiferencia }}</strong></div>
                <div class="rep-metric"><span>Efectivo esperado (suma)</span><strong>{{ money(r.resumen.efectivoEsperado, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Diferencia (suma)</span><strong>{{ money(r.resumen.diferencia, r.currency) }}</strong></div>
              </div>
              <div class="rep-card-header">
                <h3>Turnos</h3>
                @if (r.turnos.length > previewRows) {
                  <span class="rep-muted">Mostrando los primeros {{ previewRows }} de {{ r.turnos.length }} — el Excel trae el detalle completo.</span>
                }
              </div>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Caja</th><th>Cajero</th><th>Fecha</th><th>Estado</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Fuente</th></tr></thead>
                <tbody>
                  @for (t of r.turnos.slice(0, previewRows); track t.turnoId) {
                    <tr><td>{{ t.caja }}</td><td>{{ t.cajero }}</td><td>{{ displayDate(t.fechaOperativa) }}</td><td>{{ t.estado }}</td>
                      <td>{{ money(t.efectivoEsperado, r.currency) }}</td><td>{{ money(t.efectivoContado, r.currency) }}</td>
                      <td>{{ money(t.diferencia, r.currency) }}</td><td>{{ fuenteArqueo(t.fuenteArqueo) }}</td></tr>
                  } @empty { <tr><td colspan="8">Sin turnos en el período.</td></tr> }
                </tbody>
              </table></div>
            </section>
          }
        }
        @case ('PROFITABILITY') {
          @if (profitability(); as r) {
            <section class="rep-card rep-section">
              <div class="rep-section-header">
                <div><h2>Rentabilidad por producto y categoría</h2>
                  <p class="rep-muted">{{ periodLabel(r.periodo.tipo) }} {{ displayDate(r.periodo.desde) }} al {{ displayDate(r.periodo.hasta) }} · {{ r.sucursal.nombre }}</p></div>
              </div>
              <div class="rep-metrics">
                <div class="rep-metric"><span>Ingreso neto</span><strong>{{ money(r.resumen.ingresoNeto, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Costo (receta/consumo)</span><strong>{{ money(r.resumen.costo, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Margen bruto</span><strong>{{ money(r.resumen.margen, r.currency) }}</strong></div>
                <div class="rep-metric"><span>Margen</span><strong>{{ r.resumen.margenPct }}%</strong></div>
              </div>
              @if (!r.resumen.costoCompleto) {
                <p class="rep-alert" role="alert">
                  Costo registrado en {{ r.resumen.lineasConCosto }} de {{ r.resumen.lineasTotal }} líneas vendidas;
                  el resto queda fuera del costo total (no se asume costo cero).
                </p>
              }
              <h3>Por categoría</h3>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Categoría</th><th>Ingreso neto</th><th>Costo</th><th>Margen</th><th>Margen %</th></tr></thead>
                <tbody>
                  @for (c of r.categorias; track c.categoriaId) {
                    <tr><td>{{ c.categoriaNombre }}</td><td>{{ money(c.ingresoNeto, r.currency) }}</td>
                      <td>{{ money(c.costo, r.currency) }}</td><td>{{ money(c.margen, r.currency) }}</td><td>{{ c.margenPct }}%</td></tr>
                  } @empty { <tr><td colspan="5">Sin ventas en el período.</td></tr> }
                </tbody>
              </table></div>
              <div class="rep-card-header">
                <h3>Top productos por ingreso</h3>
                @if (r.productos.length > previewRows || r.productosTruncado) {
                  <span class="rep-muted">Mostrando los primeros {{ previewRows }} — el Excel trae el listado completo.</span>
                }
              </div>
              <div class="rep-table-wrap"><table class="rep-table">
                <thead><tr><th>Producto</th><th>Categoría</th><th>Ingreso neto</th><th>Costo</th><th>Margen</th><th>Margen %</th></tr></thead>
                <tbody>
                  @for (p of r.productos.slice(0, previewRows); track p.productoId) {
                    <tr><td>{{ p.productoNombre }}</td><td>{{ p.categoriaNombre }}</td><td>{{ money(p.ingresoNeto, r.currency) }}</td>
                      <td>{{ money(p.costo, r.currency) }}</td><td>{{ money(p.margen, r.currency) }}</td><td>{{ p.margenPct }}%</td></tr>
                  } @empty { <tr><td colspan="6">Sin ventas en el período.</td></tr> }
                </tbody>
              </table></div>
            </section>
          }
        }
      }
    }
  </main>`,
})
export class GcReportingPage {
  protected readonly branch = inject(GcBranchContext);
  protected readonly access = inject(ReportingAccess);
  private readonly api = inject(ReportingApi);
  protected readonly types = REPORTING_TYPES;
  protected readonly labels = REPORTING_LABELS;
  protected readonly previewRows = PREVIEW_ROWS;
  protected readonly money = reportMoney;
  protected readonly displayDate = formatCalendarDate;
  protected readonly periodLabel = reportingPeriodLabel;

  protected readonly type = signal<ReportingType>('DAILY');
  protected readonly periodo = signal<ReportingPeriod>('MES');
  protected readonly date = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly limit = signal<number | null>(null);
  protected readonly onlyActive = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal('');

  protected readonly daily = signal<DailyReportSnapshot | null>(null);
  protected readonly sales = signal<SalesReportSnapshot | null>(null);
  protected readonly customers = signal<CustomerReportSnapshot | null>(null);
  protected readonly inventory = signal<InventoryReportSnapshot | null>(null);
  protected readonly cashSessions = signal<CashSessionReportSnapshot | null>(null);
  protected readonly profitability = signal<ProfitabilityReportSnapshot | null>(null);

  protected readonly shape = computed(() => reportingFormShape(this.type()));
  protected readonly form = computed<ReportingFilters>(() => ({
    sucursalId: this.branch.branchId() ?? '',
    periodo: this.periodo(),
    fecha: this.date() || undefined,
    desde: this.from() || undefined,
    hasta: this.to() || undefined,
    limite: this.limit() ?? undefined,
    soloActivos: this.shape().soloActivos ? this.onlyActive() : undefined,
  }));
  protected readonly valid = computed(() => reportingFiltersValid(this.type(), this.form()));

  private generation = 0;
  constructor() {
    effect(() => {
      const id = this.branch.branchId(), permitted = this.access.canRead();
      untracked(() => {
        this.generation++;
        this.clearAll();
        this.error.set('');
        if (id && permitted) void this.refresh();
      });
    });
  }

  private clearAll() {
    this.daily.set(null); this.sales.set(null); this.customers.set(null);
    this.inventory.set(null); this.cashSessions.set(null); this.profitability.set(null);
  }

  protected chooseType(value: string) {
    if (!(this.types as readonly string[]).includes(value)) return;
    this.type.set(value as ReportingType);
    this.clearAll();
    this.error.set('');
    void this.refresh();
  }
  protected setPeriod(value: string) {
    if (['DIA', 'SEMANA', 'MES', 'ANIO', 'PERSONALIZADO'].includes(value)) this.periodo.set(value as ReportingPeriod);
  }
  protected instant(date: string) {
    try { return formatInstant(date, this.branch.active()?.zonaHoraria ?? 'America/Guatemala'); }
    catch { return date; }
  }
  protected fuenteArqueo(value: string) {
    return ({ ARQUEO_CAJA: 'Arqueo dedicado', TURNO_CAJA: 'Cierre del turno', SIN_DATOS: 'Sin datos' } as
      Record<string, string>)[value] ?? value;
  }

  protected async refresh() {
    if (!this.valid() || !this.access.canRead()) return;
    const type = this.type(), gen = ++this.generation;
    this.busy.set(true); this.error.set('');
    try {
      const data = await firstValueFrom(this.api.snapshot(type, this.form()));
      if (gen !== this.generation) return;
      switch (type) {
        case 'DAILY': this.daily.set(data as DailyReportSnapshot); break;
        case 'SALES': this.sales.set(data as SalesReportSnapshot); break;
        case 'CUSTOMERS': this.customers.set(data as CustomerReportSnapshot); break;
        case 'INVENTORY': this.inventory.set(data as InventoryReportSnapshot); break;
        case 'CASH_SESSIONS': this.cashSessions.set(data as CashSessionReportSnapshot); break;
        case 'PROFITABILITY': this.profitability.set(data as ProfitabilityReportSnapshot); break;
      }
    } catch (e) {
      if (gen === this.generation) { this.error.set(gcErrorMessage(e)); this.clearAll(); }
    } finally {
      if (gen === this.generation) this.busy.set(false);
    }
  }

  protected async download(format: ReportingFormat) {
    if (!this.valid() || this.downloading()) return;
    this.downloading.set(true); this.downloadError.set('');
    try {
      const response = await firstValueFrom(this.api.download(this.type(), this.form(), format));
      const blob = response.body;
      if (!blob || blob.size === 0) throw new Error('El servidor devolvió un archivo vacío.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = reportingFilename(this.type(), this.form().sucursalId, this.currentPeriodo(), format);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      this.downloadError.set(gcErrorMessage(e));
    } finally {
      this.downloading.set(false);
    }
  }
  private currentPeriodo(): { desde: string; hasta: string } {
    const snapshot = this.daily() ?? this.sales() ?? this.customers() ?? this.inventory() ??
      this.cashSessions() ?? this.profitability();
    if (snapshot && 'periodo' in snapshot) return { desde: snapshot.periodo.desde, hasta: snapshot.periodo.hasta };
    if (snapshot && 'fecha' in snapshot) return { desde: snapshot.fecha, hasta: snapshot.fecha };
    const today = new Date().toISOString().slice(0, 10);
    return { desde: this.from() || this.date() || today, hasta: this.to() || this.date() || today };
  }
}
