import type { UnitInstance } from './types';
import { DamageType, Faction } from './types';
import type { GameState } from './GameState';
import { SeededRNG } from './rng';
import { CRIT_CHANCE_PERCENT, CRIT_MULTIPLIER } from './constants';
import { getCard, isBuilding } from './cardRegistry';

export interface DamageResult {
  damage: number;
  isCrit: boolean;
}

/**
 * Calculate damage from attacker to target using the core damage formula.
 *
 * baseDamage = max(1, attacker.attack - target.defense)
 * Magic damage applies MR reduction (except Inferno vs buildings).
 * Critical hits multiply damage by CRIT_MULTIPLIER.
 * Final damage is floored and clamped to minimum 1.
 */
export function calculateDamage(
  attacker: UnitInstance,
  target: UnitInstance,
  rng: SeededRNG,
): DamageResult {
  let damage: number;

  if (attacker.damageType === DamageType.MAGIC) {
    // Magic damage bypasses defense — raw attack, reduced only by MR
    damage = attacker.attack;
    const targetCard = getCard(target.cardId);
    const attackerCard = getCard(attacker.cardId);
    const targetIsBuilding = isBuilding(targetCard);

    if (targetIsBuilding && attackerCard.faction === Faction.INFERNO) {
      // Inferno bypasses building MR (physical conversion)
    } else if (target.magicResistance > 0) {
      damage = Math.floor(damage * (1 - target.magicResistance / 100));
    }
  } else {
    // Physical damage: attack minus defense
    damage = Math.max(1, attacker.attack - target.defense);
  }

  // Critical hit roll
  const isCrit = rng.rollPercent(CRIT_CHANCE_PERCENT);
  if (isCrit) {
    damage = damage * CRIT_MULTIPLIER;
  }

  // Floor and enforce minimum 1
  const finalDamage = Math.max(1, Math.floor(damage));

  return { damage: finalDamage, isCrit };
}

/**
 * Apply damage to a unit. Returns true if the unit died.
 * On death: sets alive=false and clears all occupied board cells.
 */
export function applyDamage(state: GameState, targetUid: number, damage: number): boolean {
  const unit = state.units.find(u => u.uid === targetUid);
  if (!unit) return false;

  unit.currentHp = Math.max(0, unit.currentHp - damage);

  if (unit.currentHp <= 0) {
    unit.alive = false;
    // Clear board cells
    for (const cell of unit.occupiedCells) {
      state.board[cell.row][cell.col].unitUid = null;
    }
    return true;
  }

  return false;
}
