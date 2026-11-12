/**
 * Minimal synchronous typed event bus.
 *
 *   const bus = new EventBus<GameEvents>();
 *   const off = bus.on('player:died', (e) => ...);
 *   bus.emit('player:died', { source: 'enemy' });
 *   off();
 *
 * Handlers run synchronously in subscription order. A throwing handler does not prevent the other
 * handlers from running; the error is reported through `onError` (console.error by default).
 * Subscribing/unsubscribing during an emit is safe (changes apply to the next emit).
 */
export type Unsubscribe = () => void;
type Handler<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private readonly handlers = new Map<keyof Events, Handler<never>[]>();

  onError: (error: unknown, event: keyof Events) => void = (error, event) => {
    console.error(`[EventBus] handler for "${String(event)}" threw`, error);
  };

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): Unsubscribe {
    const list = this.handlers.get(event);
    if (list) {
      // copy-on-write keeps in-flight emits stable
      this.handlers.set(event, [...list, handler as Handler<never>]);
    } else {
      this.handlers.set(event, [handler as Handler<never>]);
    }
    return () => this.off(event, handler);
  }

  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): Unsubscribe {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const next = list.filter((h) => h !== (handler as Handler<never>));
    if (next.length === 0) this.handlers.delete(event);
    else this.handlers.set(event, next);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const handler of list) {
      try {
        (handler as Handler<Events[K]>)(payload);
      } catch (error) {
        this.onError(error, event);
      }
    }
  }

  listenerCount(event?: keyof Events): number {
    if (event !== undefined) return this.handlers.get(event)?.length ?? 0;
    let total = 0;
    for (const list of this.handlers.values()) total += list.length;
    return total;
  }

  clear(): void {
    this.handlers.clear();
  }
}
