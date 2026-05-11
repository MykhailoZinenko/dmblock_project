import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine";
import { Sprite } from "../../engine/nodes/Sprite";
import { Text } from "../../engine/nodes/Text";

export default function VisualDebugContainer() {
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
      await engine.loadFont('/assets/fonts/PatrickHand.png', '/assets/fonts/PatrickHand.json');
      const tex = await engine.textures.load('tower', '/assets/buildings/blue/tower/tower.png');

      // Just 2 sprites and 1 text, all on stage
      const s1 = new Sprite(tex);
      s1.anchor.set(0.5, 0.5);
      s1.position.set(-150, 0);
      engine.stage.addChild(s1);

      const t1 = new Text('Hello', { fontSize: 32, fill: 0xffffff });
      t1.position.set(-30, -100);
      engine.stage.addChild(t1);

      const s2 = new Sprite(tex);
      s2.anchor.set(0.5, 0.5);
      s2.position.set(150, 0);
      engine.stage.addChild(s2);

      // Log what the renderer sees
      setTimeout(() => {
        if (!engine) return;
        const list = (engine.renderer as any)._renderList;
        console.log('renderList:', list.map((n: any) => n.constructor.name));
        for (const n of list) {
          const b = n.getBounds();
          console.log(n.constructor.name, 'bounds:', b.minX.toFixed(0), b.minY.toFixed(0), b.maxX.toFixed(0), b.maxY.toFixed(0));
          if (n.texture) {
            console.log('  texture:', n.texture.width, 'x', n.texture.height, 'gpu:', !!n.texture.baseTexture.gpuTexture);
          }
        }
      }, 500);

      if (infoRef.current) {
        infoRef.current.textContent = 'Expected: 2 towers + "Hello" text between them';
      }
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div ref={infoRef} style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }} />
    </div>
  );
}
