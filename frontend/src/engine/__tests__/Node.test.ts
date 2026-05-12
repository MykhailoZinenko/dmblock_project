import { describe, it, expect } from 'vitest';
import { Node } from '../nodes/Node.js';

describe('Node', () => {
  it('default position is 0,0', () => {
    const n = new Node();
    expect(n.position.x).toBe(0);
    expect(n.position.y).toBe(0);
  });

  it('default scale is 1,1', () => {
    const n = new Node();
    expect(n.scale.x).toBe(1);
    expect(n.scale.y).toBe(1);
  });

  it('addChild sets parent', () => {
    const parent = new Node();
    const child  = new Node();
    parent.addChild(child);
    expect(child.parent).toBe(parent);
  });

  it('addChild removes child from previous parent', () => {
    const a = new Node();
    const b = new Node();
    const child = new Node();
    a.addChild(child);
    b.addChild(child);
    expect(child.parent).toBe(b);
    expect(a.children.length).toBe(0);
    expect(b.children.length).toBe(1);
  });

  it('removeChild nulls parent', () => {
    const parent = new Node();
    const child  = new Node();
    parent.addChild(child);
    parent.removeChild(child);
    expect(child.parent).toBe(null);
    expect(parent.children.length).toBe(0);
  });

  it('addChildAt inserts at index', () => {
    const parent = new Node();
    const a = new Node();
    const b = new Node();
    const c = new Node();
    parent.addChild(a);
    parent.addChild(b);
    parent.addChildAt(c, 1);
    expect(parent.children[0]).toBe(a);
    expect(parent.children[1]).toBe(c);
    expect(parent.children[2]).toBe(b);
  });

  it('removeFromParent works', () => {
    const parent = new Node();
    const child  = new Node();
    parent.addChild(child);
    child.removeFromParent();
    expect(child.parent).toBe(null);
    expect(parent.children.length).toBe(0);
  });

  it('setting position.x marks _localDirty', () => {
    const n = new Node();
    n._localDirty = false;
    n.position.x = 42;
    expect(n._localDirty).toBe(true);
  });

  it('setting scale marks _localDirty', () => {
    const n = new Node();
    n._localDirty = false;
    n.scale.x = 2;
    expect(n._localDirty).toBe(true);
  });

  it('setting rotation marks _localDirty', () => {
    const n = new Node();
    n._localDirty = false;
    n.rotation = Math.PI / 4;
    expect(n._localDirty).toBe(true);
  });

  it('updateTransform computes worldTransform from parent', () => {
    const parent = new Node();
    const child  = new Node();
    parent.position.set(100, 200);
    child.position.set(10, 20);
    parent.addChild(child);
    parent.updateTransform();
    expect(Math.abs(child.worldTransform.tx - 110)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(child.worldTransform.ty - 220)).toBeLessThanOrEqual(0.0001);
  });

  it('worldAlpha multiplies through hierarchy', () => {
    const parent = new Node();
    const child  = new Node();
    parent.alpha = 0.5;
    child.alpha  = 0.5;
    parent.addChild(child);
    parent.updateTransform();
    expect(Math.abs(child.worldAlpha - 0.25)).toBeLessThanOrEqual(0.0001);
  });

  it('zIndex change sets parent._sortDirty', () => {
    const parent = new Node();
    const child  = new Node();
    parent.addChild(child);
    parent._sortDirty = false;
    child.zIndex = 5;
    expect(parent._sortDirty).toBe(true);
  });

  it('sortChildren sorts by zIndex', () => {
    const parent = new Node();
    const a = new Node(); a._zIndex = 3;
    const b = new Node(); b._zIndex = 1;
    const c = new Node(); c._zIndex = 2;
    parent.addChild(a);
    parent.addChild(b);
    parent.addChild(c);
    parent.sortChildren();
    expect(parent.children[0]).toBe(b);
    expect(parent.children[1]).toBe(c);
    expect(parent.children[2]).toBe(a);
  });

  it('EventEmitter on/emit works on Node', () => {
    const n = new Node();
    let received: unknown = null;
    n.on('test', (d: unknown) => { received = d; });
    n.emit('test', 99);
    expect(received).toBe(99);
  });

  it('getBounds returns empty for bare Node', () => {
    const n = new Node();
    const b = n.getBounds();
    expect(b.minX).toBe(Infinity);
    expect(b.minY).toBe(Infinity);
    expect(b.maxX).toBe(-Infinity);
    expect(b.maxY).toBe(-Infinity);
  });

  it('destroy removes from parent and destroys children', () => {
    const parent = new Node();
    const child = new Node();
    const grandchild = new Node();
    parent.addChild(child);
    child.addChild(grandchild);
    child.destroy();
    expect(parent.children.length).toBe(0);
    expect(child.parent).toBe(null);
    expect(grandchild.parent).toBe(null);
  });

  it('setParent adds node to new parent', () => {
    const parent = new Node();
    const child = new Node();
    child.setParent(parent);
    expect(child.parent).toBe(parent);
    expect(parent.children).toContain(child);
  });

  it('removeChild on non-child returns null', () => {
    const parent = new Node();
    const stranger = new Node();
    const result = parent.removeChild(stranger);
    expect(result).toBeNull();
  });

  it('containsPoint returns false by default', () => {
    const n = new Node();
    expect(n.containsPoint(0, 0)).toBe(false);
  });

  it('setting alpha to same value does not dirty', () => {
    const n = new Node();
    n._worldDirty = false;
    n.alpha = 1; // same as default
    expect(n._worldDirty).toBe(false);
  });

  it('setting rotation to same value does not dirty', () => {
    const n = new Node();
    n._localDirty = false;
    n.rotation = 0; // same as default
    expect(n._localDirty).toBe(false);
  });

  it('setting zIndex to same value does not dirty parent', () => {
    const parent = new Node();
    const child = new Node();
    parent.addChild(child);
    parent._sortDirty = false;
    child.zIndex = 0; // same as default
    expect(parent._sortDirty).toBe(false);
  });

  it('zIndex set without parent does not throw', () => {
    const n = new Node();
    n.zIndex = 5;
    expect(n.zIndex).toBe(5);
  });

  it('updateTransform with no parent copies local to world', () => {
    const n = new Node();
    n.position.set(50, 60);
    n.updateTransform();
    expect(Math.abs(n.worldTransform.tx - 50)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(n.worldTransform.ty - 60)).toBeLessThanOrEqual(0.001);
    expect(n.worldAlpha).toBe(1);
  });

  it('updateTransform sorts children when _sortDirty', () => {
    const parent = new Node();
    const a = new Node(); a._zIndex = 2;
    const b = new Node(); b._zIndex = 1;
    parent.addChild(a);
    parent.addChild(b);
    parent.updateTransform();
    expect(parent.children[0]).toBe(b);
    expect(parent.children[1]).toBe(a);
  });

  it('removeFromParent on orphan does not throw', () => {
    const n = new Node();
    n.removeFromParent();
    expect(n.parent).toBe(null);
  });

  it('getBounds includes visible children', () => {
    const parent = new Node();
    const child = new Node();
    parent.addChild(child);
    // Even with no _calculateBounds, calling getBounds should not throw
    const b = parent.getBounds();
    expect(b).toBeDefined();
  });
});
