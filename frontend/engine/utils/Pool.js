export class Pool {
  /**
   * @param {() => T} factory  — creates a new object when the pool is empty
   * @param {(obj: T) => void} [reset]  — optional cleanup called on release
   * @template T
   */
  constructor(factory, reset) {
    this._factory = factory;
    this._reset   = reset ?? null;
    this._items   = [];
  }

  /** Number of objects currently sitting in the pool. */
  get size() {
    return this._items.length;
  }

  /** Return a pooled object, or create a new one if the pool is empty. */
  get() {
    return this._items.length > 0 ? this._items.pop() : this._factory();
  }

  /** Return an object to the pool, calling reset if one was provided. */
  release(obj) {
    if (this._reset) this._reset(obj);
    this._items.push(obj);
  }
}
