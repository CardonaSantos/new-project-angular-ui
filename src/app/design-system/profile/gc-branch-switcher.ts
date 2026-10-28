import { Component, inject } from '@angular/core';
import { GcAuthFacade } from '../../core/auth/demo-auth.facade';

@Component({
  selector: 'gc-branch-switcher',
  template: `
    @if (auth.authenticated()) {
      <label class="switcher">
        <span>Sucursal</span>
        <select aria-label="Sucursal activa" [value]="auth.branchId() ?? ''"
          (change)="auth.switchBranch($any($event.target).value)">
          @for (branch of auth.identity()?.branches ?? []; track branch.id) {
            <option [value]="branch.id">{{ branch.name }}</option>
          }
        </select>
      </label>
    }
  `,
  styles: [ `
    .switcher { display:flex; align-items:center; gap:.45rem; font-size:.8rem; }
    select { min-height:2.5rem; max-width:12.5rem; color:var(--gc-on-surface); background:var(--gc-surface); border:1px solid var(--gc-outline-variant); border-radius:.5rem; padding:.2rem .4rem; }
    @media(max-width:650px) { .switcher span { display:none; } select { max-width:8.5rem; } }
  ` ],
})
export class GcBranchSwitcher {
  protected readonly auth = inject(GcAuthFacade);
}
