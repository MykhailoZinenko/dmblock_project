import { BaseTexture } from './BaseTexture.js';
import { Texture } from './Texture.js';

export interface AtlasEntry {
  key: string;
  bitmap: ImageBitmap;
}

interface Placement {
  key: string;
  bitmap: ImageBitmap;
  x: number;
  y: number;
}

class ShelfPacker {
  private _maxSize: number;
  private _shelfY: number;
  private _shelfX: number;
  private _shelfHeight: number;
  public usedWidth: number;
  public usedHeight: number;
  public placements: Placement[];

  constructor(maxSize: number) {
    this._maxSize = maxSize;
    this._shelfY = 0;
    this._shelfX = 0;
    this._shelfHeight = 0;
    this.usedWidth = 0;
    this.usedHeight = 0;
    this.placements = [];
  }

  tryAdd(entry: AtlasEntry): boolean {
    const w: number = entry.bitmap.width;
    const h: number = entry.bitmap.height;
    const padding: number = 1;

    if (w + padding > this._maxSize || h + padding > this._maxSize) return false;

    if (this._shelfX + w + padding > this._maxSize) {
      this._shelfY += this._shelfHeight + padding;
      this._shelfX = 0;
      this._shelfHeight = 0;
    }

    if (this._shelfY + h + padding > this._maxSize) return false;

    this.placements.push({
      key: entry.key,
      bitmap: entry.bitmap,
      x: this._shelfX,
      y: this._shelfY,
    });

    this._shelfX += w + padding;
    this._shelfHeight = Math.max(this._shelfHeight, h);
    this.usedWidth = Math.max(this.usedWidth, this._shelfX);
    this.usedHeight = Math.max(this.usedHeight, this._shelfY + this._shelfHeight);

    return true;
  }
}

export class AtlasPacker {
  static pack(device: GPUDevice, entries: AtlasEntry[], maxSize?: number): Map<string, Texture> {
    if (!maxSize) maxSize = device.limits.maxTextureDimension2D || 2048;
    const sorted: AtlasEntry[] = entries.slice().sort((a: AtlasEntry, b: AtlasEntry) => b.bitmap.height - a.bitmap.height);

    const atlases: ShelfPacker[] = [];
    let current: ShelfPacker | null = null;

    for (const entry of sorted) {
      if (!current || !current.tryAdd(entry)) {
        current = new ShelfPacker(maxSize);
        atlases.push(current);
        if (!current.tryAdd(entry)) {
          throw new Error(`Image "${entry.key}" (${entry.bitmap.width}x${entry.bitmap.height}) exceeds max atlas size ${maxSize}`);
        }
      }
    }

    const results: Map<string, Texture> = new Map();

    for (const packer of atlases) {
      const w: number = packer.usedWidth;
      const h: number = packer.usedHeight;

      const canvas: OffscreenCanvas = new OffscreenCanvas(w, h);
      const ctx: OffscreenCanvasRenderingContext2D = canvas.getContext('2d')!;

      for (const placed of packer.placements) {
        ctx.drawImage(placed.bitmap, placed.x, placed.y);
      }

      const gpuTexture: GPUTexture = device.createTexture({
        size: [w, h],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const imageBitmap: ImageBitmap = canvas.transferToImageBitmap();
      device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: gpuTexture },
        [w, h],
      );
      imageBitmap.close();

      const gpuSampler: GPUSampler = device.createSampler({
        minFilter: 'linear',
        magFilter: 'nearest',
      });

      const baseTexture: BaseTexture = new BaseTexture(gpuTexture, gpuSampler, w, h);

      for (const placed of packer.placements) {
        results.set(placed.key, new Texture(baseTexture, {
          x: placed.x,
          y: placed.y,
          width: placed.bitmap.width,
          height: placed.bitmap.height,
        }));
      }
    }

    return results;
  }
}
