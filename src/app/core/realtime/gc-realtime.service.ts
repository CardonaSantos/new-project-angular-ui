import { Injectable, OnDestroy, signal } from '@angular/core';

export type GcConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type GcEventHandler<T> = (payload: T) => void;

/** Transport abstraction supports fake adapters in UI tests and real Socket.IO when configured. */
export interface GcRealtimeTransport {
  connect(): void;
  disconnect(): void;
  on(event: string, handler: (...data: unknown[]) => void): void;
  off(event: string, handler: (...data: unknown[]) => void): void;
}

@Injectable({ providedIn: 'root' })
export class GcRealtimeService implements OnDestroy {
  readonly status = signal<GcConnectionStatus>('disconnected');
  private transport: GcRealtimeTransport | null = null;
  private readonly subscriptions = new Set<() => void>();
  private connected = (): void => this.status.set('connected');
  private disconnected = (): void => this.status.set('disconnected');

  attach(transport: GcRealtimeTransport): void {
    this.disconnect();
    this.transport = transport;
    transport.on('connect', this.connected);
    transport.on('disconnect', this.disconnected);
    this.status.set('connecting');
    transport.connect();
  }

  /** Opt-in only: never open network sockets merely by injecting the service. */
  async connectSocketIo(url: string, auth?: Record<string, string>): Promise<void> {
    const { io } = await import('socket.io-client');
    const socket = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      auth,
    });
    this.attach(socket as unknown as GcRealtimeTransport);
  }

  listen<T>(event: string, handler: GcEventHandler<T>): () => void {
    if (!this.transport) return () => undefined;
    const transport = this.transport;
    const wrapped = (...data: unknown[]): void => handler(data[0] as T);
    transport.on(event, wrapped);
    const unsubscribe = (): void => {
      transport.off(event, wrapped);
      this.subscriptions.delete(unsubscribe);
    };
    this.subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  disconnect(): void {
    for (const unsub of [...this.subscriptions]) unsub();
    if (this.transport) {
      this.transport.off('connect', this.connected);
      this.transport.off('disconnect', this.disconnected);
      this.transport.disconnect();
    }
    this.transport = null;
    this.status.set('disconnected');
  }

  ngOnDestroy(): void { this.disconnect(); }
}
