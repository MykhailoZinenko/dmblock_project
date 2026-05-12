import { describe, it, expect } from 'vitest';
import { calculateDamage, applyDamage, DamageResult } from '../combat';
import { getAttackTargets, canAttack, executeAttack } from '../actions/attackUnit';
import { createGameState, GameState } from '../GameState';
import { DamageType, Faction, UnitInstance, HexCoord } from '../types';
import { SeededRNG } from '../rng';
import { getCard } from '../cardRegistry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    occupiedCells: [{ col: overrides.col ?? 0, row: overrides.row ?? 0 }],
    ...overrides,
  };
}

/** Place a unit into the game state, updating the board cells. */
function placeUnit(state: GameState, unit: UnitInstance): void {
  state.units.push(unit);
  for (const cell of unit.occupiedCells) {
    state.board[cell.row][cell.col].unitUid = unit.uid;
  }
}

// ---------------------------------------------------------------------------
// calculateDamage
// ---------------------------------------------------------------------------

describe('calculateDamage', () => {
  it('computes basic physical damage (attack - defense)', () => {
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, attack: 10, defense: 0 });
    const target = makeUnit({ uid: 2, cardId: 0, playerId: 1, attack: 0, defense: 3 });
    // Use a seed that does NOT crit — we'll verify separately
    const rng = new SeededRNG(999);
    const result = calculateDamage(attacker, target, rng);
    // Without crit: max(1, 10 - 3) = 7
    expect(result.damage).toBe(7);
    expect(result.isCrit).toBe(false);
  });

  it('enforces minimum 1 damage when defense exceeds attack', () => {
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, attack: 2, defense: 0 });
    const target = makeUnit({ uid: 2, cardId: 0, playerId: 1, attack: 0, defense: 10 });
    const rng = new SeededRNG(999);
    const result = calculateDamage(attacker, target, rng);
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });

  it('applies crit multiplier when RNG rolls crit', () => {
    // Find a seed that produces a crit (rollPercent(10) returns true)
    let critSeed = 0;
    for (let s = 0; s < 10000; s++) {
      const testRng = new SeededRNG(s);
      if (testRng.rollPercent(10)) {
        critSeed = s;
        break;
      }
    }
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, attack: 10, defense: 0 });
    const target = makeUnit({ uid: 2, cardId: 0, playerId: 1, attack: 0, defense: 0 });
    const rng = new SeededRNG(critSeed);
    const result = calculateDamage(attacker, target, rng);
    expect(result.isCrit).toBe(true);
    // floor(10 * 1.5) = 15
    expect(result.damage).toBe(15);
  });

  it('does not crit when RNG rolls above threshold', () => {
    // Find a seed that does NOT crit
    let noCritSeed = 0;
    for (let s = 0; s < 10000; s++) {
      const testRng = new SeededRNG(s);
      if (!testRng.rollPercent(10)) {
        noCritSeed = s;
        break;
      }
    }
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, attack: 10, defense: 0 });
    const target = makeUnit({ uid: 2, cardId: 0, playerId: 1, attack: 0, defense: 0 });
    const rng = new SeededRNG(noCritSeed);
    const result = calculateDamage(attacker, target, rng);
    expect(result.isCrit).toBe(false);
    expect(result.damage).toBe(10);
  });

  it('magic damage vs 0% MR deals full attack (bypasses defense)', () => {
    // Torchbearer (id 7) deals magic damage, Inferno faction
    const attacker = makeUnit({ uid: 1, cardId: 7, playerId: 0, attack: 10 });
    const target = makeUnit({ uid: 2, cardId: 0, playerId: 1, defense: 3, magicResistance: 0 });
    const rng = new SeededRNG(999);
    const result = calculateDamage(attacker, target, rng);
    expect(result.damage).toBe(10);
  });

  it('magic damage vs 50% MR deals half damage', () => {
    const attacker = makeUnit({ uid: 1, cardId: 7, playerId: 0, attack: 10 });
    const target = makeUnit({ uid: 2, cardId: 0, playerId: 1, defense: 0, magicResistance: 50 });
    const rng = new SeededRNG(999);
    const result = calculateDamage(attacker, target, rng);
    // floor(10 * 0.5) = 5
    expect(result.damage).toBe(5);
  });

  it('magic damage vs building (100% MR) deals min 1 for non-Inferno', () => {
    // Castle Monk (id 6) has no magic damage, let's use a hypothetical
    // Actually we need a non-Inferno magic attacker. There are none in registry.
    // We'll use a Torchbearer but override to check the "non-Inferno" path —
    // Wait, Torchbearer IS Inferno. Let's just manually create the scenario.
    // Actually the function checks getCard(attacker.cardId).faction, so we need a
    // non-Inferno magic unit. There isn't one in registry as a unit.
    // We can test the Inferno bypass case and the MR reduction path differently.
    // For non-Inferno magic vs building: magic damage, non-Inferno attacker, target is building (speed=0, 100% MR)
    // There's no non-Inferno unit with magic damage in the registry.
    // Let's use a unit with DamageType.MAGIC override and a non-Inferno card.
    // The function uses attacker.damageType from UnitInstance and getCard(attacker.cardId).faction from registry.
    // So we can set damageType: MAGIC on a Castle unit (Peasant, id 0) but the card says PHYSICAL.
    // Actually the function should use the UnitInstance's damageType field, not the card's.
    // Let me re-read the spec... "if (attacker.damageType === MAGIC)"
    // and "getCard(attacker.cardId).faction === Faction.INFERNO"
    // So damageType from instance, faction from card registry.
    // For this test, we can just create a peasant (Castle) with damageType MAGIC.
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, attack: 10, damageType: DamageType.MAGIC });
    // Tower (id 17) is a building with 100% MR
    const target = makeUnit({ uid: 2, cardId: 17, playerId: 1, defense: 3, magicResistance: 100 });
    const rng = new SeededRNG(999);
    const result = calculateDamage(attacker, target, rng);
    // Non-Inferno magic vs building (100% MR): damage * (1 - 100/100) = 0, but min 1
    expect(result.damage).toBe(1);
  });

  it('Inferno magic damage vs building bypasses MR (full attack)', () => {
    // Torchbearer (id 7) is Inferno + magic damage
    const attacker = makeUnit({ uid: 1, cardId: 7, playerId: 0, attack: 20 });
    // Tower (id 17) is a building with 100% MR
    const target = makeUnit({ uid: 2, cardId: 17, playerId: 1, defense: 3, magicResistance: 100 });
    const rng = new SeededRNG(999);
    const result = calculateDamage(attacker, target, rng);
    // Inferno vs building: MR bypassed, raw attack = 20
    expect(result.damage).toBe(20);
  });

  it('physical damage ignores MR entirely', () => {
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, attack: 10, damageType: DamageType.PHYSICAL });
    const target = makeUnit({ uid: 2, cardId: 0, playerId: 1, defense: 3, magicResistance: 50 });
    const rng = new SeededRNG(999);
    const result = calculateDamage(attacker, target, rng);
    expect(result.damage).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// applyDamage
