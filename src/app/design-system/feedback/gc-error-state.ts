import { Component, input, output } from '@angular/core';

@Component({
  selector: 'gc-error-state',
  template: `
    <section class="gc-error" role="alert">
      <strong>{{ title() }}</strong>
      <p>{{ message() }}</p>
      <button type="button" (click)="retry.emit()">Reintentar</button>
    </section>
  `,
  styles: [ `
    .gc-error { border:1px solid var(--gc-error); border-radius:var(--gc-radius); padding:1.25rem; color:var(--gc-on-surface); background:var(--gc-surface-container-low); }
    strong { color:var(--gc-error); }
    p { margin:.5rem 0 1rem; }
    button { cursor:pointer; padding:.5rem .85rem; min-height:44px; background:var(--gc-primary); color:var(--gc-on-primary); border:0; border-radius:calc(var(--gc-radius) * .6); }
  ` ],
})
export class GcErrorState {
  readonly title = input('No fue posible cargar los datos');
  readonly message = input('Comprueba tu conexión e inténtalo de nuevo.');
  readonly retry = output<void>();
}
