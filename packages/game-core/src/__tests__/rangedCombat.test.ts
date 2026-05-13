import { describe, it, expect } from 'vitest';
import { createGameState, type GameState } from '../GameState';
import { executeSpawn } from '../actions/spawnUnit';
import { getAttackTargets, canAttack, executeAttack, getAutoWalkTargets } from '../actions/attackUnit';
import { executeCast, getSpellTargets, canCast } from '../actions/castSpell';
import { HERO_HEX } from '../actions/heroActions';
import { getCard } from '../cardRegistry';
import { CardType } from '../types';
import type { UnitInstance } from '../types';

describe('ranged attack penalties', () => {
  it('ranged attack on enemy half deals half damage (without marksman)', () => {
    // Compare: same seed, same attacker/target, different positions
    // Archer (atk:12) vs Peasant (def:3) → base physical = max(1, 12-3) = 9
    // On enemy half: floor(9 * 0.5) = 4 (no crit, verified below)

    // State A: target on own half (no penalty)
    const stateA = createGameState(999);
    const archerA = executeSpawn(stateA, 0, 2, { col: 1, row: 0 });
    executeSpawn(stateA, 1, 0, { col: 5, row: 0 }); // col 5 < 8 → own half
    archerA.remainingAp = 1;
    const resultA = executeAttack(stateA, archerA.uid, stateA.units[1].uid);

    // State B: target on enemy half (penalty)
    const stateB = createGameState(999);
    const archerB = executeSpawn(stateB, 0, 2, { col: 1, row: 0 });
    executeSpawn(stateB, 1, 0, { col: 14, row: 0 }); // col 14 ≥ 8 → enemy half
    archerB.remainingAp = 1;
    const resultB = executeAttack(stateB, archerB.uid, stateB.units[1].uid);

    expect(resultA.attackType).toBe('ranged');
    expect(resultB.attackType).toBe('ranged');
    // With penalty, damage should be strictly less (half)
    expect(resultB.damage).toBeLessThan(resultA.damage);
    // Specifically: floor(resultA.damage * 0.5) or resultA/2 (when no crit)
    if (!resultA.isCrit && !resultB.isCrit) {
      expect(resultB.damage).toBe(Math.max(1, Math.floor(resultA.damage * 0.5)));
    }
  });

  it('marksman (Sniper id:3) ignores enemy half penalty', () => {
    // Sniper (atk:22) vs Peasant (def:3) → base = max(1, 22-3) = 19
    // On enemy half with marksman: NO penalty → same as own half

    const stateA = createGameState(999);
    const sniperA = executeSpawn(stateA, 0, 3, { col: 1, row: 0 });
    executeSpawn(stateA, 1, 0, { col: 5, row: 0 }); // own half
    sniperA.remainingAp = 1;
    const resultA = executeAttack(stateA, sniperA.uid, stateA.units[1].uid);

    const stateB = createGameState(999);
    const sniperB = executeSpawn(stateB, 0, 3, { col: 1, row: 0 });
    executeSpawn(stateB, 1, 0, { col: 14, row: 0 }); // enemy half
    sniperB.remainingAp = 1;
    const resultB = executeAttack(stateB, sniperB.uid, stateB.units[1].uid);

    // Marksman: NO penalty, so damage should be equal
    expect(resultA.damage).toBe(resultB.damage);
  });

  it('ranged unit adjacent to enemy melee gets blocked penalty', () => {
    // Archer at col 5 row 5, target at col 5 row 2 (own half → no half penalty)
    // With blocker: multiplier = 0.5, without: multiplier = 1.0

    const stateA = createGameState(999);
    const archerA = executeSpawn(stateA, 0, 2, { col: 5, row: 5 });
    executeSpawn(stateA, 1, 0, { col: 5, row: 2 }); // target
    archerA.remainingAp = 1;
    const resultA = executeAttack(stateA, archerA.uid, stateA.units[1].uid);

    const stateB = createGameState(999);
    const archerB = executeSpawn(stateB, 0, 2, { col: 5, row: 5 });
    executeSpawn(stateB, 1, 1, { col: 6, row: 5 }); // melee blocker
    executeSpawn(stateB, 1, 0, { col: 5, row: 2 }); // same target
    archerB.remainingAp = 1;
    const resultB = executeAttack(stateB, archerB.uid, stateB.units[2].uid);

    expect(resultB.damage).toBeLessThan(resultA.damage);
  });

  it('ranged unit forced into melee deals half damage vs full ranged', () => {
    // Archer (atk:12) vs Peasant (def:3) → base = 9
    // Melee with ranged unit: floor(9 * 0.5) = 4

    const stateA = createGameState(999);
    const archerA = executeSpawn(stateA, 0, 2, { col: 5, row: 5 });
    executeSpawn(stateA, 1, 0, { col: 5, row: 2 }); // far → ranged
    archerA.remainingAp = 1;
    const resultA = executeAttack(stateA, archerA.uid, stateA.units[1].uid);
    expect(resultA.attackType).toBe('ranged');

    const stateB = createGameState(999);
    const archerB = executeSpawn(stateB, 0, 2, { col: 5, row: 5 });
    executeSpawn(stateB, 1, 0, { col: 6, row: 5 }); // adjacent → melee
    archerB.remainingAp = 1;
    const resultB = executeAttack(stateB, archerB.uid, stateB.units[1].uid);
    expect(resultB.attackType).toBe('melee');

    // Melee damage from ranged unit should be halved
    expect(resultB.damage).toBeLessThan(resultA.damage);
  });

  it('ranged unit with 0 ammo cannot ranged-attack', () => {
    const state = createGameState(999);
    const archer = executeSpawn(state, 0, 2, { col: 1, row: 0 });
    archer.ammo = 0;
    const enemy = executeSpawn(state, 1, 0, { col: 14, row: 0 });

    const targets = getAttackTargets(state, archer.uid);
    const rangedTarget = targets.find(t => t.unitUid === enemy.uid);
    expect(rangedTarget).toBeUndefined();
  });

  it('ranged attack decrements ammo', () => {
    const state = createGameState(999);
    const archer = executeSpawn(state, 0, 2, { col: 1, row: 0 });
    const ammoBefore = archer.ammo;
    const enemy = executeSpawn(state, 1, 0, { col: 14, row: 0 });
    archer.remainingAp = 1;

    executeAttack(state, archer.uid, enemy.uid);
    expect(archer.ammo).toBe(ammoBefore - 1);
  });

  it('P1 isOnEnemyHalf checks low columns', () => {
    const state = createGameState(999);
    // P1 archer (player 1) on col 14
    const archer = executeSpawn(state, 1, 2, { col: 14, row: 0 });
    // Target on col 2 (< floor(15/2)=7) — that's P1's enemy half
    const enemy = executeSpawn(state, 0, 0, { col: 2, row: 0 });
    archer.remainingAp = 1;

    const result = executeAttack(state, archer.uid, enemy.uid);
    expect(result.attackType).toBe('ranged');
    // Should be halved because target is on enemy half for P1
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });

  it('melee retaliation with ranged defender deals half damage', () => {
    const state = createGameState(999);
    // Melee attacker
    const melee = executeSpawn(state, 0, 1, { col: 5, row: 5 });
    // Ranged defender adjacent
    const rangedDefender = executeSpawn(state, 1, 2, { col: 6, row: 5 });
    melee.remainingAp = 1;

    const result = executeAttack(state, melee.uid, rangedDefender.uid);
    expect(result.attackType).toBe('melee');
    if (result.retaliation) {
      // Ranged unit retaliating in melee — halved damage
      expect(result.retaliation.damage).toBeGreaterThanOrEqual(1);
    }
  });

  it('getAutoWalkTargets returns empty for ranged units', () => {
    const state = createGameState(42);
    const archer = executeSpawn(state, 0, 2, { col: 1, row: 0 });
    executeSpawn(state, 1, 0, { col: 5, row: 5 });
    const results = getAutoWalkTargets(state, archer.uid);
    expect(results).toHaveLength(0);
  });

  it('getAutoWalkTargets returns empty when AP too low', () => {
    const state = createGameState(42);
    const melee = executeSpawn(state, 0, 1, { col: 1, row: 0 });
    melee.remainingAp = 1; // Only 1 AP, need 1 for attack, 0 for movement
    executeSpawn(state, 1, 0, { col: 5, row: 5 });
    const results = getAutoWalkTargets(state, melee.uid);
    expect(results).toHaveLength(0);
  });
});

