import {Component,computed,effect,inject,input,output,signal,viewChild} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {GcFileUpload} from '../../../design-system/forms/gc-file-upload';
import {GcImagePreviewDialog} from '../../../design-system/media/gc-image-preview-dialog';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {CatalogApi} from '../data-access/catalog.api';
import {MediaApi} from '../../users/data-access/users.api';
import type {CatalogPhoto} from '../data-access/catalog.models';

export type CatalogGalleryKind='category'|'product'|'variant';
@Component({
 selector:'gc-catalog-gallery',imports:[GcFileUpload],
 template:`
 <section class="cat-card">
  <h2>Fotografías</h2>
  <div class="cat-gallery">
   @for(id of order();track id){
    @if(photo(id);as pic){
     <div class="cat-gallery-item">
      @if(pic.url){
       <button type="button" class="cat-photo-button" (click)="preview(pic.url)" aria-label="Ampliar fotografía">
        <img [src]="pic.url" alt="Fotografía comercial" loading="lazy"/>
       </button>
      }
      @if(editable()){
       <div class="cat-actions">
        <button type="button" (click)="move(id,-1)" [disabled]="busy()" aria-label="Mover fotografía antes">↑</button>
        <button type="button" (click)="move(id,1)" [disabled]="busy()" aria-label="Mover fotografía después">↓</button>
        <button type="button" (click)="remove(id)" [disabled]="busy()">Quitar</button>
       </div>
      }
     </div>
    }
   } @empty {<p class="cat-muted">Todavía no hay fotografías.</p>}
  </div>
  @if(editable()){
   @if(order().length<12){
    <gc-file-upload inputId="catalog-photo" label="Agregar fotografías" [cropSquare]="true"
     [maxFiles]="12-order().length" [maxSizeMb]="10"
     (filesSelected)="files.set([...$event])"/>
   } @else {<p class="cat-muted">Máximo de 12 fotografías. Retira una para subir otra.</p>}
   <p class="cat-muted">Recorta las fotografías antes de subirlas. La primera será la principal.</p>
   @if(error()){<p role="alert" class="cat-alert">{{error()}}</p>}
   <button type="button" class="cat-primary" (click)="save()" [disabled]="busy()||(!dirty()&&!files().length)">
    {{busy()?'Guardando…':'Guardar galería'}}
   </button>
  }
 </section>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogGallery{
 readonly entityId=input.required<string>();
 readonly kind=input.required<CatalogGalleryKind>();
 readonly photos=input<readonly CatalogPhoto[]>([]);
 readonly editable=input(false);
 readonly updated=output<void>();
 protected readonly files=signal<File[]>([]);
 protected readonly order=signal<string[]>([]);
 protected readonly error=signal<string|null>(null);
 protected readonly busy=signal(false);
 private readonly picker=viewChild(GcFileUpload);
 private readonly api=inject(CatalogApi);
 private readonly media=inject(MediaApi);
 private readonly dialog=inject(MatDialog);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notice=inject(GcNotificationService);
 private synced='';
 protected readonly dirty=computed(()=>this.order().join('|')!==this.photos().map(x=>x.mediaId).join('|'));
 constructor(){
  effect(()=>{
   const items=this.photos(),key=this.entityId()+'|'+items.map(p=>p.mediaId).join('|');
   if(key!==this.synced){this.synced=key;this.order.set(items.map(p=>p.mediaId))}
  });
 }
 protected photo(id:string){return this.photos().find(p=>p.mediaId===id)}
 protected move(id:string,d:number){this.order.update(a=>{
  const v=[...a],i=v.indexOf(id),j=i+d;
  if(i<0||j<0||j>=v.length)return a;
  [v[i],v[j]]=[v[j],v[i]];return v;
 })}
 protected remove(id:string){this.order.update(v=>v.filter(x=>x!==id))}
 protected preview(url:string){this.dialog.open(GcImagePreviewDialog,{
  data:{url,alt:'Fotografía comercial'},width:'min(94vw,720px)',maxWidth:'94vw',
  ariaLabel:'Vista de fotografía comercial',restoreFocus:true
 })}
 protected async save(){
  if(!this.editable()||this.busy()||this.order().length+this.files().length>12)return;
  const ok=await this.confirm.confirm({title:'Guardar fotografías',
   message:'¿Actualizar las fotografías de este registro?',confirmText:'Guardar'});
  if(!ok)return;
  this.busy.set(true);this.error.set(null);
  try{
   const ids=[...this.order()];
   for(const file of this.files())ids.push((await firstValueFrom(this.media.upload(file,
    this.kind()==='category'?'CATEGORIA':'PRODUCTO'))).id);
   if(this.kind()==='category')await firstValueFrom(this.api.categoryMedia(this.entityId(),ids));
   else if(this.kind()==='variant')await firstValueFrom(this.api.variantMedia(this.entityId(),ids));
   else await firstValueFrom(this.api.productMedia(this.entityId(),ids));
   this.files.set([]);this.picker()?.reset();
   this.updated.emit();this.notice.show('Fotografías guardadas.','success');
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
}
