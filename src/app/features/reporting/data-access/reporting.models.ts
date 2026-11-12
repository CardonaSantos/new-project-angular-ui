/** Mirrors backend src/modules/report-exports/application/ports/*.port.ts (main 3fc2b24). */
export type ReportingPeriod = 'DIA' | 'SEMANA' | 'MES' | 'ANIO' | 'PERSONALIZADO';
export type ReportingFormat = 'XLSX' | 'PDF';
export const REPORTING_TYPES = [
  'DAILY', 'SALES', 'CUSTOMERS', 'INVENTORY', 'CASH_SESSIONS', 'PROFITABILITY',
] as const;
export type ReportingType = typeof REPORTING_TYPES[number];

/** What the filter form may send; each report type only accepts a subset — see
 * reporting.helpers.ts#buildReportingQuery. */
export interface ReportingFilters {
  sucursalId: string;
  periodo: ReportingPeriod;
  fecha?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
  soloActivos?: boolean;
}
export interface ReportingBranch { id: string; nombre: string }
export interface ReportingPeriodo { tipo: string; desde: string; hasta: string }

// ---- Reporte del día ----
export interface DailyReportSnapshot {
  sucursal: ReportingBranch; currency: string; fecha: string;
  zonaHoraria: 'America/Guatemala'; generatedAt: string;
  ventas: {
    totalBruto: string; descuentos: string; totalNeto: string; cantidadVentas: number;
    porMetodoPago: Array<{ metodo: string; cobrado: string; reembolsado: string; neto: string; cantidad: number }>;
  };
  ordenes: {
    abiertasHoyPorEstado: Array<{ estado: string; cantidad: number }>;
    cerradasHoy: number; canceladasHoy: number;
    porModalidad: Array<{ modalidad: string; cantidad: number }>;
  };
  clientes: {
    atendidosHoy: number; nuevosHoy: number;
    topGasto: Array<{ clienteId: string; nombre: string; totalGastado: string; cantidadVentas: number }>;
  };
  ganancias: {
    ventasNetas: string; costoConsumoInventario: string; margenBrutoEstimado: string; nota: string;
  };
  caja: {
    entradas: string; salidas: string;
    gastosPorCategoria: Array<{ categoria: string; total: string }>;
    turnos: {
      total: number; abiertos: number; cerrados: number;
      fondoInicial: string; efectivoEsperado: string; efectivoContado: string; diferencia: string;
    };
  };
  inventario: {
    movimientosPorTipo: Array<{ tipo: string; cantidad: string; costoTotal: string }>;
    topArticulos: Array<{ articuloId: string; nombre: string; costoTotalMovido: string }>;
  };
  reservaciones: {
    porEstado: Array<{ estado: string; cantidad: number }>;
    llevadasACabo: Array<{ id: string; nombreContacto: string; personas: number; inicio: string; estado: string }>;
  };
}

// ---- Reporte de ventas ----
export interface SalesReportDay {
  fecha: string; ventasBrutas: string; descuentos: string; ventasNetas: string; cantidadVentas: number;
  cobrado: string; reembolsado: string; dineroEntrante: string; ordenesCerradas: number;
}
export interface SalesReportSnapshot {
  sucursal: ReportingBranch; currency: string; periodo: ReportingPeriodo; generatedAt: string;
  resumen: {
    ventasBrutas: string; descuentos: string; ventasNetas: string; cantidadVentas: number;
    cobrado: string; reembolsado: string; dineroEntrante: string; ordenesCerradas: number;
    ordenesCanceladas: number;
  };
  porMetodoPago: Array<{ metodo: string; cobrado: string; reembolsado: string; neto: string; cantidad: number }>;
  serieDiaria: SalesReportDay[];
}

