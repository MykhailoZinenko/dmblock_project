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

    it('accepts end-turn during initiative phase', () => {
      // Pass through all activations to reach queue exhaustion, which triggers end-turn internally
      // Or just pass until we're in initiative phase
      let safety = 0;
      while (runtime.getTurnPhase().type === 'priority' && safety < 10) {
        runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' });
        safety++;
      }
      const result = runtime.executeAction(runtime.getControllingPlayer(), { type: 'end-turn' });
      expect(result.ok).toBe(true);
      expect(result.events.some(e => e.type === 'turn-changed')).toBe(true);
      expect(result.events.some(e => e.type === 'queue-rebuilt')).toBe(true);
      expect(result.events.some(e => e.type === 'mana-changed')).toBe(true);
    });

    it('rejects end-turn during priority phase', () => {
      // At start with units spawned, we're in priority or initiative
      // Create a fresh runtime with no units to test priority
      const rt = new MatchRuntime(99, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());
      // No units spawned, should be in priority phase
      if (rt.getTurnPhase().type === 'priority') {
        const result = rt.executeAction(rt.getControllingPlayer(), { type: 'end-turn' });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('priority');
      }
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
      // Any action triggers win check — use pass which is always valid
      const controlling = runtime.getControllingPlayer();
      runtime.executeAction(controlling, { type: 'pass' });
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

    it('applies timeout during priority phase', () => {
      const rt = new MatchRuntime(99, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());
      // No units spawned — should be in priority phase
      expect(rt.getTurnPhase().type).toBe('priority');
      const controlling = rt.getControllingPlayer();
      const hpBefore = rt.getStateForTest().players[controlling].heroHp;
      const events = rt.applyTimeout();
      expect(events.some(e => e.type === 'hero-hp-changed')).toBe(true);
      expect(rt.getStateForTest().players[controlling].heroHp).toBeLessThan(hpBefore);
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

  // --- Priority phase ---

  describe('priority phase', () => {
    it('starts in priority phase when no units on board', () => {
      const rt = new MatchRuntime(50, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());
      expect(rt.getTurnPhase().type).toBe('priority');
    });

    it('stays in priority if both pass without spawning (new turn, still no units)', () => {
      const rt = new MatchRuntime(50, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());

      const first = rt.getControllingPlayer();
      rt.executeAction(first, { type: 'pass' });
      const second = rt.getControllingPlayer();
      rt.executeAction(second, { type: 'pass' });

      // Both passed with 0 units → turn advances → priority again (still no units)
      expect(rt.getTurnPhase().type).toBe('priority');
      expect(rt.getStateForTest().turnNumber).toBeGreaterThan(1);
    });

    it('transitions to initiative after both players spawn', () => {
      const rt = new MatchRuntime(50, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());

      // Spawn units for both
      const cp1 = rt.getControllingPlayer();
      const state = rt.getStateForTest();
      state.players[cp1].mana = 99;
      const unitCard = cardRegistry.find(c => c.cardType === CardType.UNIT)!;
      state.players[cp1].hand.push(unitCard.id);
      const col1 = cp1 === 0 ? 0 : 14;
      rt.executeAction(cp1, { type: 'spawn', playerId: cp1, cardId: unitCard.id, col: col1, row: 0 });

      const cp2 = rt.getControllingPlayer();
      state.players[cp2].mana = 99;
      state.players[cp2].hand.push(unitCard.id);
      const col2 = cp2 === 0 ? 0 : 14;
      rt.executeAction(cp2, { type: 'spawn', playerId: cp2, cardId: unitCard.id, col: col2, row: 0 });

      // After both spawn, should transition through initiative → queue exhausted → new turn
      // New turn: both have units, so initiative phase
      expect(rt.getTurnPhase().type).not.toBe('priority');
    });

    it('rejects move/attack/end-turn during priority phase', () => {
      const rt = new MatchRuntime(50, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());
      const cp = rt.getControllingPlayer();

      expect(rt.executeAction(cp, { type: 'move', unitUid: 1, col: 5, row: 5 }).ok).toBe(false);
      expect(rt.executeAction(cp, { type: 'attack', attackerUid: 1, targetUid: 2 }).ok).toBe(false);
      expect(rt.executeAction(cp, { type: 'attack-hero', attackerUid: 1, targetPlayerId: 1 }).ok).toBe(false);
      expect(rt.executeAction(cp, { type: 'end-turn' }).ok).toBe(false);
    });

    it('allows cast during priority and counts as priority used', () => {
      const rt = new MatchRuntime(50, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());
      expect(rt.getTurnPhase().type).toBe('priority');

      const cp = rt.getControllingPlayer();
      const state = rt.getStateForTest();
      state.players[cp].mana = 99;

      // Find a spell card and put it in hand
      const spellCard = cardRegistry.find(c => c.cardType !== CardType.UNIT);
      if (!spellCard) return; // skip if no spells in registry
      state.players[cp].hand.push(spellCard.id);

      // Find a valid target (enemy unit needed for single-target spells, or just a hex for AOE)
      // Cast may fail validation if no valid target, but the point is it's not rejected for "priority phase"
      const result = rt.executeAction(cp, {
        type: 'cast', playerId: cp, cardId: spellCard.id, col: 7, row: 5,
      });
      // If the cast fails, it should be for game reasons (no target, etc.), not "Cannot cast during priority"
      if (!result.ok) {
        expect(result.reason).not.toContain('priority');
      }
    });

    it('spawning during priority rebuilds queue', () => {
      const rt = new MatchRuntime(50, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());

      const cp = rt.getControllingPlayer();
      const state = rt.getStateForTest();
      state.players[cp].mana = 99;
      // Find a unit card in hand (hand may contain spells)
      const unitCardId = state.players[cp].hand.find(id => {
        const c = cardRegistry.find(x => x.id === id);
        return c && c.cardType === CardType.UNIT;
      });
      if (unitCardId === undefined) {
        // Force a unit card into hand
        const unitCard = cardRegistry.find(c => c.cardType === CardType.UNIT)!;
        state.players[cp].hand.push(unitCard.id);
      }
      const cardId = unitCardId ?? cardRegistry.find(c => c.cardType === CardType.UNIT)!.id;
      const col = cp === 0 ? 0 : 14;

      const result = rt.executeAction(cp, {
        type: 'spawn', playerId: cp, cardId, col, row: 0,
      });
      expect(result.ok).toBe(true);
      expect(result.events.some(e => e.type === 'queue-rebuilt')).toBe(true);
    });

    it('prevents spawning for the other player', () => {
      const rt = new MatchRuntime(50, '0xA', '0xB');
      rt.submitDeck(0, validDeck());
      rt.submitDeck(1, validDeck());
      const cp = rt.getControllingPlayer();
      const other = cp === 0 ? 1 : 0;

      const result = rt.executeAction(cp, {
        type: 'spawn', playerId: other, cardId: 0, col: 0, row: 0,
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('other player');
    });
  });

  // --- Per-seat snapshots ---

  describe('per-seat snapshots', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
    });

    it('hides opponent hand and deck from each seat', () => {
      const snap0 = runtime.getSnapshotForSeat(0);
      const snap1 = runtime.getSnapshotForSeat(1);

      // Seat 0 doesn't see seat 1's cards
      expect(snap0.players[1].hand).toEqual([]);
      expect(snap0.players[1].deck).toEqual([]);
      // Seat 1 doesn't see seat 0's cards
      expect(snap1.players[0].hand).toEqual([]);
      expect(snap1.players[0].deck).toEqual([]);
    });

    it('each seat sees their own hand', () => {
      const snap0 = runtime.getSnapshotForSeat(0);
      const snap1 = runtime.getSnapshotForSeat(1);
      const full = runtime.getSnapshot();

      expect(snap0.players[0].hand).toEqual(full.players[0].hand);
      expect(snap1.players[1].hand).toEqual(full.players[1].hand);
    });

    it('hides RNG state', () => {
      const snap = runtime.getSnapshotForSeat(0);
      expect(snap.rngState).toBe(0);
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
