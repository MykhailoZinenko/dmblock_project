import { Ticker, PRIORITY } from './Ticker.js';
import { Container } from './nodes/Container.js';
import { AnimatedSprite } from './nodes/AnimatedSprite.js';
import { Renderer } from './render/Renderer.js';
import { Camera } from './camera/Camera.js';
import { Viewport } from './camera/Viewport.js';
import { TextureManager } from './textures/TextureManager.js';
import { Texture } from './textures/Texture.js';
import { InteractionManager } from './interaction/InteractionManager.js';
import { AssetLoader } from './assets/AssetLoader.js';
import { Text } from './nodes/Text.js';
import { EventEmitter } from './utils/EventEmitter.js';

export class Engine extends EventEmitter {
  constructor(canvas, device, context, format, options = {}) {
    super();
    this.canvas = canvas;
    this.stage = new Container();
    this.ticker = new Ticker();
    this.camera = new Camera();
    this.renderer = new Renderer(device, context, format, options);
    this.textures = new TextureManager(device);
    this.loader = new AssetLoader(this.textures);

    this.interaction = new InteractionManager(canvas, this.stage, this.camera);

    this.viewport = new Viewport(canvas, (w, h) => {
      context.configure({ device, format, alphaMode: 'premultiplied' });
      this.renderer.updateMsaaTexture(w, h);
      this.camera.updateMatrix(w, h);
      this.emit('resize', { width: w, height: h });
    });

    this.ticker.add(() => {
      if (this.camera._dirty) this.camera.updateMatrix(this.viewport.width, this.viewport.height);
      this.stage.updateTransform();
    }, PRIORITY.SCENE_UPDATE);

    this.ticker.add(() => {
      this.renderer.render(this.stage, this.camera);
    }, PRIORITY.RENDER);
  }

  static async create(canvas, options = {}) {
    if (!navigator.gpu) throw new Error('WebGPU is not supported in this browser');

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('Failed to obtain GPU adapter');

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device, format, alphaMode: 'premultiplied' });

    const engine = new Engine(canvas, device, context, format, options);
    engine.renderer.updateMsaaTexture(canvas.width, canvas.height);
    engine.camera.updateMatrix(canvas.width, canvas.height);

    Texture.createEmpty(device);
    AnimatedSprite.defaultTicker = engine.ticker;

    async function loadShader(name) {
      const url = new URL(`./render/shaders/${name}`, import.meta.url);
      const res = await fetch(url);
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

  async loadFont(atlasUrl, jsonUrl) {
    const [fontTex, fontRes] = await Promise.all([
      this.textures.load('_msdf_font', atlasUrl),
      fetch(jsonUrl),
    ]);
    const fontData = await fontRes.json();
    Text.setFont(fontData, fontTex);
  }

  destroy() {
    this.ticker.stop();
    this.stage.destroy();
    this.interaction.destroy();
    this.viewport.destroy();
    this.textures.destroyAll();
    this.renderer.destroy();
    this.removeAllListeners();
  }
}
