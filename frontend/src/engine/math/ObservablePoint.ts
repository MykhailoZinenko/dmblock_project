export type ObservableCallback = () => void;

export class ObservablePoint {
  #cb: ObservableCallback;
  #scope: unknown;
  #x: number;
  #y: number;

  constructor(cb: ObservableCallback, scope: unknown, x: number = 0, y: number = 0) {
    this.#cb    = cb;
    this.#scope = scope;
    this.#x     = x;
    this.#y     = y;
  }

  get x(): number { return this.#x; }
  set x(value: number) {
    if (this.#x !== value) {
      this.#x = value;
      this.#cb.call(this.#scope);
    }
  }

  get y(): number { return this.#y; }
  set y(value: number) {
    if (this.#y !== value) {
      this.#y = value;
      this.#cb.call(this.#scope);
    }
  }

  set(x: number, y: number): this {
    const changed: boolean = this.#x !== x || this.#y !== y;
    this.#x = x;
    this.#y = y;
    if (changed) this.#cb.call(this.#scope);
    return this;
  }

  copyFrom(other: { x: number; y: number }): this {
    return this.set(other.x, other.y);
  }

  clone(cb: ObservableCallback, scope: unknown): ObservablePoint {
    return new ObservablePoint(cb, scope, this.#x, this.#y);
  }
}
