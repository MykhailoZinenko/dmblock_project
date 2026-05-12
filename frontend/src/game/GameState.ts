import {
  GRID_COLS,
  GRID_ROWS,
  STARTING_MANA,
  HERO_HP,
} from './constants';
import { SeededRNG } from './rng';
import type {
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
export function createGameState(seed: number, decks?: [number[], number[]]): GameState {
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

  function shuffleDeck(deck: number[], rng: SeededRNG): number[] {
    const arr = [...deck];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const rng = new SeededRNG(seed);
  const STARTING_HAND_SIZE = 4;
  const p0Deck = decks ? shuffleDeck(decks[0], rng) : [];
  const p1Deck = decks ? shuffleDeck(decks[1], rng) : [];
  const p0Hand = p0Deck.splice(0, STARTING_HAND_SIZE);
  const p1Hand = p1Deck.splice(0, STARTING_HAND_SIZE);

  const players: [PlayerState, PlayerState] = [
    { id: 0, mana: STARTING_MANA, heroHp: HERO_HP, timeoutCount: 0, deck: p0Deck, hand: p0Hand },
    { id: 1, mana: STARTING_MANA, heroHp: HERO_HP, timeoutCount: 0, deck: p1Deck, hand: p1Hand },
  ];

  return {
    players,
    units: [],
    board,
    turnNumber: 0,
    activationQueue: [],
    currentActivationIndex: 0,
    phase: 'INITIALIZING',
    rng,
    nextUnitUid: 1,
  };
}
