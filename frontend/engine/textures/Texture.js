import { BaseTexture } from './BaseTexture.js';

export class Texture {
  constructor(baseTexture, frame) {
    this.baseTexture = baseTexture;
    this.frame = frame ?? { x: 0, y: 0, width: baseTexture.width, height: baseTexture.height };
    this.uvs = {};
    this._updateUVs();
  }

  get width() { return this.frame.width; }
  get height() { return this.frame.height; }

  _updateUVs() {
    const { x, y, width, height } = this.frame;
    const bw = this.baseTexture.width;
    const bh = this.baseTexture.height;
    this.uvs = {
      x0: x / bw,
      y0: y / bh,
      x1: (x + width) / bw,
      y1: (y + height) / bh,
    };
  }
}

Texture.EMPTY = new Texture(new BaseTexture(null, null, 1, 1));

Texture.createEmpty = function (device) {
  const gpuTexture = device.createTexture({
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
  const gpuSampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });
  Texture.EMPTY = new Texture(new BaseTexture(gpuTexture, gpuSampler, 1, 1));
};
