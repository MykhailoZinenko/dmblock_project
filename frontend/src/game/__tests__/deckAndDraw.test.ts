import { describe, it, expect } from 'vitest';
import { createGameState } from '../GameState';
import { GameController } from '../GameController';
import { DamageType } from '../types';
import type { UnitInstance } from '../types';

function makeUnit(overrides: Partial<UnitInstance> & { uid: number; playerId: number }): UnitInstance {
  return {
    cardId: 1, col: 0, row: 0,
    currentHp: 10, maxHp: 10, attack: 5, defense: 3,
    initiative: 10, speed: 3, ammo: 0, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    remainingAp: 3, retaliatedThisTurn: false, alive: true,
    cooldowns: {}, garrisonedIn: null, polymorphed: false, cursed: false,
    activeEffects: [], occupiedCells: [],
    ...overrides,
  };
}

describe('createGameState with decks', () => {
  it('shuffles and deals 4-card starting hands', () => {
    const deck0 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const deck1 = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const state = createGameState(42, [deck0, deck1]);
    expect(state.players[0].hand).toHaveLength(4);
    expect(state.players[0].deck).toHaveLength(6);
    expect(state.players[1].hand).toHaveLength(4);
    expect(state.players[1].deck).toHaveLength(6);
  });

  it('shuffles deterministically with same seed', () => {
    const deck = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const s1 = createGameState(42, [[...deck], [...deck]]);
    const s2 = createGameState(42, [[...deck], [...deck]]);
    expect(s1.players[0].hand).toEqual(s2.players[0].hand);
    expect(s1.players[0].deck).toEqual(s2.players[0].deck);
  });

  it('different seeds produce different shuffles', () => {
    const deck = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const s1 = createGameState(1, [[...deck], [...deck]]);
    const s2 = createGameState(9999, [[...deck], [...deck]]);
    const sameHand = s1.players[0].hand.every((v, i) => v === s2.players[0].hand[i]);
    expect(sameHand).toBe(false);
  });

  it('without decks, hand and deck are empty arrays', () => {
    const state = createGameState(42);
    expect(state.players[0].hand).toEqual([]);
    expect(state.players[0].deck).toEqual([]);
  });

  it('handles decks smaller than starting hand size', () => {
    const state = createGameState(42, [[1, 2], [3]]);
    expect(state.players[0].hand).toHaveLength(2);
    expect(state.players[0].deck).toHaveLength(0);
    expect(state.players[1].hand).toHaveLength(1);
    expect(state.players[1].deck).toHaveLength(0);
  });
});

describe('GameController endTurn card draw', () => {
  it('draws a card on endTurn when deck has cards', () => {
    const ctrl = new GameController();
    ctrl.startGame(42, [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]]);
    const state = ctrl.getState();
    const handBefore0 = state.players[0].hand.length;
    const handBefore1 = state.players[1].hand.length;
    ctrl.endTurn();
    expect(state.players[0].hand.length).toBe(handBefore0 + 1);
    expect(state.players[1].hand.length).toBe(handBefore1 + 1);
  });

  it('does not draw past hand limit of 6', () => {
    const ctrl = new GameController();
    ctrl.startGame(42, [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]]);
    const state = ctrl.getState();
    // Manually fill hand to 6
    while (state.players[0].hand.length < 6) state.players[0].hand.push(0);
    ctrl.endTurn();
    expect(state.players[0].hand.length).toBe(6);
  });

  it('does not draw when deck is empty', () => {
    const ctrl = new GameController();
    ctrl.startGame(42);
    const state = ctrl.getState();
    expect(state.players[0].deck).toHaveLength(0);
    const handBefore = state.players[0].hand.length;
    ctrl.endTurn();
    expect(state.players[0].hand.length).toBe(handBefore);
  });

  it('startGame with decks passes them to createGameState', () => {
    const ctrl = new GameController();
    ctrl.startGame(42, [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]);
    const state = ctrl.getState();
    const allCards = [...state.players[0].hand, ...state.players[0].deck];
    expect(allCards).toHaveLength(5);
    for (const id of allCards) {
      expect([1, 2, 3, 4, 5]).toContain(id);
    }
  });

  it('dead units are skipped during passActivation', () => {
    const ctrl = new GameController();
    ctrl.startGame(42);
    const state = ctrl.getState();
    const u1 = makeUnit({ uid: 1, playerId: 0, initiative: 20, speed: 3 });
    const u2 = makeUnit({ uid: 2, playerId: 1, initiative: 15, speed: 3, alive: false });
    const u3 = makeUnit({ uid: 3, playerId: 0, initiative: 10, speed: 3 });
    state.units.push(u1, u2, u3);
    ctrl.rebuildQueue();
    ctrl.passActivation(); // skip u1
    // u2 is dead and should be skipped
    expect(ctrl.getCurrentUnit()!.uid).toBe(u3.uid);
  });
});
