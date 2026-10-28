import { Component, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GcPageHeader } from '../../design-system/components/page-header/gc-page-header';
import { GcButtonDirective } from '../../design-system/components/button/gc-button.directive';
import { GcCard } from '../../design-system/layout/gc-card';
import { GcPageContainer } from '../../design-system/layout/gc-page-container';
import { GcFormGrid } from '../../design-system/layout/gc-form-grid';
import { GcTextInput } from '../../design-system/inputs/gc-text-input';
import { GcTextarea } from '../../design-system/inputs/gc-textarea';
import { GcSelect, GcSelectOption } from '../../design-system/inputs/gc-select';
import { GcMultiSelect } from '../../design-system/inputs/gc-multi-select';
import { GcBarcodeInput } from '../../design-system/inputs/gc-barcode-input';
import { GcDecimalInput } from '../../design-system/inputs/gc-decimal-input';
import { GcMediaManager, GcMediaSelection } from '../../design-system/media/gc-media-manager';

@Component({
  selector: 'gc-component-lab',
  imports: [
    RouterLink, GcPageHeader, GcButtonDirective, GcCard, GcPageContainer, GcFormGrid,
    GcTextInput, GcTextarea, GcSelect, GcMultiSelect, GcBarcodeInput,
    GcDecimalInput, GcMediaManager,
  ],
  templateUrl: './component-lab.html',
  styleUrl: './component-lab.scss',
})
export class GcComponentLab {
  protected readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly notes = new FormControl('', { nonNullable: true });
  protected readonly category = new FormControl('coffee', { nonNullable: true });
  protected readonly tags = new FormControl<string[]>([], { nonNullable: true });
  protected readonly barcode = new FormControl('', { nonNullable: true });
  protected readonly cost = new FormControl('12.50', { nonNullable: true });
  protected readonly quantity = new FormControl('1.000', { nonNullable: true });
  protected readonly lastScan = signal('Ninguna lectura');
  protected readonly mediaCount = signal(0);
  protected readonly mainMedia = signal('Sin imagen principal');
  protected readonly categories: readonly GcSelectOption[] = [
    { label: 'Café', value: 'coffee' },
    { label: 'Alimento', value: 'food' },
    { label: 'Insumo', value: 'supply' },
  ];
  protected readonly tagOptions: readonly GcSelectOption[] = [
    { label: 'Caliente', value: 'hot' },
    { label: 'Frío', value: 'cold' },
    { label: 'Sin azúcar', value: 'no-sugar' },
    { label: 'Popular', value: 'popular' },
    { label: 'Temporada', value: 'seasonal' },
  ];

  protected readCode(code: string): void {
    this.lastScan.set(code);
  }

  protected receiveMedia(event: GcMediaSelection): void {
    this.mediaCount.set(event.files.length);
    this.mainMedia.set(event.primaryIndex >= 0 ? event.files[event.primaryIndex]?.name ?? '—' : '—');
  }
}
