import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Select which calls are branch-scoped. A branch header never grants access. */
export const GC_BRANCH_REQUEST = new HttpContextToken<boolean>(() => false);
/** Suppress only the global toast: the returned error still reaches the caller. */
export const GC_SILENT_ERROR = new HttpContextToken<boolean>(() => false);
/** Prevent refresh recursion for public endpoints and refresh itself. */
export const GC_SKIP_REFRESH = new HttpContextToken<boolean>(() => false);
/** Marks a /api/self-service/* call: it carries its own session bearer (set by
 * the caller itself, never the staff access token) and must skip the staff
 * auth/branch header injection and the staff 401-refresh retry entirely —
 * a self-service 401 means the table session expired, not that the staff
 * token needs refreshing. */
export const GC_SELF_SERVICE = new HttpContextToken<boolean>(() => false);

export const gcBranchRequest = (): HttpContext =>
  new HttpContext().set(GC_BRANCH_REQUEST, true);

export const gcSilentRequest = (): HttpContext =>
  new HttpContext().set(GC_SILENT_ERROR, true);

/** Self-service pages render their own error state; also silences the global toast. */
export const gcSelfServiceRequest = (): HttpContext =>
  new HttpContext().set(GC_SELF_SERVICE, true).set(GC_SILENT_ERROR, true);
