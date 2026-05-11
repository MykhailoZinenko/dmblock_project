import { describe, it, assert, assertEqual, assertApprox } from '../harness.js';
import { Node } from '../../engine/nodes/Node.js';
import { Sprite } from '../../engine/nodes/Sprite.js';
import { Texture } from '../../engine/textures/Texture.js';
import { BaseTexture } from '../../engine/textures/BaseTexture.js';

function makeTexture(w: number, h: number): Texture {
  return new Texture(new BaseTexture(null, null, w, h));
}

describe('Sprite', () => {
  it('is a Node', () => {
    const s = new Sprite();
    assert(s instanceof Node);
  });

  it('defaults to Texture.EMPTY', () => {
    const s = new Sprite();
    assertEqual(s.texture, Texture.EMPTY);
  });

  it('accepts texture in constructor', () => {
    const tex = makeTexture(64, 64);
    const s = new Sprite(tex);
    assertEqual(s.texture, tex);
  });

  it('anchor defaults to 0,0', () => {
    const s = new Sprite();
    assertEqual(s.anchor.x, 0);
    assertEqual(s.anchor.y, 0);
  });

  it('width and height reflect texture dimensions times scale', () => {
    const s = new Sprite(makeTexture(100, 50));
    assertEqual(s.width, 100);
    assertEqual(s.height, 50);
    s.scale.set(2, 3);
    assertEqual(s.width, 200);
    assertEqual(s.height, 150);
  });

  it('width setter adjusts scale.x', () => {
    const s = new Sprite(makeTexture(100, 50));
    s.width = 200;
    assertApprox(s.scale.x, 2);
  });

  it('height setter adjusts scale.y', () => {
    const s = new Sprite(makeTexture(100, 50));
    s.height = 100;
    assertApprox(s.scale.y, 2);
  });

  it('tint defaults to 0xFFFFFF', () => {
    const s = new Sprite();
    assertEqual(s.tint, 0xFFFFFF);
  });

  it('containsPoint detects inside sprite quad', () => {
    const s = new Sprite(makeTexture(100, 100));
    s.position.set(50, 50);
    s.updateTransform();
    assert(s.containsPoint(75, 75));
    assert(!s.containsPoint(200, 200));
  });

  it('containsPoint works with center anchor', () => {
    const s = new Sprite(makeTexture(100, 100));
    s.anchor.set(0.5, 0.5);
    s.position.set(50, 50);
    s.updateTransform();
    assert(s.containsPoint(50, 50));
    assert(s.containsPoint(0, 0));
    assert(!s.containsPoint(-1, -1));
  });

  it('getBounds returns correct world-space bounds', () => {
    const s = new Sprite(makeTexture(100, 50));
    s.position.set(10, 20);
    s.updateTransform();
    const b = s.getBounds();
    assertApprox(b.minX, 10);
    assertApprox(b.minY, 20);
    assertApprox(b.maxX, 110);
    assertApprox(b.maxY, 70);
  });
});
