import {Component,inject} from '@angular/core';
import {MAT_DIALOG_DATA,MatDialogRef} from '@angular/material/dialog';

export interface GcImagePreviewData {url:string;alt:string}

/** Reusable, accessible image lightbox constrained to a modest dialog. */
@Component({
 selector:'gc-image-preview-dialog',
 template:`
 <section class="gc-preview-panel" aria-labelledby="gc-preview-title">
  <div class="gc-preview-heading">
   <h2 id="gc-preview-title">Vista de la fotografía</h2>
   <button type="button" class="gc-preview-close" (click)="close()" aria-label="Cerrar fotografía">Cerrar</button>
  </div>
  <img [src]="data.url" [alt]="data.alt" loading="eager"/>
 </section>`,
 styles:[`
  :host{display:block}
  .gc-preview-panel{background:var(--gc-surface-container-low);color:var(--gc-on-surface);
    padding:clamp(.65rem,2vw,1rem);display:grid;gap:.75rem;max-height:85vh}
  .gc-preview-heading{display:flex;align-items:center;justify-content:space-between;gap:.75rem}
  h2{font-size:1rem;margin:0}
  .gc-preview-close{background:var(--gc-surface);color:var(--gc-on-surface);
    border:1px solid var(--gc-outline);border-radius:.5rem;padding:.4rem .75rem;
    min-height:40px;cursor:pointer}
  .gc-preview-close:focus-visible{outline:2px solid var(--gc-primary);outline-offset:3px}
  img{display:block;max-width:100%;max-height:min(66vh,620px);width:auto;height:auto;
    object-fit:contain;margin:auto;border-radius:.5rem}
 `],
})
export class GcImagePreviewDialog {
 protected readonly data=inject<GcImagePreviewData>(MAT_DIALOG_DATA);
 private readonly ref=inject(MatDialogRef<GcImagePreviewDialog>);
 protected close(){this.ref.close()}
}
