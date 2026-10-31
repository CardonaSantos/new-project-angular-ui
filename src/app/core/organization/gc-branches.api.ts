import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { API_ENDPOINTS } from '../http/api-endpoints';

@Injectable({ providedIn: 'root' })
export class GcBranchesApi {
  private readonly http = inject(HttpClient);

  myAccess() {
    return this.http.get<unknown>(API_ENDPOINTS.organization.myAccess).pipe(switchMap(value => from(
      import('../auth/gc-auth.models').then(model => model.gcBranchAccessSchema.parse(value).data),
    )));
  }

  capabilities(sucursalId: string | null) {
    return this.http.get<unknown>(API_ENDPOINTS.auth.capabilities, {
      params: sucursalId ? { sucursalId } : {},
    }).pipe(switchMap(value => from(
      import('../auth/gc-auth.models').then(model => model.gcCapabilitiesSchema.parse(value)),
    )));
  }
}
