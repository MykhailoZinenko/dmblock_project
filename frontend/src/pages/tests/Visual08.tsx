import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine.js";
import { Sprite } from "../../engine/nodes/Sprite.js";

export default function Visual08() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;

    (async () => {
      engine = await Engine.create(canvas, { backgroundColor: 0x1a1a2e });
      const tex = await engine.textures.load("tower", "/assets/buildings/blue/tower/tower.png");

      const log = (msg: string) => {
        if (!logRef.current) return;
        const line = document.createElement("div");
        line.textContent = msg;
        logRef.current.prepend(line);
        if (logRef.current.children.length > 50) logRef.current.lastChild?.remove();
      };

      for (let i = 0; i < 3; i++) {
        const s = new Sprite(tex);
        const label = `Sprite ${i + 1}`;
        s.position.set(-200 + i * 200, 0);
        s.anchor.set(0.5, 0.5);
        s.interactive = true;
        s.cursor = "pointer";

        s.on("pointertap", (ev: unknown) => {
          const e = ev as { worldX: number; worldY: number };
          log(`TAP on ${label} at (${e.worldX.toFixed(0)}, ${e.worldY.toFixed(0)})`);
        });
        s.on("pointerover", () => { log(`OVER ${label}`); });
        s.on("pointerout", () => { log(`OUT ${label}`); });

        engine.stage.addChild(s);
      }
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 08: Interaction</strong><br />
        Click sprites. Hover to change cursor.
      </div>
      <div ref={logRef} style={{ position: "fixed", top: 10, right: 10, color: "#0f0", font: "12px monospace", zIndex: 1, maxHeight: "90vh", overflowY: "auto", background: "rgba(0,0,0,0.7)", padding: 8, width: 320 }} />
    </div>
  );
}
