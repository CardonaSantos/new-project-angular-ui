import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GcNotificationCenter } from './design-system/feedback/gc-notification-center';

@Component({
  selector: 'gc-root',
  imports: [RouterOutlet, GcNotificationCenter],
  template: '<router-outlet /><gc-notification-center />',
})
export class App {}
