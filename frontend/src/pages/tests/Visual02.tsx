import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine";
import { Sprite } from "../../engine/nodes/Sprite";
import { SpriteSheet } from "../../engine/textures/SpriteSheet";
import { AnimatedSprite } from "../../engine/nodes/AnimatedSprite";

export default function Visual02() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;

    (async () => {
      try {
        engine = await Engine.create(canvas, {
          backgroundColor: 0x2a2a3e,
        });

        // Single-frame sprite: tower (128x256)
        const towerTex = await engine.textures.load('tower', '/assets/buildings/blue/tower/tower.png');
        const tower = new Sprite(towerTex);
        tower.anchor.set(0.5, 1.0);
        tower.position.set(0, 100);
        engine.stage.addChild(tower);

        // Animated sprite: archer idle strip (1152x192, 6 frames of 192px)
        const archerTex = await engine.textures.load('archer_idle', '/assets/units/blue/archer_v1/archer_idle.png');
        const frames = SpriteSheet.fromStrip(archerTex, 192);
        const archer = new AnimatedSprite(frames);
        archer.anchor.set(0.5, 0.5);
        archer.position.set(200, 0);
        archer.animationSpeed = 0.15;
        archer.play();
        engine.stage.addChild(archer);

        if (statusRef.current) {
          statusRef.current.innerHTML = '<span style="color:lime">✓ Sprites rendered</span>';
        }
      } catch (e: any) {
        if (statusRef.current) {
          statusRef.current.innerHTML = `<span style="color:red">✗ ${e.message}</span>`;
        }
        console.error(e);
      }
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 02: Single Sprite</strong><br />
        Expected: A tower sprite near screen center, an archer sprite sheet to its right.<br />
        <span ref={statusRef} />
      </div>
    </div>
  );
}
