import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GcSidebar } from '../design-system/navigation/gc-sidebar';
import { GcTopbar } from '../design-system/navigation/gc-topbar';
import { GcNavigationItem } from '../design-system/navigation/navigation.model';

@Component({
  selector: 'gc-app-shell',
  imports: [RouterOutlet, GcSidebar, GcTopbar],
  templateUrl: './gc-app-shell.html',
  styleUrl: './gc-app-shell.scss',
})
export class GcAppShell {
  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly items: readonly GcNavigationItem[] = [
    { label: 'Design System', path: '/', initials: 'DS', exact: true },
    { label: 'Tablas y filtros', path: '/patterns/tables', initials: 'TB', exact: true },
  ];

  protected closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
