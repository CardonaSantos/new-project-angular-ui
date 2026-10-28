import { Component, input } from '@angular/core';

@Component({
  selector: 'gc-skeleton',
  template: `
    <div class="gc-skeleton" role="status" [attr.aria-label]="label()">
      @for (line of lineIds(); track line) {
        <span class="gc-skeleton-line" aria-hidden="true"></span>
      }
      <span class="gc-visually-hidden">{{ label() }}</span>
    </div>
  `,
  styles: [ `
    .gc-skeleton { padding:1rem; display:grid; gap:.8rem; }
    .gc-skeleton-line { display:block; width:100%; height:1.125rem; border-radius:.35rem; background:var(--gc-surface-container); animation:gc-pulse 1.6s ease-in-out infinite alternate; }
    .gc-skeleton-line:nth-child(3n) { width:76%; }
    .gc-visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
    @keyframes gc-pulse { from { opacity:.55; } to { opacity:1; } }
    @media(prefers-reduced-motion:reduce) { .gc-skeleton-line { animation:none; } }
  ` ],
})
export class GcSkeleton {
  readonly lines = input(4);
  readonly label = input('Cargando');
  protected readonly lineIds = () => Array.from({ length: Math.min(20, Math.max(1, this.lines())) }, (_, i) => i);
}
