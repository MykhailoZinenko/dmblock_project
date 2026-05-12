import type { GameState } from '../GameState';
import type { UnitInstance } from '../types';
import { getCard, isBuilding, isMelee } from '../cardRegistry';
import { hexNeighbors } from '../hexUtils';
import { calculateDamage, applyDamage } from '../combat';

export interface AttackTarget {
  unitUid: number;
  type: 'melee';
}

/**
 * Get valid attack targets for a unit.
 * - Melee units (ammo === 0, speed > 0): adjacent enemy units
 * - Buildings (speed 0): cannot attack
 * - Ranged units (ammo > 0): handled in Task 12, returns empty for now
 */
export function getAttackTargets(state: GameState, attackerUid: number): AttackTarget[] {
  const attacker = state.units.find(u => u.uid === attackerUid);
  if (!attacker || !attacker.alive) return [];

  const card = getCard(attacker.cardId);

  // Buildings can't attack
  if (isBuilding(card)) return [];

  // Ranged units — handled in Task 12
  if (attacker.ammo > 0) return [];

  // Must be melee (ammo === 0, speed > 0)
  if (!isMelee(card) && attacker.speed <= 0) return [];

  // Find adjacent enemy units
  const targets: AttackTarget[] = [];
  const adjacentCells = new Set<string>();

  // Gather all cells adjacent to any of attacker's occupied cells
  for (const occupied of attacker.occupiedCells) {
    for (const neighbor of hexNeighbors(occupied.col, occupied.row)) {
      adjacentCells.add(`${neighbor.col},${neighbor.row}`);
    }
  }

  // Check each alive enemy unit for adjacency
  const seenUids = new Set<number>();
  for (const unit of state.units) {
    if (!unit.alive || unit.playerId === attacker.playerId || seenUids.has(unit.uid)) continue;
    // Check if any of the unit's occupied cells are adjacent
    for (const cell of unit.occupiedCells) {
      if (adjacentCells.has(`${cell.col},${cell.row}`)) {
        targets.push({ unitUid: unit.uid, type: 'melee' });
        seenUids.add(unit.uid);
        break;
      }
    }
  }

  return targets;
}

/**
 * Check if a specific attack is valid.
 */
export function canAttack(
  state: GameState,
  attackerUid: number,
  targetUid: number,
): { valid: boolean; reason?: string } {
  const attacker = state.units.find(u => u.uid === attackerUid);
  if (!attacker || !attacker.alive) {
    return { valid: false, reason: 'Attacker is dead or not found' };
  }

  if (attacker.remainingAp <= 0) {
    return { valid: false, reason: 'Attacker has no action points' };
  }

  const target = state.units.find(u => u.uid === targetUid);
  if (!target || !target.alive) {
    return { valid: false, reason: 'Target is dead or not found' };
  }

  if (target.playerId === attacker.playerId) {
    return { valid: false, reason: 'Cannot attack friendly units' };
  }

  // Check if target is in the valid attack targets list
  const validTargets = getAttackTargets(state, attackerUid);
  if (!validTargets.some(t => t.unitUid === targetUid)) {
    return { valid: false, reason: 'Target is not in range' };
  }

  return { valid: true };
}

export interface AttackResult {
  damage: number;
  isCrit: boolean;
  targetDied: boolean;
  retaliation?: {
    damage: number;
    isCrit: boolean;
    attackerDied: boolean;
  };
}

/**
 * Execute a melee attack.
 *
 * 1. Calculate and apply damage to target
 * 2. If target survives, is melee, adjacent, and hasn't retaliated: retaliate
 * 3. Set attacker's remaining AP to 0
 */
export function executeAttack(
  state: GameState,
  attackerUid: number,
  targetUid: number,
): AttackResult {
  const attacker = state.units.find(u => u.uid === attackerUid)!;
  const target = state.units.find(u => u.uid === targetUid)!;

  // 1. Calculate and apply damage to target
  const damageResult = calculateDamage(attacker, target, state.rng);
  const targetDied = applyDamage(state, targetUid, damageResult.damage);

  const result: AttackResult = {
    damage: damageResult.damage,
    isCrit: damageResult.isCrit,
    targetDied,
  };

  // 2. Retaliation check
  if (!targetDied && !target.retaliatedThisTurn) {
    const targetCard = getCard(target.cardId);
    // Target must be melee (ammo === 0, speed > 0) to retaliate
    if (isMelee(targetCard) && !isBuilding(targetCard)) {
      const retDamage = calculateDamage(target, attacker, state.rng);
      const attackerDied = applyDamage(state, attackerUid, retDamage.damage);
      target.retaliatedThisTurn = true;
      result.retaliation = {
        damage: retDamage.damage,
        isCrit: retDamage.isCrit,
        attackerDied,
      };
    }
  }

  // 3. Consume all AP
  attacker.remainingAp = 0;

  return result;
}
