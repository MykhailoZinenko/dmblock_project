export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Bounds {
  public minX: number;
  public minY: number;
  public maxX: number;
  public maxY: number;

  constructor() {
    this.minX =  Infinity;
    this.minY =  Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this.clear();
  }

  clear(): this {
    this.minX =  Infinity;
    this.minY =  Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    return this;
  }

  addPoint(x: number, y: number): this {
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
    return this;
  }

  addBounds(other: Bounds): this {
    this.addPoint(other.minX, other.minY);
    this.addPoint(other.maxX, other.maxY);
    return this;
  }

  // flat array [x0,y0, x1,y1, x2,y2, x3,y3]
  addQuad(vertices: ArrayLike<number>): this {
    for (let i = 0; i < 8; i += 2) {
      this.addPoint(vertices[i], vertices[i + 1]);
    }
    return this;
  }

  contains(x: number, y: number): boolean {
    return x >= this.minX && x <= this.maxX &&
           y >= this.minY && y <= this.maxY;
  }

  intersects(other: Bounds): boolean {
    return this.maxX > other.minX && this.minX < other.maxX &&
           this.maxY > other.minY && this.minY < other.maxY;
  }

  getRectangle(): Rectangle {
    return {
      x:      this.minX,
      y:      this.minY,
      width:  this.maxX - this.minX,
      height: this.maxY - this.minY,
    };
  }
}
