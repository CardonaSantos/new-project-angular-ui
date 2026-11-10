import { Injectable, OnDestroy, signal } from '@angular/core';

export type GcConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type GcEventHandler<T> = (payload: T) => void;

/** Transport abstraction supports fake adapters in UI tests and real Socket.IO when configured. */
export interface GcRealtimeTransport {
  connect(): void;
  disconnect(): void;
  on(event: string, handler: (...data: unknown[]) => void): void;
  off(event: string, handler: (...data: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
}

@Injectable({ providedIn: 'root' })
export class GcRealtimeService implements OnDestroy {
  readonly status = signal<GcConnectionStatus>('disconnected');
  private transport: GcRealtimeTransport | null = null;
  // Logical listeners, independent of any one transport instance: a reconnect (e.g. after a
  // logout/login cycle) re-wires every one of these onto the fresh transport in attach(), so a
  // long-lived caller (a root singleton, or a component that hasn't been destroyed) never has to
  // notice that the underlying socket was torn down and recreated.
  private readonly registrations = new Map<string, Map<GcEventHandler<unknown>, (...data: unknown[]) => void>>();
  private connected = (): void => this.status.set('connected');
  private disconnected = (): void => this.status.set('disconnected');

  attach(transport: GcRealtimeTransport): void {
    if (this.transport) this.teardownTransport();
    this.transport = transport;
    transport.on('connect', this.connected);
    transport.on('disconnect', this.disconnected);
    for (const [event, handlers] of this.registrations) {
      for (const handler of [...handlers.keys()]) this.wire(event, handler);
    }
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

  /** No-op while disconnected: callers don't need to guard every emit on connection status. */
  emit(event: string, ...args: unknown[]): void {
    this.transport?.emit(event, ...args);
  }

  listen<T>(event: string, handler: GcEventHandler<T>): () => void {
    const bucket = this.registrations.get(event) ?? new Map<GcEventHandler<unknown>, (...data: unknown[]) => void>();
    this.registrations.set(event, bucket);
    const typed = handler as GcEventHandler<unknown>;
    if (!bucket.has(typed)) {
      bucket.set(typed, () => undefined);
      if (this.transport) this.wire(event, typed);
    }
    return () => {
      const current = this.registrations.get(event);
      const wrapped = current?.get(typed);
      if (wrapped) this.transport?.off(event, wrapped);
      current?.delete(typed);
    };
  }

  private wire(event: string, handler: GcEventHandler<unknown>): void {
    if (!this.transport) return;
    const wrapped = (...data: unknown[]): void => handler(data[0]);
    this.registrations.get(event)!.set(handler, wrapped);
    this.transport.on(event, wrapped);
  }

  private teardownTransport(): void {
    if (!this.transport) return;
    this.transport.off('connect', this.connected);
    this.transport.off('disconnect', this.disconnected);
    this.transport.disconnect();
    this.transport = null;
  }

  /** Drops the connection only — registered listeners stay put and are rewired automatically by
   * the next attach()/connectSocketIo(), e.g. after a fresh login. Call `listen()`'s own returned
   * unsubscribe (not this) to stop a specific listener for good. */
  disconnect(): void {
    this.teardownTransport();
    this.status.set('disconnected');
  }

  ngOnDestroy(): void {
    this.teardownTransport();
    this.registrations.clear();
  }
}
