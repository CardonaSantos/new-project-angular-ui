import { Component, input, output } from '@angular/core';

export interface GcFilterOption {
  label: string;
  value: string;
}

@Component({
  selector: 'gc-filter-bar',
  template: `
    <div class="gc-filter-bar">
      <label [for]="filterId()">{{ label() }}</label>
      <select [id]="filterId()" [value]="value()" (change)="valueChange.emit($any($event.target).value)">
        @for (option of options(); track option.value) {
          <option [value]="option.value">{{ option.label }}</option>
        }
      </select>
    </div>
  `,
  styles: [ `
    .gc-filter-bar { display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; }
    label { font-size:.875rem; font-weight:600; }
    select {
      min-height:var(--gc-control-height); min-width:10rem; padding:.5rem .75rem;
      border:1px solid var(--gc-outline); border-radius:calc(var(--gc-radius) * .65);
      background:var(--gc-surface); color:var(--gc-on-surface);
    }
  ` ],
})
export class GcFilterBar {
  readonly filterId = input.required<string>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly GcFilterOption[]>();
  readonly value = input('');
  readonly valueChange = output<string>();
}
