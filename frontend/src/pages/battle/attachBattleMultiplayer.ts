import type { MutableRefObject } from 'react';
import { ServerConnection } from '../../multiplayer/ServerConnection';
import type { MatchEvent, SerializedGameState, GameAction } from '../../multiplayer/ServerConnection';
import { listDecks } from '../../lib/deckStorage';
import { DECK_SIZE } from '../../lib/deckValidation';
import { HERO_HP } from '@arcana/game-core';
import type { GameController, GameState } from '@arcana/game-core';
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
  setGameOver: (result: { winner: number }) => void;
  setMySeat: (seat: 0 | 1) => void;
  setMyTurn: (turn: boolean) => void;
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

  conn.on('auth-challenge', (nonce: string) => {
    p.setMultiplayerStatus('Signing session...');
    conn.authenticate(p.signTypedData, nonce).catch(() => {
      p.setMultiplayerStatus('Wallet signature rejected.');
    });
  });

  conn.on('state-change', (state) => {
    if (state === 'waiting') {
      // auth-ok received — now safe to submit deck
      if (deckSubmitted) return;
      deckSubmitted = true;
      p.setMultiplayerStatus('Authenticated. Submitting deck...');
      const decks = listDecks(p.address);
      const validDeck = decks.find(d => d.slots.filter(s => s !== null).length === DECK_SIZE);
      if (!validDeck) {
        p.setMultiplayerStatus('No valid deck found!');
        return;
      }
      const deckIds = validDeck.slots.filter((s): s is number => s !== null);
      conn.submitDeck(deckIds);
      p.setMultiplayerStatus('Deck submitted. Waiting for opponent...');
    }
  });
  let deckSubmitted = false;

  conn.on('match-started', (state: SerializedGameState, seat: 0 | 1, _opponent: string, _seq: number, controllingPlayer: number) => {
    p.setMySeat(seat);
    p.setMyTurn(controllingPlayer === seat);
    p.setMultiplayerStatus('Battle started!');
    setTimeout(() => p.setMultiplayerStatus(''), 2000);

    const ctrl = p.getCtrl();
    if (!ctrl) return;

    ctrl.startGame(0, [state.players[0].hand, state.players[1].hand]);

    const s = ctrl.getState();
    s.turnNumber = state.turnNumber;
    s.nextUnitUid = state.nextUnitUid;
    s.currentActivationIndex = state.currentActivationIndex;
    s.phase = state.phase;
    s.players[0].mana = state.players[0].mana;
    s.players[0].heroHp = state.players[0].heroHp;
    s.players[1].mana = state.players[1].mana;
    s.players[1].heroHp = state.players[1].heroHp;
    s.players[seat].hand = state.players[seat].hand;
    s.players[seat].deck = state.players[seat].deck;

    p.syncUI();
  });

  conn.on('action-confirmed', (_seq: number, _action: GameAction, events: MatchEvent[], serverState: SerializedGameState, controllingPlayer: number) => {
    const scene = p.getScene();
    const ctrl = p.getCtrl();
    if (!scene || !ctrl) return;

    const localState = ctrl.getState();
    playEventsOnScene(scene, localState, events);
    applyServerSnapshot(localState, serverState);
    p.syncUI();
    p.resetTimer();
    p.setMyTurn(controllingPlayer === conn.seat);
  });

  conn.on('action-rejected', (_seq: number, reason: string) => {
    console.warn('Action rejected:', reason);
    p.setMultiplayerStatus(`Rejected: ${reason}`);
    setTimeout(() => p.setMultiplayerStatus(''), 3000);
  });

  conn.on('turn-timeout', (player: number, damage: number) => {
    const scene = p.getScene();
    if (scene && damage > 0) {
      scene.showStampDamage(player, damage);
    }
  });

  conn.on('game-over', (winner: number, _reason: string) => {
    p.setGameOver({ winner });
    const ctrl = p.getCtrl();
    if (ctrl?.isGameStarted()) {
      ctrl.getState().phase = 'GAME_OVER';
    }
  });

  conn.on('state-snapshot', (snapshot: SerializedGameState, _seq: number) => {
    p.setMultiplayerStatus('Reconnected!');
    setTimeout(() => p.setMultiplayerStatus(''), 2000);

    const ctrl = p.getCtrl();
    const scene = p.getScene();
    if (!ctrl || !scene) return;

    if (!ctrl.isGameStarted()) {
      ctrl.startGame(0, [snapshot.players[0].hand, snapshot.players[1].hand]);
    }
    const localState = ctrl.getState();
    applyServerSnapshot(localState, snapshot);

    // Rebuild scene visuals from units
    for (const unit of localState.units) {
      if (unit.alive) scene.spawnUnit(unit);
    }

    p.syncUI();
  });

  conn.on('opponent-disconnected', () => {
    p.setMultiplayerStatus('Opponent disconnected. Waiting 60s...');
  });

  conn.on('opponent-reconnected', () => {
    p.setMultiplayerStatus('Opponent reconnected!');
    setTimeout(() => p.setMultiplayerStatus(''), 2000);
  });

  conn.on('sign-request', (_duelId: number, winner: string) => {
    // TODO: prompt wallet to sign settlement
    console.log('Settlement sign requested. Winner:', winner);
  });

  conn.on('error', (message: string) => {
    p.setMultiplayerStatus(`Error: ${message}`);
  });

  p.setMultiplayerStatus('Connecting...');
  return () => {
    conn.disconnect();
    p.serverRef.current = null;
  };
}

