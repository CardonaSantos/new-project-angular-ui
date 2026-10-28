import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MaskitoDirective } from '@maskito/angular';
import { MaskitoOptions } from '@maskito/core';

@Component({
  selector: 'gc-masked-input',
  imports: [ReactiveFormsModule, MaskitoDirective],
  template: `
    <label [for]="inputId()">{{ label() }}</label>
    <input
      [id]="inputId()"
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      [formControl]="control()"
      [maskito]="options()"
      [attr.aria-describedby]="hint() ? inputId() + '-help' : null"
      [placeholder]="placeholder()" />
    @if (hint()) { <small [id]="inputId() + '-help'">{{ hint() }}</small> }
  `,
  styles: [ `
    :host { display:grid; gap:.4rem; }
    label { font-weight:600; font-size:.875rem; }
    input { width:100%; min-height:var(--gc-control-height); padding:.6rem .75rem; border:1px solid var(--gc-outline); background:var(--gc-surface); color:var(--gc-on-surface); border-radius:calc(var(--gc-radius) * .65); }
    small { color:var(--gc-on-surface-variant); }
  ` ],
})
export class GcMaskedInput {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly options = input.required<MaskitoOptions>();
  readonly hint = input('');
  readonly placeholder = input('');
}
