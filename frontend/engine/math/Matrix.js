export class Matrix {
  constructor() {
    // [a, b, c, d, tx, ty] — column-major affine 3×3:
    // | a  c  tx |
    // | b  d  ty |
    // | 0  0   1 |
    this.a  = 1; this.b  = 0;
    this.c  = 0; this.d  = 1;
    this.tx = 0; this.ty = 0;
  }

  identity() {
    this.a = 1; this.b = 0;
    this.c = 0; this.d = 1;
    this.tx = 0; this.ty = 0;
    return this;
  }

  set(a, b, c, d, tx, ty) {
    this.a = a; this.b = b;
    this.c = c; this.d = d;
    this.tx = tx; this.ty = ty;
    return this;
  }

  translate(x, y) {
    this.tx += this.a * x + this.c * y;
    this.ty += this.b * x + this.d * y;
    return this;
  }

  scale(x, y) {
    this.a *= x; this.b *= x;
    this.c *= y; this.d *= y;
    return this;
  }

  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const { a, b, c, d } = this;
    this.a = a * cos - b * sin;
    this.b = a * sin + b * cos;
    this.c = c * cos - d * sin;
    this.d = c * sin + d * cos;
    return this;
  }

  multiply(other) {
    const { a, b, c, d, tx, ty } = this;
    this.a  = a  * other.a + c  * other.b;
    this.b  = b  * other.a + d  * other.b;
    this.c  = a  * other.c + c  * other.d;
    this.d  = b  * other.c + d  * other.d;
    this.tx = a  * other.tx + c  * other.ty + tx;
    this.ty = b  * other.tx + d  * other.ty + ty;
    return this;
  }

  apply(point) {
    return {
      x: this.a * point.x + this.c * point.y + this.tx,
      y: this.b * point.x + this.d * point.y + this.ty,
    };
  }

  applyInverse(point) {
    const det = this.a * this.d - this.b * this.c;
    const dx = point.x - this.tx;
    const dy = point.y - this.ty;
    return {
      x: (this.d * dx - this.c * dy) / det,
      y: (this.a * dy - this.b * dx) / det,
    };
  }

  invert() {
    const det = this.a * this.d - this.b * this.c;
    const { a, b, c, d, tx, ty } = this;
    this.a  =  d / det;
    this.b  = -b / det;
    this.c  = -c / det;
    this.d  =  a / det;
    this.tx = (c * ty - d * tx) / det;
    this.ty = (b * tx - a * ty) / det;
    return this;
  }

  clone() {
    return new Matrix().set(this.a, this.b, this.c, this.d, this.tx, this.ty);
  }

  copyFrom(other) {
    return this.set(other.a, other.b, other.c, other.d, other.tx, other.ty);
  }
}
