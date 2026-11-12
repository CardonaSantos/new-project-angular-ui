import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';
import { gcErrorMessage } from '../../../core/http/api-error';
import { GcNotificationService } from '../../../core/ux/gc-notification.service';
import { formatCalendarDate, formatInstant } from '../../../shared/formatting';
import { ReportsApi } from '../data-access/reports.api';
import { ReportsAccess } from '../data-access/reports-access';
import type {
  ReportsOverview,
  ReportPeriod,
  ReportFilters,
  PaymentMethodResponse,
  ExpenseCategoryResponse,
  ReportTicket,
  ReportCashShift,
  ReportPage,
  ReportSource,
  SourceRecordResponse,
} from '../data-access/reports.models';
import { REPORT_SOURCES } from '../data-access/reports.models';
import {
  REPORT_LABELS,
  asReportQuery,
  periodValid,
  reportMoney,
  fieldLabel,
  sourceScalar,
} from '../data-access/reports.helpers';
import { GcReportsNav } from '../components/reports-nav';
import { GcReportsDailyChart, GcReportsBreakdownChart } from '../components/reports-charts';
type Tab = 'overview' | 'tickets' | 'cash' | 'sources';
@Component({
  selector: 'gc-reports-analytics-page',
  imports: [RouterLink, GcReportsNav, GcReportsDailyChart, GcReportsBreakdownChart],
  template: ` <main class="rep-page">
    <gc-reports-nav />
    <header class="rep-heading">
      <div>
        <span class="rep-kicker">Informes · {{ branch.active()?.nombre ?? 'Sucursal' }}</span>
        <h1>Analítica y reportes</h1>
      </div>
      <div class="rep-actions">
        <button type="button" [disabled]="busy() || !valid()" (click)="refresh()">
          Actualizar
        </button>
      </div>
    </header>
    @if (!access.canRead()) {
      <section class="rep-card" role="status">
        <h2>Sin acceso a reportes</h2>
        <p class="rep-muted">Se necesita el permiso «reports.read» en la sucursal activa.</p>
        <a class="rep-text-link" routerLink="/workspace">Regresar al inicio</a>
      </section>
    } @else {
      <section class="rep-card rep-filters" aria-label="Filtros de analítica">
        <div class="rep-filter-grid">
          <div class="rep-field">
            <label for="rep-period">Período</label>
            <select
              id="rep-period"
              [value]="period()"
              (change)="setPeriod($any($event.target).value)"
            >
              <option value="DIA">Día</option>
              <option value="SEMANA">Semana</option>
              <option value="MES">Mes</option>
              <option value="PERSONALIZADO">Personalizado</option>
            </select>
          </div>
          @if (period() === 'PERSONALIZADO') {
            <div class="rep-field">
              <label for="rep-from">Desde</label>
              <input
                id="rep-from"
                type="date"
                [value]="from()"
                (change)="from.set($any($event.target).value)"
              />
            </div>
            <div class="rep-field">
              <label for="rep-to">Hasta</label>
              <input
                id="rep-to"
                type="date"
                [value]="to()"
                (change)="to.set($any($event.target).value)"
              />
            </div>
          } @else {
            <div class="rep-field">
              <label for="rep-date">Fecha de referencia (opcional)</label>
              <input
                id="rep-date"
                type="date"
                [value]="date()"
                (change)="date.set($any($event.target).value)"
              />
            </div>
          }
          <div class="rep-filter-submit">
            <button
              type="button"
              class="rep-primary"
              [disabled]="busy() || !valid()"
              (click)="refresh()"
            >
              {{ busy() ? 'Consultando…' : 'Aplicar filtros' }}
            </button>
          </div>
        </div>
        @if (!valid()) {
          <p class="rep-alert" role="alert">
            Verifica las fechas. El máximo permitido es 366 días y «Desde» no puede superar «Hasta».
          </p>
        }
      </section>
      <nav class="rep-tabs" aria-label="Categorías de reportes">
        <button
          type="button"
          [class.rep-tab-active]="tab() === 'overview'"
          [attr.aria-current]="tab() === 'overview' ? 'page' : null"
          (click)="selectTab('overview')"
        >
          Resumen
        </button>
        <button
          type="button"
          [class.rep-tab-active]="tab() === 'tickets'"
          [attr.aria-current]="tab() === 'tickets' ? 'page' : null"
          (click)="selectTab('tickets')"
        >
          Tickets
        </button>
        <button
          type="button"
          [class.rep-tab-active]="tab() === 'cash'"
          [attr.aria-current]="tab() === 'cash' ? 'page' : null"
          (click)="selectTab('cash')"
        >
          Arqueos
        </button>
        <button
          type="button"
          [class.rep-tab-active]="tab() === 'sources'"
          [attr.aria-current]="tab() === 'sources' ? 'page' : null"
          (click)="selectTab('sources')"
        >
          Informes detallados
        </button>
      </nav>
      @if (error()) {
        <p class="rep-alert" role="alert">
          {{ error() }} <button type="button" (click)="refresh()">Reintentar</button>
        </p>
      }
      @if (busy()) {
        <p role="status" class="rep-muted">Actualizando datos del servidor…</p>
      }

      @if (tab() === 'overview') {
        @if (overview(); as report) {
          <div class="rep-section-header">
            <div>
              <h2>Resultados del período</h2>
              <p class="rep-muted">
                {{ displayDate(report.periodo.desde) }} al {{ displayDate(report.periodo.hasta) }} ·
                {{ report.sucursal.nombre }}
              </p>
            </div>
            <span class="rep-tag">Corte {{ report.periodo.horaCorte }}</span>
          </div>
          <div class="rep-metrics rep-metrics-4">
            <div class="rep-metric">
              <span>Ventas netas</span
              ><strong>{{ money(report.kpis.ventasNetas, report.currency) }}</strong>
              <small>{{ report.kpis.ticketsUnicos }} tickets únicos</small>
            </div>
            <div class="rep-metric">
              <span>Cobros netos</span
              ><strong>{{ money(report.kpis.cobrosNetos, report.currency) }}</strong>
              <small>{{ money(report.kpis.reembolsos, report.currency) }} reembolsados</small>
            </div>
            <div class="rep-metric">
              <span>Gastos registrados</span
              ><strong>{{ money(report.kpis.gastosRegistrados, report.currency) }}</strong>
              <small>Fecha de registro del gasto</small>
            </div>
            <div class="rep-metric">
              <span>Ticket promedio</span>
              <strong>{{ money(report.kpis.ticketPromedio, report.currency) }}</strong>
              <small>Ventas / tickets únicos</small>
            </div>
          </div>
          <section class="rep-card">
            <div class="rep-card-header">
              <h3>Evolución diaria</h3>
              <span class="rep-muted">Datos efectivos por fecha operativa</span>
            </div>
            <gc-reports-daily-chart [report]="report" />
          </section>
          <div class="rep-analytics-columns">
            <section class="rep-card">
              <div class="rep-card-header"><h3>Cobros por método</h3></div>
              @if (methodError()) {
                <p class="rep-alert" role="alert">{{ methodError() }}</p>
              }
              @if (methods(); as data) {
                <gc-reports-breakdown-chart
                  title="Cobros netos por método"
                  [currency]="data.currency"
                  [rows]="methodBars()"
                />
                <div class="rep-table-wrap">
                  <table class="rep-table">
                    <thead>
                      <tr>
                        <th>Método</th>
                        <th>Cobrado neto</th>
                        <th>Operaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of data.data; track row.metodo) {
                        <tr>
                          <td>{{ methodName(row.metodo) }}</td>
                          <td>{{ money(row.neto, data.currency) }}</td>
                          <td>{{ row.cantidadCobros }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>
            <section class="rep-card">
              <div class="rep-card-header"><h3>Gastos por categoría</h3></div>
              @if (expenseError()) {
                <p class="rep-alert" role="alert">{{ expenseError() }}</p>
              }
              @if (expenses(); as data) {
                <gc-reports-breakdown-chart
                  title="Gastos registrados por categoría"
                  [currency]="data.currency"
                  [rows]="expenseBars()"
                />
                <p class="rep-muted">
                  Total registrado:
                  <strong>{{ money(data.totalRegistrado, data.currency) }}</strong>
                </p>
                <div class="rep-table-wrap">
                  <table class="rep-table">
                    <thead>
                      <tr>
                        <th>Categoría y tipo</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of data.data; track row.categoria + ':' + row.tipo) {
                        <tr>
                          <td>{{ row.categoria }} · {{ row.tipo }}</td>
                          <td>{{ money(row.monto, data.currency) }}</td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="2">Sin gastos registrados.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>
          </div>
          <section class="rep-card">
            <h3>Cierre y control de caja</h3>
            <div class="rep-metrics rep-metrics-4">
              <div class="rep-metric">
                <span>Turnos cerrados</span><strong>{{ report.kpis.turnosCajaCerrados }}</strong>
              </div>
              <div class="rep-metric">
                <span>Turnos abiertos ahora</span
                ><strong>{{ report.kpis.turnosCajaActualmenteAbiertos }}</strong>
              </div>
              <div class="rep-metric">
                <span>Con diferencia registrada</span
                ><strong>{{ report.kpis.turnosCajaConDiferenciaRegistrada }}</strong>
              </div>
              <div class="rep-metric">
                <span>Diferencia acumulada</span>
                <strong>{{ money(report.kpis.diferenciaCajaCerrada, report.currency) }}</strong>
                <small>{{ cashState(report.kpis.estadoDiferenciaCaja) }}</small>
              </div>
            </div>
            <div class="rep-actions">
              <button type="button" (click)="selectTab('cash')">Consultar arqueos</button>
            </div>
          </section>
        } @else if (!busy() && !error()) {
          <p class="rep-muted">No se encontraron datos para el período.</p>
        }
      }

      @if (tab() === 'tickets') {
        <section class="rep-card">
          <div class="rep-card-header">
            <h2>Tickets de ventas cerradas</h2>
            <a routerLink="/payments/sales" class="rep-text-link">Ir a Ventas</a>
          </div>
          <p class="rep-muted">Se muestran tickets cerrados en el período.</p>
          @if (tickets(); as page) {
            <div class="rep-table-wrap">
              <table class="rep-table">
                <thead>
                  <tr>
                    <th>Venta</th>
                    <th>Orden</th>
                    <th>Modalidad</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of page.data; track row.id) {
                    <tr>
                      <td>{{ row.numero }}</td>
                      <td>{{ row.orden.numero }}</td>
                      <td>{{ modeName(row.orden.modalidad) }}</td>
                      <td>{{ instant(row.cerradaEn) }}</td>
                      <td>{{ money(row.total, currency()) }}</td>
                      <td><a [routerLink]="['/orders/list', row.orden.id]">Ver orden</a></td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6">No hay ventas cerradas.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="rep-pagination">
              <span
                >{{ page.meta.total }} tickets · Página {{ page.meta.page }} de
                {{ page.meta.totalPages || 1 }}</span
              >
              <div class="rep-actions">
                <button
                  type="button"
                  [disabled]="page.meta.page <= 1 || busy()"
                  (click)="pageMove(-1)"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  [disabled]="page.meta.page >= page.meta.totalPages || busy()"
                  (click)="pageMove(1)"
                >
                  Siguiente
                </button>
              </div>
            </div>
          }
        </section>
      }

      @if (tab() === 'cash') {
        <section class="rep-card">
          <div class="rep-card-header">
            <h2>Arqueos y turnos de caja</h2>
            <a routerLink="/payments/cash/history" class="rep-text-link">Historial de caja</a>
          </div>
          @if (shifts(); as page) {
            <div class="rep-table-wrap">
              <table class="rep-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Caja / cajero</th>
                    <th>Estado</th>
                    <th>Esperado</th>
                    <th>Contado</th>
                    <th>Diferencia</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of page.data; track row.id) {
                    <tr>
                      <td>{{ displayDate(row.fechaOperativa) }}</td>
                      <td>
                        {{ row.caja.nombre }}<small>{{ row.cajero.nombre }}</small>
                      </td>
                      <td>{{ row.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado' }}</td>
                      <td>{{ money(row.efectivoEsperado, currency()) }}</td>
                      <td>{{ money(row.efectivoContado, currency()) }}</td>
                      <td>{{ money(row.diferencia, currency()) }}</td>
                      <td><a [routerLink]="['/payments/cash/shift', row.id]">Ver turno</a></td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7">Sin turnos en este período.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="rep-pagination">
              <span
                >{{ page.meta.total }} turnos · Página {{ page.meta.page }} de
                {{ page.meta.totalPages || 1 }}</span
              >
              <div class="rep-actions">
                <button
                  type="button"
                  [disabled]="page.meta.page <= 1 || busy()"
                  (click)="pageMove(-1)"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  [disabled]="page.meta.page >= page.meta.totalPages || busy()"
                  (click)="pageMove(1)"
                >
                  Siguiente
                </button>
              </div>
            </div>
          }
        </section>
      }

      @if (tab() === 'sources') {
        <section class="rep-card">
          <div class="rep-card-header">
            <div>
              <h2>Informes detallados</h2>
              <p class="rep-muted">
                Cada informe tiene controles de acceso propios, además de «reports.read».
              </p>
            </div>
          </div>
          <div class="rep-report-toolbar">
            <div class="rep-field">
              <label for="rep-source">Tipo de informe</label>
              <select
                id="rep-source"
                [value]="source()"
                (change)="chooseSource($any($event.target).value)"
              >
                @for (s of allowedSources(); track s) {
                  <option [value]="s">{{ labels[s] }}</option>
                }
              </select>
            </div>
            <div class="rep-actions">
              <button
                type="button"
                [disabled]="exporting() || !source() || busy()"
                (click)="download('CSV')"
              >
                CSV
              </button>
              <button
                type="button"
                [disabled]="exporting() || !source() || busy()"
                (click)="download('XLSX')"
              >
                Excel
              </button>
              <button
                type="button"
                [disabled]="exporting() || !source() || busy()"
                (click)="download('PDF')"
              >
                PDF
              </button>
            </div>
          </div>
          <p class="rep-footnote">
            Se exporta un conjunto completo de hasta 1,000 registros desde PostgreSQL. Para períodos
            extensos, reduce las fechas.
          </p>
          @if (exportError()) {
            <p role="alert" class="rep-alert">{{ exportError() }}</p>
          }
          @if (sourceData(); as report) {
            @if (report.source === 'SALES_LINES' && report.porProducto?.length) {
              <h3>Productos más vendidos</h3>
              <gc-reports-breakdown-chart
                title="Importe de ventas por producto"
                [currency]="report.currency"
                [rows]="topProducts()"
              />
              <div class="rep-table-wrap">
                <table class="rep-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidades</th>
                      <th>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of report.porProducto.slice(0, 10); track $index) {
                      <tr>
                        <td>{{ row['nombre'] }}</td>
                        <td>{{ row['unidades'] }}</td>
                        <td>{{ money(asText(row['importe']), report.currency) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
            <div class="rep-card-header">
              <h3>Registros: {{ report.meta.total }}</h3>
              <span class="rep-muted">Fuente: {{ labels[report.source] }}</span>
            </div>
            <div class="rep-table-wrap">
              <table class="rep-table">
                <thead>
                  <tr>
                    @for (key of fields(); track key) {
                      <th>{{ human(key) }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of report.data; track $index) {
                    <tr>
                      @for (key of fields(); track key) {
                        <td>{{ value(row[key], key, report.currency) }}</td>
                      }
                    </tr>
                  } @empty {
                    <tr>
                      <td [attr.colspan]="fields().length || 1">
                        Sin registros para este período.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="rep-pagination">
              <span
                >{{ report.meta.total }} registros · Página {{ report.meta.page }} de
                {{ report.meta.totalPages || 1 }}</span
              >
              <div class="rep-actions">
                <button type="button" [disabled]="page() <= 1 || busy()" (click)="pageMove(-1)">
                  Anterior
                </button>
                <button
                  type="button"
                  [disabled]="page() >= report.meta.totalPages || busy()"
                  (click)="pageMove(1)"
                >
                  Siguiente
                </button>
              </div>
            </div>
          } @else if (!allowedSources().length) {
            <p class="rep-muted">
              No tienes permisos adicionales para consultar las fuentes detalladas.
            </p>
          }
        </section>
      }
    }
  </main>`,
})
export class GcReportsAnalyticsPage {
  protected readonly branch = inject(GcBranchContext);
  protected readonly access = inject(ReportsAccess);
  private readonly api = inject(ReportsApi);
  private readonly notice = inject(GcNotificationService);
  protected readonly period = signal<ReportPeriod>('MES');
  protected readonly date = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly tab = signal<Tab>('overview');
  protected readonly page = signal(1);
  protected readonly source = signal<ReportSource>('SALES_LINES');
  protected readonly overview = signal<ReportsOverview | null>(null);
  protected readonly methods = signal<PaymentMethodResponse | null>(null);
  protected readonly expenses = signal<ExpenseCategoryResponse | null>(null);
  protected readonly tickets = signal<ReportPage<ReportTicket> | null>(null);
  protected readonly shifts = signal<ReportPage<ReportCashShift> | null>(null);
  protected readonly sourceData = signal<SourceRecordResponse | null>(null);
  protected readonly error = signal('');
  protected readonly methodError = signal('');
  protected readonly expenseError = signal('');
  protected readonly exportError = signal('');
  protected readonly exporting = signal(false);
  protected readonly busy = signal(false);
  protected readonly money = reportMoney;
  protected readonly labels = REPORT_LABELS;
  protected readonly human = fieldLabel;
  protected readonly value = sourceScalar;
  protected readonly displayDate = formatCalendarDate;
  protected readonly asText = (value: unknown) => (typeof value === 'string' ? value : '0');
  protected readonly allowedSources = computed(() =>
    REPORT_SOURCES.filter((s) => this.access.canSource(s)),
  );
  protected readonly currency = computed(
    () =>
      this.overview()?.currency ??
      this.methods()?.currency ??
      this.expenses()?.currency ??
      this.sourceData()?.currency ??
      'GTQ',
  );
  protected readonly valid = computed(() => periodValid(this.form()));
  protected readonly methodBars = computed(
    () =>
      this.methods()?.data.map((x) => ({ label: this.methodName(x.metodo), amount: x.neto })) ?? [],
  );
  protected readonly expenseBars = computed(
    () =>
      this.expenses()?.data.map((x) => ({
        label: x.categoria + ' · ' + x.tipo,
        amount: x.monto,
      })) ?? [],
  );
  protected readonly topProducts = computed(
    () =>
      this.sourceData()
        ?.porProducto?.slice(0, 10)
        .map((x) => ({
          label: String(x['nombre'] ?? 'Producto'),
          amount: String(x['importe'] ?? '0'),
        })) ?? [],
  );
  protected readonly fields = computed(() => {
    const first = this.sourceData()?.data[0] ?? {};
    return Object.entries(first)
      .filter(
        ([key, value]) =>
          !/(^id$|Id$)/.test(key) &&
          (value === null || ['string', 'number', 'boolean'].includes(typeof value)),
      )
      .slice(0, 7)
      .map(([key]) => key);
  });
  private generation = 0;
  constructor() {
    effect(() => {
      const id = this.branch.branchId(),
        permitted = this.access.canRead();
      untracked(() => {
        this.generation++;
        this.overview.set(null);
        this.methods.set(null);
        this.expenses.set(null);
        this.tickets.set(null);
        this.shifts.set(null);
        this.sourceData.set(null);
        this.page.set(1);
        this.error.set('');
        const available = this.allowedSources();
        if (!available.includes(this.source())) this.source.set(available[0] ?? 'SALES_LINES');
        if (id && permitted) void this.refresh();
      });
    });
  }
  protected form(): ReportFilters {
    return {
      sucursalId: this.branch.branchId() ?? '',
      periodo: this.period(),
      fecha: this.date() || undefined,
      desde: this.from() || undefined,
      hasta: this.to() || undefined,
    };
  }
  protected setPeriod(value: string) {
    if (['DIA', 'SEMANA', 'MES', 'PERSONALIZADO'].includes(value))
      this.period.set(value as ReportPeriod);
  }
  protected methodName(v: string) {
    return (
      (
        {
          EFECTIVO: 'Efectivo',
          TARJETA: 'Tarjeta',
          TRANSFERENCIA: 'Transferencia',
          OTRO: 'Otros',
        } as Record<string, string>
      )[v] ?? v
    );
  }
  protected modeName(v: string) {
    return (
      (
        {
          MOSTRADOR: 'Mostrador',
          MESA: 'Mesa',
          PARA_LLEVAR: 'Para llevar',
          DELIVERY: 'Domicilio',
        } as Record<string, string>
      )[v] ?? v
    );
  }
  protected cashState(value: string) {
    return (
      (
        {
          SIN_CIERRES: 'Sin cierres',
          COMPLETO: 'Todos los arqueos registrados',
          INCOMPLETO: 'Arqueos incompletos',
        } as Record<string, string>
      )[value] ?? ''
    );
  }
  protected instant(date: string) {
    try {
      return formatInstant(
        date,
        this.overview()?.periodo.zonaHoraria ??
          this.branch.active()?.zonaHoraria ??
          'America/Guatemala',
      );
    } catch {
      return date;
    }
  }
  protected selectTab(tab: Tab) {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.page.set(1);
    void this.loadTab();
  }
  protected chooseSource(value: string) {
    if (this.allowedSources().includes(value as ReportSource)) {
      this.source.set(value as ReportSource);
      this.page.set(1);
      void this.loadTab();
    }
  }
  protected pageMove(delta: number) {
    const next = this.page() + delta;
    if (next < 1 || this.busy()) return;
    const pages =
      this.tab() === 'tickets'
        ? this.tickets()?.meta.totalPages
        : this.tab() === 'cash'
          ? this.shifts()?.meta.totalPages
          : this.sourceData()?.meta.totalPages;
    if (pages !== undefined && next > pages) return;
    this.page.set(next);
    void this.loadTab();
  }
  protected async refresh() {
    if (!this.valid() || !this.access.canRead()) return;
    this.page.set(1);
    if (this.tab() === 'overview') await this.loadOverview();
    else await this.loadTab();
  }
  private async loadOverview() {
    const query = asReportQuery(this.form());
    const gen = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.methodError.set('');
    this.expenseError.set('');
    const [overview, methods, expenses] = await Promise.allSettled([
      firstValueFrom(this.api.overview(query)),
      firstValueFrom(this.api.payments(query)),
      firstValueFrom(this.api.expenses(query)),
    ]);
    if (gen !== this.generation || query.sucursalId !== this.branch.branchId()) return;
    if (overview.status === 'fulfilled') this.overview.set(overview.value);
    else {
      this.overview.set(null);
      this.error.set(gcErrorMessage(overview.reason));
    }
    if (methods.status === 'fulfilled') this.methods.set(methods.value);
    else {
      this.methods.set(null);
      this.methodError.set(gcErrorMessage(methods.reason));
    }
    if (expenses.status === 'fulfilled') this.expenses.set(expenses.value);
    else {
      this.expenses.set(null);
      this.expenseError.set(gcErrorMessage(expenses.reason));
    }
    this.busy.set(false);
  }
  private async loadTab() {
    if (!this.valid() || !this.access.canRead()) return;
    const tab = this.tab();
    if (tab === 'overview') {
      await this.loadOverview();
      return;
    }
    const source = this.source();
    if (tab === 'sources' && !this.access.canSource(source)) {
      this.sourceData.set(null);
      return;
    }
    const query = { ...asReportQuery(this.form()), page: this.page(), limit: 20 };
    const gen = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    try {
      if (tab === 'tickets') {
        const data = await firstValueFrom(this.api.tickets(query));
        if (gen === this.generation) this.tickets.set(data);
      } else if (tab === 'cash') {
        const data = await firstValueFrom(this.api.cashShifts(query));
        if (gen === this.generation) this.shifts.set(data);
      } else {
        const data = await firstValueFrom(this.api.source(source, query));
        if (gen === this.generation) this.sourceData.set(data);
      }
    } catch (e) {
      if (gen === this.generation) this.error.set(gcErrorMessage(e));
    } finally {
      if (gen === this.generation) this.busy.set(false);
    }
  }
  protected async download(format: 'CSV' | 'XLSX' | 'PDF') {
    if (!this.valid() || !this.access.canSource(this.source()) || this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    try {
      const response = await firstValueFrom(
        this.api.export(this.source(), asReportQuery(this.form()), format),
      );
      const blob = response.body;
      if (!blob || blob.size === 0) throw new Error('El servidor devolvió un archivo vacío.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        'Gastro_Core_' + this.source() + '_' + this.period() + '.' + format.toLowerCase();
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Firefox may still be starting the file transfer after click() returns.
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      this.notice.show('Reporte generado: ' + format + '.', 'success');
    } catch (e) {
      this.exportError.set(gcErrorMessage(e));
      this.notice.show(gcErrorMessage(e), 'error', 0);
    } finally {
      this.exporting.set(false);
    }
  }
}
