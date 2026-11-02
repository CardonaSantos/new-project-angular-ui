
import {AfterViewInit,Component,ElementRef,OnDestroy,inject,signal,viewChild} from '@angular/core';
import {MAT_DIALOG_DATA,MatDialogRef} from '@angular/material/dialog';

const VIEW=320;
const OUTPUT=512;

/** Small reusable square image crop. The server still verifies the resulting image. */
@Component({
 selector:'gc-image-crop-dialog',
 template:`
 <section class="crop-panel" aria-labelledby="crop-title">
  <h2 id="crop-title">Recortar fotografía</h2>
  <p id="crop-help">Arrastra la imagen para encuadrarla. También puedes usar las flechas del teclado.</p>
  <canvas #preview width="320" height="320" tabindex="0" role="img"
   aria-label="Vista previa del recorte cuadrado. Usa las flechas para mover la fotografía."
   aria-describedby="crop-help" (pointerdown)="beginDrag($event)" (pointermove)="drag($event)"
   (pointerup)="endDrag()" (pointercancel)="endDrag()" (lostpointercapture)="endDrag()"
   (keydown)="moveWithKeyboard($event)"></canvas>
  <label for="crop-zoom">Acercar imagen</label>
  <input id="crop-zoom" type="range" min="1" max="3" step="0.05"
    [value]="zoom()" (input)="changeZoom($any($event.target).value)"
    [disabled]="!ready()||saving()"/>
  @if(error()){<p class="error" role="alert">{{error()}}</p>}
  <div class="actions">
   <button type="button" class="secondary" (click)="cancel()" [disabled]="saving()">Cancelar</button>
   <button type="button" class="primary" (click)="apply()" [disabled]="!ready()||saving()">
    {{saving()?'Preparando…':'Aplicar recorte'}}
   </button>
  </div>
 </section>`,
 styles:[`
  :host {display:block;min-width:0}
  .crop-panel{display:grid;gap:.85rem;min-width:0;padding:clamp(.75rem,3vw,1.3rem);
    background:var(--gc-surface-container-low);color:var(--gc-on-surface)}
  h2{font-size:1.3rem;margin:0}
  p{font-size:.9rem;margin:0;color:var(--gc-on-surface-variant)}
  canvas{display:block;width:min(100%,320px);height:auto;aspect-ratio:1;
    touch-action:none;cursor:grab;justify-self:center;outline-offset:4px;
    border-radius:.65rem;border:1px solid var(--gc-outline-variant);background:var(--gc-surface)}
  canvas:active{cursor:grabbing}
  canvas:focus-visible,input:focus-visible,button:focus-visible{outline:2px solid var(--gc-primary);outline-offset:3px}
  label{font-weight:600;font-size:.875rem}
  input[type=range]{width:100%;min-height:44px;accent-color:var(--gc-primary)}
  .actions{display:flex;justify-content:flex-end;gap:.85rem;flex-wrap:wrap;margin-top:.35rem}
  button{min-height:44px;padding:.55rem 1rem;border-radius:.6rem;cursor:pointer;border:1px solid var(--gc-outline);
    color:var(--gc-on-surface);background:var(--gc-surface)}
  button:disabled{cursor:wait;opacity:.55}
  .primary{background:var(--gc-primary);color:var(--gc-on-primary);border-color:transparent}
  .error{color:var(--gc-error)}
  @media(max-width:420px){.actions{justify-content:stretch}.actions button{flex:1 1 9rem}}
 `],
})
export class GcImageCropDialog implements AfterViewInit,OnDestroy {
 private readonly file=inject<File>(MAT_DIALOG_DATA);
 private readonly dialog=inject(MatDialogRef<GcImageCropDialog,File|undefined>);
 private readonly canvas=viewChild.required<ElementRef<HTMLCanvasElement>>('preview');
 protected readonly zoom=signal(1);
 protected readonly ready=signal(false);
 protected readonly saving=signal(false);
 protected readonly error=signal<string|null>(null);
 private readonly image=new Image();
 private readonly url=URL.createObjectURL(this.file);
 private x=0;private y=0;private pointer:number|null=null;private lastX=0;private lastY=0;

 ngAfterViewInit(){
  this.image.onload=()=>{this.ready.set(true);this.paint()};
  this.image.onerror=()=>this.error.set('No se pudo abrir la imagen. Elige otra fotografía.');
  this.image.src=this.url;
 }
 ngOnDestroy(){this.image.onload=null;this.image.onerror=null;URL.revokeObjectURL(this.url)}
 private position(){
  const scale=Math.max(VIEW/this.image.naturalWidth,VIEW/this.image.naturalHeight)*this.zoom();
  const width=this.image.naturalWidth*scale,height=this.image.naturalHeight*scale;
  return {width,height};
 }
 private clamp(){
  if(!this.ready())return;
  const {width,height}=this.position();
  this.x=Math.max(-(width-VIEW)/2,Math.min((width-VIEW)/2,this.x));
  this.y=Math.max(-(height-VIEW)/2,Math.min((height-VIEW)/2,this.y));
 }
 private render(context:CanvasRenderingContext2D,size:number){
  const {width,height}=this.position(),f=size/VIEW;
  context.clearRect(0,0,size,size);
  context.imageSmoothingEnabled=true;
  context.imageSmoothingQuality='high';
  context.drawImage(this.image,(VIEW/2-width/2+this.x)*f,
    (VIEW/2-height/2+this.y)*f,width*f,height*f);
 }
 private paint(){
  if(!this.ready())return;
  this.clamp();
  const ctx=this.canvas().nativeElement.getContext('2d');
  if(ctx)this.render(ctx,VIEW);
 }
 protected changeZoom(v:string){this.zoom.set(Number(v));this.paint()}
 protected beginDrag(e:PointerEvent){
  if(!this.ready())return;
  this.pointer=e.pointerId;this.lastX=e.clientX;this.lastY=e.clientY;
  (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
 }
 protected drag(e:PointerEvent){
  if(e.pointerId!==this.pointer||!this.ready())return;
  const rect=this.canvas().nativeElement.getBoundingClientRect(),f=VIEW/rect.width;
  this.x+=(e.clientX-this.lastX)*f;this.y+=(e.clientY-this.lastY)*f;
  this.lastX=e.clientX;this.lastY=e.clientY;this.paint();
 }
 protected endDrag(){this.pointer=null}
 protected moveWithKeyboard(e:KeyboardEvent){
  const movements:Record<string,[number,number]>={
   ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]
  };
  const move=movements[e.key];if(!move||!this.ready())return;
  e.preventDefault();this.x+=move[0];this.y+=move[1];this.paint();
 }
 protected cancel(){this.dialog.close()}
 protected async apply(){
  if(!this.ready()||this.saving())return;
  this.saving.set(true);this.error.set(null);
  try{
   const canvas=document.createElement('canvas');
   canvas.width=OUTPUT;canvas.height=OUTPUT;
   const ctx=canvas.getContext('2d');
   if(!ctx)throw new Error('No se pudo preparar la imagen.');
   this.render(ctx,OUTPUT);
   const mime=this.file.type==='image/png'?'image/png':'image/jpeg';
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime,.9));
   if(!blob)throw new Error('No se pudo procesar el recorte.');
   const name=this.file.name.replace(/\.[^.]+$/,'')+(mime==='image/png'?'.png':'.jpg');
   this.dialog.close(new File([blob],name,{type:mime,lastModified:Date.now()}));
  }catch{
   this.error.set('No se pudo recortar la fotografía. Prueba con otra imagen.');
  }finally{this.saving.set(false)}
 }
}
