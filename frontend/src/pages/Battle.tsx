import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useAccount } from 'wagmi';
import { Engine } from '../engine/Engine';
import { BattleScene, type AttackableTarget } from '../game/BattleScene';
import { hex2px, px2hex, isValidCell } from '../game/hexUtils';
import {
  GRID_COLS, GRID_ROWS, HEX_SIZE,
  P1_DEPLOY_COLS, P2_DEPLOY_COLS,
  HERO_HP, STARTING_MANA, AUTO_END_DELAY,
  ACTIVATION_TIMER_SECONDS,
} from '../game/constants';
import {
  isBarrierUp, canAttackHero, executeHeroAttack,
  checkWinCondition, applyTimeoutDamage, HERO_HEX,
} from '../game/actions/heroActions';
import { GameController } from '../game/GameController';
import { canSpawn, executeSpawn } from '../game/actions/spawnUnit';
import { canCast, executeCast, getSpellTargets } from '../game/actions/castSpell';
import { getReachableHexes, canMove, executeMove } from '../game/actions/moveUnit';
import {
  getAttackTargets, canAttack, executeAttack,
  getAutoWalkHex, getAutoWalkTargets,
} from '../game/actions/attackUnit';
import { getCard, isBuilding, isMelee } from '../game/cardRegistry';
import { CardType, SpellTargetType } from '../game/types';
import type { UnitInstance, HexCoord } from '../game/types';
import { CardPicker } from '../components/CardPicker';
import { ArcanaPanel, ArcanaButton, ArcanaBar } from '../ui/components/index';
import { ConnectionManager } from '../multiplayer/ConnectionManager';
import { MatchManager } from '../multiplayer/MatchManager';
import { listDecks } from '../lib/deckStorage';
import { DECK_SIZE } from '../lib/deckValidation';
import { hashState } from '../game/stateHash';
import type { GameAction } from '../multiplayer/protocol';

// ─── Turn phase ────────────────────────────────────────
type TurnPhase =
  | { type: 'priority'; player: number }
  | { type: 'initiative' };

// ─── UI mode ───────────────────────────────────────────
type UIMode =
  | { type: 'pick_card' }
  | { type: 'place_card'; cardId: number }
  | { type: 'target_spell'; cardId: number }
  | { type: 'unit_turn' }
  | { type: 'unit_acted' }
  | { type: 'animating' };

// ─── Priority state ────────────────────────────────────
interface PriorityState {
  p0Used: boolean;
  p1Used: boolean;
  spawnedThisTurn: Set<number>;
  activatedThisTurn: Set<number>;
}

