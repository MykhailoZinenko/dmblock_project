import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine.js";
import { Sprite } from "../../engine/nodes/Sprite.js";

export default function Visual03() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;

    (async () => {
      engine = await Engine.create(canvas, {
        backgroundColor: 0x1a1a2e,
      });

      const tex = await engine.textures.load('tower', '/assets/buildings/blue/tower/tower.png');

      const s1 = new Sprite(tex);
      s1.anchor.set(0.5, 0.5);
      s1.position.set(-300, -50);
      engine.stage.addChild(s1);

      const s2 = new Sprite(tex);
      s2.anchor.set(0.5, 0.5);
      s2.position.set(-100, -50);
      s2.scale.set(2, 2);
      engine.stage.addChild(s2);

      const s3 = new Sprite(tex);
      s3.anchor.set(0.5, 0.5);
      s3.position.set(150, -50);
      s3.rotation = Math.PI / 4;
      engine.stage.addChild(s3);

      const s4 = new Sprite(tex);
      s4.anchor.set(0.5, 0.5);
      s4.position.set(350, -50);
      engine.stage.addChild(s4);

      engine.ticker.add((dt: number) => {
        s4.rotation += dt * 2;
      });
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 03: Sprite Transforms</strong><br />
        Expected: 4 towers — normal, scaled 2x, rotated 45deg, spinning continuously.
      </div>
    </div>
  );
}
