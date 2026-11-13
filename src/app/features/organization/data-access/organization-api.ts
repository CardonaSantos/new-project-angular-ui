import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_ENDPOINTS } from '../../../core/http/api-endpoints';
import { gcSilentRequest } from '../../../core/http/api-context';
import type {
  Branch, BranchConfig, BranchCreate, BranchOption, BranchOverview, BranchUpdate,
  Branding, Company, CompanyCapabilities, CompanyUpdate, ConfigUpdate, Device, DeviceCreate,
  DeviceOption, DeviceQuery, DeviceUpdate, ListQuery, Options, Paged, DeviceType,
} from './organization.models';

/** Always generate query strings from typed values; do not encode them manually. */
function params(query: Record<string, string | number | boolean | undefined | null>): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      result = result.set(key, String(value));
    }
  }
  return result;
}
export function listParams(query: ListQuery): HttpParams { return params({ ...query }); }
const root = API_ENDPOINTS.organization;

@Injectable({ providedIn: 'root' })
export class CompanyApi {
  private readonly http = inject(HttpClient);
  get() { return this.http.get<Company>(root.company); }
  branding() { return this.http.get<Branding>(root.branding); }
  capabilities() { return this.http.get<CompanyCapabilities>(root.capabilities); }
  update(data: CompanyUpdate) {
    return this.http.patch<Company>(root.company, data, { context: gcSilentRequest() });
  }
}
@Injectable({ providedIn: 'root' })
export class BranchesApi {
  private readonly http = inject(HttpClient);
  list(query: ListQuery = {}) {
    return this.http.get<Paged<Branch>>(root.branches, { params: listParams(query) });
  }
  options(query: { search?: string; cursor?: string; limit?: number } = {}) {
    return this.http.get<Options<BranchOption>>(root.branchOptions, { params: params(query) });
  }
  get(id: string) { return this.http.get<Branch>(root.branch(id)); }
  create(data: BranchCreate) {
    return this.http.post<Branch>(root.branches, data, { context: gcSilentRequest() });
  }
  update(id: string, data: BranchUpdate) {
    return this.http.patch<Branch>(root.branch(id), data, { context: gcSilentRequest() });
  }
  status(id: string, activa: boolean, motivo: string) {
    return this.http.patch<Branch>(root.branchStatus(id), { activa, motivo }, {
      context: gcSilentRequest(),
    });
  }
  config(id: string) { return this.http.get<BranchConfig>(root.branchConfig(id)); }
  updateConfig(id: string, changes: ConfigUpdate) {
    return this.http.patch<BranchConfig>(root.branchConfig(id), changes, {
      context: gcSilentRequest(),
    });
  }
  overview(id: string) { return this.http.get<BranchOverview>(root.branchOverview(id)); }
}
@Injectable({ providedIn: 'root' })
export class DevicesApi {
  private readonly http = inject(HttpClient);
  list(query: DeviceQuery = {}) {
    return this.http.get<Paged<Device>>(root.devices, { params: params({ ...query }) });
  }
  options(query: { search?: string; cursor?: string; limit?: number;
    sucursalId?: string; tipo?: DeviceType } = {}) {
    return this.http.get<Options<DeviceOption>>(root.deviceOptions, { params: params(query) });
  }
  get(id: string) { return this.http.get<Device>(root.device(id)); }
  create(data: DeviceCreate) {
    return this.http.post<Device>(root.devices, data, { context: gcSilentRequest() });
  }
  update(id: string, data: DeviceUpdate) {
    return this.http.patch<Device>(root.device(id), data, { context: gcSilentRequest() });
  }
  status(id: string, activa: boolean, motivo: string) {
    return this.http.patch<Device>(root.deviceStatus(id), { activa, motivo }, {
      context: gcSilentRequest(),
    });
  }
}
