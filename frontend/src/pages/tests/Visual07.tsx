import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine";
import { Sprite } from "../../engine/nodes/Sprite";

export default function Visual07() {
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
        backgroundColor: 0x1a1a2e,
      });

      const tex = await engine.textures.load('tower', '/assets/buildings/blue/tower/tower.png');

      for (let x = -5; x <= 5; x++) {
        for (let y = -5; y <= 5; y++) {
          const s = new Sprite(tex);
          s.position.set(x * 200, y * 200);
          s.anchor.set(0.5, 0.5);
          s.scale.set(0.5, 0.5);
          engine.stage.addChild(s);
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

      const speed = 300;
      engine.ticker.add((dt: number) => {
        let moved = false;
        if (keys['KeyW'] || keys['ArrowUp'])    { engine!.camera.position.y -= speed * dt; moved = true; }
        if (keys['KeyS'] || keys['ArrowDown'])  { engine!.camera.position.y += speed * dt; moved = true; }
        if (keys['KeyA'] || keys['ArrowLeft'])  { engine!.camera.position.x -= speed * dt; moved = true; }
        if (keys['KeyD'] || keys['ArrowRight']) { engine!.camera.position.x += speed * dt; moved = true; }
        if (moved) engine!.camera.dirty = true;
        if (infoRef.current) {
          infoRef.current.innerHTML = `<strong>Camera</strong><br>Pos: ${engine!.camera.position.x.toFixed(0)}, ${engine!.camera.position.y.toFixed(0)}<br>Zoom: ${engine!.camera.zoom.toFixed(2)}<br>FPS: ${engine!.ticker.fps.toFixed(0)}`;
        }
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
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div ref={infoRef} style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 07: Camera</strong><br />
        WASD/Arrows to pan, scroll to zoom.
      </div>
    </div>
  );
}
