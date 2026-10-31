import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap, tap, throwError, finalize } from 'rxjs';
import { GcAuthApi } from './gc-auth.api';
import { GcLoginCredentials, GcLoginResponse, GcUser, GcChangePassword } from './gc-auth.models';
import { GcBranchContext } from '../organization/gc-branch-context';

export type GcSessionStatus = 'anonymous' | 'checking' | 'authenticated'
  | 'password-change-required' | 'expired';

/**
 * Access token intentionally lives only in memory.
 * Server owns the HttpOnly gastro_refresh cookie and all permissions.
 */
@Injectable({ providedIn: 'root' })
export class GcSessionService {
  private readonly api = inject(GcAuthApi);
  private readonly branch = inject(GcBranchContext);
  private token: string | null = null;
  private refreshFlight: Observable<string> | null = null;
  private restoreFlight: Observable<boolean> | null = null;

  readonly status = signal<GcSessionStatus>('anonymous');
  readonly user = signal<GcUser | null>(null);
  readonly authenticated = computed(() => this.status() === 'authenticated');
  readonly passwordChangeRequired = computed(() => this.status() === 'password-change-required');

  accessToken(): string | null { return this.token; }

  private apply(result: GcLoginResponse): void {
    this.token = result.accessToken;
    this.user.set(result.user);
    this.status.set(result.user.debeCambiarContrasena ? 'password-change-required' : 'authenticated');
  }

  private hydrate(): Observable<void> {
    return forkJoin({ me: this.api.me(), branches: this.branch.load() }).pipe(
      tap(({ me }) => this.user.set(me.user)),
      map(() => undefined),
    );
  }

  login(credentials: GcLoginCredentials): Observable<GcLoginResponse> {
    this.clear();
    this.status.set('checking');
    return this.api.login(credentials).pipe(
      tap(result => this.apply(result)),
      switchMap(result => result.user.debeCambiarContrasena
        ? of(result)
        : this.hydrate().pipe(map(() => result))),
      catchError(error => {
        this.clear();
        return throwError(() => error);
      }),
    );
  }

  /** Single-flight cookie rotation shared by simultaneous expired requests. */
  refreshAccessToken(): Observable<string> {
    if (this.refreshFlight) return this.refreshFlight;
    const flight = this.api.refresh().pipe(
      tap(result => this.apply(result)),
      map(result => result.accessToken),
      catchError(error => {
        this.expire();
        return throwError(() => error);
      }),
      finalize(() => { this.refreshFlight = null; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refreshFlight = flight;
    return flight;
  }

  /** Explicit bootstrap for guarded routes. Does not store access tokens. */
  restore(): Observable<boolean> {
    if (this.authenticated() || this.passwordChangeRequired()) return of(true);
    if (this.restoreFlight) return this.restoreFlight;
    this.status.set('checking');
    const flight = this.refreshAccessToken().pipe(
      switchMap(() => this.passwordChangeRequired() ? of(true) : this.hydrate().pipe(map(() => true))),
      catchError(() => {
        this.clear();
        return of(false);
      }),
      finalize(() => { this.restoreFlight = null; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.restoreFlight = flight;
    return flight;
  }

  changePassword(body: GcChangePassword): Observable<void> {
    return this.api.changePassword(body).pipe(
      tap(() => this.clear()),
      map(() => undefined),
    );
  }

  logout(all = false): Observable<void> {
    return this.api.logout(all).pipe(
      tap(() => this.clear()),
      map(() => undefined),
      catchError(error => {
        // Revocation failed: clear locally but never claim server logout succeeded.
        this.clear();
        return throwError(() => error);
      }),
    );
  }

  expire(): void {
    const hadSession = this.token !== null || this.user() !== null;
    this.clear();
    if (hadSession) this.status.set('expired');
  }

  clear(): void {
    this.token = null;
    this.user.set(null);
    this.branch.reset();
    this.status.set('anonymous');
  }
}
