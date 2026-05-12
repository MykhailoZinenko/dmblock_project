import type { GameState } from '../GameState';
import { getCard } from '../cardRegistry';
import { isValidCell } from '../hexUtils';
import { P1_DEPLOY_COLS, P2_DEPLOY_COLS } from '../constants';
import { CardType } from '../types';
import type { HexCoord, UnitInstance } from '../types';

export interface SpawnResult {
  valid: boolean;
  reason?: string;
}

/**
 * Returns the deploy-zone columns for a given player.
 */
function deployColsForPlayer(playerId: number): readonly number[] {
  return playerId === 0 ? P1_DEPLOY_COLS : P2_DEPLOY_COLS;
}

/**
 * Check if a column is within the player's deploy zone.
 */
function isInDeployZone(col: number, playerId: number): boolean {
  return deployColsForPlayer(playerId).includes(col);
}

/**
 * For a given card size, compute the list of cells occupied.
 * Size 1: just the anchor hex.
 * Size 2: anchor + right + below + diagonal (2x2 block).
 */
function getOccupiedCells(hex: HexCoord, size: number): HexCoord[] {
  if (size <= 1) {
    return [{ col: hex.col, row: hex.row }];
  }
  // 2x2 building
  return [
    { col: hex.col, row: hex.row },
    { col: hex.col + 1, row: hex.row },
    { col: hex.col, row: hex.row + 1 },
    { col: hex.col + 1, row: hex.row + 1 },
  ];
}

/**
 * Validate whether a unit/building can be spawned at the given hex.
 */
export function canSpawn(
  state: GameState,
  playerId: number,
  cardId: number,
  hex: HexCoord,
): SpawnResult {
  // 1. Card exists
  let card;
  try {
    card = getCard(cardId);
  } catch {
    return { valid: false, reason: 'Unknown card id' };
  }

  // 7. Card type must be UNIT
  if (card.cardType !== CardType.UNIT) {
    return { valid: false, reason: 'Cannot spawn a spell card' };
  }

  // 2. Player has enough mana
  const player = state.players[playerId];
  if (player.mana < card.manaCost) {
    return { valid: false, reason: `Not enough mana (need ${card.manaCost}, have ${player.mana})` };
  }

  // Compute all cells this unit/building will occupy
  const cells = getOccupiedCells(hex, card.size);

  for (const cell of cells) {
    // 4. Hex is valid
    if (!isValidCell(cell.col, cell.row)) {
      return { valid: false, reason: `Hex (${cell.col},${cell.row}) is invalid (out of bounds)` };
    }

    // 3. Hex is within player's deploy zone
    if (!isInDeployZone(cell.col, playerId)) {
      return { valid: false, reason: `Hex (${cell.col},${cell.row}) is outside deploy zone` };
    }

    // 5/6. Hex is unoccupied
    if (state.board[cell.row][cell.col].unitUid !== null) {
      return { valid: false, reason: `Hex (${cell.col},${cell.row}) is occupied` };
    }
  }

  return { valid: true };
}

/**
 * Execute a unit spawn. Assumes canSpawn was already checked.
 * Mutates state in place and returns the newly created UnitInstance.
 */
export function executeSpawn(
  state: GameState,
  playerId: number,
  cardId: number,
  hex: HexCoord,
): UnitInstance {
  const card = getCard(cardId);

  // 1. Deduct mana
  state.players[playerId].mana -= card.manaCost;

  // Compute occupied cells
  const cells = getOccupiedCells(hex, card.size);

  // 2. Create UnitInstance
  const uid = state.nextUnitUid++;

  let attack = card.attack;

  // 5. Peasant special: 20% chance to spawn unarmed (halve attack)
  if (cardId === 0) {
    if (state.rng.rollPercent(20)) {
      attack = Math.floor(attack / 2);
    }
  }

  const unit: UnitInstance = {
    uid,
    cardId,
    playerId,
    col: hex.col,
    row: hex.row,
    currentHp: card.hp,
    maxHp: card.hp,
    attack,
    defense: card.defense,
    initiative: card.initiative,
    speed: card.speed,
    ammo: card.ammo,
    magicResistance: card.magicResistance,
    damageType: card.damageType,
    remainingAp: card.speed,
    retaliatedThisTurn: false,
    alive: true,
    cooldowns: {},
    garrisonedIn: null,
    polymorphed: false,
    cursed: false,
    activeEffects: [],
    occupiedCells: cells,
  };

  // 3. Place on board
  for (const cell of cells) {
    state.board[cell.row][cell.col].unitUid = uid;
  }

  // 4. Push to state.units
  state.units.push(unit);

  return unit;
}
