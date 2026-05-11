import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine.js";
import { Sprite } from "../../engine/nodes/Sprite.js";

export default function Visual04() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;

    (async () => {
      engine = await Engine.create(canvas, {
        backgroundColor: 0x1a1a2e,
      });

      const tex = await engine.textures.load('tower', '/assets/buildings/blue/tower/tower.png');

      const sprites: any[] = [];
      for (let i = 0; i < 500; i++) {
        const s = new Sprite(tex);
        s.position.set((Math.random() - 0.5) * 1200, (Math.random() - 0.5) * 800);
        s.scale.set(0.4, 0.4);
        s.anchor.set(0.5, 0.5);
        engine.stage.addChild(s);
        sprites.push(s);
      }

      engine.ticker.add((dt: number) => {
        for (const s of sprites) s.rotation += dt;
        if (infoRef.current) {
          infoRef.current.innerHTML = `<strong>Test 04: Sprite Batching</strong><br>500 sprites | FPS: ${engine!.ticker.fps.toFixed(1)}`;
        }
      });
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div ref={infoRef} style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 04: Sprite Batching</strong><br />
        Expected: 500 sprites scattered, all rotating. FPS should be ~60.
      </div>
    </div>
  );
}
