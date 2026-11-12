import { inject, Injectable } from '@angular/core';
import { GcBranchContext } from '../../../core/organization/gc-branch-context';
import { OrganizationAccess } from '../../organization/data-access/organization-access';

/** All 6 reportería endpoints share a single backend permission check (reports.read) —
 * see each *-report.store.ts's private branch() method on the server. No per-report-type
 * permission exists, unlike the raw-sources tab in /reports (ReportsAccess.canSource). */
@Injectable({ providedIn: 'root' })
export class ReportingAccess {
  private readonly branch = inject(GcBranchContext);
  private readonly org = inject(OrganizationAccess);
  canRead(): boolean {
    return this.branch.has('reports.read') || this.org.canGlobal('reports.read');
  }
}
