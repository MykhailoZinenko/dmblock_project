/** Shared between `Battle.tsx` and multiplayer attach — keep shapes in sync. */
export type BattleTurnPhase =
  | { type: 'priority'; player: number }
  | { type: 'initiative' };

export interface BattlePriorityState {
  p0Used: boolean;
  p1Used: boolean;
  spawnedThisTurn: Set<number>;
  activatedThisTurn: Set<number>;
}
