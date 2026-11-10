import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GcNotificationService } from '../../core/ux/gc-notification.service';

@Component({
  selector: 'gc-notification-center',
  imports: [RouterLink],
  template: `
    <div class="gc-notices" aria-label="Notificaciones">
      @for (notice of notifications.notices(); track notice.id) {
        <section class="gc-notice" [class.gc-notice-error]="notice.tone === 'error'"
          [class.gc-notice-success]="notice.tone === 'success'"
          [attr.role]="notice.tone === 'error' ? 'alert' : 'status'">
          <div class="gc-notice-body">
            <span>{{ notice.message }}</span>
            @if (notice.link) {
              <a [routerLink]="notice.link.path" (click)="notifications.dismiss(notice.id)">{{ notice.link.label }}</a>
            }
          </div>
          <button type="button" aria-label="Cerrar notificación" (click)="notifications.dismiss(notice.id)">×</button>
        </section>
      }
    </div>
  `,
  styles: [ `
    :host { position:fixed; z-index:1200; right:1rem; bottom:1rem; max-width:min(25rem,calc(100vw - 2rem)); width:100%; pointer-events:none; }
    .gc-notices { display:grid; gap:.65rem; }
    .gc-notice { display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; padding:.8rem 1rem; color:var(--gc-on-surface); background:var(--gc-surface-container); border:1px solid var(--gc-outline-variant); border-radius:var(--gc-radius); box-shadow:0 5px 16px rgb(0 0 0 / 10%); pointer-events:auto; animation:gc-notice-in 160ms ease-out; }
    .gc-notice-body { display:grid; gap:.35rem; }
    .gc-notice-body a { color:var(--gc-primary); font-weight:600; text-decoration:underline; width:fit-content; }
    .gc-notice-error { border-left:4px solid var(--gc-error); }
    .gc-notice-success { border-left:4px solid var(--gc-success); }
    button { border:0; background:transparent; color:inherit; font-size:1.25rem; cursor:pointer; min-width:2rem; min-height:2rem; }
    @keyframes gc-notice-in { from { opacity:0; transform:translate3d(0,6px,0); } to { opacity:1; transform:translate3d(0,0,0); } }
    @media(prefers-reduced-motion:reduce) { .gc-notice { animation:none; } }
  ` ],
})
export class GcNotificationCenter {
  protected readonly notifications = inject(GcNotificationService);
}
