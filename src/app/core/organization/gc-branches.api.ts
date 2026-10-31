import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { API_ENDPOINTS } from '../http/api-endpoints';
import { gcBranchAccessSchema, gcCapabilitiesSchema } from '../auth/gc-auth.models';

@Injectable({ providedIn: 'root' })
export class GcBranchesApi {
  private readonly http = inject(HttpClient);

  myAccess() {
    return this.http.get<unknown>(API_ENDPOINTS.organization.myAccess)
      .pipe(map(value => gcBranchAccessSchema.parse(value).data));
  }

  capabilities(sucursalId: string | null) {
    return this.http.get<unknown>(API_ENDPOINTS.auth.capabilities, {
      params: sucursalId ? { sucursalId } : {},
    }).pipe(map(value => gcCapabilitiesSchema.parse(value)));
  }
}
