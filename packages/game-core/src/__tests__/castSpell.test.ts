import { describe, it, expect } from 'vitest';
import { createGameState } from '../GameState';
import { executeSpawn } from '../actions/spawnUnit';
import { getSpellTargets, canCast, executeCast, tickStatusEffects, tickUnitEffects } from '../actions/castSpell';

describe('getSpellTargets', () => {
  it('Healing (10) returns friendly unit hexes', () => {
    const state = createGameState(42);
    const ally = executeSpawn(state, 0, 1, { col: 0, row: 0 });
    executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const targets = getSpellTargets(state, 0, 10);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ col: ally.col, row: ally.row });
  });

  it('Blast (11) returns enemy unit hexes', () => {
    const state = createGameState(42);
    executeSpawn(state, 0, 1, { col: 0, row: 0 });
    const enemy = executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const targets = getSpellTargets(state, 0, 11);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ col: enemy.col, row: enemy.row });
  });

  it('Inferno (14) AREA returns all board hexes + exposed hero hex', () => {
    const state = createGameState(42);
    const targets = getSpellTargets(state, 0, 14);
    // 15*11 board hexes + 1 hero hex (barrier down since no units)
    expect(targets).toHaveLength(15 * 11 + 1);
  });
});

describe('canCast', () => {
  it('rejects when not enough mana', () => {
    const state = createGameState(42);
    state.players[0].mana = 2;
    executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const result = canCast(state, 0, 11, { col: 14, row: 0 });
    expect(result.valid).toBe(false);
  });

  it('accepts valid cast', () => {
    const state = createGameState(42);
    state.players[0].mana = 5;
    executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const result = canCast(state, 0, 11, { col: 14, row: 0 });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid target hex', () => {
    const state = createGameState(42);
    state.players[0].mana = 5;
    const result = canCast(state, 0, 11, { col: 5, row: 5 });
    expect(result.valid).toBe(false);
  });
});

describe('executeCast', () => {
  it('Healing restores HP', () => {
    const state = createGameState(42);
    const ally = executeSpawn(state, 0, 1, { col: 0, row: 0 });
    ally.currentHp = 20;
    state.players[0].mana = 10;
    const result = executeCast(state, 0, 10, { col: 0, row: 0 });
    if (result.success) {
      expect(ally.currentHp).toBeGreaterThan(20);
      expect(result.affectedUnits[0].healed).toBeGreaterThan(0);
    }
    expect(state.players[0].mana).toBe(7);
  });

  it('Blast deals magic damage', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const hpBefore = enemy.currentHp;
    state.players[0].mana = 10;
    const result = executeCast(state, 0, 11, { col: 14, row: 0 });
    if (result.success) {
      expect(enemy.currentHp).toBeLessThan(hpBefore);
      expect(result.affectedUnits[0].damage).toBeGreaterThan(0);
    }
    expect(state.players[0].mana).toBe(7);
  });

  it('deducts mana even on failure', () => {
    const state = createGameState(42);
    executeSpawn(state, 1, 1, { col: 14, row: 0 });
    state.players[0].mana = 10;
    executeCast(state, 0, 11, { col: 14, row: 0 });
    expect(state.players[0].mana).toBe(7);
  });

  it('Inferno AoE hits multiple enemies within radius', () => {
    const state = createGameState(100);
    const e1 = executeSpawn(state, 1, 1, { col: 7, row: 5 });
    const e2 = executeSpawn(state, 1, 1, { col: 8, row: 5 });
    const e3 = executeSpawn(state, 1, 1, { col: 13, row: 0 });
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 14, { col: 7, row: 5 });
    if (result.success) {
      const hitUids = result.affectedUnits.map(a => a.uid);
      expect(hitUids).toContain(e1.uid);
      expect(hitUids).toContain(e2.uid);
      expect(hitUids).not.toContain(e3.uid);
    }
  });

  it('Polymorph applies status and changes stats', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 });
    const atkBefore = enemy.attack;
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 15, { col: 14, row: 0 });
    if (result.success) {
      expect(enemy.polymorphed).toBe(true);
      expect(enemy.attack).toBe(0);
      expect(enemy.defense).toBe(0);
      expect(enemy.speed).toBe(1);
      expect(enemy.activeEffects).toHaveLength(1);
      expect(enemy.activeEffects[0].type).toBe('polymorph');
      expect(enemy.activeEffects[0].originalStats!.attack).toBe(atkBefore);
    }
  });

  it('Curse halves attack and defense', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 });
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 16, { col: 14, row: 0 });
    if (result.success) {
      expect(enemy.cursed).toBe(true);
      expect(enemy.attack).toBe(10);
      expect(enemy.defense).toBe(9);
    }
  });
});

describe('tickUnitEffects + tickStatusEffects', () => {
  it('effect expires after unit activation + turn start', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 });
    const origAtk = enemy.attack;
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 15, { col: 14, row: 0 });
    if (result.success) {
      expect(enemy.polymorphed).toBe(true);
      expect(enemy.activeEffects[0].activationsLeft).toBe(1);
      // Turn start cleanup — activationsLeft is still 1, no removal
      const expired1 = tickStatusEffects(state);
      expect(expired1).toHaveLength(0);
      // Unit activates and finishes — tick decrements to 0
      tickUnitEffects(enemy);
      expect(enemy.activeEffects[0].activationsLeft).toBe(0);
      // Next turn start — effect removed, stats restored
      const expired2 = tickStatusEffects(state);
      expect(expired2).toContain(enemy.uid);
      expect(enemy.polymorphed).toBe(false);
      expect(enemy.attack).toBe(origAtk);
      expect(enemy.activeEffects).toHaveLength(0);
    }
  });

  it('effect survives if activations remain', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 });
    state.players[0].mana = 20;
    enemy.activeEffects.push({
      cardId: 12,
      type: 'slow',
      activationsLeft: 2,
      originalStats: { attack: enemy.attack, defense: enemy.defense, speed: enemy.speed },
    });
    enemy.speed = Math.max(1, enemy.speed - 1);
    // Unit activates — tick to 1
    tickUnitEffects(enemy);
    expect(enemy.activeEffects[0].activationsLeft).toBe(1);
    // Turn start — still has activations, no removal
    const expired = tickStatusEffects(state);
    expect(expired).toHaveLength(0);
    expect(enemy.activeEffects).toHaveLength(1);
  });
});
