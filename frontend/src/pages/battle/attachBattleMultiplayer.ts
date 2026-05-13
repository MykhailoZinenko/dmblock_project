import type { MutableRefObject } from 'react';
import { ServerConnection } from '../../multiplayer/ServerConnection';
import type { MatchEvent, SerializedGameState, GameAction } from '../../multiplayer/ServerConnection';
import { listDecks } from '../../lib/deckStorage';
import { DECK_SIZE } from '../../lib/deckValidation';
import { HERO_HP } from '@arcana/game-core';
import type { GameController, GameState, UnitInstance } from '@arcana/game-core';
import type { BattleScene } from '../../game/BattleScene';

export interface AttachBattleMultiplayerInput {
  duelId: number;
  address: string;
  serverRef: MutableRefObject<ServerConnection | null>;
  getCtrl: () => GameController | null;
  getScene: () => BattleScene | null;
  syncUI: () => void;
  resetTimer: () => void;
  setMultiplayerStatus: (s: string) => void;
  setGameOver: (result: { winner: number; results?: any }) => void;
  setMySeat: (seat: 0 | 1) => void;
  setMyTurn: (turn: boolean, isPriority: boolean) => void;
  signTypedData: (params: {
    domain: { name: string; chainId: number };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<`0x${string}`>;
}

export function attachBattleMultiplayer(p: AttachBattleMultiplayerInput): () => void {
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'ws://localhost:3001';
  const conn = new ServerConnection(serverUrl, p.duelId, p.address);
  p.serverRef.current = conn;

  // ── Auth ──
  conn.on('auth-challenge', (nonce: string) => {
    p.setMultiplayerStatus('Signing session...');
    conn.authenticate(p.signTypedData, nonce).catch((err) => {
      console.error('Auth failed:', err);
      p.setMultiplayerStatus(`Auth failed: ${err?.message ?? err}`);
    });
  });

  // ── New game: server asks us to submit deck ──
  conn.on('waiting-for-opponent', () => {
    p.setMultiplayerStatus('Submitting deck...');
    const decks = listDecks(p.address);
    const validDeck = decks.find(d => d.slots.filter(s => s !== null).length === DECK_SIZE);
    if (!validDeck) {
      p.setMultiplayerStatus('No valid deck found!');
      return;
    }
    conn.submitDeck(validDeck.slots.filter((s): s is number => s !== null));
    p.setMultiplayerStatus('Waiting for opponent...');
  });

  // ── Match started (new game OR reconnect — same handler) ──
  conn.on('match-started', (serverState, seat, _opponent, _seq, controllingPlayer, isPriority) => {
    p.setMySeat(seat);
    p.setMultiplayerStatus('');

    const ctrl = p.getCtrl();
    const scene = p.getScene();
    if (!ctrl || !scene) return;

    // Initialize or reset controller
    if (!ctrl.isGameStarted()) {
      ctrl.startGame(0, [serverState.players[0].hand, serverState.players[1].hand]);
    }
    applyServerSnapshot(ctrl.getState(), serverState);

    // Rebuild scene
    scene.clearAllUnits();
    for (const unit of ctrl.getState().units) {
      if (unit.alive) scene.spawnUnit(unit);
    }

    p.syncUI();
    p.setMyTurn(controllingPlayer === seat, isPriority);
  });

  // ── Action confirmed: play visuals, replace state ──
  conn.on('action-confirmed', (_seq, _action, events, serverState, controllingPlayer, isPriority) => {
    const ctrl = p.getCtrl();
    const scene = p.getScene();
    if (!ctrl || !scene) return;

    playEventsOnScene(scene, ctrl.getState(), events);
    applyServerSnapshot(ctrl.getState(), serverState);
    p.syncUI();
    p.resetTimer();
    p.setMyTurn(controllingPlayer === conn.seat, isPriority);
  });

  // ── Action rejected: reset UI ──
  conn.on('action-rejected', (_seq, reason) => {
    p.setMultiplayerStatus(`Rejected: ${reason}`);
    setTimeout(() => p.setMultiplayerStatus(''), 3000);
    p.setMyTurn(true, false);
  });

  // ── Timeout ──
  conn.on('turn-timeout', (player, damage) => {
    const scene = p.getScene();
    if (scene && damage > 0) scene.showStampDamage(player, damage);
  });

  // ── Game over ──
  conn.on('game-over', (winner, _reason, results) => {
    p.setGameOver({ winner, results });
  });

  // ── Connection events ──
  conn.on('opponent-disconnected', () => {
    p.setMultiplayerStatus('Opponent disconnected. Waiting 60s...');
  });
  conn.on('opponent-reconnected', () => {
    p.setMultiplayerStatus('Opponent reconnected!');
    setTimeout(() => p.setMultiplayerStatus(''), 2000);
  });
  conn.on('sign-request', (_duelId, winner) => {
    console.log('Settlement sign requested. Winner:', winner);
  });
  conn.on('error', (message) => {
    p.setMultiplayerStatus(`Error: ${message}`);
  });

  p.setMultiplayerStatus('Connecting...');
  return () => {
    conn.disconnect();
    p.serverRef.current = null;
  };
}

// ── Play animations from events (visuals only, no state mutation) ──

function playEventsOnScene(scene: BattleScene, state: GameState, events: MatchEvent[]): void {
  const deathsHandledByAttack = new Set<number>();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    switch (event.type) {
      case 'unit-spawned':
        scene.spawnUnit(event.unit);
        break;

      case 'unit-moved': {
        const nextEvent = events[i + 1];
        const isAutoWalk = nextEvent?.type === 'unit-attacked' &&
          (nextEvent as any).attackerUid === event.uid;

        if (isAutoWalk) {
          i++;
          const atkEvent = nextEvent as Extract<MatchEvent, { type: 'unit-attacked' }>;
          const target = state.units.find(u => u.uid === atkEvent.targetUid);
          const attacker = state.units.find(u => u.uid === atkEvent.attackerUid);
          if (event.path.length >= 2) {
            scene.moveUnit(event.uid, event.path, () => {
              if (attacker && target) {
                playAttackWithRetaliation(scene, atkEvent, attacker, target);
              }
            });
          }
        } else if (event.path.length >= 2) {
          scene.moveUnit(event.uid, event.path, () => {});
        }
        break;
      }

      case 'unit-attacked': {
        const target = state.units.find(u => u.uid === event.targetUid);
        const attacker = state.units.find(u => u.uid === event.attackerUid);
        if (event.targetHp <= 0) deathsHandledByAttack.add(event.targetUid);
        if (event.attackerHp <= 0) deathsHandledByAttack.add(event.attackerUid);
        if (attacker && target) {
          playAttackWithRetaliation(scene, event, attacker, target);
        }
        break;
      }

      case 'hero-attacked':
        scene.showHeroDamage(event.targetPlayerId, event.damage, false);
        scene.updateHeroHp(event.targetPlayerId, event.heroHp, HERO_HP);
        break;

      case 'unit-died':
        if (!deathsHandledByAttack.has(event.uid)) {
          scene.playDeath(event.uid, () => {});
        }
        break;

      case 'spell-cast':
        scene.playSpellFx(event.cardId, { col: event.col, row: event.row }, () => {});
        break;

      case 'effect-applied': {
        if (event.effectId === 'polymorph') scene.swapToSheep(event.uid);
        const label = event.effectId === 'slow' ? 'SLOWED'
          : event.effectId === 'polymorph' ? 'POLYMORPHED' : 'CURSED';
        const u = state.units.find(x => x.uid === event.uid);
        if (u) scene.showStatusText({ col: u.col, row: u.row }, label);
        break;
      }

      case 'effect-expired':
        if (event.effectId === 'polymorph') scene.restoreFromSheep(event.uid);
        break;

      case 'hp-changed': {
        const u = state.units.find(x => x.uid === event.uid);
        if (u) scene.updateHpBar(u.uid, event.hp, u.maxHp);
        break;
      }

      case 'hero-hp-changed':
        scene.updateHeroHp(event.playerId, event.hp, HERO_HP);
        break;

      default:
        break;
    }
  }
  scene.clearHighlights();
}

function playAttackWithRetaliation(
  scene: BattleScene,
  event: Extract<MatchEvent, { type: 'unit-attacked' }>,
  attacker: UnitInstance,
  target: UnitInstance,
): void {
  scene.playAttack(attacker.uid, { col: target.col, row: target.row }, () => {
    scene.updateHpBar(target.uid, event.targetHp, target.maxHp);
    scene.showDamageNumber({ col: target.col, row: target.row }, event.damage, event.crit);
    if (event.targetHp <= 0) {
      scene.playDeath(target.uid, () => {});
    }
    if (event.retaliation > 0 && event.targetHp > 0) {
      scene.playAttack(target.uid, { col: attacker.col, row: attacker.row }, () => {
        scene.updateHpBar(attacker.uid, event.attackerHp, attacker.maxHp);
        scene.showDamageNumber({ col: attacker.col, row: attacker.row }, event.retaliation, false);
        if (event.attackerHp <= 0) {
          scene.playDeath(attacker.uid, () => {});
        }
      });
    }
  });
}

// ── Replace local state with server snapshot ──

function applyServerSnapshot(local: GameState, snapshot: SerializedGameState): void {
  for (let i = 0; i < 2; i++) {
    local.players[i].mana = snapshot.players[i].mana;
    local.players[i].heroHp = snapshot.players[i].heroHp;
    local.players[i].timeoutCount = snapshot.players[i].timeoutCount;
    if (snapshot.players[i].hand.length > 0) local.players[i].hand = snapshot.players[i].hand;
    if (snapshot.players[i].deck.length > 0) local.players[i].deck = snapshot.players[i].deck;
  }

  local.units = snapshot.units;

  for (let r = 0; r < local.board.length; r++) {
    for (let c = 0; c < local.board[r].length; c++) {
      local.board[r][c].unitUid = null;
    }
  }
  for (const unit of local.units) {
    if (!unit.alive) continue;
    for (const cell of unit.occupiedCells) {
      if (cell.row < local.board.length && cell.col < local.board[0].length) {
        local.board[cell.row][cell.col].unitUid = unit.uid;
      }
    }
  }

  local.turnNumber = snapshot.turnNumber;
  local.currentActivationIndex = snapshot.currentActivationIndex;
  local.nextUnitUid = snapshot.nextUnitUid;
  local.phase = snapshot.phase;

  local.activationQueue = snapshot.activationQueue
    .map(uid => local.units.find(u => u.uid === uid))
    .filter((u): u is NonNullable<typeof u> => u !== undefined);
}
