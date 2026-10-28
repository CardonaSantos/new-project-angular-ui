import { Component, input } from '@angular/core';

export interface GcReviewField { key: string; label: string }

@Component({
  selector: 'gc-form-review',
  template: `
    <dl>
      @for (field of fields(); track field.key) {
        <div class="review-row">
          <dt>{{ field.label }}</dt>
          <dd>{{ display(field.key) }}</dd>
        </div>
      }
    </dl>
  `,
  styles: [ `
    dl { display:grid; gap:.6rem; margin:0; }
    .review-row { display:grid; grid-template-columns:minmax(7rem,1fr) minmax(0,2fr); gap:.75rem; padding:.55rem .1rem; border-bottom:1px solid var(--gc-outline-variant); }
    dt { color:var(--gc-on-surface-variant); }
    dd { margin:0; font-weight:600; overflow-wrap:anywhere; }
    @media(max-width:520px) { .review-row { grid-template-columns:1fr; gap:.15rem; } }
  ` ],
})
export class GcFormReview {
  readonly fields = input.required<readonly GcReviewField[]>();
  readonly model = input.required<Record<string, unknown>>();

  protected display(key: string): string {
    const value = key.split('.').reduce<unknown>((obj, part) =>
      obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[part] : undefined, this.model());
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return String(value);
  }
}
