import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine";
import { Container } from "../../engine/nodes/Container";
import { AnimatedSprite } from "../../engine/nodes/AnimatedSprite";
import { Graphics } from "../../engine/nodes/Graphics";
import { Text } from "../../engine/nodes/Text";
import { SpriteSheet } from "../../engine/textures/SpriteSheet";

export default function Visual13() {
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
      engine = await Engine.create(canvas, {
        backgroundColor: 0x1a2a1a,
      });
      await engine.loadFont(
        '/assets/fonts/PatrickHand.png',
        '/assets/fonts/PatrickHand.json',
      );

      // ---- hex constants (pointy-top, odd-r offset) ----
      const SIZE = 48;
      const COLS = 8;
      const ROWS = 6;
      const S3 = Math.sqrt(3);

      function hex2px(c: number, r: number) {
        return {
          x: SIZE * S3 * (c + 0.5 * (r & 1)),
          y: SIZE * 1.5 * r,
        };
      }

      function px2hex(px: number, py: number) {
        const q = (px * S3 / 3 - py / 3) / SIZE;
        const r = (py * 2 / 3) / SIZE;
        const s = -q - r;
        let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
        const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
        if (dq > dr && dq > ds) rq = -rr - rs;
        else if (dr > ds) rr = -rq - rs;
        return { col: rq + (rr - (rr & 1)) / 2, row: rr };
      }

      // ---- scene layers ----
      const gridLayer = new Container();
      const unitLayer = new Container();
      gridLayer.zIndex = 0;
      unitLayer.zIndex = 10;
      engine.stage.addChild(gridLayer);
      engine.stage.addChild(unitLayer);

      // ---- draw grid ----
      const cells = new Map<string, { x: number; y: number }>();
      const grid = new Graphics();
      gridLayer.addChild(grid);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const p = hex2px(c, r);
          cells.set(`${c},${r}`, p);
          grid.lineStyle(2, 0x3a5a3a);
          grid.beginFill(0x2a4a2a, 0.3);
          grid.drawRegularPolygon(p.x, p.y, SIZE - 2, 6);
          grid.endFill();
        }
      }

      // ---- selection highlight ----
      const selGfx = new Graphics();
      selGfx.visible = false;
      gridLayer.addChild(selGfx);

      function highlight(x: number, y: number) {
        selGfx.clear();
        selGfx.lineStyle(3, 0xf1c40f);
        selGfx.beginFill(0xf1c40f, 0.15);
        selGfx.drawRegularPolygon(x, y, SIZE - 2, 6);
        selGfx.endFill();
        selGfx.visible = true;
      }

      // ---- load sprites ----
      const archerTex = await engine.textures.load(
        'archer_idle', '/assets/units/blue/archer_v1/archer_idle.png');
      const warriorTex = await engine.textures.load(
        'warrior_idle', '/assets/units/blue/warrior_v1/warrior_idle.png');

      const archerFrames = SpriteSheet.fromStrip(archerTex, 192);
      const warriorFrames = SpriteSheet.fromStrip(warriorTex, 192);

      // ---- create units ----
      interface Unit {
        wrap: Container;
        spr: AnimatedSprite;
        col: number;
        row: number;
        name: string;
      }
      const units: Unit[] = [];

      function spawnUnit(frames: any[], col: number, row: number, name: string) {
        const pos = hex2px(col, row);

        const wrap = new Container();
        wrap.position.set(pos.x, pos.y);

        const spr = new AnimatedSprite(frames);
        spr.anchor.set(0.5, 0.75);
        spr.scale.set(0.4, 0.4);
        spr.animationSpeed = 0.12;
        spr.play();
        wrap.addChild(spr);

        const lbl = new Text(name, { fontSize: 16, fill: 0xffffff });
        lbl.position.set(-20, -55);
        wrap.addChild(lbl);

        unitLayer.addChild(wrap);
        const u: Unit = { wrap, spr, col, row, name };
        units.push(u);
        return u;
      }

      spawnUnit(archerFrames, 1, 1, 'Archer');
      spawnUnit(archerFrames, 3, 2, 'Ranger');
      spawnUnit(warriorFrames, 5, 1, 'Knight');
      spawnUnit(warriorFrames, 6, 4, 'Guard');

      // ---- camera ----
      const mid = hex2px(COLS / 2, ROWS / 2);
      engine.camera.position.set(mid.x, mid.y);
      engine.camera.zoom = 1.8;
      engine.camera.dirty = true;

      // ---- selection state ----
      let selected: Unit | null = null;

      function worldFromEvent(e: PointerEvent) {
        const rect = engine!.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return engine!.camera.screenToWorld(
          (e.clientX - rect.left) * dpr,
          (e.clientY - rect.top) * dpr,
        );
      }

      function updateInfo(msg: string) {
        if (infoRef.current) {
          infoRef.current.innerHTML = `<strong>Hex Grid</strong> | LClick: select | RClick: move | WASD: pan | Scroll: zoom${msg ? '<br>' + msg : ''}`;
        }
      }

      const onPointerDown = (e: PointerEvent) => {
        const w = worldFromEvent(e);
        const h = px2hex(w.x, w.y);
        const key = `${h.col},${h.row}`;

        if (e.button === 0) {
          const hit = units.find(u => u.col === h.col && u.row === h.row);
          if (hit) {
            selected = hit;
            const p = hex2px(hit.col, hit.row);
            highlight(p.x, p.y);
            updateInfo(`Selected: ${hit.name}`);
          } else {
            selected = null;
            selGfx.visible = false;
            updateInfo('');
          }
        }

        if (e.button === 2 && selected && cells.has(key)) {
          const blocked = units.find(u => u !== selected && u.col === h.col && u.row === h.row);
          if (!blocked) {
            selected.col = h.col;
            selected.row = h.row;
            const target = hex2px(h.col, h.row);
            moveUnit(selected, target.x, target.y);
            highlight(target.x, target.y);
            updateInfo(`${selected.name} -> (${h.col}, ${h.row})`);
          }
        }
      };
      engine.canvas.addEventListener('pointerdown', onPointerDown);

      function moveUnit(u: Unit, tx: number, ty: number) {
        const sx = u.wrap.position.x, sy = u.wrap.position.y;
        let t = 0;
        const fn = (dt: number) => {
          t += dt;
          const p = Math.min(t / 0.3, 1);
          const ease = 1 - (1 - p) * (1 - p) * (1 - p);
          u.wrap.position.set(sx + (tx - sx) * ease, sy + (ty - sy) * ease);
          if (p >= 1) engine!.ticker.remove(fn);
        };
        engine!.ticker.add(fn);
      }

      // ---- camera controls ----
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        engine!.camera.zoom = Math.max(0.3, Math.min(5,
          engine!.camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
        engine!.camera.dirty = true;
      };
      engine.canvas.addEventListener('wheel', onWheel, { passive: false });

      engine.ticker.add((dt: number) => {
        const sp = 200;
        let moved = false;
        if (keys['KeyW'] || keys['ArrowUp'])    { engine!.camera.position.y -= sp * dt; moved = true; }
        if (keys['KeyS'] || keys['ArrowDown'])  { engine!.camera.position.y += sp * dt; moved = true; }
        if (keys['KeyA'] || keys['ArrowLeft'])  { engine!.camera.position.x -= sp * dt; moved = true; }
        if (keys['KeyD'] || keys['ArrowRight']) { engine!.camera.position.x += sp * dt; moved = true; }
        if (moved) engine!.camera.dirty = true;
      });
    })();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      engine?.destroy();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div ref={infoRef} style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Hex Grid</strong> | LClick: select | RClick: move | WASD: pan | Scroll: zoom
      </div>
    </div>
  );
}
