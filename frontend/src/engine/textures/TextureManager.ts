import { BaseTexture } from './BaseTexture.js';
import { Texture } from './Texture.js';

export class TextureManager {
  private _device: GPUDevice;
  private _cache: Map<string, Texture>;

  constructor(device: GPUDevice) {
    this._device = device;
    this._cache = new Map();
  }

  async load(key: string, url: string): Promise<Texture> {
    if (this._cache.has(key)) return this._cache.get(key)!;

    const response: Response = await fetch(url);
    const blob: Blob = await response.blob();
    const bitmap: ImageBitmap = await createImageBitmap(blob);

    const gpuTexture: GPUTexture = this._device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this._device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: gpuTexture },
      [bitmap.width, bitmap.height],
    );

    const gpuSampler: GPUSampler = this._device.createSampler({
      minFilter: 'linear',
      magFilter: 'nearest',
    });

    const baseTexture: BaseTexture = new BaseTexture(gpuTexture, gpuSampler, bitmap.width, bitmap.height);
    const texture: Texture = new Texture(baseTexture);
    this._cache.set(key, texture);
    bitmap.close();
    return texture;
  }

  get(key: string): Texture {
    return this._cache.get(key) || Texture.EMPTY;
  }

  has(key: string): boolean {
    return this._cache.has(key);
  }

  unload(key: string): void {
    const texture: Texture | undefined = this._cache.get(key);
    if (texture) {
      texture.baseTexture.destroy();
      this._cache.delete(key);
    }
  }

  destroyAll(): void {
    for (const texture of this._cache.values()) {
      texture.baseTexture.destroy();
    }
    this._cache.clear();
  }
}
