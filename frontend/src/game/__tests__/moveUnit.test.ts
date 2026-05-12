import { describe, it, expect } from 'vitest';
import {
  getOccupiedSet,
  getReachableHexes,
  canMove,
  executeMove,
} from '../actions/moveUnit';
import { createGameState } from '../GameState';
import type { GameState } from '../GameState';
import type { HexCoord } from '../types';
import { getCard } from '../cardRegistry';

/** Helper: place a unit directly (bypassing deploy zone checks). */
function placeUnit(
  state: GameState,
  playerId: number,
  cardId: number,
  col: number,
  row: number,
): number {
  const card = getCard(cardId);
  const uid = state.nextUnitUid++;
  const unit = {
    uid,
    cardId,
    playerId,
    col,
    row,
    currentHp: card.hp,
    maxHp: card.hp,
    attack: card.attack,
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
    occupiedCells: [{ col, row }] as readonly HexCoord[],
  };
  state.units.push(unit);
  state.board[row][col].unitUid = uid;
  return uid;
}

describe('getOccupiedSet', () => {
  it('empty board returns empty set', () => {
    const state = createGameState(42);
    const occ = getOccupiedSet(state);
    expect(occ.size).toBe(0);
  });

  it('units on board appear in set', () => {
    const state = createGameState(42);
    const uid1 = placeUnit(state, 0, 0, 5, 5); // Peasant at (5,5)
    const uid2 = placeUnit(state, 1, 1, 7, 3); // Militiaman at (7,3)
    const occ = getOccupiedSet(state);
    expect(occ.has('5,5')).toBe(true);
    expect(occ.has('7,3')).toBe(true);
    expect(occ.size).toBe(2);
  });

  it('dead units do not appear in set', () => {
    const state = createGameState(42);
    placeUnit(state, 0, 0, 5, 5);
    state.units[0].alive = false;
    const occ = getOccupiedSet(state);
    expect(occ.has('5,5')).toBe(false);
    expect(occ.size).toBe(0);
  });
});

describe('getReachableHexes', () => {
  it('unit with speed 3 in open field returns correct count', () => {
    const state = createGameState(42);
    // Peasant (speed 3) at center of board
    const uid = placeUnit(state, 0, 0, 7, 5);
    const reachable = getReachableHexes(state, uid);
    // Should have many hexes but not include origin
    expect(reachable.length).toBeGreaterThan(0);
    // Origin should NOT be in reachable
    const hasOrigin = reachable.some(h => h.col === 7 && h.row === 5);
    expect(hasOrigin).toBe(false);
  });

  it('building (speed 0) returns empty', () => {
    const state = createGameState(42);
    // Tower is id=17, speed=0
    const uid = placeUnit(state, 0, 17, 5, 5);
    // Buildings have speed 0
    state.units[0].speed = 0;
    state.units[0].remainingAp = 0;
    const reachable = getReachableHexes(state, uid);
    expect(reachable).toEqual([]);
  });

  it('dead unit returns empty', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    state.units[0].alive = false;
    const reachable = getReachableHexes(state, uid);
    expect(reachable).toEqual([]);
  });

  it('occupied neighbors reduce reachable set', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    // Get reachable without blockers
    const reachableOpen = getReachableHexes(state, uid);

    // Now add blockers around
    placeUnit(state, 1, 1, 8, 5);
    placeUnit(state, 1, 1, 6, 5);
    const reachableBlocked = getReachableHexes(state, uid);
    expect(reachableBlocked.length).toBeLessThan(reachableOpen.length);
  });

  it('unit own position excluded from result', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    const reachable = getReachableHexes(state, uid);
    const hasOwn = reachable.some(h => h.col === 7 && h.row === 5);
    expect(hasOwn).toBe(false);
  });
});

