import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GcButtonDirective } from '../../design-system/components/button/gc-button.directive';
import { GcPageHeader } from '../../design-system/components/page-header/gc-page-header';

@Component({
  selector: 'gc-secure-demo',
  imports: [RouterLink, GcButtonDirective, GcPageHeader],
  template: `
    <div class="gc-stack gc-page-enter">
      <gc-page-header eyebrow="PATRONES / PERMISOS" title="Área protegida (demo)"
        description="Esta ruta solo se abre con una sesión local que tenga settings.manage." />
      <section class="gc-surface">
        <p>Guard verificado. Esto solo demuestra visibilidad y navegación, no seguridad de backend.</p>
        <a gcButton routerLink="/lab/behaviors">Volver al laboratorio</a>
      </section>
    </div>
  `,
})
export class GcSecureDemo {}
