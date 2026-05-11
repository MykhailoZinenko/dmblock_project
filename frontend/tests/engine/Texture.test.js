import { describe, it, assertEqual, assertApprox } from '../harness.js';
import { BaseTexture } from '../../src/engine/textures/BaseTexture.js';
import { Texture } from '../../src/engine/textures/Texture.js';

describe('Texture', () => {
  it('Texture.EMPTY has 1x1 dimensions', () => {
    assertEqual(Texture.EMPTY.width, 1);
    assertEqual(Texture.EMPTY.height, 1);
  });

  it('Texture from BaseTexture uses full frame', () => {
    const base = new BaseTexture(null, null, 256, 128);
    const tex = new Texture(base);
    assertEqual(tex.frame.x, 0);
    assertEqual(tex.frame.y, 0);
    assertEqual(tex.frame.width, 256);
    assertEqual(tex.frame.height, 128);
    assertEqual(tex.width, 256);
    assertEqual(tex.height, 128);
  });

  it('Texture with custom frame', () => {
    const base = new BaseTexture(null, null, 512, 512);
    const tex = new Texture(base, { x: 64, y: 32, width: 100, height: 80 });
    assertEqual(tex.width, 100);
    assertEqual(tex.height, 80);
  });

  it('UVs computed correctly from frame and base dimensions', () => {
    const base = new BaseTexture(null, null, 512, 256);
    const tex = new Texture(base, { x: 128, y: 64, width: 128, height: 64 });
    assertApprox(tex.uvs.x0, 128 / 512);
    assertApprox(tex.uvs.y0, 64 / 256);
    assertApprox(tex.uvs.x1, (128 + 128) / 512);
    assertApprox(tex.uvs.y1, (64 + 64) / 256);
  });

  it('BaseTexture.destroy() sets destroyed flag', () => {
    const mockTex = { destroy: () => {} };
    const base = new BaseTexture(mockTex, null, 64, 64);
    assertEqual(base.destroyed, false);
    base.destroy();
    assertEqual(base.destroyed, true);
    assertEqual(base.gpuTexture, null);
    assertEqual(base.gpuSampler, null);
  });
});
