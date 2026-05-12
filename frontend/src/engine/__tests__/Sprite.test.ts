import { describe, it, expect } from 'vitest';
import { Node } from '../nodes/Node.js';
import { Sprite } from '../nodes/Sprite.js';
import { Texture } from '../textures/Texture.js';
import { BaseTexture } from '../textures/BaseTexture.js';

function makeTexture(w: number, h: number): Texture {
  return new Texture(new BaseTexture(null, null, w, h));
}

describe('Sprite', () => {
  it('is a Node', () => {
    const s = new Sprite();
    expect(s instanceof Node).toBeTruthy();
  });

  it('defaults to Texture.EMPTY', () => {
    const s = new Sprite();
    expect(s.texture).toBe(Texture.EMPTY);
  });

  it('accepts texture in constructor', () => {
    const tex = makeTexture(64, 64);
    const s = new Sprite(tex);
    expect(s.texture).toBe(tex);
  });

  it('anchor defaults to 0,0', () => {
    const s = new Sprite();
    expect(s.anchor.x).toBe(0);
    expect(s.anchor.y).toBe(0);
  });

  it('width and height reflect texture dimensions times scale', () => {
    const s = new Sprite(makeTexture(100, 50));
    expect(s.width).toBe(100);
    expect(s.height).toBe(50);
    s.scale.set(2, 3);
    expect(s.width).toBe(200);
    expect(s.height).toBe(150);
  });

  it('width setter adjusts scale.x', () => {
    const s = new Sprite(makeTexture(100, 50));
    s.width = 200;
    expect(Math.abs(s.scale.x - 2)).toBeLessThanOrEqual(0.0001);
  });

  it('height setter adjusts scale.y', () => {
    const s = new Sprite(makeTexture(100, 50));
    s.height = 100;
    expect(Math.abs(s.scale.y - 2)).toBeLessThanOrEqual(0.0001);
  });

  it('tint defaults to 0xFFFFFF', () => {
    const s = new Sprite();
    expect(s.tint).toBe(0xFFFFFF);
  });

  it('containsPoint detects inside sprite quad', () => {
    const s = new Sprite(makeTexture(100, 100));
    s.position.set(50, 50);
    s.updateTransform();
    expect(s.containsPoint(75, 75)).toBeTruthy();
    expect(s.containsPoint(200, 200)).toBeFalsy();
  });

  it('containsPoint works with center anchor', () => {
    const s = new Sprite(makeTexture(100, 100));
    s.anchor.set(0.5, 0.5);
    s.position.set(50, 50);
    s.updateTransform();
    expect(s.containsPoint(50, 50)).toBeTruthy();
    expect(s.containsPoint(0, 0)).toBeTruthy();
    expect(s.containsPoint(-1, -1)).toBeFalsy();
  });

  it('getBounds returns correct world-space bounds', () => {
    const s = new Sprite(makeTexture(100, 50));
    s.position.set(10, 20);
    s.updateTransform();
    const b = s.getBounds();
    expect(Math.abs(b.minX - 10)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(b.minY - 20)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(b.maxX - 110)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(b.maxY - 70)).toBeLessThanOrEqual(0.0001);
  });
});
