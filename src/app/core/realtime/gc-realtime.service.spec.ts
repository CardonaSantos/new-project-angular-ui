import { TestBed } from '@angular/core/testing';
import { GcRealtimeService, GcRealtimeTransport } from './gc-realtime.service';

class MockTransport implements GcRealtimeTransport {
  readonly emitted: Array<{ event: string; args: unknown[] }> = [];
  private callbacks = new Map<string, Set<(...values: unknown[]) => void>>();
  connect(): void { this.fire('connect'); }
  disconnect(): void { this.fire('disconnect'); }
  on(event: string, handler: (...data: unknown[]) => void): void {
    const bucket = this.callbacks.get(event) ?? new Set();
    bucket.add(handler);
    this.callbacks.set(event, bucket);
  }
  off(event: string, handler: (...data: unknown[]) => void): void { this.callbacks.get(event)?.delete(handler); }
  emit(event: string, ...args: unknown[]): void { this.emitted.push({ event, args }); }
  fire(event: string, ...values: unknown[]): void {
    for (const callback of this.callbacks.get(event) ?? []) callback(...values);
  }
}

describe('GcRealtimeService', () => {
  it('supports a mock transport and unsubscribes listeners', () => {
    const service = TestBed.inject(GcRealtimeService);
    const transport = new MockTransport();
    service.attach(transport);
    expect(service.status()).toBe('connected');
    const received: string[] = [];
    const off = service.listen<string>('demo:event', (data) => received.push(data));
    transport.fire('demo:event', 'first');
    off();
    transport.fire('demo:event', 'second');
    expect(received).toEqual(['first']);
    service.disconnect();
    expect(service.status()).toBe('disconnected');
  });

  it('keeps a listener registered across a disconnect/reconnect cycle', () => {
    const service = TestBed.inject(GcRealtimeService);
    const first = new MockTransport();
    service.attach(first);
    const received: string[] = [];
    service.listen<string>('demo:event', (data) => received.push(data));
    first.fire('demo:event', 'before logout');
    service.disconnect();
    expect(service.status()).toBe('disconnected');
    // A fresh login reconnects with a new transport instance — the listener above was never
    // unsubscribed, so it must still fire without the caller re-registering it.
    const second = new MockTransport();
    service.attach(second);
    second.fire('demo:event', 'after login');
    expect(received).toEqual(['before logout', 'after login']);
  });
});