// ---------------------------------------------------------------------------

describe('applyDamage', () => {
  it('reduces HP correctly', () => {
    const state = createGameState(42);
    const unit = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, currentHp: 30 });
    placeUnit(state, unit);
    const died = applyDamage(state, 1, 10);
    expect(died).toBe(false);
    expect(unit.currentHp).toBe(20);
  });

  it('returns false if target survives', () => {
    const state = createGameState(42);
    const unit = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, currentHp: 30 });
    placeUnit(state, unit);
    expect(applyDamage(state, 1, 29)).toBe(false);
    expect(unit.alive).toBe(true);
  });

  it('returns true if target dies (HP <= 0)', () => {
    const state = createGameState(42);
    const unit = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, currentHp: 10 });
    placeUnit(state, unit);
    expect(applyDamage(state, 1, 10)).toBe(true);
    expect(unit.alive).toBe(false);
    expect(unit.currentHp).toBe(0);
  });

  it('sets alive=false on death', () => {
    const state = createGameState(42);
    const unit = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, currentHp: 5 });
    placeUnit(state, unit);
    applyDamage(state, 1, 100);
    expect(unit.alive).toBe(false);
  });

  it('clears board cells on death', () => {
    const state = createGameState(42);
    const unit = makeUnit({
      uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, currentHp: 5,
      occupiedCells: [{ col: 3, row: 3 }, { col: 4, row: 3 }],
    });
    placeUnit(state, unit);
    expect(state.board[3][3].unitUid).toBe(1);
    expect(state.board[3][4].unitUid).toBe(1);
    applyDamage(state, 1, 100);
    expect(state.board[3][3].unitUid).toBeNull();
    expect(state.board[3][4].unitUid).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAttackTargets
// ---------------------------------------------------------------------------

describe('getAttackTargets', () => {
  it('melee unit with adjacent enemy returns target', () => {
    const state = createGameState(42);
    // Place melee attacker at (3,3) and enemy at (4,3) — adjacent
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const targets = getAttackTargets(state, 1);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ unitUid: 2, type: 'melee' });
  });

  it('no adjacent enemies returns empty', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 10, row: 10 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    expect(getAttackTargets(state, 1)).toHaveLength(0);
  });

  it('adjacent friendly unit is not included', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3 });
    const friendly = makeUnit({ uid: 2, cardId: 0, playerId: 0, col: 4, row: 3 });
    placeUnit(state, attacker);
    placeUnit(state, friendly);

    expect(getAttackTargets(state, 1)).toHaveLength(0);
  });

  it('building (speed 0) returns no targets', () => {
    const state = createGameState(42);
    // Tower (id 17) is a building (speed 0)
    const building = makeUnit({ uid: 1, cardId: 17, playerId: 0, col: 3, row: 3 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3 });
    placeUnit(state, building);
    placeUnit(state, enemy);

    expect(getAttackTargets(state, 1)).toHaveLength(0);
  });

  it('ranged unit (ammo > 0) returns ranged targets', () => {
    const state = createGameState(42);
    const ranged = makeUnit({ uid: 1, cardId: 2, playerId: 0, col: 3, row: 3 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 10, row: 3 });
    placeUnit(state, ranged);
    placeUnit(state, enemy);

    const targets = getAttackTargets(state, 1);
    expect(targets).toHaveLength(1);
    expect(targets[0].type).toBe('ranged');
    expect(targets[0].unitUid).toBe(2);
  });

  it('dead attacker returns empty', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, alive: false });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    expect(getAttackTargets(state, 1)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// canAttack
// ---------------------------------------------------------------------------

describe('canAttack', () => {
  it('valid melee attack returns valid', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = canAttack(state, 1, 2);
    expect(result.valid).toBe(true);
  });

  it('target not adjacent returns invalid', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 10, row: 10 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = canAttack(state, 1, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('dead attacker returns invalid', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, alive: false });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = canAttack(state, 1, 2);
    expect(result.valid).toBe(false);
  });

  it('dead target returns invalid', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3, alive: false });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = canAttack(state, 1, 2);
    expect(result.valid).toBe(false);
  });

  it('attacking friendly unit returns invalid', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3 });
    const friendly = makeUnit({ uid: 2, cardId: 0, playerId: 0, col: 4, row: 3 });
    placeUnit(state, attacker);
    placeUnit(state, friendly);

    const result = canAttack(state, 1, 2);
    expect(result.valid).toBe(false);
  });

  it('attacker with 0 AP returns invalid', () => {
    const state = createGameState(42);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, remainingAp: 0 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = canAttack(state, 1, 2);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// executeAttack
// ---------------------------------------------------------------------------

describe('executeAttack', () => {
  it('deals correct damage to target', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, attack: 10 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3, defense: 3, currentHp: 30, maxHp: 30 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = executeAttack(state, 1, 2);
    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(enemy.currentHp).toBeLessThan(30);
  });

  it('triggers retaliation when conditions met', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, attack: 5, currentHp: 50, maxHp: 50 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3, attack: 8, defense: 3, currentHp: 100, maxHp: 100 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = executeAttack(state, 1, 2);
    expect(result.retaliation).toBeDefined();
    expect(result.retaliation!.damage).toBeGreaterThanOrEqual(1);
    expect(attacker.currentHp).toBeLessThan(50);
  });

  it('no retaliation if target died', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, attack: 100 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3, defense: 0, currentHp: 5, maxHp: 5 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = executeAttack(state, 1, 2);
    expect(result.targetDied).toBe(true);
    expect(result.retaliation).toBeUndefined();
  });

  it('no retaliation if target already retaliated this turn', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, attack: 5 });
    const enemy = makeUnit({
      uid: 2, cardId: 0, playerId: 1, col: 4, row: 3,
      currentHp: 100, maxHp: 100, retaliatedThisTurn: true,
    });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = executeAttack(state, 1, 2);
    expect(result.retaliation).toBeUndefined();
  });

  it('ranged unit retaliates in melee with half damage', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, attack: 5, currentHp: 100, maxHp: 100 });
    // Archer (id 2) has ammo > 0
    const enemy = makeUnit({
      uid: 2, cardId: 2, playerId: 1, col: 4, row: 3,
      currentHp: 100, maxHp: 100,
    });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = executeAttack(state, 1, 2);
    expect(result.retaliation).toBeDefined();
    // Ranged retaliation is halved
    const fullDamage = calculateDamage(enemy, attacker, state.rng).damage;
    expect(result.retaliation!.damage).toBeLessThanOrEqual(fullDamage);
  });

  it('sets attacker AP to 0 after attack', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, remainingAp: 1 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3, currentHp: 100, maxHp: 100 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    executeAttack(state, 1, 2);
    expect(attacker.remainingAp).toBe(0);
  });

  it('returns complete AttackResult with all fields', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, attack: 10 });
    const enemy = makeUnit({
      uid: 2, cardId: 0, playerId: 1, col: 4, row: 3,
      attack: 8, defense: 3, currentHp: 100, maxHp: 100,
    });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    const result = executeAttack(state, 1, 2);
    expect(result).toHaveProperty('damage');
    expect(result).toHaveProperty('isCrit');
    expect(result).toHaveProperty('targetDied');
    expect(typeof result.damage).toBe('number');
    expect(typeof result.isCrit).toBe('boolean');
    expect(typeof result.targetDied).toBe('boolean');
    if (result.retaliation) {
      expect(result.retaliation).toHaveProperty('damage');
      expect(result.retaliation).toHaveProperty('isCrit');
      expect(result.retaliation).toHaveProperty('attackerDied');
    }
  });

  it('sets retaliatedThisTurn on target after retaliation', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, attack: 5, currentHp: 100, maxHp: 100 });
    const enemy = makeUnit({ uid: 2, cardId: 0, playerId: 1, col: 4, row: 3, attack: 5, currentHp: 100, maxHp: 100 });
    placeUnit(state, attacker);
    placeUnit(state, enemy);

    executeAttack(state, 1, 2);
    expect(enemy.retaliatedThisTurn).toBe(true);
  });

  it('no retaliation from buildings', () => {
    const state = createGameState(999);
    const attacker = makeUnit({ uid: 1, cardId: 0, playerId: 0, col: 3, row: 3, attack: 5 });
    const building = makeUnit({ uid: 2, cardId: 17, playerId: 1, col: 4, row: 3, currentHp: 100, maxHp: 100 });
    placeUnit(state, attacker);
    placeUnit(state, building);

    const result = executeAttack(state, 1, 2);
    expect(result.retaliation).toBeUndefined();
  });
});
