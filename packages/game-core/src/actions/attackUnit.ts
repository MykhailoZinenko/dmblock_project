import type { GameState } from '../GameState';
import type { UnitInstance, HexCoord } from '../types';
import { getCard, isBuilding, isMelee, isRanged, hasAbility } from '../cardRegistry';
import { hexNeighbors, hexDistance, hex2px } from '../hexUtils';
import { calculateDamage, applyDamage } from '../combat';
import { P1_DEPLOY_COLS, P2_DEPLOY_COLS, GRID_COLS } from '../constants';
import { findReachable, coordKey } from '../pathfinding';
import { getOccupiedSet } from './moveUnit';

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

  // Adjacent melee targets (available to ALL non-building units)
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

  // Ranged targets (only if ranged unit with ammo)
  if (isRanged(card) && attacker.ammo > 0) {
    for (const unit of state.units) {
      if (!unit.alive || unit.playerId === attacker.playerId || seenUids.has(unit.uid)) continue;
      targets.push({ unitUid: unit.uid, type: 'ranged' });
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
  } else if (attackType === 'melee' && isRanged(attackerCard)) {
    // Ranged unit forced into melee — half damage
    finalDamage = Math.max(1, Math.floor(finalDamage * 0.5));
  }

  const targetDied = applyDamage(state, targetUid, finalDamage);

  const result: AttackResult = {
    damage: finalDamage,
    isCrit: damageResult.isCrit,
    targetDied,
    attackType,
  };

  // Retaliation: any non-building unit can retaliate when hit in melee
  if (attackType === 'melee' && !targetDied && !target.retaliatedThisTurn) {
    const targetCard = getCard(target.cardId);
    if (!isBuilding(targetCard)) {
      const retDamage = calculateDamage(target, attacker, state.rng);
      let retFinalDamage = retDamage.damage;
      if (isRanged(targetCard)) {
        retFinalDamage = Math.max(1, Math.floor(retFinalDamage * 0.5));
      }
      const attackerDied = applyDamage(state, attackerUid, retFinalDamage);
      target.retaliatedThisTurn = true;
      result.retaliation = {
        damage: retFinalDamage,
        isCrit: retDamage.isCrit,
        attackerDied,
      };
    }
  }

  attacker.remainingAp = 0;
  return result;
}

/**
 * For melee auto-walk: find the best hex adjacent to the target that the
 * attacker can reach within (remainingAp - 1), picking the one closest
 * to the cursor position for directional control.
 *
 * Returns null if already adjacent (no walk needed) or no valid hex exists.
 */
export function getAutoWalkHex(
  state: GameState,
  attackerUid: number,
  targetUid: number,
  cursorWorldPos: { x: number; y: number },
): HexCoord | null {
  const attacker = state.units.find(u => u.uid === attackerUid);
  const target = state.units.find(u => u.uid === targetUid);
  if (!attacker || !target || !attacker.alive || !target.alive) return null;

  const card = getCard(attacker.cardId);
  if (isBuilding(card) || isRanged(card)) return null;

  // Already adjacent? No walk needed.
  const adjCells = getAdjacentCells(attacker);
  for (const cell of target.occupiedCells) {
    if (adjCells.has(`${cell.col},${cell.row}`)) return null;
  }

  // Budget for movement: need to reserve 1 AP for the attack
  const moveBudget = attacker.remainingAp - 1;
  if (moveBudget <= 0) return null;

  // Get all hexes reachable within moveBudget
  const occupied = getOccupiedSet(state);
  for (const cell of attacker.occupiedCells) {
    occupied.delete(coordKey(cell.col, cell.row));
  }
  const reachable = findReachable(attacker.col, attacker.row, moveBudget, occupied);
  const reachableSet = new Set(reachable.map(h => `${h.col},${h.row}`));

  // Find hexes adjacent to target that are in reachable set
  const targetAdj = new Set<string>();
  for (const tc of target.occupiedCells) {
    for (const n of hexNeighbors(tc.col, tc.row)) {
      targetAdj.add(`${n.col},${n.row}`);
    }
  }

  const candidates: HexCoord[] = [];
  for (const key of targetAdj) {
    if (!reachableSet.has(key)) continue;
    if (occupied.has(key)) continue;
    const [c, r] = key.split(',').map(Number);
    candidates.push({ col: c, row: r });
  }

  if (candidates.length === 0) return null;

  // Pick candidate closest to cursor position
  let best = candidates[0];
  let bestDist = Infinity;
  for (const cand of candidates) {
    const p = hex2px(cand.col, cand.row);
    const dx = p.x - cursorWorldPos.x;
    const dy = p.y - cursorWorldPos.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = cand;
    }
  }

  return best;
}

/**
 * Returns all enemy units that can be reached via auto-walk + attack
 * by the given melee attacker. Used for orange highlights.
 * Excludes enemies already adjacent (those get red highlights via getAttackTargets).
 */
export function getAutoWalkTargets(
  state: GameState,
  attackerUid: number,
): { unitUid: number; cells: HexCoord[] }[] {
  const attacker = state.units.find(u => u.uid === attackerUid);
  if (!attacker || !attacker.alive) return [];

  const card = getCard(attacker.cardId);
  if (isBuilding(card) || isRanged(card)) return [];

  const moveBudget = attacker.remainingAp - 1;
  if (moveBudget <= 0) return [];

  const occupied = getOccupiedSet(state);
  for (const cell of attacker.occupiedCells) {
    occupied.delete(coordKey(cell.col, cell.row));
  }
  const reachable = findReachable(attacker.col, attacker.row, moveBudget, occupied);
  const reachableSet = new Set(reachable.map(h => `${h.col},${h.row}`));

  const directTargets = getAttackTargets(state, attackerUid);
  const directUids = new Set(directTargets.map(t => t.unitUid));

  const results: { unitUid: number; cells: HexCoord[] }[] = [];

  for (const unit of state.units) {
    if (!unit.alive || unit.playerId === attacker.playerId) continue;
    if (directUids.has(unit.uid)) continue;

    let canReach = false;
    for (const tc of unit.occupiedCells) {
      for (const n of hexNeighbors(tc.col, tc.row)) {
        const key = `${n.col},${n.row}`;
        if (reachableSet.has(key) && !occupied.has(key)) {
          canReach = true;
          break;
        }
      }
      if (canReach) break;
    }

    if (canReach) {
      results.push({
        unitUid: unit.uid,
        cells: [...unit.occupiedCells],
      });
    }
  }

  return results;
}
