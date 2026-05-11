import { Node } from './Node.js';
import { ObservablePoint } from '../math/ObservablePoint.js';
import { Texture } from '../textures/Texture.js';
import { BLEND_MODES } from '../render/BlendMode.js';
import type { BlendMode } from '../render/BlendMode.js';

export class Sprite extends Node {
  public anchor: ObservablePoint;
  public _texture: Texture;
  public tint: number;
  public blendMode: BlendMode;

  constructor(texture: Texture = Texture.EMPTY) {
    super();
    this.anchor = new ObservablePoint(this._onLocalChange, this);
    this._texture = null!;
    this.tint = 0xFFFFFF;
    this.blendMode = BLEND_MODES.NORMAL;
    this.texture = texture;
  }

  get texture(): Texture { return this._texture; }
  set texture(value: Texture) {
    if (this._texture === value) return;
    this._texture = value;
    this._boundsDirty = true;
  }

  get width(): number { return this._texture.width * Math.abs(this.scale.x); }
  set width(v: number) { this.scale.x = v / this._texture.width; }

  get height(): number { return this._texture.height * Math.abs(this.scale.y); }
  set height(v: number) { this.scale.y = v / this._texture.height; }

  containsPoint(worldX: number, worldY: number): boolean {
    const local = this.worldTransform.applyInverse({ x: worldX, y: worldY });
    const w: number = this._texture.width;
    const h: number = this._texture.height;
    const x0: number = -this.anchor.x * w;
    const y0: number = -this.anchor.y * h;
    return local.x >= x0 && local.x <= x0 + w &&
           local.y >= y0 && local.y <= y0 + h;
  }

  _calculateBounds(): void {
    const w: number = this._texture.width;
    const h: number = this._texture.height;
    const ax: number = this.anchor.x * w;
    const ay: number = this.anchor.y * h;
    const x0: number = -ax,      y0: number = -ay;
    const x1: number = w - ax,   y1: number = -ay;
    const x2: number = w - ax,   y2: number = h - ay;
    const x3: number = -ax,      y3: number = h - ay;
    const wt = this.worldTransform;
    const vertices: number[] = [
      wt.a * x0 + wt.c * y0 + wt.tx, wt.b * x0 + wt.d * y0 + wt.ty,
      wt.a * x1 + wt.c * y1 + wt.tx, wt.b * x1 + wt.d * y1 + wt.ty,
      wt.a * x2 + wt.c * y2 + wt.tx, wt.b * x2 + wt.d * y2 + wt.ty,
      wt.a * x3 + wt.c * y3 + wt.tx, wt.b * x3 + wt.d * y3 + wt.ty,
    ];
    this._bounds.addQuad(vertices);
  }
}
