import { describe, it, expect } from 'vitest';
import { BaseTexture } from '../textures/BaseTexture.js';
import { Texture } from '../textures/Texture.js';
import { SpriteSheet } from '../textures/SpriteSheet.js';

describe('SpriteSheet', () => {
  it('fromStrip splits horizontal strip into correct number of frames', () => {
    const base = new BaseTexture(null, null, 1152, 192);
    const tex = new Texture(base);
    const frames = SpriteSheet.fromStrip(tex, 192);
    expect(frames.length).toBe(6);
  });

  it('all frames share the same baseTexture', () => {
    const base = new BaseTexture(null, null, 1152, 192);
    const tex = new Texture(base);
    const frames = SpriteSheet.fromStrip(tex, 192);
    for (const frame of frames) {
      expect(frame.baseTexture).toBe(base);
    }
  });

  it('works with sub-region texture (atlas support)', () => {
    const base = new BaseTexture(null, null, 2048, 2048);
    const region = new Texture(base, { x: 100, y: 200, width: 768, height: 192 });
    const frames = SpriteSheet.fromStrip(region, 256);
    expect(frames.length).toBe(3);
    expect(frames[0].frame.x).toBe(100);
    expect(frames[0].frame.y).toBe(200);
    expect(frames[1].frame.x).toBe(356);
    expect(frames[1].frame.y).toBe(200);
    expect(frames[2].frame.x).toBe(612);
    expect(frames[2].frame.y).toBe(200);
  });

  it('frameHeight override works', () => {
    const base = new BaseTexture(null, null, 600, 200);
    const tex = new Texture(base);
    const frames = SpriteSheet.fromStrip(tex, 100, 150);
    expect(frames.length).toBe(6);
    expect(frames[0].frame.height).toBe(150);
    expect(frames[0].height).toBe(150);
  });

  it('fromGridRow extracts row from grid', () => {
    const base = new BaseTexture(null, null, 256, 256);
    const tex = new Texture(base);
    const frames = SpriteSheet.fromGridRow(tex, 64, 64, 1);
    expect(frames.length).toBe(4);
    expect(frames[0].frame.x).toBe(0);
    expect(frames[0].frame.y).toBe(64);
    expect(frames[1].frame.x).toBe(64);
  });

  it('fromGridRow with explicit colCount limits columns', () => {
    const base = new BaseTexture(null, null, 256, 256);
    const tex = new Texture(base);
    const frames = SpriteSheet.fromGridRow(tex, 64, 64, 0, 2);
    expect(frames.length).toBe(2);
  });

  it('fromGridRow with sub-region texture offsets correctly', () => {
    const base = new BaseTexture(null, null, 2048, 2048);
    const region = new Texture(base, { x: 100, y: 200, width: 192, height: 192 });
    const frames = SpriteSheet.fromGridRow(region, 64, 64, 1, 3);
    expect(frames.length).toBe(3);
    expect(frames[0].frame.x).toBe(100);
    expect(frames[0].frame.y).toBe(264);
  });
});
