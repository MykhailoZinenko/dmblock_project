import { benchmark, gpuBenchmark, stressBenchmark, registerAll } from './harness.js';
import type { GpuBenchSetup, StressBenchSetup } from './harness.js';
import { Matrix } from '../../engine/math/Matrix.js';
import { Bounds } from '../../engine/math/Bounds.js';
import { Color } from '../../engine/utils/Color.js';
import { EventEmitter } from '../../engine/utils/EventEmitter.js';
import { Pool } from '../../engine/utils/Pool.js';
import { Node } from '../../engine/nodes/Node.js';
import { Container } from '../../engine/nodes/Container.js';
import { Sprite } from '../../engine/nodes/Sprite.js';
import { AnimatedSprite } from '../../engine/nodes/AnimatedSprite.js';
import { Graphics } from '../../engine/nodes/Graphics.js';
import { Texture } from '../../engine/textures/Texture.js';
import { BaseTexture } from '../../engine/textures/BaseTexture.js';

AnimatedSprite.defaultTicker = null;

// ---- Helpers ----

function buildFlatTree(count: number): Container {
  const root = new Container();
  for (let i = 0; i < count; i++) {
    const n = new Node();
    n.position.set(i, i);
    root.addChild(n);
  }
  return root;
}

function buildDeepTree(depth: number): Container {
  const root = new Container();
  let current: Node = root;
  for (let i = 0; i < depth; i++) {
    const n = new Node();
    n.position.set(1, 1);
    current.addChild(n);
    current = n;
  }
  return root;
}

// ==================================
// 1. CPU MICROBENCHMARKS
// ==================================

const m1 = new Matrix();
const m2 = new Matrix().translate(10, 20).rotate(0.5).scale(2, 2);
const p = { x: 100, y: 200 };

registerAll([
  benchmark('[Math] Matrix.multiply', () => { m1.copyFrom(m2); m1.multiply(m2); }, 1_000_000),
  benchmark('[Math] Matrix.apply', () => { m2.apply(p); }, 1_000_000),
  benchmark('[Math] Matrix.invert', () => { const m = m2.clone(); m.invert(); }, 500_000),
  benchmark('[Math] Color.from(hex)', () => { Color.from(0xFF5500); }, 500_000),
]);

// Bounds
const b1 = new Bounds(); b1.addPoint(0, 0); b1.addPoint(100, 100);
const b2 = new Bounds(); b2.addPoint(50, 50); b2.addPoint(150, 150);

registerAll([
  benchmark('[Math] Bounds.intersects', () => { b1.intersects(b2); }, 1_000_000),
  benchmark('[Math] Bounds.contains', () => { b1.contains(75, 75); }, 1_000_000),
]);

// Allocation
registerAll([
  benchmark('[Alloc] new Matrix()', () => { new Matrix(); }, 500_000),
  benchmark('[Alloc] new Node()', () => { new Node(); }, 100_000),
  benchmark('[Alloc] new Float32Array(4)', () => { new Float32Array(4); }, 500_000),
]);

// Pooling comparison
const pool = new Pool<{ x: number; y: number }>(() => ({ x: 0, y: 0 }), (o) => { o.x = 0; o.y = 0; });
registerAll([
  benchmark('[Alloc] Pool get+release', () => { const o = pool.get(); o.x = 1; pool.release(o); }, 1_000_000),
  benchmark('[Alloc] new Object (no pool)', () => { const o = { x: 0, y: 0 }; o.x = 1; }, 1_000_000),
]);

// EventEmitter
const ee10 = new EventEmitter();
for (let i = 0; i < 10; i++) ee10.on('test', () => {});
const ee100 = new EventEmitter();
for (let i = 0; i < 100; i++) ee100.on('test', () => {});
const ee1000 = new EventEmitter();
for (let i = 0; i < 1000; i++) ee1000.on('test', () => {});

registerAll([
  benchmark('[Events] emit to 10 listeners', () => { ee10.emit('test', {}); }, 500_000),
  benchmark('[Events] emit to 100 listeners', () => { ee100.emit('test', {}); }, 100_000),
  benchmark('[Events] emit to 1000 listeners', () => { ee1000.emit('test', {}); }, 10_000),
]);

// ==================================
// 2. SCENE GRAPH TRAVERSAL
// ==================================

const flat100 = buildFlatTree(100);
const flat1k = buildFlatTree(1000);
const flat10k = buildFlatTree(10000);
const deep100 = buildDeepTree(100);
const deep1k = buildDeepTree(1000);

