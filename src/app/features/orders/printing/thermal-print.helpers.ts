import {formatCurrency,formatDecimal} from '../../../shared/formatting';
import type {KitchenTicket,KitchenLine,OrderLineModifier,OrderDetail,OrderLine} from '../data-access/orders.models';
import type {SaleRecord} from '../../payments/data-access/payments.models';

/** Never attach a currency symbol unless verified from branch configuration. */
export function thermalAmount(value:string,currency:string|null):string{
 if(currency==='GTQ'||currency==='USD')return formatCurrency(value,currency);
 return formatDecimal(value,{minimumFractionDigits:2,maximumFractionDigits:2});
}
export function saleForBranch(sale:SaleRecord,branchId:string|null):boolean{
 return !!branchId&&sale.sucursalId===branchId;
}
export function printableKitchenLines(ticket:KitchenTicket):KitchenLine[]{
 return ticket.comandaLineasComoComanda.filter(line=>!line.canceladaEn);
}
export function kitchenModifierNames(mods:readonly OrderLineModifier[]|null|undefined):string[]{
 return (mods??[]).map(x=>x.cantidad===1?x.nombreSnapshot:
  String(x.cantidad)+' × '+x.nombreSnapshot).filter(Boolean);
}

/** A full operational order includes every non-cancelled line, even those without a kitchen ticket. */
export function printableOrderLines(order:OrderDetail):OrderLine[]{
 return order.ordenLineasComoOrden.filter(line=>!line.canceladaEn);
}
