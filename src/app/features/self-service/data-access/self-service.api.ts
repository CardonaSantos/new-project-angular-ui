import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { gcSelfServiceRequest } from '../../../core/http/api-context';
import type {
  SelfServiceAccess, SelfServiceCart, SelfServiceMenuResponse,
} from './self-service.models';

const BASE = '/api/self-service';

export interface SelfServiceLineInput {
  varianteId: string;
  cantidad: string;
  modificadores?: Array<{ modificadorId: string }>;
  notasCocina?: string;
}

/** Every call after access() must carry the session bearer explicitly: these
 * requests use gcSelfServiceRequest() so the shared interceptors never touch
 * them with the staff access token (see core/http/gc-api.interceptors.ts). */
@Injectable({ providedIn: 'root' })
export class SelfServiceApi {
  private readonly http = inject(HttpClient);

  access(qrToken: string) {
    return this.http.post<SelfServiceAccess>(
      `${BASE}/access`, { token: qrToken }, { context: gcSelfServiceRequest() },
    );
  }

  private authed(sessionToken: string) {
    return { context: gcSelfServiceRequest(), headers: new HttpHeaders({ Authorization: `Bearer ${sessionToken}` }) };
  }

  menu(sessionToken: string) {
    return this.http.get<SelfServiceMenuResponse>(`${BASE}/menu`, this.authed(sessionToken));
  }

  cart(sessionToken: string) {
    return this.http.get<SelfServiceCart>(`${BASE}/order`, this.authed(sessionToken));
  }

  addItems(sessionToken: string, lineas: SelfServiceLineInput[]) {
    return this.http.post<SelfServiceCart>(`${BASE}/order/items`, { lineas }, this.authed(sessionToken));
  }

  send(sessionToken: string) {
    return this.http.post<SelfServiceCart>(`${BASE}/order/send`, {}, this.authed(sessionToken));
  }

  closeSession(sessionToken: string) {
    return this.http.post<void>(`${BASE}/session/close`, {}, this.authed(sessionToken));
  }
}
