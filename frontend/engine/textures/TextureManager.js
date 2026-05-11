import { BaseTexture } from './BaseTexture.js';
import { Texture } from './Texture.js';

export class TextureManager {
  constructor(device) {
    this._device = device;
    this._cache = new Map();
  }

  async load(key, url) {
    if (this._cache.has(key)) return this._cache.get(key);

    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const gpuTexture = this._device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this._device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: gpuTexture },
      [bitmap.width, bitmap.height],
    );

    const gpuSampler = this._device.createSampler({
      minFilter: 'linear',
      magFilter: 'nearest',
    });

    const baseTexture = new BaseTexture(gpuTexture, gpuSampler, bitmap.width, bitmap.height);
    const texture = new Texture(baseTexture);
    this._cache.set(key, texture);
    bitmap.close();
    return texture;
  }

  get(key) {
    return this._cache.get(key) || Texture.EMPTY;
  }

  has(key) {
    return this._cache.has(key);
  }

  unload(key) {
    const texture = this._cache.get(key);
    if (texture) {
      texture.baseTexture.destroy();
      this._cache.delete(key);
    }
  }

  destroyAll() {
    for (const texture of this._cache.values()) {
      texture.baseTexture.destroy();
    }
    this._cache.clear();
  }
}
