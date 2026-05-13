import { describe, it, expect } from 'vitest';
import { createGameState, GameState } from '../GameState';
import { UnitInstance } from '../types';
import { getCard } from '../cardRegistry';
import {
  isBarrierUp,
  canAttackHero,
  executeHeroAttack,
  checkWinCondition,
  applyTimeoutDamage,
  HERO_HEX,
  HERO_ADJACENT,
} from '../actions/heroActions';
import { HERO_HP, TIMEOUT_DAMAGE } from '../constants';

function makeUnit(overrides: Partial<UnitInstance> & { uid: number; cardId: number; playerId: number }): UnitInstance {
  const card = getCard(overrides.cardId);
  return {
    col: 0,
    row: 0,
    currentHp: card.hp,
    maxHp: card.hp,
    attack: card.attack,
    defense: card.defense,
    initiative: card.initiative,
    speed: card.speed,
    ammo: card.ammo,
    magicResistance: card.magicResistance,
    damageType: card.damageType,
    remainingAp: 1,
    retaliatedThisTurn: false,
    alive: true,
    cooldowns: {},
    garrisonedIn: null,
    polymorphed: false,
    cursed: false,
    activeEffects: [],
    occupiedCells: [{ col: overrides.col ?? 0, row: overrides.row ?? 0 }],
    ...overrides,
  };
}

function placeUnit(state: GameState, unit: UnitInstance): void {
  state.units.push(unit);
  for (const cell of unit.occupiedCells) {
    state.board[cell.row][cell.col].unitUid = unit.uid;
  }
}

describe('isBarrierUp', () => {
  it('returns true when player has alive units', () => {
    const state = createGameState(42);
    placeUnit(state, makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 1, row: 0 }));
    expect(isBarrierUp(state, 0)).toBe(true);
  });

  it('returns false when player has no alive units', () => {
    const state = createGameState(42);
    expect(isBarrierUp(state, 0)).toBe(false);
  });

  it('returns false when all player units are dead', () => {
    const state = createGameState(42);
    const unit = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 1, row: 0, alive: false });
    state.units.push(unit);
    expect(isBarrierUp(state, 0)).toBe(false);
  });

  it('barrier for P0 is independent of P1 units', () => {
    const state = createGameState(42);
    placeUnit(state, makeUnit({ uid: 1, cardId: 0, playerId: 1, col: 13, row: 0 }));
    expect(isBarrierUp(state, 0)).toBe(false);
    expect(isBarrierUp(state, 1)).toBe(true);
  });
});

describe('HERO_HEX / HERO_ADJACENT', () => {
  it('P0 hero hex is above top-left corner', () => {
    expect(HERO_HEX[0]).toEqual({ col: 0, row: -1 });
  });

  it('P1 hero hex is below bottom-right corner', () => {
    expect(HERO_HEX[1]).toEqual({ col: 13, row: 11 });
  });

  it('P0 hero adjacent hexes are (0,0) and (1,0)', () => {
    expect(HERO_ADJACENT[0]).toEqual([{ col: 0, row: 0 }, { col: 1, row: 0 }]);
  });

  it('P1 hero adjacent hexes are (13,10) and (14,10)', () => {
    expect(HERO_ADJACENT[1]).toEqual([{ col: 13, row: 10 }, { col: 14, row: 10 }]);
  });
});

describe('canAttackHero', () => {
  it('cannot attack hero when barrier is up', () => {
    const state = createGameState(42);
    placeUnit(state, makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 1, row: 1 }));
    placeUnit(state, makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 0, row: 0 }));
    const result = canAttackHero(state, 2, 0);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Barrier');
  });

  it('melee can attack hero when on adjacent hex and barrier down', () => {
    const state = createGameState(42);
    // P0 hero adjacent hexes: (0,0) and (1,0)
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 1, col: 0, row: 0 });
    placeUnit(state, attacker);
    const result = canAttackHero(state, 1, 0);
    expect(result.valid).toBe(true);
  });

  it('melee can attack hero from second adjacent hex', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 1, col: 1, row: 0 });
    placeUnit(state, attacker);
    const result = canAttackHero(state, 1, 0);
    expect(result.valid).toBe(true);
  });

  it('melee cannot attack hero when not adjacent', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 1, col: 5, row: 5 });
    placeUnit(state, attacker);
    const result = canAttackHero(state, 1, 0);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('adjacent');
  });

  it('ranged can attack hero from anywhere when barrier down', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 3, playerId: 1, col: 7, row: 5 });
    placeUnit(state, attacker);
    const result = canAttackHero(state, 1, 0);
    expect(result.valid).toBe(true);
  });

  it('ranged cannot attack hero with 0 ammo', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 3, playerId: 1, col: 7, row: 5, ammo: 0 });
    placeUnit(state, attacker);
    const result = canAttackHero(state, 1, 0);
    expect(result.valid).toBe(false);
  });

  it('cannot attack own hero', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 0, row: 0 });
    placeUnit(state, attacker);
    const result = canAttackHero(state, 1, 0);
    expect(result.valid).toBe(false);
  });

  it('dead attacker cannot attack hero', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 1, col: 0, row: 0, alive: false });
    state.units.push(attacker);
    const result = canAttackHero(state, 1, 0);
    expect(result.valid).toBe(false);
  });

  it('no AP means cannot attack', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 1, col: 0, row: 0, remainingAp: 0 });
    placeUnit(state, attacker);
    const result = canAttackHero(state, 1, 0);
    expect(result.valid).toBe(false);
  });
});

