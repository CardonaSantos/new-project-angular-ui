import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

export type GcTextInputType = 'text' | 'email' | 'search' | 'password' | 'tel' | 'url';

@Component({
  selector: 'gc-text-input',
  imports: [ReactiveFormsModule],
  template: `
    <label [for]="inputId()">{{ label() }}</label>
    <input [id]="inputId()" [type]="type()" [formControl]="control()"
      [placeholder]="placeholder()" [autocomplete]="autocomplete()"
      [attr.aria-invalid]="control().invalid && (control().dirty || control().touched)"
      [attr.aria-describedby]="hint() ? inputId() + '-hint' : null" />
    @if (hint()) { <small [id]="inputId() + '-hint'">{{ hint() }}</small> }
    @if (control().invalid && (control().dirty || control().touched)) {
      <span class="error" role="alert">Revisa {{ label() }}.</span>
    }
  `,
  styles: [ `
    :host { display:grid; min-width:0; gap:.4rem; }
    label { font-size:.875rem; font-weight:600; }
    input { width:100%; min-width:0; min-height:var(--gc-control-height);
      padding:.55rem .75rem; border:1px solid var(--gc-outline);
      border-radius:calc(var(--gc-radius) * .65); background:var(--gc-surface); color:var(--gc-on-surface); }
    input[aria-invalid="true"] { border-color:var(--gc-error); }
    input:disabled { opacity:.6; cursor:not-allowed; }
    small { color:var(--gc-on-surface-variant); }
    .error { color:var(--gc-error); font-size:.8rem; }
    @media (pointer:coarse) { input { min-height:44px; } }
  ` ],
})
export class GcTextInput {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly type = input<GcTextInputType>('text');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly autocomplete = input('off');
}
