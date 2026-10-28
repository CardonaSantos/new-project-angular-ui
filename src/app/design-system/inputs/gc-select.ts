import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

export interface GcSelectOption { label: string; value: string; disabled?: boolean }

@Component({
  selector: 'gc-select',
  imports: [ReactiveFormsModule],
  template: `
    <label [for]="inputId()">{{ label() }}</label>
    <select [id]="inputId()" [formControl]="control()"
      [attr.aria-invalid]="control().invalid && (control().dirty || control().touched)">
      @if (placeholder()) { <option value="" disabled>{{ placeholder() }}</option> }
      @for (option of options(); track option.value) {
        <option [value]="option.value" [disabled]="option.disabled">{{ option.label }}</option>
      }
    </select>
  `,
  styles: [ `
    :host { display:grid; min-width:0; gap:.4rem; }
    label { font-size:.875rem; font-weight:600; }
    select { min-width:0; width:100%; min-height:var(--gc-control-height); padding:.55rem .75rem;
      background:var(--gc-surface); color:var(--gc-on-surface); border:1px solid var(--gc-outline);
      border-radius:calc(var(--gc-radius) * .65); }
    select[aria-invalid="true"] { border-color:var(--gc-error); }
  ` ],
})
export class GcSelect {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly options = input.required<readonly GcSelectOption[]>();
  readonly placeholder = input('');
}
