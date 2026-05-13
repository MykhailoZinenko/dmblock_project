import { describe, it, expect } from 'vitest';
import { canSpawn, executeSpawn } from '../actions/spawnUnit';
import { createGameState } from '../GameState';
import { CardType } from '../types';
import { getCard } from '../cardRegistry';
import { GRID_COLS, GRID_ROWS } from '../constants';
import { SeededRNG } from '../rng';

// Helper: create a game state with specific mana for player
function stateWithMana(seed: number, p1Mana: number, p2Mana: number) {
  const state = createGameState(seed);
  state.players[0].mana = p1Mana;
  state.players[1].mana = p2Mana;
  return state;
}

describe('canSpawn', () => {
  it('valid spawn: P1 unit in col 0 with sufficient mana', () => {
    const state = stateWithMana(42, 10, 10);
    const result = canSpawn(state, 0, 0, { col: 0, row: 0 }); // Peasant, cost 1
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('valid spawn: P1 unit in col 1', () => {
    const state = stateWithMana(42, 10, 10);
    const result = canSpawn(state, 0, 1, { col: 1, row: 3 }); // Militiaman, cost 2
    expect(result.valid).toBe(true);
  });

  it('valid spawn: P2 unit in col 14', () => {
    const state = stateWithMana(42, 10, 10);
    const result = canSpawn(state, 1, 0, { col: 14, row: 5 }); // Peasant
    expect(result.valid).toBe(true);
  });

  it('valid spawn: P2 unit in col 13', () => {
    const state = stateWithMana(42, 10, 10);
    const result = canSpawn(state, 1, 2, { col: 13, row: 0 }); // Archer, cost 4
    expect(result.valid).toBe(true);
  });

  it('insufficient mana returns invalid with reason', () => {
    const state = stateWithMana(42, 0, 0);
    const result = canSpawn(state, 0, 2, { col: 0, row: 0 }); // Archer costs 4
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mana');
  });

  it('hex outside deploy zone returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    // P1 trying to place in col 5 (not 0 or 1)
    const result = canSpawn(state, 0, 0, { col: 5, row: 3 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('deploy zone');
  });

  it('P2 outside deploy zone returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    // P2 trying to place in col 0 (P1 zone)
    const result = canSpawn(state, 1, 0, { col: 0, row: 3 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('deploy zone');
  });

  it('hex occupied returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    state.board[0][0].unitUid = 99;
    const result = canSpawn(state, 0, 0, { col: 0, row: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('spell card returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    // Card 10 is Healing (spell)
    const result = canSpawn(state, 0, 10, { col: 0, row: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('spell');
  });

  it('invalid cell (out of bounds) returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    const result = canSpawn(state, 0, 0, { col: -1, row: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('invalid');
  });

  it('invalid cell (row out of bounds) returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    const result = canSpawn(state, 0, 0, { col: 0, row: GRID_ROWS });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('invalid');
  });

  it('unknown card id returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    const result = canSpawn(state, 0, 999, { col: 0, row: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('card');
  });

  // --- 2x2 building tests ---

  it('2x2 building: all 4 cells valid and in deploy zone (P1)', () => {
    const state = stateWithMana(42, 10, 10);
    // Barracks (id=18, size=2, cost=5). Anchor at (0,0), occupies (0,0),(1,0),(0,1),(1,1)
    const result = canSpawn(state, 0, 18, { col: 0, row: 0 });
    expect(result.valid).toBe(true);
  });

  it('2x2 building: all 4 cells valid and in deploy zone (P2)', () => {
    const state = stateWithMana(42, 10, 10);
    // Barracks at (13,0) occupies (13,0),(14,0),(13,1),(14,1) - all in P2 zone
    const result = canSpawn(state, 1, 18, { col: 13, row: 0 });
    expect(result.valid).toBe(true);
  });

  it('2x2 building: one cell occupied returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    state.board[1][1].unitUid = 50;
    const result = canSpawn(state, 0, 18, { col: 0, row: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('occupied');
  });

  it('2x2 building: cells extend outside grid returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    // Place at bottom-right corner of deploy zone where row+1 is out of bounds
    const result = canSpawn(state, 0, 18, { col: 0, row: GRID_ROWS - 1 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('invalid');
  });

  it('2x2 building: cells outside deploy zone returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    // P1 placing Barracks at col=1: anchor (1,0) is in zone, but (2,0) is NOT
    const result = canSpawn(state, 0, 18, { col: 1, row: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('deploy zone');
  });

  it('2x2 building: P2 cells outside deploy zone returns invalid', () => {
    const state = stateWithMana(42, 10, 10);
    // P2 placing at col=14: (14,0) in zone but (15,0) is out of grid
    const result = canSpawn(state, 1, 18, { col: 14, row: 0 });
    expect(result.valid).toBe(false);
    // Could be invalid hex or deploy zone - either way it should fail
    expect(result.valid).toBe(false);
  });
});

describe('executeSpawn', () => {
  it('deducts correct mana from player', () => {
    const state = stateWithMana(42, 10, 10);
    // Peasant costs 1 mana
    executeSpawn(state, 0, 0, { col: 0, row: 0 });
    expect(state.players[0].mana).toBe(9);
  });

  it('removes one copy of the spawned card from hand when present', () => {
    const state = stateWithMana(42, 10, 10);
    state.players[0].hand = [7, 1, 10];
    executeSpawn(state, 0, 1, { col: 0, row: 2 });
    expect(state.players[0].hand).toEqual([7, 10]);
  });

  it('deducts mana from P2', () => {
    const state = stateWithMana(42, 10, 10);
    // Archer costs 4 mana
    executeSpawn(state, 1, 2, { col: 13, row: 0 });
    expect(state.players[1].mana).toBe(6);
  });

  it('creates UnitInstance with correct stats from card', () => {
    const state = stateWithMana(42, 10, 10);
    const card = getCard(1); // Militiaman
    const unit = executeSpawn(state, 0, 1, { col: 0, row: 2 });

    expect(unit.cardId).toBe(1);
    expect(unit.playerId).toBe(0);
    expect(unit.col).toBe(0);
    expect(unit.row).toBe(2);
    expect(unit.attack).toBe(card.attack);
    expect(unit.defense).toBe(card.defense);
    expect(unit.currentHp).toBe(card.hp);
    expect(unit.maxHp).toBe(card.hp);
    expect(unit.initiative).toBe(card.initiative);
    expect(unit.speed).toBe(card.speed);
    expect(unit.ammo).toBe(card.ammo);
    expect(unit.magicResistance).toBe(card.magicResistance);
    expect(unit.damageType).toBe(card.damageType);
    expect(unit.remainingAp).toBe(card.speed);
    expect(unit.retaliatedThisTurn).toBe(false);
    expect(unit.alive).toBe(true);
    expect(unit.cooldowns).toEqual({});
    expect(unit.garrisonedIn).toBeNull();
    expect(unit.polymorphed).toBe(false);
    expect(unit.cursed).toBe(false);
    expect(unit.occupiedCells).toEqual([{ col: 0, row: 2 }]);
  });

  it('assigns incrementing uids', () => {
    const state = stateWithMana(42, 10, 10);
    const unit1 = executeSpawn(state, 0, 0, { col: 0, row: 0 });
    const unit2 = executeSpawn(state, 0, 1, { col: 1, row: 1 });
    const unit3 = executeSpawn(state, 1, 0, { col: 13, row: 0 });

    expect(unit1.uid).toBe(1);
    expect(unit2.uid).toBe(2);
    expect(unit3.uid).toBe(3);
  });

  it('places unitUid on correct board cell', () => {
    const state = stateWithMana(42, 10, 10);
    const unit = executeSpawn(state, 0, 1, { col: 0, row: 3 });
    expect(state.board[3][0].unitUid).toBe(unit.uid);
  });

  it('adds unit to state.units', () => {
    const state = stateWithMana(42, 10, 10);
    expect(state.units.length).toBe(0);
    const unit = executeSpawn(state, 0, 0, { col: 0, row: 0 });
    expect(state.units.length).toBe(1);
    expect(state.units[0]).toBe(unit);

    const unit2 = executeSpawn(state, 1, 0, { col: 14, row: 0 });
    expect(state.units.length).toBe(2);
    expect(state.units[1]).toBe(unit2);
  });

  it('2x2 building occupies 4 cells on board', () => {
    const state = stateWithMana(42, 10, 10);
    // Barracks (id=18, size=2) at anchor (0,0)
    const unit = executeSpawn(state, 0, 18, { col: 0, row: 0 });

    // All 4 cells should have the building's uid
    expect(state.board[0][0].unitUid).toBe(unit.uid);
    expect(state.board[0][1].unitUid).toBe(unit.uid);
    expect(state.board[1][0].unitUid).toBe(unit.uid);
    expect(state.board[1][1].unitUid).toBe(unit.uid);

    // occupiedCells should list all 4
    expect(unit.occupiedCells).toHaveLength(4);
    expect(unit.occupiedCells).toContainEqual({ col: 0, row: 0 });
    expect(unit.occupiedCells).toContainEqual({ col: 1, row: 0 });
    expect(unit.occupiedCells).toContainEqual({ col: 0, row: 1 });
    expect(unit.occupiedCells).toContainEqual({ col: 1, row: 1 });

    // Anchor position
    expect(unit.col).toBe(0);
    expect(unit.row).toBe(0);
  });

  it('2x2 building for P2 occupies correct cells', () => {
    const state = stateWithMana(42, 10, 10);
    // Barracks at anchor (13,2) for P2
    const unit = executeSpawn(state, 1, 18, { col: 13, row: 2 });

    expect(state.board[2][13].unitUid).toBe(unit.uid);
    expect(state.board[2][14].unitUid).toBe(unit.uid);
    expect(state.board[3][13].unitUid).toBe(unit.uid);
    expect(state.board[3][14].unitUid).toBe(unit.uid);
  });

  // Peasant unarmed tests - we find seeds that do/don't trigger 20% roll
  it('Peasant unarmed chance: deterministic with seed', () => {
    // Test that spawning a Peasant uses rollPercent(20) from the RNG.
    // We'll try multiple seeds and verify the behavior is consistent
    // (same seed always gives same result).
    const results: boolean[] = [];
    for (let seed = 0; seed < 50; seed++) {
      const state = stateWithMana(seed, 10, 10);
      const unit = executeSpawn(state, 0, 0, { col: 0, row: 0 });
      results.push(unit.attack < getCard(0).attack);
    }

    // With 50 seeds and 20% chance, we'd expect roughly 10 triggers.
    // Just verify it's not all true or all false (deterministic but variable).
    const triggered = results.filter(r => r).length;
    expect(triggered).toBeGreaterThan(0);
    expect(triggered).toBeLessThan(50);
  });

  it('Peasant unarmed: same seed always produces same result', () => {
    const state1 = stateWithMana(99, 10, 10);
    const unit1 = executeSpawn(state1, 0, 0, { col: 0, row: 0 });

    const state2 = stateWithMana(99, 10, 10);
    const unit2 = executeSpawn(state2, 0, 0, { col: 0, row: 0 });

    expect(unit1.attack).toBe(unit2.attack);
  });

  it('Peasant unarmed: attack is halved when triggered', () => {
    const card = getCard(0); // Peasant
    // Find a seed where unarmed triggers
    let unarmedUnit = null;
    for (let seed = 0; seed < 200; seed++) {
      const state = stateWithMana(seed, 10, 10);
      const unit = executeSpawn(state, 0, 0, { col: 0, row: 0 });
      if (unit.attack < card.attack) {
        unarmedUnit = unit;
        break;
      }
    }
    expect(unarmedUnit).not.toBeNull();
    expect(unarmedUnit!.attack).toBe(Math.floor(card.attack / 2));
  });

  it('Peasant unarmed: attack is normal when not triggered', () => {
    const card = getCard(0); // Peasant
    // Find a seed where unarmed does NOT trigger
    let normalUnit = null;
    for (let seed = 0; seed < 200; seed++) {
      const state = stateWithMana(seed, 10, 10);
      const unit = executeSpawn(state, 0, 0, { col: 0, row: 0 });
      if (unit.attack === card.attack) {
        normalUnit = unit;
        break;
      }
    }
    expect(normalUnit).not.toBeNull();
    expect(normalUnit!.attack).toBe(card.attack);
  });

  it('non-Peasant units are never affected by unarmed', () => {
    const card = getCard(1); // Militiaman
    // Try many seeds - Militiaman should never have halved attack
    for (let seed = 0; seed < 20; seed++) {
      const state = stateWithMana(seed, 10, 10);
      const unit = executeSpawn(state, 0, 1, { col: 0, row: 0 });
      expect(unit.attack).toBe(card.attack);
    }
  });
});
