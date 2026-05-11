import { Matrix } from '../math/Matrix.js';
import type { PointLike } from '../math/Matrix.js';
import { ObservablePoint } from '../math/ObservablePoint.js';

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class Camera {
  public position: ObservablePoint;

  private _zoom: number;
  private _rotation: number;
  public dirty: boolean;

  private _viewMatrix: Matrix;
  private _projectionMatrix: Matrix;
  private _vpMatrix: Matrix;
  private _inverseVpMatrix: Matrix;
  private _canvasWidth: number;
  private _canvasHeight: number;

  constructor() {
    this.position = new ObservablePoint(() => { this.dirty = true; }, this);
    this._zoom = 1;
    this._rotation = 0;
    this.dirty = true;

    this._viewMatrix = new Matrix();
    this._projectionMatrix = new Matrix();
    this._vpMatrix = new Matrix();
    this._inverseVpMatrix = new Matrix();
    this._canvasWidth = 1;
    this._canvasHeight = 1;
  }

  get zoom(): number { return this._zoom; }
  set zoom(value: number) {
    if (this._zoom !== value) {
      this._zoom = value;
      this.dirty = true;
    }
  }

  get rotation(): number { return this._rotation; }
  set rotation(value: number) {
    if (this._rotation !== value) {
      this._rotation = value;
      this.dirty = true;
    }
  }

  getViewMatrix(): Matrix {
    // Post-multiply order: operations apply right-to-left to points.
    // We want: translate(-pos) -> rotate(-rot) -> scale(zoom)
    const m: Matrix = new Matrix();
    m.scale(this._zoom, this._zoom);
    if (this._rotation !== 0) m.rotate(-this._rotation);
    m.translate(-this.position.x, -this.position.y);
    return m;
  }

  getProjectionMatrix(width: number, height: number): Matrix {
    // View space is centered at camera (0,0). Just scale to NDC [-1,1] and flip Y.
    return new Matrix().set(2 / width, 0, 0, -2 / height, 0, 0);
  }

  updateMatrix(canvasWidth: number, canvasHeight: number): void {
    this._canvasWidth = canvasWidth;
    this._canvasHeight = canvasHeight;

    this._viewMatrix = this.getViewMatrix();
    this._projectionMatrix = this.getProjectionMatrix(canvasWidth, canvasHeight);

    this._vpMatrix.copyFrom(this._projectionMatrix).multiply(this._viewMatrix);
    this._inverseVpMatrix.copyFrom(this._vpMatrix).invert();

    this.dirty = false;
  }

  screenToWorld(screenX: number, screenY: number): PointLike {
    const ndcX: number = (screenX / this._canvasWidth) * 2 - 1;
    const ndcY: number = 1 - (screenY / this._canvasHeight) * 2;
    return this._inverseVpMatrix.apply({ x: ndcX, y: ndcY });
  }

  worldToScreen(worldX: number, worldY: number): PointLike {
    const ndc: PointLike = this._vpMatrix.apply({ x: worldX, y: worldY });
    return {
      x: (ndc.x + 1) / 2 * this._canvasWidth,
      y: (1 - ndc.y) / 2 * this._canvasHeight,
    };
  }

  getViewportBounds(): ViewportBounds {
    const w: number = this._canvasWidth;
    const h: number = this._canvasHeight;
    const tl: PointLike = this.screenToWorld(0, 0);
    const tr: PointLike = this.screenToWorld(w, 0);
    const bl: PointLike = this.screenToWorld(0, h);
    const br: PointLike = this.screenToWorld(w, h);
    return {
      minX: Math.min(tl.x, tr.x, bl.x, br.x),
      minY: Math.min(tl.y, tr.y, bl.y, br.y),
      maxX: Math.max(tl.x, tr.x, bl.x, br.x),
      maxY: Math.max(tl.y, tr.y, bl.y, br.y),
    };
  }
}