registerAll([
  benchmark('[SceneGraph] updateTransform 100 flat', () => { flat100._localDirty = true; flat100.updateTransform(); }, 10_000),
  benchmark('[SceneGraph] updateTransform 1k flat', () => { flat1k._localDirty = true; flat1k.updateTransform(); }, 1_000),
  benchmark('[SceneGraph] updateTransform 10k flat', () => { flat10k._localDirty = true; flat10k.updateTransform(); }, 100),
  benchmark('[SceneGraph] updateTransform 100 deep', () => { deep100._localDirty = true; deep100.updateTransform(); }, 10_000),
  benchmark('[SceneGraph] updateTransform 1k deep', () => { deep1k._localDirty = true; deep1k.updateTransform(); }, 1_000),
]);

// Dirty propagation: one node dirty vs all dirty
const dirtyTree = buildFlatTree(1000);
dirtyTree.updateTransform();

registerAll([
  benchmark('[SceneGraph] 1 dirty node in 1k tree', () => {
    dirtyTree.children[500]._localDirty = true;
    dirtyTree.children[500]._worldDirty = true;
    dirtyTree.updateTransform();
  }, 1_000),
  benchmark('[SceneGraph] all dirty in 1k tree', () => {
    for (const c of dirtyTree.children) { c._localDirty = true; c._worldDirty = true; }
    dirtyTree.updateTransform();
  }, 100),
]);

// Add/remove
registerAll([
  benchmark('[SceneGraph] addChild+removeChild 1000', () => {
    const root = new Container();
    const children: Node[] = [];
    for (let i = 0; i < 100; i++) {
      const n = new Node();
      root.addChild(n);
      children.push(n);
    }
    for (const c of children) root.removeChild(c);
  }, 1_000),
]);

// ==================================
// 3. GRAPHICS TRIANGULATION
// ==================================

const gfxHex = new Graphics();
gfxHex.beginFill(0xFF0000).drawRegularPolygon(0, 0, 40, 6).endFill();

const gfxCircle = new Graphics();
gfxCircle.beginFill(0xFF0000).drawCircle(0, 0, 50).endFill();

const gfxStar = new Graphics();
const starPts: number[] = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 === 0 ? 50 : 22;
  starPts.push(Math.cos(a) * r, Math.sin(a) * r);
}
gfxStar.beginFill(0xFF0000).drawPolygon(starPts).endFill();

const gfx100Hex = new Graphics();
for (let i = 0; i < 100; i++) {
  gfx100Hex.beginFill(0xFF0000).drawRegularPolygon(i * 10, 0, 40, 6).endFill();
}

registerAll([
  benchmark('[Graphics] triangulate hexagon (convex fast path)', () => {
    gfxHex._triangulationDirty = true;
    gfxHex._triangulate();
  }, 50_000),
  benchmark('[Graphics] triangulate circle 64+ verts', () => {
    gfxCircle._triangulationDirty = true;
    gfxCircle._triangulate();
  }, 10_000),
  benchmark('[Graphics] triangulate star (concave ear-clip)', () => {
    gfxStar._triangulationDirty = true;
    gfxStar._triangulate();
  }, 10_000),
  benchmark('[Graphics] triangulate 100 hexagons', () => {
    gfx100Hex._triangulationDirty = true;
    gfx100Hex._triangulate();
  }, 1_000),
  benchmark('[Graphics] world transform 100 hexagons (cached tri)', () => {
    gfx100Hex._triangulate();
    gfx100Hex._worldVertsDirty = true;
    gfx100Hex.position.set(1, 1);
    gfx100Hex.updateTransform();
    gfx100Hex._buildGeometry();
  }, 5_000),
]);

// ==================================
// 4. ANIMATED SPRITE
// ==================================

const frames: Texture[] = [];
const baseTex = new BaseTexture(null, null, 1152, 192);
for (let i = 0; i < 6; i++) {
  frames.push(new Texture(baseTex, { x: i * 192, y: 0, width: 192, height: 192 }));
}

const animSprites: AnimatedSprite[] = [];
for (let i = 0; i < 1000; i++) {
  const a = new AnimatedSprite(frames);
  a.animationSpeed = 0.12;
  (a as any)._playing = true; // eslint-disable-line @typescript-eslint/no-explicit-any
  animSprites.push(a);
}

registerAll([
  benchmark('[AnimSprite] update 1000 sprites', () => {
    for (const a of animSprites) a.update(1);
  }, 1_000),
]);

// ==================================
// 5. GPU STRESS TESTS
// ==================================

async function createTestEngine(canvasId: string) {
  const { Engine } = await import('../../engine/Engine.js');
  let canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.cssText = 'width: 400px; height: 300px; position: fixed; bottom: 0; right: 0; z-index: 999; opacity: 0.3;';
    document.body.appendChild(canvas);
  }
  const engine = await Engine.create(canvas, { backgroundColor: 0x111111 });
  engine.ticker.stop();
  return engine;
}

