import type {OrderLineInput} from '../data-access/orders.models';
export interface PosCartEntry{
 key:string;variantId:string;name:string;variant:string;price:string;currency:string;
 quantity:number;extras:string[];modifierIds:string[];notes:string;discount:string;
}
export const asOrderLine=(entry:PosCartEntry):OrderLineInput=>({
 varianteId:entry.variantId,cantidad:String(entry.quantity),
 modificadores:entry.modifierIds.map(modificadorId=>({modificadorId})),
 ...(entry.discount!=='0'&&entry.discount!==''?{descuento:entry.discount}:{}),
 ...(entry.notes.trim()?{notasCocina:entry.notes.trim()}:{})
});
