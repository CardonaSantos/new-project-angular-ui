import { Component } from '@angular/core';

@Component({
  selector: 'gc-workspace-page',
  template: `
    <section class="gc-home">
      <h1>Inicio</h1>
    </section>
  `,
  styles: [`
    :host { display:block; }
    h1 { margin:0; font-size:clamp(1.5rem, 2.5vw, 2rem); font-weight:650; }
  `],
})
export class GcWorkspacePage {}
