import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GcNavigationItem } from './navigation.model';
import { GcBrandLogo } from '../branding/gc-brand-logo';

@Component({
  selector: 'gc-sidebar',
  imports: [RouterLink, RouterLinkActive, GcBrandLogo],
  template: `
    <aside class="gc-sidebar" aria-label="Navegación principal">
      <gc-brand-logo [name]="brandName()" [logoUrl]="logoUrl()"
        [showName]="!collapsed() || mobileOpen()" />
      <nav aria-label="Módulos">
        @for (item of items(); track item.path) {
          <a [routerLink]="item.path" routerLinkActive="gc-active"
            [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
            (click)="navigate.emit()"
            [attr.aria-label]="item.label"
            [title]="collapsed() && !mobileOpen() ? item.label : ''">
            <span class="gc-initials" aria-hidden="true">{{ item.initials }}</span>
            @if (!collapsed() || mobileOpen()) {
              <span class="gc-nav-label">{{ item.label }}</span>
            }
          </a>
        }
      </nav>
    </aside>
  `,
  styleUrl: './gc-sidebar.scss',
})
export class GcSidebar {
  readonly items = input.required<readonly GcNavigationItem[]>();
  readonly collapsed = input(false);
  readonly mobileOpen = input(false);
  readonly brandName = input('Gastro Core');
  readonly logoUrl = input<string | null>(null);
  readonly navigate = output<void>();
}
