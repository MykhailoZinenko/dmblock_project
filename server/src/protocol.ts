import type { GameState, HexCoord } from '@arcana/game-core';

// --- Game Actions (intents from client) ---

export type GameAction =
  | { type: 'spawn'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'move'; unitUid: number; col: number; row: number }
  | { type: 'attack'; attackerUid: number; targetUid: number }
  | { type: 'attack-hero'; attackerUid: number; targetPlayerId: number }
  | { type: 'cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'pass' }
  | { type: 'end-turn' };

// --- Match Events (state deltas for client animation) ---

export type MatchEvent =
  | { type: 'unit-spawned'; uid: number; playerId: number; cardId: number; col: number; row: number }
  | { type: 'unit-moved'; uid: number; path: HexCoord[] }
  | { type: 'unit-attacked'; attackerUid: number; targetUid: number; damage: number; retaliation: number; attackerHp: number; targetHp: number; crit: boolean }
  | { type: 'hero-attacked'; attackerUid: number; targetPlayerId: number; damage: number; heroHp: number }
  | { type: 'unit-died'; uid: number }
  | { type: 'spell-cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'effect-applied'; uid: number; effectId: string; duration: number }
  | { type: 'effect-expired'; uid: number; effectId: string }
  | { type: 'mana-changed'; playerId: number; mana: number }
  | { type: 'hero-hp-changed'; playerId: number; hp: number }
  | { type: 'hp-changed'; uid: number; hp: number }
  | { type: 'activation-changed'; uid: number | null }
  | { type: 'turn-changed'; turnNumber: number }
  | { type: 'queue-rebuilt'; queue: number[] };

// --- Serialized Game State (JSON-safe) ---

export interface SerializedGameState {
  players: GameState['players'];
  units: GameState['units'];
  board: GameState['board'];
  turnNumber: number;
  activationQueue: number[];
  currentActivationIndex: number;
  phase: GameState['phase'];
  rngState: number;
  nextUnitUid: number;
}

// --- Client → Server ---

export type ClientMessage =
  | { type: 'join'; duelId: number; address: string }
  | { type: 'auth'; signature: string; nonce: string; expiresAt: number }
  | { type: 'submit-deck'; deck: number[] }
  | { type: 'action'; action: GameAction; seq: number; hmac: string }
  | { type: 'sign-result'; duelId: number; winner: string; signature: string }
  | { type: 'request-log' };

// --- Server → Client ---

export type ServerMessage =
  | { type: 'auth-challenge'; nonce: string }
  | { type: 'auth-ok'; sessionStart: number }
  | { type: 'waiting-for-opponent' }
  | { type: 'match-started'; seat: 0 | 1; opponent: string; state: SerializedGameState; seq: number }
  | { type: 'action-confirmed'; seq: number; action: GameAction; events: MatchEvent[]; stateHash: string }
  | { type: 'action-rejected'; seq: number; reason: string }
  | { type: 'state-snapshot'; state: SerializedGameState; seq: number }
  | { type: 'turn-timeout'; player: number; damage: number }
  | { type: 'game-over'; winner: number; reason: string }
  | { type: 'sign-request'; duelId: number; winner: string }
  | { type: 'opponent-disconnected' }
  | { type: 'opponent-reconnected' }
  | { type: 'action-log'; sessionSignatures: [string, string]; actions: ActionLogEntry[] }
  | { type: 'error'; message: string };

// --- Action log entry ---

export interface ActionLogEntry {
  seq: number;
  action: GameAction;
  hmac: string;
  timestamp: number;
}

// --- Serialization helpers ---

export function serializeState(state: GameState): SerializedGameState {
  return {
    players: state.players,
    units: state.units,
    board: state.board,
    turnNumber: state.turnNumber,
    activationQueue: state.activationQueue.map(u => u.uid),
    currentActivationIndex: state.currentActivationIndex,
    phase: state.phase,
    rngState: state.rng.serialize(),
    nextUnitUid: state.nextUnitUid,
  };
}

export function canonicalizeAction(seq: number, action: GameAction): string {
  const obj: Record<string, unknown> = { seq, ...action };
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}
