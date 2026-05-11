export type EventListener = (...args: unknown[]) => void;

interface OnceWrapper extends EventListener {
  _original?: EventListener;
}

export class EventEmitter {
  private _listeners: Map<string, EventListener[]>;

  constructor() {
    this._listeners = new Map();
  }

  on(event: string, fn: EventListener): this {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event)!.push(fn);
    return this;
  }

  off(event: string, fn: EventListener): this {
    const list = this._listeners.get(event);
    if (!list) return this;
    let idx: number = list.indexOf(fn);
    if (idx === -1) {
      idx = list.findIndex((w: OnceWrapper) => w._original === fn);
    }
    if (idx !== -1) list.splice(idx, 1);
    return this;
  }

  once(event: string, fn: EventListener): this {
    const wrapper: OnceWrapper = (data: unknown) => {
      this.off(event, wrapper);
      fn(data);
    };
    // Store a reference back so off(event, fn) can remove the wrapper.
    wrapper._original = fn;
    return this.on(event, wrapper);
  }

  emit(event: string, data?: unknown): this {
    const list = this._listeners.get(event);
    if (!list) return this;
    for (const fn of list.slice()) {
      fn(data);
      if (data && typeof data === 'object' && (data as { stoppedImmediate?: boolean }).stoppedImmediate) break;
    }
    return this;
  }

  /**
   * Remove all listeners for a specific event, or every event if called
   * with no arguments.
   */
  removeAllListeners(event?: string): this {
    if (event === undefined) {
      this._listeners.clear();
    } else {
      this._listeners.delete(event);
    }
    return this;
  }
}
