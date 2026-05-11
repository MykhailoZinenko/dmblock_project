import {
  GRID_COLS,
  GRID_ROWS,
  STARTING_MANA,
  HERO_HP,
} from './constants';
import { SeededRNG } from './rng';
import {
  BoardCell,
  GamePhase,
  PlayerState,
  UnitInstance,
} from './types';

export interface GameState {
  players: [PlayerState, PlayerState];
  units: UnitInstance[];
  board: BoardCell[][];
  turnNumber: number;
  activationQueue: UnitInstance[];
  currentActivationIndex: number;
  phase: GamePhase;
  rng: SeededRNG;
  nextUnitUid: number;
}

/**
 * Creates a fresh game state from a seed.
 *
 * - Empty 15x11 board (board[row][col])
 * - Two players with starting mana and hero HP
 * - Phase starts as INITIALIZING
 * - RNG initialized from seed
 */
export function createGameState(seed: number): GameState {
  const board: BoardCell[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      row.push({
        col: c,
        row: r,
        unitUid: null,
        terrainEffect: null,
      });
    }
    board.push(row);
  }

  const players: [PlayerState, PlayerState] = [
    { id: 0, mana: STARTING_MANA, heroHp: HERO_HP, timeoutCount: 0 },
    { id: 1, mana: STARTING_MANA, heroHp: HERO_HP, timeoutCount: 0 },
  ];

  return {
    players,
    units: [],
    board,
    turnNumber: 0,
    activationQueue: [],
    currentActivationIndex: 0,
    phase: 'INITIALIZING',
    rng: new SeededRNG(seed),
    nextUnitUid: 1,
  };
}
