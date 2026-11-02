import {Component,computed,inject,signal,OnInit} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcCatalogNav} from '../catalog-nav';
import {CatalogAccess} from '../data-access/catalog-access';
import {CatalogApi} from '../data-access/catalog.api';
import type {CatalogVariant,CatalogModifier,CatalogPrice,CatalogQuote,CatalogResolvedPrice} from '../data-access/catalog.models';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {formatCurrency,formatInstant,toApiDecimal} from '../../../shared/formatting';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';

function localTimeInput():string{
 const d=new Date(),local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
 return local.toISOString().slice(0,16);
}
function positivePrice(raw:string):string{
 const value=toApiDecimal(raw);
 if(!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value))throw new Error('El precio admite como máximo dos decimales.');
 return value;
}
@Component({
 selector:'gc-catalog-prices-page',imports:[GcCatalogNav,GcErrorState],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <section class="cat-card">
   <div class="cat-row"><h2>Precios comerciales</h2>
    <label class="cat-field">Sucursal
     <select [value]="branchId()" (change)="selectBranch($any($event.target).value)">
      @for(b of branch.branches();track b.id){<option [value]="b.id" [selected]="b.id===branchId()">{{b.nombre}}</option>}
     </select>
    </label>
   </div>
   <p class="cat-muted">Los precios son específicos de cada sucursal. Un precio nuevo conserva el historial anterior y no modifica las ventas ya registradas.</p>
   <div class="cat-toolbar">
    <label class="cat-field">Tipo de precio
     <select [value]="mode()" (change)="setMode($any($event.target).value)">
      <option value="variant">Presentaciones de productos</option><option value="modifier">Extras</option>
     </select>
    </label>
    <label class="cat-field">Buscar
     <input [value]="search()" (input)="search.set($any($event.target).value)" (keyup.enter)="loadOptions()"
      placeholder="Nombre, producto o SKU"/>
    </label>
    <button type="button" (click)="loadOptions()">Buscar</button>
   </div>
   <label class="cat-field">Seleccionar {{mode()==='variant'?'presentación':'extra'}}
    <select [value]="entityId()" (change)="selectEntity($any($event.target).value)">
     <option value="">Seleccionar</option>
     @if(mode()==='variant'){
      @for(item of variants();track item.id){
       <option [value]="item.id" [selected]="item.id===entityId()">{{item.label??(item.producto?.nombre+' · '+item.nombre)}}</option>
      }
     } @else {
      @for(item of modifiers();track item.id){<option [value]="item.id" [selected]="item.id===entityId()">{{item.grupo?.nombre}} · {{item.nombre}}</option>}
     }
    </select>
   </label>
   @if(optionsMore()){<p class="cat-muted">Mostrando resultados iniciales. Refina la búsqueda para encontrar otros.</p>}
   @if(loading()){<p role="status" class="cat-muted">Consultando precios…</p>}
   @if(error()){<gc-error-state [message]="error()!" (retry)="reload()"/>}
  </section>
  @if(entityId()&&branchId()){
   <section class="cat-card">
    <h2>Precio vigente</h2>
    @if(mode()==='variant'){
     @if(resolved();as r){
      <div class="cat-row"><strong>{{r.importe===null?'Sin precio vigente':money(r.importe,r.moneda)}}</strong>
       <span>{{r.habilitada?'Habilitada':'No disponible comercialmente'}}</span></div>
      @if(r.motivo){<p class="cat-muted">{{r.motivo==='SIN_PRECIO'?'Falta registrar un precio para esta sucursal.':'La venta está deshabilitada para esta sucursal.'}}</p>}
     }
    } @else {
     <p class="cat-muted">El recargo vigente se obtiene del historial por sucursal.</p>
    }
    @if(history().length){
     <div class="cat-table-wrap"><table class="cat-table"><thead><tr>
      <th>Importe</th><th>Desde</th><th>Hasta</th>
     </tr></thead><tbody>
      @for(item of history();track item.id){
       <tr><td>{{money(item.importe,'GTQ')}}</td>
        <td>{{date(item.vigenteDesde)}}</td>
        <td>{{item.vigenteHasta?date(item.vigenteHasta):'Sin fecha de finalización'}}</td></tr>
      }
     </tbody></table></div>
    } @else {<p class="cat-muted">Sin precios históricos para esta sucursal.</p>}
   </section>
   @if(access.canPrices()){
    <section class="cat-card">
     <h2>Programar un nuevo precio</h2>
     <p class="cat-muted">El importe nuevo se registra con fecha de inicio. Si ya existe otro precio para esas fechas, tendrás que elegir un período diferente.</p>
     <form class="cat-form" (submit)="save($event)">
      <label>Precio en quetzales
       <input inputmode="decimal" [value]="amount()" (input)="amount.set($any($event.target).value)" required
        placeholder="28.00"/>
      </label>
      <label>Vigente desde (hora de este equipo)
       <input type="datetime-local" [value]="from()" (input)="from.set($any($event.target).value)" required/>
      </label>
      <label>Vigente hasta (opcional)
       <input type="datetime-local" [value]="to()" (input)="to.set($any($event.target).value)"/>
      </label>
      <p class="cat-muted">Se guardarán instantes exactos ISO. Verifica la zona horaria de este equipo si programas precios futuros.</p>
      <button type="submit" class="cat-primary" [disabled]="loading()||!amount()||!from()">Registrar precio</button>
     </form>
    </section>
   }
   @if(mode()==='variant'){
    <section class="cat-card">
     <h2>Cotizar una selección</h2>
     <p class="cat-muted">Elige los extras para calcular cuánto costaría esta presentación.</p>
     @if(linkedGroups().length){
      @for(group of linkedGroups();track group.grupoId){
       <fieldset class="cat-options"><legend>{{group.grupo?.nombre??'Extras'}} · Mín. {{group.grupo?.minimo??0}}</legend>
        @for(mod of group.grupo?.modificadoresComoGrupo??[];track mod.id){
         @if(mod.activo){<label class="cat-check"><input type="checkbox" [checked]="selectedModifiers().includes(mod.id)"
          (change)="toggleModifier(mod.id,$any($event.target).checked)"/>
          {{mod.nombre}}</label>}
        }
       </fieldset>
      }
     } @else {<p class="cat-muted">Esta presentación todavía no tiene extras asignados.</p>}
     <button class="cat-primary" type="button" (click)="quote()" [disabled]="loading()">Calcular total</button>
     @if(quoteResult();as result){
      <div class="cat-metrics">
       <div class="cat-metric"><strong>{{money(result.precioBase,result.moneda)}}</strong><span>Precio base</span></div>
       <div class="cat-metric"><strong>{{money(result.total,result.moneda)}}</strong><span>Total cotizado</span></div>
      </div>
      @for(item of result.modificadores;track item.modificadorId){
       <p>{{item.nombre}} · {{money(item.incremento,result.moneda)}}</p>
      }
     }
    </section>
   }
  }
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogPricesPage implements OnInit{
 protected readonly branch=inject(GcBranchContext);
 protected readonly access=inject(CatalogAccess);
 private readonly api=inject(CatalogApi);
 private readonly notice=inject(GcNotificationService);
 private readonly confirm=inject(ConfirmDialogService);
 protected readonly branchId=signal('');
 protected readonly mode=signal<'variant'|'modifier'>('variant');
 protected readonly search=signal('');
 protected readonly variants=signal<CatalogVariant[]>([]);
 protected readonly modifiers=signal<CatalogModifier[]>([]);
 protected readonly optionsMore=signal(false);
 protected readonly entityId=signal('');
 protected readonly history=signal<CatalogPrice[]>([]);
 protected readonly resolved=signal<CatalogResolvedPrice|null>(null);
 protected readonly quoteResult=signal<CatalogQuote|null>(null);
 protected readonly selectedVariant=signal<CatalogVariant|null>(null);
 protected readonly selectedModifiers=signal<string[]>([]);
 protected readonly amount=signal('');
 protected readonly from=signal(localTimeInput());
 protected readonly to=signal('');
 protected readonly loading=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly linkedGroups=computed(()=>this.selectedVariant()?.varianteGrupoModificadoresComoVariante??[]);
 async ngOnInit(){this.branchId.set(this.branch.branchId()??this.branch.branches()[0]?.id??'');await this.loadOptions()}
 protected date(v:string){try{return formatInstant(v,this.branch.branches().find(b=>b.id===this.branchId())?.zonaHoraria??'America/Guatemala')}catch{return '—'}}
 protected money(v:string,moneda:string){try{return formatCurrency(v,moneda==='USD'?'USD':'GTQ')}catch{return '—'}}
 protected setMode(v:string){this.mode.set(v==='modifier'?'modifier':'variant');this.selectEntity('');void this.loadOptions()}
 protected selectBranch(v:string){this.branchId.set(v);void this.reload()}
 protected async loadOptions(){
  this.loading.set(true);this.error.set(null);
  try{
   if(this.mode()==='variant'){
    const r=await firstValueFrom(this.api.variantOptions({sucursalId:this.branchId()||undefined,
     search:this.search().trim(),limit:50}));
    this.variants.set(r.data);this.optionsMore.set(r.meta.hasMore);
   }else{
    const r=await firstValueFrom(this.api.modifiers({search:this.search().trim(),limit:100,page:1}));
    this.modifiers.set(r.data);this.optionsMore.set(r.meta.total>r.data.length);
   }
  }catch(e){this.error.set(gcErrorMessage(e))}finally{this.loading.set(false)}
 }
 protected selectEntity(id:string){this.entityId.set(id);this.quoteResult.set(null);
  this.selectedModifiers.set([]);void this.reload()}
 protected async reload(){
  if(!this.entityId()||!this.branchId())return;
  const id=this.entityId(),branch=this.branchId();
  this.loading.set(true);this.error.set(null);
  try{
   if(this.mode()==='variant'){
    const [hist,price,variant]=await Promise.all([
     firstValueFrom(this.api.variantPriceHistory(id,branch)),
     firstValueFrom(this.api.resolvePrice(id,branch)),firstValueFrom(this.api.variant(id,branch))
    ]);
    this.history.set(hist);this.resolved.set(price);this.selectedVariant.set(variant);
   }else{
    this.history.set(await firstValueFrom(this.api.modifierPriceHistory(id,branch)));
    this.resolved.set(null);this.selectedVariant.set(null);
   }
  }catch(e){this.error.set(gcErrorMessage(e))}finally{this.loading.set(false)}
 }
 protected toggleModifier(id:string,active:boolean){this.selectedModifiers.update(a=>active?
  [...a,id]:a.filter(v=>v!==id));this.quoteResult.set(null)}
 protected async quote(){
  if(!this.entityId()||!this.branchId()||this.loading())return;
  this.loading.set(true);this.error.set(null);
  try{this.quoteResult.set(await firstValueFrom(this.api.quote({
   varianteId:this.entityId(),sucursalId:this.branchId(),modificadorIds:this.selectedModifiers()
  })))}catch(e){this.error.set(gcErrorMessage(e))}finally{this.loading.set(false)}
 }
 protected async save(event:Event){
  event.preventDefault();
  if(!this.entityId()||!this.branchId()||!this.access.canPrices()||this.loading())return;
  let importe:string,desde:string,hasta:string|null;
  try{
   importe=positivePrice(this.amount());
   desde=new Date(this.from()).toISOString();
   hasta=this.to()?new Date(this.to()).toISOString():null;
   if(hasta&&hasta<=desde)throw new Error('La fecha final debe ser posterior a la inicial.');
  }catch(e){this.error.set(gcErrorMessage(e));return}
  const ok=await this.confirm.confirm({title:'Registrar precio',
   message:'La nueva vigencia quedará registrada en el historial de esta sucursal.',
   confirmText:'Crear precio'});
  if(!ok)return;
  this.loading.set(true);this.error.set(null);
  try{
   const dto={entityId:this.entityId(),sucursalId:this.branchId(),importe,vigenteDesde:desde,vigenteHasta:hasta};
   if(this.mode()==='variant')await firstValueFrom(this.api.createVariantPrice(dto));
   else await firstValueFrom(this.api.createModifierPrice(dto));
   this.amount.set('');await this.reload();this.notice.show('Nuevo precio registrado.','success')
  }catch(e){this.error.set(gcErrorMessage(e))}finally{this.loading.set(false)}
 }
}
