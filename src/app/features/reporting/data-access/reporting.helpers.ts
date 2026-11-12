import { formatCalendarDate, formatCurrency, formatDecimal } from '../../../shared/formatting';
import type { ReportingFilters, ReportingType } from './reporting.models';

export const REPORTING_LABELS: Record<ReportingType, string> = {
  DAILY: 'Reporte del día',
  SALES: 'Ventas por período',
  CUSTOMERS: 'Clientes',
  INVENTORY: 'Inventario y kardex',
  CASH_SESSIONS: 'Cierre de caja / arqueo',
  PROFITABILITY: 'Rentabilidad por producto y categoría',
};

/** Which filter controls apply to each report type, so the form only shows what's used. */
export interface ReportingFormShape {
  fechaOnly: boolean; // DAILY: a single optional reference date, no periodo
  periodo: boolean; // SALES/INVENTORY/CASH_SESSIONS/PROFITABILITY: DIA/SEMANA/MES/ANIO/PERSONALIZADO
  limite: boolean; // INVENTORY/PROFITABILITY/CUSTOMERS: optional row cap
  soloActivos: boolean; // CUSTOMERS only
}
export function reportingFormShape(type: ReportingType): ReportingFormShape {
  return {
    fechaOnly: type === 'DAILY',
    periodo: type !== 'DAILY' && type !== 'CUSTOMERS',
    limite: type === 'INVENTORY' || type === 'PROFITABILITY' || type === 'CUSTOMERS',
    soloActivos: type === 'CUSTOMERS',
  };
}

export const reportMoney = (amount: string | null | undefined, currency: string): string => {
  if (amount === null || amount === undefined) return 'Sin datos';
  if (currency !== 'GTQ' && currency !== 'USD') {
    return formatDecimal(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
  }
  return formatCurrency(amount, currency);
};

export function reportingPeriodLabel(tipo: string): string {
  return ({ DIA: 'Día', SEMANA: 'Semana', MES: 'Mes', ANIO: 'Año', PERSONALIZADO: 'Personalizado' } as
    Record<string, string>)[tipo] ?? tipo;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  try { formatCalendarDate(value); return true; } catch { return false; }
}

/** Mirrors the backend's own validation (resolveSalesPeriod / DailyReportDto), so the UI
 * never submits a request the server would reject for an obviously bad date. */
export function reportingFiltersValid(type: ReportingType, f: ReportingFilters): boolean {
  if (!f.sucursalId) return false;
  const shape = reportingFormShape(type);
  if (shape.fechaOnly) return !f.fecha || validDate(f.fecha);
  if (!shape.periodo) return true; // CUSTOMERS: no date filter at all
  if (f.periodo === 'PERSONALIZADO') {
    if (!f.desde || !f.hasta || !validDate(f.desde) || !validDate(f.hasta)) return false;
    const days = Math.round((Date.parse(f.hasta + 'T00:00:00Z') - Date.parse(f.desde + 'T00:00:00Z')) / 86400000) + 1;
    return days >= 1 && days <= 366;
  }
  return !f.fecha || validDate(f.fecha);
}

/** Each report endpoint only accepts its own subset of fields (see the backend DTOs) —
 * sending the rest would be harmless (Nest DTOs strip unknown fields) but this keeps the
 * request bodies honest and easy to read in the network tab. */
export function buildReportingQuery(type: ReportingType, f: ReportingFilters): Record<string, string | number | boolean | undefined> {
  const shape = reportingFormShape(type);
  if (shape.fechaOnly) return { sucursalId: f.sucursalId, fecha: f.fecha || undefined };
  if (!shape.periodo) {
    // CUSTOMERS
    return { sucursalId: f.sucursalId, soloActivos: f.soloActivos, limite: f.limite };
  }
  const base: Record<string, string | number | boolean | undefined> = { sucursalId: f.sucursalId, periodo: f.periodo };
  if (f.periodo === 'PERSONALIZADO') { base['desde'] = f.desde; base['hasta'] = f.hasta; }
  else if (f.fecha) base['fecha'] = f.fecha;
  if (shape.limite) base['limite'] = f.limite;
  return base;
}

export function reportingFilename(type: ReportingType, sucursalId: string, periodo: { desde: string; hasta: string }, format: string): string {
  return 'Gastro_Core_' + type + '_' + sucursalId + '_' + periodo.desde + '_' + periodo.hasta + '.' + format.toLowerCase();
}
