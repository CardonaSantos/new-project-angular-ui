import { Directive, Input } from '@angular/core';

export type GcButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
export type GcButtonSize = 'sm' | 'md' | 'lg';

@Directive({
  selector: 'button[gcButton], a[gcButton]',
  host: {
    class: 'gc-button',
    '[class.gc-button--secondary]': "variant === 'secondary'",
    '[class.gc-button--outline]': "variant === 'outline'",
    '[class.gc-button--danger]': "variant === 'danger'",
    '[class.gc-button--sm]': "size === 'sm'",
    '[class.gc-button--lg]': "size === 'lg'",
    '[class.gc-button--block]': 'block',
  },
})
export class GcButtonDirective {
  @Input() variant: GcButtonVariant = 'primary';
  @Input() size: GcButtonSize = 'md';
  @Input() block = false;
}
