import { describe, it, assertEqual, assertApprox } from '../harness.js';
import { Node } from '../../engine/nodes/Node.js';

describe('Node', () => {
  it('default position is 0,0', () => {
    const n = new Node();
    assertEqual(n.position.x, 0);
    assertEqual(n.position.y, 0);
  });

  it('default scale is 1,1', () => {
    const n = new Node();
    assertEqual(n.scale.x, 1);
    assertEqual(n.scale.y, 1);
  });

  it('addChild sets parent', () => {
    const parent = new Node();
    const child  = new Node();
    parent.addChild(child);
    assertEqual(child.parent, parent);
  });

  it('addChild removes child from previous parent', () => {
    const a = new Node();
    const b = new Node();
    const child = new Node();
    a.addChild(child);
    b.addChild(child);
    assertEqual(child.parent, b);
    assertEqual(a.children.length, 0);
    assertEqual(b.children.length, 1);
  });

  it('removeChild nulls parent', () => {
    const parent = new Node();
    const child  = new Node();
    parent.addChild(child);
    parent.removeChild(child);
    assertEqual(child.parent, null);
    assertEqual(parent.children.length, 0);
  });

  it('addChildAt inserts at index', () => {
    const parent = new Node();
    const a = new Node();
    const b = new Node();
    const c = new Node();
    parent.addChild(a);
    parent.addChild(b);
    parent.addChildAt(c, 1);
    assertEqual(parent.children[0], a);
    assertEqual(parent.children[1], c);
    assertEqual(parent.children[2], b);
  });

  it('removeFromParent works', () => {
    const parent = new Node();
    const child  = new Node();
    parent.addChild(child);
    child.removeFromParent();
    assertEqual(child.parent, null);
    assertEqual(parent.children.length, 0);
  });

  it('setting position.x marks _localDirty', () => {
    const n = new Node();
    n._localDirty = false;
    n.position.x = 42;
    assertEqual(n._localDirty, true);
  });

  it('setting scale marks _localDirty', () => {
    const n = new Node();
    n._localDirty = false;
    n.scale.x = 2;
    assertEqual(n._localDirty, true);
  });

  it('setting rotation marks _localDirty', () => {
    const n = new Node();
    n._localDirty = false;
    n.rotation = Math.PI / 4;
    assertEqual(n._localDirty, true);
  });

  it('updateTransform computes worldTransform from parent', () => {
    const parent = new Node();
    const child  = new Node();
    parent.position.set(100, 200);
    child.position.set(10, 20);
    parent.addChild(child);
    parent.updateTransform();
    assertApprox(child.worldTransform.tx, 110);
    assertApprox(child.worldTransform.ty, 220);
  });

  it('worldAlpha multiplies through hierarchy', () => {
    const parent = new Node();
    const child  = new Node();
    parent.alpha = 0.5;
    child.alpha  = 0.5;
    parent.addChild(child);
    parent.updateTransform();
    assertApprox(child.worldAlpha, 0.25);
  });

  it('zIndex change sets parent._sortDirty', () => {
    const parent = new Node();
    const child  = new Node();
    parent.addChild(child);
    parent._sortDirty = false;
    child.zIndex = 5;
    assertEqual(parent._sortDirty, true);
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
    assertEqual(parent.children[0], b);
    assertEqual(parent.children[1], c);
    assertEqual(parent.children[2], a);
  });

  it('EventEmitter on/emit works on Node', () => {
    const n = new Node();
    let received: unknown = null;
    n.on('test', (d: unknown) => { received = d; });
    n.emit('test', 99);
    assertEqual(received, 99);
  });

  it('getBounds returns empty for bare Node', () => {
    const n = new Node();
    const b = n.getBounds();
    assertEqual(b.minX, Infinity);
    assertEqual(b.minY, Infinity);
    assertEqual(b.maxX, -Infinity);
    assertEqual(b.maxY, -Infinity);
  });
});
