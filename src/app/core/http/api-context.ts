import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Select which calls are branch-scoped. A branch header never grants access. */
export const GC_BRANCH_REQUEST = new HttpContextToken<boolean>(() => false);
/** Suppress only the global toast: the returned error still reaches the caller. */
export const GC_SILENT_ERROR = new HttpContextToken<boolean>(() => false);
/** Prevent refresh recursion for public endpoints and refresh itself. */
export const GC_SKIP_REFRESH = new HttpContextToken<boolean>(() => false);

export const gcBranchRequest = (): HttpContext =>
  new HttpContext().set(GC_BRANCH_REQUEST, true);

export const gcSilentRequest = (): HttpContext =>
  new HttpContext().set(GC_SILENT_ERROR, true);
