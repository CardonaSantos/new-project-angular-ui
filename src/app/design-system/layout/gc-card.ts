import { Component, input } from '@angular/core';

/** Lightweight semantic card; content uses named slots, not nested fixed margins. */
@Component({
  selector: 'gc-card',
  template: `
    <section class="gc-card" [class.gc-card-flat]="appearance() === 'flat'">
      <header class="gc-card-header">
        <div class="gc-card-heading">
          @if (title()) { <h2>{{ title() }}</h2> }
          @if (description()) { <p>{{ description() }}</p> }
        </div>
        <ng-content select="[gcCardActions]" />
      </header>
      <div class="gc-card-body"><ng-content /></div>
      <footer class="gc-card-footer"><ng-content select="[gcCardFooter]" /></footer>
    </section>
  `,
  styles: [ `
    :host { display:block; min-width:0; }
    .gc-card { background:var(--gc-surface-container-low); color:var(--gc-on-surface);
      border:1px solid var(--gc-outline-variant); border-radius:var(--gc-radius);
      padding:var(--gc-card-padding,1.5rem); display:grid; gap:var(--gc-space-4,1rem); }
    .gc-card-flat { background:var(--gc-surface); }
    .gc-card-header { display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:.75rem; }
    .gc-card-heading { min-width:0; }
    h2 { font-size:1.125rem; margin:0; overflow-wrap:anywhere; }
    p { color:var(--gc-on-surface-variant); line-height:1.5; margin:.4rem 0 0; }
    .gc-card-body { min-width:0; }
    .gc-card-footer:empty { display:none; }
    .gc-card-footer { border-top:1px solid var(--gc-outline-variant); padding-top:.75rem; }
  ` ],
})
export class GcCard {
  readonly title = input('');
  readonly description = input('');
  readonly appearance = input<'flat' | 'filled'>('filled');
}