export default function Battle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const ctrlRef = useRef<GameController | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);

  const [searchParams] = useSearchParams();
  const duelId = searchParams.get('duel') ? Number(searchParams.get('duel')) : null;
  const { address } = useAccount();

  const connRef = useRef<ConnectionManager | null>(null);
  const matchRef = useRef<MatchManager | null>(null);
  const [multiplayerStatus, setMultiplayerStatus] = useState<string>('');
  const isMultiplayer = duelId !== null;

  const sendAction = useCallback((action: GameAction) => {
    const conn = connRef.current;
    const ctrl = ctrlRef.current;
    if (!isMultiplayer || !conn) return;
    conn.send({ type: 'action', action });
    conn.sendToServer({ type: 'action', action });
    if (ctrl) {
      const h = hashState(ctrl.getState());
      conn.send({ type: 'state-hash', hash: h });
    }
  }, [isMultiplayer]);

  const [phase, setPhase] = useState<TurnPhase>({ type: 'priority', player: 0 });
  const [ui, setUI] = useState<UIMode>({ type: 'pick_card' });
  const [priority, setPriority] = useState<PriorityState>({ p0Used: false, p1Used: false, spawnedThisTurn: new Set(), activatedThisTurn: new Set() });
  const [mana, setMana] = useState([STARTING_MANA, STARTING_MANA]);
  const [turn, setTurn] = useState(1);
  const [queueInfo, setQueueInfo] = useState<{ labels: string[]; index: number }>({ labels: [], index: 0 });
  const [heroHp, setHeroHp] = useState([HERO_HP, HERO_HP]);
  const [timer, setTimer] = useState(ACTIVATION_TIMER_SECONDS);
  const [gameOver, setGameOver] = useState<{ winner: number } | null>(null);
  const [barrierState, setBarrierState] = useState([true, true]);

  const phaseRef = useRef(phase);   phaseRef.current = phase;
  const uiRef = useRef(ui);         uiRef.current = ui;
  const prioRef = useRef(priority); prioRef.current = priority;
  const timerRef = useRef(ACTIVATION_TIMER_SECONDS);
  const gameOverRef = useRef(false);

  const getActivePlayer = useCallback((): number => {
    const p = phaseRef.current;
    if (p.type === 'priority') return p.player;
    const ctrl = ctrlRef.current;
    if (!ctrl) return 0;
    const cp = ctrl.getControllingPlayer();
    return cp >= 0 ? cp : 0;
  }, []);

  const syncUI = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
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

    const b0 = isBarrierUp(s, 0);
    const b1 = isBarrierUp(s, 1);
    setBarrierState([b0, b1]);
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
        attackable.push({
          unitUid: t.unitUid,
          cells: [...target.occupiedCells],
          autoWalk: false,
        });
      }
    }
    for (const t of autoWalkTgts) {
      attackable.push({
        unitUid: t.unitUid,
        cells: t.cells,
        autoWalk: true,
      });
    }

    scene.showMoveHighlights({ col: cu.col, row: cu.row }, reachable, attackable);

    const enemyPid = cu.playerId === 0 ? 1 : 0;
    if (canAttackHero(ctrl.getState(), cu.uid, enemyPid).valid) {
      scene.showHeroAttackHighlight(enemyPid);
    }
  }, []);

  const trackActivated = useCallback((uid: number) => {
    const prev = prioRef.current;
    const newActivated = new Set(prev.activatedThisTurn);
    newActivated.add(uid);
    const newPrio = { ...prev, activatedThisTurn: newActivated };
    setPriority(newPrio);
    prioRef.current = newPrio;
  }, []);

  const scheduleAutoEnd = useCallback(() => {
    const ctrl = ctrlRef.current;
    const engine = engineRef.current;
    if (!ctrl || !engine) return;
    const cu = ctrl.getCurrentUnit();
    if (!cu || cu.remainingAp > 0) return;

    let elapsed = 0;
    const tick = (dt: number) => {
      elapsed += dt;
      if (elapsed >= AUTO_END_DELAY) {
        engine.ticker.remove(tick);
        trackActivated(cu.uid);
        ctrl.passActivation();
        sceneRef.current?.clearHighlights();
        advanceTurn();
      }
    };
    engine.ticker.add(tick);
  }, []);

  const resetTimer = useCallback(() => {
    timerRef.current = ACTIVATION_TIMER_SECONDS;
    setTimer(ACTIVATION_TIMER_SECONDS);
  }, []);

  const handleWinCheck = useCallback((): boolean => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return false;
    const result = checkWinCondition(ctrl.getState());
    if (result) {
      setGameOver(result);
      gameOverRef.current = true;
      ctrl.getState().phase = 'GAME_OVER';
      return true;
    }
    return false;
  }, []);

  const checkBarrierChange = useCallback(() => {
    const ctrl = ctrlRef.current;
    const scene = sceneRef.current;
    if (!ctrl || !scene) return;
    const s = ctrl.getState();
    const b0 = isBarrierUp(s, 0);
    const b1 = isBarrierUp(s, 1);
    setBarrierState(prev => {
      if (prev[0] && !b0) scene.showBarrierDown(0);
      if (prev[1] && !b1) scene.showBarrierDown(1);
      return [b0, b1];
    });
  }, []);

  const advanceTurn = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl || gameOverRef.current) return;
    const state = ctrl.getState();
    const prio = prioRef.current;

    const p0Units = state.units.filter(u => u.alive && u.playerId === 0).length;
    const p1Units = state.units.filter(u => u.alive && u.playerId === 1).length;
    const p0Needs = p0Units === 0 && !prio.p0Used;
    const p1Needs = p1Units === 0 && !prio.p1Used;

    if (p0Needs && p1Needs) {
      const first = state.rng.rollPercent(50) ? 0 : 1;
      setPhase({ type: 'priority', player: first });
      setUI({ type: 'pick_card' });
      sceneRef.current?.clearHighlights();
      syncUI();
      return;
    }
    if (p0Needs) {
      setPhase({ type: 'priority', player: 0 });
      setUI({ type: 'pick_card' });
      sceneRef.current?.clearHighlights();
      syncUI();
      return;
    }
    if (p1Needs) {
      setPhase({ type: 'priority', player: 1 });
      setUI({ type: 'pick_card' });
      sceneRef.current?.clearHighlights();
      syncUI();
      return;
    }

    const wasAlreadyInitiative = phaseRef.current.type === 'initiative';
    setPhase({ type: 'initiative' });
    phaseRef.current = { type: 'initiative' };

    if (!wasAlreadyInitiative) {
      const skipUids = new Set([...prio.spawnedThisTurn, ...prio.activatedThisTurn]);
      if (skipUids.size > 0) {
        state.activationQueue = state.activationQueue.filter(u => !skipUids.has(u.uid));
        state.currentActivationIndex = 0;
      }
    }

    if (ctrl.isQueueExhausted()) {
      ctrl.endTurn();
      const newPrio: PriorityState = { p0Used: false, p1Used: false, spawnedThisTurn: new Set(), activatedThisTurn: new Set() };
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
      resetTimer();
      showActiveUnitHL();
    }
    syncUI();
  }, [syncUI, showActiveUnitHL, resetTimer]);

  const onCardSelect = useCallback((cardId: number) => {
    if (isMultiplayer && matchRef.current && !matchRef.current.isMyTurn) return;
    const card = getCard(cardId);
    if (card.cardType === CardType.SPELL) {
      const ctrl = ctrlRef.current;
      const scene = sceneRef.current;
      if (!ctrl || !scene) return;
      const player = getActivePlayer();
      if (ctrl.getState().players[player].mana < card.manaCost) return;

      setUI({ type: 'target_spell', cardId });
      uiRef.current = { type: 'target_spell', cardId };

      const validHexes = getSpellTargets(ctrl.getState(), player, cardId);
      const isHeal = cardId === 10;
      const isArea = card.spellTargetType === SpellTargetType.AREA;
      const hlType = isHeal ? 'ally' as const : isArea ? 'area' as const : 'enemy' as const;
      scene.showSpellHighlights(validHexes, hlType);
      return;
    }
    if (card.cardType !== CardType.UNIT) return;
    const ctrl = ctrlRef.current;
    const scene = sceneRef.current;
    if (!ctrl || !scene) return;

    setUI({ type: 'place_card', cardId });

    const player = getActivePlayer();
    const state = ctrl.getState();
    const cols = player === 0 ? P1_DEPLOY_COLS : P2_DEPLOY_COLS;
    const validHexes: HexCoord[] = [];
    for (const col of cols) {
      for (let row = 0; row < GRID_ROWS; row++) {
        if (canSpawn(state, player, cardId, { col, row }).valid) {
          validHexes.push({ col, row });
        }
      }
    }
    scene.showDeployHighlights(validHexes);
  }, [getActivePlayer]);

  const onCardCancel = useCallback(() => {
    if (uiRef.current.type === 'target_spell') {
      setUI({ type: 'unit_turn' });
      uiRef.current = { type: 'unit_turn' };
      showActiveUnitHL();
      return;
    }
    const p = phaseRef.current;
    if (p.type === 'priority') {
      setUI({ type: 'pick_card' });
      sceneRef.current?.clearHighlights();
    } else {
      setUI({ type: 'unit_turn' });
      showActiveUnitHL();
    }
  }, [showActiveUnitHL]);

  const onPass = useCallback(() => {
    if (isMultiplayer && matchRef.current && !matchRef.current.isMyTurn) return;
    const ctrl = ctrlRef.current;
    if (!ctrl || gameOverRef.current) return;

    if (phaseRef.current.type === 'priority') {
      const player = phaseRef.current.player;
      const prev = prioRef.current;
      const newPrio: PriorityState = {
        ...prev,
        p0Used: player === 0 ? true : prev.p0Used,
        p1Used: player === 1 ? true : prev.p1Used,
      };
      setPriority(newPrio);
      prioRef.current = newPrio;
      sceneRef.current?.clearHighlights();
      advanceTurn();
      return;
    }

    const cu = ctrl.getCurrentUnit();
    if (cu) trackActivated(cu.uid);
    ctrl.passActivation();
    sendAction({ type: 'pass' });
    sceneRef.current?.clearHighlights();
    resetTimer();
    advanceTurn();
  }, [advanceTurn, trackActivated, resetTimer, sendAction]);

  // ─── Hex click handler ──────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { col, row, worldX, worldY } = detail;
      const ctrl = ctrlRef.current;
      const scene = sceneRef.current;
      if (!ctrl || !scene) return;
      if (isMultiplayer && matchRef.current && !matchRef.current.isMyTurn) return;
      const state = ctrl.getState();
      const currentUI = uiRef.current;
      const currentPhase = phaseRef.current;

      if (currentUI.type === 'animating') return;

      // ── Cast spell ──
      if (currentUI.type === 'target_spell') {
        const player = getActivePlayer();
        const spellCardId = currentUI.cardId;
        if (!canCast(state, player, spellCardId, { col, row }).valid) return;

        setUI({ type: 'animating' });
        uiRef.current = { type: 'animating' };
        scene.clearHighlights();

        const result = executeCast(state, player, spellCardId, { col, row });
        sendAction({ type: 'cast', playerId: player, cardId: spellCardId, col, row });
        const targetHex = { col, row };

        const finishSpellCast = () => {
          checkBarrierChange();
          syncUI();
          resetTimer();
          if (handleWinCheck()) return;
          if (currentPhase.type === 'priority') {
            const prev = prioRef.current;
            const newPrio: PriorityState = {
              ...prev,
              p0Used: player === 0 ? true : prev.p0Used,
              p1Used: player === 1 ? true : prev.p1Used,
            };
            setPriority(newPrio);
            prioRef.current = newPrio;
          } else {
            const cu = ctrl.getCurrentUnit();
            if (cu) trackActivated(cu.uid);
            ctrl.passActivation();
          }
          setTimeout(() => advanceTurn(), 400);
        };

        if (!result.success) {
          scene.showFizzle(targetHex);
          finishSpellCast();
          return;
        }

        scene.playSpellFx(spellCardId, targetHex, () => {
          for (const a of result.affectedUnits) {
            const u = state.units.find(x => x.uid === a.uid);
            if (!u) continue;
            if (a.healed !== undefined && a.healed > 0) {
              scene.showHealNumber({ col: u.col, row: u.row }, a.healed);
              scene.updateHpBar(u.uid, u.currentHp, u.maxHp);
            }
            if (a.damage !== undefined && a.damage > 0) {
              scene.showDamageNumber({ col: u.col, row: u.row }, a.damage, false);
              scene.updateHpBar(u.uid, u.currentHp, u.maxHp);
            }
            if (a.died) {
              scene.playDeath(u.uid, () => {});
            }
            if (a.statusApplied) {
              const statusLabel = a.statusApplied === 'slow' ? 'SLOWED'
                : a.statusApplied === 'polymorph' ? 'POLYMORPHED'
                : 'CURSED';
              scene.showStatusText({ col: u.col, row: u.row }, statusLabel);
              if (a.statusApplied === 'polymorph') {
                scene.swapToSheep(u.uid);
              }
            }
          }
          if (result.heroDamage) {
            scene.showHeroDamage(result.heroDamage.playerId, result.heroDamage.damage, false);
          }
          finishSpellCast();
        });
        return;
      }

      // ── Place card ──
      if (currentUI.type === 'place_card') {
        const player = getActivePlayer();
        const result = canSpawn(state, player, currentUI.cardId, { col, row });
        if (!result.valid) return;

        const unit = executeSpawn(state, player, currentUI.cardId, { col, row });
        scene.spawnUnit(unit);
        sendAction({ type: 'spawn', playerId: player, cardId: currentUI.cardId, col, row });

        if (currentPhase.type === 'priority') {
          ctrl.rebuildQueue();
          const prev = prioRef.current;
          const newSpawned = new Set(prev.spawnedThisTurn);
          newSpawned.add(unit.uid);
          const newPrio: PriorityState = {
            p0Used: player === 0 ? true : prev.p0Used,
            p1Used: player === 1 ? true : prev.p1Used,
            spawnedThisTurn: newSpawned,
            activatedThisTurn: prev.activatedThisTurn,
          };
          setPriority(newPrio);
          prioRef.current = newPrio;
          scene.clearHighlights();
          advanceTurn();
        } else {
          const prev = prioRef.current;
          const newSpawned = new Set(prev.spawnedThisTurn);
          newSpawned.add(unit.uid);
          const newPrio = { ...prev, spawnedThisTurn: newSpawned };
          setPriority(newPrio);
          prioRef.current = newPrio;
          ctrl.passActivation();
          scene.clearHighlights();
          advanceTurn();
        }
        return;
      }

      if (currentUI.type !== 'unit_turn' && currentUI.type !== 'unit_acted') return;

      const cu = ctrl.getCurrentUnit();
      if (!cu) return;

      // ── Click on enemy ──
      // First check exact hex, then check nearby hexes (sprites render above their hex
      // due to anchor offset, so clicks on the sprite body may resolve to a neighbor hex)
      let targetUnit = state.units.find(u =>
        u.alive && u.playerId !== cu.playerId &&
        u.occupiedCells.some(c => c.col === col && c.row === row),
      );
      if (!targetUnit) {
        // Check if any attackable enemy is on a hex adjacent to the clicked hex
        const directTargets = getAttackTargets(state, cu.uid);
        const autoWalkTgts = getAutoWalkTargets(state, cu.uid);
        const allTargetUids = new Set([
          ...directTargets.map(t => t.unitUid),
          ...autoWalkTgts.map(t => t.unitUid),
        ]);
        // Find the closest enemy unit to the click position
        let bestDist = Infinity;
        for (const uid of allTargetUids) {
          const u = state.units.find(x => x.uid === uid);
          if (!u) continue;
          for (const cell of u.occupiedCells) {
            // Only consider enemies whose cells are on or adjacent to the clicked hex
            const dist = Math.abs(cell.col - col) + Math.abs(cell.row - row);
            if (dist <= 1) {
              const p = hex2px(cell.col, cell.row);
              const d = (p.x - worldX) ** 2 + (p.y - worldY) ** 2;
              if (d < bestDist) {
                bestDist = d;
                targetUnit = u;
              }
            }
          }
        }
      }

      if (targetUnit) {
        const finishMeleeAttack = (atkResult: ReturnType<typeof executeAttack>) => {
          scene.showDamageNumber(
            { col: targetUnit.col, row: targetUnit.row },
            atkResult.damage, atkResult.isCrit,
          );
          if (atkResult.targetDied) {
            scene.playDeath(targetUnit.uid, () => {});
            checkBarrierChange();
          }

          if (atkResult.retaliation && !atkResult.targetDied) {
            scene.playAttack(targetUnit.uid, { col: cu.col, row: cu.row }, () => {
              scene.updateHpBar(cu.uid, cu.currentHp, cu.maxHp);
              scene.showDamageNumber(
                { col: cu.col, row: cu.row },
                atkResult.retaliation!.damage, atkResult.retaliation!.isCrit,
              );
              if (atkResult.retaliation!.attackerDied) {
                scene.playDeath(cu.uid, () => {});
                checkBarrierChange();
              }
              syncUI();
              resetTimer();
              scheduleAutoEnd();
              setUI({ type: 'unit_acted' });
              uiRef.current = { type: 'unit_acted' };
            });
          } else {
            syncUI();
            resetTimer();
            scheduleAutoEnd();
            setUI({ type: 'unit_acted' });
            uiRef.current = { type: 'unit_acted' };
          }
        };

        // Direct attack?
        if (canAttack(state, cu.uid, targetUnit.uid).valid) {
          setUI({ type: 'animating' });
          uiRef.current = { type: 'animating' };
          scene.clearHighlights();

          const attackResult = executeAttack(state, cu.uid, targetUnit.uid);
          sendAction({ type: 'attack', attackerUid: cu.uid, targetUid: targetUnit.uid });
          scene.updateHpBar(targetUnit.uid, targetUnit.currentHp, targetUnit.maxHp);

          if (attackResult.attackType === 'ranged') {
            scene.playAttack(cu.uid, { col: targetUnit.col, row: targetUnit.row }, () => {
              scene.animateProjectile(
                { col: cu.col, row: cu.row },
                { col: targetUnit.col, row: targetUnit.row },
                () => {
                  scene.showDamageNumber(
                    { col: targetUnit.col, row: targetUnit.row },
                    attackResult.damage, attackResult.isCrit,
                  );
                  if (attackResult.targetDied) {
                    scene.playDeath(targetUnit.uid, () => {});
                    checkBarrierChange();
                  }
                  syncUI();
                  resetTimer();
                  scheduleAutoEnd();
                  setUI({ type: 'unit_acted' });
                  uiRef.current = { type: 'unit_acted' };
                },
              );
            });
          } else {
            scene.playAttack(cu.uid, { col: targetUnit.col, row: targetUnit.row }, () => {
              finishMeleeAttack(attackResult);
            });
          }
          return;
        }

        // Auto-walk melee attack?
        const card = getCard(cu.cardId);
        if (isMelee(card)) {
          const walkHex = getAutoWalkHex(state, cu.uid, targetUnit.uid, { x: worldX, y: worldY });
          if (walkHex) {
            setUI({ type: 'animating' });
            uiRef.current = { type: 'animating' };
            scene.clearHighlights();

            const path = executeMove(state, cu.uid, walkHex);
            sendAction({ type: 'move', unitUid: cu.uid, col: walkHex.col, row: walkHex.row });
            scene.moveUnit(cu.uid, path, () => {
              const attackResult = executeAttack(state, cu.uid, targetUnit.uid);
              sendAction({ type: 'attack', attackerUid: cu.uid, targetUid: targetUnit.uid });
              scene.updateHpBar(targetUnit.uid, targetUnit.currentHp, targetUnit.maxHp);

              scene.playAttack(cu.uid, { col: targetUnit.col, row: targetUnit.row }, () => {
                finishMeleeAttack(attackResult);
              });
            });
            return;
          }
        }
        return;
      }

      // ── Move (not clicking enemy) ──
      if (currentUI.type === 'unit_acted') return;
      if (!canMove(state, cu.uid, { col, row }).valid) return;

      setUI({ type: 'animating' });
      uiRef.current = { type: 'animating' };
      scene.clearHighlights();

      const path = executeMove(state, cu.uid, { col, row });
      sendAction({ type: 'move', unitUid: cu.uid, col, row });
      scene.moveUnit(cu.uid, path, () => {
        setUI({ type: 'unit_turn' });
        uiRef.current = { type: 'unit_turn' };
        resetTimer();
        if (cu.remainingAp > 0) {
          showActiveUnitHL();
        } else {
          scheduleAutoEnd();
        }
        syncUI();
      });
    };

    window.addEventListener('hex-click', handler);
    return () => window.removeEventListener('hex-click', handler);
  }, [getActivePlayer, advanceTurn, showActiveUnitHL, syncUI, scheduleAutoEnd]);

  // ─── Offgrid click (hero marker — unit attack or spell) ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { worldX, worldY } = (e as CustomEvent).detail;
      const ctrl = ctrlRef.current;
      const scene = sceneRef.current;
      if (!ctrl || !scene || gameOverRef.current) return;
      if (isMultiplayer && matchRef.current && !matchRef.current.isMyTurn) return;
      const currentUI = uiRef.current;
      const currentPhase = phaseRef.current;
      const state = ctrl.getState();

      // Which hero marker was clicked?
      let clickedPid = -1;
      for (const pid of [0, 1]) {
        const pos = scene.getHeroWorldPos(pid);
        const dist = Math.sqrt((worldX - pos.x) ** 2 + (worldY - pos.y) ** 2);
        if (dist < HEX_SIZE * 1.0) { clickedPid = pid; break; }
      }
      if (clickedPid < 0) return;

      // ── Spell targeting hero ──
      if (currentUI.type === 'target_spell') {
        const player = getActivePlayer();
        const spellCardId = currentUI.cardId;
        const heroHex = HERO_HEX[clickedPid];
        if (!canCast(state, player, spellCardId, heroHex).valid) return;

        setUI({ type: 'animating' });
        uiRef.current = { type: 'animating' };
        scene.clearHighlights();

        const result = executeCast(state, player, spellCardId, heroHex);
        sendAction({ type: 'cast', playerId: player, cardId: spellCardId, col: heroHex.col, row: heroHex.row });

        const finishSpellOnHero = () => {
          checkBarrierChange();
          syncUI();
          resetTimer();
          if (handleWinCheck()) return;
          if (currentPhase.type === 'priority') {
            const prev = prioRef.current;
            const newPrio: PriorityState = {
              ...prev,
              p0Used: player === 0 ? true : prev.p0Used,
              p1Used: player === 1 ? true : prev.p1Used,
            };
            setPriority(newPrio);
            prioRef.current = newPrio;
          } else {
            const cu = ctrl.getCurrentUnit();
            if (cu) trackActivated(cu.uid);
            ctrl.passActivation();
          }
          setTimeout(() => advanceTurn(), 400);
        };

        if (!result.success) {
          scene.showFizzle(heroHex);
          finishSpellOnHero();
          return;
        }

        scene.playSpellFx(spellCardId, heroHex, () => {
          if (result.heroDamage) {
            scene.showHeroDamage(result.heroDamage.playerId, result.heroDamage.damage, false);
          }
          finishSpellOnHero();
        });
        return;
      }

      // ── Unit attack on hero marker ──
      if (currentUI.type !== 'unit_turn' && currentUI.type !== 'unit_acted') return;
      const cu = ctrl.getCurrentUnit();
      if (!cu) return;
      const enemyPid = cu.playerId === 0 ? 1 : 0;
      if (clickedPid !== enemyPid) return;
      if (!canAttackHero(state, cu.uid, enemyPid).valid) return;

      setUI({ type: 'animating' });
      uiRef.current = { type: 'animating' };
      scene.clearHighlights();

      const heroResult = executeHeroAttack(state, cu.uid, enemyPid);
      sendAction({ type: 'attack-hero', attackerUid: cu.uid, targetPlayerId: enemyPid });
      scene.showHeroDamage(enemyPid, heroResult.damage, heroResult.isCrit);
      syncUI();
      resetTimer();

      if (handleWinCheck()) return;

      scheduleAutoEnd();
      setUI({ type: 'unit_acted' });
      uiRef.current = { type: 'unit_acted' };
    };

    window.addEventListener('offgrid-click', handler);
    return () => window.removeEventListener('offgrid-click', handler);
  }, [getActivePlayer, syncUI, resetTimer, handleWinCheck, scheduleAutoEnd, advanceTurn, trackActivated, checkBarrierChange]);

  // ─── Activation timer ──────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (gameOverRef.current) return;
      const ctrl = ctrlRef.current;
      const scene = sceneRef.current;
      if (!ctrl || !scene) return;
      const currentUI = uiRef.current;
      const currentPhase = phaseRef.current;

      if (currentPhase.type === 'priority') return;
      if (currentUI.type === 'animating') return;
      if (currentUI.type === 'pick_card') return;

      timerRef.current -= 1;
      const t = timerRef.current;
      setTimer(t);

      if (t <= 0) {
        const cu = ctrl.getCurrentUnit();
        if (!cu) return;

        const result = applyTimeoutDamage(ctrl.getState(), cu.playerId);
        scene.showStampDamage(cu.playerId, result.damage);
        syncUI();

        if (handleWinCheck()) return;

        ctrl.passActivation();
        scene.clearHighlights();
        resetTimer();
        advanceTurn();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [syncUI, handleWinCheck, advanceTurn, resetTimer]);

  // ─── Engine init ────────────────────────────────────
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

      if (!isMultiplayer) {
        ctrl.startGame(Date.now());
      }

      const scene = new BattleScene(engine);
      scene.createGrid();
      scene.createHeroMarkers();
      await scene.preloadSheep();
      sceneRef.current = scene;

      ctrl.on('effectExpired', (data: { uid: number }) => {
        const unit = ctrl.getState().units.find(u => u.uid === data.uid);
        if (unit && !unit.polymorphed) {
          scene.restoreFromSheep(data.uid);
        }
      });

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

  // ─── Multiplayer connection ─────────────────────────
  useEffect(() => {
    if (!isMultiplayer || !address || duelId === null) return;

    const conn = new ConnectionManager('ws://localhost:3001');
    connRef.current = conn;

    conn.on('paired', () => {
      setMultiplayerStatus('Connected to opponent. Exchanging decks...');
    });

    conn.on('connected', async () => {
      const ctrl = ctrlRef.current;
      if (!ctrl) return;

      const decks = listDecks(address);
      const validDeck = decks.find((d) => d.slots.filter((s) => s !== null).length === DECK_SIZE);
      if (!validDeck) {
        setMultiplayerStatus('No valid deck found!');
        return;
      }

      const myDeckIds = validDeck.slots.filter((s): s is number => s !== null);

      const match = new MatchManager(conn);
      matchRef.current = match;

      const { opponentDeck } = await match.exchangeDecks(myDeckIds);
      match.startGame(duelId, ctrl);

      match.on('opponent-action', (action: GameAction) => {
        const scene = sceneRef.current;
        const state = ctrl.getState();
        if (!scene) { syncUI(); return; }

        switch (action.type) {
          case 'spawn': {
            const unit = state.units.find(u =>
              u.alive && u.col === action.col && u.row === action.row,
            );
            if (unit) scene.spawnUnit(unit);
            break;
          }
          case 'move': {
            scene.moveUnit(action.unitUid, [{ col: action.col, row: action.row }], () => {});
            break;
          }
          case 'attack': {
            const target = state.units.find(u => u.uid === action.targetUid);
            const attacker = state.units.find(u => u.uid === action.attackerUid);
            if (target) {
              scene.updateHpBar(target.uid, target.currentHp, target.maxHp);
              if (!target.alive) scene.playDeath(target.uid, () => {});
            }
            if (attacker) {
              scene.updateHpBar(attacker.uid, attacker.currentHp, attacker.maxHp);
              if (!attacker.alive) scene.playDeath(attacker.uid, () => {});
            }
            break;
          }
          case 'attack-hero': {
            const p = state.players[action.targetPlayerId];
            scene.updateHeroHp(action.targetPlayerId, p.heroHp, HERO_HP);
            break;
          }
          case 'cast': {
            for (const u of state.units) {
              if (u.alive) scene.updateHpBar(u.uid, u.currentHp, u.maxHp);
              else scene.playDeath(u.uid, () => {});
            }
            scene.updateHeroHp(0, state.players[0].heroHp, HERO_HP);
            scene.updateHeroHp(1, state.players[1].heroHp, HERO_HP);
            break;
          }
          default:
            break;
        }

        checkBarrierChange();
        syncUI();
        handleWinCheck();
      });

      match.on('game-over', (winner: number | null) => {
        if (winner === null) {
          setGameOver({ winner: -1 });
        } else {
          setGameOver({ winner });
        }
        gameOverRef.current = true;
      });

      match.on('desync', (myHash: string, theirHash: string) => {
        console.error(`Desync detected! my=${myHash} theirs=${theirHash}`);
        setMultiplayerStatus('State desync detected!');
      });

      match.on('opponent-disconnected', () => {
        setMultiplayerStatus('Opponent disconnected!');
      });

      setMultiplayerStatus('Battle started!');
      setTimeout(() => setMultiplayerStatus(''), 2000);
    });

    setMultiplayerStatus('Waiting for opponent...');
    conn.join(duelId, address);

    return () => {
      matchRef.current?.destroy();
      conn.disconnect();
    };
  }, [duelId, address, isMultiplayer]);

  // ─── Derived display values ─────────────────────────
  const activePlayer = getActivePlayer();
  const isPriority = phase.type === 'priority';
  const isPlacing = ui.type === 'place_card';
  const isTargetingSpell = ui.type === 'target_spell';
  const isAnimating = ui.type === 'animating';
  const cardPickerDisabled = ui.type === 'unit_acted' || isAnimating;
  const showPassBtn = (phase.type === 'initiative' && (ui.type === 'unit_turn' || ui.type === 'unit_acted'))
    || (phase.type === 'priority' && ui.type === 'pick_card');
  const currentUnit = ctrlRef.current?.getCurrentUnit();

  let statusText = '';
  if (isPriority) {
    statusText = `P${phase.player + 1} — Deploy a unit`;
  } else if (currentUnit) {
    const card = getCard(currentUnit.cardId);
    statusText = `P${activePlayer + 1} — ${card.name} (AP: ${currentUnit.remainingAp}/${currentUnit.speed})`;
  } else {
    statusText = `P${activePlayer + 1}`;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} onContextMenu={e => e.preventDefault()} />

      {/* ─── Top Bar ───────────────────────────────── */}
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
                <span style={{ color: '#6699ff', fontSize: 'var(--text-xs)' }}>P1</span>
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
                <span
                  onClick={() => { const s = ctrlRef.current?.getState(); if (s) { s.players[0].mana += 5; syncUI(); } }}
                  style={{ cursor: 'pointer', color: '#6699ff', fontSize: 'var(--text-xs)', opacity: 0.6 }}
                >+5</span>
              </div>

              {/* Timer */}
              {!isPriority && !gameOver && (
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
                <span style={{ color: '#ff6666', fontSize: 'var(--text-xs)' }}>P2</span>
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
                <span
                  onClick={() => { const s = ctrlRef.current?.getState(); if (s) { s.players[1].mana += 5; syncUI(); } }}
                  style={{ cursor: 'pointer', color: '#ff6666', fontSize: 'var(--text-xs)', opacity: 0.6 }}
                >+5</span>
              </div>
            </div>
          </div>
        </ArcanaPanel>
      </div>

      {/* ─── Initiative Sidebar ────────────────────── */}
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

      {/* ─── Action Buttons ────────────────────────── */}
      {showPassBtn && !isAnimating && (
        <div style={{
          position: 'fixed', bottom: 190, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 10, zIndex: 101,
        }}>
          <ArcanaButton variant="blue" size="sm" onClick={onPass}>Pass</ArcanaButton>
        </div>
      )}

      {/* ─── Multiplayer Status Overlay ──────────── */}
      {isMultiplayer && multiplayerStatus && (
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

      {isMultiplayer && !multiplayerStatus && matchRef.current && (
        <div style={{
          position: 'fixed', top: 48, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', color: matchRef.current.isMyTurn ? '#66ff66' : '#ff6666',
          padding: '4px 16px', borderRadius: 8, fontSize: 13, zIndex: 100,
          fontFamily: 'var(--font-display)',
        }}>
          {matchRef.current.isMyTurn ? 'Your turn' : "Opponent's turn"}
        </div>
      )}

      {/* ─── Game Over Overlay ──────────────────── */}
      {gameOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
        }}>
          <ArcanaPanel variant="slate">
            <div style={{
              padding: '24px 48px', textAlign: 'center',
              fontFamily: 'var(--font-display)', color: 'var(--color-text)',
            }}>
              <div style={{
                fontSize: '32px', color: 'var(--color-gold)',
                marginBottom: 12,
              }}>
                P{gameOver.winner + 1} WINS!
              </div>
              <div style={{ fontSize: 'var(--text-sm)', marginBottom: 16, opacity: 0.8 }}>
                The opposing hero has fallen.
              </div>
              <ArcanaButton variant="gold" size="md" onClick={() => window.location.reload()}>
                New Battle
              </ArcanaButton>
            </div>
          </ArcanaPanel>
        </div>
      )}

      {/* ─── Card Picker ──────────────────────────── */}
      <CardPicker
        currentMana={mana[activePlayer]}
        onCardSelect={onCardSelect}
        selectedCardId={isPlacing ? ui.cardId : isTargetingSpell ? ui.cardId : null}
        onCancel={onCardCancel}
        disabled={cardPickerDisabled}
      />
    </div>
  );
}
