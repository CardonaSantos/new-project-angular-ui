import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { gcSilentRequest } from '../../../core/http/api-context';
import type {
  ReportingFilters, ReportingFormat, ReportingSnapshotMap, ReportingType,
} from './reporting.models';
import { buildReportingQuery } from './reporting.helpers';

const REPORTING_PATHS: Record<ReportingType, string> = {
  DAILY: '/api/reports/daily',
  SALES: '/api/reports/sales',
  CUSTOMERS: '/api/reports/customers',
  INVENTORY: '/api/reports/inventory',
  CASH_SESSIONS: '/api/reports/cash-sessions',
  PROFITABILITY: '/api/reports/profitability',
};

function params(query: Record<string, string | number | boolean | undefined>) {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') p = p.set(key, String(value));
  }
  return { params: p, context: gcSilentRequest() };
}

@Injectable({ providedIn: 'root' })
export class ReportingApi {
  private readonly http = inject(HttpClient);

  snapshot<T extends ReportingType>(type: T, filters: ReportingFilters) {
    return this.http.get<ReportingSnapshotMap[T]>(
      REPORTING_PATHS[type], params(buildReportingQuery(type, filters)),
    );
  }

  download(type: ReportingType, filters: ReportingFilters, format: ReportingFormat) {
    return this.http.get(REPORTING_PATHS[type] + '/export', {
      ...params({ ...buildReportingQuery(type, filters), format }),
      observe: 'response' as const, responseType: 'blob' as const,
    });
  }
}
