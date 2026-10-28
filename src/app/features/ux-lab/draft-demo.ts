import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GcButtonDirective } from '../../design-system/components/button/gc-button.directive';
import { GcPageHeader } from '../../design-system/components/page-header/gc-page-header';
import { GcDirtyAware } from '../../core/ux/gc-unsaved-changes.guard';
import { GcNotificationService } from '../../core/ux/gc-notification.service';

@Component({
  selector: 'gc-draft-demo',
  imports: [ReactiveFormsModule, RouterLink, GcButtonDirective, GcPageHeader],
  template: `
    <div class="gc-page-enter gc-stack">
      <gc-page-header eyebrow="PATRONES / FORMULARIOS" title="Cambios sin guardar"
        description="Modifica el campo y prueba navegar a otra página. El guard solicita confirmación." />
      <section class="gc-surface">
        <form [formGroup]="form" (ngSubmit)="save()" class="gc-stack">
          <label for="demo-name">Nombre del artículo (demo)</label>
          <input id="demo-name" formControlName="name" />
          <p>Modificaciones: {{ hasUnsavedChanges() ? 'pendientes' : 'sin cambios' }}</p>
          <div class="actions">
            <button gcButton type="submit" [disabled]="form.invalid">Simular guardado</button>
            <a gcButton variant="outline" routerLink="/lab/behaviors">Volver a UX Lab</a>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: [ `
    :host { display:block; }
    input { display:block; min-height:2.75rem; width:min(100%,32rem); padding:.6rem .8rem; border:1px solid var(--gc-outline); background:var(--gc-surface); color:var(--gc-on-surface); border-radius:.6rem; }
    .actions { display:flex; flex-wrap:wrap; gap:.7rem; }
  ` ],
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class GcDraftDemo implements GcDirtyAware {
  private readonly notices = inject(GcNotificationService);
  protected readonly form = new FormGroup({
    name: new FormControl('Cappuccino clásico', { nonNullable: true, validators: [Validators.required] }),
  });

  hasUnsavedChanges(): boolean { return this.form.dirty; }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.form.markAsPristine();
    this.notices.show('Guardado simulado. No se envió información al servidor.', 'success');
  }
}
