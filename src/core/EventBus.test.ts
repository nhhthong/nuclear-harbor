import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';

interface TestEvents {
  ping: { n: number };
  pong: Record<string, never>;
}

describe('EventBus', () => {
  it('delivers payloads to subscribers in order and supports unsubscribe', () => {
    const bus = new EventBus<TestEvents>();
    const calls: string[] = [];
    const offA = bus.on('ping', (e) => calls.push(`a${e.n}`));
    bus.on('ping', (e) => calls.push(`b${e.n}`));
    bus.emit('ping', { n: 1 });
    offA();
    bus.emit('ping', { n: 2 });
    expect(calls).toEqual(['a1', 'b1', 'b2']);
    expect(bus.listenerCount('ping')).toBe(1);
  });

  it('once() fires a single time', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.once('pong', handler);
    bus.emit('pong', {});
    bus.emit('pong', {});
    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount()).toBe(0);
  });

  it('isolates a throwing handler from the others', () => {
    const bus = new EventBus<TestEvents>();
    const errors: unknown[] = [];
    bus.onError = (error) => errors.push(error);
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', after);
    bus.emit('ping', { n: 1 });
    expect(after).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
  });

  it('tolerates unsubscribing during an emit', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const off = bus.on('ping', () => off());
    bus.on('ping', second);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(second).toHaveBeenCalledTimes(2);
    expect(bus.listenerCount('ping')).toBe(1);
  });
});
