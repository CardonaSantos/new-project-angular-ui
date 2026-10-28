import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'gc-textarea',
  imports: [ReactiveFormsModule],
  template: `
    <label [for]="inputId()">{{ label() }}</label>
    <textarea [id]="inputId()" [formControl]="control()" [rows]="rows()"
      [placeholder]="placeholder()"
      [attr.aria-invalid]="control().invalid && (control().dirty || control().touched)"></textarea>
    @if (hint()) { <small>{{ hint() }}</small> }
  `,
  styles: [ `
    :host { display:grid; min-width:0; gap:.4rem; }
    label { font-size:.875rem; font-weight:600; }
    textarea { width:100%; min-width:0; min-height:6rem; resize:vertical; padding:.7rem .8rem;
      border:1px solid var(--gc-outline); border-radius:calc(var(--gc-radius) * .65);
      color:var(--gc-on-surface); background:var(--gc-surface); }
    textarea[aria-invalid="true"] { border-color:var(--gc-error); }
    small { color:var(--gc-on-surface-variant); }
  ` ],
})
export class GcTextarea {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly rows = input(3);
  readonly placeholder = input('');
  readonly hint = input('');
}
