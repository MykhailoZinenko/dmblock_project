import type { GameState } from '../GameState';
import type { UnitInstance, HexCoord } from '../types';
import { getCard, isBuilding, isRanged, isMelee } from '../cardRegistry';
import { calculateDamage } from '../combat';
import { TIMEOUT_DAMAGE, HERO_HP, GRID_COLS, GRID_ROWS } from '../constants';

export const HERO_HEX: Record<number, HexCoord> = {
  0: { col: 0, row: -1 },
  1: { col: GRID_COLS - 2, row: GRID_ROWS },
};

// Manually defined — hexNeighbors breaks on out-of-board rows due to
// odd-r parity. These were verified via cube coordinate conversion.
export const HERO_ADJACENT: Record<number, HexCoord[]> = {
  0: [{ col: 0, row: 0 }, { col: 1, row: 0 }],
  1: [{ col: GRID_COLS - 2, row: GRID_ROWS - 1 }, { col: GRID_COLS - 1, row: GRID_ROWS - 1 }],
};

export function isBarrierUp(state: GameState, playerId: number): boolean {
  return state.units.some(u => u.alive && u.playerId === playerId);
}

function isAdjacentToHero(unit: UnitInstance, heroPlayerId: number): boolean {
  const adj = HERO_ADJACENT[heroPlayerId];
  for (const cell of unit.occupiedCells) {
    if (adj.some(a => a.col === cell.col && a.row === cell.row)) return true;
  }
  return false;
}

export interface HeroAttackResult {
  damage: number;
  isCrit: boolean;
  heroDied: boolean;
}

export function canAttackHero(
  state: GameState,
  attackerUid: number,
  targetPlayerId: number,
): { valid: boolean; reason?: string } {
  if (isBarrierUp(state, targetPlayerId)) {
    return { valid: false, reason: 'Barrier is up' };
  }

  const attacker = state.units.find(u => u.uid === attackerUid);
  if (!attacker || !attacker.alive) return { valid: false, reason: 'Attacker dead or not found' };
  if (attacker.playerId === targetPlayerId) return { valid: false, reason: 'Cannot attack own hero' };
  if (attacker.remainingAp <= 0) return { valid: false, reason: 'No action points' };

  const card = getCard(attacker.cardId);
  if (isBuilding(card)) return { valid: false, reason: 'Buildings cannot attack hero' };

  if (isRanged(card)) {
    if (attacker.ammo <= 0) return { valid: false, reason: 'No ammo' };
    return { valid: true };
  }

  if (!isAdjacentToHero(attacker, targetPlayerId)) {
    return { valid: false, reason: 'Melee must be adjacent to hero' };
  }

  return { valid: true };
}

export function executeHeroAttack(
  state: GameState,
  attackerUid: number,
  targetPlayerId: number,
): HeroAttackResult {
  const attacker = state.units.find(u => u.uid === attackerUid)!;
  const card = getCard(attacker.cardId);

  let damage = attacker.attack;
  const isCrit = state.rng.rollPercent(10);
  if (isCrit) damage = Math.floor(damage * 1.5);
  damage = Math.max(1, damage);

  if (isRanged(card)) {
    attacker.ammo--;
  }

  state.players[targetPlayerId].heroHp -= damage;
  const heroDied = state.players[targetPlayerId].heroHp <= 0;
  if (heroDied) state.players[targetPlayerId].heroHp = 0;

  attacker.remainingAp = 0;
  return { damage, isCrit, heroDied };
}

export function checkWinCondition(state: GameState): { winner: number } | null {
  if (state.players[0].heroHp <= 0) return { winner: 1 };
  if (state.players[1].heroHp <= 0) return { winner: 0 };
  return null;
}

export interface TimeoutResult {
  damage: number;
  heroDied: boolean;
}

export function applyTimeoutDamage(state: GameState, playerId: number): TimeoutResult {
  const player = state.players[playerId];
  const idx = Math.min(player.timeoutCount, TIMEOUT_DAMAGE.length - 1);
  const damage = TIMEOUT_DAMAGE[idx];

  player.heroHp -= damage;
  player.timeoutCount++;

  const heroDied = player.heroHp <= 0;
  if (heroDied) player.heroHp = 0;

  return { damage, heroDied };
}
