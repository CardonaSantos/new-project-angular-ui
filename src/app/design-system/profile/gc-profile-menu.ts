import { Component, inject } from '@angular/core';
import { GcAuthFacade } from '../../core/auth/demo-auth.facade';
import { GcBrandingService } from '../../core/branding/gc-branding.service';

@Component({
  selector: 'gc-profile-menu',
  template: `
    <details class="profile">
      <summary [attr.aria-label]="auth.identity()?.name ? 'Perfil de ' + auth.identity()?.name : 'Perfil sin sesión'">
        <span class="avatar" aria-hidden="true">{{ initials() }}</span>
        <span class="label">{{ auth.identity()?.name ?? 'Invitado' }}</span>
      </summary>
      <div class="panel">
        <strong>{{ auth.identity()?.name ?? 'Sin sesión activa' }}</strong>
        <small>{{ auth.identity()?.email ?? 'Modo local' }}</small>
        <p>{{ auth.identity()?.role ?? 'Sin rol' }} · {{ auth.branch()?.name ?? 'Sin sucursal' }}</p>
        @if (auth.authenticated()) {
          <button type="button" (click)="auth.logout()">Cerrar sesión demo</button>
        } @else {
          <span>Inicia una sesión de prueba en UX Lab.</span>
        }
      </div>
    </details>
  `,
  styles: [ `
    .profile { position:relative; }
    summary { display:flex; align-items:center; gap:.5rem; padding:.3rem .5rem; cursor:pointer; border-radius:.6rem; list-style:none; }
    summary::-webkit-details-marker { display:none; }
    summary:hover { background:var(--gc-surface-container); }
    .avatar { display:grid; place-items:center; width:2.2rem; height:2.2rem; flex:none; border-radius:100%; color:var(--gc-on-primary-container); background:var(--gc-primary-container); font-weight:700; }
    .label { max-width:10rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:.85rem; }
    .panel { position:absolute; z-index:40; right:0; top:calc(100% + .5rem); min-width:15rem; max-width:calc(100vw - 2rem); border:1px solid var(--gc-outline-variant); background:var(--gc-surface); color:var(--gc-on-surface); border-radius:var(--gc-radius); padding:1rem; box-shadow:0 10px 22px rgb(0 0 0 / 12%); display:grid; gap:.5rem; }
    small,p { font-size:.8rem; color:var(--gc-on-surface-variant); overflow-wrap:anywhere; margin:0; }
    button { color:var(--gc-error); background:transparent; text-align:left; border:0; cursor:pointer; padding:.5rem 0; font:inherit; }
    @media(max-width:460px) { .label { display:none; } }
  ` ],
})
export class GcProfileMenu {
  protected readonly auth = inject(GcAuthFacade);
  private readonly branding = inject(GcBrandingService);

  protected initials(): string {
    return (this.auth.identity()?.name || this.branding.name()).split(/\s+/).slice(0, 2)
      .map((value) => value.charAt(0).toUpperCase()).join('');
  }
}
