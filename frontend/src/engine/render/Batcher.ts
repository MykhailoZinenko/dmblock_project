import { BLEND_MODES } from './BlendMode.js';
import type { BlendMode } from './BlendMode.js';
import type { Sprite } from '../nodes/Sprite.js';
import type { BaseTexture } from '../textures/BaseTexture.js';

const MAX_QUADS: number = 8192;
const FLOATS_PER_VERTEX: number = 8;
const VERTICES_PER_QUAD: number = 4;
const INDICES_PER_QUAD: number = 6;

interface BatchEntry {
  baseTexture: BaseTexture;
  blendMode: BlendMode;
  start: number;
  count: number;
}

export class Batcher {
  private _device: GPUDevice;
  private _vertexData: Float32Array;
  private _vertexBuffers: GPUBuffer[];
  private _bufferIndex: number;
  private _indexBuffer: GPUBuffer;
  private _bindGroupCache: Map<BaseTexture, GPUBindGroup>;
  private _quadCount: number;
  private _flushStart: number;
  private _currentBaseTexture: BaseTexture | null;
  private _currentBlendMode: BlendMode;
  private _batches: BatchEntry[];

  constructor(device: GPUDevice) {
    this._device = device;
    this._vertexData = new Float32Array(MAX_QUADS * VERTICES_PER_QUAD * FLOATS_PER_VERTEX);
    const bufSize: number = this._vertexData.byteLength;
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

  private _createIndexBuffer(device: GPUDevice): GPUBuffer {
    const indices: Uint16Array = new Uint16Array(MAX_QUADS * INDICES_PER_QUAD);
    for (let i = 0; i < MAX_QUADS; i++) {
      const vi: number = i * 4;
      const ii: number = i * 6;
      indices[ii]     = vi;
      indices[ii + 1] = vi + 1;
      indices[ii + 2] = vi + 2;
      indices[ii + 3] = vi;
      indices[ii + 4] = vi + 2;
      indices[ii + 5] = vi + 3;
    }
    const buffer: GPUBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, indices);
    return buffer;
  }

  beginFrame(): void {
    this._bufferIndex = (this._bufferIndex + 1) % 2;
    this._quadCount = 0;
    this._flushStart = 0;
    this._currentBaseTexture = null;
    this._currentBlendMode = BLEND_MODES.NORMAL;
    this._batches = [];
  }

  begin(): void {
    this._currentBaseTexture = null;
    this._currentBlendMode = BLEND_MODES.NORMAL;
    this._batches = [];
    this._flushStart = this._quadCount;
  }

  pushSprite(sprite: Sprite): boolean {
    if (this._quadCount >= MAX_QUADS) return false;

    const baseTexture: BaseTexture = sprite.texture.baseTexture;
    const blendMode: BlendMode = sprite.blendMode || BLEND_MODES.NORMAL;

    if (baseTexture !== this._currentBaseTexture || blendMode !== this._currentBlendMode) {
      this._startBatch(baseTexture, blendMode);
    }

    const tex = sprite.texture;
    const wt = sprite.worldTransform;
    const w: number = tex.frame.width;
    const h: number = tex.frame.height;
    const ax: number = sprite.anchor.x * w;
    const ay: number = sprite.anchor.y * h;

    const x0: number = -ax, y0: number = -ay;
    const x1: number = w - ax, y1: number = h - ay;

    const a: number = wt.a, b: number = wt.b, c: number = wt.c, d: number = wt.d, tx: number = wt.tx, ty: number = wt.ty;

    const p0x: number = a * x0 + c * y0 + tx;
    const p0y: number = b * x0 + d * y0 + ty;
    const p1x: number = a * x1 + c * y0 + tx;
    const p1y: number = b * x1 + d * y0 + ty;
    const p2x: number = a * x1 + c * y1 + tx;
    const p2y: number = b * x1 + d * y1 + ty;
    const p3x: number = a * x0 + c * y1 + tx;
    const p3y: number = b * x0 + d * y1 + ty;

    const uvs = tex.uvs;
    const tintHex: number = sprite.tint;
    const tr: number = ((tintHex >> 16) & 0xFF) / 255;
    const tg: number = ((tintHex >> 8) & 0xFF) / 255;
    const tb: number = (tintHex & 0xFF) / 255;
    const ta: number = sprite.worldAlpha;

    const offset: number = this._quadCount * VERTICES_PER_QUAD * FLOATS_PER_VERTEX;
    const vd: Float32Array = this._vertexData;

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

  private _startBatch(baseTexture: BaseTexture, blendMode: BlendMode): void {
    this._currentBaseTexture = baseTexture;
    this._currentBlendMode = blendMode;
    this._batches.push({ baseTexture, blendMode, start: this._quadCount, count: 0 });
  }

  flush(
    renderPass: GPURenderPassEncoder,
    pipelines: Record<number, GPURenderPipeline>,
    cameraBindGroup: GPUBindGroup,
    texBindGroupLayout: GPUBindGroupLayout,
  ): void {
    if (this._batches.length === 0) return;

    // Upload ALL vertex data accumulated this frame in one shot
    const vb: GPUBuffer = this._vertexBuffers[this._bufferIndex];
    const totalFloats: number = this._quadCount * VERTICES_PER_QUAD * FLOATS_PER_VERTEX;
    this._device.queue.writeBuffer(vb, 0, this._vertexData, 0, totalFloats);

    renderPass.setVertexBuffer(0, vb);
    renderPass.setIndexBuffer(this._indexBuffer, 'uint16');
    renderPass.setBindGroup(0, cameraBindGroup);

    let currentPipeline: GPURenderPipeline | null = null;

    for (const batch of this._batches) {
      const pipeline: GPURenderPipeline = pipelines[batch.blendMode] || pipelines[0];
      if (pipeline !== currentPipeline) {
        renderPass.setPipeline(pipeline);
        currentPipeline = pipeline;
      }

      let bindGroup: GPUBindGroup | undefined = this._bindGroupCache.get(batch.baseTexture);
      if (!bindGroup) {
        bindGroup = this._device.createBindGroup({
          layout: texBindGroupLayout,
          entries: [
            { binding: 0, resource: batch.baseTexture.gpuSampler! },
            { binding: 1, resource: batch.baseTexture.gpuTexture!.createView() },
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
