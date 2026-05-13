import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useAccount, useWalletClient } from 'wagmi';
import { useHero } from '../hooks/useHero';
import { Engine } from '../engine/Engine';
import { BattleScene, type AttackableTarget } from '../game/BattleScene';
import {
  hex2px, px2hex, isValidCell,
  GRID_COLS, GRID_ROWS, HEX_SIZE,
  P1_DEPLOY_COLS, P2_DEPLOY_COLS,
  HERO_HP, STARTING_MANA,
  ACTIVATION_TIMER_SECONDS,
  isBarrierUp, canAttackHero, HERO_HEX,
  GameController,
  canSpawn,
  canCast, getSpellTargets,
  getReachableHexes,
  getAttackTargets,
  getAutoWalkTargets,
  getCard,
  CardType, SpellTargetType,
} from '@arcana/game-core';
import type { HexCoord } from '@arcana/game-core';
import { CardPicker } from '../components/CardPicker';
import { ArcanaPanel, ArcanaButton, ArcanaBar } from '../ui/components/index';
import { ServerConnection } from '../multiplayer/ServerConnection';
import type { GameAction } from '../multiplayer/ServerConnection';
import { attachBattleMultiplayer } from './battle/attachBattleMultiplayer';

type UIMode =
  | { type: 'pick_card' }
  | { type: 'place_card'; cardId: number }
  | { type: 'target_spell'; cardId: number }
  | { type: 'unit_turn' }
  | { type: 'unit_acted' }
  | { type: 'animating' };

