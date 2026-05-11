export interface PointLike {
  x: number;
  y: number;
}

export class Matrix {
  public a: number;
  public b: number;
  public c: number;
  public d: number;
  public tx: number;
  public ty: number;

  constructor() {
    // [a, b, c, d, tx, ty] — column-major affine 3×3:
    // | a  c  tx |
    // | b  d  ty |
    // | 0  0   1 |
    this.a  = 1; this.b  = 0;
    this.c  = 0; this.d  = 1;
    this.tx = 0; this.ty = 0;
  }

  identity(): this {
    this.a = 1; this.b = 0;
    this.c = 0; this.d = 1;
    this.tx = 0; this.ty = 0;
    return this;
  }

  set(a: number, b: number, c: number, d: number, tx: number, ty: number): this {
    this.a = a; this.b = b;
    this.c = c; this.d = d;
    this.tx = tx; this.ty = ty;
    return this;
  }

  translate(x: number, y: number): this {
    this.tx += this.a * x + this.c * y;
    this.ty += this.b * x + this.d * y;
    return this;
  }

  scale(x: number, y: number): this {
    this.a *= x; this.b *= x;
    this.c *= y; this.d *= y;
    return this;
  }

  rotate(angle: number): this {
    const cos: number = Math.cos(angle);
    const sin: number = Math.sin(angle);
    const { a, b, c, d } = this;
    this.a = a * cos - b * sin;
    this.b = a * sin + b * cos;
    this.c = c * cos - d * sin;
    this.d = c * sin + d * cos;
    return this;
  }

  multiply(other: Matrix): this {
    const { a, b, c, d, tx, ty } = this;
    this.a  = a  * other.a + c  * other.b;
    this.b  = b  * other.a + d  * other.b;
    this.c  = a  * other.c + c  * other.d;
    this.d  = b  * other.c + d  * other.d;
    this.tx = a  * other.tx + c  * other.ty + tx;
    this.ty = b  * other.tx + d  * other.ty + ty;
    return this;
  }

  apply(point: PointLike): PointLike {
    return {
      x: this.a * point.x + this.c * point.y + this.tx,
      y: this.b * point.x + this.d * point.y + this.ty,
    };
  }

  applyInverse(point: PointLike): PointLike {
    const det: number = this.a * this.d - this.b * this.c;
    const dx: number = point.x - this.tx;
    const dy: number = point.y - this.ty;
    return {
      x: (this.d * dx - this.c * dy) / det,
      y: (this.a * dy - this.b * dx) / det,
    };
  }

  invert(): this {
    const det: number = this.a * this.d - this.b * this.c;
    const { a, b, c, d, tx, ty } = this;
    this.a  =  d / det;
    this.b  = -b / det;
    this.c  = -c / det;
    this.d  =  a / det;
    this.tx = (c * ty - d * tx) / det;
    this.ty = (b * tx - a * ty) / det;
    return this;
  }

  clone(): Matrix {
    return new Matrix().set(this.a, this.b, this.c, this.d, this.tx, this.ty);
  }

  copyFrom(other: Matrix): this {
    return this.set(other.a, other.b, other.c, other.d, other.tx, other.ty);
  }
}
