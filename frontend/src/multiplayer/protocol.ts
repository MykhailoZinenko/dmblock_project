export type GameAction =
  | {
      type: 'spawn';
      playerId: number;
      cardId: number;
      col: number;
      row: number;
      /** Mirrors Battle phase: free deploy round vs initiative spawn. */
      priorityPhase?: boolean;
    }
  | {
      type: 'move';
      unitUid: number;
      col: number;
      row: number;
      /** Full hex path start→end (length ≥ 2) for peer animation; state still applies from col/row. */
      path?: { col: number; row: number }[];
    }
  | { type: 'attack'; attackerUid: number; targetUid: number }
  | { type: 'attack-hero'; attackerUid: number; targetPlayerId: number }
  | { type: 'cast'; playerId: number; cardId: number; col: number; row: number }
  | {
      type: 'pass';
      /** Free-deploy pass — do not call `passActivation` on the controller. */
      priorityPhase?: boolean;
      priorityPlayerId?: number;
      releasedUnitUid?: number;
    }
  | { type: 'end-turn' };

export type PeerMessage =
  | { type: 'deck-hash'; hash: string }
  | { type: 'deck-reveal'; deck: number[] }
  | { type: 'action'; action: GameAction }
  | { type: 'state-hash'; hash: string }
  | { type: 'sign-result'; winner: string; signature: string };
