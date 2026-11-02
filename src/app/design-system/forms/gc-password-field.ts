import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

/** Accessible password entry shared by login and password changes. */
@Component({
  selector: 'gc-password-field',
  imports: [ReactiveFormsModule],
  template: `
    <div class="gc-password-field">
      <label [for]="inputId()">{{ label() }}</label>
      <div class="gc-password-row">
        <input [id]="inputId()" [formControl]="control()"
          [type]="revealed() ? 'text' : 'password'"
          [autocomplete]="autocomplete()"
          [attr.aria-invalid]="errorText() ? 'true' : null"
          [attr.aria-describedby]="errorText() ? inputId() + '-error' : null" />
        <button type="button" class="gc-password-toggle"
          [attr.aria-label]="revealed() ? 'Ocultar ' + label().toLowerCase() : 'Mostrar ' + label().toLowerCase()"
          [attr.aria-pressed]="revealed()"
          (click)="revealed.set(!revealed())">
          {{ revealed() ? 'Ocultar' : 'Mostrar' }}
        </button>
      </div>
      @if (errorText(); as message) {
        <small class="gc-password-error" [id]="inputId() + '-error'">{{ message }}</small>
      }
    </div>
  `,
  styles: [`
    :host { display:block; min-width:0; }
    .gc-password-field { display:grid; gap:.4rem; }
    label { font-weight:600; font-size:.875rem; }
    .gc-password-row { display:flex; align-items:center; border:1px solid var(--gc-outline);
      background:var(--gc-surface); border-radius:calc(var(--gc-radius) * .65); min-width:0; }
    .gc-password-row:focus-within { outline:3px solid var(--gc-primary); outline-offset:2px; }
    .gc-password-row:has(input[aria-invalid='true']) { border-color:var(--gc-error); }
    input { min-width:0; flex:1; width:100%; min-height:var(--gc-control-height);
      padding:.65rem .75rem; border:0; background:transparent; color:var(--gc-on-surface); }
    input:focus-visible { outline:none; }
    .gc-password-toggle { flex:none; min-width:3.5rem; min-height:44px; border:0;
      padding:.35rem .75rem; background:transparent; color:var(--gc-primary);
      cursor:pointer; font-weight:600; font-size:.8rem; }
    .gc-password-error { color:var(--gc-error); font-size:.875rem; }
  `],
})
export class GcPasswordField {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly autocomplete = input('current-password');
  readonly errorText = input<string | null>(null);
  readonly revealed = signal(false);
}
