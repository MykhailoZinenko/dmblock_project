export class BaseTexture {
  constructor(gpuTexture, gpuSampler, width, height) {
    this.gpuTexture = gpuTexture;
    this.gpuSampler = gpuSampler;
    this.width = width;
    this.height = height;
    this.destroyed = false;
  }

  destroy() {
    if (this.gpuTexture) this.gpuTexture.destroy();
    this.gpuTexture = null;
    this.gpuSampler = null;
    this.destroyed = true;
  }
}
