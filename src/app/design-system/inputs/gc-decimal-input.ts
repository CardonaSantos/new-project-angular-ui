import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import Decimal from 'decimal.js';

/** Monetary/quantity inputs expose exact decimal strings, not floating-point numbers. */
@Component({
  selector: 'gc-decimal-input',
  imports: [ReactiveFormsModule],
  template: `
    <label [for]="inputId()">{{ label() }}</label>
    <div class="gc-decimal-row">
      @if (prefix()) { <span class="prefix">{{ prefix() }}</span> }
      <input [id]="inputId()" type="text" inputmode="decimal"
        [formControl]="control()" [placeholder]="placeholder()"
        (blur)="normalize()" [attr.aria-invalid]="error() !== null"
        [attr.aria-describedby]="hint() ? inputId() + '-hint' : null" />
    </div>
    @if (hint()) { <small [id]="inputId() + '-hint'">{{ hint() }}</small> }
    @if (error()) { <span class="error" role="alert">{{ error() }}</span> }
  `,
  styles: [ `
    :host { display:grid; min-width:0; gap:.4rem; }
    label { font-size:.875rem; font-weight:600; }
    .gc-decimal-row { display:flex; align-items:center; border:1px solid var(--gc-outline); border-radius:calc(var(--gc-radius) * .65);
      background:var(--gc-surface); min-height:var(--gc-control-height); }
    .gc-decimal-row:focus-within { outline:2px solid var(--gc-primary); outline-offset:2px; }
    .prefix { padding-left:.75rem; font-weight:600; color:var(--gc-on-surface-variant); }
    input { flex:1; min-width:0; width:100%; border:0; outline:none; color:var(--gc-on-surface); background:transparent;
      min-height:var(--gc-control-height); padding:.5rem .75rem; }
    small { color:var(--gc-on-surface-variant); }
    .error { color:var(--gc-error); font-size:.8rem; }
  ` ],
})
export class GcDecimalInput {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly prefix = input('');
  readonly scale = input(2);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly placeholder = input('0.00');
  readonly hint = input('');
  readonly error = signal<string | null>(null);

  protected normalize(): void {
    const raw = this.control().value.trim().replace(',', '.');
    if (!raw) { this.error.set(null); return; }
    const places = Math.max(0, Math.min(6, this.scale()));
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
      this.error.set('Introduce un número decimal válido.');
      return;
    }
    try {
      const number = new Decimal(raw);
      if (number.decimalPlaces() > places) {
        this.error.set('Se permiten como máximo ' + places + ' decimales.');
        return;
      }
      if (this.min() !== null && number.lessThan(new Decimal(this.min()!))) {
        this.error.set('El valor no puede ser menor que ' + this.min() + '.');
        return;
      }
      if (this.max() !== null && number.greaterThan(new Decimal(this.max()!))) {
        this.error.set('El valor no puede superar ' + this.max() + '.');
        return;
      }
      this.error.set(null);
      this.control().setValue(number.toFixed(places));
    } catch {
      this.error.set('Introduce un número decimal válido.');
    }
  }
}
