import { Component, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GcBranchContext } from '../../core/organization/gc-branch-context';
import { gcErrorMessage } from '../../core/http/api-error';
import { GcNotificationService } from '../../core/ux/gc-notification.service';

@Component({
  selector: 'gc-active-branch-switcher',
  template: `
    @if (branch.branches().length === 1) {
      <span class="gc-branch-name" [title]="branch.active()?.nombre ?? ''">
        {{ branch.active()?.nombre }}
      </span>
    } @else if (branch.branches().length > 1) {
      <label class="gc-branch-selector">
        <span class="gc-visually-hidden">Sucursal activa</span>
        <select aria-label="Sucursal activa"
          [value]="branch.branchId() ?? ''"
          [disabled]="branch.loading()"
          (change)="changeBranch($event)">
          @for (item of branch.branches(); track item.id) {
            <option [value]="item.id">{{ item.nombre }}</option>
          }
        </select>
      </label>
    }
  `,
  styles: [`
    :host { display:inline-flex; min-width:0; max-width:100%; align-items:center; }
    .gc-branch-selector { min-width:0; }
    select { min-width:7rem; max-width:min(13.5rem,40vw); min-height:2.75rem;
      padding:.35rem .55rem; border:1px solid var(--gc-outline-variant);
      border-radius:calc(var(--gc-radius) * .65);
      background:var(--gc-surface); color:var(--gc-on-surface); font-size:.875rem; }
    .gc-branch-name { font-size:.875rem; color:var(--gc-on-surface-variant);
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:12rem; }
    .gc-visually-hidden { position:absolute; width:1px; height:1px; margin:-1px;
      padding:0; overflow:hidden; clip:rect(0,0,0,0); border:0; white-space:nowrap; }
    @media(max-width:480px) { select { max-width:9rem; } .gc-branch-name { max-width:8rem; } }
  `],
})
export class GcActiveBranchSwitcher {
  protected readonly branch = inject(GcBranchContext);
  private readonly notifications = inject(GcNotificationService);

  protected async changeBranch(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const previous = this.branch.branchId() ?? '';
    if (select.value === previous) return;
    try {
      await firstValueFrom(this.branch.select(select.value));
    } catch (error: unknown) {
      this.notifications.show(gcErrorMessage(error), 'error');
      select.value = this.branch.branchId() ?? previous;
    }
  }
}
