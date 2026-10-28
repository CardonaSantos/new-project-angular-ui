import { Component, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

export interface GcBarcodeScan { code: string; source: 'keyboard' }

/** USB/Bluetooth keyboard-wedge input: the reader usually ends each code with Enter. */
@Component({
  selector: 'gc-barcode-input',
  imports: [ReactiveFormsModule],
  template: `
    <label [for]="inputId()">{{ label() }}</label>
    <div class="barcode-row">
      <input [id]="inputId()" type="text" [formControl]="control()"
        autocomplete="off" autocapitalize="off" spellcheck="false"
        [placeholder]="placeholder()" (keydown.enter)="submit($event)"
        [attr.aria-describedby]="inputId() + '-hint'" />
      <button type="button" [disabled]="control().disabled"
        (click)="submit()" aria-label="Procesar código de barras">Leer</button>
    </div>
    <small [id]="inputId() + '-hint'">Lector de teclado: termina la lectura con Enter.</small>
    @if (error()) { <span class="error" role="alert">{{ error() }}</span> }
  `,
  styles: [ `
    :host { display:grid; gap:.4rem; min-width:0; }
    label { font-size:.875rem; font-weight:600; }
    .barcode-row { display:flex; gap:.5rem; min-width:0; }
    input { flex:1 1 auto; min-width:0; min-height:var(--gc-control-height); padding:.6rem .75rem; color:var(--gc-on-surface);
      background:var(--gc-surface); border:1px solid var(--gc-outline); border-radius:calc(var(--gc-radius) * .65); }
    button { padding:.5rem .8rem; min-height:var(--gc-control-height); color:var(--gc-on-primary);
      background:var(--gc-primary); border:0; border-radius:calc(var(--gc-radius) * .65); cursor:pointer; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    small { color:var(--gc-on-surface-variant); }
    .error { color:var(--gc-error); font-size:.8rem; }
    @media(pointer:coarse) { input,button { min-height:44px; } }
  ` ],
})
export class GcBarcodeInput {
  readonly inputId = input.required<string>();
  readonly label = input('Código de barras');
  readonly control = input.required<FormControl<string>>();
  readonly placeholder = input('Escanear o escribir el código');
  readonly minLength = input(3);
  readonly maxLength = input(128);
  readonly duplicateWindowMs = input(600);
  readonly clearOnScan = input(true);
  readonly scan = output<GcBarcodeScan>();
  readonly error = signal<string | null>(null);
  private lastCode = '';
  private lastTime = 0;

  protected submit(event?: Event): void {
    event?.preventDefault();
    const ctrl = this.control();
    if (ctrl.disabled) return;
    const code = ctrl.value.trim();
    if (code.length < this.minLength() || code.length > this.maxLength()) {
      this.error.set('El código debe contener entre ' + this.minLength() + ' y ' + this.maxLength() + ' caracteres.');
      return;
    }
    const now = Date.now();
    if (this.lastCode === code && now - this.lastTime < this.duplicateWindowMs()) {
      this.error.set('Lectura duplicada ignorada.');
      return;
    }
    this.lastCode = code;
    this.lastTime = now;
    this.error.set(null);
    this.scan.emit({ code, source: 'keyboard' });
    if (this.clearOnScan()) ctrl.setValue('');
  }
}
