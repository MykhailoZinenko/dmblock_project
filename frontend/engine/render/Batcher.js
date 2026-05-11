import { BLEND_MODES } from './BlendMode.js';

const MAX_QUADS = 8192;
const FLOATS_PER_VERTEX = 8;
const VERTICES_PER_QUAD = 4;
const INDICES_PER_QUAD = 6;

export class Batcher {
  constructor(device) {
    this._device = device;
    this._vertexData = new Float32Array(MAX_QUADS * VERTICES_PER_QUAD * FLOATS_PER_VERTEX);
    const bufSize = this._vertexData.byteLength;
    this._vertexBuffers = [
      device.createBuffer({ size: bufSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }),
      device.createBuffer({ size: bufSize, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }),
    ];
    this._bufferIndex = 0;
    this._indexBuffer = this._createIndexBuffer(device);
    this._bindGroupCache = new Map();
    this._quadCount = 0;
    this._flushStart = 0;
    this._currentBaseTexture = null;
    this._currentBlendMode = BLEND_MODES.NORMAL;
    this._batches = [];
  }

  _createIndexBuffer(device) {
    const indices = new Uint16Array(MAX_QUADS * INDICES_PER_QUAD);
    for (let i = 0; i < MAX_QUADS; i++) {
      const vi = i * 4;
      const ii = i * 6;
      indices[ii]     = vi;
      indices[ii + 1] = vi + 1;
      indices[ii + 2] = vi + 2;
      indices[ii + 3] = vi;
      indices[ii + 4] = vi + 2;
      indices[ii + 5] = vi + 3;
    }
    const buffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, indices);
    return buffer;
  }

  beginFrame() {
    this._bufferIndex = (this._bufferIndex + 1) % 2;
    this._quadCount = 0;
    this._flushStart = 0;
    this._currentBaseTexture = null;
    this._currentBlendMode = BLEND_MODES.NORMAL;
    this._batches = [];
  }

  begin() {
    this._currentBaseTexture = null;
    this._currentBlendMode = BLEND_MODES.NORMAL;
    this._batches = [];
    this._flushStart = this._quadCount;
  }

  pushSprite(sprite) {
    if (this._quadCount >= MAX_QUADS) return false;

    const baseTexture = sprite.texture.baseTexture;
    const blendMode = sprite.blendMode || BLEND_MODES.NORMAL;

    if (baseTexture !== this._currentBaseTexture || blendMode !== this._currentBlendMode) {
      this._startBatch(baseTexture, blendMode);
    }

    const tex = sprite.texture;
    const wt = sprite.worldTransform;
    const w = tex.frame.width;
    const h = tex.frame.height;
    const ax = sprite.anchor.x * w;
    const ay = sprite.anchor.y * h;

    const x0 = -ax, y0 = -ay;
    const x1 = w - ax, y1 = h - ay;

    const a = wt.a, b = wt.b, c = wt.c, d = wt.d, tx = wt.tx, ty = wt.ty;

    const p0x = a * x0 + c * y0 + tx;
    const p0y = b * x0 + d * y0 + ty;
    const p1x = a * x1 + c * y0 + tx;
    const p1y = b * x1 + d * y0 + ty;
    const p2x = a * x1 + c * y1 + tx;
    const p2y = b * x1 + d * y1 + ty;
    const p3x = a * x0 + c * y1 + tx;
    const p3y = b * x0 + d * y1 + ty;

    const uvs = tex.uvs;
    const tintHex = sprite.tint;
    const tr = ((tintHex >> 16) & 0xFF) / 255;
    const tg = ((tintHex >> 8) & 0xFF) / 255;
    const tb = (tintHex & 0xFF) / 255;
    const ta = sprite.worldAlpha;

    const offset = this._quadCount * VERTICES_PER_QUAD * FLOATS_PER_VERTEX;
    const vd = this._vertexData;

    vd[offset]      = p0x; vd[offset + 1]  = p0y;
    vd[offset + 2]  = uvs.x0; vd[offset + 3]  = uvs.y0;
    vd[offset + 4]  = tr; vd[offset + 5]  = tg; vd[offset + 6]  = tb; vd[offset + 7]  = ta;

    vd[offset + 8]  = p1x; vd[offset + 9]  = p1y;
    vd[offset + 10] = uvs.x1; vd[offset + 11] = uvs.y0;
    vd[offset + 12] = tr; vd[offset + 13] = tg; vd[offset + 14] = tb; vd[offset + 15] = ta;

    vd[offset + 16] = p2x; vd[offset + 17] = p2y;
    vd[offset + 18] = uvs.x1; vd[offset + 19] = uvs.y1;
    vd[offset + 20] = tr; vd[offset + 21] = tg; vd[offset + 22] = tb; vd[offset + 23] = ta;

    vd[offset + 24] = p3x; vd[offset + 25] = p3y;
    vd[offset + 26] = uvs.x0; vd[offset + 27] = uvs.y1;
    vd[offset + 28] = tr; vd[offset + 29] = tg; vd[offset + 30] = tb; vd[offset + 31] = ta;

    this._quadCount++;
    this._batches[this._batches.length - 1].count++;
    return true;
  }

  _startBatch(baseTexture, blendMode) {
    this._currentBaseTexture = baseTexture;
    this._currentBlendMode = blendMode;
    this._batches.push({ baseTexture, blendMode, start: this._quadCount, count: 0 });
  }

  flush(renderPass, pipelines, cameraBindGroup, texBindGroupLayout) {
    if (this._batches.length === 0) return;

    // Upload ALL vertex data accumulated this frame in one shot
    const vb = this._vertexBuffers[this._bufferIndex];
    const totalFloats = this._quadCount * VERTICES_PER_QUAD * FLOATS_PER_VERTEX;
    this._device.queue.writeBuffer(vb, 0, this._vertexData, 0, totalFloats);

    renderPass.setVertexBuffer(0, vb);
    renderPass.setIndexBuffer(this._indexBuffer, 'uint16');
    renderPass.setBindGroup(0, cameraBindGroup);

    let currentPipeline = null;

    for (const batch of this._batches) {
      const pipeline = pipelines[batch.blendMode] || pipelines[0];
      if (pipeline !== currentPipeline) {
        renderPass.setPipeline(pipeline);
        currentPipeline = pipeline;
      }

      let bindGroup = this._bindGroupCache.get(batch.baseTexture);
      if (!bindGroup) {
        bindGroup = this._device.createBindGroup({
          layout: texBindGroupLayout,
          entries: [
            { binding: 0, resource: batch.baseTexture.gpuSampler },
            { binding: 1, resource: batch.baseTexture.gpuTexture.createView() },
          ],
        });
        this._bindGroupCache.set(batch.baseTexture, bindGroup);
      }
      renderPass.setBindGroup(1, bindGroup);
      renderPass.drawIndexed(batch.count * INDICES_PER_QUAD, 1, batch.start * INDICES_PER_QUAD);
    }

    this._currentBaseTexture = null;
    this._currentBlendMode = BLEND_MODES.NORMAL;
    this._batches = [];
    this._flushStart = this._quadCount;
  }
}
