// Mirrors self-service/application/contracts/self-service.types.ts on the backend.

export interface SelfServiceAccess {
  sessionToken: string;
  sesionId: string;
  expiraEn: string;
  sucursal: { id: string; nombre: string; moneda: string };
  mesa: { id: string; numero: string; sala: string };
}

export interface SelfServiceModifierOption { id: string; nombre: string; recargo: string; }
export interface SelfServiceModifierGroup {
  grupoId: string; grupo: string; orden: number; minimo: number; maximo: number;
  opciones: SelfServiceModifierOption[];
}
export interface SelfServiceMenuItem {
  id: string; varianteId: string; nombre: string; descripcion: string | null;
  precio: string; moneda: string; imagenUrl: string | null;
  /** Full gallery (variant photos first, then product photos) for a detail carousel;
   * already includes imagenUrl as its first element when non-empty. */
  imagenes: string[];
  gruposModificadores: SelfServiceModifierGroup[];
}
export interface SelfServiceMenuSection { id: string; nombre: string; orden: number; items: SelfServiceMenuItem[]; }
export interface SelfServiceMenuCard { id: string; nombre: string; descripcion: string | null; secciones: SelfServiceMenuSection[]; }
export interface SelfServiceMenuResponse { sucursalId: string; menus: SelfServiceMenuCard[]; }

/** What the customer is building before sending: one line per tap, modifiers
 * selected by id. Kept client-side until /order/items is actually called. */
export interface SelfServiceDraftLine {
  key: string; // local-only, for @for trackBy — not sent to the server
  varianteId: string;
  nombre: string;
  precio: string;
  cantidad: number;
  modificadores: SelfServiceModifierOption[];
  notasCocina?: string;
}

// Mirrors self-service/application/contracts/self-service.types.ts's
// SelfServiceOrderSummary/SelfServiceCart — already a customer-safe projection
// built server-side (shapeOrder() in self-service.store.ts), not the raw order.
export interface SelfServiceOrderLineModifier { nombre: string; cantidad: number; recargoUnitario: string; }
export interface SelfServiceOrderLine {
  id: string; nombre: string; cantidad: string; precioUnitario: string; descuento: string;
  subtotal: string; notasCocina: string | null; modificadores: SelfServiceOrderLineModifier[];
  /** true once any part of this line has gone to the kitchen: the backend then refuses
   * quantity edits (añada una nueva línea) though it can still be removed/cancelled
   * while not yet in preparation. */
  enviada: boolean;
}
export interface SelfServiceOrderSummary {
  id: string; numero: string; estado: 'ABIERTA' | 'CERRADA' | 'CANCELADA';
  subtotal: string; descuentoTotal: string; total: string; lineas: SelfServiceOrderLine[];
}
export interface SelfServiceCart { ordenId: string | null; orden: SelfServiceOrderSummary | null; }
