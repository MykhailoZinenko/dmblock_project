import { useEffect, useRef, useState, useCallback } from "react";
import { Engine } from "../engine/Engine";
import { Container } from "../engine/nodes/Container";
import { AnimatedSprite } from "../engine/nodes/AnimatedSprite";
import { Graphics } from "../engine/nodes/Graphics";
import { Text } from "../engine/nodes/Text";
import { SpriteSheet } from "../engine/textures/SpriteSheet";
import { hex2px, px2hex, isValidCell } from "../game/hexUtils";
import {
  GRID_COLS, GRID_ROWS, HEX_SIZE,
  P1_DEPLOY_COLS, P2_DEPLOY_COLS,
  HERO_HP, STARTING_MANA,
} from "../game/constants";
import { GameController } from "../game/GameController";
import { canSpawn, executeSpawn } from "../game/actions/spawnUnit";
import { getReachableHexes, canMove, executeMove } from "../game/actions/moveUnit";
import { getAttackTargets, canAttack, executeAttack } from "../game/actions/attackUnit";
import { getCard, isBuilding } from "../game/cardRegistry";
import { CardType } from "../game/types";
import type { UnitInstance } from "../game/types";
import { CardPicker } from "../components/CardPicker";
import { unitSpriteConfigs, buildingSpriteConfigs, getAnimForState } from "../game/spriteConfig";

// ─── Turn phase: WHO is acting and WHY ──────────────────────────────
// priority  = player has 0 units, gets a free spawn before initiative
// initiative = normal unit-by-unit activation
type TurnPhase =
  | { type: 'priority'; player: number }
  | { type: 'initiative' };

// ─── UI mode: WHAT the acting player is doing right now ─────────────
// pick_card   = browsing card picker (default in priority phase)
// place_card  = selected a card, clicking hex to place
// unit_turn   = unit is active, can move/pick card/pass
// unit_acted  = moved/attacked, card picker locked, can still move with remaining AP
type UIMode =
  | { type: 'pick_card' }
  | { type: 'place_card'; cardId: number }
  | { type: 'unit_turn' }
  | { type: 'unit_acted' };

// ─── Priority tracking per global turn ──────────────────────────────
interface PriorityState {
  p0Used: boolean;
  p1Used: boolean;
  spawnedThisTurn: Set<number>;
}

