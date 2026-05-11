import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine.js";
import { ParticleContainer } from "../../engine/nodes/ParticleContainer.js";

export default function Visual10() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;
    let rafId: number | null = null;

    // FPS counter
    let frames = 0;
    let lastTime = performance.now();
    function updateFps() {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        if (fpsRef.current) fpsRef.current.textContent = `FPS: ${frames}`;
        frames = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(updateFps);
    }
    rafId = requestAnimationFrame(updateFps);

    (async () => {
      engine = await Engine.create(canvas, {
        backgroundColor: 0x1a1a2e,
      });

      const tex = await engine.textures.load('tower', '/assets/buildings/blue/tower/tower.png');

      const pc = new ParticleContainer();
      engine.stage.addChild(pc);

      const particles: any[] = [];
      for (let i = 0; i < 1000; i++) {
        const p = {
          x: (Math.random() - 0.5) * 1600,
          y: (Math.random() - 0.5) * 1200,
          scaleX: 0.3 + Math.random() * 0.4,
          scaleY: 0.3 + Math.random() * 0.4,
          rotation: Math.random() * Math.PI * 2,
          alpha: 0.5 + Math.random() * 0.5,
          tint: Math.floor(Math.random() * 0xFFFFFF),
          texture: tex,
          vr: (Math.random() - 0.5) * 0.02,
        };
        particles.push(p);
        pc.addParticle(p);
      }

      engine.ticker.add((dt: number) => {
        for (const p of particles) {
          p.rotation += p.vr * dt;
        }
        pc._dirty = true;
      });
    })();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      engine?.destroy();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 10: ParticleContainer</strong><br />
        1000 particles, instanced rendering
      </div>
      <div ref={fpsRef} style={{ position: "fixed", top: 10, right: 10, color: "#0f0", font: "14px monospace", zIndex: 1 }}>
        FPS: --
      </div>
    </div>
  );
}
