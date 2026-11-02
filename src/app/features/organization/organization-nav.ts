import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GcBranchContext } from '../../core/organization/gc-branch-context';
import { OrganizationAccess } from './data-access/organization-access';

@Component({
  selector: 'gc-organization-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="gc-org-tabs" aria-label="Configuración">
      @if (access.canGlobal('organization.read')) {
        <a routerLink="/organization/company" routerLinkActive="active" ariaCurrentWhenActive="page">
          Empresa
        </a>
      }
      @if (branch.has('branches.read')) {
        <a routerLink="/organization/branches" routerLinkActive="active"
          ariaCurrentWhenActive="page" [routerLinkActiveOptions]="{ exact:false }">
          Sucursales
        </a>
      }
      @if (branch.has('devices.read')) {
        <a routerLink="/organization/devices" routerLinkActive="active"
          ariaCurrentWhenActive="page">
          Dispositivos
        </a>
      }
    </nav>
  `,
  styleUrl: './organization.scss',
})
export class GcOrganizationNav {
  protected readonly branch = inject(GcBranchContext);
  protected readonly access = inject(OrganizationAccess);
}
