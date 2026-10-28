import { Component, input } from '@angular/core';

@Component({
  selector: 'gc-page-container',
  template: '<div class="gc-page-container" [class.gc-page-narrow]="width() === \'narrow\'" [class.gc-page-wide]="width() === \'wide\'"><ng-content /></div>',
  styles: [ `
    :host { display:block; min-width:0; }
    .gc-page-container { width:100%; max-width:70rem; margin-inline:auto; }
    .gc-page-narrow { max-width:45rem; }
    .gc-page-wide { max-width:90rem; }
  ` ],
})
export class GcPageContainer {
  readonly width = input<'narrow' | 'normal' | 'wide'>('normal');
}
