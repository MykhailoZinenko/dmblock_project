import { describe, it, expect } from 'vitest';
import { BaseTexture } from '../textures/BaseTexture.js';
import { Texture } from '../textures/Texture.js';

describe('Texture', () => {
  it('Texture.EMPTY has 1x1 dimensions', () => {
    expect(Texture.EMPTY.width).toBe(1);
    expect(Texture.EMPTY.height).toBe(1);
  });

  it('Texture from BaseTexture uses full frame', () => {
    const base = new BaseTexture(null, null, 256, 128);
    const tex = new Texture(base);
    expect(tex.frame.x).toBe(0);
    expect(tex.frame.y).toBe(0);
    expect(tex.frame.width).toBe(256);
    expect(tex.frame.height).toBe(128);
    expect(tex.width).toBe(256);
    expect(tex.height).toBe(128);
  });

  it('Texture with custom frame', () => {
    const base = new BaseTexture(null, null, 512, 512);
    const tex = new Texture(base, { x: 64, y: 32, width: 100, height: 80 });
    expect(tex.width).toBe(100);
    expect(tex.height).toBe(80);
  });

  it('UVs computed correctly from frame and base dimensions', () => {
    const base = new BaseTexture(null, null, 512, 256);
    const tex = new Texture(base, { x: 128, y: 64, width: 128, height: 64 });
    expect(Math.abs(tex.uvs.x0 - 128 / 512)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(tex.uvs.y0 - 64 / 256)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(tex.uvs.x1 - (128 + 128) / 512)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(tex.uvs.y1 - (64 + 64) / 256)).toBeLessThanOrEqual(0.0001);
  });

  it('BaseTexture.destroy() sets destroyed flag', () => {
    const mockTex = { destroy: () => {} } as unknown as GPUTexture;
    const base = new BaseTexture(mockTex, null, 64, 64);
    expect(base.destroyed).toBe(false);
    base.destroy();
    expect(base.destroyed).toBe(true);
    expect(base.gpuTexture).toBe(null);
    expect(base.gpuSampler).toBe(null);
  });
});
