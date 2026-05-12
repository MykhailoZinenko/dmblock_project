import { useEffect, useRef, useState, useCallback } from "react";
import { Engine } from "../engine/Engine";
import { Container } from "../engine/nodes/Container";
import { Graphics } from "../engine/nodes/Graphics";
import { Text } from "../engine/nodes/Text";
import { hex2px } from "../game/hexUtils";
import {
  GRID_COLS,
  GRID_ROWS,
  HEX_SIZE,
  P1_DEPLOY_COLS,
  P2_DEPLOY_COLS,
  HERO_HP,
  STARTING_MANA,
} from "../game/constants";
import { CardPicker } from "../components/CardPicker";

export default function Battle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);

  const handleCardSelect = useCallback((cardId: number) => {
    console.log('[CardPicker] selected card:', cardId);
    setSelectedCardId(cardId);
  }, []);

  const handleCancel = useCallback(() => {
    console.log('[CardPicker] selection cancelled');
    setSelectedCardId(null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;
    const keys: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    (async () => {
      engine = await Engine.create(canvas, {
        backgroundColor: 0x1a2a1a,
      });
      await engine.loadFont(
        "/assets/fonts/PatrickHand.png",
        "/assets/fonts/PatrickHand.json"
      );

      // ---- scene layers ----
      const gridLayer = new Container();
      gridLayer.zIndex = 0;
      engine.stage.addChild(gridLayer);

      const uiLayer = new Container();
      uiLayer.zIndex = 20;
      engine.stage.addChild(uiLayer);

      // ---- draw hex grid ----
      const grid = new Graphics();
      gridLayer.addChild(grid);

      const p1DeploySet = new Set(P1_DEPLOY_COLS);
      const p2DeploySet = new Set(P2_DEPLOY_COLS);

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const p = hex2px(c, r);

          if (p1DeploySet.has(c)) {
            // P1 deploy zone — blue tint
            grid.lineStyle(2, 0x3366cc);
            grid.beginFill(0x2244aa, 0.2);
          } else if (p2DeploySet.has(c)) {
            // P2 deploy zone — red tint
            grid.lineStyle(2, 0xcc3344);
            grid.beginFill(0xaa2244, 0.2);
          } else {
            // Regular hex — dark green
            grid.lineStyle(2, 0x3a5a3a);
            grid.beginFill(0x2a4a2a, 0.3);
          }

          grid.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
          grid.endFill();
        }
      }

      // ---- hero HP and mana labels ----
      // P1 (left side)
      const p1TopHex = hex2px(0, 0);
      const p1HpLabel = new Text(`HP: ${HERO_HP}`, {
        fontSize: 20,
        fill: 0x6699ff,
      });
      p1HpLabel.position.set(p1TopHex.x - HEX_SIZE * 0.8, p1TopHex.y - HEX_SIZE * 1.6);
      uiLayer.addChild(p1HpLabel);

      const p1ManaLabel = new Text(`Mana: ${STARTING_MANA}`, {
        fontSize: 18,
        fill: 0x88aaff,
      });
      p1ManaLabel.position.set(p1TopHex.x - HEX_SIZE * 0.8, p1TopHex.y - HEX_SIZE * 1.0);
      uiLayer.addChild(p1ManaLabel);

      // P2 (right side)
      const p2TopHex = hex2px(GRID_COLS - 1, 0);
      const p2HpLabel = new Text(`HP: ${HERO_HP}`, {
        fontSize: 20,
        fill: 0xff6666,
      });
      p2HpLabel.position.set(p2TopHex.x - HEX_SIZE * 0.3, p2TopHex.y - HEX_SIZE * 1.6);
      uiLayer.addChild(p2HpLabel);

      const p2ManaLabel = new Text(`Mana: ${STARTING_MANA}`, {
        fontSize: 18,
        fill: 0xff8888,
      });
      p2ManaLabel.position.set(p2TopHex.x - HEX_SIZE * 0.3, p2TopHex.y - HEX_SIZE * 1.0);
      uiLayer.addChild(p2ManaLabel);

      // ---- center camera on grid ----
      const midCol = (GRID_COLS - 1) / 2;
      const midRow = (GRID_ROWS - 1) / 2;
      const mid = hex2px(midCol, midRow);
      engine.camera.position.set(mid.x, mid.y);
      engine.camera.zoom = 1.0;
      engine.camera.dirty = true;

      // ---- camera controls ----
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        engine!.camera.zoom = Math.max(
          0.3,
          Math.min(5, engine!.camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1))
        );
        engine!.camera.dirty = true;
      };
      engine.canvas.addEventListener("wheel", onWheel, { passive: false });

      engine.ticker.add((dt: number) => {
        const sp = 200;
        let moved = false;
        if (keys["KeyW"] || keys["ArrowUp"]) {
          engine!.camera.position.y -= sp * dt;
          moved = true;
        }
        if (keys["KeyS"] || keys["ArrowDown"]) {
          engine!.camera.position.y += sp * dt;
          moved = true;
        }
        if (keys["KeyA"] || keys["ArrowLeft"]) {
          engine!.camera.position.x -= sp * dt;
          moved = true;
        }
        if (keys["KeyD"] || keys["ArrowRight"]) {
          engine!.camera.position.x += sp * dt;
          moved = true;
        }
        if (moved) engine!.camera.dirty = true;
      });
    })();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      engine?.destroy();
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          color: "#fff",
          font: "14px monospace",
          zIndex: 1,
        }}
      >
        <strong>Battle</strong> | WASD: pan | Scroll: zoom
      </div>
      <CardPicker
        currentMana={STARTING_MANA}
        onCardSelect={handleCardSelect}
        selectedCardId={selectedCardId}
        onCancel={handleCancel}
        disabled={false}
      />
    </div>
  );
}
