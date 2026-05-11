import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine";
import { Sprite } from "../../engine/nodes/Sprite";
import { AnimatedSprite } from "../../engine/nodes/AnimatedSprite";
import { SpriteSheet } from "../../engine/textures/SpriteSheet";
import { Text } from "../../engine/nodes/Text";

const ASSETS_BASE = '/assets/';
const COL_WIDTH = 180;
const ROW_HEIGHT = 220;
const SPRITE_SCALE = 2;
const LABEL_OFFSET_Y = 80;
const START_X = -500;
const START_Y = -300;

interface AssetItem {
  name: string;
  path: string;
  frameW?: number;
  frameH?: number;
  gridRow?: number;
  frameCols?: number;
  scaleAs?: number;
  single?: boolean;
}

interface AssetSection {
  title: string;
  items: AssetItem[];
}

const SECTIONS: AssetSection[] = [
  {
    title: 'Units',
    items: [
      { name: 'Pawn', path: 'units/blue/pawn/pawn.png', frameW: 192, frameH: 192, gridRow: 0 },
      { name: 'Pawn v1', path: 'units/blue/pawn_v1/pawn_idle.png', frameW: 192 },
      { name: 'Pawn v1 (Axe)', path: 'units/blue/pawn_v1/pawn_idle_axe.png', frameW: 192 },
      { name: 'Pawn v1 (Hammer)', path: 'units/blue/pawn_v1/pawn_idle_hammer.png', frameW: 192 },
      { name: 'Pawn v1 (Knife)', path: 'units/blue/pawn_v1/pawn_idle_knife.png', frameW: 192 },
      { name: 'Pawn v1 (Pickaxe)', path: 'units/blue/pawn_v1/pawn_idle_pickaxe.png', frameW: 192 },
      { name: 'Pawn v1 (Gold)', path: 'units/blue/pawn_v1/pawn_idle_gold.png', frameW: 192 },
      { name: 'Pawn v1 (Meat)', path: 'units/blue/pawn_v1/pawn_idle_meat.png', frameW: 192 },
      { name: 'Pawn v1 (Wood)', path: 'units/blue/pawn_v1/pawn_idle_wood.png', frameW: 192 },
      { name: 'Warrior', path: 'units/blue/warrior/warrior.png', frameW: 192, frameH: 192, gridRow: 0 },
      { name: 'Warrior v1', path: 'units/blue/warrior_v1/warrior_idle.png', frameW: 192 },
      { name: 'Warrior v1 (Atk1)', path: 'units/blue/warrior_v1/warrior_attack1.png', frameW: 192 },
      { name: 'Warrior v1 (Atk2)', path: 'units/blue/warrior_v1/warrior_attack2.png', frameW: 192 },
      { name: 'Warrior v1 (Guard)', path: 'units/blue/warrior_v1/warrior_guard.png', frameW: 192 },
      { name: 'Archer', path: 'units/blue/archer/archer.png', frameW: 192, frameH: 192, gridRow: 0, frameCols: 6 },
      { name: 'Archer v1', path: 'units/blue/archer_v1/archer_idle.png', frameW: 192 },
      { name: 'Archer v1 (Shoot)', path: 'units/blue/archer_v1/archer_shoot.png', frameW: 192 },
      { name: 'Lancer', path: 'units/blue/lancer/lancer_idle.png', frameW: 320, scaleAs: 192 },
      { name: 'Monk', path: 'units/blue/monk_v1/idle.png', frameW: 192 },
      { name: 'Monk (Heal)', path: 'units/blue/monk_v1/heal.png', frameW: 192 },
      { name: 'Monk (Heal FX)', path: 'units/blue/monk_v1/heal_effect.png', frameW: 192 },
    ],
  },
  {
    title: 'Goblins',
    items: [
      { name: 'Barrel', path: 'units/goblins/barrel/barrel_blue.png', frameW: 128, frameH: 128, gridRow: 1, frameCols: 6 },
      { name: 'TNT', path: 'units/goblins/tnt/tnt_blue.png', frameW: 192, frameH: 192, gridRow: 0, frameCols: 6 },
      { name: 'Torch', path: 'units/goblins/torch/torch_blue.png', frameW: 192, frameH: 192, gridRow: 0 },
    ],
  },
  {
    title: 'Buildings',
    items: [
      { name: 'Tower', path: 'buildings/blue/tower/tower.png', single: true },
      { name: 'Barracks', path: 'buildings/blue/barracks/barracks.png', single: true },
      { name: 'Castle', path: 'buildings/blue/castle/castle.png', single: true },
      { name: 'Cathedral', path: 'buildings/blue/cathedral/cathedral.png', single: true },
      { name: 'House', path: 'buildings/blue/house/house.png', single: true },
      { name: 'Monastery', path: 'buildings/blue/monastery/monastery.png', single: true },
      { name: 'Archery Range', path: 'buildings/blue/archery_range/archery_range.png', single: true },
    ],
  },
  {
    title: 'Sheep & FX',
    items: [
      { name: 'Sheep (Idle)', path: 'terrain/sheep/happysheep_idle.png', frameW: 128 },
      { name: 'Sheep (Bounce)', path: 'terrain/sheep/happysheep_bouncing.png', frameW: 128 },
      { name: 'Explosion 1', path: 'fx/explosion_01.png', frameW: 192 },
      { name: 'Explosion 2', path: 'fx/explosion_02.png', frameW: 192 },
      { name: 'Fire 1', path: 'fx/fire_01.png', frameW: 64 },
      { name: 'Fire 2', path: 'fx/fire_02.png', frameW: 64 },
      { name: 'Fire 3', path: 'fx/fire_03.png', frameW: 64 },
      { name: 'Dust 1', path: 'fx/dust_01.png', frameW: 64 },
      { name: 'Dust 2', path: 'fx/dust_02.png', frameW: 64 },
      { name: 'Water Splash', path: 'fx/water_splash.png', frameW: 192 },
    ],
  },
];

