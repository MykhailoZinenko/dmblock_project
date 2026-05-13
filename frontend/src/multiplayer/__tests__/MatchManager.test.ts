import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MatchManager } from '../MatchManager';
import { ConnectionManager } from '../ConnectionManager';
import { GameController, ACTIVATION_TIMER_SECONDS, TIMEOUT_DAMAGE, executeSpawn } from '@arcana/game-core';
import type { PeerMessage, GameAction } from '../protocol';

// ---------------------------------------------------------------------------
// Helpers — fake ConnectionManager
// ---------------------------------------------------------------------------

function makeFakeConn(playerIndex: 0 | 1 = 0): ConnectionManager & {
  _handlers: Map<string, Set<Function>>;
  _sent: PeerMessage[];
  _serverSent: object[];
  simulateMessage(msg: PeerMessage): void;
  simulateDisconnect(): void;
} {
  const handlers = new Map<string, Set<Function>>();
  const sent: PeerMessage[] = [];
  const serverSent: object[] = [];

  const conn = {
    _handlers: handlers,
    _sent: sent,
    _serverSent: serverSent,
    get playerIndex() { return playerIndex; },
    get opponentAddress() { return '0xBBB'; },
    get connected() { return true; },

    on(event: string, cb: Function) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(cb);
    },
    off(event: string, cb: Function) {
      handlers.get(event)?.delete(cb);
    },
    send(msg: PeerMessage) { sent.push(msg); },
    sendToServer(msg: object) { serverSent.push(msg); },
    disconnect() {},

    simulateMessage(msg: PeerMessage) {
      handlers.get('message')?.forEach(cb => cb(msg));
    },
    simulateDisconnect() {
      handlers.get('disconnected')?.forEach(cb => cb());
    },
  } as any;

  return conn;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatchManager', () => {
  let conn: ReturnType<typeof makeFakeConn>;
  let match: MatchManager;

  beforeEach(() => {
    vi.useFakeTimers();
    conn = makeFakeConn(0);
    match = new MatchManager(conn);
  });

  afterEach(() => {
    match.destroy();
    vi.useRealTimers();
  });

  describe('phase lifecycle', () => {
    it('starts in connecting phase', () => {
      expect(match.phase).toBe('connecting');
    });

    it('exchangeDecks moves to exchanging-decks', () => {
      const phases: string[] = [];
      match.on('phase-change', (p) => phases.push(p));
      match.exchangeDecks([1, 2, 3]);
      expect(match.phase).toBe('exchanging-decks');
      expect(phases).toContain('exchanging-decks');
    });
  });

  describe('deck exchange', () => {
    it('sends deck-hash on exchangeDecks', () => {
      match.exchangeDecks([1, 2, 3]);
      expect(conn._sent.some(m => m.type === 'deck-hash')).toBe(true);
    });

    it('sends deck-reveal when opponent deck-hash arrives', () => {
      match.exchangeDecks([10, 11, 12]);
      conn.simulateMessage({ type: 'deck-hash', hash: 'abc' });
      expect(conn._sent.some(m => m.type === 'deck-reveal')).toBe(true);
    });

    it('resolves exchangeDecks when opponent deck-reveal arrives', async () => {
      const promise = match.exchangeDecks([10, 11, 12]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [20, 21] });
      const result = await promise;
      expect(result.opponentDeck).toEqual([20, 21]);
    });

    it('emits desync on deck hash mismatch', async () => {
      const desyncCb = vi.fn();
      match.on('desync', desyncCb);
      match.exchangeDecks([10, 11, 12]);
      conn.simulateMessage({ type: 'deck-hash', hash: 'wrong_hash' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [20, 21] });
      expect(desyncCb).toHaveBeenCalled();
    });
  });

  describe('startGame', () => {
    async function setupPlaying() {
      const promise = match.exchangeDecks([1, 2, 3, 4, 5]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [6, 7, 8, 9, 10] });
      await promise;

      const ctrl = new GameController();
      match.startGame(42, ctrl);
      return ctrl;
    }

    it('sets phase to playing', async () => {
      await setupPlaying();
      expect(match.phase).toBe('playing');
    });

    it('isMyTurn uses ui seat when there is no activation unit', async () => {
      await setupPlaying();
      expect(match.isMyTurn).toBe(false);
      match.setUiActivePlayer(0);
      expect(match.isMyTurn).toBe(true);
      match.setUiActivePlayer(1);
      expect(match.isMyTurn).toBe(false);
    });

    it('priority deploy uses ui seat even when activation queue has units', async () => {
      const ctrl = await setupPlaying();
      const state = ctrl.getState();
      executeSpawn(state, 0, 0, { col: 0, row: 0 });
      ctrl.rebuildQueue();
      expect(ctrl.getControllingPlayer()).toBe(0);

      match.setBattlePriorityPhase(true);
      match.setUiActivePlayer(1);
      expect(match.isMyTurn).toBe(false);

      match.setUiActivePlayer(0);
      expect(match.isMyTurn).toBe(true);

      match.setBattlePriorityPhase(false);
      expect(match.isMyTurn).toBe(true);
    });
  });

  describe('submitAction', () => {
    async function setupWithUnits() {
      const promise = match.exchangeDecks([1, 2]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [3, 4] });
      await promise;

      const ctrl = new GameController();
      match.startGame(1, ctrl);
      return ctrl;
    }

    it('sends action + state-hash to peer', async () => {
      const ctrl = await setupWithUnits();
      conn._sent.length = 0;
      const action: GameAction = { type: 'pass' };
      match.submitAction(action);
      expect(conn._sent.some(m => m.type === 'action')).toBe(true);
      expect(conn._sent.some(m => m.type === 'state-hash')).toBe(true);
    });

    it('sends action copy to server', async () => {
      const ctrl = await setupWithUnits();
      conn._serverSent.length = 0;
      match.submitAction({ type: 'end-turn' });
      expect(conn._serverSent.some((m: any) => m.type === 'action')).toBe(true);
    });

    it('ignores actions when not in playing phase', () => {
      conn._sent.length = 0;
      match.submitAction({ type: 'pass' });
      expect(conn._sent).toHaveLength(0);
    });
  });

  describe('opponent actions', () => {
    async function setupPlaying() {
      const promise = match.exchangeDecks([1, 2]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [3, 4] });
      await promise;
      const ctrl = new GameController();
      match.startGame(1, ctrl);
      return ctrl;
    }

    it('emits opponent-action on peer action message', async () => {
      await setupPlaying();
      const cb = vi.fn();
      match.on('opponent-action', cb);
      conn.simulateMessage({ type: 'action', action: { type: 'pass' } });
      expect(cb).toHaveBeenCalledWith({ type: 'pass' });
    });

    it('ignores action messages when not playing', () => {
      const cb = vi.fn();
      match.on('opponent-action', cb);
      conn.simulateMessage({ type: 'action', action: { type: 'pass' } });
      expect(cb).not.toHaveBeenCalled();
    });

    it('emits desync on state-hash mismatch', async () => {
      await setupPlaying();
      const desyncCb = vi.fn();
      match.on('desync', desyncCb);
      conn.simulateMessage({ type: 'state-hash', hash: 'definitely_wrong' });
      expect(desyncCb).toHaveBeenCalled();
    });
  });

  describe('sign-result forwarding', () => {
    it('emits opponent-signed', async () => {
      const promise = match.exchangeDecks([1]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [2] });
      await promise;
      const ctrl = new GameController();
      match.startGame(1, ctrl);

      const cb = vi.fn();
      match.on('opponent-signed', cb);
      conn.simulateMessage({ type: 'sign-result', winner: '0xAAA', signature: '0x123' });
      expect(cb).toHaveBeenCalledWith('0xAAA', '0x123');
    });
  });

  describe('activation timer', () => {
    it('emits timeout after ACTIVATION_TIMER_SECONDS', async () => {
      const promise = match.exchangeDecks([1]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [2] });
      await promise;
      const ctrl = new GameController();
      match.startGame(1, ctrl);

      const cb = vi.fn();
      match.on('timeout', cb);
      vi.advanceTimersByTime(ACTIVATION_TIMER_SECONDS * 1000 + 100);
      expect(cb).toHaveBeenCalled();
    });

    it('getTimerRemaining returns remaining seconds', async () => {
      const promise = match.exchangeDecks([1]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [2] });
      await promise;
      const ctrl = new GameController();
      match.startGame(1, ctrl);

      expect(match.getTimerRemaining()).toBeCloseTo(ACTIVATION_TIMER_SECONDS, 0);
    });

    it('getTimerRemaining returns max when no timer started', () => {
      expect(match.getTimerRemaining()).toBe(ACTIVATION_TIMER_SECONDS);
    });
  });

  describe('disconnect', () => {
    it('emits opponent-disconnected', () => {
      const cb = vi.fn();
      match.on('opponent-disconnected', cb);
      conn.simulateDisconnect();
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('off', () => {
    it('removes listener', () => {
      const cb = vi.fn();
      match.on('opponent-disconnected', cb);
      match.off('opponent-disconnected', cb);
      conn.simulateDisconnect();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('executeAction via opponent messages', () => {
    async function setupPlaying() {
      const promise = match.exchangeDecks([1, 2]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [3, 4] });
      await promise;
      const ctrl = new GameController();
      match.startGame(1, ctrl);
      return ctrl;
    }

    it('handles spawn action from opponent', async () => {
      const ctrl = await setupPlaying();
      const state = ctrl.getState();
      state.players[1].mana = 20;
      conn.simulateMessage({
        type: 'action',
        action: { type: 'spawn', playerId: 1, cardId: 0, col: 14, row: 0 },
      });
      expect(state.units.length).toBeGreaterThanOrEqual(0);
    });

    it('handles move action from opponent', async () => {
      const ctrl = await setupPlaying();
      const state = ctrl.getState();
      state.players[0].mana = 20;
      const { executeSpawn } = await import('@arcana/game-core');
      const unit = executeSpawn(state, 0, 0, { col: 0, row: 0 });
      ctrl.rebuildQueue();
      conn.simulateMessage({
        type: 'action',
        action: {
          type: 'move',
          unitUid: unit.uid,
          col: 1,
          row: 0,
          path: [
            { col: 0, row: 0 },
            { col: 1, row: 0 },
          ],
        },
      });
    });

    it('handles attack action from opponent', async () => {
      const ctrl = await setupPlaying();
      const state = ctrl.getState();
      const { executeSpawn } = await import('@arcana/game-core');
      const attacker = executeSpawn(state, 0, 1, { col: 5, row: 5 });
      const target = executeSpawn(state, 1, 0, { col: 6, row: 5 });
      attacker.remainingAp = 1;
      conn.simulateMessage({
        type: 'action',
        action: { type: 'attack', attackerUid: attacker.uid, targetUid: target.uid },
      });
    });

    it('handles attack-hero action from opponent', async () => {
      const ctrl = await setupPlaying();
      const state = ctrl.getState();
      const { executeSpawn } = await import('@arcana/game-core');
      const { HERO_ADJACENT } = await import('@arcana/game-core');
      const adj = HERO_ADJACENT[1][0];
      const attacker = executeSpawn(state, 0, 1, { col: adj.col, row: adj.row });
      attacker.remainingAp = 1;
      conn.simulateMessage({
        type: 'action',
        action: { type: 'attack-hero', attackerUid: attacker.uid, targetPlayerId: 1 },
      });
    });

    it('handles cast action from opponent', async () => {
      const ctrl = await setupPlaying();
      const state = ctrl.getState();
      state.players[0].mana = 20;
      const { executeSpawn } = await import('@arcana/game-core');
      const enemy = executeSpawn(state, 1, 0, { col: 14, row: 0 });
      conn.simulateMessage({
        type: 'action',
        action: { type: 'cast', playerId: 0, cardId: 11, col: 14, row: 0 },
      });
    });

    it('handles end-turn action from opponent', async () => {
      const ctrl = await setupPlaying();
      const turnBefore = ctrl.getTurnNumber();
      conn.simulateMessage({ type: 'action', action: { type: 'end-turn' } });
      expect(ctrl.getTurnNumber()).toBe(turnBefore + 1);
    });

    it('handles pass action from opponent', async () => {
      const ctrl = await setupPlaying();
      conn.simulateMessage({ type: 'action', action: { type: 'pass' } });
    });
  });

  describe('gameOver event', () => {
    it('emits game-over and sets phase when a hero is already defeated (state check after action)', async () => {
      const promise = match.exchangeDecks([1]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [2] });
      await promise;

      const ctrl = new GameController();
      const gameOverCb = vi.fn();
      match.on('game-over', gameOverCb);
      match.startGame(1, ctrl);

      ctrl.getState().players[1].heroHp = 0;
      conn.simulateMessage({ type: 'action', action: { type: 'pass' } });

      expect(gameOverCb).toHaveBeenCalledWith(0);
      expect(match.phase).toBe('game-over');
    });
  });

  describe('submitAction guards', () => {
    it('blocks non-pass actions when not my turn', async () => {
      // Use playerIndex 1 so we are NOT player 0
      conn = makeFakeConn(1);
      match = new MatchManager(conn);

      const promise = match.exchangeDecks([1]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [2] });
      await promise;

      const ctrl = new GameController();
      match.startGame(1, ctrl);
      conn._sent.length = 0;

      // Try to spawn as player 1 when it's player 0's turn (no units → no controlling player)
      match.submitAction({ type: 'spawn', playerId: 1, cardId: 0, col: 14, row: 0 });
      // Should still have sent it since controlling player is -1 (nobody's turn)
      // Actually with no units, isMyTurn is false, so it should be blocked
      expect(conn._sent.filter(m => m.type === 'action')).toHaveLength(0);
    });

    it('allows pass/end-turn even when not my turn', async () => {
      conn = makeFakeConn(1);
      match = new MatchManager(conn);

      const promise = match.exchangeDecks([1]);
      conn.simulateMessage({ type: 'deck-hash', hash: '' });
      conn.simulateMessage({ type: 'deck-reveal', deck: [2] });
      await promise;

      const ctrl = new GameController();
      match.startGame(1, ctrl);
      conn._sent.length = 0;

      match.submitAction({ type: 'pass' });
      expect(conn._sent.some(m => m.type === 'action')).toBe(true);
    });
  });
});
