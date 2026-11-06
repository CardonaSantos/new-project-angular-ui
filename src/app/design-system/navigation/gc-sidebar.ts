import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GcNavigationItem } from './navigation.model';
import { GcBrandLogo } from '../branding/gc-brand-logo';
import {
 LucideHouse,LucideShoppingBag,LucideBookOpen,LucideClipboardList,LucideWallet,
 LucideShoppingCart,LucidePackage,LucideChartColumn,LucideUsers,LucideSettings,LucideLandmark
} from '@lucide/angular';

@Component({
  selector: 'gc-sidebar',
  imports: [RouterLink, RouterLinkActive, GcBrandLogo,
   LucideHouse,LucideShoppingBag,LucideBookOpen,LucideClipboardList,LucideWallet,
   LucideShoppingCart,LucidePackage,LucideChartColumn,LucideUsers,LucideSettings,LucideLandmark],
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
            <span class="gc-initials" aria-hidden="true">
              @switch(item.icon){
               @case('home'){<svg lucideHouse class="gc-nav-icon"></svg>}
               @case('catalog'){<svg lucideShoppingBag class="gc-nav-icon"></svg>}
               @case('recipes'){<svg lucideBookOpen class="gc-nav-icon"></svg>}
               @case('orders'){<svg lucideClipboardList class="gc-nav-icon"></svg>}
               @case('payments'){<svg lucideWallet class="gc-nav-icon"></svg>}
               @case('purchases'){<svg lucideShoppingCart class="gc-nav-icon"></svg>}
               @case('inventory'){<svg lucidePackage class="gc-nav-icon"></svg>}
               @case('finance'){<svg lucideLandmark class="gc-nav-icon"></svg>}
               @case('reports'){<svg lucideChartColumn class="gc-nav-icon"></svg>}
               @case('users'){<svg lucideUsers class="gc-nav-icon"></svg>}
               @case('settings'){<svg lucideSettings class="gc-nav-icon"></svg>}
               @default {<span>{{ item.initials }}</span>}
              }
            </span>
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