export default function Battle() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const ctrlRef = useRef<GameController | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);

  const [searchParams] = useSearchParams();
  const duelId = searchParams.get('duel') ? Number(searchParams.get('duel')) : null;
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { heroId } = useHero();

  const serverRef = useRef<ServerConnection | null>(null);
  const [multiplayerStatus, setMultiplayerStatus] = useState<string>('');
  const [mySeat, setMySeat] = useState<0 | 1>(0);

  const [ui, setUI] = useState<UIMode>({ type: 'pick_card' });
  const [mana, setMana] = useState([STARTING_MANA, STARTING_MANA]);
  const [turn, setTurn] = useState(1);
  const [queueInfo, setQueueInfo] = useState<{ labels: string[]; index: number }>({ labels: [], index: 0 });
  const [heroHp, setHeroHp] = useState([HERO_HP, HERO_HP]);
  const [timer, setTimer] = useState(ACTIVATION_TIMER_SECONDS);
  const [gameOver, setGameOver] = useState<{ winner: number; results?: any } | null>(null);
  const [barrierState, setBarrierState] = useState([true, true]);
  const [myTurn, setMyTurn] = useState(false);

  const uiRef = useRef(ui); uiRef.current = ui;
  const timerRef = useRef(ACTIVATION_TIMER_SECONDS);
  const gameOverRef = useRef(false);
  const myTurnRef = useRef(false);
  myTurnRef.current = myTurn;

  // --- Sync local display state from GameController ---

  const syncUI = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl?.isGameStarted()) return;
    const s = ctrl.getState();
    setMana([s.players[0].mana, s.players[1].mana]);
    setHeroHp([s.players[0].heroHp, s.players[1].heroHp]);
    setTurn(s.turnNumber);
    setQueueInfo({
      labels: s.activationQueue.map(u => {
        const c = getCard(u.cardId);
        return `${u.playerId === 0 ? 'P1' : 'P2'} ${c.name}`;
      }),
      index: s.currentActivationIndex,
    });

    const scene = sceneRef.current;
    if (scene) {
      scene.updateHeroHp(0, s.players[0].heroHp, HERO_HP);
      scene.updateHeroHp(1, s.players[1].heroHp, HERO_HP);
    }

    setBarrierState([isBarrierUp(s, 0), isBarrierUp(s, 1)]);
  }, []);

  const showActiveUnitHL = useCallback(() => {
    const ctrl = ctrlRef.current;
    const scene = sceneRef.current;
    if (!ctrl || !scene) return;
    const cu = ctrl.getCurrentUnit();
    if (!cu) { scene.clearHighlights(); return; }

    const reachable = getReachableHexes(ctrl.getState(), cu.uid);
    const directTargets = getAttackTargets(ctrl.getState(), cu.uid);
    const autoWalkTgts = getAutoWalkTargets(ctrl.getState(), cu.uid);

    const attackable: AttackableTarget[] = [];
    for (const t of directTargets) {
      const target = ctrl.getState().units.find(u => u.uid === t.unitUid);
      if (target) {
        attackable.push({ unitUid: t.unitUid, cells: [...target.occupiedCells], autoWalk: false });
      }
    }
    for (const t of autoWalkTgts) {
      attackable.push({ unitUid: t.unitUid, cells: t.cells, autoWalk: true });
    }

    scene.showMoveHighlights({ col: cu.col, row: cu.row }, reachable, attackable);

    const enemyPid = cu.playerId === 0 ? 1 : 0;
    if (canAttackHero(ctrl.getState(), cu.uid, enemyPid).valid) {
      scene.showHeroAttackHighlight(enemyPid);
    }
  }, []);

  const resetTimer = useCallback(() => {
    timerRef.current = ACTIVATION_TIMER_SECONDS;
    setTimer(ACTIVATION_TIMER_SECONDS);
  }, []);

  // --- Send intent to server (no local execution) ---

  const sendAction = useCallback(async (action: GameAction) => {
    if (!serverRef.current) return;
    setUI({ type: 'animating' });
    uiRef.current = { type: 'animating' };
    sceneRef.current?.clearHighlights();
    await serverRef.current.sendAction(action);
  }, []);

  // --- Card selection ---

  const onCardSelect = useCallback((cardId: number) => {
    if (!myTurnRef.current) return;
    const ctrl = ctrlRef.current;
    const scene = sceneRef.current;
    if (!ctrl || !scene) return;

    const hand = ctrl.getState().players[mySeat].hand;
    if (!hand.includes(cardId)) return;

    const card = getCard(cardId);
    if (card.cardType === CardType.SPELL) {
      const state = ctrl.getState();
      if (state.players[mySeat].mana < card.manaCost) return;

      setUI({ type: 'target_spell', cardId });
      uiRef.current = { type: 'target_spell', cardId };

      const validHexes = getSpellTargets(state, mySeat, cardId);
      const isHeal = cardId === 10;
      const isArea = card.spellTargetType === SpellTargetType.AREA;
      const hlType = isHeal ? 'ally' as const : isArea ? 'area' as const : 'enemy' as const;
      scene.showSpellHighlights(validHexes, hlType);
      return;
    }
    if (card.cardType !== CardType.UNIT) return;

    setUI({ type: 'place_card', cardId });
    uiRef.current = { type: 'place_card', cardId };

    const state = ctrl.getState();
    const cols = mySeat === 0 ? P1_DEPLOY_COLS : P2_DEPLOY_COLS;
    const validHexes: HexCoord[] = [];
    for (const col of cols) {
      for (let row = 0; row < GRID_ROWS; row++) {
        if (canSpawn(state, mySeat, cardId, { col, row }).valid) {
          validHexes.push({ col, row });
        }
      }
    }
    scene.showDeployHighlights(validHexes);
  }, [mySeat]);

  const onCardCancel = useCallback(() => {
    if (uiRef.current.type === 'target_spell') {
      setUI({ type: 'unit_turn' });
      uiRef.current = { type: 'unit_turn' };
      showActiveUnitHL();
    } else {
      setUI({ type: 'pick_card' });
      uiRef.current = { type: 'pick_card' };
      sceneRef.current?.clearHighlights();
    }
  }, [showActiveUnitHL]);

  const onPass = useCallback(() => {
    if (!myTurnRef.current) return;
    sendAction({ type: 'pass' });
  }, [sendAction]);

  // --- Hex click handler (intent-only, no local execution) ---

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { col, row, worldX, worldY } = detail;
      const ctrl = ctrlRef.current;
      const scene = sceneRef.current;
      if (!ctrl || !scene) return;
      if (!myTurnRef.current) return;
      if (gameOverRef.current) return;

      const currentUI = uiRef.current;
      if (currentUI.type === 'animating') return;

      const state = ctrl.getState();

      // -- Cast spell --
      if (currentUI.type === 'target_spell') {
        if (!canCast(state, mySeat, currentUI.cardId, { col, row }).valid) return;
        sendAction({ type: 'cast', playerId: mySeat, cardId: currentUI.cardId, col, row });
        return;
      }

      // -- Place card (spawn) --
      if (currentUI.type === 'place_card') {
        if (!canSpawn(state, mySeat, currentUI.cardId, { col, row }).valid) return;
        sendAction({ type: 'spawn', playerId: mySeat, cardId: currentUI.cardId, col, row });
        return;
      }

      if (currentUI.type !== 'unit_turn' && currentUI.type !== 'unit_acted') return;

      const cu = ctrl.getCurrentUnit();
      if (!cu || cu.playerId !== mySeat) return;

      // -- Click on enemy unit --
      let targetUnit = state.units.find(u =>
        u.alive && u.playerId !== cu.playerId &&
        u.occupiedCells.some(c => c.col === col && c.row === row),
      );
      if (!targetUnit) {
        const directTargets = getAttackTargets(state, cu.uid);
        const autoWalkTgts = getAutoWalkTargets(state, cu.uid);
        const allTargetUids = new Set([
          ...directTargets.map(t => t.unitUid),
          ...autoWalkTgts.map(t => t.unitUid),
        ]);
        let bestDist = Infinity;
        for (const uid of allTargetUids) {
          const u = state.units.find(x => x.uid === uid);
          if (!u) continue;
          for (const cell of u.occupiedCells) {
            const dist = Math.abs(cell.col - col) + Math.abs(cell.row - row);
            if (dist <= 1) {
              const p = hex2px(cell.col, cell.row);
              const d = (p.x - worldX) ** 2 + (p.y - worldY) ** 2;
              if (d < bestDist) { bestDist = d; targetUnit = u; }
            }
          }
        }
      }

      if (targetUnit) {
        sendAction({ type: 'attack', attackerUid: cu.uid, targetUid: targetUnit.uid });
        return;
      }

      // -- Move (not clicking enemy) --
      if (currentUI.type === 'unit_acted') return;
      sendAction({ type: 'move', unitUid: cu.uid, col, row });
    };

    window.addEventListener('hex-click', handler);
    return () => window.removeEventListener('hex-click', handler);
  }, [mySeat, sendAction]);

  // --- Offgrid click (hero markers) ---

  useEffect(() => {
    const handler = (e: Event) => {
      const { worldX, worldY } = (e as CustomEvent).detail;
      const ctrl = ctrlRef.current;
      const scene = sceneRef.current;
      if (!ctrl || !scene || gameOverRef.current) return;
      if (!myTurnRef.current) return;
      const currentUI = uiRef.current;
      const state = ctrl.getState();

      let clickedPid = -1;
      for (const pid of [0, 1]) {
        const pos = scene.getHeroWorldPos(pid);
        const dist = Math.sqrt((worldX - pos.x) ** 2 + (worldY - pos.y) ** 2);
        if (dist < HEX_SIZE * 1.0) { clickedPid = pid; break; }
      }
      if (clickedPid < 0) return;

      // Spell targeting hero
      if (currentUI.type === 'target_spell') {
        const heroHex = HERO_HEX[clickedPid];
        if (!canCast(state, mySeat, currentUI.cardId, heroHex).valid) return;
        sendAction({ type: 'cast', playerId: mySeat, cardId: currentUI.cardId, col: heroHex.col, row: heroHex.row });
        return;
      }

      // Unit attack on hero
      if (currentUI.type !== 'unit_turn' && currentUI.type !== 'unit_acted') return;
      const cu = ctrl.getCurrentUnit();
      if (!cu || cu.playerId !== mySeat) return;
      const enemyPid = cu.playerId === 0 ? 1 : 0;
      if (clickedPid !== enemyPid) return;
      if (!canAttackHero(state, cu.uid, enemyPid).valid) return;
      sendAction({ type: 'attack-hero', attackerUid: cu.uid, targetPlayerId: enemyPid });
    };

    window.addEventListener('offgrid-click', handler);
    return () => window.removeEventListener('offgrid-click', handler);
  }, [mySeat, sendAction]);

  // --- Timer (display-only, server enforces) ---

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameOverRef.current) return;
      timerRef.current -= 1;
      setTimer(Math.max(0, timerRef.current));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Engine init ---

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
      await engine.loadFont('/assets/fonts/PatrickHand.png', '/assets/fonts/PatrickHand.json');

      const ctrl = new GameController();
      ctrlRef.current = ctrl;

      const scene = new BattleScene(engine);
      scene.createGrid();
      scene.createHeroMarkers();
      await scene.preloadSheep();
      sceneRef.current = scene;

      const mid = hex2px((GRID_COLS - 1) / 2, (GRID_ROWS - 1) / 2);
      engine.camera.position.set(mid.x, mid.y);
      engine.camera.zoom = 0.9;
      engine.camera.dirty = true;

      engine.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;
        const rect = engine!.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = engine!.camera.screenToWorld(
          (e.clientX - rect.left) * dpr,
          (e.clientY - rect.top) * dpr,
        );
        const h = px2hex(w.x, w.y);
        if (isValidCell(h.col, h.row)) {
          window.dispatchEvent(new CustomEvent('hex-click', {
            detail: { col: h.col, row: h.row, worldX: w.x, worldY: w.y },
          }));
        } else {
          window.dispatchEvent(new CustomEvent('offgrid-click', {
            detail: { worldX: w.x, worldY: w.y },
          }));
        }
      });

      engine.canvas.addEventListener('pointermove', (e: PointerEvent) => {
        const rect = engine!.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = engine!.camera.screenToWorld(
          (e.clientX - rect.left) * dpr,
          (e.clientY - rect.top) * dpr,
        );
        const h = px2hex(w.x, w.y);
        sceneRef.current?.updateHover(h.col, h.row);
      });

      window.addEventListener('keydown', onKD);
      window.addEventListener('keyup', onKU);
      engine.canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        engine!.camera.zoom = Math.max(0.3, Math.min(5, engine!.camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
        engine!.camera.dirty = true;
      }, { passive: false });
      engine.ticker.add((dt: number) => {
        const sp = 200; let moved = false;
        if (keys['KeyW'] || keys['ArrowUp'])    { engine!.camera.position.y -= sp * dt; moved = true; }
        if (keys['KeyS'] || keys['ArrowDown'])  { engine!.camera.position.y += sp * dt; moved = true; }
        if (keys['KeyA'] || keys['ArrowLeft'])  { engine!.camera.position.x -= sp * dt; moved = true; }
        if (keys['KeyD'] || keys['ArrowRight']) { engine!.camera.position.x += sp * dt; moved = true; }
        if (moved) engine!.camera.dirty = true;
      });
    })();

    return () => {
      window.removeEventListener('keydown', onKD);
      window.removeEventListener('keyup', onKU);
      engineRef.current = null;
      ctrlRef.current = null;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      engine?.destroy();
    };
  }, []);

  // --- Multiplayer session ---

  useEffect(() => {
    if (duelId === null || !address || !walletClient) return;
    return attachBattleMultiplayer({
      duelId,
      address,
      heroId: heroId ? Number(heroId) : 0,
      serverRef,
      getCtrl: () => ctrlRef.current,
      getScene: () => sceneRef.current,
      syncUI,
      resetTimer,
      setMultiplayerStatus,
      setGameOver: (result) => {
        setGameOver(result);
        gameOverRef.current = true;
      },
      setMySeat,
      setMyTurn: (turn: boolean, isPriority: boolean) => {
        setMyTurn(turn);
        myTurnRef.current = turn;
        if (turn) {
          if (isPriority) {
            setUI({ type: 'pick_card' });
            uiRef.current = { type: 'pick_card' };
            sceneRef.current?.clearHighlights();
          } else {
            const cu = ctrlRef.current?.getCurrentUnit();
            if (cu) {
              setUI({ type: 'unit_turn' });
              uiRef.current = { type: 'unit_turn' };
              showActiveUnitHL();
            } else {
              setUI({ type: 'pick_card' });
              uiRef.current = { type: 'pick_card' };
            }
          }
        } else {
          sceneRef.current?.clearHighlights();
        }
      },
      signTypedData: (params) => walletClient.signTypedData({
        account: walletClient.account,
        domain: params.domain,
        types: params.types as any,
        primaryType: params.primaryType as any,
        message: params.message,
      }),
      signMessage: (message) => walletClient.signMessage({
        account: walletClient.account,
        message: { raw: message },
      }),
    });
  }, [duelId, address, walletClient, syncUI, resetTimer]);

  // --- Derived display values ---

  const ctrl = ctrlRef.current;
  const currentUnit = ctrl?.getCurrentUnit();
  const isAnimating = ui.type === 'animating';
  const isPlacing = ui.type === 'place_card';
  const isTargetingSpell = ui.type === 'target_spell';
  const showPassBtn = !isAnimating && !gameOver && myTurn &&
    (ui.type === 'unit_turn' || ui.type === 'unit_acted' || ui.type === 'pick_card');
  const cardPickerDisabled = ui.type === 'unit_acted' || isAnimating || !myTurn;

  let statusText = '';
  if (currentUnit) {
    const card = getCard(currentUnit.cardId);
    statusText = `${currentUnit.playerId === mySeat ? 'Your' : "Opponent's"} ${card.name} (AP: ${currentUnit.remainingAp}/${currentUnit.speed})`;
  } else {
    statusText = myTurn ? 'Your turn — deploy a unit' : "Opponent's turn";
  }

  if (duelId === null || !address) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', color: 'var(--color-text)',
        background: '#1a2a1a',
      }}>
        <ArcanaPanel variant="slate">
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 18, marginBottom: 12 }}>No duel selected</div>
            <ArcanaButton variant="blue" size="md" onClick={() => navigate('/duels')}>
              Go to Duel Lobby
            </ArcanaButton>
          </div>
        </ArcanaPanel>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} onContextMenu={e => e.preventDefault()} />

      {/* --- Top Bar --- */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
        pointerEvents: 'none',
      }}>
        <ArcanaPanel variant="slate" style={{ margin: '0 auto', pointerEvents: 'auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '2px 12px', fontFamily: 'var(--font-display)',
            color: 'var(--color-text)', fontSize: 'var(--text-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: 'bold' }}>Turn {turn}</span>
              <span>{statusText}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* P1 stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#6699ff', fontSize: 'var(--text-xs)' }}>
                  {mySeat === 0 ? 'You' : 'Opp'}
                </span>
                <div style={{ width: 60 }}>
                  <ArcanaBar value={heroHp[0]} max={HERO_HP} color={heroHp[0] <= 10 ? 'red' : 'green'}>
                    <span style={{ fontSize: 'var(--text-xs)' }}>{heroHp[0]}</span>
                  </ArcanaBar>
                </div>
                {!barrierState[0] && <span style={{ color: '#ff4444', fontSize: '10px' }}>&#9888;</span>}
                <div style={{ width: 50 }}>
                  <ArcanaBar value={mana[0]} max={12} color="blue">
                    <span style={{ fontSize: 'var(--text-xs)' }}>{mana[0]}</span>
                  </ArcanaBar>
                </div>
              </div>

              {/* Timer */}
              {!gameOver && (
                <div style={{ width: 60 }}>
                  <ArcanaBar
                    value={timer}
                    max={ACTIVATION_TIMER_SECONDS}
                    color={timer <= 10 ? 'red' : timer <= 20 ? 'yellow' : 'blue'}
                  >
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      animation: timer <= 10 ? 'pulse 0.5s infinite' : undefined,
                    }}>{timer}s</span>
                  </ArcanaBar>
                </div>
              )}

              {/* P2 stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#ff6666', fontSize: 'var(--text-xs)' }}>
                  {mySeat === 1 ? 'You' : 'Opp'}
                </span>
                <div style={{ width: 60 }}>
                  <ArcanaBar value={heroHp[1]} max={HERO_HP} color={heroHp[1] <= 10 ? 'red' : 'green'}>
                    <span style={{ fontSize: 'var(--text-xs)' }}>{heroHp[1]}</span>
                  </ArcanaBar>
                </div>
                {!barrierState[1] && <span style={{ color: '#ff4444', fontSize: '10px' }}>&#9888;</span>}
                <div style={{ width: 50 }}>
                  <ArcanaBar value={mana[1]} max={12} color="blue">
                    <span style={{ fontSize: 'var(--text-xs)' }}>{mana[1]}</span>
                  </ArcanaBar>
                </div>
              </div>
            </div>
          </div>
        </ArcanaPanel>
      </div>

      {/* --- Initiative Sidebar --- */}
      <div style={{
        position: 'fixed', top: 80, right: 8, zIndex: 10,
        width: 160, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto',
      }}>
        <ArcanaPanel variant="wood">
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-xs)',
            color: 'var(--color-text)',
          }}>
            <div style={{
              fontWeight: 'bold', fontSize: 'var(--text-sm)',
              color: 'var(--color-gold)', marginBottom: 6,
              textAlign: 'center',
            }}>Initiative</div>
            {queueInfo.labels.length === 0 && (
              <div style={{ opacity: 0.5, textAlign: 'center' }}>No units</div>
            )}
            {queueInfo.labels.map((label, i) => (
              <div key={i} style={{
                padding: '3px 6px',
                background: i === queueInfo.index ? 'rgba(221,179,109,0.3)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 1,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {i === queueInfo.index && (
                  <span style={{ color: 'var(--color-gold)' }}>&#9654;</span>
                )}
                <span>{label}</span>
              </div>
            ))}
          </div>
        </ArcanaPanel>
      </div>

      {/* --- Pass Button --- */}
      {showPassBtn && (
        <div style={{
          position: 'fixed', bottom: 190, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 10, zIndex: 101,
        }}>
          <ArcanaButton variant="blue" size="sm" onClick={onPass}>Pass</ArcanaButton>
        </div>
      )}

      {/* --- Status Overlay --- */}
      {multiplayerStatus && (
        <div style={{
          position: 'fixed', top: 48, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', color: 'var(--color-gold)',
          padding: '6px 20px', borderRadius: 8, fontSize: 14, zIndex: 100,
          fontFamily: 'var(--font-display)',
          border: '1px solid var(--color-gold)',
        }}>
          {multiplayerStatus}
        </div>
      )}

      {!multiplayerStatus && serverRef.current?.state === 'playing' && (
        <div style={{
          position: 'fixed', top: 48, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', color: myTurn ? '#66ff66' : '#ff6666',
          padding: '4px 16px', borderRadius: 8, fontSize: 13, zIndex: 100,
          fontFamily: 'var(--font-display)',
        }}>
          {myTurn ? 'Your turn' : "Opponent's turn"}
        </div>
      )}

      {/* --- Game Over --- */}
      {gameOver && (() => {
        const won = gameOver.winner === mySeat;
        const r = gameOver.results;
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}>
            <ArcanaPanel variant="slate">
              <div style={{
                padding: '32px 56px', textAlign: 'center',
                fontFamily: 'var(--font-display)', color: 'var(--color-text)',
                minWidth: 340,
              }}>
                <div style={{
                  fontSize: '36px', color: won ? '#66ff66' : '#ff4444',
                  marginBottom: 8, fontWeight: 'bold',
                }}>
                  {won ? 'VICTORY' : 'DEFEAT'}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', marginBottom: 20, opacity: 0.7 }}>
                  {won ? 'The opposing hero has fallen.' : 'Your hero has been defeated.'}
                </div>

                {r && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                    marginBottom: 24, fontSize: 'var(--text-sm)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                      <span style={{ opacity: 0.7 }}>XP Gained</span>
                      <span style={{ color: 'var(--color-gold)', fontWeight: 'bold' }}>
                        +{won ? r.xpGainWinner : r.xpGainLoser}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                      <span style={{ opacity: 0.7 }}>ELO Change</span>
                      <span style={{
                        color: (won ? r.eloChangeWinner : r.eloChangeLoser) >= 0 ? '#66ff66' : '#ff4444',
                        fontWeight: 'bold',
                      }}>
                        {(won ? r.eloChangeWinner : r.eloChangeLoser) >= 0 ? '+' : ''}
                        {won ? r.eloChangeWinner : r.eloChangeLoser}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                      <span style={{ opacity: 0.7 }}>New ELO</span>
                      <span style={{ fontWeight: 'bold' }}>
                        {won ? r.newEloWinner : r.newEloLoser}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
                      <span style={{ opacity: 0.7 }}>Turns Played</span>
                      <span>{r.turnCount}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <ArcanaButton variant="blue" size="md" onClick={() => navigate('/duels')}>
                    Return to Lobby
                  </ArcanaButton>
                </div>
              </div>
            </ArcanaPanel>
          </div>
        );
      })()}

      {/* --- Card Picker --- */}
      <CardPicker
        currentMana={
          ctrl?.isGameStarted()
            ? ctrl.getState().players[mySeat].mana
            : mana[mySeat]
        }
        handCardIds={
          ctrl?.isGameStarted()
            ? ctrl.getState().players[mySeat].hand
            : undefined
        }
        onCardSelect={onCardSelect}
        selectedCardId={isPlacing ? ui.cardId : isTargetingSpell ? ui.cardId : null}
        onCancel={onCardCancel}
        disabled={cardPickerDisabled}
      />
    </div>
  );
}
