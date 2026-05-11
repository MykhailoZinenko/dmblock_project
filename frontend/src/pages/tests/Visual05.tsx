import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine.js";
import { AnimatedSprite } from "../../engine/nodes/AnimatedSprite.js";
import { SpriteSheet } from "../../engine/textures/SpriteSheet.js";

export default function Visual05() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;

    (async () => {
      engine = await Engine.create(canvas, {
        backgroundColor: 0x1a1a2e,
      });

      async function addUnit(key: string, url: string, frameWidth: number, x: number) {
        const tex = await engine!.textures.load(key, url);
        const frames = SpriteSheet.fromStrip(tex, frameWidth);
        const sprite = new AnimatedSprite(frames);
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(x, 0);
        sprite.animationSpeed = 0.12;
        sprite.play();
        engine!.stage.addChild(sprite);
      }

      await addUnit('archer_idle', '/assets/units/blue/archer_v1/archer_idle.png', 192, -250);
      await addUnit('warrior_idle', '/assets/units/blue/warrior_v1/warrior_idle.png', 192, 0);
      await addUnit('pawn_idle', '/assets/units/blue/pawn_v1/pawn_idle.png', 192, 250);
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 05: Animated Sprite</strong><br />
        Expected: Three animated units — archer idle, warrior idle, lancer idle.
      </div>
    </div>
  );
}
