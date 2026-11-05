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

/**
 * Only combine truly identical, undiscounted items. Discounts are order-line
 * amounts; merging distinct discounts could silently change the final charge.
 * Modifier order does not change the configuration.
 */
const sortedEqual=(left:readonly string[],right:readonly string[])=>{
 if(left.length!==right.length)return false;
 const a=[...left].sort(),b=[...right].sort();
 return a.every((value,index)=>value===b[index]);
};
const zeroDiscount=(discount:string)=>{
 const value=discount.trim();
 return value!==''&&Number.isFinite(Number(value))&&Number(value)===0;
};
export const sameCartConfiguration=(a:PosCartEntry,b:PosCartEntry)=>
 a.variantId===b.variantId&&a.price===b.price&&a.currency===b.currency&&
 a.notes.trim()===b.notes.trim()&&zeroDiscount(a.discount)&&zeroDiscount(b.discount)&&
 sortedEqual(a.modifierIds,b.modifierIds)&&sortedEqual(a.extras,b.extras);

export type CartInsertResult={
 entries:PosCartEntry[];
 status:'added'|'merged'|'too-many-lines'|'too-many-units';
};
/** Pure cart operation: stable key for merged lines; no mutation of existing entries. */
export const addOrMergeCartEntry=(entries:PosCartEntry[],incoming:PosCartEntry):CartInsertResult=>{
 if(!Number.isInteger(incoming.quantity)||incoming.quantity<1||incoming.quantity>999)
  return {entries,status:'too-many-units'};
 const idx=entries.findIndex(item=>sameCartConfiguration(item,incoming));
 if(idx>=0){
  if(entries[idx].quantity+incoming.quantity>999)return {entries,status:'too-many-units'};
  return {entries:entries.map((item,index)=>index===idx?
   {...item,quantity:item.quantity+incoming.quantity}:item),status:'merged'};
 }
 if(entries.length>=100)return {entries,status:'too-many-lines'};
 return {entries:[...entries,incoming],status:'added'};
};
