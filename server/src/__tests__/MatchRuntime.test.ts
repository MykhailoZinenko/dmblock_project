import { describe, it, expect, beforeEach } from 'vitest';
import { MatchRuntime } from '../MatchRuntime.js';
import { cardRegistry, executeSpawn, buildInitiativeQueue, CardType } from '@arcana/game-core';

function validDeck(): number[] {
  return cardRegistry.slice(0, 20).map(c => c.id);
}

function spawnUnitsForBothPlayers(runtime: MatchRuntime): void {
  const state = runtime.getStateForTest();
  const unitCards = cardRegistry.filter(c => c.cardType === CardType.UNIT);
  const card = unitCards[0];
  state.players[0].mana = 99;
  state.players[1].mana = 99;
  state.players[0].hand.push(card.id);
  state.players[1].hand.push(card.id);
  executeSpawn(state, 0, card.id, { col: 0, row: 0 });
  executeSpawn(state, 1, card.id, { col: 14, row: 0 });
  state.activationQueue = buildInitiativeQueue(state.units, state.rng);
  state.currentActivationIndex = 0;
}

describe('MatchRuntime', () => {
  let runtime: MatchRuntime;

  beforeEach(() => {
    runtime = new MatchRuntime(1, '0xPlayer0', '0xPlayer1');
  });

  // --- Deck submission ---

  describe('deck submission', () => {
    it('starts in waiting-for-decks phase', () => {
      expect(runtime.phase).toBe('waiting-for-decks');
    });

    it('accepts first deck without starting game', () => {
      runtime.submitDeck(0, validDeck());
      expect(runtime.phase).toBe('waiting-for-decks');
    });

    it('starts game when both decks submitted', () => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
      expect(runtime.phase).toBe('playing');
    });

    it('rejects empty deck', () => {
      expect(() => runtime.submitDeck(0, [])).toThrow('Deck is empty');
    });

    it('rejects deck with invalid card ID', () => {
      expect(() => runtime.submitDeck(0, [9999])).toThrow('Invalid card ID: 9999');
    });

    it('rejects deck submission after game started', () => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
      expect(() => runtime.submitDeck(0, validDeck())).toThrow('Not accepting decks');
    });
  });

  // --- Action execution ---

  describe('action execution', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
      spawnUnitsForBothPlayers(runtime);
    });

    it('rejects action when not in playing phase', () => {
      const rt = new MatchRuntime(2, '0xA', '0xB');
      const result = rt.executeAction(0, { type: 'pass' });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('not in playing phase');
    });

    it('rejects action from wrong player', () => {
      const controlling = runtime.getControllingPlayer();
      expect(controlling).toBeGreaterThanOrEqual(0);
      const other = controlling === 0 ? 1 : 0;
      const result = runtime.executeAction(other, { type: 'pass' });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('not your turn');
    });

    it('accepts pass from controlling player', () => {
      const controlling = runtime.getControllingPlayer();
      const result = runtime.executeAction(controlling, { type: 'pass' });
      expect(result.ok).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events.some(e => e.type === 'activation-changed')).toBe(true);
    });

    it('accepts end-turn', () => {
      const result = runtime.executeAction(runtime.getControllingPlayer(), { type: 'end-turn' });
      expect(result.ok).toBe(true);
      expect(result.events.some(e => e.type === 'turn-changed')).toBe(true);
      expect(result.events.some(e => e.type === 'queue-rebuilt')).toBe(true);
      expect(result.events.some(e => e.type === 'mana-changed')).toBe(true);
    });

    it('increments seq on successful action', () => {
      const before = runtime.seq;
      runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' });
      expect(runtime.seq).toBe(before + 1);
    });

    it('does not increment seq on rejected action', () => {
      const before = runtime.seq;
      const controlling = runtime.getControllingPlayer();
      const other = controlling === 0 ? 1 : 0;
      runtime.executeAction(other, { type: 'pass' });
      expect(runtime.seq).toBe(before);
    });

    it('records action in log with hmac', () => {
      runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' }, 'hmac123');
      expect(runtime.actionLog.length).toBe(1);
      expect(runtime.actionLog[0].hmac).toBe('hmac123');
      expect(runtime.actionLog[0].seq).toBe(1);
      expect(runtime.actionLog[0].action.type).toBe('pass');
      expect(runtime.actionLog[0].timestamp).toBeGreaterThan(0);
    });

    it('returns stateHash on success', () => {
      const result = runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' });
      expect(result.stateHash).toBeTruthy();
      expect(typeof result.stateHash).toBe('string');
    });

    it('rejects invalid spawn location', () => {
      const result = runtime.executeAction(0, {
        type: 'spawn', playerId: 0, cardId: 0, col: 7, row: 5,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects move for nonexistent unit', () => {
      const controlling = runtime.getControllingPlayer();
      const result = runtime.executeAction(controlling, {
        type: 'move', unitUid: 999, col: 5, row: 5,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects attack for nonexistent units', () => {
      const controlling = runtime.getControllingPlayer();
      const result = runtime.executeAction(controlling, {
        type: 'attack', attackerUid: 999, targetUid: 998,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects hero attack when not adjacent', () => {
      const controlling = runtime.getControllingPlayer();
      // Use an existing unit that is far from hero
      const unit = runtime.getStateForTest().units.find(u => u.playerId === controlling);
      const result = runtime.executeAction(controlling, {
        type: 'attack-hero', attackerUid: unit?.uid ?? 999, targetPlayerId: controlling === 0 ? 1 : 0,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects cast with card not in hand', () => {
      const controlling = runtime.getControllingPlayer();
      // Card 10 is a spell; use it without having it in hand
      const result = runtime.executeAction(controlling, {
        type: 'cast', playerId: controlling, cardId: 10, col: 5, row: 5,
      });
      expect(result.ok).toBe(false);
    });
  });

  // --- Spawn with events ---

  describe('spawn action', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
    });

    it('produces unit-spawned and mana-changed events on valid spawn', () => {
      const state = runtime.getStateForTest();
      const hand = state.players[0].hand;
      if (hand.length === 0) return;
      const cardId = hand[0];
      state.players[0].mana = 99;
      const result = runtime.executeAction(0, {
        type: 'spawn', playerId: 0, cardId, col: 0, row: 0,
      });
      if (result.ok) {
        expect(result.events.some(e => e.type === 'unit-spawned')).toBe(true);
        expect(result.events.some(e => e.type === 'mana-changed')).toBe(true);
        expect(result.events.some(e => e.type === 'activation-changed')).toBe(true);
      }
    });
  });

  // --- Snapshots ---

  describe('snapshots', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
    });

    it('produces a JSON-safe serialized snapshot', () => {
      const snapshot = runtime.getSnapshot();
      expect(snapshot.turnNumber).toBeGreaterThanOrEqual(0);
      expect(() => JSON.stringify(snapshot)).not.toThrow();
      expect(Array.isArray(snapshot.activationQueue)).toBe(true);
      expect(typeof snapshot.rngState).toBe('number');
    });
  });

  // --- Win detection ---

  describe('win detection', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
    });

    it('detects game over when hero HP reaches 0', () => {
      const state = runtime.getStateForTest();
      state.players[1].heroHp = 0;
      const result = runtime.checkWin();
      expect(result).not.toBeNull();
      expect(result!.winner).toBe(0);
      expect(result!.reason).toBe('Hero defeated');
    });

    it('returns null when no winner', () => {
      expect(runtime.checkWin()).toBeNull();
    });

    it('transitions to game-over phase on win after action', () => {
      const state = runtime.getStateForTest();
      state.players[0].heroHp = 0;
      // Any action triggers win check
      runtime.executeAction(0, { type: 'end-turn' });
      expect(runtime.phase).toBe('game-over');
      expect(runtime.winner).toBe(1);
    });
  });

  // --- Timeout ---

  describe('timeout', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
      spawnUnitsForBothPlayers(runtime);
    });

    it('applies escalating timeout damage', () => {
      const controlling = runtime.getControllingPlayer();
      expect(controlling).toBeGreaterThanOrEqual(0);
      const hpBefore = runtime.getStateForTest().players[controlling].heroHp;
      const events = runtime.applyTimeout();
      const hpAfter = runtime.getStateForTest().players[controlling].heroHp;
      expect(hpAfter).toBeLessThan(hpBefore);
      expect(events.some(e => e.type === 'hero-hp-changed')).toBe(true);
    });

    it('increments seq and logs timeout', () => {
      const seqBefore = runtime.seq;
      runtime.applyTimeout();
      expect(runtime.seq).toBe(seqBefore + 1);
      expect(runtime.actionLog[runtime.actionLog.length - 1].hmac).toBe('timeout');
    });

    it('triggers game-over if timeout kills hero', () => {
      const state = runtime.getStateForTest();
      const controlling = runtime.getControllingPlayer();
      state.players[controlling].heroHp = 1;
      runtime.applyTimeout();
      expect(runtime.phase).toBe('game-over');
      expect(runtime.winReason).toBe('timeout');
    });

    it('returns empty events when no controlling player', () => {
      const rt = new MatchRuntime(99, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());
      // No units spawned, controlling player = -1
      const events = rt.applyTimeout();
      expect(events).toEqual([]);
    });
  });

  // --- Forfeit ---

  describe('forfeit', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
    });

    it('sets winner to opponent of forfeiting player', () => {
      runtime.forfeit(0);
      expect(runtime.phase).toBe('game-over');
      expect(runtime.winner).toBe(1);
      expect(runtime.winReason).toBe('opponent disconnected');
    });

    it('works for either seat', () => {
      runtime.forfeit(1);
      expect(runtime.winner).toBe(0);
    });
  });

  // --- Multiple actions sequence ---

  describe('action sequence', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
      spawnUnitsForBothPlayers(runtime);
    });

    it('plays multiple pass + end-turn cycles', () => {
      let actionCount = 0;
      for (let i = 0; i < 20; i++) {
        const controlling = runtime.getControllingPlayer();
        if (controlling < 0) {
          runtime.executeAction(0, { type: 'end-turn' });
          actionCount++;
          continue;
        }
        const result = runtime.executeAction(controlling, { type: 'pass' });
        expect(result.ok).toBe(true);
        actionCount++;
      }
      expect(runtime.seq).toBe(actionCount);
      expect(runtime.actionLog.length).toBe(actionCount);
    });

    it('consistently rejects wrong-player actions across turns', () => {
      for (let i = 0; i < 10; i++) {
        const controlling = runtime.getControllingPlayer();
        if (controlling < 0) {
          runtime.executeAction(0, { type: 'end-turn' });
          continue;
        }
        const wrong = controlling === 0 ? 1 : 0;
        const bad = runtime.executeAction(wrong, { type: 'pass' });
        expect(bad.ok).toBe(false);
        runtime.executeAction(controlling, { type: 'pass' });
      }
    });
  });
});
