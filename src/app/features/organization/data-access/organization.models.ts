export type ValuationMethod = 'PROMEDIO_PONDERADO' | 'FIFO';
export type DeviceType = 'POS' | 'KDS' | 'QUIOSCO' | 'PANTALLA_TURNOS' | 'IMPRESORA' | 'OTRO';

export interface Company {
  id: string;
  nombreComercial: string;
  razonSocial: string | null;
  nit: string | null;
  moneda: string;
  zonaHoraria: string;
  metodoValoracion: ValuationMethod;
  colorPrimario: string | null;
  logoMediaId: string | null;
  logoUrl: string | null;
  creadoEn: string;
  actualizadoEn: string;
}
export type CompanyUpdate = Partial<Pick<Company,
  | 'nombreComercial' | 'razonSocial' | 'nit' | 'moneda' | 'zonaHoraria' | 'metodoValoracion'
  | 'colorPrimario' | 'logoMediaId'>>;

/** Branding subset visible to every authenticated role, regardless of permissions. */
export interface Branding {
  nombreComercial: string;
  colorPrimario: string | null;
  logoUrl: string | null;
}

export interface CompanyCapabilities {
  companyId: string;
  valuationMethods: ValuationMethod[];
  currencies: string[];
  supportsMultipleBranches: boolean;
  multiTenant: boolean;
}
export interface BranchConfig {
  sucursalId: string;
  horaCorteOperativo: string;
  exigeCobroAntesPreparar: boolean;
  permiteStockNegativo: boolean;
  permiteOrdenesQR: boolean;
  moneda: string;
  actualizadoEn: string;
}
export type ConfigUpdate = Partial<Pick<BranchConfig,
  'horaCorteOperativo' | 'exigeCobroAntesPreparar' |
  'permiteStockNegativo' | 'permiteOrdenesQR' | 'moneda'>>;
export interface Branch {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zonaHoraria: string;
  activa: boolean;
  creadoEn: string;
  actualizadoEn: string;
  configuracion: BranchConfig | null;
}
export type BranchCreate = Pick<Branch, 'codigo' | 'nombre'> &
  Partial<Pick<Branch, 'direccion' | 'telefono' | 'zonaHoraria'>>;
export type BranchUpdate = Partial<Pick<Branch, 'nombre' | 'direccion' | 'telefono' | 'zonaHoraria'>>;
export interface BranchOverview {
  sucursalId: string;
  usuariosAsignados: number;
  dispositivos: number;
  almacenes: number;
  cajas: number;
  estacionesPreparacion: number;
  ordenesAbiertas: number;
  turnosCajaAbiertos: number;
  entregasPendientes: number;
}
export interface Device {
  id: string;
  sucursalId: string;
  codigo: string;
  nombre: string;
  tipo: DeviceType;
  estacionPreparacionId: string | null;
  estacionNombre: string | null;
  ultimoAccesoEn: string | null;
  activo: boolean;
  creadoEn: string;
  sucursal: { id: string; codigo: string; nombre: string; activa: boolean };
}
export type DeviceCreate = Pick<Device, 'sucursalId' | 'codigo' | 'nombre' | 'tipo'> &
  Partial<Pick<Device, 'estacionPreparacionId'>>;
export type DeviceUpdate = Partial<Pick<Device, 'nombre' | 'tipo' | 'estacionPreparacionId'>>;
export interface PageMeta { page: number; limit: number; total: number; totalPages: number }
export interface Paged<T> { data: T[]; meta: PageMeta }
export interface Options<T> { data: T[]; meta: { hasMore: boolean; nextCursor: string | null } }
export interface ListQuery { page?: number; limit?: number; search?: string; activo?: boolean }
export type DeviceQuery = ListQuery & { sucursalId?: string; tipo?: DeviceType };
export interface BranchOption { id: string; label: string; codigo: string; zonaHoraria: string }
export interface DeviceOption { id: string; label: string; codigo: string; tipo: DeviceType; sucursalId: string }
export const DEVICE_TYPES: readonly { value: DeviceType; label: string }[] = [
  { value: 'POS', label: 'Punto de venta' },
  { value: 'KDS', label: 'Pantalla de cocina' },
  { value: 'QUIOSCO', label: 'Quiosco' },
  { value: 'PANTALLA_TURNOS', label: 'Pantalla de turnos' },
  { value: 'IMPRESORA', label: 'Impresora' },
  { value: 'OTRO', label: 'Otro' },
];
export const deviceLabel = (value: DeviceType): string =>
  DEVICE_TYPES.find(item => item.value === value)?.label ?? value;
