import {Component,computed,inject,signal,OnInit} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
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
 addMenuItems,moveMenuItemToSection,readableMenuIssue,
 type MenuDraft,type MenuDraftSection} from '../data-access/catalog-menu-editor';
import type {CatalogMenu,CatalogMenuReadiness} from '../data-access/catalog.models';
import {GcCatalogMenuProductPicker,type MenuPickedVariant} from '../components/catalog-menu-product-picker';

@Component({
 selector:'gc-catalog-menu-detail-page',imports:[RouterLink,GcCatalogNav,GcErrorState,GcSearchSelect,GcCatalogMenuProductPicker],
 template:`
 <main class="cat-page cat-menu-editor">
  <gc-catalog-nav/>
  <div class="cat-menu-editor-top">
   <a class="cat-menu-editor-back" routerLink="/catalog/menus">Volver a menús</a>
   @if(!isNew){
    <nav class="cat-menu-editor-tabs" aria-label="Vistas del menú">
     <button type="button" [attr.aria-pressed]="view()==='edit'"
      [class.is-active]="view()==='edit'" (click)="view.set('edit')">Editar carta</button>
     <button type="button" [attr.aria-pressed]="view()==='draft'"
      [class.is-active]="view()==='draft'" (click)="view.set('draft')">Vista previa del borrador</button>
     <a routerLink="/catalog/preview">Ver carta publicada</a>
    </nav>
   }
  </div>
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
    @if(view()==='draft'){
     <section class="cat-card cat-menu-draft">
      <div class="cat-menu-draft-heading">
       <h2>Vista rápida de la organización</h2>
       <p>Esto es un borrador editable, no la carta publicada. Los precios y la disponibilidad reales se comprueban al publicar.</p>
      </div>
      @for(section of draft().sections;track section.key){
       <div class="cat-menu-draft-section">
        <h3>{{section.nombre}}</h3>
        <div class="cat-menu-draft-items">
         @for(item of section.items;track item.varianteId){
          <article class="cat-menu-draft-item">
           <strong>{{item.nombre}}</strong>
           <small>Presentación del producto</small>
          </article>
         }@empty{<p>Agrega productos a esta sección para verla completa.</p>}
        </div>
       </div>
      }@empty{<p class="cat-menu-empty">Crea una sección para empezar a organizar tu carta.</p>}
     </section>
    }@else{
     <section class="cat-card cat-menu-builder">
      <div class="cat-menu-section-heading">
       <div><h2>Secciones y productos</h2>
        <p>Organiza la carta por secciones y agrega varias presentaciones de una sola vez.</p></div>
       @if(access.canMenus()){
        <button type="button" class="cat-menu-action cat-menu-action--primary"
         [disabled]="busy()||draft().sections.length>=30"
         (click)="addSection()">+ Nueva sección</button>
       }
      </div>
      @for(section of draft().sections;track section.key;let i=$index){
       <section class="cat-menu-section" [attr.aria-label]="'Sección '+(i+1)+': '+section.nombre">
        <div class="cat-menu-section-top">
         <label class="cat-menu-name-field">Sección {{i+1}} · Nombre
          <input [value]="section.nombre" maxlength="140" [disabled]="!access.canMenus()"
           (input)="renameSection(i,$any($event.target).value)" placeholder="Ej. Hamburguesas"/></label>
         @if(access.canMenus()){
          <div class="cat-menu-section-controls" aria-label="Orden y eliminación de la sección">
           <button type="button" class="cat-menu-action" (click)="moveSection(i,-1)"
            [disabled]="i===0">Subir sección</button>
           <button type="button" class="cat-menu-action" (click)="moveSection(i,1)"
            [disabled]="i===draft().sections.length-1">Bajar sección</button>
           <button type="button" class="cat-menu-action" (click)="removeSection(i)">Quitar sección</button>
          </div>
         }
        </div>
        <div class="cat-menu-item-list">
         @for(item of section.items;track item.varianteId;let j=$index){
          <div class="cat-menu-item">
           <div class="cat-menu-item-info">
            <strong>{{item.nombre}}</strong>
            <span>Posición {{j+1}}</span>
           </div>
           @if(access.canMenus()){
            <div class="cat-menu-item-controls">
             <button type="button" class="cat-menu-action" (click)="moveItem(i,j,-1)"
              [disabled]="j===0">Subir</button>
             <button type="button" class="cat-menu-action" (click)="moveItem(i,j,1)"
              [disabled]="j===section.items.length-1">Bajar</button>
             @if(draft().sections.length>1){
              <label class="cat-menu-move-label">Mover a sección
               <select [value]="section.key" (change)="moveToSection(section.key,item.varianteId,$any($event.target).value)">
                <option [value]="section.key">Elegir otra sección…</option>
                @for(destination of draft().sections;track destination.key){
                 @if(destination.key!==section.key){
                  <option [value]="destination.key">{{destination.nombre}}</option>
                 }
                }
               </select>
              </label>
             }
             <button type="button" class="cat-menu-action" (click)="removeItem(i,j)">Quitar</button>
            </div>
           }
          </div>
         }@empty{<p class="cat-menu-empty">Todavía no hay productos en esta sección.</p>}
        </div>
        @if(access.canMenus()){
         <div class="cat-menu-section-bottom">
          <button type="button" class="cat-menu-action cat-menu-action--outline"
           (click)="togglePicker(section.key)">
           {{pickerSectionKey()===section.key?'Cerrar selector':'+ Agregar productos a '+section.nombre}}
          </button>
         </div>
         @if(pickerSectionKey()===section.key){
          <gc-catalog-menu-product-picker [existingVariantIds]="sectionIds(section)"
           (added)="addPicked(section.key,$event)" (dismissed)="pickerSectionKey.set(null)"/>
         }
        }
       </section>
      }@empty{
       <p class="cat-menu-empty">Empieza creando una sección, por ejemplo «Bebidas» o «Postres».</p>
      }
      @if(addedNotice()){<p role="status" class="cat-menu-notice">{{addedNotice()}}</p>}
     </section>
    }
    <section class="cat-card cat-menu-schedule">
     <details>
      <summary>Horarios de la carta (opcional) · {{draft().schedule.length===0?'Todo el día':draft().schedule.length+' horarios'}}</summary>
      <p class="cat-muted">Sin horarios: disponible todo el día. Las horas se interpretan según la sucursal.</p>
      @if(access.canMenus()){
       <button type="button" class="cat-menu-action" (click)="addSchedule()">+ Agregar horario</button>
      }
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
     } @empty {<p class="cat-muted">Sin restricciones horarias.</p>}
     </details>
    </section>
    <section class="cat-card cat-menu-save-panel">
     <div class="cat-menu-save-intro">
      <div><h2>Revisar y publicar</h2>
       <p>Antes de publicar comprobamos precios, fotografías, recetas y Cocina por sucursal. Si algo falla, la carta anterior sigue visible.</p></div>
      @if(page.data();as menu){<strong>{{status(menu)}}</strong>}
     </div>
     @for(message of validation().errors;track message){
      <p class="cat-menu-field-error" role="alert">{{message}}</p>
     }
     @if(errorText()){<p class="cat-alert" role="alert">{{errorText()}}</p>}
     @if(publishError()){<p class="cat-alert" role="alert">{{publishError()}}</p>}
     @if(conflict()){
      <div class="cat-menu-conflict" role="alert">
       <p>Esta carta cambió desde otra sesión. Revisa los cambios antes de reemplazar tu borrador.</p>
       <button type="button" class="cat-menu-action" (click)="reload()">Descartar mis cambios y recargar</button>
      </div>
     }
     @if(review();as result){
      @if(reviewStale()){
       <p class="cat-menu-notice" role="status">Has modificado la carta después de revisarla. Comprueba los requisitos de nuevo.</p>
      }@else if(result.lista){
       <p class="cat-menu-ready" role="status">Lista para publicar: {{result.totalPresentaciones}} presentaciones verificadas en {{result.totalSucursales}} sucursales.</p>
      }@else{
       <div class="cat-menu-issues" role="region" aria-label="Requisitos pendientes">
        <strong>{{result.problemas.length}} requisitos por corregir</strong>
        @for(problem of result.problemas;track $index){
         <div class="cat-menu-issue">
          <div><strong>{{problem.nombre??problem.seccion??'Configuración de la carta'}}</strong>
           <span>{{issueLabel(problem.codigo)}}{{problem.sucursalId?' · '+branchName(problem.sucursalId):''}}</span></div>
          @if(problem.productoId){
           <a class="cat-menu-action" [routerLink]="['/catalog/products',problem.productoId]">Corregir producto</a>
          }
         </div>
        }
       </div>
      }
     }
     @if(access.canMenus()){
      <div class="cat-menu-publish-actions">
       <button type="button" class="cat-menu-action cat-menu-action--outline"
        (click)="reviewDraft()" [disabled]="busy()||conflict()||!validation().valid">
        {{busy()?'Comprobando…':'Revisar requisitos'}}</button>
       <button type="button" class="cat-menu-action cat-menu-action--primary"
        (click)="commitLayout()"
        [disabled]="busy()||conflict()||!validation().valid||!active()||(!layoutDirty()&&!!page.data()?.publicadoEn)">
        {{busy()?'Procesando…':'Guardar y publicar carta'}}</button>
      </div>
      <details class="cat-menu-advanced-publication">
       <summary>Otras acciones de publicación</summary>
       <div class="cat-menu-publish-actions">
        <button type="button" class="cat-menu-action" (click)="saveLayout()"
         [disabled]="busy()||conflict()||!validation().valid||!layoutDirty()">
         Guardar solo borrador {{page.data()?.publicadoEn?'(retira la carta del POS)':''}}
        </button>
        @if(page.data();as menu){
         @if(menu.publicadoEn){
          <button type="button" class="cat-menu-action" (click)="unpublish()"
           [disabled]="busy()||layoutDirty()">Retirar carta publicada del POS</button>
         }
        }
       </div>
      </details>
     }
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

 protected readonly view=signal<'edit'|'draft'>('edit');
 protected readonly pickerSectionKey=signal<string|null>(null);
 protected readonly addedNotice=signal('');
 protected readonly review=signal<CatalogMenuReadiness|null>(null);
 private readonly reviewInput=signal('');
 protected readonly issueLabel=readableMenuIssue;
 protected readonly reviewStale=computed(()=>
  this.reviewInput()!==JSON.stringify(menuLayout(this.draft(),this.page.data()?.version??1)));
 protected sectionIds(section:MenuDraftSection){return section.items.map(x=>x.varianteId)}
 protected branchName(id:string){
  return this.branchContext.branches().find(x=>x.id===id)?.nombre??'Sucursal';
 }
 protected togglePicker(key:string){this.pickerSectionKey.update(x=>x===key?null:key)}
 protected addPicked(key:string,items:MenuPickedVariant[]){
  const before=this.draft().sections.find(x=>x.key===key)?.items.length??0;
  this.draft.update(x=>addMenuItems(x,key,items));
  const total=(this.draft().sections.find(x=>x.key===key)?.items.length??0)-before;
  this.addedNotice.set(total>0?total+' presentaciones agregadas a la sección.':
   'Las presentaciones seleccionadas ya estaban incluidas.');
  this.pickerSectionKey.set(null);
 }
 protected moveToSection(fromKey:string,varianteId:string,toKey:string){
  this.draft.update(x=>moveMenuItemToSection(x,fromKey,toKey,varianteId));
 }
 protected readonly validCode=computed(()=>/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(this.code().trim()));
 protected readonly validation=computed(()=>menuValidation(this.draft()));
 protected readonly layoutDirty=computed(()=>JSON.stringify(this.draft())!==this.savedDraft());
 protected readonly status=menuStatus;
 async ngOnInit(){if(!this.isNew)await this.reload()}
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
  key:'draft-'+Date.now()+'-'+d.sections.length,nombre:'',items:[]}] }))}

 protected renameSection(index:number,name:string){this.changeSection(index,s=>({...s,nombre:name}))}
 private changeSection(index:number,fn:(s:MenuDraftSection)=>MenuDraftSection){
  this.draft.update(d=>({...d,sections:d.sections.map((s,i)=>i===index?fn(s):s)}));
 }
 protected async removeSection(index:number){
  const section=this.draft().sections[index];
  if(!section)return;
  if(section.items.length){
   const ok=await this.confirm.confirm({title:'Quitar sección de la carta',
    message:'La sección tiene '+section.items.length+' presentaciones. Se retirarán del borrador, pero sus productos no se eliminarán.',
    confirmText:'Quitar sección',danger:true});
   if(!ok)return;
  }
  this.draft.update(d=>({...d,sections:d.sections.filter((_,i)=>i!==index)}));
 }
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
 protected async reviewDraft():Promise<boolean>{
  const current=this.page.data();
  if(!current||this.busy()||this.conflict()||!this.validation().valid)return false;
  const input=menuLayout(this.draft(),current.version);
  this.busy.set(true);this.errorText.set(null);this.publishError.set(null);
  try{
   const result=await firstValueFrom(this.api.validateMenu(current.id,input));
   this.review.set(result);this.reviewInput.set(JSON.stringify(input));
   if(!result.lista)this.errorText.set('Hay requisitos pendientes. Corrígelos antes de publicar.');
   return result.lista;
  }catch(e){
   if(isMenuVersionConflict(e))this.conflict.set(true);
   this.errorText.set(catalogUiError(e));return false;
  }finally{this.busy.set(false)}
 }
 protected async commitLayout(){
  const current=this.page.data();
  if(!current||!this.access.canMenus()||this.busy()||this.conflict()||
    !this.validation().valid||!this.active())return;
  const ready=await this.reviewDraft();
  if(!ready)return;
  const signature=JSON.stringify(menuLayout(this.draft(),current.version));
  const confirmed=await this.confirm.confirm({
   title:'Guardar y publicar carta',
   message:'Se actualizarán las secciones y horarios de la carta para las sucursales seleccionadas. Los cambios solo se publicarán si el servidor vuelve a verificar todos los requisitos.',
   confirmText:'Guardar y publicar'
  });
  if(!confirmed)return;
  if(signature!==JSON.stringify(menuLayout(this.draft(),current.version))){
   this.errorText.set('La carta cambió mientras confirmabas. Vuelve a revisar los requisitos.');return;
  }
  this.busy.set(true);this.errorText.set(null);
  try{
   await firstValueFrom(this.api.commitMenu(current.id,menuLayout(this.draft(),current.version)));
   await this.reload();this.review.set(null);this.reviewInput.set('');
   this.notify.show('Carta guardada y publicada correctamente.','success');
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
