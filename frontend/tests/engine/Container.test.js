import { describe, it, assert } from '../harness.js';
import { Container } from '../../src/engine/nodes/Container.js';
import { Node } from '../../src/engine/nodes/Node.js';

describe('Container', () => {
  it('is a Node (instanceof)', () => {
    const c = new Container();
    assert(c instanceof Node);
  });

  it('can nest containers', () => {
    const root  = new Container();
    const child = new Container();
    const leaf  = new Container();
    root.addChild(child);
    child.addChild(leaf);
    assert(child.parent === root);
    assert(leaf.parent === child);
    assert(root.children.length === 1);
    assert(child.children.length === 1);
  });

  it('getBounds is empty for empty container', () => {
    const c = new Container();
    const b = c.getBounds();
    assert(b.minX === Infinity);
    assert(b.minY === Infinity);
    assert(b.maxX === -Infinity);
    assert(b.maxY === -Infinity);
  });
});
