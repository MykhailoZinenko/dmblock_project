import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine.js";

export default function Visual01() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;

    (async () => {
      try {
        engine = await Engine.create(canvas, {
          backgroundColor: 0x1a1a3e,
        });
        if (statusRef.current) {
          statusRef.current.innerHTML = '<span style="color:lime">✓ Engine created, clearing to 0x1a1a3e</span>';
        }
      } catch (e: any) {
        if (statusRef.current) {
          statusRef.current.innerHTML = `<span style="color:red">✗ ${e.message}</span>`;
        }
      }
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Test 01: Clear Screen</strong><br />
        Expected: Canvas fills with dark navy blue (0x1a1a3e).<br />
        If you see black or an error, WebGPU init failed.<br />
        <span ref={statusRef} />
      </div>
    </div>
  );
}
