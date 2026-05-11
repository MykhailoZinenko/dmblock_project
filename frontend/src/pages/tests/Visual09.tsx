import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine";
import { Text } from "../../engine/nodes/Text";

export default function Visual09() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;

    (async () => {
      engine = await Engine.create(canvas, {
        backgroundColor: 0x1a1a2e,
      });

      await engine.loadFont('/assets/fonts/PatrickHand.png', '/assets/fonts/PatrickHand.json');

      const x = -200;

      const title = new Text('Arcana Arena', { fontSize: 64, fill: 0xf1c40f });
      title.position.set(x, -180);
      engine.stage.addChild(title);

      const damage = new Text('+125 Damage', { fontSize: 40, fill: 0xe74c3c });
      damage.position.set(x, -90);
      engine.stage.addChild(damage);

      const small = new Text('Hello World!', { fontSize: 28, fill: 0xffffff });
      small.position.set(x, -30);
      engine.stage.addChild(small);

      const wrapped = new Text('This is a longer text that should wrap to multiple lines when word wrap is enabled.', {
        fontSize: 28,
        fill: 0x2ecc71,
        wordWrap: true,
        wordWrapWidth: 400,
      });
      wrapped.position.set(x, 30);
      engine.stage.addChild(wrapped);
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 09: MSDF Text</strong><br />
        Expected: Centered text at various sizes and colors.
      </div>
    </div>
  );
}
