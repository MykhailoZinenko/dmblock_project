import type { GameState } from '../GameState';
import type { UnitInstance } from '../types';
import { getCard, isBuilding, isMelee, isRanged, hasAbility } from '../cardRegistry';
import { hexNeighbors, hexDistance } from '../hexUtils';
import { calculateDamage, applyDamage } from '../combat';
import { P1_DEPLOY_COLS, P2_DEPLOY_COLS, GRID_COLS } from '../constants';

export interface AttackTarget {
  unitUid: number;
  type: 'melee' | 'ranged';
}

function getAdjacentCells(unit: UnitInstance): Set<string> {
  const cells = new Set<string>();
  for (const oc of unit.occupiedCells) {
    for (const n of hexNeighbors(oc.col, oc.row)) {
      cells.add(`${n.col},${n.row}`);
    }
  }
  return cells;
}

function isOnEnemyHalf(attackerPlayerId: number, targetCol: number): boolean {
  if (attackerPlayerId === 0) return targetCol >= Math.ceil(GRID_COLS / 2);
  return targetCol < Math.floor(GRID_COLS / 2);
}

function isAdjacentToEnemyMelee(state: GameState, attacker: UnitInstance): boolean {
  const adjCells = getAdjacentCells(attacker);
  for (const unit of state.units) {
    if (!unit.alive || unit.playerId === attacker.playerId) continue;
    const card = getCard(unit.cardId);
    if (!isMelee(card)) continue;
    for (const cell of unit.occupiedCells) {
      if (adjCells.has(`${cell.col},${cell.row}`)) return true;
    }
  }
  return false;
}

export function getAttackTargets(state: GameState, attackerUid: number): AttackTarget[] {
  const attacker = state.units.find(u => u.uid === attackerUid);
  if (!attacker || !attacker.alive) return [];

  const card = getCard(attacker.cardId);
  if (isBuilding(card)) return [];

  const targets: AttackTarget[] = [];
  const seenUids = new Set<number>();

  if (isRanged(card) && attacker.ammo > 0) {
    for (const unit of state.units) {
      if (!unit.alive || unit.playerId === attacker.playerId) continue;
      targets.push({ unitUid: unit.uid, type: 'ranged' });
    }
    return targets;
  }

  if (!isMelee(card)) return [];

  const adjCells = getAdjacentCells(attacker);
  for (const unit of state.units) {
    if (!unit.alive || unit.playerId === attacker.playerId || seenUids.has(unit.uid)) continue;
    for (const cell of unit.occupiedCells) {
      if (adjCells.has(`${cell.col},${cell.row}`)) {
        targets.push({ unitUid: unit.uid, type: 'melee' });
        seenUids.add(unit.uid);
        break;
      }
    }
  }

  return targets;
}

export function canAttack(
  state: GameState,
  attackerUid: number,
  targetUid: number,
): { valid: boolean; reason?: string } {
  const attacker = state.units.find(u => u.uid === attackerUid);
  if (!attacker || !attacker.alive) return { valid: false, reason: 'Attacker is dead or not found' };
  if (attacker.remainingAp <= 0) return { valid: false, reason: 'No action points' };

  const target = state.units.find(u => u.uid === targetUid);
  if (!target || !target.alive) return { valid: false, reason: 'Target is dead or not found' };
  if (target.playerId === attacker.playerId) return { valid: false, reason: 'Cannot attack friendly units' };

  const validTargets = getAttackTargets(state, attackerUid);
  if (!validTargets.some(t => t.unitUid === targetUid)) return { valid: false, reason: 'Target not in range' };

  return { valid: true };
}

export interface AttackResult {
  damage: number;
  isCrit: boolean;
  targetDied: boolean;
  attackType: 'melee' | 'ranged';
  retaliation?: {
    damage: number;
    isCrit: boolean;
    attackerDied: boolean;
  };
}

export function executeAttack(
  state: GameState,
  attackerUid: number,
  targetUid: number,
): AttackResult {
  const attacker = state.units.find(u => u.uid === attackerUid)!;
  const target = state.units.find(u => u.uid === targetUid)!;
  const attackerCard = getCard(attacker.cardId);

  const targets = getAttackTargets(state, attackerUid);
  const targetInfo = targets.find(t => t.unitUid === targetUid)!;
  const attackType = targetInfo.type;

  let damageResult = calculateDamage(attacker, target, state.rng);
  let finalDamage = damageResult.damage;

  if (attackType === 'ranged') {
    let multiplier = 1;

    // Half damage on enemy half (unless Marksman)
    if (isOnEnemyHalf(attacker.playerId, target.col) && !hasAbility(attackerCard, 'marksman')) {
      multiplier *= 0.5;
    }

    // Half damage if blocked by adjacent enemy melee
    if (isAdjacentToEnemyMelee(state, attacker)) {
      multiplier *= 0.5;
    }

    if (multiplier < 1) {
      finalDamage = Math.max(1, Math.floor(finalDamage * multiplier));
    }

    attacker.ammo--;
  }

  const targetDied = applyDamage(state, targetUid, finalDamage);

  const result: AttackResult = {
    damage: finalDamage,
    isCrit: damageResult.isCrit,
    targetDied,
    attackType,
  };

  // Retaliation: melee only, target alive, hasn't retaliated, is melee unit
  if (attackType === 'melee' && !targetDied && !target.retaliatedThisTurn) {
    const targetCard = getCard(target.cardId);
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

  attacker.remainingAp = 0;
  return result;
}
