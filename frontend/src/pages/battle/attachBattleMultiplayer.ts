import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { ServerConnection } from '../../multiplayer/ServerConnection';
import type { MatchEvent, SerializedGameState, GameAction } from '../../multiplayer/ServerConnection';
import { listDecks } from '../../lib/deckStorage';
import { DECK_SIZE } from '../../lib/deckValidation';
import { HERO_HP, getCard } from '@arcana/game-core';
import type { GameController } from '@arcana/game-core';
import type { BattleScene } from '../../game/BattleScene';
import type { BattleTurnPhase, BattlePriorityState } from './battleTypes';

export interface AttachBattleMultiplayerInput {
  duelId: number;
  address: string;
  serverRef: MutableRefObject<ServerConnection | null>;
  getCtrl: () => GameController | null;
  getScene: () => BattleScene | null;
  phaseRef: MutableRefObject<BattleTurnPhase>;
  setPhase: Dispatch<SetStateAction<BattleTurnPhase>>;
  syncUI: () => void;
  resetTimer: () => void;
  setMultiplayerStatus: (s: string) => void;
  setGameOver: (result: { winner: number }) => void;
  setMySeat: (seat: 0 | 1) => void;
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
    conn.authenticate(p.signTypedData, nonce).then(() => {
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
    }).catch(() => {
      p.setMultiplayerStatus('Wallet signature rejected.');
    });
  });

  conn.on('waiting-for-opponent' as any, () => {
    p.setMultiplayerStatus('Waiting for opponent...');
  });

  conn.on('match-started', (state: SerializedGameState, seat: 0 | 1, opponent: string, seq: number) => {
    p.setMySeat(seat);
    p.setMultiplayerStatus('Battle started!');
    setTimeout(() => p.setMultiplayerStatus(''), 2000);

    // Initialize game controller from server snapshot
    const ctrl = p.getCtrl();
    if (!ctrl) return;
    // For MP, the server owns the game state. The client uses GameController
    // only for local display — we start it with the same seed as the server
    // and trust the server's state. The controller is used for getControllingPlayer()
    // and initiative queue display.
    ctrl.startGame(0, [state.players[0].hand, state.players[1].hand]);

    // Overwrite client state from server snapshot
    const s = ctrl.getState();
    s.turnNumber = state.turnNumber;
    s.nextUnitUid = state.nextUnitUid;
    s.currentActivationIndex = state.currentActivationIndex;
    s.phase = state.phase;
    s.players[0].mana = state.players[0].mana;
    s.players[0].heroHp = state.players[0].heroHp;
    s.players[1].mana = state.players[1].mana;
    s.players[1].heroHp = state.players[1].heroHp;
    // The hand/deck for our seat comes from the server; opponent's is hidden
    s.players[seat].hand = state.players[seat].hand;
    s.players[seat].deck = state.players[seat].deck;

    p.syncUI();
  });

  conn.on('action-confirmed', (_seq: number, action: GameAction, events: MatchEvent[], _stateHash: string) => {
    const scene = p.getScene();
    const ctrl = p.getCtrl();
    if (!scene || !ctrl) return;
    const state = ctrl.getState();

    applyEventsToScene(scene, ctrl, events, p);
  });

  conn.on('action-rejected', (_seq: number, reason: string) => {
    console.warn('Action rejected:', reason);
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

  conn.on('state-snapshot', (state: SerializedGameState, _seq: number) => {
    p.setMultiplayerStatus('Reconnected!');
    setTimeout(() => p.setMultiplayerStatus(''), 2000);
    // Full state rebuild from snapshot on reconnect
    // TODO: rebuild scene from snapshot
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

function applyEventsToScene(
  scene: BattleScene,
  ctrl: GameController,
  events: MatchEvent[],
  p: Pick<AttachBattleMultiplayerInput, 'syncUI' | 'resetTimer' | 'setPhase' | 'phaseRef'>,
): void {
  const state = ctrl.getState();

  for (const event of events) {
    switch (event.type) {
      case 'unit-spawned': {
        // Create a UnitInstance-like object for the scene
        const card = getCard(event.cardId);
        const unit = state.units.find(u => u.uid === event.uid);
        if (!unit) {
          // Server spawned a unit we don't have locally — create minimal representation
          // This happens because the client doesn't run executeSpawn for MP
          const newUnit = {
            uid: event.uid,
            cardId: event.cardId,
            playerId: event.playerId,
            col: event.col,
            row: event.row,
            currentHp: card.hp,
            maxHp: card.hp,
            attack: card.attack,
            defense: card.defense,
            speed: card.initiative,
            remainingAp: card.initiative,
            alive: true,
            occupiedCells: [{ col: event.col, row: event.row }],
            polymorphed: false,
            activeEffects: [],
            retaliatedThisTurn: false,
            ammo: card.ammo,
            size: card.size,
            magicResistance: card.magicResistance,
          };
          state.units.push(newUnit as any);
          state.board[event.row][event.col].unitUid = event.uid;
          scene.spawnUnit(newUnit as any);
        } else {
          scene.spawnUnit(unit);
        }
        break;
      }
      case 'unit-moved': {
        if (event.path.length >= 2) {
          scene.moveUnit(event.uid, event.path, () => {});
        }
        // Update local state position
        const movedUnit = state.units.find(u => u.uid === event.uid);
        if (movedUnit && event.path.length > 0) {
          const dest = event.path[event.path.length - 1];
          state.board[movedUnit.row][movedUnit.col].unitUid = null;
          movedUnit.col = dest.col;
          movedUnit.row = dest.row;
          for (const cell of movedUnit.occupiedCells) {
            cell.col = dest.col;
            cell.row = dest.row;
          }
          state.board[dest.row][dest.col].unitUid = movedUnit.uid;
        }
        break;
      }
      case 'unit-attacked': {
        const target = state.units.find(u => u.uid === event.targetUid);
        const attacker = state.units.find(u => u.uid === event.attackerUid);
        if (target) {
          target.currentHp = event.targetHp;
          scene.updateHpBar(target.uid, target.currentHp, target.maxHp);
          scene.showDamageNumber({ col: target.col, row: target.row }, event.damage, event.crit);
        }
        if (attacker && event.retaliation > 0) {
          attacker.currentHp = event.attackerHp;
          scene.updateHpBar(attacker.uid, attacker.currentHp, attacker.maxHp);
          scene.showDamageNumber({ col: attacker.col, row: attacker.row }, event.retaliation, false);
        }
        break;
      }
      case 'hero-attacked': {
        state.players[event.targetPlayerId].heroHp = event.heroHp;
        scene.showHeroDamage(event.targetPlayerId, event.damage, false);
        scene.updateHeroHp(event.targetPlayerId, event.heroHp, HERO_HP);
        break;
      }
      case 'unit-died': {
        const dead = state.units.find(u => u.uid === event.uid);
        if (dead) {
          dead.alive = false;
          scene.playDeath(event.uid, () => {});
        }
        break;
      }
      case 'spell-cast': {
        scene.playSpellFx(event.cardId, { col: event.col, row: event.row }, () => {});
        break;
      }
      case 'effect-applied': {
        if (event.effectId === 'polymorph') {
          scene.swapToSheep(event.uid);
        }
        const statusLabel = event.effectId === 'slow' ? 'SLOWED'
          : event.effectId === 'polymorph' ? 'POLYMORPHED'
          : 'CURSED';
        const unit = state.units.find(u => u.uid === event.uid);
        if (unit) {
          scene.showStatusText({ col: unit.col, row: unit.row }, statusLabel);
        }
        break;
      }
      case 'effect-expired': {
        if (event.effectId === 'polymorph') {
          scene.restoreFromSheep(event.uid);
        }
        break;
      }
      case 'hp-changed': {
        const unit = state.units.find(u => u.uid === event.uid);
        if (unit) {
          unit.currentHp = event.hp;
          scene.updateHpBar(unit.uid, unit.currentHp, unit.maxHp);
        }
        break;
      }
      case 'hero-hp-changed': {
        state.players[event.playerId].heroHp = event.hp;
        scene.updateHeroHp(event.playerId, event.hp, HERO_HP);
        break;
      }
      case 'mana-changed': {
        state.players[event.playerId].mana = event.mana;
        break;
      }
      case 'activation-changed': {
        // Update activation queue pointer
        if (event.uid === null) {
          state.currentActivationIndex = state.activationQueue.length;
        } else {
          const idx = state.activationQueue.findIndex(u => u.uid === event.uid);
          if (idx >= 0) state.currentActivationIndex = idx;
        }
        break;
      }
      case 'turn-changed': {
        state.turnNumber = event.turnNumber;
        break;
      }
      case 'queue-rebuilt': {
        // Rebuild activation queue from UIDs
        state.activationQueue = event.queue
          .map(uid => state.units.find(u => u.uid === uid))
          .filter((u): u is NonNullable<typeof u> => u !== undefined);
        state.currentActivationIndex = 0;
        break;
      }
    }
  }

  scene.clearHighlights();
  p.syncUI();
  p.resetTimer();
}
