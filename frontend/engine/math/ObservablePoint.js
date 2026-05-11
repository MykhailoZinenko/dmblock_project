export class ObservablePoint {
  #cb;
  #scope;
  #x;
  #y;

  constructor(cb, scope, x = 0, y = 0) {
    this.#cb    = cb;
    this.#scope = scope;
    this.#x     = x;
    this.#y     = y;
  }

  get x() { return this.#x; }
  set x(value) {
    if (this.#x !== value) {
      this.#x = value;
      this.#cb.call(this.#scope);
    }
  }

  get y() { return this.#y; }
  set y(value) {
    if (this.#y !== value) {
      this.#y = value;
      this.#cb.call(this.#scope);
    }
  }

  set(x, y) {
    const changed = this.#x !== x || this.#y !== y;
    this.#x = x;
    this.#y = y;
    if (changed) this.#cb.call(this.#scope);
    return this;
  }

  copyFrom(other) {
    return this.set(other.x, other.y);
  }

  clone(cb, scope) {
    return new ObservablePoint(cb, scope, this.#x, this.#y);
  }
}
