
import {Component,OnInit,inject,signal,viewChild} from '@angular/core';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {FormControl,FormGroup,ReactiveFormsModule,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {GcImagePreviewDialog} from '../../../design-system/media/gc-image-preview-dialog';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcFileUpload} from '../../../design-system/forms/gc-file-upload';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcConfirmedAction} from '../../../core/ux/gc-confirmed-action';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import {InventoryApi} from '../data-access/inventory.api';
import {MediaApi} from '../../users/data-access/users.api';
import type {Article,ArticleCreate,ArticleUpdate,Unit,InventoryKind,InventoryPhoto} from '../data-access/inventory.models';
import {ARTICLE_KINDS} from '../data-access/inventory.models';
import {GcInventoryNav} from '../inventory-nav';
import {toApiDecimal} from '../../../shared/formatting';
import {articleChanges,articleRelations} from '../data-access/inventory-article-presentation';

@Component({
 selector:'gc-inventory-article-page',
 imports:[RouterLink,ReactiveFormsModule,GcPageHeader,GcButtonDirective,GcFileUpload,GcErrorState,GcInventoryNav],
 template:`
 <div class="inv-page inv-narrow">
  <gc-page-header [title]="isNew?'Nuevo artículo':(page.data()?.nombre??'Artículo')"/>
  <gc-inventory-nav/>
  @if(page.busy()){<p role="status" class="inv-muted">Cargando artículo…</p>}
  @if(page.status()==='error'){<gc-error-state [message]="gcError()" (retry)="reload()"/>}
  @if(isNew||page.data()){
   <section class="inv-card">
    <h2>Información del artículo</h2>
    <form class="inv-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
     <div class="inv-grid">
      <div class="inv-field"><label for="article-code">Código</label>
       <input id="article-code" formControlName="codigo" placeholder="Ej. CAFE-001" maxlength="50"
        [attr.aria-invalid]="form.controls.codigo.touched&&form.controls.codigo.invalid"/>
       @if(form.controls.codigo.touched&&form.controls.codigo.invalid){<small class="inv-error">Código válido de 2 a 50 caracteres, empezando por letra.</small>}
      </div>
      <div class="inv-field"><label for="article-name">Nombre</label>
       <input id="article-name" formControlName="nombre" maxlength="160" placeholder="Ej. Café molido"
        [attr.aria-invalid]="form.controls.nombre.touched&&form.controls.nombre.invalid"/>
       @if(form.controls.nombre.touched&&form.controls.nombre.invalid){<small class="inv-error">Introduce un nombre.</small>}
      </div>
      <div class="inv-field"><label for="article-kind">Tipo</label>
       <select id="article-kind" formControlName="tipo">
        @for(k of kinds;track k.value){<option [value]="k.value">{{k.label}}</option>}
       </select>
      </div>
      <div class="inv-field"><label for="article-unit">Unidad base</label>
       <select id="article-unit" formControlName="unidadBaseId">
        <option value="">Seleccionar unidad</option>
        @for(u of units();track u.id){<option [value]="u.id">{{u.nombre}} ({{u.codigo}})</option>}
       </select>
       @if(form.controls.unidadBaseId.touched&&form.controls.unidadBaseId.invalid){<small class="inv-error">Selecciona una unidad base.</small>}
      </div>
      <div class="inv-field"><label for="article-minimum">Stock mínimo</label>
       <input id="article-minimum" formControlName="stockMinimo" inputmode="decimal" placeholder="Ej. 500.000000"
        [attr.aria-invalid]="form.controls.stockMinimo.touched&&form.controls.stockMinimo.invalid"/>
       <small>Hasta seis decimales. Se registra sin separadores de miles.</small>
      </div>
      @if(canManageCost()){
       <div class="inv-field"><label for="article-cost">Costo de referencia</label>
        <input id="article-cost" formControlName="costoReferencia" inputmode="decimal" placeholder="Ej. 0.025000"
         [attr.aria-invalid]="form.controls.costoReferencia.touched&&form.controls.costoReferencia.invalid"/>
       </div>
      }
     </div>
     <div class="inv-stack">
      <label><input type="checkbox" formControlName="requiereLote"/> Controlar por lotes</label>
      <label><input type="checkbox" formControlName="requiereVencimiento"/> Controlar fecha de vencimiento</label>
     </div>
     @if(saveError()){<p role="alert" class="inv-alert">{{saveError()}}</p>}
     <div class="inv-actions"><button gcButton type="submit"
       [disabled]="!canManage()||form.invalid||(!isNew&&!form.dirty)||action.busy()">
       {{action.busy()?'Guardando…':isNew?'Crear artículo':'Guardar cambios'}}
      </button>
      <a routerLink="/inventory/articles">Volver al listado</a>
     </div>
    </form>
   </section>
   @if(!isNew&&page.data();as article){
    <section class="inv-card">
     <div class="inv-row"><h2>Fotografías</h2><span class="inv-muted">{{mediaIds().length}}/10</span></div>
     <div class="inv-gallery">
      @for(pic of orderedPhotos();track pic.mediaId){
       <div class="inv-stack">
        @if(pic.url){
         <button type="button" class="inv-image-trigger" (click)="openPhoto(pic.url,article.nombre)"
          [attr.aria-label]="'Ampliar fotografía de '+article.nombre">
          <img [src]="pic.url" [alt]="pic.nombreOriginal??article.nombre"/>
         </button>
        } @else{<div class="inv-placeholder">IMG</div>}
        @if(canManage()){
         <div class="inv-actions">
          <button type="button" gcButton variant="outline" (click)="shift(pic.mediaId,-1)" [disabled]="mediaAction.busy()">↑</button>
          <button type="button" gcButton variant="outline" (click)="shift(pic.mediaId,1)" [disabled]="mediaAction.busy()">↓</button>
          <button type="button" gcButton variant="outline" (click)="remove(pic.mediaId)" [disabled]="mediaAction.busy()">Quitar</button>
         </div>
        }
       </div>
      } @empty{<p class="inv-muted">Este artículo todavía no tiene imágenes.</p>}
     </div>
     @if(canManage()){
      @if(mediaIds().length<10){
       <gc-file-upload inputId="article-photo" label="Agregar imágenes"
        [maxFiles]="10-mediaIds().length" [maxSizeMb]="10" [cropSquare]="true" [acceptedMime]="imageTypes"
        (filesSelected)="files.set([...$event]);uploaded.set([])"/>
      } @else {<p class="inv-muted">La galería alcanzó el máximo de 10 imágenes. Quita una antes de agregar otra.</p>}
      <p class="inv-muted">Puedes seleccionar imágenes grandes: se recortan y reducen antes de subirlas. El tamaño final máximo es 10 MB por fotografía. La primera imagen será la principal.</p>
      @if(mediaError()){<p role="alert" class="inv-alert">{{mediaError()}}</p>}
      <div class="inv-actions">
       <button gcButton type="button" [disabled]="mediaAction.busy()||form.dirty||(!mediaDirty()&&!files().length)"
        (click)="saveImages()">Guardar fotografías</button>
      </div>
     }
    </section>
    <section class="inv-card">
     <h2>Uso en otros módulos</h2>
     <p class="inv-muted">Estos usos pueden impedir la desactivación del artículo. No bloquean el cambio de nombre.</p>
     @if(dependencies();as data){
      @if(relationEntries(data).length){
       <dl class="inv-kv">
        @for(item of relationEntries(data);track item.key){
         <div><dt>{{item.label}}</dt><dd>{{item.count}}</dd></div>
        }
       </dl>
      } @else {<p class="inv-muted">Sin relaciones activas registradas con otros módulos.</p>}
     } @else{<p class="inv-muted">Consultando usos del artículo…</p>}
    </section>
    <section class="inv-card">
     <h2>Estado del artículo</h2>
     <p>{{article.activo?'Activo':'Inactivo'}}</p>
     <div class="inv-field"><label for="article-reason">Motivo del cambio</label>
      <input id="article-reason" maxlength="500" placeholder="Ej. Artículo descontinuado"
       [value]="reason()" (input)="reason.set($any($event.target).value)"/>
     </div>
     @if(statusError()){<p role="alert" class="inv-alert">{{statusError()}}</p>}
     <div class="inv-actions">
      <button gcButton type="button" [variant]="article.activo?'danger':'secondary'"
       [disabled]="!canManage()||form.dirty||mediaDirty()||reason().trim().length<3||statusAction.busy()"
       (click)="changeStatus()">{{article.activo?'Desactivar artículo':'Activar artículo'}}</button>
     </div>
    </section>
   }
  }
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventoryArticlePage implements OnInit {
 protected readonly isNew=inject(ActivatedRoute).snapshot.paramMap.get('id')===null||
  inject(ActivatedRoute).snapshot.paramMap.get('id')==='new';
 private readonly id=inject(ActivatedRoute).snapshot.paramMap.get('id')??'new';
 private readonly router=inject(Router);
 private readonly api=inject(InventoryApi);
 private readonly media=inject(MediaApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly previewDialog=inject(MatDialog);
 private readonly notice=inject(GcNotificationService);
 protected readonly access=inject(OrganizationAccess);
 private readonly picker=viewChild(GcFileUpload);
 protected readonly page=new GcPageState<Article>();
 protected readonly units=signal<Unit[]>([]);
 protected readonly kinds=ARTICLE_KINDS;
 protected readonly imageTypes:readonly string[]=['image/jpeg','image/png','image/webp'];
 protected readonly action=new GcConfirmedAction();
 protected readonly mediaAction=new GcConfirmedAction();
 protected readonly statusAction=new GcConfirmedAction();
 protected readonly saveError=signal<string|null>(null);
 protected readonly mediaError=signal<string|null>(null);
 protected readonly statusError=signal<string|null>(null);
 protected readonly reason=signal('');
 protected readonly files=signal<File[]>([]);
 protected readonly uploaded=signal<string[]>([]);
 protected readonly mediaIds=signal<string[]>([]);
 protected readonly dependencies=signal<Record<string,unknown>|null>(null);
 protected readonly form=new FormGroup({
  codigo:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.pattern(/^[A-Za-z][A-Za-z0-9_-]{1,49}$/)]}),
  nombre:new FormControl('',{nonNullable:true,validators:Validators.required}),
  tipo:new FormControl<InventoryKind>('INGREDIENTE',{nonNullable:true}),
  unidadBaseId:new FormControl('',{nonNullable:true,validators:Validators.required}),
  stockMinimo:new FormControl('',{nonNullable:true,validators:Validators.pattern(/^(?:\d+(?:\.\d{1,6})?)?$/)}),
  costoReferencia:new FormControl('',{nonNullable:true,validators:Validators.pattern(/^(?:\d+(?:\.\d{1,6})?)?$/)}),
  requiereLote:new FormControl(false,{nonNullable:true}),
  requiereVencimiento:new FormControl(false,{nonNullable:true})
 });
 async ngOnInit(){
  try{const result=await firstValueFrom(this.api.unitOptions({limit:50}));this.units.set(result.data)}
  catch(e){this.saveError.set(gcErrorMessage(e))}
  if(!this.isNew)await this.load();
 }
 protected canManage(){return this.access.canGlobal('inventory.articles.manage')}
 protected canManageCost(){return this.access.canGlobal('inventory.costs.manage')}
 protected gcError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load()}
 private async load(){
  await this.page.load(()=>firstValueFrom(this.api.article(this.id)));
  const d=this.page.data();if(!d)return;
  this.form.reset({codigo:d.codigo,nombre:d.nombre,tipo:d.tipo,
   unidadBaseId:d.unidadBase?.id??'',stockMinimo:d.stockMinimo??'',
   costoReferencia:d.costoReferencia??'',requiereLote:d.requiereLote,
   requiereVencimiento:d.requiereVencimiento});
  this.form.controls.codigo.disable();this.form.controls.tipo.disable();this.form.controls.unidadBaseId.disable();
  if(!this.canManage())this.form.disable();
  if(!this.canManageCost())this.form.controls.costoReferencia.disable();
  this.mediaIds.set(d.imagenes.map(x=>x.mediaId));
  try{this.dependencies.set(await firstValueFrom(this.api.articleDependencies(this.id)))}
  catch{this.dependencies.set({})}
 }
 protected readonly relationEntries=articleRelations;
 protected openPhoto(url:string|null,alt:string){
  if(!url)return;
  this.previewDialog.open(GcImagePreviewDialog,{
   data:{url,alt},width:'min(94vw,720px)',maxWidth:'94vw',
   ariaLabel:'Vista de fotografía de artículo',autoFocus:'dialog',restoreFocus:true,
  });
 }
 protected orderedPhotos(){
  const data=this.page.data()?.imagenes??[];
  return this.mediaIds().map(id=>data.find(x=>x.mediaId===id)).filter((p):p is InventoryPhoto=>!!p);
 }
 protected mediaDirty(){
  const original=this.page.data()?.imagenes.map(x=>x.mediaId)??[];
  return this.mediaIds().join('|')!==original.join('|');
 }
 protected shift(id:string,direction:number){
  this.mediaIds.update(values=>{
   const list=[...values],from=list.indexOf(id),to=from+direction;
   if(from<0||to<0||to>=list.length)return values;
   [list[from],list[to]]=[list[to],list[from]];
   return list;
  });
 }
 protected remove(id:string){this.mediaIds.update(values=>values.filter(v=>v!==id))}
 protected async save(){
  if(!this.canManage()||this.form.invalid){this.form.markAllAsTouched();return}
  if(this.form.controls.requiereVencimiento.value&&!this.form.controls.requiereLote.value){
   this.saveError.set('El vencimiento requiere control por lotes.');return;
  }
  const v=this.form.getRawValue();
  let minimo:string|null,costo:string|null;
  try{minimo=v.stockMinimo?toApiDecimal(v.stockMinimo):null;
   costo=v.costoReferencia?toApiDecimal(v.costoReferencia):null}
  catch(e){this.saveError.set(gcErrorMessage(e));return}
  const dto:ArticleCreate={codigo:v.codigo.trim(),nombre:v.nombre.trim(),tipo:v.tipo,
   unidadBaseId:v.unidadBaseId,requiereLote:v.requiereLote,requiereVencimiento:v.requiereVencimiento,
   stockMinimo:minimo};
  if(this.canManageCost())dto.costoReferencia=costo;
  const previous=this.page.data();
  if(!this.isNew&&!previous){this.saveError.set('No se pudo cargar el artículo para editarlo.');return}
  const update:ArticleUpdate=previous?articleChanges(previous,v,this.canManageCost()):{};
  this.saveError.set(null);
  if(!this.isNew&&Object.keys(update).length===0){
   this.form.markAsPristine();
   return;
  }
  const r=await this.action.runConfirmed<Article>(this.dialog,{
   title:this.isNew?'Crear artículo':'Guardar artículo',
   message:this.isNew?'¿Registrar este artículo?':'¿Guardar los cambios del artículo?',
   confirmText:this.isNew?'Crear artículo':'Guardar cambios'},
   ()=>firstValueFrom(this.isNew?this.api.createArticle(dto):this.api.updateArticle(this.id,update)));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.saveError.set(gcErrorMessage(r.error));return}
  this.form.markAsPristine();
  if(this.isNew)await this.router.navigate(['/inventory/articles',r.value.id]);
  else{await this.load();this.notice.show('Artículo actualizado.','success')}
 }
 protected async saveImages(){
  if(!this.canManage()||this.form.dirty)return;
  if(this.mediaIds().length+this.files().length>10){
   this.mediaError.set('Máximo diez imágenes por artículo.');return;
  }
  this.mediaError.set(null);
  const r=await this.mediaAction.runConfirmed(this.dialog,{
   title:'Guardar fotografías',message:'¿Actualizar la galería del artículo?',
   confirmText:'Guardar fotografías'},
   async()=>{
    const ids=[...this.uploaded()];
    for(const file of this.files().slice(ids.length)){
     const result=await firstValueFrom(this.media.upload(file,'INVENTARIO'));
     ids.push(result.id);this.uploaded.set([...ids]);
    }
    return firstValueFrom(this.api.articleMedia(this.id,[...this.mediaIds(),...ids]));
   });
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.mediaError.set(gcErrorMessage(r.error));return}
  this.picker()?.reset();this.files.set([]);this.uploaded.set([]);
  this.page.data.set(r.value);this.mediaIds.set(r.value.imagenes.map(x=>x.mediaId));
  this.notice.show('Fotografías actualizadas.','success');
 }
 protected async changeStatus(){
  const d=this.page.data();if(!d||this.reason().trim().length<3)return;
  this.statusError.set(null);
  const r=await this.statusAction.runConfirmed(this.dialog,{
   title:d.activo?'Desactivar artículo':'Activar artículo',
   message:'El servidor comprobará existencias y relaciones pendientes. ¿Continuar?',
   confirmText:d.activo?'Desactivar':'Activar',danger:d.activo},
   ()=>firstValueFrom(this.api.articleStatus(this.id,!d.activo,this.reason().trim())));
  if(!r)return;
  if(!r.ok){if(r.reason==='error')this.statusError.set(gcErrorMessage(r.error));return}
  this.reason.set('');await this.load();this.notice.show('Estado actualizado.','success');
 }
 hasUnsavedChanges(){return this.form.dirty||this.mediaDirty()||this.files().length>0}
}
