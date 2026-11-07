export type ReservationState='PENDIENTE'|'CONFIRMADA'|'CANCELADA'|'COMPLETADA'|'NO_ASISTIO';

export interface ReservationPage<T>{data:T[];meta:{page:number;limit:number;total:number;totalPages:number}}

export interface ReservationSummary{
 id:string;nombreContacto:string;telefonoContacto:string|null;personas:number;
 inicio:string;fin:string;estado:ReservationState;clienteId:string|null;
}

export interface ReservationTable{id:string;numero:string;capacidad:number;sala:{id:string;nombre:string}}

export interface ReservationEvent{id:string;tipo:string;creadoEn:string;detalle:string|null}

export interface ReservationOccupancy{id:string;mesaId:string;cerradaEn:string|null}

export interface ReservationDetail{
 id:string;sucursalId:string;nombreContacto:string;telefonoContacto:string|null;
 emailContacto:string|null;personas:number;inicio:string;fin:string;estado:ReservationState;
 clienteId:string|null;notas:string|null;faseAtencion:string;
 mesas:ReservationTable[];capacidadAsignada:number;
 ocupaciones:ReservationOccupancy[];eventos:ReservationEvent[];
}

export interface AvailableTable{
 id:string;numero:string;capacidad:number;sala:{id:string;nombre:string};
 disponible:boolean;motivo:'RESERVADA'|'OCUPADA'|null;
 reservaConflictoId:string|null;ocupacionId:string|null;
}
