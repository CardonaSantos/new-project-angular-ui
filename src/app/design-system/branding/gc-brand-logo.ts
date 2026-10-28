import { Component, effect, input, signal } from '@angular/core';

@Component({
  selector: 'gc-brand-logo',
  template: `
    @if (logoUrl() && !broken()) {
      <img [src]="logoUrl()" alt="" (error)="broken.set(true)" />
    } @else {
      <span class="fallback" aria-hidden="true">GC</span>
    }
    @if (showName()) { <strong>{{ name() }}</strong> }
  `,
  styles: [ `
    :host { display:flex; align-items:center; gap:.65rem; min-width:0; }
    img,.fallback { flex:none; width:2.5rem; height:2.5rem; object-fit:contain; border-radius:calc(var(--gc-radius) * .7); }
    .fallback { display:grid; place-items:center; font-weight:800; color:var(--gc-on-primary); background:var(--gc-primary); font-size:.8rem; }
    strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:1.125rem; }
  ` ],
})
export class GcBrandLogo {
  readonly logoUrl = input<string | null>(null);
  readonly name = input('Gastro Core');
  readonly showName = input(true);
  readonly broken = signal(false);

  constructor() {
    effect(() => {
      this.logoUrl();
      this.broken.set(false);
    });
  }
}
