import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GcNavigationItem } from './navigation.model';

@Component({
  selector: 'gc-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="gc-sidebar" aria-label="Navegación principal">
      <div class="gc-brand">
        <span class="gc-mark" aria-hidden="true">GC</span>
        @if (!collapsed() || mobileOpen()) { <strong>Gastro Core</strong> }
      </div>
      <nav aria-label="Módulos">
        @for (item of items(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="gc-active"
            [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
            (click)="navigate.emit()"
            [attr.aria-label]="item.label"
            [title]="collapsed() ? item.label : ''">
            <span class="gc-initials" aria-hidden="true">{{ item.initials }}</span>
            @if (!collapsed() || mobileOpen()) { <span class="gc-nav-label">{{ item.label }}</span> }
          </a>
        }
      </nav>
      @if (!collapsed() || mobileOpen()) {
        <p class="gc-sidebar-note">Design System · Demostración local</p>
      }
    </aside>
  `,
  styleUrl: './gc-sidebar.scss',
})
export class GcSidebar {
  readonly items = input.required<readonly GcNavigationItem[]>();
  readonly collapsed = input(false);
  readonly mobileOpen = input(false);
  readonly navigate = output<void>();
}
