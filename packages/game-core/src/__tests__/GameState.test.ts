import { describe, it, expect } from 'vitest';
import { createGameState } from '../GameState';
import { GRID_COLS, GRID_ROWS, STARTING_MANA, HERO_HP } from '../constants';

describe('createGameState', () => {
  it('produces valid state with correct board dimensions', () => {
    const state = createGameState(42);
    expect(state.board).toHaveLength(GRID_ROWS);
    for (const row of state.board) {
      expect(row).toHaveLength(GRID_COLS);
    }
  });

  it('all board cells have null unitUid and null terrainEffect', () => {
    const state = createGameState(42);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = state.board[r][c];
        expect(cell.unitUid).toBeNull();
        expect(cell.terrainEffect).toBeNull();
      }
    }
  });

  it('board cells have correct col and row coordinates', () => {
    const state = createGameState(42);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(state.board[r][c].col).toBe(c);
        expect(state.board[r][c].row).toBe(r);
      }
    }
  });

  it('players start with correct mana and hero HP', () => {
    const state = createGameState(42);
    expect(state.players).toHaveLength(2);
    for (const player of state.players) {
      expect(player.mana).toBe(STARTING_MANA);
      expect(player.heroHp).toBe(HERO_HP);
      expect(player.timeoutCount).toBe(0);
    }
  });

  it('players have ids 0 and 1', () => {
    const state = createGameState(42);
    expect(state.players[0].id).toBe(0);
    expect(state.players[1].id).toBe(1);
  });

  it('phase starts as INITIALIZING', () => {
    const state = createGameState(42);
    expect(state.phase).toBe('INITIALIZING');
  });

  it('RNG is deterministic from seed', () => {
    const state1 = createGameState(42);
    const state2 = createGameState(42);
    // Both RNGs should produce the same sequence
    const val1 = state1.rng.next();
    const val2 = state2.rng.next();
    expect(val1).toBe(val2);
  });

  it('two calls with same seed produce identical initial states', () => {
    const state1 = createGameState(42);
    const state2 = createGameState(42);

    expect(state1.players).toEqual(state2.players);
    expect(state1.board).toEqual(state2.board);
    expect(state1.turnNumber).toBe(state2.turnNumber);
    expect(state1.phase).toBe(state2.phase);
    expect(state1.units).toEqual(state2.units);
    expect(state1.activationQueue).toEqual(state2.activationQueue);
    expect(state1.currentActivationIndex).toBe(state2.currentActivationIndex);
    expect(state1.nextUnitUid).toBe(state2.nextUnitUid);
    // RNG state should be identical
    expect(state1.rng.serialize()).toBe(state2.rng.serialize());
  });

  it('starts with empty units and activation queue', () => {
    const state = createGameState(42);
    expect(state.units).toEqual([]);
    expect(state.activationQueue).toEqual([]);
    expect(state.currentActivationIndex).toBe(0);
  });

  it('turnNumber starts at 0', () => {
    const state = createGameState(42);
    expect(state.turnNumber).toBe(0);
  });

  it('nextUnitUid starts at 1', () => {
    const state = createGameState(42);
    expect(state.nextUnitUid).toBe(1);
  });

  it('different seeds produce different RNG states', () => {
    const state1 = createGameState(1);
    const state2 = createGameState(9999);
    expect(state1.rng.serialize()).not.toBe(state2.rng.serialize());
  });
});
