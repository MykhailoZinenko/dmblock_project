import { describe, it, expect } from 'vitest';
import { Container } from '../nodes/Container.js';
import { Node } from '../nodes/Node.js';

describe('Container', () => {
  it('is a Node (instanceof)', () => {
    const c = new Container();
    expect(c instanceof Node).toBeTruthy();
  });

  it('can nest containers', () => {
    const root  = new Container();
    const child = new Container();
    const leaf  = new Container();
    root.addChild(child);
    child.addChild(leaf);
    expect(child.parent === root).toBeTruthy();
    expect(leaf.parent === child).toBeTruthy();
    expect(root.children.length === 1).toBeTruthy();
    expect(child.children.length === 1).toBeTruthy();
  });

  it('getBounds is empty for empty container', () => {
    const c = new Container();
    const b = c.getBounds();
    expect(b.minX === Infinity).toBeTruthy();
    expect(b.minY === Infinity).toBeTruthy();
    expect(b.maxX === -Infinity).toBeTruthy();
    expect(b.maxY === -Infinity).toBeTruthy();
  });
});
