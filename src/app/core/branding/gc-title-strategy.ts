import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { GcBrandingService } from './gc-branding.service';

/** Route titles end in «— Gastro Core» or «— Gastro Core UI»; that suffix is the product's. */
const PRODUCT_SUFFIX = /\s*[—–-]\s*Gastro Core(?: UI)?\s*$/;

/**
 * Shows the business's name in the browser tab instead of the product's:
 * «Punto de venta — Coffee Shop Río Azul». Routes keep their titles as they
 * are; only the suffix is swapped, and it follows the name when it loads.
 */
@Injectable({ providedIn: 'root' })
export class GcTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly branding = inject(GcBrandingService);
  private page: string | null = null;

  constructor() {
    super();
    effect(() => this.apply(this.branding.tabName()));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const built = this.buildTitle(snapshot);
    this.page = built ? built.replace(PRODUCT_SUFFIX, '').trim() || null : null;
    this.apply(this.branding.tabName());
  }

  private apply(name: string): void {
    this.title.setTitle(this.page ? `${this.page} — ${name}` : name);
  }
}
