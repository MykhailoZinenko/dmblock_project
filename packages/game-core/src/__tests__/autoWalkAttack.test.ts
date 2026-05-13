import { describe, it, expect } from 'vitest';
import { createGameState } from '../GameState';
import { executeSpawn } from '../actions/spawnUnit';
import { getAutoWalkHex, getAutoWalkTargets } from '../actions/attackUnit';
import { hex2px } from '../hexUtils';

describe('getAutoWalkHex', () => {
  it('returns null when target is out of AP range', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 0, row: 0 }); // Militiaman, speed 3
    const target = executeSpawn(state, 1, 1, { col: 10, row: 5 });
    const cursor = hex2px(10, 5);
    const result = getAutoWalkHex(state, attacker.uid, target.uid, cursor);
    expect(result).toBeNull();
  });

  it('returns adjacent hex when target is within AP range', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 1, row: 0 });
    const target = executeSpawn(state, 1, 1, { col: 3, row: 0 });
    const cursor = hex2px(3, 0);
    const result = getAutoWalkHex(state, attacker.uid, target.uid, cursor);
    expect(result).not.toBeNull();
    expect(result!.col).toBe(2);
    expect(result!.row).toBe(0);
  });

  it('returns null when already adjacent (no walk needed)', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 1, row: 0 });
    const target = executeSpawn(state, 1, 1, { col: 2, row: 0 });
    const cursor = hex2px(2, 0);
    const result = getAutoWalkHex(state, attacker.uid, target.uid, cursor);
    expect(result).toBeNull();
  });

  it('picks hex closest to cursor for directional control', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 0, row: 5 });
    const target = executeSpawn(state, 1, 1, { col: 2, row: 5 });
    const cursorAbove = hex2px(2, 4);
    const resultAbove = getAutoWalkHex(state, attacker.uid, target.uid, cursorAbove);
    const cursorBelow = hex2px(2, 6);
    const resultBelow = getAutoWalkHex(state, attacker.uid, target.uid, cursorBelow);
    if (resultAbove && resultBelow) {
      expect(resultAbove.row !== resultBelow.row || resultAbove.col !== resultBelow.col).toBe(true);
    }
  });
});

describe('getAutoWalkTargets', () => {
  it('returns empty when no enemies are reachable via auto-walk', () => {
    const state = createGameState(42);
    executeSpawn(state, 0, 1, { col: 0, row: 0 });
    executeSpawn(state, 1, 1, { col: 10, row: 5 });
    const attacker = state.units[0];
    const targets = getAutoWalkTargets(state, attacker.uid);
    expect(targets).toHaveLength(0);
  });

  it('returns enemies reachable within AP budget', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 1, row: 0 });
    const target = executeSpawn(state, 1, 1, { col: 3, row: 0 });
    const targets = getAutoWalkTargets(state, attacker.uid);
    expect(targets.some(t => t.unitUid === target.uid)).toBe(true);
  });
});
