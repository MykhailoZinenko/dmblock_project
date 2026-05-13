import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerConnection } from '../ServerConnection';

// --- Mock WebSocket ---

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(_url: string) {
    queueMicrotask(() => this.onopen?.());
  }

  send(data: string) { this.sent.push(data); }
  close() { this.readyState = MockWebSocket.CLOSED; this.onclose?.(); }

  receive(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

let lastMockWs: MockWebSocket | null = null;
vi.stubGlobal('WebSocket', class extends MockWebSocket {
  constructor(url: string) {
    super(url);
    lastMockWs = this;
  }
});

// --- Tests ---

describe('ServerConnection', () => {
  let conn: ServerConnection;
  let mockWs: MockWebSocket;

  beforeEach(async () => {
    lastMockWs = null;
    conn = new ServerConnection('ws://localhost:3001', 1, '0xTestAddr');
    await vi.waitFor(() => { if (!lastMockWs) throw new Error('ws not created'); });
    mockWs = lastMockWs!;
    // Wait for onopen → join message
    await vi.waitFor(() => { if (mockWs.sent.length === 0) throw new Error('no join'); });
  });

  // --- Connection ---

  describe('connection', () => {
    it('sends join on connect', () => {
      expect(mockWs.sent.length).toBe(1);
      const msg = JSON.parse(mockWs.sent[0]);
      expect(msg.type).toBe('join');
      expect(msg.duelId).toBe(1);
      expect(msg.address).toBe('0xTestAddr');
    });

    it('starts in connecting state', () => {
      // After join sent, state is still connecting until auth-challenge
      // (onopen triggers join, but state transitions on server response)
      expect(conn.state).toBe('connecting');
    });

    it('transitions to disconnected on ws close', () => {
      mockWs.close();
      expect(conn.state).toBe('disconnected');
    });

    it('emits error on ws error', () => {
      const handler = vi.fn();
      conn.on('error', handler);
      mockWs.onerror?.();
      expect(handler).toHaveBeenCalledWith('WebSocket connection error');
    });
  });

  // --- Auth flow ---

  describe('auth flow', () => {
    it('transitions to authenticating on auth-challenge', () => {
      const handler = vi.fn();
      conn.on('auth-challenge', handler);
      mockWs.receive({ type: 'auth-challenge', nonce: '0xabc123' });
      expect(conn.state).toBe('authenticating');
      expect(handler).toHaveBeenCalledWith('0xabc123');
    });

    it('transitions to waiting on auth-ok', () => {
      mockWs.receive({ type: 'auth-ok', sessionStart: Date.now() });
      expect(conn.state).toBe('waiting');
    });

    it('transitions to waiting on waiting-for-opponent', () => {
      mockWs.receive({ type: 'waiting-for-opponent' });
      expect(conn.state).toBe('waiting');
    });
  });

  // --- Match lifecycle ---

  describe('match lifecycle', () => {
    it('transitions to playing on match-started', () => {
      const handler = vi.fn();
      conn.on('match-started', handler);
      mockWs.receive({
        type: 'match-started',
        seat: 0,
        opponent: '0xOpp',
        state: { turnNumber: 1, players: [] },
        seq: 0,
      });
      expect(conn.state).toBe('playing');
      expect(conn.seat).toBe(0);
      expect(handler).toHaveBeenCalled();
    });

    it('emits action-confirmed', () => {
      const handler = vi.fn();
      conn.on('action-confirmed', handler);
      mockWs.receive({
        type: 'action-confirmed',
        seq: 1,
        action: { type: 'pass' },
        events: [{ type: 'activation-changed', uid: null }],
        stateHash: 'abc',
        controllingPlayer: 0,
      });
      expect(handler).toHaveBeenCalledWith(
        1, { type: 'pass' }, [{ type: 'activation-changed', uid: null }], 'abc', 0,
      );
    });

    it('emits action-rejected', () => {
      const handler = vi.fn();
      conn.on('action-rejected', handler);
      mockWs.receive({ type: 'action-rejected', seq: 1, reason: 'not your turn' });
      expect(handler).toHaveBeenCalledWith(1, 'not your turn');
    });

    it('emits game-over and transitions state', () => {
      const handler = vi.fn();
      conn.on('game-over', handler);
      mockWs.receive({ type: 'game-over', winner: 0, reason: 'Hero defeated' });
      expect(conn.state).toBe('game-over');
      expect(handler).toHaveBeenCalledWith(0, 'Hero defeated');
    });

    it('does not transition to disconnected after game-over', () => {
      mockWs.receive({ type: 'game-over', winner: 0, reason: 'Hero defeated' });
      mockWs.close();
      expect(conn.state).toBe('game-over');
    });
  });

  // --- Deck submission ---

  describe('deck submission', () => {
    it('sends submit-deck message', () => {
      conn.submitDeck([0, 1, 2, 3]);
      const msg = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);
      expect(msg.type).toBe('submit-deck');
      expect(msg.deck).toEqual([0, 1, 2, 3]);
    });
  });

  // --- Opponent events ---

  describe('opponent events', () => {
    it('emits opponent-disconnected', () => {
      const handler = vi.fn();
      conn.on('opponent-disconnected', handler);
      mockWs.receive({ type: 'opponent-disconnected' });
      expect(handler).toHaveBeenCalled();
    });

    it('emits opponent-reconnected', () => {
      const handler = vi.fn();
      conn.on('opponent-reconnected', handler);
      mockWs.receive({ type: 'opponent-reconnected' });
      expect(handler).toHaveBeenCalled();
    });
  });

  // --- Settlement ---

  describe('settlement', () => {
    it('emits sign-request', () => {
      const handler = vi.fn();
      conn.on('sign-request', handler);
      mockWs.receive({ type: 'sign-request', duelId: 1, winner: '0xWinner' });
      expect(handler).toHaveBeenCalledWith(1, '0xWinner');
    });

    it('sends sign-result', () => {
      conn.sendSignResult(1, '0xWinner', '0xSig');
      const msg = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);
      expect(msg.type).toBe('sign-result');
      expect(msg.duelId).toBe(1);
      expect(msg.winner).toBe('0xWinner');
      expect(msg.signature).toBe('0xSig');
    });
  });

  // --- State snapshots ---

  describe('state snapshots', () => {
    it('emits state-snapshot', () => {
      const handler = vi.fn();
      conn.on('state-snapshot', handler);
      const state = { turnNumber: 5, players: [] };
      mockWs.receive({ type: 'state-snapshot', state, seq: 10 });
      expect(handler).toHaveBeenCalledWith(state, 10);
    });

    it('emits turn-timeout', () => {
      const handler = vi.fn();
      conn.on('turn-timeout', handler);
      mockWs.receive({ type: 'turn-timeout', player: 0, damage: 3 });
      expect(handler).toHaveBeenCalledWith(0, 3);
    });
  });

  // --- Disconnect ---

  describe('disconnect', () => {
    it('closes the websocket', () => {
      conn.disconnect();
      expect(mockWs.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('emits state-change to disconnected', () => {
      const states: string[] = [];
      conn.on('state-change', (s) => states.push(s));
      conn.disconnect();
      expect(states).toContain('disconnected');
    });
  });

  // --- Event emitter ---

  describe('event emitter', () => {
    it('off removes listener', () => {
      const handler = vi.fn();
      conn.on('error', handler);
      conn.off('error', handler);
      mockWs.receive({ type: 'error', message: 'test' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      conn.on('error', h1);
      conn.on('error', h2);
      mockWs.receive({ type: 'error', message: 'test' });
      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });
  });

  // --- Request log ---

  describe('request-log', () => {
    it('sends request-log message', () => {
      conn.requestLog();
      const msg = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);
      expect(msg.type).toBe('request-log');
    });

    it('emits action-log when server responds', () => {
      const handler = vi.fn();
      conn.on('action-log', handler);
      const actions = [{ seq: 1, action: { type: 'pass' }, hmac: 'abc', timestamp: 123 }];
      mockWs.receive({
        type: 'action-log',
        sessionSignatures: ['0xSig0', '0xSig1'],
        actions,
      });
      expect(handler).toHaveBeenCalledWith(['0xSig0', '0xSig1'], actions);
    });
  });

  // --- sendAction ---

  describe('sendAction', () => {
    it('does nothing without session key (not authenticated)', async () => {
      const sentBefore = mockWs.sent.length;
      await conn.sendAction({ type: 'pass' });
      expect(mockWs.sent.length).toBe(sentBefore);
    });

    it('sends action with seq and hmac after authentication', async () => {
      // Manually set session key via authenticate
      const mockSignTypedData = vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65));
      await conn.authenticate(mockSignTypedData, '0x' + 'cd'.repeat(32));

      await conn.sendAction({ type: 'pass' });
      const msg = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);
      expect(msg.type).toBe('action');
      expect(msg.action).toEqual({ type: 'pass' });
      expect(msg.seq).toBe(1);
      expect(typeof msg.hmac).toBe('string');
      expect(msg.hmac.length).toBe(64);
    });

    it('increments seq on each action', async () => {
      const mockSignTypedData = vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65));
      await conn.authenticate(mockSignTypedData, '0x' + 'cd'.repeat(32));

      await conn.sendAction({ type: 'pass' });
      await conn.sendAction({ type: 'end-turn' });
      const msg1 = JSON.parse(mockWs.sent[mockWs.sent.length - 2]);
      const msg2 = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);
      expect(msg1.seq).toBe(1);
      expect(msg2.seq).toBe(2);
    });

    it('produces different HMACs for different actions', async () => {
      const mockSignTypedData = vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65));
      await conn.authenticate(mockSignTypedData, '0x' + 'cd'.repeat(32));

      await conn.sendAction({ type: 'pass' });
      await conn.sendAction({ type: 'end-turn' });
      const msg1 = JSON.parse(mockWs.sent[mockWs.sent.length - 2]);
      const msg2 = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);
      expect(msg1.hmac).not.toBe(msg2.hmac);
    });
  });

  // --- authenticate ---

  describe('authenticate', () => {
    it('calls signTypedData with correct domain and types', async () => {
      const mockSignTypedData = vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65));
      await conn.authenticate(mockSignTypedData, '0x' + 'cd'.repeat(32));
      expect(mockSignTypedData).toHaveBeenCalledOnce();
      const call = mockSignTypedData.mock.calls[0][0];
      expect(call.domain.name).toBe('Arcana Arena');
      expect(call.domain.chainId).toBe(31337);
      expect(call.primaryType).toBe('Session');
      expect(call.message.duelId).toBe(BigInt(1));
      expect(call.message.player).toBe('0xTestAddr');
    });

    it('sends auth message to server', async () => {
      const mockSignTypedData = vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65));
      await conn.authenticate(mockSignTypedData, '0x' + 'cd'.repeat(32));
      const msg = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);
      expect(msg.type).toBe('auth');
      expect(msg.signature).toBe('0x' + 'ab'.repeat(65));
      expect(msg.nonce).toBe('0x' + 'cd'.repeat(32));
      expect(typeof msg.expiresAt).toBe('number');
    });
  });
});
