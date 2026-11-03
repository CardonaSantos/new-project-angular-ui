import {Component,computed,inject,signal,OnInit} from '@angular/core';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcCatalogNav} from '../catalog-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
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
 selector:'gc-catalog-prices-page',imports:[GcCatalogNav,GcErrorState,GcSearchSelect],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <section class="cat-card">
   <div class="cat-row"><h2>Precios comerciales</h2>
    <gc-search-select id="price-branch" label="Sucursal" [items]="branchChoices()"
     [value]="branchId()" [clearable]="false" (valueChange)="selectBranch($event)"/>
   </div>
   <p class="cat-muted">Los precios se registran por sucursal sin alterar las ventas anteriores.</p>
   <div class="cat-toolbar gc-filter-grid">
    <gc-search-select id="price-mode" label="Tipo de precio" [items]="modeChoices"
     [value]="mode()" [searchable]="false" [clearable]="false" (valueChange)="setMode($event)"/>
    <gc-search-select id="price-entity" [label]="mode()==='variant'?'Presentación':'Extra'"
     [items]="entityChoices()" [value]="entityId()" [remote]="true" [loading]="loading()"
     placeholder="Buscar y seleccionar…" (searchChange)="queueOptionSearch($event)"
     (valueChange)="selectEntity($event)"/>
   </div>
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
     <p class="cat-muted">No se permiten períodos de vigencia superpuestos.</p>
     <form class="cat-form" (submit)="save($event)">
      <div class="cat-form-section"><h3>1. Importe y vigencia</h3>
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
      </div>
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
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly modeChoices=[{id:'variant',label:'Presentaciones de productos'},{id:'modifier',label:'Extras'}];
 private readonly optionTerms=new Subject<string>();
 private optionGeneration=0;
 protected queueOptionSearch(term:string){this.optionTerms.next(term)}
 protected readonly chosenOption=signal<{id:string;label:string}|null>(null);
 protected readonly entityChoices=computed(()=>{
  const opts=this.mode()==='variant'?
   this.variants().map(x=>({id:x.id,label:x.label??(x.producto?.nombre+' · '+x.nombre)})):
   this.modifiers().map(x=>({id:x.id,label:(x.grupo?.nombre??'Extra')+' · '+x.nombre}));
  const saved=this.chosenOption();
  return saved&&!opts.some(x=>x.id===saved.id)?[saved,...opts]:opts;
 });
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
 constructor(){
  this.optionTerms.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(term=>{this.search.set(term);void this.loadOptions()});
 }
 async ngOnInit(){this.branchId.set(this.branch.branchId()??this.branch.branches()[0]?.id??'');await this.loadOptions()}
 protected date(v:string){try{return formatInstant(v,this.branch.branches().find(b=>b.id===this.branchId())?.zonaHoraria??'America/Guatemala')}catch{return '—'}}
 protected money(v:string,moneda:string){try{return formatCurrency(v,moneda==='USD'?'USD':'GTQ')}catch{return '—'}}
 protected setMode(v:string){
  this.mode.set(v==='modifier'?'modifier':'variant');this.search.set('');
  this.chosenOption.set(null);this.selectEntity('');void this.loadOptions();
 }
 protected selectBranch(v:string){this.branchId.set(v);void this.loadOptions();void this.reload()}
 protected async loadOptions(){
  const gen=++this.optionGeneration,mode=this.mode(),search=this.search().trim();
  this.loading.set(true);this.error.set(null);
  try{
   if(mode==='variant'){
    const result=await firstValueFrom(this.api.variantOptions({
     sucursalId:this.branchId()||undefined,search,limit:50
    }));
    if(gen!==this.optionGeneration||mode!==this.mode())return;
    this.variants.set(result.data);this.optionsMore.set(result.meta.hasMore);
   }else{
    const result=await firstValueFrom(this.api.modifiers({search,limit:100,page:1}));
    if(gen!==this.optionGeneration||mode!==this.mode())return;
    this.modifiers.set(result.data);this.optionsMore.set(result.meta.total>result.data.length);
   }
  }catch(e){if(gen===this.optionGeneration)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.optionGeneration)this.loading.set(false)}
 }
 protected selectEntity(id:string){
  this.chosenOption.set(this.entityChoices().find(x=>x.id===id)??null);
  this.entityId.set(id);this.quoteResult.set(null);this.selectedModifiers.set([]);
  if(!id){this.history.set([]);this.resolved.set(null);this.selectedVariant.set(null);}
  else void this.reload();
 }
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
