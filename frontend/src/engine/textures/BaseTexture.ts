export class BaseTexture {
  public gpuTexture: GPUTexture | null;
  public gpuSampler: GPUSampler | null;
  public width: number;
  public height: number;
  public destroyed: boolean;

  constructor(gpuTexture: GPUTexture | null, gpuSampler: GPUSampler | null, width: number, height: number) {
    this.gpuTexture = gpuTexture;
    this.gpuSampler = gpuSampler;
    this.width = width;
    this.height = height;
    this.destroyed = false;
  }

  destroy(): void {
    if (this.gpuTexture) this.gpuTexture.destroy();
    this.gpuTexture = null;
    this.gpuSampler = null;
    this.destroyed = true;
  }
}
