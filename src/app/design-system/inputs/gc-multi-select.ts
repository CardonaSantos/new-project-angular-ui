import { Component, computed, effect, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { GcSelectOption } from './gc-select';

/** Searchable keyboard-accessible multi-select. Selected values live in its FormControl. */
@Component({
  selector: 'gc-multi-select',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatInputModule],
  template: `
    <label [for]="inputId()">{{ label() }}</label>
    @if (selected().length) {
      <div class="gc-chips" aria-label="Valores seleccionados">
        @for (value of selected(); track value) {
          <span class="gc-chip">
            {{ optionLabel(value) }}
            <button type="button" [disabled]="control().disabled"
              [attr.aria-label]="'Quitar ' + optionLabel(value)"
              (click)="remove(value)">×</button>
          </span>
        }
      </div>
    }
    <input matInput [id]="inputId()" type="search" [formControl]="search"
      [placeholder]="placeholder()" [matAutocomplete]="choices"
      [disabled]="control().disabled" autocomplete="off" />
    <mat-autocomplete #choices="matAutocomplete" (optionSelected)="add($event.option.value)">
      @for (option of filtered(); track option.value) {
        <mat-option [value]="option.value">{{ option.label }}</mat-option>
      }
    </mat-autocomplete>
    @if (hint()) { <small>{{ hint() }}</small> }
  `,
  styles: [ `
    :host { display:grid; min-width:0; gap:.4rem; }
    label { font-weight:600; font-size:.875rem; }
    input { min-width:0; width:100%; min-height:var(--gc-control-height); padding:.6rem .75rem;
      border:1px solid var(--gc-outline); border-radius:calc(var(--gc-radius) * .65);
      color:var(--gc-on-surface); background:var(--gc-surface); }
    .gc-chips { display:flex; gap:.4rem; flex-wrap:wrap; }
    .gc-chip { display:inline-flex; align-items:center; gap:.25rem; border:1px solid var(--gc-outline-variant);
      background:var(--gc-primary-container); color:var(--gc-on-primary-container); padding:.2rem .4rem .2rem .7rem; border-radius:100px; }
    .gc-chip button { min-width:2rem; min-height:2rem; background:transparent; color:inherit; border:0; cursor:pointer; font-size:1.1rem; }
    small { color:var(--gc-on-surface-variant); }
    @media(pointer:coarse) { input,.gc-chip button { min-height:44px; } }
  ` ],
})
export class GcMultiSelect {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly GcSelectOption[]>();
  readonly control = input.required<FormControl<string[]>>();
  readonly placeholder = input('Buscar opciones');
  readonly hint = input('');

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly selected = signal<readonly string[]>([]);
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  protected readonly filtered = computed(() => {
    const query = this.query().toLocaleLowerCase('es').trim();
    const selected = this.selected();
    return this.options().filter((option) =>
      !option.disabled && !selected.includes(option.value) &&
      (!query || option.label.toLocaleLowerCase('es').includes(query)));
  });

  constructor() {
    effect((onCleanup) => {
      const ctrl = this.control();
      this.selected.set(ctrl.value);
      const subscription = ctrl.valueChanges.subscribe((values) => this.selected.set(values));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected optionLabel(value: string): string {
    return this.options().find((option) => option.value === value)?.label ?? value;
  }

  protected add(value: string): void {
    const ctrl = this.control();
    if (ctrl.disabled || !this.options().some((option) => option.value === value && !option.disabled)) return;
    if (!ctrl.value.includes(value)) {
      ctrl.setValue([...ctrl.value, value]);
      ctrl.markAsDirty();
      ctrl.markAsTouched();
    }
    this.search.setValue('');
  }

  protected remove(value: string): void {
    const ctrl = this.control();
    if (ctrl.disabled) return;
    ctrl.setValue(ctrl.value.filter((option) => option !== value));
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }
}
