import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { TableQrIssued, TableQrSummary } from './self-service-admin.models';

const BASE = '/api/self-service/tables';

/** Staff-facing provisioning calls (SelfServiceTablesController on the backend):
 * normal staff auth, normal interceptors — unlike self-service.api.ts, which is
 * the customer-facing side and must never carry the staff bearer. */
@Injectable({ providedIn: 'root' })
export class SelfServiceAdminApi {
  private readonly http = inject(HttpClient);

  issue(mesaId: string) {
    return this.http.post<TableQrIssued>(`${BASE}/${encodeURIComponent(mesaId)}/qr`, {});
  }

  list(mesaId: string) {
    return this.http.get<TableQrSummary[]>(`${BASE}/${encodeURIComponent(mesaId)}/qr`);
  }

  revoke(id: string) {
    return this.http.post<void>(`${BASE}/qr/${encodeURIComponent(id)}/revoke`, {});
  }
}
