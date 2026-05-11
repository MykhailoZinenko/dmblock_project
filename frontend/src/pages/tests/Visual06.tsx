import { useEffect, useRef } from "react";
import { Engine } from "../../engine/Engine";
import { Graphics } from "../../engine/nodes/Graphics";

export default function Visual06() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;

    (async () => {
      try {
        engine = await Engine.create(canvas, {
          backgroundColor: 0x1a1a2e,
        });

        // --- Row 1: Basic primitives ---
        const rect = new Graphics();
        rect.beginFill(0xe74c3c).drawRect(-60, -40, 120, 80).endFill();
        rect.position.set(-350, -200);
        engine.stage.addChild(rect);

        const circle = new Graphics();
        circle.beginFill(0x2ecc71).drawCircle(0, 0, 50).endFill();
        circle.position.set(-120, -200);
        engine.stage.addChild(circle);

        const hex = new Graphics();
        hex.beginFill(0x3498db).drawRegularPolygon(0, 0, 50, 6).endFill();
        hex.position.set(120, -200);
        engine.stage.addChild(hex);

        const tri = new Graphics();
        tri.beginFill(0xf1c40f).drawPolygon([-50, 40, 50, 40, 0, -40]).endFill();
        tri.position.set(350, -200);
        engine.stage.addChild(tri);

        // --- Row 2: Complex concave shapes ---

        // Arrow (concave, moveTo/lineTo)
        const arrow = new Graphics();
        arrow.beginFill(0xe67e22);
        arrow.moveTo(0, -60);
        arrow.lineTo(50, 0);
        arrow.lineTo(20, 0);
        arrow.lineTo(20, 60);
        arrow.lineTo(-20, 60);
        arrow.lineTo(-20, 0);
        arrow.lineTo(-50, 0);
        arrow.endFill();
        arrow.position.set(-350, 0);
        engine.stage.addChild(arrow);

        // Star (concave polygon)
        const star = new Graphics();
        star.beginFill(0x9b59b6);
        const starPts: number[] = [];
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? 50 : 22;
          starPts.push(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        star.drawPolygon(starPts);
        star.endFill();
        star.position.set(-120, 0);
        engine.stage.addChild(star);

        // L-shape (concave, moveTo/lineTo)
        const lShape = new Graphics();
        lShape.beginFill(0x1abc9c);
        lShape.moveTo(-40, -45);
        lShape.lineTo(-10, -45);
        lShape.lineTo(-10, 15);
        lShape.lineTo(40, 15);
        lShape.lineTo(40, 45);
        lShape.lineTo(-40, 45);
        lShape.endFill();
        lShape.position.set(120, 0);
        engine.stage.addChild(lShape);

        // Outlined rect: fill + line border
        const outlined = new Graphics();
        outlined.lineStyle(4, 0xe74c3c);
        outlined.beginFill(0xffffff, 0.15);
        outlined.drawRect(-50, -35, 100, 70);
        outlined.endFill();
        outlined.position.set(350, 0);
        engine.stage.addChild(outlined);

        // --- Row 3: Rounded rects, transparency, complex lines ---

        // Rounded rect
        const rounded = new Graphics();
        rounded.beginFill(0x8e44ad).drawRoundedRect(-60, -30, 120, 60, 15).endFill();
        rounded.position.set(-350, 200);
        engine.stage.addChild(rounded);

        // Overlapping transparency
        const bg = new Graphics();
        bg.beginFill(0xffffff).drawCircle(0, 0, 45).endFill();
        bg.position.set(-120, 200);
        engine.stage.addChild(bg);

        const overR = new Graphics();
        overR.beginFill(0xe74c3c, 0.5).drawCircle(-15, -10, 35).endFill();
        overR.position.set(-120, 200);
        engine.stage.addChild(overR);

        const overB = new Graphics();
        overB.beginFill(0x3498db, 0.5).drawCircle(15, -10, 35).endFill();
        overB.position.set(-120, 200);
        engine.stage.addChild(overB);

        const overG = new Graphics();
        overG.beginFill(0x2ecc71, 0.5).drawCircle(0, 15, 35).endFill();
        overG.position.set(-120, 200);
        engine.stage.addChild(overG);

        // Complex line path: zigzag
        const zigzag = new Graphics();
        zigzag.lineStyle(3, 0xf39c12);
        zigzag.beginFill(0x000000, 0);
        zigzag.moveTo(-60, 30);
        zigzag.lineTo(-40, -30);
        zigzag.lineTo(-20, 30);
        zigzag.lineTo(0, -30);
        zigzag.lineTo(20, 30);
        zigzag.lineTo(40, -30);
        zigzag.lineTo(60, 30);
        zigzag.endFill();
        zigzag.position.set(120, 200);
        engine.stage.addChild(zigzag);

        // Pentagon with thick outline
        const pent = new Graphics();
        pent.lineStyle(5, 0x00ffff);
        pent.beginFill(0x2c3e50);
        pent.drawRegularPolygon(0, 0, 45, 5);
        pent.endFill();
        pent.position.set(350, 200);
        engine.stage.addChild(pent);

        if (statusRef.current) {
          statusRef.current.innerHTML = '<span style="color:lime">OK</span>';
        }
      } catch (e: any) {
        if (statusRef.current) {
          statusRef.current.innerHTML = `<span style="color:red">${e.message}</span>`;
        }
        console.error(e);
      }
    })();

    return () => { engine?.destroy(); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1, maxWidth: 500 }}>
        <strong>Test 06: Graphics</strong><br />
        Row 1: Red rect, green circle, blue hexagon, yellow triangle<br />
        Row 2: Orange arrow (concave), purple star, teal L-shape, white outlined rect with red border<br />
        Row 3: Rounded rects, overlapping transparency, complex line path<br />
        <span ref={statusRef} />
      </div>
    </div>
  );
}
