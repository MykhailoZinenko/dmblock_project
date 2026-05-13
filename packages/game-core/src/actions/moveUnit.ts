import type { GameState } from '../GameState';
import type { HexCoord } from '../types';
import { getCard, isBuilding } from '../cardRegistry';
import { isValidCell } from '../hexUtils';
import { findReachable, findPath, coordKey } from '../pathfinding';

/**
 * Builds a Set of "col,row" strings for all cells occupied by alive units.
 */
export function getOccupiedSet(state: GameState): Set<string> {
  const occupied = new Set<string>();
  for (const unit of state.units) {
    if (!unit.alive) continue;
    for (const cell of unit.occupiedCells) {
      occupied.add(coordKey(cell.col, cell.row));
    }
  }
  return occupied;
}

/**
 * Returns the hexes a unit can move to this activation.
 * Excludes the unit's current position.
 */
export function getReachableHexes(state: GameState, unitUid: number): HexCoord[] {
  const unit = state.units.find(u => u.uid === unitUid);
  if (!unit || !unit.alive) return [];

  const card = getCard(unit.cardId);
  if (isBuilding(card)) return [];

  if (unit.remainingAp <= 0) return [];

  // Build occupied set excluding this unit's own cells
  const occupied = getOccupiedSet(state);
  for (const cell of unit.occupiedCells) {
    occupied.delete(coordKey(cell.col, cell.row));
  }

  const reachable = findReachable(unit.col, unit.row, unit.remainingAp, occupied);

  // Filter out the unit's current position
  return reachable.filter(h => !(h.col === unit.col && h.row === unit.row));
}

/**
 * Validates whether a unit can move to a target hex.
 */
export function canMove(
  state: GameState,
  unitUid: number,
  targetHex: HexCoord,
): { valid: boolean; reason?: string } {
  const unit = state.units.find(u => u.uid === unitUid);
  if (!unit) {
    return { valid: false, reason: 'Unit not found' };
  }

  if (!unit.alive) {
    return { valid: false, reason: 'Unit is dead' };
  }

  const card = getCard(unit.cardId);
  if (isBuilding(card)) {
    return { valid: false, reason: 'Cannot move a building (speed 0)' };
  }

  if (unit.remainingAp <= 0) {
    return { valid: false, reason: 'No remaining AP' };
  }

  if (!isValidCell(targetHex.col, targetHex.row)) {
    return { valid: false, reason: 'Target hex is invalid (out of bounds)' };
  }

  // Check target is not occupied
  const occupied = getOccupiedSet(state);
  // Remove this unit's own cells from occupied (it can leave them)
  for (const cell of unit.occupiedCells) {
    occupied.delete(coordKey(cell.col, cell.row));
  }

  if (occupied.has(coordKey(targetHex.col, targetHex.row))) {
    return { valid: false, reason: 'Target hex is occupied' };
  }

  // Check target is reachable within remaining AP
  const reachable = findReachable(unit.col, unit.row, unit.remainingAp, occupied);
  const isReachable = reachable.some(
    h => h.col === targetHex.col && h.row === targetHex.row,
  );
  if (!isReachable) {
    return { valid: false, reason: 'Target hex is not reachable with remaining AP' };
  }

  return { valid: true };
}

/**
 * Executes a unit move. Assumes canMove was already validated.
 * Mutates state in place. Returns the path taken (for animation).
 */
export function executeMove(
  state: GameState,
  unitUid: number,
  targetHex: HexCoord,
): HexCoord[] {
  const unit = state.units.find(u => u.uid === unitUid)!;

  // Build occupied set excluding this unit
  const occupied = getOccupiedSet(state);
  for (const cell of unit.occupiedCells) {
    occupied.delete(coordKey(cell.col, cell.row));
  }

  // Find path
  const path = findPath(unit.col, unit.row, targetHex.col, targetHex.row, occupied);

  // AP cost = number of steps (path length - 1, since path includes start)
  const apCost = path.length - 1;
  unit.remainingAp -= apCost;

  // Clear old board cells
  for (const cell of unit.occupiedCells) {
    state.board[cell.row][cell.col].unitUid = null;
  }

  // Update unit position
  unit.col = targetHex.col;
  unit.row = targetHex.row;

  // Compute new occupied cells (size-2 future-proofing)
  const card = getCard(unit.cardId);
  let newCells: HexCoord[];
  if (card.size <= 1) {
    newCells = [{ col: targetHex.col, row: targetHex.row }];
  } else {
    // 2x2 building - shouldn't happen since buildings can't move, but future-proof
    newCells = [
      { col: targetHex.col, row: targetHex.row },
      { col: targetHex.col + 1, row: targetHex.row },
      { col: targetHex.col, row: targetHex.row + 1 },
      { col: targetHex.col + 1, row: targetHex.row + 1 },
    ];
  }

  // Update occupiedCells
  (unit as { occupiedCells: HexCoord[] }).occupiedCells = newCells;

  // Set new board cells
  for (const cell of newCells) {
    state.board[cell.row][cell.col].unitUid = unitUid;
  }

  return path;
}