registerAll([
  gpuBenchmark('[GPU] 1k sprites same texture', async (): Promise<GpuBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    const tex = await engine.textures.load('perf_tower', '../../assets/buildings/blue/tower/tower.png');
    for (let i = 0; i < 1000; i++) {
      const s = new Sprite(tex);
      s.position.set((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 600);
      s.scale.set(0.3, 0.3);
      s.anchor.set(0.5, 0.5);
      engine.stage.addChild(s);
    }
    return {
      engine,
      tick: () => {
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { duration: 3 }),

  gpuBenchmark('[GPU] 10k sprites same texture', async (): Promise<GpuBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    const tex = await engine.textures.load('perf_tower', '../../assets/buildings/blue/tower/tower.png');
    for (let i = 0; i < 10000; i++) {
      const s = new Sprite(tex);
      s.position.set((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 1500);
      s.scale.set(0.15, 0.15);
      s.anchor.set(0.5, 0.5);
      engine.stage.addChild(s);
    }
    return {
      engine,
      tick: () => {
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { duration: 3 }),

  gpuBenchmark('[GPU] 1k sprites alternating 2 textures (batch breaks)', async (): Promise<GpuBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    const tex1 = await engine.textures.load('perf_tower', '../../assets/buildings/blue/tower/tower.png');
    const tex2 = await engine.textures.load('perf_house', '../../assets/buildings/blue/house/house.png');
    for (let i = 0; i < 1000; i++) {
      const s = new Sprite(i % 2 === 0 ? tex1 : tex2);
      s.position.set((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 600);
      s.scale.set(0.3, 0.3);
      s.anchor.set(0.5, 0.5);
      engine.stage.addChild(s);
    }
    return {
      engine,
      tick: () => {
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { duration: 3 }),

  gpuBenchmark('[GPU] 100 Graphics hexagons (static)', async (): Promise<GpuBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const g = new Graphics();
        g.beginFill(0x3a5a3a, 0.5).drawRegularPolygon(c * 80 - 400, r * 80 - 400, 35, 6).endFill();
        engine.stage.addChild(g);
      }
    }
    return {
      engine,
      tick: () => {
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { duration: 3 }),

  gpuBenchmark('[GPU] 100 Graphics hexagons (moving)', async (): Promise<GpuBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    const gfxNodes: Graphics[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const g = new Graphics();
        g.beginFill(0x3a5a3a, 0.5).drawRegularPolygon(0, 0, 35, 6).endFill();
        g.position.set(c * 80 - 400, r * 80 - 400);
        engine.stage.addChild(g);
        gfxNodes.push(g);
      }
    }
    let frame = 0;
    return {
      engine,
      tick: () => {
        frame++;
        for (const g of gfxNodes) g.position.x += Math.sin(frame * 0.01) * 0.1;
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { duration: 3 }),

  gpuBenchmark('[GPU] Sprites + Graphics interleaved (zIndex mix)', async (): Promise<GpuBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    const tex = await engine.textures.load('perf_tower', '../../assets/buildings/blue/tower/tower.png');
    for (let i = 0; i < 200; i++) {
      if (i % 3 === 0) {
        const g = new Graphics();
        g.beginFill(0x3a5a3a, 0.3).drawRect(-20, -20, 40, 40).endFill();
        g.position.set((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 600);
        g.zIndex = i;
        engine.stage.addChild(g);
      } else {
        const s = new Sprite(tex);
        s.position.set((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 600);
        s.scale.set(0.3, 0.3);
        s.anchor.set(0.5, 0.5);
        s.zIndex = i;
        engine.stage.addChild(s);
      }
    }
    return {
      engine,
      tick: () => {
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { duration: 3 }),
]);

// ==================================
// 6. UNCAPPED STRESS TESTS
// ==================================

function makeStressScene(count: number): () => Promise<StressBenchSetup> {
  return async () => {
    const engine = await createTestEngine('perf-canvas');
    const tex = await engine.textures.load('perf_tower', '../../assets/buildings/blue/tower/tower.png');
    for (let i = 0; i < count; i++) {
      const s = new Sprite(tex);
      s.position.set((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 1500);
      s.scale.set(0.1, 0.1);
      s.anchor.set(0.5, 0.5);
      engine.stage.addChild(s);
    }
    return {
      engine,
      spriteCount: count.toLocaleString(),
      tickCpuOnly: () => {
        engine.stage.updateTransform();
        // Collect renderables + build vertex data, but don't submit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = engine.renderer as any;
        r._renderList.length = 0;
        r._collectNodes(engine.stage, engine.camera.getViewportBounds());
        r._batcher.beginFrame();
        for (const node of r._renderList) {
          if (node instanceof Sprite) r._batcher.pushSprite(node);
        }
      },
      tick: () => {
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  };
}

registerAll([
  stressBenchmark('[Stress] 10k sprites throughput', makeStressScene(10_000), { frames: 100 }),
  stressBenchmark('[Stress] 50k sprites throughput', makeStressScene(50_000), { frames: 60 }),
  stressBenchmark('[Stress] 100k sprites throughput', makeStressScene(100_000), { frames: 30 }),
]);

// Draw call explosion: every sprite has unique texture -> worst-case batching
registerAll([
  stressBenchmark('[Stress] 500 sprites x 500 draw calls (1 texture per sprite)', async (): Promise<StressBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const device = (engine.renderer as any)._device as GPUDevice;
    const textures: Texture[] = [];
    // Create many unique 1x1 textures
    for (let i = 0; i < 500; i++) {
      const gpuTex = device.createTexture({
        size: [1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      device.queue.writeTexture(
        { texture: gpuTex },
        new Uint8Array([Math.random() * 255, Math.random() * 255, Math.random() * 255, 255]),
        { bytesPerRow: 4 }, [1, 1],
      );
      const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });
      const bt = new BaseTexture(gpuTex, sampler, 1, 1);
      textures.push(new Texture(bt));
    }
    for (let i = 0; i < 500; i++) {
      const s = new Sprite(textures[i]);
      s.position.set((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 600);
      s.scale.set(20, 20);
      s.anchor.set(0.5, 0.5);
      engine.stage.addChild(s);
    }
    return {
      engine,
      spriteCount: '500 (500 draw calls)',
      tick: () => {
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { frames: 60 }),
]);

// Dynamic buffer upload stress: all sprites move every frame
registerAll([
  stressBenchmark('[Stress] 10k dynamic sprites (moving every frame)', async (): Promise<StressBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    const tex = await engine.textures.load('perf_tower', '../../assets/buildings/blue/tower/tower.png');
    const sprites: Sprite[] = [];
    for (let i = 0; i < 10_000; i++) {
      const s = new Sprite(tex);
      s.position.set((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 1500);
      s.scale.set(0.1, 0.1);
      s.anchor.set(0.5, 0.5);
      engine.stage.addChild(s);
      sprites.push(s);
    }
    let frame = 0;
    return {
      engine,
      spriteCount: '10k dynamic',
      tick: () => {
        frame++;
        for (const s of sprites) {
          s.position.x += Math.sin(frame * 0.01 + s.position.y) * 0.5;
        }
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { frames: 100 }),
]);

// Overdraw stress: stacked transparent quads
registerAll([
  stressBenchmark('[Stress] Overdraw: 1000 fullscreen transparent quads', async (): Promise<StressBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const device = (engine.renderer as any)._device as GPUDevice;
    const gpuTex = device.createTexture({
      size: [1, 1], format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture: gpuTex },
      new Uint8Array([255, 255, 255, 128]),
      { bytesPerRow: 4 }, [1, 1],
    );
    const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });
    const tex = new Texture(new BaseTexture(gpuTex, sampler, 1, 1));
    for (let i = 0; i < 1000; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.5);
      s.scale.set(800, 600);
      engine.stage.addChild(s);
    }
    return {
      engine,
      spriteCount: '1000 fullscreen',
      tick: () => {
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { frames: 60 }),
]);

// Graphics vector stress: many paths
registerAll([
  stressBenchmark('[Stress] 1000 Graphics hexagons (moving)', async (): Promise<StressBenchSetup> => {
    const engine = await createTestEngine('perf-canvas');
    const gfxNodes: Graphics[] = [];
    for (let i = 0; i < 1000; i++) {
      const g = new Graphics();
      g.beginFill(0x3a5a3a, 0.5).drawRegularPolygon(0, 0, 15, 6).endFill();
      g.position.set((Math.random() - 0.5) * 1600, (Math.random() - 0.5) * 1200);
      engine.stage.addChild(g);
      gfxNodes.push(g);
    }
    let frame = 0;
    return {
      engine,
      spriteCount: '1000 hexagons',
      tick: () => {
        frame++;
        for (const g of gfxNodes) g.position.x += Math.sin(frame * 0.02) * 0.3;
        engine.stage.updateTransform();
        engine.renderer.render(engine.stage, engine.camera);
      },
    };
  }, { frames: 60 }),
]);
