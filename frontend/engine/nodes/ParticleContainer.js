import { Node } from './Node.js';
import { BLEND_MODES } from '../render/BlendMode.js';

const FLOATS_PER_INSTANCE = 14;

export class ParticleContainer extends Node {
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

  addParticle(particle) {
    if (!particle.texture) return;
    if (!this._baseTexture) {
      this._baseTexture = particle.texture.baseTexture;
    }
    this._particles.push(particle);
    this._dirty = true;
  }

  removeParticle(particle) {
    const idx = this._particles.indexOf(particle);
    if (idx !== -1) {
      this._particles.splice(idx, 1);
      this._dirty = true;
    }
  }

  destroy() {
    if (this._gpuInstanceBuffer) { this._gpuInstanceBuffer.destroy(); this._gpuInstanceBuffer = null; }
    if (this._gpuQuadBuffer) { this._gpuQuadBuffer.destroy(); this._gpuQuadBuffer = null; }
    if (this._gpuQuadIndexBuffer) { this._gpuQuadIndexBuffer.destroy(); this._gpuQuadIndexBuffer = null; }
    this._particles = [];
    super.destroy();
  }

  _rebuild() {
    const count = this._particles.length;
    if (count === 0) {
      this._instanceData = null;
      this._dirty = false;
      return;
    }

    if (!this._instanceData || this._instanceData.length !== count * FLOATS_PER_INSTANCE) {
      this._instanceData = new Float32Array(count * FLOATS_PER_INSTANCE);
    }

    const data = this._instanceData;
    for (let i = 0; i < count; i++) {
      const p = this._particles[i];
      const off = i * 14;
      const rot = p.rotation || 0;
      const sinR = Math.sin(rot);
      const cosR = Math.cos(rot);
      const tint = p.tint !== undefined ? p.tint : 0xFFFFFF;
      const r = ((tint >> 16) & 0xFF) / 255;
      const g = ((tint >> 8) & 0xFF) / 255;
      const b = (tint & 0xFF) / 255;
      const alpha = p.alpha !== undefined ? p.alpha : 1;
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

  _calculateBounds() {
    for (const p of this._particles) {
      const x = p.x || 0;
      const y = p.y || 0;
      const hw = (p.scaleX !== undefined ? p.scaleX : 1) * p.texture.width * 0.5;
      const hh = (p.scaleY !== undefined ? p.scaleY : 1) * p.texture.height * 0.5;
      this._bounds.addPoint(x - hw, y - hh);
      this._bounds.addPoint(x + hw, y + hh);
    }
  }
}
