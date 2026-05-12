export type GameAction =
  | { type: 'spawn'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'move'; unitUid: number; col: number; row: number }
  | { type: 'attack'; attackerUid: number; targetUid: number }
  | { type: 'attack-hero'; attackerUid: number; targetPlayerId: number }
  | { type: 'cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'pass' }
  | { type: 'end-turn' };

export type PeerMessage =
  | { type: 'deck-hash'; hash: string }
  | { type: 'deck-reveal'; deck: number[] }
  | { type: 'action'; action: GameAction }
  | { type: 'state-hash'; hash: string }
  | { type: 'sign-result'; winner: string; signature: string };
