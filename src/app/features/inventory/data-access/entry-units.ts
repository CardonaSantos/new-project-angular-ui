import {formatDecimal,parseApiDecimal} from '../../../shared/formatting';
import type {EntryCost,EntryOption,EntryUnit} from './inventory.models';

/**
 * Entries typed the way things are bought — «2 L at Q20» or «Q40 for 2 L» — instead of
 * «2000 ml at Q0.02». The server does the conversion; this only builds the request and an
 * on-screen preview of what it will book.
 */
export type CostMode='unit'|'total';

export const entryOptionKey=(o:EntryOption)=>(o.tipo==='PRESENTACION'?'P:':'U:')+o.id;

const fmt=(v:string,max=3)=>{try{return formatDecimal(v,{maximumFractionDigits:max})}catch{return v}};
const short=(o:EntryOption)=>o.codigo?o.codigo.toLowerCase():o.nombre;

export function entryOptionLabel(o:EntryOption,base:EntryOption|null):string{
 const unit=base?short(base):'';
 if(o.tipo==='BASE')return `${o.nombre}${o.codigo?' ('+short(o)+')':''} · unidad de inventario`;
 const equals=`= ${fmt(o.factor)} ${unit}`.trim();
 if(o.tipo==='UNIDAD')return `${o.nombre}${o.codigo?' ('+short(o)+')':''} ${equals}`;
 return `${o.nombre} ${equals}${o.proveedor?' · '+o.proveedor:''}`;
}

/** Unit or presentation for the request; the base unit sends nothing, as before. */
export function entryUnitPayload(o:EntryOption|null):EntryUnit{
 if(!o||o.tipo==='BASE')return {};
 return o.tipo==='PRESENTACION'?{presentacionId:o.id}:{unidadId:o.id};
}

export function entryCostPayload(cost:string|undefined,mode:CostMode):EntryCost{
 if(cost===undefined||cost==='')return {};
 return mode==='total'?{costoTotal:cost}:{costoUnitario:cost};
}

/** Name of the chosen unit for labels: «L», «Garrafa 5 galón», «ml». */
export function entryUnitName(o:EntryOption|null,base:EntryOption|null):string{
 const chosen=o??base;
 return chosen?short(chosen):'unidad base';
}

/**
 * «= 2,000 ml · Q0.020000 por ml · total Q40.00». Null while the numbers are incomplete or
 * when nothing needs converting (base unit with cost per unit).
 */
export function entryPreview(o:EntryOption|null,base:EntryOption|null,quantity:string,
 cost:string|undefined,mode:CostMode):string|null{
 if(!base)return null;
 const chosen=o??base;
 if(chosen.tipo==='BASE'&&(mode==='unit'||!cost))return null;
 let q,f;
 try{q=parseApiDecimal(quantity);f=parseApiDecimal(chosen.factor)}catch{return null}
 if(!q.greaterThan(0)||!f.greaterThan(0))return null;
 const baseQty=q.mul(f);
 const parts=[`= ${fmt(baseQty.toFixed(6))} ${short(base)}`];
 if(cost){
  let c;try{c=parseApiDecimal(cost)}catch{return parts[0]}
  const total=mode==='total'?c:c.mul(q);
  parts.push(`Q${total.div(baseQty).toFixed(6)} por ${short(base)}`);
  parts.push(`total Q${fmt(total.toFixed(2),2)}`);
 }
 return parts.join(' · ');
}
