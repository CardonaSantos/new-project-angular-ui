/** Navigation is declared by shell/feature, not hardcoded in the sidebar component. */
export interface GcNavigationItem {
  label: string;
  path: string;
  initials: string;
  icon?:'home'|'catalog'|'recipes'|'orders'|'payments'|'purchases'|'inventory'|'reports'|'users'|'settings';
  exact?: boolean;
}