// ---- Reporte de clientes ----
export interface CustomerReportRow {
  clienteId: string; nombre: string; nit: string; telefono: string; email: string;
  activo: boolean; registradoEn: string; notas: string;
  direccionPrincipal: string; cantidadDirecciones: number;
  cantidadVentas: number; totalGastado: string; ticketPromedio: string;
  primeraCompra: string; ultimaCompra: string;
  cantidadOrdenes: number; ordenesCanceladas: number;
  cantidadReservas: number; reservasNoAsistio: number;
}
export interface CustomerReportSnapshot {
  sucursal: ReportingBranch; currency: string; generatedAt: string;
  filtros: { soloActivos: boolean; limite: number };
  resumen: { totalClientes: number; clientesActivos: number; clientesInactivos: number; clientesConCompras: number };
  clientes: CustomerReportRow[];
}

// ---- Reporte de inventario / kardex ----
export interface StockRow { articuloId: string; nombre: string; tipo: string; cantidadActual: string; valorActual: string }
export interface KardexLine {
  fecha: string; articulo: string; tipo: string; cantidad: string; costoUnitario: string;
  costoTotal: string; referenciaTipo: string; nota: string;
}
export interface InventoryReportSnapshot {
  sucursal: ReportingBranch; currency: string; periodo: ReportingPeriodo; generatedAt: string;
  resumen: {
    articulosConStock: number; valorTotalInventario: string;
    movimientosPorTipo: Array<{ tipo: string; cantidad: string; costoTotal: string }>;
  };
  stockActual: StockRow[];
  topMovidos: Array<{ articuloId: string; nombre: string; costoTotalMovido: string }>;
  kardex: KardexLine[];
  kardexTruncado: boolean;
}

// ---- Reporte de cierre de caja / arqueo ----
export interface CashSessionRow {
  turnoId: string; caja: string; cajero: string; fechaOperativa: string;
  abiertaEn: string; cerradaEn: string; estado: 'ABIERTO' | 'CERRADO';
  fondoInicial: string; efectivoEsperado: string; efectivoContado: string; diferencia: string;
  fuenteArqueo: 'ARQUEO_CAJA' | 'TURNO_CAJA' | 'SIN_DATOS';
  realizadoPor: string; notaArqueo: string;
  porMetodoPago: Array<{ metodo: string; monto: string; cantidad: number }>;
  ingresos: string; egresos: string; gastosDelTurno: string;
}
export interface CashSessionReportSnapshot {
  sucursal: ReportingBranch; currency: string; periodo: ReportingPeriodo; generatedAt: string;
  resumen: {
    totalTurnos: number; abiertos: number; cerrados: number;
    fondoInicial: string; efectivoEsperado: string; efectivoContado: string; diferencia: string;
    turnosConDiferencia: number;
  };
  turnos: CashSessionRow[];
}

// ---- Reporte de rentabilidad por producto / categoría ----
export interface ProfitabilityProductRow {
  productoId: string; productoNombre: string;
  categoriaId: string | null; categoriaNombre: string;
  cantidadVendida: string; ingresoBruto: string; descuentos: string; ingresoNeto: string;
  costo: string; margen: string; margenPct: string;
  lineasConCosto: number; lineasTotal: number;
}
export interface ProfitabilityCategoryRow {
  categoriaId: string | null; categoriaNombre: string; productos: number;
  cantidadVendida: string; ingresoBruto: string; descuentos: string; ingresoNeto: string;
  costo: string; margen: string; margenPct: string;
  lineasConCosto: number; lineasTotal: number;
}
export interface ProfitabilityReportSnapshot {
  sucursal: ReportingBranch; currency: string; periodo: ReportingPeriodo; generatedAt: string;
  resumen: {
    ingresoNeto: string; costo: string; margen: string; margenPct: string;
    lineasConCosto: number; lineasTotal: number; costoCompleto: boolean;
  };
  categorias: ProfitabilityCategoryRow[];
  productos: ProfitabilityProductRow[];
  productosTruncado: boolean;
}

export interface ReportingSnapshotMap {
  DAILY: DailyReportSnapshot;
  SALES: SalesReportSnapshot;
  CUSTOMERS: CustomerReportSnapshot;
  INVENTORY: InventoryReportSnapshot;
  CASH_SESSIONS: CashSessionReportSnapshot;
  PROFITABILITY: ProfitabilityReportSnapshot;
}
