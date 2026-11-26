import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const PRODUCT_NAME = 'Gastro Core';
const DEFAULT_ICON = 'favicon.ico';
// Last known business identity on this device, so the login screen and the
// browser tab show the business before anyone signs in. Only the public
// branding (name, logo URL) is kept: the same subset /organization/branding
// gives every logged-in role.
const STORED_NAME = 'gc.brand.name';
const STORED_LOGO = 'gc.brand.logo';

/**
 * The business's identity in the shell: trade name and logo, and with them the
 * browser tab (icon and title suffix).
 *
 * Colors deliberately do not live here. ThemeManagerService owns every color
 * token and writes them to :root; a second writer would mean whichever ran
 * last wins, and the theme manager re-applies all of its tokens whenever the
 * mode, density or radius changes — silently reverting a brand color set
 * from here. The brand color goes to `ThemeManagerService.setBrandColor`.
 */
@Injectable({ providedIn: 'root' })
export class GcBrandingService {
  private readonly document = inject(DOCUMENT);
  readonly name = signal(PRODUCT_NAME);
  readonly logoUrl = signal<string | null>(null);
  /** Name for the browser tab: the business's when known on this device. */
  readonly tabName = signal(PRODUCT_NAME);
  /** Logo last seen on this device: login and password screens show it signed out. */
  readonly deviceLogo = signal<string | null>(null);

  constructor() {
    const name = this.read(STORED_NAME);
    if (name) this.tabName.set(name);
    const logo = this.read(STORED_LOGO);
    if (logo && this.safeUrl(logo)) {
      this.deviceLogo.set(logo);
      this.applyIcon(logo);
    }
  }

  setName(name: string): void {
    const normalized = name.trim().slice(0, 60);
    if (!normalized) return;
    this.name.set(normalized);
    this.tabName.set(normalized);
    this.write(STORED_NAME, normalized);
  }

  setLogo(url: string): boolean {
    const value = url.trim();
    if (!this.safeUrl(value)) return false;
    this.logoUrl.set(value);
    this.deviceLogo.set(value);
    this.applyIcon(value);
    this.write(STORED_LOGO, value);
    return true;
  }

  clearLogo(): void {
    this.logoUrl.set(null);
    this.deviceLogo.set(null);
    this.applyIcon(DEFAULT_ICON);
    this.write(STORED_LOGO, null);
  }

  /**
   * On sign-out the shell forgets the business in memory. The tab keeps the
   * last known icon and name: it is the same business's device, and the login
   * screen should not turn back into the product's.
   */
  reset(): void {
    this.name.set(PRODUCT_NAME);
    this.logoUrl.set(null);
  }

  private safeUrl(value: string): boolean {
    // Only same-site assets or HTTPS resources are allowed.
    return !!value && (value.startsWith('/') || /^https:\/\/[^\s]+$/i.test(value)) &&
      !value.startsWith('//') && !/[\s<>]/.test(value);
  }

  private applyIcon(href: string): void {
    const head = this.document.head;
    if (!head) return;
    let link = head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'icon';
      head.appendChild(link);
    }
    // The type would otherwise still claim x-icon for a PNG or SVG logo.
    link.removeAttribute('type');
    link.href = href;
  }

  private read(key: string): string | null {
    try {
      return this.document.defaultView?.localStorage.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    try {
      const storage = this.document.defaultView?.localStorage;
      if (value === null) storage?.removeItem(key);
      else storage?.setItem(key, value);
    } catch {
      // Private mode or storage disabled: the tab just won't remember.
    }
  }
}
