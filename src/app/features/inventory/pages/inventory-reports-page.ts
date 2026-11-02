
import {Component,computed,effect,inject,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcInventoryNav} from '../inventory-nav';
import {InventoryApi} from '../data-access/inventory.api';
import {InventoryUrlState} from '../data-access/inventory-url-state';

import {GcDataTable,type GcTableColumn} from '../../../design-system/data/gc-data-table';
import {inventoryCalendar,inventoryMoney,inventoryValuationRows,valuationMethod} from '../data-access/inventory-presentation';
function valuationRowsMissingNames(rows:ReturnType<typeof inventoryValuationRows>):boolean{
 return rows.some(row=>row.nombre==='Nombre no proporcionado por el servidor');
}
type Report='masters'|'valuation'|'expiry'|'reconciliation';
const names:Record<Report,string>={
 masters:'Maestros',valuation:'Valoración',expiry:'Vencimientos',reconciliation:'Conciliación'
};
const TRANSLATIONS:Record<string,string>={
 sucursalId:'Sucursal',metodoValoracion:'Método de valoración',
 valorInventario:'Valor del inventario',conciliado:'Conciliado',nota:'Observación',
 cantidad:'Cantidad',codigo:'Código',nombre:'Nombre',estado:'Estado',
 articuloId:'Artículo',fechaVencimiento:'Vencimiento',valor:'Valor',
 totalArticulos:'Artículos',total:'Total'
};
function caption(name:string):string{return TRANSLATIONS[name]??name.replace(/([a-z])([A-Z])/g,'$1 $2')
 .replace(/^./,s=>s.toUpperCase())}