describe('executeHeroAttack', () => {
  it('deals damage to hero HP and sets AP to 0', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 1, col: 0, row: 0, remainingAp: 3 });
    placeUnit(state, attacker);
    const result = executeHeroAttack(state, 1, 0);
    expect(result.damage).toBeGreaterThan(0);
    expect(state.players[0].heroHp).toBeLessThan(HERO_HP);
    expect(attacker.remainingAp).toBe(0);
  });

  it('ranged attack decrements ammo', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 3, playerId: 1, col: 7, row: 5 });
    placeUnit(state, attacker);
    const startAmmo = attacker.ammo;
    executeHeroAttack(state, 1, 0);
    expect(attacker.ammo).toBe(startAmmo - 1);
  });

  it('hero dies when HP reaches 0', () => {
    const state = createGameState(42);
    state.players[0].heroHp = 1;
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 1, col: 0, row: 0, attack: 50 });
    placeUnit(state, attacker);
    const result = executeHeroAttack(state, 1, 0);
    expect(result.heroDied).toBe(true);
    expect(state.players[0].heroHp).toBe(0);
  });
});

describe('checkWinCondition', () => {
  it('returns null when both heroes alive', () => {
    const state = createGameState(42);
    expect(checkWinCondition(state)).toBeNull();
  });

  it('returns winner 1 when P0 hero dead', () => {
    const state = createGameState(42);
    state.players[0].heroHp = 0;
    expect(checkWinCondition(state)).toEqual({ winner: 1 });
  });

  it('returns winner 0 when P1 hero dead', () => {
    const state = createGameState(42);
    state.players[1].heroHp = 0;
    expect(checkWinCondition(state)).toEqual({ winner: 0 });
  });
});

describe('applyTimeoutDamage', () => {
  it('applies escalating damage based on timeoutCount', () => {
    const state = createGameState(42);

    const r1 = applyTimeoutDamage(state, 0);
    expect(r1.damage).toBe(TIMEOUT_DAMAGE[0]); // 3
    expect(state.players[0].heroHp).toBe(HERO_HP - 3);
    expect(state.players[0].timeoutCount).toBe(1);

    const r2 = applyTimeoutDamage(state, 0);
    expect(r2.damage).toBe(TIMEOUT_DAMAGE[1]); // 6
    expect(state.players[0].heroHp).toBe(HERO_HP - 9);
    expect(state.players[0].timeoutCount).toBe(2);

    const r3 = applyTimeoutDamage(state, 0);
    expect(r3.damage).toBe(TIMEOUT_DAMAGE[2]); // 12
    expect(state.players[0].timeoutCount).toBe(3);

    const r4 = applyTimeoutDamage(state, 0);
    expect(r4.damage).toBe(TIMEOUT_DAMAGE[3]); // 24 (capped)
    expect(state.players[0].timeoutCount).toBe(4);
  });

  it('caps damage at last tier for subsequent timeouts', () => {
    const state = createGameState(42);
    state.players[0].timeoutCount = 10;
    state.players[0].heroHp = 100; // artificially high for test
    const r = applyTimeoutDamage(state, 0);
    expect(r.damage).toBe(24);
  });

  it('kills hero when HP drops to 0', () => {
    const state = createGameState(42);
    state.players[0].heroHp = 2;
    const r = applyTimeoutDamage(state, 0);
    expect(r.heroDied).toBe(true);
    expect(state.players[0].heroHp).toBe(0);
  });
});
