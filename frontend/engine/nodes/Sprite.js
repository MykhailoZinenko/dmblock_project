import { Node } from './Node.js';
import { ObservablePoint } from '../math/ObservablePoint.js';
import { Texture } from '../textures/Texture.js';
import { BLEND_MODES } from '../render/BlendMode.js';

export class Sprite extends Node {
  constructor(texture = Texture.EMPTY) {
    super();
    this.anchor = new ObservablePoint(this._onLocalChange, this);
    this._texture = null;
    this.tint = 0xFFFFFF;
    this.blendMode = BLEND_MODES.NORMAL;
    this.texture = texture;
  }

  get texture() { return this._texture; }
  set texture(value) {
    if (this._texture === value) return;
    this._texture = value;
    this._boundsDirty = true;
  }

  get width() { return this._texture.width * Math.abs(this.scale.x); }
  set width(v) { this.scale.x = v / this._texture.width; }

  get height() { return this._texture.height * Math.abs(this.scale.y); }
  set height(v) { this.scale.y = v / this._texture.height; }

  containsPoint(worldX, worldY) {
    const local = this.worldTransform.applyInverse({ x: worldX, y: worldY });
    const w = this._texture.width;
    const h = this._texture.height;
    const x0 = -this.anchor.x * w;
    const y0 = -this.anchor.y * h;
    return local.x >= x0 && local.x <= x0 + w &&
           local.y >= y0 && local.y <= y0 + h;
  }

  _calculateBounds() {
    const w = this._texture.width;
    const h = this._texture.height;
    const ax = this.anchor.x * w;
    const ay = this.anchor.y * h;
    const x0 = -ax,      y0 = -ay;
    const x1 = w - ax,   y1 = -ay;
    const x2 = w - ax,   y2 = h - ay;
    const x3 = -ax,      y3 = h - ay;
    const wt = this.worldTransform;
    const vertices = [
      wt.a * x0 + wt.c * y0 + wt.tx, wt.b * x0 + wt.d * y0 + wt.ty,
      wt.a * x1 + wt.c * y1 + wt.tx, wt.b * x1 + wt.d * y1 + wt.ty,
      wt.a * x2 + wt.c * y2 + wt.tx, wt.b * x2 + wt.d * y2 + wt.ty,
      wt.a * x3 + wt.c * y3 + wt.tx, wt.b * x3 + wt.d * y3 + wt.ty,
    ];
    this._bounds.addQuad(vertices);
  }
}
