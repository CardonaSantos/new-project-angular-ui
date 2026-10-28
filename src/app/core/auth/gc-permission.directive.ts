import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { GcAuthFacade, GcPermission } from './demo-auth.facade';

/** Structural UI visibility; server authorization remains mandatory. */
@Directive({ selector: '[gcCan]' })
export class GcCanDirective {
  private readonly auth = inject(GcAuthFacade);
  private readonly view = inject(ViewContainerRef);
  private readonly template = inject(TemplateRef<unknown>);
  readonly gcCan = input.required<GcPermission>();
  private rendered = false;

  constructor() {
    effect(() => {
      const allowed = this.auth.has(this.gcCan());
      if (allowed && !this.rendered) {
        this.view.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.view.clear();
        this.rendered = false;
      }
    });
  }
}