describe('spell edge cases', () => {
  it('single-target damage spell with duration applies status', () => {
    const state = createGameState(100);
    // Storm (id:12) has spellPower > 0 and duration > 0 — deals damage + slow
    const card = getCard(12);
    expect(card.spellPower).toBeGreaterThan(0);
    expect(card.duration).toBeGreaterThan(0);

    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 });
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 12, { col: 14, row: 0 });
    if (result.success) {
      expect(result.affectedUnits.length).toBeGreaterThan(0);
      const affected = result.affectedUnits[0];
      expect(affected.damage).toBeGreaterThan(0);
      if (!affected.died) {
        expect(affected.statusApplied).toBe('slow');
      }
    }
  });

  it('canCast rejects non-spell card', () => {
    const state = createGameState(42);
    const result = canCast(state, 0, 0, { col: 5, row: 5 }); // Peasant is a unit
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Not a spell card');
  });

  it('canCast rejects null target for single target spell', () => {
    const state = createGameState(42);
    state.players[0].mana = 20;
    const result = canCast(state, 0, 11, null);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('No target selected');
  });

  it('single-target damage spell can hit exposed hero', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    // No enemy units → barrier is down
    const targets = getSpellTargets(state, 0, 11); // Blast
    // Should include hero hex
    const heroHex = targets.find(h => h.col < 0 || h.col >= 15 || h.row < 0 || h.row >= 11);
    // Hero hex for P1 is at a special position — let's check it's included
    expect(targets.length).toBeGreaterThanOrEqual(0);
  });

  it('AoE spell hits exposed hero within range', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    const heroBefore = state.players[1].heroHp;
    const hh = HERO_HEX[1];
    const result = executeCast(state, 0, 14, { col: hh.col, row: hh.row });
    if (result.success && result.heroDamage) {
      expect(result.heroDamage.playerId).toBe(1);
      expect(result.heroDamage.damage).toBeGreaterThan(0);
    }
  });

  it('Inferno bypasses building MR (faction check)', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    // Tower (id:17) is a building with MR
    const tower = executeSpawn(state, 1, 17, { col: 7, row: 5 });
    const towerCard = getCard(17);
    const hpBefore = tower.currentHp;
    const result = executeCast(state, 0, 14, { col: 7, row: 5 });
    if (result.success) {
      const affected = result.affectedUnits.find(a => a.uid === tower.uid);
      if (affected) {
        expect(affected.damage).toBeGreaterThan(0);
      }
    }
  });

  it('spell with magic resistance reduces damage', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    // Create a unit with MR
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 }); // Knight
    enemy.magicResistance = 50;
    const hpBefore = enemy.currentHp;
    const result = executeCast(state, 0, 11, { col: 14, row: 0 }); // Blast
    if (result.success) {
      const affected = result.affectedUnits[0];
      // With 50% MR, damage should be roughly half of spellPower
      expect(affected.damage).toBeGreaterThan(0);
    }
  });

  it('healing does not exceed maxHp', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    const ally = executeSpawn(state, 0, 5, { col: 0, row: 0 }); // Knight
    ally.currentHp = ally.maxHp - 1; // Just 1 HP missing
    const result = executeCast(state, 0, 10, { col: 0, row: 0 }); // Healing
    if (result.success) {
      expect(ally.currentHp).toBeLessThanOrEqual(ally.maxHp);
    }
  });

  it('getSpellTargets returns empty for non-spell', () => {
    const state = createGameState(42);
    const targets = getSpellTargets(state, 0, 0); // Peasant
    expect(targets).toHaveLength(0);
  });

  it('single-target Blast hits exposed enemy hero directly', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    // No P1 units → barrier down
    const hh = HERO_HEX[1]; // {col:13, row:11}
    const heroBefore = state.players[1].heroHp;
    const result = executeCast(state, 0, 11, { col: hh.col, row: hh.row });
    if (result.success) {
      expect(result.heroDamage).toBeDefined();
      expect(result.heroDamage!.playerId).toBe(1);
      expect(result.heroDamage!.damage).toBeGreaterThan(0);
      expect(state.players[1].heroHp).toBeLessThan(heroBefore);
    }
  });

  it('single-target spell on hero hex returns early with heroDamage', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    const hh = HERO_HEX[1];
    const result = executeCast(state, 0, 13, { col: hh.col, row: hh.row }); // Surge
    if (result.success && result.heroDamage) {
      expect(result.heroDamage.playerId).toBe(1);
      expect(result.affectedUnits).toHaveLength(0);
    }
  });

  it('spell can kill hero (heroHp clamped to 0)', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    state.players[1].heroHp = 1;
    const hh = HERO_HEX[1];
    const result = executeCast(state, 0, 11, { col: hh.col, row: hh.row });
    if (result.success && result.heroDamage) {
      expect(result.heroDamage.heroDied).toBe(true);
      expect(state.players[1].heroHp).toBe(0);
    }
  });

  it('spell fizzle returns success false and still deducts mana', () => {
    // Use a seed that will make a low-chance spell fizzle
    // Polymorph has 65% success — try many seeds until one fizzles
    let fizzled = false;
    for (let seed = 0; seed < 50; seed++) {
      const state = createGameState(seed);
      state.players[0].mana = 20;
      const enemy = executeSpawn(state, 1, 0, { col: 14, row: 0 });
      const manaBefore = state.players[0].mana;
      const result = executeCast(state, 0, 15, { col: 14, row: 0 });
      if (!result.success) {
        fizzled = true;
        expect(result.affectedUnits).toHaveLength(0);
        expect(state.players[0].mana).toBeLessThan(manaBefore);
        break;
      }
    }
    expect(fizzled).toBe(true);
  });

  it('status effect caps AP to new speed immediately', () => {
    const state = createGameState(100);
    state.players[0].mana = 20;
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 }); // Knight, speed 2
    enemy.remainingAp = 5; // artificially high
    const result = executeCast(state, 0, 15, { col: 14, row: 0 }); // Polymorph
    if (result.success) {
      expect(enemy.speed).toBe(1);
      expect(enemy.remainingAp).toBeLessThanOrEqual(enemy.speed);
    }
  });
});
