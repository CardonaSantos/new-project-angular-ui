import { TestBed } from '@angular/core/testing';
import { GcRealtimeService, GcRealtimeTransport } from './gc-realtime.service';

class MockTransport implements GcRealtimeTransport {
  private callbacks = new Map<string, Set<(...values: unknown[]) => void>>();
  connect(): void { this.fire('connect'); }
  disconnect(): void { this.fire('disconnect'); }
  on(event: string, handler: (...data: unknown[]) => void): void {
    const bucket = this.callbacks.get(event) ?? new Set();
    bucket.add(handler);
    this.callbacks.set(event, bucket);
  }
  off(event: string, handler: (...data: unknown[]) => void): void { this.callbacks.get(event)?.delete(handler); }
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
});