describe('canMove', () => {
  it('valid move returns valid', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5); // Peasant speed 3
    // Move to adjacent hex
    const neighbors = [
      { col: 8, row: 5 },
      { col: 6, row: 5 },
    ];
    const result = canMove(state, uid, neighbors[0]);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('dead unit invalid', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    state.units[0].alive = false;
    const result = canMove(state, uid, { col: 8, row: 5 });
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('building invalid', () => {
    const state = createGameState(42);
    // Tower (id=17, speed=0)
    const uid = placeUnit(state, 0, 17, 5, 5);
    state.units[0].speed = 0;
    state.units[0].remainingAp = 0;
    const result = canMove(state, uid, { col: 6, row: 5 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('building');
  });

  it('no AP remaining invalid', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    state.units[0].remainingAp = 0;
    const result = canMove(state, uid, { col: 8, row: 5 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('AP');
  });

  it('target out of bounds invalid', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 0, 0);
    const result = canMove(state, uid, { col: -1, row: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('invalid');
  });

  it('target occupied invalid', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    placeUnit(state, 1, 1, 8, 5); // blocker
    const result = canMove(state, uid, { col: 8, row: 5 });
    expect(result.valid).toBe(false);
    // occupied or not reachable both acceptable
  });

  it('target not reachable (too far) invalid', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 0, 0); // Peasant speed 3
    // (14, 10) is far away
    const result = canMove(state, uid, { col: 14, row: 10 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('reachable');
  });

  it('nonexistent unit invalid', () => {
    const state = createGameState(42);
    const result = canMove(state, 999, { col: 5, row: 5 });
    expect(result.valid).toBe(false);
  });
});

describe('executeMove', () => {
  it('deducts correct AP (1 per hex)', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5); // speed 3, AP=3
    executeMove(state, uid, { col: 8, row: 5 }); // 1 hex away
    expect(state.units[0].remainingAp).toBe(2);
  });

  it('updates unit col/row', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    executeMove(state, uid, { col: 8, row: 5 });
    expect(state.units[0].col).toBe(8);
    expect(state.units[0].row).toBe(5);
  });

  it('clears old board cell', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    executeMove(state, uid, { col: 8, row: 5 });
    expect(state.board[5][7].unitUid).toBeNull();
  });

  it('sets new board cell', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    executeMove(state, uid, { col: 8, row: 5 });
    expect(state.board[5][8].unitUid).toBe(uid);
  });

  it('returns correct path', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    const path = executeMove(state, uid, { col: 8, row: 5 });
    // Path should start at origin and end at target
    expect(path[0]).toEqual({ col: 7, row: 5 });
    expect(path[path.length - 1]).toEqual({ col: 8, row: 5 });
    expect(path.length).toBe(2); // 1 hex move = [start, end]
  });

  it('partial move (2 of 3 AP) leaves remaining AP correct', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5); // speed 3, AP=3
    // Move 2 hexes
    const path = executeMove(state, uid, { col: 9, row: 5 });
    expect(state.units[0].remainingAp).toBe(1);
    expect(path.length).toBe(3); // start + 2 steps
  });

  it('after move, unit can move again with remaining AP', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5); // speed 3, AP=3
    // Move 1 hex
    executeMove(state, uid, { col: 8, row: 5 });
    expect(state.units[0].remainingAp).toBe(2);
    // Move another hex
    executeMove(state, uid, { col: 9, row: 5 });
    expect(state.units[0].remainingAp).toBe(1);
    expect(state.units[0].col).toBe(9);
    expect(state.units[0].row).toBe(5);
    // Old cells cleared
    expect(state.board[5][7].unitUid).toBeNull();
    expect(state.board[5][8].unitUid).toBeNull();
    expect(state.board[5][9].unitUid).toBe(uid);
  });

  it('updates occupiedCells after move', () => {
    const state = createGameState(42);
    const uid = placeUnit(state, 0, 0, 7, 5);
    executeMove(state, uid, { col: 8, row: 5 });
    expect(state.units[0].occupiedCells).toEqual([{ col: 8, row: 5 }]);
  });
});
