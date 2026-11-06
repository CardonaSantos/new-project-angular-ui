
export interface FinancePage<T>{data:T[];meta:{page:number;limit:number;total:number;totalPages:number};nota?:string}

export type FinanceAccountType='BANCO'|'TARJETA_EMPRESA'|'EFECTIVO_EXTERNO';
export interface FinanceAccount{
 id:string;sucursalId:string|null;nombre:string;tipo:FinanceAccountType;
 moneda:string;activa:boolean;saldoRegistrado:string;nota?:string;
}
export interface FinanceMovement{
 id:string;cuentaId:string;monto:string;referenciaTipo:string;referenciaId:string|null;
 descripcion:string|null;creadoEn:string;
}

export type FinanceExpenseOrigin='CAJA'|'CUENTA_FINANCIERA';
export type FinanceExpenseState='REGISTRADO'|'REVERSADO';
export interface FinanceExpense{
 id:string;sucursalId:string;usuarioId:string;tipo:string;categoria:string|null;
 descripcion:string;monto:string;documentoReferencia:string|null;
 proveedorId:string|null;turnoId:string|null;cuentaFinancieraId:string|null;
 registradoEn:string;estadoFinanciero:FinanceExpenseState;
}
export interface FinanceExpenseDetail extends FinanceExpense{
 reversa:{id:string;movimientoReversaId:string;motivo:string;creadaEn:string}|null;
 movimientoFinanciero:FinanceMovement|null;
}

export type FinanceExternalSourceType='PAGO'|'REEMBOLSO_PAGO'|'PAGO_PROVEEDOR';
export type FinanceExternalState='PENDIENTE_CUENTA'|'REGISTRADO';
export interface FinancePendingExternal{
 sourceType:FinanceExternalSourceType;sourceId:string;metodo:string;
 monto:string;referencia:string|null;fecha:string;
 estado:FinanceExternalState;cuentaFinancieraId:string|null;movimientoId:string|null;
}

export type FinanceRouteMethod='TARJETA'|'TRANSFERENCIA'|'OTRO';
export interface FinanceRoute{
 id:string;sucursalId:string;metodo:FinanceRouteMethod;
 cuentaFinancieraId:string;cuentaNombre:string;activa:boolean;actualizadoEn:string;
}

export type FinanceIntentAction='FIN_ACCOUNT_CREATE'|'FIN_EXPENSE_CREATE'|'FIN_EXTERNAL_POST'|
 'FIN_ROUTING_UPSERT'|'FIN_DAY_CLOSE'|'FIN_STATEMENT_IMPORT'|'FIN_STATEMENT_MATCH'|
 'FIN_STATEMENT_UNMATCH'|'FIN_LEDGER_REVERSE';
export interface FinanceIntent{operationId:string;accion:FinanceIntentAction;sucursalId:string;expiresAt:string}
