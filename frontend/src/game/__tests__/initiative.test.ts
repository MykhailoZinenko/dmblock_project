import { describe, it, expect } from 'vitest';
import { buildInitiativeQueue } from '../initiative';
import { SeededRNG } from '../rng';
import { DamageType, UnitInstance } from '../types';

function makeUnit(overrides: Partial<UnitInstance> & { uid: number }): UnitInstance {
  return {
    uid: overrides.uid,
    cardId: 1,
    playerId: 0,
    col: 0,
    row: 0,
    currentHp: 10,
    maxHp: 10,
    attack: 5,
    defense: 2,
    initiative: 5,
    speed: 3,
    ammo: 0,
    magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    remainingAp: 1,
    retaliatedThisTurn: false,
    alive: true,
    cooldowns: {},
    garrisonedIn: null,
    polymorphed: false,
    cursed: false,
    occupiedCells: [],
    ...overrides,
  };
}

describe('buildInitiativeQueue', () => {
  it('sorts by initiative descending', () => {
    const rng = new SeededRNG(42);
    const units = [
      makeUnit({ uid: 1, initiative: 3 }),
      makeUnit({ uid: 2, initiative: 7 }),
      makeUnit({ uid: 3, initiative: 5 }),
    ];
    const queue = buildInitiativeQueue(units, rng);
    expect(queue.map((u) => u.uid)).toEqual([2, 3, 1]);
  });

  it('breaks initiative ties by speed descending', () => {
    const rng = new SeededRNG(42);
    const units = [
      makeUnit({ uid: 1, initiative: 5, speed: 2 }),
      makeUnit({ uid: 2, initiative: 5, speed: 6 }),
      makeUnit({ uid: 3, initiative: 5, speed: 4 }),
    ];
    const queue = buildInitiativeQueue(units, rng);
    expect(queue.map((u) => u.uid)).toEqual([2, 3, 1]);
  });

  it('breaks speed ties deterministically with RNG (same seed = same order)', () => {
    const units = [
      makeUnit({ uid: 1, initiative: 5, speed: 3 }),
      makeUnit({ uid: 2, initiative: 5, speed: 3 }),
      makeUnit({ uid: 3, initiative: 5, speed: 3 }),
    ];

    const rng1 = new SeededRNG(99);
    const result1 = buildInitiativeQueue(units, rng1);

    const rng2 = new SeededRNG(99);
    const result2 = buildInitiativeQueue(units, rng2);

    expect(result1.map((u) => u.uid)).toEqual(result2.map((u) => u.uid));
  });

  it('different seeds produce different tiebreak orders', () => {
    // Use many units with identical stats to make collisions near-impossible
    const units = Array.from({ length: 10 }, (_, i) =>
      makeUnit({ uid: i, initiative: 5, speed: 3 }),
    );

    const rng1 = new SeededRNG(1);
    const result1 = buildInitiativeQueue(units, rng1);

    const rng2 = new SeededRNG(9999);
    const result2 = buildInitiativeQueue(units, rng2);

    // With 10 units, 10! permutations — extremely unlikely to match
    expect(result1.map((u) => u.uid)).not.toEqual(result2.map((u) => u.uid));
  });

  it('only includes alive units', () => {
    const rng = new SeededRNG(42);
    const units = [
      makeUnit({ uid: 1, initiative: 7, alive: true }),
      makeUnit({ uid: 2, initiative: 9, alive: false }),
      makeUnit({ uid: 3, initiative: 5, alive: true }),
    ];
    const queue = buildInitiativeQueue(units, rng);
    expect(queue.map((u) => u.uid)).toEqual([1, 3]);
  });

  it('returns empty queue for empty unit list', () => {
    const rng = new SeededRNG(42);
    const queue = buildInitiativeQueue([], rng);
    expect(queue).toEqual([]);
  });

  it('returns single-element queue for single unit', () => {
    const rng = new SeededRNG(42);
    const units = [makeUnit({ uid: 1, initiative: 5 })];
    const queue = buildInitiativeQueue(units, rng);
    expect(queue).toHaveLength(1);
    expect(queue[0].uid).toBe(1);
  });

  it('mixed dead/alive units returns only alive in correct order', () => {
    const rng = new SeededRNG(42);
    const units = [
      makeUnit({ uid: 1, initiative: 3, alive: true }),
      makeUnit({ uid: 2, initiative: 9, alive: false }),
      makeUnit({ uid: 3, initiative: 7, alive: true }),
      makeUnit({ uid: 4, initiative: 1, alive: false }),
      makeUnit({ uid: 5, initiative: 5, alive: true }),
    ];
    const queue = buildInitiativeQueue(units, rng);
    expect(queue.map((u) => u.uid)).toEqual([3, 5, 1]);
    expect(queue.every((u) => u.alive)).toBe(true);
  });

  it('does not mutate the original array', () => {
    const rng = new SeededRNG(42);
    const units = [
      makeUnit({ uid: 1, initiative: 3 }),
      makeUnit({ uid: 2, initiative: 7 }),
    ];
    const original = [...units];
    buildInitiativeQueue(units, rng);
    expect(units.map((u) => u.uid)).toEqual(original.map((u) => u.uid));
  });
});
