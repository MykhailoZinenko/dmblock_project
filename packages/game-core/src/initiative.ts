import { SeededRNG } from './rng';
import type { UnitInstance } from './types';

/**
 * Builds the initiative queue for a turn.
 *
 * Sort order:
 * 1. Initiative descending (higher goes first)
 * 2. Speed descending (tiebreaker)
 * 3. Seeded random (final tiebreaker — deterministic)
 *
 * Dead units are filtered out before sorting.
 */
export function buildInitiativeQueue(
  units: UnitInstance[],
  rng: SeededRNG,
): UnitInstance[] {
  const alive = units.filter((u) => u.alive);

  // Assign a random tiebreaker to each unit for deterministic ordering
  const tiebreakers = new Map<number, number>();
  for (const unit of alive) {
    tiebreakers.set(unit.uid, rng.next());
  }

  // Copy to avoid mutating the input array
  const sorted = [...alive];
  sorted.sort((a, b) => {
    // Primary: initiative descending
    if (a.initiative !== b.initiative) {
      return b.initiative - a.initiative;
    }
    // Secondary: speed descending
    if (a.speed !== b.speed) {
      return b.speed - a.speed;
    }
    // Tertiary: seeded random tiebreaker
    return tiebreakers.get(b.uid)! - tiebreakers.get(a.uid)!;
  });

  return sorted;
}
