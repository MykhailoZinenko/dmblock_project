import { Color } from '../utils/Color.js';
import { Sprite } from '../nodes/Sprite.js';
import { Graphics } from '../nodes/Graphics.js';
import { Text } from '../nodes/Text.js';
import { ParticleContainer } from '../nodes/ParticleContainer.js';
import { Batcher } from './Batcher.js';
import { BLEND_MODES, BLEND_STATES } from './BlendMode.js';
import type { BlendMode } from './BlendMode.js';
import type { Node } from '../nodes/Node.js';
import type { Camera } from '../camera/Camera.js';
import type { ViewportBounds } from '../camera/Camera.js';
import type { BaseTexture } from '../textures/BaseTexture.js';
import type { Bounds } from '../math/Bounds.js';

const MSAA_SAMPLES: number = 4;

export interface RendererOptions {
  backgroundColor?: number | string | Float32Array;
}

export class Renderer {
  private _device: GPUDevice;
  private _context: GPUCanvasContext;
  private _format: GPUTextureFormat;
  private _clearColor: Float32Array;

  private _batcher: Batcher;
  private _msaaTexture: GPUTexture | null;
  private _msaaView: GPUTextureView | null;

  private _cameraBuffer: GPUBuffer;
  private _cameraBindGroupLayout: GPUBindGroupLayout;
  private _cameraBindGroup: GPUBindGroup;

  private _spritePipelines: Record<number, GPURenderPipeline> | null;
  private _texBindGroupLayout: GPUBindGroupLayout | null;
  private _graphicsPipeline: GPURenderPipeline | null;
  private _particlePipelines: Record<number, GPURenderPipeline> | null;
  private _msdfPipeline: GPURenderPipeline | null;
  private _bindGroupCache: Map<BaseTexture, GPUBindGroup>;
  private _renderList: Node[];

  constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat, options: RendererOptions = {}) {
    this._device = device;
    this._context = context;
    this._format = format;
    this._clearColor = Color.from(options.backgroundColor || 0x0a0a12);

    this._batcher = new Batcher(device);
    this._msaaTexture = null;
    this._msaaView = null;

    this._cameraBuffer = device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this._cameraBindGroupLayout = device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      }],
    });

    this._cameraBindGroup = device.createBindGroup({
      layout: this._cameraBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this._cameraBuffer },
      }],
    });

    this._spritePipelines = null;
    this._texBindGroupLayout = null;
    this._graphicsPipeline = null;
    this._particlePipelines = null;
    this._msdfPipeline = null;
    this._bindGroupCache = new Map();
    this._renderList = [];
  }

  updateMsaaTexture(width: number, height: number): void {
    if (this._msaaTexture) this._msaaTexture.destroy();
    this._msaaTexture = this._device.createTexture({
      size: [width, height],
      format: this._format,
      sampleCount: MSAA_SAMPLES,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this._msaaView = this._msaaTexture.createView();
  }

  async initPipelines(shaderSource: string): Promise<void> {
    const device: GPUDevice = this._device;
    const module: GPUShaderModule = device.createShaderModule({ code: shaderSource });

    this._texBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    const pipelineLayout: GPUPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this._cameraBindGroupLayout, this._texBindGroupLayout],
    });

    this._spritePipelines = {};
    for (const mode of [BLEND_MODES.NORMAL, BLEND_MODES.ADDITIVE, BLEND_MODES.MULTIPLY] as BlendMode[]) {
      this._spritePipelines[mode] = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module,
          entryPoint: 'vs',
          buffers: [{
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' },
              { shaderLocation: 2, offset: 16, format: 'float32x4' },
            ],
          }],
        },
        fragment: {
          module,
          entryPoint: 'fs',
          targets: [{
            format: this._format,
            blend: BLEND_STATES[mode],
          }],
        },
        primitive: { topology: 'triangle-list' },
        multisample: { count: MSAA_SAMPLES },
      });
    }
  }

  async initMsdfPipeline(shaderSource: string): Promise<void> {
    const device: GPUDevice = this._device;
    const module: GPUShaderModule = device.createShaderModule({ code: shaderSource });

    const texBindGroupLayout: GPUBindGroupLayout = this._texBindGroupLayout || device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    const pipelineLayout: GPUPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this._cameraBindGroupLayout, texBindGroupLayout],
    });

    this._msdfPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: 32,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x2' },
            { shaderLocation: 2, offset: 16, format: 'float32x4' },
          ],
        }],
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{
          format: this._format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: MSAA_SAMPLES },
    });
  }

  async initGraphicsPipeline(shaderSource: string): Promise<void> {
    const device: GPUDevice = this._device;
    const module: GPUShaderModule = device.createShaderModule({ code: shaderSource });

    const pipelineLayout: GPUPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this._cameraBindGroupLayout],
    });

    this._graphicsPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x4' },
          ],
        }],
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{
          format: this._format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: MSAA_SAMPLES },
    });
  }

  async initParticlePipeline(shaderSource: string): Promise<void> {
    const device: GPUDevice = this._device;
    const module: GPUShaderModule = device.createShaderModule({ code: shaderSource });

    const texBindGroupLayout: GPUBindGroupLayout = this._texBindGroupLayout || device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    const pipelineLayout: GPUPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this._cameraBindGroupLayout, texBindGroupLayout],
    });

    this._particlePipelines = {};
    for (const mode of [BLEND_MODES.NORMAL, BLEND_MODES.ADDITIVE, BLEND_MODES.MULTIPLY] as BlendMode[]) {
      this._particlePipelines[mode] = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module,
          entryPoint: 'vs',
          buffers: [
            {
              arrayStride: 8,
              stepMode: 'vertex',
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
              ],
            },
            {
              arrayStride: 56,
              stepMode: 'instance',
              attributes: [
                { shaderLocation: 1, offset: 0, format: 'float32x2' },
                { shaderLocation: 2, offset: 8, format: 'float32x4' },
                { shaderLocation: 3, offset: 24, format: 'float32x4' },
                { shaderLocation: 4, offset: 40, format: 'float32x4' },
              ],
            },
          ],
        },
        fragment: {
          module,
          entryPoint: 'fs',
          targets: [{
            format: this._format,
            blend: BLEND_STATES[mode],
          }],
        },
        primitive: { topology: 'triangle-list' },
        multisample: { count: MSAA_SAMPLES },
      });
    }
  }

  render(stage: Node, camera: Camera): void {
    if (!this._spritePipelines) {
      this._renderClear();
      return;
    }

    const vp = camera['_vpMatrix'];
    const mat4: Float32Array = new Float32Array([
      vp.a,  vp.b,  0, 0,
      vp.c,  vp.d,  0, 0,
      0,     0,     1, 0,
      vp.tx, vp.ty, 0, 1,
    ]);
    this._device.queue.writeBuffer(this._cameraBuffer, 0, mat4);

    const viewportBounds: ViewportBounds = camera.getViewportBounds();

    this._renderList.length = 0;
    this._collectNodes(stage, viewportBounds);

    const encoder: GPUCommandEncoder = this._device.createCommandEncoder();
    const resolveTarget: GPUTextureView = this._context.getCurrentTexture().createView();
    const [r, g, b, a] = this._clearColor;

    const pass: GPURenderPassEncoder = encoder.beginRenderPass({
      colorAttachments: [{
        view: this._msaaView!,
        resolveTarget,
        clearValue: { r, g, b, a },
        loadOp: 'clear',
        storeOp: 'discard',
      }],
    });

    this._batcher.beginFrame();

    for (const node of this._renderList) {
      if (node instanceof Sprite) {
        const ok: boolean = this._batcher.pushSprite(node);
        if (!ok) {
          this._batcher.flush(pass, this._spritePipelines, this._cameraBindGroup, this._texBindGroupLayout!);
          this._batcher.begin();
          this._batcher.pushSprite(node);
        }
      } else if (node instanceof Text) {
        this._batcher.flush(pass, this._spritePipelines, this._cameraBindGroup, this._texBindGroupLayout!);
        this._batcher.begin();
        this._renderTextNode(pass, node);
      } else if (node instanceof ParticleContainer) {
        this._batcher.flush(pass, this._spritePipelines, this._cameraBindGroup, this._texBindGroupLayout!);
        this._batcher.begin();
        this._renderParticleContainer(pass, node);
      } else if (node instanceof Graphics) {
        this._batcher.flush(pass, this._spritePipelines, this._cameraBindGroup, this._texBindGroupLayout!);
        this._batcher.begin();
        this._renderGraphicsNode(pass, node);
      }
    }

    this._batcher.flush(pass, this._spritePipelines, this._cameraBindGroup, this._texBindGroupLayout!);

    pass.end();
    this._device.queue.submit([encoder.finish()]);
  }

  private _renderClear(): void {
    const encoder: GPUCommandEncoder = this._device.createCommandEncoder();
    const resolveTarget: GPUTextureView = this._context.getCurrentTexture().createView();
    const [r, g, b, a] = this._clearColor;
    const pass: GPURenderPassEncoder = encoder.beginRenderPass({
      colorAttachments: [{
        view: this._msaaView || resolveTarget,
        resolveTarget: this._msaaView ? resolveTarget : undefined,
        clearValue: { r, g, b, a },
        loadOp: 'clear',
        storeOp: this._msaaView ? 'discard' : 'store',
      }],
    });
    pass.end();
    this._device.queue.submit([encoder.finish()]);
  }

  private _renderGraphicsNode(pass: GPURenderPassEncoder, gfx: Graphics): void {
    if (!this._graphicsPipeline) return;

    gfx._buildGeometry();
    if (!gfx._builtVertices || gfx._builtVertices.length === 0) return;
    if (!gfx._builtIndices || gfx._builtIndices.length === 0) return;

    const needsRebuild: boolean = !gfx._gpuVertexBuffer || gfx._gpuBuffersDirty;

    if (needsRebuild) {
      if (gfx._gpuVertexBuffer) gfx._gpuVertexBuffer.destroy();
      if (gfx._gpuIndexBuffer) gfx._gpuIndexBuffer.destroy();

      const vbSize: number = Math.ceil(gfx._builtVertices.byteLength / 4) * 4;
      gfx._gpuVertexBuffer = this._device.createBuffer({
        size: vbSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this._device.queue.writeBuffer(gfx._gpuVertexBuffer, 0, gfx._builtVertices);

      let indexData: Uint16Array = gfx._builtIndices;
      if (indexData.byteLength % 4 !== 0) {
        const padded: Uint16Array = new Uint16Array(indexData.length + 1);
        padded.set(indexData);
        indexData = padded;
      }
      gfx._gpuIndexBuffer = this._device.createBuffer({
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      this._device.queue.writeBuffer(gfx._gpuIndexBuffer, 0, indexData);
      gfx._gpuIndexCount = gfx._builtIndices.length;
      gfx._gpuBuffersDirty = false;
    }

    pass.setPipeline(this._graphicsPipeline);
    pass.setBindGroup(0, this._cameraBindGroup);
    pass.setVertexBuffer(0, gfx._gpuVertexBuffer!);
    pass.setIndexBuffer(gfx._gpuIndexBuffer!, 'uint16');
    pass.drawIndexed(gfx._gpuIndexCount);
  }

  private _renderParticleContainer(pass: GPURenderPassEncoder, pc: ParticleContainer): void {
    if (!this._particlePipelines) return;

    pc._rebuild();
    if (!pc._instanceData || pc._particles.length === 0) return;

    const device: GPUDevice = this._device;

    if (!pc._gpuQuadBuffer) {
      const quadVerts: Float32Array = new Float32Array([
        -0.5, -0.5,
         0.5, -0.5,
         0.5,  0.5,
        -0.5,  0.5,
      ]);
      pc._gpuQuadBuffer = device.createBuffer({
        size: quadVerts.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(pc._gpuQuadBuffer, 0, quadVerts);

      const indices: Uint16Array = new Uint16Array([0, 1, 2, 0, 2, 3]);
      pc._gpuQuadIndexBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(pc._gpuQuadIndexBuffer, 0, indices);
    }

    const instanceBytes: number = pc._instanceData.byteLength;
    if (!pc._gpuInstanceBuffer || pc._gpuInstanceBuffer.size < instanceBytes) {
      if (pc._gpuInstanceBuffer) pc._gpuInstanceBuffer.destroy();
      pc._gpuInstanceBuffer = device.createBuffer({
        size: instanceBytes,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }
    device.queue.writeBuffer(pc._gpuInstanceBuffer, 0, pc._instanceData);

    const bt: BaseTexture | null = pc._baseTexture;
    let bindGroup: GPUBindGroup | undefined = this._bindGroupCache.get(bt!);
    if (!bindGroup) {
      bindGroup = device.createBindGroup({
        layout: this._texBindGroupLayout!,
        entries: [
          { binding: 0, resource: bt!.gpuSampler! },
          { binding: 1, resource: bt!.gpuTexture!.createView() },
        ],
      });
      this._bindGroupCache.set(bt!, bindGroup);
    }

    const pipeline: GPURenderPipeline = this._particlePipelines[pc.blendMode] || this._particlePipelines[BLEND_MODES.NORMAL];
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this._cameraBindGroup);
    pass.setBindGroup(1, bindGroup);
    pass.setVertexBuffer(0, pc._gpuQuadBuffer!);
    pass.setVertexBuffer(1, pc._gpuInstanceBuffer);
    pass.setIndexBuffer(pc._gpuQuadIndexBuffer!, 'uint16');
    pass.drawIndexed(6, pc._particles.length);
  }

  private _renderTextNode(pass: GPURenderPassEncoder, textNode: Text): void {
    if (!this._msdfPipeline) return;
    const fontTex = textNode._fontTexture || Text._defaultFontTexture;
    if (!fontTex || !fontTex.baseTexture || !fontTex.baseTexture.gpuTexture) return;

    textNode._rebuild();
    if (!textNode._vertices || textNode._quadCount === 0) return;

    const device: GPUDevice = this._device;

    if (textNode._gpuBuffersDirty) {
      if (textNode._gpuVertexBuffer) textNode._gpuVertexBuffer.destroy();
      if (textNode._gpuIndexBuffer) textNode._gpuIndexBuffer.destroy();

      const vbSize: number = Math.ceil(textNode._vertices.byteLength / 4) * 4;
      textNode._gpuVertexBuffer = device.createBuffer({
        size: vbSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(textNode._gpuVertexBuffer, 0, textNode._vertices);

      let indexData: Uint16Array = textNode._indices!;
      if (indexData.byteLength % 4 !== 0) {
        const padded: Uint16Array = new Uint16Array(indexData.length + 1);
        padded.set(indexData);
        indexData = padded;
      }
      textNode._gpuIndexBuffer = device.createBuffer({
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(textNode._gpuIndexBuffer, 0, indexData);
      textNode._gpuIndexCount = textNode._indices!.length;
      textNode._gpuBuffersDirty = false;
    }

    if (!textNode._gpuVertexBuffer) return;

    const bt: BaseTexture = fontTex.baseTexture;
    let bindGroup: GPUBindGroup | undefined = this._bindGroupCache.get(bt);
    if (!bindGroup) {
      const sampler: GPUSampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
      bindGroup = device.createBindGroup({
        layout: this._texBindGroupLayout!,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: bt.gpuTexture!.createView() },
        ],
      });
      this._bindGroupCache.set(bt, bindGroup);
    }

    pass.setPipeline(this._msdfPipeline);
    pass.setBindGroup(0, this._cameraBindGroup);
    pass.setBindGroup(1, bindGroup);
    pass.setVertexBuffer(0, textNode._gpuVertexBuffer);
    pass.setIndexBuffer(textNode._gpuIndexBuffer!, 'uint16');
    pass.drawIndexed(textNode._gpuIndexCount);
  }

  private _collectNodes(node: Node, viewportBounds: ViewportBounds): void {
    if (!node.visible) return;

    const isSprite: boolean = node instanceof Sprite &&
      !!(node as Sprite).texture && !!(node as Sprite).texture.baseTexture && !!(node as Sprite).texture.baseTexture.gpuTexture;
    const isGraphics: boolean = node instanceof Graphics;
    const isText: boolean = node instanceof Text;
    const isParticleContainer: boolean = node instanceof ParticleContainer;

    if (isParticleContainer) {
      const pc = node as ParticleContainer;
      if (pc._particles.length > 0 && pc._baseTexture && pc._baseTexture.gpuTexture) {
        const bounds: Bounds = pc.getBounds();
        if (bounds.maxX > bounds.minX && bounds.maxY > bounds.minY) {
          if (!this._boundsIntersect(bounds, viewportBounds)) return;
        }
        this._renderList.push(node);
      }
      return;
    }

    if (isSprite || isGraphics || isText) {
      const bounds: Bounds = node.getBounds();
      const hasValidBounds: boolean = bounds.maxX > bounds.minX && bounds.maxY > bounds.minY;
      if (!hasValidBounds || this._boundsIntersect(bounds, viewportBounds)) {
        this._renderList.push(node);
      }
    }

    for (let i = 0; i < node.children.length; i++) {
      this._collectNodes(node.children[i], viewportBounds);
    }
  }

  private _boundsIntersect(bounds: Bounds, viewport: ViewportBounds): boolean {
    return bounds.maxX > viewport.minX && bounds.minX < viewport.maxX &&
           bounds.maxY > viewport.minY && bounds.minY < viewport.maxY;
  }

  destroy(): void {
    this._cameraBuffer.destroy();
    if (this._msaaTexture) this._msaaTexture.destroy();
  }
}
