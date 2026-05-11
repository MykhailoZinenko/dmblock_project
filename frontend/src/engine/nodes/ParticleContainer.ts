import { Node } from './Node.js';
import { BLEND_MODES } from '../render/BlendMode.js';
import type { BlendMode } from '../render/BlendMode.js';
import type { Texture } from '../textures/Texture.js';
import type { BaseTexture } from '../textures/BaseTexture.js';

export interface Particle {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  tint?: number;
  alpha?: number;
  texture: Texture;
}

const FLOATS_PER_INSTANCE: number = 14;

export class ParticleContainer extends Node {
  public _particles: Particle[];
  public _baseTexture: BaseTexture | null;
  public _instanceData: Float32Array | null;
  public _dirty: boolean;
  public blendMode: BlendMode;
  public _gpuInstanceBuffer: GPUBuffer | null;
  public _gpuQuadBuffer: GPUBuffer | null;
  public _gpuQuadIndexBuffer: GPUBuffer | null;

  constructor() {
    super();
    this._particles = [];
    this._baseTexture = null;
    this._instanceData = null;
    this._dirty = true;
    this.blendMode = BLEND_MODES.NORMAL;
    this._gpuInstanceBuffer = null;
    this._gpuQuadBuffer = null;
    this._gpuQuadIndexBuffer = null;
  }

  addParticle(particle: Particle): void {
    if (!particle.texture) return;
    if (!this._baseTexture) {
      this._baseTexture = particle.texture.baseTexture;
    }
    this._particles.push(particle);
    this._dirty = true;
  }

  removeParticle(particle: Particle): void {
    const idx: number = this._particles.indexOf(particle);
    if (idx !== -1) {
      this._particles.splice(idx, 1);
      this._dirty = true;
    }
  }

  destroy(): void {
    if (this._gpuInstanceBuffer) { this._gpuInstanceBuffer.destroy(); this._gpuInstanceBuffer = null; }
    if (this._gpuQuadBuffer) { this._gpuQuadBuffer.destroy(); this._gpuQuadBuffer = null; }
    if (this._gpuQuadIndexBuffer) { this._gpuQuadIndexBuffer.destroy(); this._gpuQuadIndexBuffer = null; }
    this._particles = [];
    super.destroy();
  }

  _rebuild(): void {
    const count: number = this._particles.length;
    if (count === 0) {
      this._instanceData = null;
      this._dirty = false;
      return;
    }

    if (!this._instanceData || this._instanceData.length !== count * FLOATS_PER_INSTANCE) {
      this._instanceData = new Float32Array(count * FLOATS_PER_INSTANCE);
    }

    const data: Float32Array = this._instanceData;
    for (let i = 0; i < count; i++) {
      const p: Particle = this._particles[i];
      const off: number = i * 14;
      const rot: number = p.rotation || 0;
      const sinR: number = Math.sin(rot);
      const cosR: number = Math.cos(rot);
      const tint: number = p.tint !== undefined ? p.tint : 0xFFFFFF;
      const r: number = ((tint >> 16) & 0xFF) / 255;
      const g: number = ((tint >> 8) & 0xFF) / 255;
      const b: number = (tint & 0xFF) / 255;
      const alpha: number = p.alpha !== undefined ? p.alpha : 1;
      const uvs = p.texture.uvs;

      data[off]     = p.x || 0;
      data[off + 1] = p.y || 0;
      data[off + 2] = p.scaleX !== undefined ? p.scaleX * p.texture.width : p.texture.width;
      data[off + 3] = p.scaleY !== undefined ? p.scaleY * p.texture.height : p.texture.height;
      data[off + 4] = sinR;
      data[off + 5] = cosR;
      data[off + 6] = r;
      data[off + 7] = g;
      data[off + 8] = b;
      data[off + 9] = alpha;
      data[off + 10] = uvs.x0;
      data[off + 11] = uvs.y0;
      data[off + 12] = uvs.x1;
      data[off + 13] = uvs.y1;
    }

    this._dirty = false;
  }

  _calculateBounds(): void {
    for (const p of this._particles) {
      const x: number = p.x || 0;
      const y: number = p.y || 0;
      const hw: number = (p.scaleX !== undefined ? p.scaleX : 1) * p.texture.width * 0.5;
      const hh: number = (p.scaleY !== undefined ? p.scaleY : 1) * p.texture.height * 0.5;
      this._bounds.addPoint(x - hw, y - hh);
      this._bounds.addPoint(x + hw, y + hh);
    }
  }
}
