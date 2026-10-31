import { Component, inject } from '@angular/core';
import { ThemeManagerService } from './design-system/themes/theme-manager.service';
import { RouterOutlet } from '@angular/router';
import { GcNotificationCenter } from './design-system/feedback/gc-notification-center';

@Component({
  selector: 'gc-root',
  imports: [RouterOutlet, GcNotificationCenter],
  template: '<router-outlet /><gc-notification-center />',
})
export class App {
  private readonly theme = inject(ThemeManagerService);
  constructor() { void this.theme; }
}
