import { Component, input, output } from '@angular/core';
import { GcButtonDirective } from '../components/button/gc-button.directive';

@Component({
  selector: 'gc-form-actions',
  imports: [GcButtonDirective],
  template: `
    <div class="gc-form-actions">
      <button gcButton variant="outline" type="button" [disabled]="index() === 0 || busy()"
        (click)="previous.emit()">Anterior</button>
      @if (index() >= count()) {
        <button gcButton type="button" [disabled]="busy()" (click)="finish.emit()">
          {{ busy() ? 'Procesando…' : 'Confirmar y finalizar' }}
        </button>
      } @else {
        <button gcButton type="button" [disabled]="busy()" (click)="advance.emit()">
          {{ index() === count() - 1 ? 'Revisar información' : 'Siguiente paso' }}
        </button>
      }
    </div>
  `,
  styles: [ `
    .gc-form-actions { display:flex; align-items:center; justify-content:space-between; gap:.75rem; flex-wrap:wrap; }
    @media(max-width:460px) { .gc-form-actions button { flex:1; } }
  ` ],
})
export class GcFormActions {
  readonly index = input.required<number>();
  readonly count = input.required<number>();
  readonly busy = input(false);
  readonly previous = output<void>();
  readonly advance = output<void>();
  readonly finish = output<void>();
}