export default function VisualAssetRegistry() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;
    const keys: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };

    (async () => {
      try {
        engine = await Engine.create(canvas, {
          backgroundColor: 0x1a1a2e,
        });

        await engine.loadFont('/assets/fonts/PatrickHand.png', '/assets/fonts/PatrickHand.json');

        const COLS = 6;
        let globalIdx = 0;

        for (const section of SECTIONS) {
          const sectionRow = Math.floor(globalIdx / COLS);
          const titleNode = new Text(`— ${section.title} —`, {
            fontSize: 22,
            fill: 0xffffff,
          });
          titleNode.position.set(START_X, START_Y + sectionRow * ROW_HEIGHT - 30);
          engine.stage.addChild(titleNode);

          if (globalIdx % COLS !== 0) {
            globalIdx += COLS - (globalIdx % COLS);
          }

          for (const item of section.items) {
            const col = globalIdx % COLS;
            const row = Math.floor(globalIdx / COLS);
            const x = START_X + col * COL_WIDTH;
            const y = START_Y + row * ROW_HEIGHT;

            const tex = await engine.textures.load(
              `reg_${globalIdx}`,
              ASSETS_BASE + item.path
            );

            let displayNode: any;

            if (item.single) {
              displayNode = new Sprite(tex);
              displayNode.anchor.set(0.5, 0.5);
              const maxDim = Math.max(tex.width, tex.height);
              const s = Math.min(120 / maxDim, SPRITE_SCALE);
              displayNode.scale.set(s, s);
            } else if (item.gridRow !== undefined) {
              const fw = item.frameW!;
              const fh = item.frameH || fw;
              const frames = SpriteSheet.fromGridRow(tex, fw, fh, item.gridRow, item.frameCols);
              displayNode = new AnimatedSprite(frames);
              displayNode.anchor.set(0.5, 0.5);
              const s = 120 / Math.max(fw, fh);
              displayNode.scale.set(s, s);
              displayNode.animationSpeed = 0.12;
              displayNode.play();
            } else {
              const frames = SpriteSheet.fromStrip(tex, item.frameW!);
              displayNode = new AnimatedSprite(frames);
              displayNode.anchor.set(0.5, 0.5);
              const fh = frames[0].height;
              const dim = item.scaleAs || Math.max(item.frameW!, fh);
              const s = 120 / dim;
              displayNode.scale.set(s, s);
              displayNode.animationSpeed = 0.12;
              displayNode.play();
            }

            displayNode.position.set(x, y);
            engine.stage.addChild(displayNode);

            const label = new Text(item.name, {
              fontSize: 12,
              fill: 0xcccccc,
            });
            label.position.set(x - 60, y + LABEL_OFFSET_Y);
            engine.stage.addChild(label);

            globalIdx++;
          }
        }

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          engine!.camera.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
          engine!.camera.zoom = Math.max(0.1, Math.min(10, engine!.camera.zoom));
          engine!.camera.dirty = true;
        };
        engine.canvas.addEventListener('wheel', onWheel, { passive: false });

        const PAN_SPEED = 400;
        engine.ticker.add((dt: number) => {
          let moved = false;
          if (keys['KeyW'] || keys['ArrowUp'])    { engine!.camera.position.y -= PAN_SPEED * dt; moved = true; }
          if (keys['KeyS'] || keys['ArrowDown'])  { engine!.camera.position.y += PAN_SPEED * dt; moved = true; }
          if (keys['KeyA'] || keys['ArrowLeft'])  { engine!.camera.position.x -= PAN_SPEED * dt; moved = true; }
          if (keys['KeyD'] || keys['ArrowRight']) { engine!.camera.position.x += PAN_SPEED * dt; moved = true; }
          if (moved) engine!.camera.dirty = true;
        });

        if (infoRef.current) {
          infoRef.current.innerHTML += '<br><span style="color:lime">✓ Registry loaded</span><br>WASD/Arrows to pan, scroll to zoom';
        }
      } catch (e: any) {
        if (infoRef.current) {
          infoRef.current.innerHTML += `<br><span style="color:red">✗ ${e.message}</span>`;
        }
        console.error(e);
      }
    })();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      engine?.destroy();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div ref={infoRef} style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1, pointerEvents: "none" }}>
        <strong>Asset Registry</strong><br />
        Scroll to browse. All sprites rendered via WebGPU engine.
      </div>
    </div>
  );
}
