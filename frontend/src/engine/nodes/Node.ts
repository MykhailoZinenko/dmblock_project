import { Matrix } from '../math/Matrix.js';
import { ObservablePoint } from '../math/ObservablePoint.js';
import { Bounds } from '../math/Bounds.js';
import { EventEmitter } from '../utils/EventEmitter.js';

export class Node extends EventEmitter {
  public position: ObservablePoint;
  public scale: ObservablePoint;

  public localTransform: Matrix;
  public worldTransform: Matrix;
  public _bounds: Bounds;

  public parent: Node | null;
  public children: Node[];
  public visible: boolean;
  public interactive: boolean;
  public cursor: string | null;

  public _alpha: number;
  public worldAlpha: number;
  public _rotation: number;
  public _zIndex: number;

  public _localDirty: boolean;
  public _worldDirty: boolean;
  public _sortDirty: boolean;
  public _boundsDirty: boolean;

  constructor() {
    super();

    this.position = new ObservablePoint(this._onLocalChange, this);
    this.scale    = new ObservablePoint(this._onLocalChange, this, 1, 1);

    this.localTransform = new Matrix();
    this.worldTransform = new Matrix();
    this._bounds        = new Bounds();

    this.parent      = null;
    this.children    = [];
    this.visible     = true;
    this.interactive = false;
    this.cursor      = null;

    this._alpha      = 1;
    this.worldAlpha  = 1;
    this._rotation   = 0;
    this._zIndex     = 0;

    this._localDirty  = true;
    this._worldDirty  = true;
    this._sortDirty   = false;
    this._boundsDirty = true;
  }

  get alpha(): number { return this._alpha; }
  set alpha(value: number) {
    if (this._alpha !== value) {
      this._alpha = value;
      this._worldDirty = true;
    }
  }

  get rotation(): number { return this._rotation; }
  set rotation(value: number) {
    if (this._rotation !== value) {
      this._rotation = value;
      this._onLocalChange();
    }
  }

  get zIndex(): number { return this._zIndex; }
  set zIndex(value: number) {
    if (this._zIndex !== value) {
      this._zIndex = value;
      if (this.parent) this.parent._sortDirty = true;
    }
  }

  _onLocalChange(): void {
    this._localDirty  = true;
    this._worldDirty  = true;
    this._boundsDirty = true;
  }

  addChild<T extends Node>(child: T): T {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    child._worldDirty = true;
    this._sortDirty   = true;
    this._boundsDirty = true;
    return child;
  }

  addChildAt<T extends Node>(child: T, index: number): T {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.splice(index, 0, child);
    child._worldDirty = true;
    this._sortDirty   = true;
    this._boundsDirty = true;
    return child;
  }

  removeChild<T extends Node>(child: T): T | null {
    const idx: number = this.children.indexOf(child);
    if (idx === -1) return null;
    this.children.splice(idx, 1);
    child.parent = null;
    this._boundsDirty = true;
    return child;
  }

  removeFromParent(): void {
    if (this.parent) this.parent.removeChild(this);
  }

  destroy(): void {
    this.removeFromParent();
    for (let i = this.children.length - 1; i >= 0; i--) {
      this.children[i].destroy();
    }
    this.removeAllListeners();
  }

  setParent(parent: Node): this {
    parent.addChild(this);
    return this;
  }

  sortChildren(): void {
    this.children.sort((a: Node, b: Node) => a._zIndex - b._zIndex);
    this._sortDirty = false;
  }

  updateTransform(): void {
    if (this._localDirty) {
      this.localTransform
        .identity()
        .translate(this.position.x, this.position.y)
        .rotate(this._rotation)
        .scale(this.scale.x, this.scale.y);
      this._localDirty = false;
      this._worldDirty = true;
    }

    if (this._worldDirty) {
      if (this.parent) {
        this.worldTransform.copyFrom(this.parent.worldTransform).multiply(this.localTransform);
        this.worldAlpha = this.parent.worldAlpha * this._alpha;
      } else {
        this.worldTransform.copyFrom(this.localTransform);
        this.worldAlpha = this._alpha;
      }
      this._worldDirty  = false;
      this._boundsDirty = true;
      for (const child of this.children) child._worldDirty = true;
    }

    if (this._sortDirty) this.sortChildren();

    for (const child of this.children) child.updateTransform();
  }

  getBounds(): Bounds {
    if (this._boundsDirty) {
      this._bounds.clear();
      this._calculateBounds();
      for (const child of this.children) {
        if (child.visible) this._bounds.addBounds(child.getBounds());
      }
      this._boundsDirty = false;
    }
    return this._bounds;
  }

  _calculateBounds(): void {}

  containsPoint(_worldX: number, _worldY: number): boolean {
    return false;
  }
}
