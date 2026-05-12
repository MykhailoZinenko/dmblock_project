export type ClientMessage =
  | { type: 'join'; duelId: number; address: string }
  | { type: 'sdp-offer'; sdp: unknown }
  | { type: 'sdp-answer'; sdp: unknown }
  | { type: 'ice-candidate'; candidate: unknown }
  | { type: 'deck-hash'; hash: string }
  | { type: 'deck-reveal'; deck: number[] }
  | { type: 'action'; action: GameAction }
  | { type: 'state-hash'; hash: string }
  | { type: 'sign-result'; duelId: number; winner: string; signature: string }
  | { type: 'request-arbiter'; duelId: number };

export type ServerMessage =
  | { type: 'paired'; opponent: string; playerIndex: 0 | 1 }
  | { type: 'sdp-offer'; sdp: unknown }
  | { type: 'sdp-answer'; sdp: unknown }
  | { type: 'ice-candidate'; candidate: unknown }
  | { type: 'opponent-disconnected' }
  | { type: 'arbiter-result'; duelId: number; winner: string; signature: string }
  | { type: 'error'; message: string };

export type GameAction =
  | { type: 'spawn'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'move'; unitUid: number; col: number; row: number }
  | { type: 'attack'; attackerUid: number; targetUid: number }
  | { type: 'attack-hero'; attackerUid: number; targetPlayerId: number }
  | { type: 'cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'pass' }
  | { type: 'end-turn' };