function valueText(value:unknown,key:string):string {
 if(value===null||value===undefined)return '—';
 if(typeof value==='boolean')return value?'Sí':'No';
 if(typeof value==='string'){
  if(key==='vencimiento'||key==='fechaVencimiento')return inventoryCalendar(value);
  if(/^(valor|costo|importe)/i.test(key))return inventoryMoney(value);
  return value;
 }
 if(typeof value==='number')return String(value);
 return '—';
}
@Component({
 selector:'gc-inventory-reports-page',
 providers:[InventoryUrlState],
 imports:[GcPageHeader,GcButtonDirective,GcErrorState,GcInventoryNav,GcDataTable],
 template:`
 <div class="inv-page">
  <gc-page-header title="Reportes de inventario"/>
  <gc-inventory-nav/>
  <section class="inv-card">
   <div class="inv-row">
    <nav class="inv-subnav" aria-label="Tipo de reporte">
     @for(option of types;track option){
      @if(option!=='valuation'||canCosts()){
      <button gcButton type="button" [variant]="type()===option?'primary':'outline'"
       (click)="choose(option)">{{labels[option]}}</button>
      }
     }
    </nav>
    <div class="inv-field"><label for="inv-report-branch">Sucursal</label>
     <select id="inv-report-branch" [value]="url.filters().sucursalId"
      (change)="selectBranch($any($event.target).value)">
      @for(item of branch.branches();track item.id){<option [value]="item.id">{{item.nombre}}</option>}
     </select>
    </div>
   </div>
   @if(page.busy()&&!page.data()){<p role="status" class="inv-muted">Calculando reporte…</p>}
   @else if(page.busy()){<p role="status" class="inv-muted">Actualizando reporte…</p>}
   @if(page.status()==='error'){<gc-error-state [message]="readError()" (retry)="reload()"/>}
   @if(page.data();as data){
    @if(type()==='valuation'){
     <div class="inv-valuation-summary">
      <div><span class="inv-muted">Valor total del inventario físico</span>
       <strong>{{money(data['valorInventario'])}}</strong></div>
      <div><span class="inv-muted">Método de valoración</span>
       <strong class="inv-valuation-method">{{method(data['metodoValoracion'])}}</strong></div>
     </div>
     <div class="inv-row">
      <h2>Valor por artículo</h2>
      <span class="inv-muted">{{valuationRows().length}} artículos</span>
     </div>
     @if(valuationMissingNames()){
      <p class="inv-alert" role="status">El servidor todavía no proporciona nombres de artículos en este reporte. Actualiza el backend para visualizar los nombres y códigos.</p>
     }
     <gc-data-table [rows]="valuationRows()" [columns]="valuationColumns"/>
     @if(data['nota']){<p class="inv-muted">{{data['nota']}}</p>}
    } @else {
     <dl class="inv-kv">
      @for(item of metrics();track item.key){
       <div><dt>{{human(item.key)}}</dt><dd>{{show(item.value,item.key)}}</dd></div>
      }
     </dl>
     @for(group of groups();track group.key){
      <div class="inv-stack">
       <div class="inv-row"><h3>{{human(group.key)}}</h3>
        <span class="inv-muted">{{group.items.length}} elementos</span></div>
       @for(item of group.items.slice(0,visible());track $index){
        <dl class="inv-kv inv-card">
         @for(pair of objectEntries(item);track pair.key){
          <div><dt>{{human(pair.key)}}</dt><dd>{{show(pair.value,pair.key)}}</dd></div>
         }
        </dl>
       }
       @if(group.items.length>visible()){
        <button type="button" gcButton variant="outline" (click)="visible.update(n=>n+25)">
         Mostrar más ({{group.items.length-visible()}} restantes)
        </button>
       }
      </div>
     }
     @if(!metrics().length&&!groups().length){<p class="inv-muted">El reporte no devolvió registros.</p>}
    }
   }
  </section>
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventoryReportsPage {
 protected readonly branch=inject(GcBranchContext);
 protected readonly url=inject(InventoryUrlState);
 private readonly api=inject(InventoryApi);
 protected readonly access=inject(OrganizationAccess);
 protected readonly page=new GcPageState<Record<string,unknown>>();
 protected readonly types:readonly Report[]=['masters','valuation','expiry','reconciliation'];
 protected readonly labels=names;
 protected readonly money=inventoryMoney;
 protected readonly method=valuationMethod;
 protected readonly valuationColumns:GcTableColumn[]=[
  {key:'nombre',label:'Artículo'},{key:'codigo',label:'Código'},
  {key:'valor',label:'Valor (GTQ)',numeric:true},
 ];
 protected readonly type=computed<Report>(()=>this.types.includes(this.url.filters().tipo as Report)?
  this.url.filters().tipo as Report:'masters');
 protected readonly visible=signal(25);
 protected readonly valuationRows=computed(()=>inventoryValuationRows(this.page.data()??{}));
 protected readonly valuationMissingNames=computed(()=>valuationRowsMissingNames(this.valuationRows()));
 protected readonly metrics=computed(()=>Object.entries(this.page.data()??{})
  .filter(([,value])=>value===null||['string','number','boolean'].includes(typeof value))
  .filter(([key])=>!/(^id$|Id$)/.test(key))
  .map(([key,value])=>({key,value})));
 protected readonly groups=computed(()=>Object.entries(this.page.data()??{})
  .filter(([,value])=>Array.isArray(value))
  .map(([key,value])=>({key,items:value as unknown[]})));
 constructor(){
  effect(()=>{const f=this.url.filters(),type=this.type();
   if(type==='valuation'&&!this.canCosts())return;
   if(type==='masters'||f.sucursalId)void this.load(type,f.sucursalId)
  });
 }
 protected canCosts(){return this.access.canGlobal('inventory.costs.read')||this.branch.has('inventory.costs.read')}
 protected human(key:string){return caption(key)}
 protected show(value:unknown,key:string){return valueText(value,key)}
 protected objectEntries(value:unknown){
  if(value===null||typeof value!=='object')return [{key:'Resultado',value}];
  return Object.entries(value).filter(([key,v])=>!/(^id$|Id$)/.test(key) &&
    (v===null||['string','boolean','number'].includes(typeof v))).map(([key,v])=>({key,value:v}));
 }
 protected choose(type:Report){this.visible.set(25);void this.url.patch({tipo:type})}
 protected selectBranch(id:string){this.visible.set(25);void this.url.patch({sucursalId:id})}
 protected readError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load(this.type(),this.url.filters().sucursalId)}
 private async load(type:Report,branch:string){
  await this.page.load(()=>firstValueFrom(this.api.report(type,{sucursalId:branch||undefined})));
 }
}
