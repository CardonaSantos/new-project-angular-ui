import {Component,computed,inject,signal,OnInit} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom,Subject,debounceTime,distinctUntilChanged} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {catalogUiError} from '../data-access/catalog-ui-copy';
import type {GcDirtyAware} from '../../../core/ux/gc-unsaved-changes.guard';
import {GcCatalogNav} from '../catalog-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import {WEEKDAYS,menuDraft,menuLayout,menuValidation,isMenuVersionConflict,menuStatus,
 type MenuDraft,type MenuDraftSection} from '../data-access/catalog-menu-editor';
import type {CatalogMenu,CatalogVariant,CatalogProduct} from '../data-access/catalog.models';

@Component({
 selector:'gc-catalog-menu-detail-page',imports:[RouterLink,GcCatalogNav,GcErrorState,GcSearchSelect],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <a routerLink="/catalog/menus">Volver a menús</a>
  @if(page.busy()){<p class="cat-muted" role="status">Cargando configuración del menú…</p>}
  @if(page.status()==='error'){<gc-error-state [message]="error()" (retry)="reload()"/>}
  @if(isNew||page.data()){
   <section class="cat-card">
    <div class="cat-row"><h2>{{isNew?'Nuevo menú':'Configuración general'}}</h2>
     @if(page.data();as menu){<span class="cat-muted">{{status(menu)}}</span>}
    </div>
    <form class="cat-form" (submit)="saveBasics($event)">
     <div class="cat-form-section"><h3>1. Identificación del menú</h3>
     <label>Código
      <input [value]="code()" (input)="code.set($any($event.target).value)" [disabled]="!isNew||!access.canMenus()"
       pattern="[A-Za-z][A-Za-z0-9_-]*" maxlength="50" required placeholder="MENU-CAFE"/>
     </label>
     <label>Nombre comercial
      <input [value]="name()" (input)="name.set($any($event.target).value)"
       [disabled]="!access.canMenus()" maxlength="140" required/>
     </label>
     <label class="cat-wide">Descripción
      <textarea [value]="description()" (input)="description.set($any($event.target).value)"
       [disabled]="!access.canMenus()" maxlength="1500" rows="2"></textarea>
     </label>
     @if(!isNew){
      <label class="cat-check"><input type="checkbox" [checked]="active()"
       [disabled]="!access.canMenus()" (change)="active.set($any($event.target).checked)"/> Menú activo</label>
     }
     </div>
     @if(errorText()){<p class="cat-alert" role="alert">{{errorText()}}</p>}
     <div class="cat-actions">
      @if(access.canMenus()){<button type="submit" class="cat-primary" [disabled]="busy()||!name().trim()||(isNew&&!validCode())">
       {{busy()?'Guardando…':'Guardar datos generales'}}</button>}
     </div>
    </form>
   </section>
   <section class="cat-card">
    <h2>Sucursales del menú</h2>
    <p class="cat-muted">Los precios se validan por sucursal al publicar.</p>
    <div class="cat-choice-grid">
     @for(branch of branchContext.branches();track branch.id){
      <label class="cat-check"><input type="checkbox" [checked]="draft().branches.includes(branch.id)"
       [disabled]="!access.canMenus()" (change)="toggleBranch(branch.id,$any($event.target).checked)"/>
       {{branch.nombre}}</label>
     }
    </div>
    @if(isNew){<p class="cat-muted">Guarda el menú para configurar secciones y horarios.</p>}
   </section>
   @if(!isNew&&page.data()){
    <section class="cat-card">
     <div class="cat-row"><h2>Secciones y productos</h2>
      @if(access.canMenus()){<button type="button" (click)="addSection()">Agregar sección</button>}
     </div>
 
     @for(section of draft().sections;track section.key;let i=$index){
      <div class="cat-section-card">
       <div class="cat-row">
        <label class="cat-field">Nombre de sección
         <input [value]="section.nombre" maxlength="140" [disabled]="!access.canMenus()"
          (input)="renameSection(i,$any($event.target).value)"/>
        </label>
        @if(access.canMenus()){
         <div class="cat-actions">
          <button type="button" (click)="moveSection(i,-1)" [disabled]="i===0" aria-label="Mover sección arriba">↑</button>
          <button type="button" (click)="moveSection(i,1)" [disabled]="i===draft().sections.length-1" aria-label="Mover sección abajo">↓</button>
          <button type="button" (click)="removeSection(i)">Quitar sección</button>
         </div>
        }
       </div>
       <div class="cat-table-wrap"><table class="cat-table">
        <thead><tr><th>Presentación del producto</th><th>Orden</th><th>Acciones</th></tr></thead>
        <tbody>
         @for(item of section.items;track item.varianteId;let j=$index){
          <tr><td>{{item.nombre}}</td><td>{{j+1}}</td><td>
           @if(access.canMenus()){
            <div class="cat-actions">
             <button type="button" (click)="moveItem(i,j,-1)" [disabled]="j===0" aria-label="Mover presentación arriba">↑</button>
             <button type="button" (click)="moveItem(i,j,1)" [disabled]="j===section.items.length-1" aria-label="Mover presentación abajo">↓</button>
             <button type="button" (click)="removeItem(i,j)">Quitar</button>
            </div>
           }
          </td></tr>
         } @empty {<tr><td colspan="3">Agrega productos a esta sección.</td></tr>}
        </tbody>
       </table></div>
       @if(access.canMenus()){
        <div class="cat-toolbar gc-filter-grid" role="group" [attr.aria-label]="'Agregar presentación a '+section.nombre">
         <gc-search-select [id]="'menu-product-'+section.key" label="Producto" [items]="productChoices()"
          [value]="productId()" [remote]="true" [loading]="lookingUp()"
          placeholder="Buscar producto…" (searchChange)="queueProductSearch($event)"
          (valueChange)="chooseProduct($event)"/>
         <gc-search-select [id]="'menu-variant-'+section.key" label="Presentación" [items]="variantChoices()"
          [value]="variantId()" [remote]="true" [disabled]="!productId()"
          placeholder="Buscar presentación…" (searchChange)="queueVariantSearch($event)"
          (valueChange)="chooseVariant($event)"/>
         <button type="button" (click)="appendItem(i)" [disabled]="!variantId()">Agregar presentación</button>
        </div>
        @if(optionsMore()){<p class="cat-muted">Hay más resultados: especifica mejor el nombre del producto.</p>}
        @if(lookupError()){<p role="alert" class="cat-alert">{{lookupError()}}</p>}
       }
      </div>
     }
    </section>
    <section class="cat-card">
     <div class="cat-row"><h2>Horarios de presentación</h2>
      @if(access.canMenus()){<button type="button" (click)="addSchedule()">Agregar horario</button>}
     </div>
     <p class="cat-muted">Sin horarios: disponible todo el día. Se utiliza la zona horaria de cada sucursal.</p>
     @for(item of draft().schedule;track $index;let i=$index){
      <div class="cat-schedule-grid">
       <gc-search-select [id]="'menu-day-'+i" label="Día" [items]="dayChoices"
        [value]="''+item.diaSemana" [searchable]="false" [clearable]="false"
        [disabled]="!access.canMenus()" (valueChange)="setDay(i,+$event)"/>
       <label class="cat-field">Desde
        <input type="time" [value]="item.desde" [disabled]="!access.canMenus()"
         (change)="setTime(i,'desde',$any($event.target).value)"/>
       </label>
       <label class="cat-field">Hasta
        <input type="time" [value]="item.hasta" [disabled]="!access.canMenus()"
         (change)="setTime(i,'hasta',$any($event.target).value)"/>
       </label>
       @if(access.canMenus()){<button type="button" [attr.aria-label]="'Quitar horario '+(i+1)"
        (click)="removeSchedule(i)">Quitar</button>}
      </div>
     } @empty {<p class="cat-muted">Sin restricción horaria.</p>}
    </section>
    <section class="cat-card">
     <h2>Guardar configuración de la carta</h2>
     @for(message of validation().errors;track message){<p class="cat-muted">{{message}}</p>}
     <p class="cat-muted">Guarda y publica en una sola operación. Si falla la validación, la carta anterior seguirá visible.</p>
     @if(errorText()){<p class="cat-alert" role="alert">{{errorText()}}</p>}
     @if(conflict()){
      <p class="cat-alert" role="alert">Esta carta cambió mientras la editabas. Copia los ajustes que necesites antes de volver a cargarla.</p>
      <button type="button" (click)="reload()">Descartar mis cambios y volver a cargar</button>
     }
     @if(access.canMenus()){
      <div class="cat-actions">
       <button type="button" class="cat-primary" (click)="commitLayout()"
        [disabled]="busy()||conflict()||!validation().valid||!layoutDirty()||!active()">Guardar y publicar</button>
       <button type="button" (click)="saveLayout()"
        [disabled]="busy()||conflict()||!validation().valid||!layoutDirty()">
        Guardar borrador{{page.data()?.publicadoEn?' (retira del POS)':''}}</button>
      </div>
     }
    </section>
    <section class="cat-card">
     <div class="cat-row"><h2>Publicación</h2>
      @if(page.data();as menu){<strong>{{status(menu)}}</strong>}
     </div>
     <p class="cat-muted">Para publicar, cada presentación necesita fotografías, precios y estar habilitada en las sucursales elegidas.</p>
     @if(page.data();as menu){
      @if(menu.publicadoEn&&access.canMenus()){
       <button type="button" (click)="unpublish()" [disabled]="busy()||layoutDirty()">Retirar de publicación</button>
      } @else if(access.canMenus()){
       <button type="button" class="cat-primary" (click)="publish()"
        [disabled]="busy()||layoutDirty()||!validation().valid||!menu.activo||conflict()">Publicar menú</button>
      }
     }
     @if(publishError()){<p class="cat-alert" role="alert">{{publishError()}}</p>}
    </section>
   }
  }
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogMenuDetailPage implements OnInit,GcDirtyAware {
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly api=inject(CatalogApi);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notify=inject(GcNotificationService);
 protected readonly branchContext=inject(GcBranchContext);
 protected readonly access=inject(CatalogAccess);
 protected readonly isNew=this.route.snapshot.routeConfig?.path==='new';
 private readonly id=this.isNew?'':this.route.snapshot.paramMap.get('id')??'';
 protected readonly page=new GcPageState<CatalogMenu>();
 protected readonly code=signal('');
 protected readonly name=signal('');
 protected readonly description=signal('');
 protected readonly active=signal(true);
 protected readonly draft=signal<MenuDraft>({branches:[],sections:[],schedule:[]});
 private readonly savedDraft=signal('');
 private committed=false;
 protected readonly busy=signal(false);
 protected readonly errorText=signal<string|null>(null);
 protected readonly publishError=signal<string|null>(null);
 protected readonly conflict=signal(false);
 protected readonly days=WEEKDAYS;
 protected readonly dayChoices=this.days.map((day,i)=>({id:String(i),label:day}));
 private readonly productTerms=new Subject<string>();
 private readonly variantTerms=new Subject<string>();
 private productGeneration=0;
 private variantGeneration=0;
 protected readonly variantSearch=signal('');
 protected readonly selectedProductOption=signal<{id:string;label:string}|null>(null);
 protected readonly selectedVariantOption=signal<{id:string;label:string}|null>(null);
 protected readonly productChoices=computed(()=>{
  const items=this.products().map(x=>({id:x.id,label:x.nombre}));
  const current=this.selectedProductOption();
  return current&&!items.some(x=>x.id===current.id)?[current,...items]:items;
 });
 protected readonly variantChoices=computed(()=>{
  const items=this.variants().map(x=>({id:x.id,label:x.label??x.nombre}));
  const current=this.selectedVariantOption();
  return current&&!items.some(x=>x.id===current.id)?[current,...items]:items;
 });
 protected queueProductSearch(term:string){this.productTerms.next(term)}
 protected queueVariantSearch(term:string){this.variantTerms.next(term)}
 protected chooseVariant(id:string){
  this.selectedVariantOption.set(this.variantChoices().find(x=>x.id===id)??null);
  this.variantId.set(id);
 }
 constructor(){
  this.productTerms.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(term=>{this.search.set(term);void this.findProducts()});
  this.variantTerms.pipe(debounceTime(300),distinctUntilChanged(),takeUntilDestroyed())
   .subscribe(term=>{this.variantSearch.set(term);void this.findVariants()});
 }
 protected readonly search=signal('');
 protected readonly products=signal<CatalogProduct[]>([]);
 protected readonly variants=signal<CatalogVariant[]>([]);
 protected readonly productId=signal('');
 protected readonly variantId=signal('');
 protected readonly lookingUp=signal(false);
 protected readonly optionsMore=signal(false);
 protected readonly lookupError=signal<string|null>(null);
 protected readonly validCode=computed(()=>/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(this.code().trim()));
 protected readonly validation=computed(()=>menuValidation(this.draft()));
 protected readonly layoutDirty=computed(()=>JSON.stringify(this.draft())!==this.savedDraft());
 protected readonly status=menuStatus;
 async ngOnInit(){if(!this.isNew)await this.reload();if(this.access.canRead())await this.findProducts()}
 hasUnsavedChanges(){
  if(this.committed)return false;
  const old=this.page.data();
  if(this.isNew)return !!this.name().trim()||!!this.code()||this.draft().branches.length>0;
  return !!old&&(this.layoutDirty()||this.name()!==old.nombre||
   this.description()!==(old.descripcion??'')||this.active()!==old.activo);
 }
 protected error(){return gcErrorMessage(this.page.error())}
 protected async reload(){
  this.conflict.set(false);this.errorText.set(null);this.publishError.set(null);
  await this.page.load(()=>firstValueFrom(this.api.menu(this.id)));
  const menu=this.page.data();if(!menu)return;
  this.code.set(menu.codigo);this.name.set(menu.nombre);this.description.set(menu.descripcion??'');
  this.active.set(menu.activo);
  const draft=menuDraft(menu);this.draft.set(draft);this.savedDraft.set(JSON.stringify(draft));
 }
 protected toggleBranch(id:string,enabled:boolean){
  this.draft.update(old=>({...old,branches:enabled?[...old.branches,id]:
   old.branches.filter(x=>x!==id)}));
 }
 protected async saveBasics(event:Event){
  event.preventDefault();if(!this.access.canMenus()||this.busy()||!this.name().trim())return;
  if(!this.isNew&&this.layoutDirty()){
   this.errorText.set('Guarda primero la distribución y los horarios: cambiar los datos generales recargaría el menú.');return;
  }
  if(this.isNew&&(!this.validCode()||!this.draft().branches.length)){
   this.errorText.set('Introduce un código válido y selecciona una sucursal.');return;
  }
  this.busy.set(true);this.errorText.set(null);
  try{
   if(this.isNew){
    const created=await firstValueFrom(this.api.createMenu({
     codigo:this.code().trim(),nombre:this.name().trim(),
     descripcion:this.description().trim()||null,sucursalIds:this.draft().branches
    }));
    this.committed=true;
    await this.router.navigate(['/catalog/menus',created.id]);
   }else{
    const menu=this.page.data();if(!menu)return;
    const patch={
     ...(this.name().trim()===menu.nombre?{}:{nombre:this.name().trim()}),
     ...((this.description().trim()||null)===menu.descripcion?{}:{descripcion:this.description().trim()||null}),
     ...(this.active()===menu.activo?{}:{activo:this.active()})
    };
    if(Object.keys(patch).length){
     await firstValueFrom(this.api.updateMenu(menu.id,patch));await this.reload();
    }
   }
   this.notify.show('Datos del menú guardados.','success');
  }catch(e){this.errorText.set(catalogUiError(e))}finally{this.busy.set(false)}
 }
 protected addSection(){this.draft.update(d=>({...d,sections:[...d.sections,{
  key:'draft-'+Date.now()+'-'+d.sections.length,nombre:'Nueva sección',items:[]}] }))}
 protected renameSection(index:number,name:string){this.changeSection(index,s=>({...s,nombre:name}))}
 private changeSection(index:number,fn:(s:MenuDraftSection)=>MenuDraftSection){
  this.draft.update(d=>({...d,sections:d.sections.map((s,i)=>i===index?fn(s):s)}));
 }
 protected removeSection(index:number){this.draft.update(d=>({...d,sections:d.sections.filter((_,i)=>i!==index)}))}
 protected moveSection(index:number,direction:number){this.draft.update(d=>{
  const to=index+direction;if(to<0||to>=d.sections.length)return d;
  const sections=[...d.sections];[sections[index],sections[to]]=[sections[to],sections[index]];
  return {...d,sections};
 })}
 protected moveItem(sectionIndex:number,index:number,direction:number){
  this.changeSection(sectionIndex,s=>{
   const to=index+direction;if(to<0||to>=s.items.length)return s;
   const items=[...s.items];[items[index],items[to]]=[items[to],items[index]];
   return {...s,items};
  });
 }
 protected removeItem(sectionIndex:number,itemIndex:number){
  this.changeSection(sectionIndex,s=>({...s,items:s.items.filter((_,i)=>i!==itemIndex)}))
 }
 protected appendItem(sectionIndex:number){
  const variant=this.variants().find(x=>x.id===this.variantId());
  if(!variant)return;
  this.changeSection(sectionIndex,s=>{
   if(s.items.some(x=>x.varianteId===variant.id))return s;
   return {...s,items:[...s.items,{
    varianteId:variant.id,nombre:(variant.producto?.nombre??'Producto')+' · '+variant.nombre,
    orden:s.items.length
   }]};
  });
 }
 protected addSchedule(){this.draft.update(d=>({...d,schedule:[...d.schedule,{diaSemana:1,desde:'08:00',hasta:'18:00'}]}))}
 protected removeSchedule(index:number){this.draft.update(d=>({...d,schedule:d.schedule.filter((_,i)=>i!==index)}))}
 protected setDay(index:number,day:number){this.updateSchedule(index,{diaSemana:day})}
 protected setTime(index:number,field:'desde'|'hasta',value:string){this.updateSchedule(index,{[field]:value})}
 private updateSchedule(index:number,patch:Partial<MenuDraft['schedule'][number]>){
  this.draft.update(d=>({...d,schedule:d.schedule.map((t,i)=>i===index?{...t,...patch}:t)}));
 }
 protected async findProducts(){
  if(!this.access.canRead())return;
  const gen=++this.productGeneration;
  this.lookingUp.set(true);this.lookupError.set(null);
  try{
   const result=await firstValueFrom(this.api.productOptions({search:this.search().trim(),limit:50}));
   if(gen!==this.productGeneration)return;
   this.products.set(result.data);this.optionsMore.set(result.meta.hasMore);
  }catch(e){if(gen===this.productGeneration)this.lookupError.set(gcErrorMessage(e))}
  finally{if(gen===this.productGeneration)this.lookingUp.set(false)}
 }
 protected async chooseProduct(id:string){
  this.selectedProductOption.set(this.productChoices().find(x=>x.id===id)??null);
  this.productId.set(id);this.variantId.set('');this.selectedVariantOption.set(null);
  this.variantSearch.set('');this.variants.set([]);
  if(id)await this.findVariants();
 }
 protected async findVariants(){
  const id=this.productId();if(!id)return;
  const gen=++this.variantGeneration;
  this.lookingUp.set(true);this.lookupError.set(null);
  try{
   const result=await firstValueFrom(this.api.variantOptions({
    productoId:id,search:this.variantSearch().trim(),limit:50
   }));
   if(gen!==this.variantGeneration||this.productId()!==id)return;
   this.variants.set(result.data);this.optionsMore.set(result.meta.hasMore);
  }catch(e){if(gen===this.variantGeneration)this.lookupError.set(gcErrorMessage(e))}
  finally{if(gen===this.variantGeneration)this.lookingUp.set(false)}
 }
 protected async commitLayout(){
  const current=this.page.data();
  if(!current||!this.access.canMenus()||this.busy()||this.conflict()||
    !this.validation().valid||!this.active())return;
  const ok=await this.confirm.confirm({title:'Guardar y publicar carta',
   message:'Se comprobarán las sucursales, recetas, precios y Cocina. Si la actualización falla, se mantiene visible la carta actual.',
   confirmText:'Guardar y publicar'});
  if(!ok)return;
  this.busy.set(true);this.errorText.set(null);this.publishError.set(null);
  try{
   await firstValueFrom(this.api.commitMenu(current.id,menuLayout(this.draft(),current.version)));
   await this.reload();this.notify.show('Carta guardada y publicada correctamente.','success');
  }catch(e){
   if(isMenuVersionConflict(e))this.conflict.set(true);
   this.errorText.set(catalogUiError(e));
  }finally{this.busy.set(false)}
 }
 protected async saveLayout(){
  const current=this.page.data();
  if(!current||!this.access.canMenus()||this.busy()||this.conflict()||!this.validation().valid)return;
  const ok=await this.confirm.confirm({title:'Guardar distribución',
   message:'Guardar solamente como borrador retirará la versión vigente del POS. Si quieres conservarla visible, usa «Guardar y publicar».',
   confirmText:'Guardar cambios'});
  if(!ok)return;
  this.busy.set(true);this.errorText.set(null);
  try{
   await firstValueFrom(this.api.replaceMenuLayout(current.id,menuLayout(this.draft(),current.version)));
   await this.reload();this.notify.show('Distribución guardada. El menú queda en borrador.','success');
  }catch(e){if(isMenuVersionConflict(e))this.conflict.set(true);
   this.errorText.set(catalogUiError(e))
  }finally{this.busy.set(false)}
 }
 protected async publish(){
  const m=this.page.data();
  if(!m||!this.access.canMenus()||this.layoutDirty()||!this.validation().valid||!m.activo||this.busy())return;
  const ok=await this.confirm.confirm({title:'Publicar menú',
   message:'Se revisarán los productos, los precios y las fotografías de cada sucursal antes de mostrar la carta.',
   confirmText:'Publicar'});
  if(!ok)return;
  this.busy.set(true);this.publishError.set(null);
  try{
   await firstValueFrom(this.api.publishMenu(m.id,m.version));await this.reload();
   this.notify.show('Menú publicado correctamente.','success');
  }catch(e){
   if(isMenuVersionConflict(e))
    this.conflict.set(true);
   this.publishError.set(catalogUiError(e))
  }finally{this.busy.set(false)}
 }
 protected async unpublish(){
  const m=this.page.data();if(!m||!this.access.canMenus()||this.busy()||this.layoutDirty())return;
  const ok=await this.confirm.confirm({title:'Retirar menú publicado',
   message:'El menú dejará de mostrarse en las cartas comerciales vigentes.',
   confirmText:'Retirar publicación',danger:true});
  if(!ok)return;
  this.busy.set(true);this.publishError.set(null);
  try{await firstValueFrom(this.api.unpublishMenu(m.id));await this.reload();
   this.notify.show('Menú retirado de publicación.','success');
  }catch(e){this.publishError.set(catalogUiError(e))}finally{this.busy.set(false)}
 }
}