export default function Battle() {
  // ─── Refs (engine, game controller, scene objects) ────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const ctrlRef = useRef<GameController | null>(null);
  const unitLayerRef = useRef<Container | null>(null);
  const hlGfxRef = useRef<Graphics | null>(null);
  const spritesRef = useRef<Map<number, Container>>(new Map());

  // ─── Game state exposed to React ─────────────────────────────────
  const [phase, setPhase] = useState<TurnPhase>({ type: 'priority', player: 0 });
  const [ui, setUI] = useState<UIMode>({ type: 'pick_card' });
  const [priority, setPriority] = useState<PriorityState>({ p0Used: false, p1Used: false, spawnedThisTurn: new Set() });
  const [mana, setMana] = useState([STARTING_MANA, STARTING_MANA]);
  const [turn, setTurn] = useState(1);
  const [queueInfo, setQueueInfo] = useState<{ labels: string[]; index: number }>({ labels: [], index: 0 });

  // Refs for accessing current state in callbacks without stale closures
  const phaseRef = useRef(phase);   phaseRef.current = phase;
  const uiRef = useRef(ui);         uiRef.current = ui;
  const prioRef = useRef(priority); prioRef.current = priority;

  // ─── Who is the active player right now? ──────────────────────────
  const getActivePlayer = useCallback((): number => {
    const p = phaseRef.current;
    if (p.type === 'priority') return p.player;
    const ctrl = ctrlRef.current;
    if (!ctrl) return 0;
    const cp = ctrl.getControllingPlayer();
    return cp >= 0 ? cp : 0;
  }, []);

  // ─── Sync React state from GameController ─────────────────────────
  const syncUI = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    const s = ctrl.getState();
    setMana([s.players[0].mana, s.players[1].mana]);
    setTurn(s.turnNumber);
    setQueueInfo({
      labels: s.activationQueue.map(u => {
        const c = getCard(u.cardId);
        return `${u.playerId === 0 ? '🔵' : '🔴'} ${c.name}`;
      }),
      index: s.currentActivationIndex,
    });
  }, []);

  // ─── Highlight helpers ────────────────────────────────────────────
  const clearHL = useCallback(() => {
    const g = hlGfxRef.current;
    if (g) { g.clear(); g.visible = false; }
  }, []);

  const showDeployHL = useCallback((cardId: number, player: number) => {
    const ctrl = ctrlRef.current;
    const g = hlGfxRef.current;
    if (!ctrl || !g) return;
    const state = ctrl.getState();
    const cols = player === 0 ? P1_DEPLOY_COLS : P2_DEPLOY_COLS;
    g.clear();
    for (const col of cols) {
      for (let row = 0; row < GRID_ROWS; row++) {
        if (canSpawn(state, player, cardId, { col, row }).valid) {
          const p = hex2px(col, row);
          g.lineStyle(2, 0xf1c40f);
          g.beginFill(0xf1c40f, 0.15);
          g.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
          g.endFill();
        }
      }
    }
    g.visible = true;
  }, []);

  const showMoveHL = useCallback(() => {
    const ctrl = ctrlRef.current;
    const g = hlGfxRef.current;
    if (!ctrl || !g) return;
    const cu = ctrl.getCurrentUnit();
    if (!cu) { g.clear(); g.visible = false; return; }
    g.clear();
    // Yellow on current unit
    const up = hex2px(cu.col, cu.row);
    g.lineStyle(3, 0xf1c40f);
    g.beginFill(0xf1c40f, 0.2);
    g.drawRegularPolygon(up.x, up.y, HEX_SIZE - 2, 6);
    g.endFill();
    // Green on reachable move hexes
    for (const h of getReachableHexes(ctrl.getState(), cu.uid)) {
      const p = hex2px(h.col, h.row);
      g.lineStyle(2, 0x2ecc71);
      g.beginFill(0x2ecc71, 0.15);
      g.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
      g.endFill();
    }
    // Red on attack targets
    for (const t of getAttackTargets(ctrl.getState(), cu.uid)) {
      const target = ctrl.getState().units.find(u => u.uid === t.unitUid);
      if (target) {
        for (const cell of target.occupiedCells) {
          const p = hex2px(cell.col, cell.row);
          g.lineStyle(2, 0xe74c3c);
          g.beginFill(0xe74c3c, 0.2);
          g.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
          g.endFill();
        }
      }
    }
    g.visible = true;
  }, []);

  const removeUnitSprite = useCallback((uid: number) => {
    const wrap = spritesRef.current.get(uid);
    if (wrap) {
      wrap.parent?.removeChild(wrap);
      spritesRef.current.delete(uid);
    }
  }, []);

  const showDamageNumber = useCallback((col: number, row: number, dmg: number, isCrit: boolean) => {
    const engine = engineRef.current;
    const layer = unitLayerRef.current;
    if (!engine || !layer) return;
    const pos = hex2px(col, row);
    const txt = new Text(`${isCrit ? 'CRIT ' : ''}${dmg}`, {
      fontSize: isCrit ? 26 : 22,
      fill: isCrit ? 0xff4444 : 0xffffff,
    });
    txt.position.set(pos.x - 15, pos.y - HEX_SIZE * 1.2);
    layer.addChild(txt);
    let t = 0;
    const fn = (dt: number) => {
      t += dt;
      txt.position.y -= 40 * dt;
      if (t > 1) {
        engine!.ticker.remove(fn);
        layer.removeChild(txt);
      }
    };
    engine.ticker.add(fn);
  }, []);

  // ─── Sprite creation ──────────────────────────────────────────────
  const createSprite = useCallback(async (unit: UnitInstance) => {
    const engine = engineRef.current;
    const layer = unitLayerRef.current;
    if (!engine || !layer) return;

    const pos = hex2px(unit.col, unit.row);
    const wrap = new Container();
    wrap.position.set(pos.x, pos.y);
    const card = getCard(unit.cardId);
    const flip = unit.playerId === 1;

    if (isBuilding(card)) {
      const cfg = buildingSpriteConfigs[unit.cardId];
      if (cfg) {
        const tex = await engine.textures.load(`bld_${unit.cardId}`, cfg.file);
        const spr = new AnimatedSprite([tex]);
        spr.anchor.set(0.5, 0.85);
        const s = (HEX_SIZE * 2.5) / Math.max(cfg.width, cfg.height);
        spr.scale.set(s, s);
        wrap.addChild(spr);
      }
    } else {
      const cfg = unitSpriteConfigs[unit.cardId];
      if (cfg) {
        const anim = getAnimForState(cfg, 'idle');
        if (anim) {
          const tex = await engine.textures.load(`u${unit.cardId}_idle`, `${cfg.basePath}/${anim.file}`);
          const frames = anim.source === 'grid'
            ? SpriteSheet.fromGridRow(tex, anim.frameWidth, anim.frameHeight, anim.row! - 1, anim.frameCount)
            : SpriteSheet.fromStrip(tex, anim.frameWidth);
          const spr = new AnimatedSprite(frames);
          spr.anchor.set(0.5, 0.75);
          const s = (HEX_SIZE * 1.8) / anim.frameHeight;
          spr.scale.set(flip ? -s : s, s);
          spr.animationSpeed = 0.12;
          spr.play();
          wrap.addChild(spr);
        }
      }
    }

    const lbl = new Text(card.name, { fontSize: 18, fill: unit.playerId === 0 ? 0x6699ff : 0xff6666 });
    lbl.position.set(-24, -HEX_SIZE * 1.0);
    wrap.addChild(lbl);
    layer.addChild(wrap);
    spritesRef.current.set(unit.uid, wrap);
  }, []);

  // ─── Sprite movement animation ────────────────────────────────────
  const animateMove = useCallback((uid: number, path: { col: number; row: number }[], onDone?: () => void) => {
    const engine = engineRef.current;
    const wrap = spritesRef.current.get(uid);
    if (!engine || !wrap || path.length < 2) { onDone?.(); return; }
    let i = 1;
    const next = () => {
      if (i >= path.length) { onDone?.(); return; }
      const target = hex2px(path[i].col, path[i].row);
      const sx = wrap.position.x, sy = wrap.position.y;
      let t = 0;
      const fn = (dt: number) => {
        t += dt;
        const p = Math.min(t / 0.2, 1);
        const ease = 1 - (1 - p) * (1 - p);
        wrap.position.set(sx + (target.x - sx) * ease, sy + (target.y - sy) * ease);
        if (p >= 1) { engine!.ticker.remove(fn); i++; next(); }
      };
      engine!.ticker.add(fn);
    };
    next();
  }, []);

  // ─── Core turn flow: determine what happens next ──────────────────
  const advanceTurn = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    const state = ctrl.getState();
    const prio = prioRef.current;

    const p0Units = state.units.filter(u => u.alive && u.playerId === 0).length;
    const p1Units = state.units.filter(u => u.alive && u.playerId === 1).length;

    // Check if anyone needs priority spawn
    const p0Needs = p0Units === 0 && !prio.p0Used;
    const p1Needs = p1Units === 0 && !prio.p1Used;

    if (p0Needs && p1Needs) {
      // Both need priority — seeded random picks who goes first
      const first = state.rng.rollPercent(50) ? 0 : 1;
      setPhase({ type: 'priority', player: first });
      setUI({ type: 'pick_card' });
      clearHL();
      syncUI();
      return;
    }
    if (p0Needs) {
      setPhase({ type: 'priority', player: 0 });
      setUI({ type: 'pick_card' });
      clearHL();
      syncUI();
      return;
    }
    if (p1Needs) {
      setPhase({ type: 'priority', player: 1 });
      setUI({ type: 'pick_card' });
      clearHL();
      syncUI();
      return;
    }

    // Enter initiative phase — filter spawned units only on first entry
    const wasAlreadyInitiative = phaseRef.current.type === 'initiative';
    setPhase({ type: 'initiative' });
    phaseRef.current = { type: 'initiative' };

    if (!wasAlreadyInitiative && prio.spawnedThisTurn.size > 0) {
      const state = ctrl.getState();
      state.activationQueue = state.activationQueue.filter(u => !prio.spawnedThisTurn.has(u.uid));
      state.currentActivationIndex = 0;
    }

    if (ctrl.isQueueExhausted()) {
      ctrl.endTurn();
      const newPrio: PriorityState = { p0Used: false, p1Used: false, spawnedThisTurn: new Set() };
      setPriority(newPrio);
      prioRef.current = newPrio;
      setPhase({ type: 'priority', player: 0 });
      phaseRef.current = { type: 'priority', player: 0 };
      advanceTurn();
      return;
    }

    const cu = ctrl.getCurrentUnit();
    if (cu) {
      setUI({ type: 'unit_turn' });
      showMoveHL();
    }
    syncUI();
  }, [clearHL, syncUI, showMoveHL]);

  // ─── Card selected from picker ────────────────────────────────────
  const onCardSelect = useCallback((cardId: number) => {
    const card = getCard(cardId);
    if (card.cardType !== CardType.UNIT) return;
    setUI({ type: 'place_card', cardId });
    showDeployHL(cardId, getActivePlayer());
  }, [showDeployHL, getActivePlayer]);

  // ─── Cancel card placement ────────────────────────────────────────
  const onCardCancel = useCallback(() => {
    const p = phaseRef.current;
    if (p.type === 'priority') {
      setUI({ type: 'pick_card' });
      clearHL();
    } else {
      setUI({ type: 'unit_turn' });
      showMoveHL();
    }
  }, [clearHL, showMoveHL]);

  // ─── Pass activation ─────────────────────────────────────────────
  const onPass = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    ctrl.passActivation();
    clearHL();
    advanceTurn();
  }, [clearHL, advanceTurn]);

  // ─── End unit turn (after acting) ─────────────────────────────────
  const onEndUnitTurn = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    ctrl.passActivation();
    clearHL();
    advanceTurn();
  }, [clearHL, advanceTurn]);

  // ─── Hex click handler ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { col, row } = (e as CustomEvent).detail;
      const ctrl = ctrlRef.current;
      if (!ctrl) return;
      const state = ctrl.getState();
      const currentUI = uiRef.current;
      const currentPhase = phaseRef.current;

      if (currentUI.type === 'place_card') {
        // ── Placing a card on the board ──
        const player = getActivePlayer();
        const result = canSpawn(state, player, currentUI.cardId, { col, row });
        if (!result.valid) return;

        const unit = executeSpawn(state, player, currentUI.cardId, { col, row });
        createSprite(unit);

        if (currentPhase.type === 'priority') {
          ctrl.rebuildQueue();
          const prev = prioRef.current;
          const newSpawned = new Set(prev.spawnedThisTurn);
          newSpawned.add(unit.uid);
          const newPrio = {
            p0Used: player === 0 ? true : prev.p0Used,
            p1Used: player === 1 ? true : prev.p1Used,
            spawnedThisTurn: newSpawned,
          };
          setPriority(newPrio);
          prioRef.current = newPrio;
          clearHL();
          advanceTurn();
        } else {
          // Initiative phase: spawning = skip this unit's activation
          // Track spawned uid so it doesn't enter queue this turn
          const prev = prioRef.current;
          const newSpawned = new Set(prev.spawnedThisTurn);
          newSpawned.add(unit.uid);
          const newPrio = { ...prev, spawnedThisTurn: newSpawned };
          setPriority(newPrio);
          prioRef.current = newPrio;
          ctrl.passActivation();
          clearHL();
          advanceTurn();
        }
      } else if (currentUI.type === 'unit_turn' || currentUI.type === 'unit_acted') {
        const cu = ctrl.getCurrentUnit();
        if (!cu) return;

        // Check if clicking on an attackable enemy
        const targetUnit = state.units.find(u =>
          u.alive && u.occupiedCells.some(c => c.col === col && c.row === row)
        );
        if (targetUnit && canAttack(state, cu.uid, targetUnit.uid).valid) {
          const result = executeAttack(state, cu.uid, targetUnit.uid);
          setUI({ type: 'unit_acted' });
          showDamageNumber(targetUnit.col, targetUnit.row, result.damage, result.isCrit);
          if (result.targetDied) removeUnitSprite(targetUnit.uid);
          if (result.retaliation) {
            showDamageNumber(cu.col, cu.row, result.retaliation.damage, result.retaliation.isCrit);
            if (result.retaliation.attackerDied) removeUnitSprite(cu.uid);
          }
          clearHL();
          if (cu.alive && cu.remainingAp > 0) {
            showMoveHL();
          }
          syncUI();
          return;
        }

        // Otherwise try to move
        if (!canMove(state, cu.uid, { col, row }).valid) return;
        const path = executeMove(state, cu.uid, { col, row });
        setUI({ type: 'unit_acted' });
        clearHL();
        animateMove(cu.uid, path, () => {
          const u = state.units.find(x => x.uid === cu.uid);
          if (u && u.alive && u.remainingAp > 0) {
            showMoveHL();
          }
          syncUI();
        });
      }
    };

    window.addEventListener('hex-click', handler);
    return () => window.removeEventListener('hex-click', handler);
  }, [getActivePlayer, createSprite, animateMove, clearHL, advanceTurn, showMoveHL, syncUI]);

  // ─── Engine init ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;
    const keys: Record<string, boolean> = {};
    const onKD = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKU = (e: KeyboardEvent) => { keys[e.code] = false; };

    (async () => {
      engine = await Engine.create(canvas, { backgroundColor: 0x1a2a1a });
      engineRef.current = engine;
      await engine.loadFont("/assets/fonts/PatrickHand.png", "/assets/fonts/PatrickHand.json");

      const ctrl = new GameController();
      ctrl.startGame(Date.now());
      ctrlRef.current = ctrl;

      // Layers
      const gridLayer = new Container(); gridLayer.zIndex = 0;
      const hlLayer = new Container();   hlLayer.zIndex = 5;
      const unitLayer = new Container(); unitLayer.zIndex = 10;
      engine.stage.addChild(gridLayer);
      engine.stage.addChild(hlLayer);
      engine.stage.addChild(unitLayer);
      unitLayerRef.current = unitLayer;

      const hlGfx = new Graphics();
      hlLayer.addChild(hlGfx);
      hlGfx.visible = false;
      hlGfxRef.current = hlGfx;

      // Grid
      const grid = new Graphics();
      gridLayer.addChild(grid);
      const p1Set = new Set(P1_DEPLOY_COLS);
      const p2Set = new Set(P2_DEPLOY_COLS);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const p = hex2px(c, r);
          if (p1Set.has(c))      { grid.lineStyle(2, 0x3366cc); grid.beginFill(0x2244aa, 0.2); }
          else if (p2Set.has(c)) { grid.lineStyle(2, 0xcc3344); grid.beginFill(0xaa2244, 0.2); }
          else                   { grid.lineStyle(2, 0x3a5a3a); grid.beginFill(0x2a4a2a, 0.3); }
          grid.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
          grid.endFill();
        }
      }

      // Camera
      const mid = hex2px((GRID_COLS - 1) / 2, (GRID_ROWS - 1) / 2);
      engine.camera.position.set(mid.x, mid.y);
      engine.camera.zoom = 0.9;
      engine.camera.dirty = true;

      // Click → hex-click event
      engine.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;
        const rect = engine!.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = engine!.camera.screenToWorld((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr);
        const h = px2hex(w.x, w.y);
        if (isValidCell(h.col, h.row)) {
          window.dispatchEvent(new CustomEvent('hex-click', { detail: { col: h.col, row: h.row } }));
        }
      });

      // Camera controls
      window.addEventListener("keydown", onKD);
      window.addEventListener("keyup", onKU);
      engine.canvas.addEventListener("wheel", (e: WheelEvent) => {
        e.preventDefault();
        engine!.camera.zoom = Math.max(0.3, Math.min(5, engine!.camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
        engine!.camera.dirty = true;
      }, { passive: false });
      engine.ticker.add((dt: number) => {
        const sp = 200; let moved = false;
        if (keys["KeyW"] || keys["ArrowUp"])    { engine!.camera.position.y -= sp * dt; moved = true; }
        if (keys["KeyS"] || keys["ArrowDown"])  { engine!.camera.position.y += sp * dt; moved = true; }
        if (keys["KeyA"] || keys["ArrowLeft"])  { engine!.camera.position.x -= sp * dt; moved = true; }
        if (keys["KeyD"] || keys["ArrowRight"]) { engine!.camera.position.x += sp * dt; moved = true; }
        if (moved) engine!.camera.dirty = true;
      });
    })();

    return () => {
      window.removeEventListener("keydown", onKD);
      window.removeEventListener("keyup", onKU);
      engineRef.current = null;
      ctrlRef.current = null;
      unitLayerRef.current = null;
      hlGfxRef.current = null;
      spritesRef.current.clear();
      engine?.destroy();
    };
  }, []);

  // ─── Derived display values ───────────────────────────────────────
  const activePlayer = getActivePlayer();
  const isPriority = phase.type === 'priority';
  const isPlacing = ui.type === 'place_card';
  const cardPickerDisabled = ui.type === 'unit_acted';
  const showPassBtn = phase.type === 'initiative' && (ui.type === 'unit_turn' || ui.type === 'unit_acted');
  const showEndTurnBtn = ui.type === 'unit_acted';
  const currentUnit = ctrlRef.current?.getCurrentUnit();

  let statusText = "";
  if (isPriority) {
    statusText = `P${phase.player + 1} — Deploy a unit`;
  } else if (currentUnit) {
    statusText = `P${activePlayer + 1} — ${getCard(currentUnit.cardId).name}`;
  } else {
    statusText = `P${activePlayer + 1}`;
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} onContextMenu={e => e.preventDefault()} />

      {/* HUD top-left */}
      <div style={{ position: "fixed", top: 10, left: 10, color: "#fff", font: "14px monospace", zIndex: 1 }}>
        <strong>Turn {turn}</strong> | {statusText}
        {ui.type === 'unit_acted' && " (acted)"}
        <br />
        <span style={{ fontSize: 12, opacity: 0.7 }}>WASD: pan | Scroll: zoom</span>
      </div>

      {/* HUD top-right: mana */}
      <div style={{ position: "fixed", top: 10, right: 10, color: "#fff", font: "14px monospace", zIndex: 1, textAlign: "right" }}>
        <span style={{ color: "#6699ff" }}>P1 Mana: {mana[0]}</span><br />
        <span style={{ color: "#ff6666" }}>P2 Mana: {mana[1]}</span>
      </div>

      {/* Initiative queue */}
      <div style={{
        position: "fixed", top: 60, right: 10, color: "#fff", font: "12px monospace", zIndex: 1,
        background: "rgba(0,0,0,0.5)", padding: "8px 12px", borderRadius: 6, maxHeight: 300, overflowY: "auto",
      }}>
        <div style={{ fontWeight: "bold", marginBottom: 4 }}>Initiative</div>
        {queueInfo.labels.length === 0 && <div style={{ opacity: 0.5 }}>No units</div>}
        {queueInfo.labels.map((label, i) => (
          <div key={i} style={{
            padding: "2px 4px",
            background: i === queueInfo.index ? "rgba(241,196,15,0.3)" : "transparent",
            borderRadius: 3,
          }}>
            {i === queueInfo.index ? "▶ " : "  "}{label}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {(showPassBtn || showEndTurnBtn) && (
        <div style={{
          position: "fixed", bottom: 190, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 10, zIndex: 101,
        }}>
          {showPassBtn && <button onClick={onPass} style={btnStyle("#e67e22")}>Pass</button>}
          {showEndTurnBtn && <button onClick={onEndUnitTurn} style={btnStyle("#3498db")}>End Unit Turn</button>}
        </div>
      )}

      <CardPicker
        currentMana={mana[activePlayer]}
        onCardSelect={onCardSelect}
        selectedCardId={isPlacing ? ui.cardId : null}
        onCancel={onCardCancel}
        disabled={cardPickerDisabled}
      />
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: color, border: "none", color: "#fff",
    padding: "8px 18px", borderRadius: 6, fontSize: 14,
    fontFamily: "Patrick Hand, cursive", cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  };
}
