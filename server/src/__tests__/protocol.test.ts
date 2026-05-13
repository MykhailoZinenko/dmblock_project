import { describe, it, expect } from 'vitest';
import { serializeState, canonicalizeAction } from '../protocol.js';
import { createGameState, GameController } from '@arcana/game-core';

describe('serializeState', () => {
  it('serializes a fresh game state to JSON-safe form', () => {
    const state = createGameState(42, [[0, 1, 2], [3, 4, 5]]);
    const serialized = serializeState(state);

    expect(serialized.turnNumber).toBe(state.turnNumber);
    expect(serialized.rngState).toBe(state.rng.serialize());
    expect(serialized.activationQueue).toEqual([]);
    expect(serialized.players.length).toBe(2);
    expect(serialized.phase).toBe('INITIALIZING');
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });

  it('serializes activation queue as UID array', () => {
    const ctrl = new GameController();
    ctrl.startGame(42, [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]]);
    const state = ctrl.getState();
    const serialized = serializeState(state);

    expect(Array.isArray(serialized.activationQueue)).toBe(true);
    for (const uid of serialized.activationQueue) {
      expect(typeof uid).toBe('number');
    }
  });

  it('round-trips through JSON without data loss', () => {
    const ctrl = new GameController();
    ctrl.startGame(99, [[0, 1, 2, 3], [4, 5, 6, 7]]);
    const serialized = serializeState(ctrl.getState());
    const json = JSON.stringify(serialized);
    const parsed = JSON.parse(json);

    expect(parsed.turnNumber).toBe(serialized.turnNumber);
    expect(parsed.rngState).toBe(serialized.rngState);
    expect(parsed.phase).toBe(serialized.phase);
    expect(parsed.players[0].mana).toBe(serialized.players[0].mana);
    expect(parsed.board.length).toBe(serialized.board.length);
  });
});

describe('canonicalizeAction', () => {
  it('produces deterministic JSON with sorted keys', () => {
    const a = canonicalizeAction(1, { type: 'move', unitUid: 5, col: 8, row: 7 });
    const b = canonicalizeAction(1, { type: 'move', col: 8, row: 7, unitUid: 5 });
    expect(a).toBe(b);
  });

  it('includes seq in canonical form', () => {
    const result = canonicalizeAction(42, { type: 'pass' });
    const parsed = JSON.parse(result);
    expect(parsed.seq).toBe(42);
    expect(parsed.type).toBe('pass');
  });

  it('different seqs produce different canonical strings', () => {
    const a = canonicalizeAction(1, { type: 'pass' });
    const b = canonicalizeAction(2, { type: 'pass' });
    expect(a).not.toBe(b);
  });

  it('handles all action types', () => {
    expect(() => canonicalizeAction(1, { type: 'spawn', playerId: 0, cardId: 1, col: 2, row: 3 })).not.toThrow();
    expect(() => canonicalizeAction(1, { type: 'attack', attackerUid: 1, targetUid: 2 })).not.toThrow();
    expect(() => canonicalizeAction(1, { type: 'attack-hero', attackerUid: 1, targetPlayerId: 0 })).not.toThrow();
    expect(() => canonicalizeAction(1, { type: 'cast', playerId: 0, cardId: 5, col: 3, row: 4 })).not.toThrow();
    expect(() => canonicalizeAction(1, { type: 'end-turn' })).not.toThrow();
  });
});
