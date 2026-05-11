import { describe, it, assertEqual, assertApprox } from '../harness.js';
import { BaseTexture } from '../../src/engine/textures/BaseTexture.js';
import { Texture } from '../../src/engine/textures/Texture.js';
import { SpriteSheet } from '../../src/engine/textures/SpriteSheet.js';

describe('SpriteSheet', () => {
  it('fromStrip splits horizontal strip into correct number of frames', () => {
    const base = new BaseTexture(null, null, 1152, 192);
    const tex = new Texture(base);
    const frames = SpriteSheet.fromStrip(tex, 192);
    assertEqual(frames.length, 6);
  });

  it('all frames share the same baseTexture', () => {
    const base = new BaseTexture(null, null, 1152, 192);
    const tex = new Texture(base);
    const frames = SpriteSheet.fromStrip(tex, 192);
    for (const frame of frames) {
      assertEqual(frame.baseTexture, base);
    }
  });

  it('works with sub-region texture (atlas support)', () => {
    const base = new BaseTexture(null, null, 2048, 2048);
    const region = new Texture(base, { x: 100, y: 200, width: 768, height: 192 });
    const frames = SpriteSheet.fromStrip(region, 256);
    assertEqual(frames.length, 3);
    assertEqual(frames[0].frame.x, 100);
    assertEqual(frames[0].frame.y, 200);
    assertEqual(frames[1].frame.x, 356);
    assertEqual(frames[1].frame.y, 200);
    assertEqual(frames[2].frame.x, 612);
    assertEqual(frames[2].frame.y, 200);
  });

  it('frameHeight override works', () => {
    const base = new BaseTexture(null, null, 600, 200);
    const tex = new Texture(base);
    const frames = SpriteSheet.fromStrip(tex, 100, 150);
    assertEqual(frames.length, 6);
    assertEqual(frames[0].frame.height, 150);
    assertEqual(frames[0].height, 150);
  });
});