/**
 * Play animations from MatchEvents. Does NOT update game state —
 * state comes from the server snapshot via applyServerSnapshot.
 */
function playEventsOnScene(
  scene: BattleScene,
  localState: GameState,
  events: MatchEvent[],
): void {
  for (const event of events) {
    switch (event.type) {
      case 'unit-spawned': {
        scene.spawnUnit(event.unit);
        break;
      }
      case 'unit-moved': {
        if (event.path.length >= 2) {
          scene.moveUnit(event.uid, event.path, () => {});
        }
        break;
      }
      case 'unit-attacked': {
        const target = localState.units.find(u => u.uid === event.targetUid);
        const attacker = localState.units.find(u => u.uid === event.attackerUid);
        if (target) {
          scene.updateHpBar(target.uid, event.targetHp, target.maxHp);
          scene.showDamageNumber({ col: target.col, row: target.row }, event.damage, event.crit);
        }
        if (attacker && event.retaliation > 0) {
          scene.updateHpBar(attacker.uid, event.attackerHp, attacker.maxHp);
          scene.showDamageNumber({ col: attacker.col, row: attacker.row }, event.retaliation, false);
        }
        break;
      }
      case 'hero-attacked': {
        scene.showHeroDamage(event.targetPlayerId, event.damage, false);
        scene.updateHeroHp(event.targetPlayerId, event.heroHp, HERO_HP);
        break;
      }
      case 'unit-died': {
        scene.playDeath(event.uid, () => {});
        break;
      }
      case 'spell-cast': {
        scene.playSpellFx(event.cardId, { col: event.col, row: event.row }, () => {});
        break;
      }
      case 'effect-applied': {
        if (event.effectId === 'polymorph') scene.swapToSheep(event.uid);
        const label = event.effectId === 'slow' ? 'SLOWED'
          : event.effectId === 'polymorph' ? 'POLYMORPHED' : 'CURSED';
        const u = localState.units.find(x => x.uid === event.uid);
        if (u) scene.showStatusText({ col: u.col, row: u.row }, label);
        break;
      }
      case 'effect-expired': {
        if (event.effectId === 'polymorph') scene.restoreFromSheep(event.uid);
        break;
      }
      case 'hp-changed': {
        const u = localState.units.find(x => x.uid === event.uid);
        if (u) scene.updateHpBar(u.uid, event.hp, u.maxHp);
        break;
      }
      case 'hero-hp-changed': {
        scene.updateHeroHp(event.playerId, event.hp, HERO_HP);
        break;
      }
      default:
        break;
    }
  }
  scene.clearHighlights();
}

/**
 * Replace local game state with server snapshot.
 * This is the ONLY source of truth for state — events are for visuals only.
 */
function applyServerSnapshot(localState: GameState, snapshot: SerializedGameState): void {
  // Players: copy all fields the server sends (opponent hand/deck are empty — that's correct)
  for (let i = 0; i < 2; i++) {
    localState.players[i].mana = snapshot.players[i].mana;
    localState.players[i].heroHp = snapshot.players[i].heroHp;
    localState.players[i].timeoutCount = snapshot.players[i].timeoutCount;
    if (snapshot.players[i].hand.length > 0) {
      localState.players[i].hand = snapshot.players[i].hand;
    }
    if (snapshot.players[i].deck.length > 0) {
      localState.players[i].deck = snapshot.players[i].deck;
    }
  }

  // Units: replace entirely from snapshot
  localState.units = snapshot.units;

  // Board: rebuild from units
  for (let r = 0; r < localState.board.length; r++) {
    for (let c = 0; c < localState.board[r].length; c++) {
      localState.board[r][c].unitUid = null;
    }
  }
  for (const unit of localState.units) {
    if (!unit.alive) continue;
    for (const cell of unit.occupiedCells) {
      if (cell.row < localState.board.length && cell.col < localState.board[0].length) {
        localState.board[cell.row][cell.col].unitUid = unit.uid;
      }
    }
  }

  // Turn / queue
  localState.turnNumber = snapshot.turnNumber;
  localState.currentActivationIndex = snapshot.currentActivationIndex;
  localState.nextUnitUid = snapshot.nextUnitUid;
  localState.phase = snapshot.phase;

  // Activation queue: map UIDs to unit references
  localState.activationQueue = snapshot.activationQueue
    .map(uid => localState.units.find(u => u.uid === uid))
    .filter((u): u is NonNullable<typeof u> => u !== undefined);
}
