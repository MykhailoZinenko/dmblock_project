import { Matrix } from '../math/Matrix.js';
import { ObservablePoint } from '../math/ObservablePoint.js';

export class Camera {
  constructor() {
    this.position = new ObservablePoint(() => { this._dirty = true; });
    this._zoom = 1;
    this._rotation = 0;
    this._dirty = true;

    this._viewMatrix = new Matrix();
    this._projectionMatrix = new Matrix();
    this._vpMatrix = new Matrix();
    this._inverseVpMatrix = new Matrix();
    this._canvasWidth = 1;
    this._canvasHeight = 1;
  }

  get zoom() { return this._zoom; }
  set zoom(value) {
    if (this._zoom !== value) {
      this._zoom = value;
      this._dirty = true;
    }
  }

  get rotation() { return this._rotation; }
  set rotation(value) {
    if (this._rotation !== value) {
      this._rotation = value;
      this._dirty = true;
    }
  }

  getViewMatrix() {
    // Post-multiply order: operations apply right-to-left to points.
    // We want: translate(-pos) → rotate(-rot) → scale(zoom)
    const m = new Matrix();
    m.scale(this._zoom, this._zoom);
    if (this._rotation !== 0) m.rotate(-this._rotation);
    m.translate(-this.position.x, -this.position.y);
    return m;
  }

  getProjectionMatrix(width, height) {
    // View space is centered at camera (0,0). Just scale to NDC [-1,1] and flip Y.
    return new Matrix().set(2 / width, 0, 0, -2 / height, 0, 0);
  }

  updateMatrix(canvasWidth, canvasHeight) {
    this._canvasWidth = canvasWidth;
    this._canvasHeight = canvasHeight;

    this._viewMatrix = this.getViewMatrix();
    this._projectionMatrix = this.getProjectionMatrix(canvasWidth, canvasHeight);

    this._vpMatrix.copyFrom(this._projectionMatrix).multiply(this._viewMatrix);
    this._inverseVpMatrix.copyFrom(this._vpMatrix).invert();

    this._dirty = false;
  }

  screenToWorld(screenX, screenY) {
    const ndcX = (screenX / this._canvasWidth) * 2 - 1;
    const ndcY = 1 - (screenY / this._canvasHeight) * 2;
    return this._inverseVpMatrix.apply({ x: ndcX, y: ndcY });
  }

  worldToScreen(worldX, worldY) {
    const ndc = this._vpMatrix.apply({ x: worldX, y: worldY });
    return {
      x: (ndc.x + 1) / 2 * this._canvasWidth,
      y: (1 - ndc.y) / 2 * this._canvasHeight,
    };
  }

  getViewportBounds() {
    const w = this._canvasWidth;
    const h = this._canvasHeight;
    const tl = this.screenToWorld(0, 0);
    const tr = this.screenToWorld(w, 0);
    const bl = this.screenToWorld(0, h);
    const br = this.screenToWorld(w, h);
    return {
      minX: Math.min(tl.x, tr.x, bl.x, br.x),
      minY: Math.min(tl.y, tr.y, bl.y, br.y),
      maxX: Math.max(tl.x, tr.x, bl.x, br.x),
      maxY: Math.max(tl.y, tr.y, bl.y, br.y),
    };
  }
}
