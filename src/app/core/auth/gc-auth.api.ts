import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { map } from 'rxjs';
import { z } from 'zod';
import { API_ENDPOINTS } from '../http/api-endpoints';
import { GC_SILENT_ERROR, GC_SKIP_REFRESH } from '../http/api-context';
import {
  gcLoginResponseSchema, gcMeSchema, GcChangePassword, GcLoginCredentials,
} from './gc-auth.models';

const publicContext = (): HttpContext => new HttpContext()
  .set(GC_SKIP_REFRESH, true).set(GC_SILENT_ERROR, true);

@Injectable({ providedIn: 'root' })
export class GcAuthApi {
  private readonly http = inject(HttpClient);

  login(credentials: GcLoginCredentials) {
    return this.http.post<unknown>(API_ENDPOINTS.auth.login, credentials, {
      withCredentials: true, context: publicContext(),
    }).pipe(map(value => gcLoginResponseSchema.parse(value)));
  }

  refresh() {
    return this.http.post<unknown>(API_ENDPOINTS.auth.refresh, {}, {
      withCredentials: true, context: publicContext(),
    }).pipe(map(value => gcLoginResponseSchema.parse(value)));
  }

  me() {
    return this.http.get<unknown>(API_ENDPOINTS.auth.me)
      .pipe(map(value => gcMeSchema.parse(value)));
  }

  changePassword(body: GcChangePassword) {
    return this.http.patch<unknown>(API_ENDPOINTS.auth.password, body, {
      withCredentials: true, context: new HttpContext().set(GC_SILENT_ERROR, true),
    }).pipe(map(value => z.object({ ok: z.literal(true), reloginRequired: z.literal(true) }).parse(value)));
  }

  logout(all = false) {
    return this.http.post<unknown>(all ? API_ENDPOINTS.auth.logoutAll : API_ENDPOINTS.auth.logout, {}, {
      withCredentials: true, context: new HttpContext().set(GC_SILENT_ERROR, true),
    }).pipe(map(value => z.object({ ok: z.literal(true) }).parse(value)));
  }
}
