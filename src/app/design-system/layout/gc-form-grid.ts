import { Component, input } from '@angular/core';

@Component({
  selector: 'gc-form-grid',
  template: '<div class="gc-form-grid" [class.gc-columns-2]="columns() === 2" [class.gc-columns-3]="columns() === 3"><ng-content /></div>',
  styles: [ `
    :host { display:block; min-width:0; }
    .gc-form-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:var(--gc-space-4,1rem); }
    .gc-columns-2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .gc-columns-3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
    @media (max-width:850px) { .gc-columns-3 { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:620px) { .gc-columns-2,.gc-columns-3 { grid-template-columns:minmax(0,1fr); } }
  ` ],
})
export class GcFormGrid {
  readonly columns = input<1 | 2 | 3>(1);
}
