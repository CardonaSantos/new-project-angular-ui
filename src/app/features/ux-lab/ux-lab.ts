import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { GcButtonDirective } from '../../design-system/components/button/gc-button.directive';
import { GcPageHeader } from '../../design-system/components/page-header/gc-page-header';
import { GcStatusBadge } from '../../design-system/components/status-badge/gc-status-badge';
import { GcErrorState } from '../../design-system/feedback/gc-error-state';
import { GcSkeleton } from '../../design-system/feedback/gc-skeleton';
import { GcCanDirective } from '../../core/auth/gc-permission.directive';
import { GcAuthFacade, DemoRole } from '../../core/auth/demo-auth.facade';
import { GcBrandingService } from '../../core/branding/gc-branding.service';
import { GcAsyncAction } from '../../core/ux/gc-async-action';
import { GcPageState } from '../../core/ux/gc-page-state';
import { GcNotificationService } from '../../core/ux/gc-notification.service';
import { GcKeyboardShortcuts } from '../../core/ux/gc-keyboard-shortcuts.service';
import { GcRealtimeService, GcRealtimeTransport } from '../../core/realtime/gc-realtime.service';

class LocalRealtimeTransport implements GcRealtimeTransport {
  private readonly handlers = new Map<string, Set<(...data: unknown[]) => void>>();
  on(event: string, handler: (...data: unknown[]) => void): void {
    const entries = this.handlers.get(event) ?? new Set();
    entries.add(handler);
    this.handlers.set(event, entries);
  }
  off(event: string, handler: (...data: unknown[]) => void): void {
    this.handlers.get(event)?.delete(handler);
  }
  emit(event: string, ...data: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...data);
  }
  connect(): void { this.emit('connect'); }
  disconnect(): void { this.emit('disconnect'); }
}

@Component({
  selector: 'gc-ux-lab',
  imports: [
    RouterLink, GcButtonDirective, GcPageHeader, GcStatusBadge, GcErrorState,
    GcSkeleton, GcCanDirective,
  ],
  templateUrl: './ux-lab.html',
  styleUrl: './ux-lab.scss',
})
export class GcUxLab {
  protected readonly auth = inject(GcAuthFacade);
  protected readonly branding = inject(GcBrandingService);
  protected readonly notifications = inject(GcNotificationService);
  protected readonly realtime = inject(GcRealtimeService);
  private readonly shortcut = inject(GcKeyboardShortcuts);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly action = new GcAsyncAction();
  protected readonly pageState = new GcPageState<readonly string[]>();
  protected readonly socketEvents = signal<readonly string[]>([]);
  protected readonly logoInput = signal('/favicon.ico');
  protected readonly companyInput = signal('Gastro Core');
  protected readonly shortcutInput = viewChild<ElementRef<HTMLInputElement>>('shortcutInput');
  protected readonly gate = this.route.snapshot.queryParamMap.get('gate');
  private transport: LocalRealtimeTransport | null = null;
  private offRealtime: (() => void) | null = null;

  constructor() {
    const unsubscribe = this.shortcut.register({
      key: 'k',
      mod: true,
      handler: () => this.shortcutInput()?.nativeElement.focus(),
    });
    this.destroyRef.onDestroy(() => {
      unsubscribe();
      this.offRealtime?.();
      this.realtime.disconnect();
    });
  }

  protected login(role: DemoRole): void {
    this.auth.startDemo(role);
    this.notifications.show('Sesión de prueba: ' + role, 'info');
  }

  protected setName(value: string): void {
    this.branding.setName(value);
    this.notifications.show('Nombre actualizado solo en la interfaz.', 'success');
  }

  protected setLogo(value: string): void {
    if (!this.branding.setLogo(value)) {
      this.notifications.show('Logo inválido: utiliza /assets/logo.png o una URL HTTPS.', 'warning');
    } else {
      this.notifications.show('Logo actualizado en el sidebar.', 'success');
    }
  }

  protected async runAction(fail = false): Promise<void> {
    const result = await this.action.run(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 700));
      if (fail) throw new Error('Error de demostración');
      return 'Operación completada';
    });
    if (result.ok) this.notifications.show(result.value, 'success');
    else if (result.reason === 'error') this.notifications.show('La operación simulada falló.', 'error', 0);
  }

  protected async loadDemo(kind: 'ready' | 'empty' | 'error'): Promise<void> {
    await this.pageState.load(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 450));
      if (kind === 'error') throw new Error('No se pudo cargar el recurso (demo)');
      return kind === 'empty' ? [] : ['Artículo 001', 'Artículo 002', 'Artículo 003'];
    }, (value) => value.length === 0);
  }

  protected connectDemo(): void {
    this.offRealtime?.();
    const mock = new LocalRealtimeTransport();
    this.transport = mock;
    this.realtime.attach(mock);
    this.offRealtime = this.realtime.listen<string>('demo:activity', (value) => {
      this.socketEvents.update((current) => [value, ...current].slice(0, 5));
    });
  }
  protected pushDemoEvent(): void {
    this.transport?.emit('demo:activity', 'Evento local recibido · ' + (this.socketEvents().length + 1));
  }
  protected disconnectDemo(): void {
    this.offRealtime?.();
    this.offRealtime = null;
    this.realtime.disconnect();
    this.transport = null;
  }
}
