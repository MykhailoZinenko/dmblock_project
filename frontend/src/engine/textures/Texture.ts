import { BaseTexture } from './BaseTexture.js';

export interface TextureFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextureUVs {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class Texture {
  public baseTexture: BaseTexture;
  public frame: TextureFrame;
  public uvs: TextureUVs;

  static EMPTY: Texture = new Texture(new BaseTexture(null, null, 1, 1));

  static createEmpty(device: GPUDevice): void {
    const gpuTexture: GPUTexture = device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture: gpuTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1],
    );
    const gpuSampler: GPUSampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });
    Texture.EMPTY = new Texture(new BaseTexture(gpuTexture, gpuSampler, 1, 1));
  }

  constructor(baseTexture: BaseTexture, frame?: TextureFrame) {
    this.baseTexture = baseTexture;
    this.frame = frame ?? { x: 0, y: 0, width: baseTexture.width, height: baseTexture.height };
    this.uvs = { x0: 0, y0: 0, x1: 0, y1: 0 };
    this._updateUVs();
  }

  get width(): number { return this.frame.width; }
  get height(): number { return this.frame.height; }

  _updateUVs(): void {
    const { x, y, width, height } = this.frame;
    const bw: number = this.baseTexture.width;
    const bh: number = this.baseTexture.height;
    this.uvs = {
      x0: x / bw,
      y0: y / bh,
      x1: (x + width) / bw,
      y1: (y + height) / bh,
    };
  }
}
