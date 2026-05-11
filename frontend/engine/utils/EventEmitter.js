export class EventEmitter {
  constructor() {
    /** @type {Map<string, Function[]>} */
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(fn);
    return this;
  }

  off(event, fn) {
    const list = this._listeners.get(event);
    if (!list) return this;
    let idx = list.indexOf(fn);
    if (idx === -1) {
      idx = list.findIndex(w => w._original === fn);
    }
    if (idx !== -1) list.splice(idx, 1);
    return this;
  }

  once(event, fn) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      fn(data);
    };
    // Store a reference back so off(event, fn) can remove the wrapper.
    wrapper._original = fn;
    return this.on(event, wrapper);
  }

  emit(event, data) {
    const list = this._listeners.get(event);
    if (!list) return this;
    for (const fn of list.slice()) {
      fn(data);
      if (data && data.stoppedImmediate) break;
    }
    return this;
  }

  /**
   * Remove all listeners for a specific event, or every event if called
   * with no arguments.
   */
  removeAllListeners(event) {
    if (event === undefined) {
      this._listeners.clear();
    } else {
      this._listeners.delete(event);
    }
    return this;
  }
}
