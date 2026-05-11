import { Ticker, PRIORITY } from './Ticker.js';
import { Container } from './nodes/Container.js';
import { AnimatedSprite } from './nodes/AnimatedSprite.js';
import { Renderer } from './render/Renderer.js';
import type { RendererOptions } from './render/Renderer.js';
import { Camera } from './camera/Camera.js';
import { Viewport } from './camera/Viewport.js';
import { TextureManager } from './textures/TextureManager.js';
import { Texture } from './textures/Texture.js';
import { InteractionManager } from './interaction/InteractionManager.js';
import { AssetLoader } from './assets/AssetLoader.js';
import { Text } from './nodes/Text.js';
import { EventEmitter } from './utils/EventEmitter.js';

export interface EngineOptions extends RendererOptions {}

export class Engine extends EventEmitter {
  public canvas: HTMLCanvasElement;
  public stage: Container;
  public ticker: Ticker;
  public camera: Camera;
  public renderer: Renderer;
  public textures: TextureManager;
  public loader: AssetLoader;
  public interaction: InteractionManager;
  public viewport: Viewport;

  constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    options: EngineOptions = {},
  ) {
    super();
    this.canvas = canvas;
    this.stage = new Container();
    this.ticker = new Ticker();
    this.camera = new Camera();
    this.renderer = new Renderer(device, context, format, options);
    this.textures = new TextureManager(device);
    this.loader = new AssetLoader(this.textures);

    this.interaction = new InteractionManager(canvas, this.stage, this.camera);

    this.viewport = new Viewport(canvas, (w: number, h: number) => {
      context.configure({ device, format, alphaMode: 'premultiplied' });
      this.renderer.updateMsaaTexture(w, h);
      this.camera.updateMatrix(w, h);
      this.emit('resize', { width: w, height: h });
    });

    this.ticker.add(() => {
      if (this.camera.dirty) this.camera.updateMatrix(this.viewport.width, this.viewport.height);
      this.stage.updateTransform();
    }, PRIORITY.SCENE_UPDATE);

    this.ticker.add(() => {
      this.renderer.render(this.stage, this.camera);
    }, PRIORITY.RENDER);
  }

  static async create(canvas: HTMLCanvasElement, options: EngineOptions = {}): Promise<Engine> {
    if (!navigator.gpu) throw new Error('WebGPU is not supported in this browser');

    const adapter: GPUAdapter | null = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('Failed to obtain GPU adapter');

    const device: GPUDevice = await adapter.requestDevice();
    const context: GPUCanvasContext = canvas.getContext('webgpu')!;
    const format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device, format, alphaMode: 'premultiplied' });

    const engine: Engine = new Engine(canvas, device, context, format, options);
    engine.renderer.updateMsaaTexture(canvas.width, canvas.height);
    engine.camera.updateMatrix(canvas.width, canvas.height);

    Texture.createEmpty(device);
    AnimatedSprite.defaultTicker = engine.ticker;

    async function loadShader(name: string): Promise<string> {
      const url: URL = new URL(`./render/shaders/${name}`, import.meta.url);
      const res: Response = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load shader "${name}": ${res.status}`);
      return res.text();
    }

    await engine.renderer.initPipelines(await loadShader('sprite.wgsl'));
    await engine.renderer.initGraphicsPipeline(await loadShader('graphics.wgsl'));
    await engine.renderer.initParticlePipeline(await loadShader('particle.wgsl'));

    await engine.renderer.initMsdfPipeline(await loadShader('msdf.wgsl'));

    engine.ticker.start();
    return engine;
  }

  async loadFont(atlasUrl: string, jsonUrl: string): Promise<void> {
    const [fontTex, fontRes] = await Promise.all([
      this.textures.load('_msdf_font', atlasUrl),
      fetch(jsonUrl),
    ]);
    const fontData = await fontRes.json();
    Text.setFont(fontData, fontTex);
  }

  destroy(): void {
    this.ticker.stop();
    this.stage.destroy();
    this.interaction.destroy();
    this.viewport.destroy();
    this.textures.destroyAll();
    this.renderer.destroy();
    this.removeAllListeners();
  }
}
