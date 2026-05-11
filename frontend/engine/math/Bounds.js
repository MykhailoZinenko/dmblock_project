export class Bounds {
  constructor() {
    this.clear();
  }

  clear() {
    this.minX =  Infinity;
    this.minY =  Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    return this;
  }

  addPoint(x, y) {
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
    return this;
  }

  addBounds(other) {
    this.addPoint(other.minX, other.minY);
    this.addPoint(other.maxX, other.maxY);
    return this;
  }

  // flat array [x0,y0, x1,y1, x2,y2, x3,y3]
  addQuad(vertices) {
    for (let i = 0; i < 8; i += 2) {
      this.addPoint(vertices[i], vertices[i + 1]);
    }
    return this;
  }

  contains(x, y) {
    return x >= this.minX && x <= this.maxX &&
           y >= this.minY && y <= this.maxY;
  }

  intersects(other) {
    return this.maxX > other.minX && this.minX < other.maxX &&
           this.maxY > other.minY && this.minY < other.maxY;
  }

  getRectangle() {
    return {
      x:      this.minX,
      y:      this.minY,
      width:  this.maxX - this.minX,
      height: this.maxY - this.minY,
    };
  }
}
