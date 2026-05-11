export class Pool<T> {
  private _factory: () => T;
  private _reset: ((obj: T) => void) | null;
  private _items: T[];

  constructor(factory: () => T, reset?: (obj: T) => void) {
    this._factory = factory;
    this._reset   = reset ?? null;
    this._items   = [];
  }

  /** Number of objects currently sitting in the pool. */
  get size(): number {
    return this._items.length;
  }

  /** Return a pooled object, or create a new one if the pool is empty. */
  get(): T {
    return this._items.length > 0 ? this._items.pop()! : this._factory();
  }

  /** Return an object to the pool, calling reset if one was provided. */
  release(obj: T): void {
    if (this._reset) this._reset(obj);
    this._items.push(obj);
  }
}
