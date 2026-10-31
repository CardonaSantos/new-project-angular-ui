import { Component, OnDestroy, computed, inject, input, output, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { gcCheckFiles } from './gc-file-validation';
import { GcImageCropDialog } from './gc-image-crop-dialog';

export interface GcFilePreview { name:string;url:string }
const EXTENSIONS:Record<string,string>={
 'image/jpeg':'.jpg,.jpeg','image/png':'.png','image/webp':'.webp',
 'image/gif':'.gif','application/pdf':'.pdf'
};
const NAMES:Record<string,string>={
 'image/jpeg':'JPG','image/png':'PNG','image/webp':'WebP',
 'image/gif':'GIF','application/pdf':'PDF'
};

/** Generic upload picker: validates first, optionally crops, then emits Files. Never uploads by itself. */
@Component({
 selector:'gc-file-upload',templateUrl:'./gc-file-upload.html',styleUrl:'./gc-file-upload.scss'
})
export class GcFileUpload implements OnDestroy {
 private readonly dialog=inject(MatDialog);
 readonly inputId=input.required<string>();
 readonly label=input('Adjuntar imágenes');
 readonly maxFiles=input(3);
 readonly maxSizeMb=input(2);
 readonly acceptedMime=input<readonly string[]>(['image/png','image/jpeg','image/webp']);
 readonly cropSquare=input(false);
 readonly acceptAttribute=computed(()=>this.acceptedMime().map(m=>EXTENSIONS[m]??m).join(','));
 readonly formatLabel=computed(()=>this.acceptedMime().map(m=>NAMES[m]??m).join(', '));
 readonly filesSelected=output<readonly File[]>();
 readonly errors=signal<readonly string[]>([]);
 readonly previews=signal<readonly GcFilePreview[]>([]);
 readonly processing=signal(false);
 private objectUrls:string[]=[];

 protected async onFiles(event:Event):Promise<void> {
  const target=event.target as HTMLInputElement;
  const picked=Array.from(target.files??[]);
  target.value=''; // Re-selecting the same file must work.
  if(!picked.length||this.processing())return;
  const result=gcCheckFiles(picked,{
   maxFiles:this.maxFiles(),maxBytes:this.maxSizeMb()*1024*1024,
   allowedMime:this.acceptedMime()
  });
  this.errors.set(result.errors);
  if(result.errors.length||!result.accepted.length)return;
  this.processing.set(true);
  try{
   let accepted=[...result.accepted];
   if(this.cropSquare()){
    if(accepted.length!==1)throw new Error('Selecciona una sola fotografía.');
    const dialog=this.dialog.open<GcImageCropDialog,File,File>(GcImageCropDialog,{
      data:accepted[0],width:'min(94vw,440px)',maxWidth:'94vw',
      ariaLabel:'Recortar fotografía',autoFocus:'dialog',restoreFocus:true
    });
    const cropped=await firstValueFrom(dialog.afterClosed());
    if(!cropped)return; // Cancellation preserves the last valid selection.
    accepted=[cropped];
   }
   this.clearPreviews();
   this.previews.set(accepted.map(file=>{
    const url=URL.createObjectURL(file);
    this.objectUrls.push(url);
    return {name:file.name,url};
   }));
   this.filesSelected.emit(accepted);
  }catch{
   this.errors.set(['No se pudo preparar la fotografía. Selecciona otra imagen.']);
  }finally{this.processing.set(false)}
 }

 protected clear(){
  if(this.processing())return;
  this.clearPreviews();
  this.errors.set([]);
  this.filesSelected.emit([]);
 }
 private clearPreviews(){
  for(const url of this.objectUrls)URL.revokeObjectURL(url);
  this.objectUrls=[];
  this.previews.set([]);
 }
 ngOnDestroy(){this.clearPreviews()}
}
