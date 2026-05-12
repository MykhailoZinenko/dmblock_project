import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from '../ConnectionManager';

// ---------------------------------------------------------------------------
// Mock WebSocket — fires onopen synchronously for predictable tests
// ---------------------------------------------------------------------------

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((evt: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    // Fire onopen on next microtick so handlers are wired
    Promise.resolve().then(() => this.onopen?.());
  }

  send(data: string) { this.sent.push(data); }
  close() { this.readyState = MockWebSocket.CLOSED; this.onclose?.(); }
}

// ---------------------------------------------------------------------------
// Mock RTCPeerConnection — bare minimum so createOffer() doesn't crash
// ---------------------------------------------------------------------------

class MockRTCPeerConnection {
  onicecandidate: ((evt: any) => void) | null = null;
  ondatachannel: ((evt: any) => void) | null = null;
  async createOffer() { return { type: 'offer', sdp: 'mock-sdp' }; }
  async createAnswer() { return { type: 'answer', sdp: 'mock-sdp' }; }
  async setLocalDescription(_d: any) {}
  async setRemoteDescription(_d: any) {}
  async addIceCandidate(_c: any) {}
  createDataChannel(_name: string) {
    return {
      readyState: 'connecting',
      onopen: null as any,
      onclose: null as any,
      onmessage: null as any,
      send(_data: string) {},
      close() {},
    };
  }
  close() {}
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let instances: MockWebSocket[] = [];

beforeEach(() => {
  instances = [];
  (globalThis as any).WebSocket = class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      instances.push(this);
    }
  };
  (globalThis as any).WebSocket.OPEN = MockWebSocket.OPEN;
  (globalThis as any).RTCPeerConnection = MockRTCPeerConnection;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConnectionManager', () => {
  it('creates a WebSocket on join', () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toBe('ws://test');
  });

  it('sends join message on ws open', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    const msg = JSON.parse(instances[0].sent[0]);
    expect(msg).toEqual({ type: 'join', duelId: 1, address: '0xAAA' });
  });

  it('emits paired on paired message (playerIndex 1 — no offer)', async () => {
    const cm = new ConnectionManager('ws://test');
    const pairedCb = vi.fn();
    cm.on('paired', pairedCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 1 }) });
    expect(pairedCb).toHaveBeenCalledWith('0xBBB', 1);
    expect(cm.playerIndex).toBe(1);
    expect(cm.opponentAddress).toBe('0xBBB');
  });

  it('playerIndex 0 triggers createOffer + sends sdp-offer', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => {
      const offers = instances[0].sent.filter(s => JSON.parse(s).type === 'sdp-offer');
      expect(offers.length).toBe(1);
    });
  });

  it('handles sdp-answer by setting remote description', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    // First become player 0 to create a peer connection
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    // Then receive an answer — should not throw
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'sdp-answer', sdp: { type: 'answer', sdp: 'test' } }) });
  });

  it('handles ice-candidate', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    // Should not throw
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'ice-candidate', candidate: {} }) });
  });

  it('handles sdp-offer (playerIndex 1 receives offer)', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    // Paired as player 1 (no offer creation)
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 1 }) });
    // Receive an offer
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'sdp-offer', sdp: { type: 'offer', sdp: 'test' } }) });
    await vi.waitFor(() => {
      const answers = instances[0].sent.filter(s => JSON.parse(s).type === 'sdp-answer');
      expect(answers.length).toBe(1);
    });
  });

  it('emits disconnected on opponent-disconnected message', async () => {
    const cm = new ConnectionManager('ws://test');
    const dcCb = vi.fn();
    cm.on('disconnected', dcCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'opponent-disconnected' }) });
    expect(dcCb).toHaveBeenCalled();
  });

  it('emits error on ws error', async () => {
    const cm = new ConnectionManager('ws://test');
    const errCb = vi.fn();
    cm.on('error', errCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances).toHaveLength(1));
    instances[0].onerror?.();
    expect(errCb).toHaveBeenCalled();
  });

  it('emits disconnected on ws close when connected', async () => {
    const cm = new ConnectionManager('ws://test');
    (cm as any)._connected = true;
    const dcCb = vi.fn();
    cm.on('disconnected', dcCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances).toHaveLength(1));
    instances[0].onclose?.();
    expect(dcCb).toHaveBeenCalled();
  });

  it('does not emit disconnected on ws close when not connected', async () => {
    const cm = new ConnectionManager('ws://test');
    const dcCb = vi.fn();
    cm.on('disconnected', dcCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances).toHaveLength(1));
    instances[0].onclose?.();
    expect(dcCb).not.toHaveBeenCalled();
  });

  it('sendToServer sends JSON to ws', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1)); // wait for join
    cm.sendToServer({ type: 'test' });
    expect(instances[0].sent).toHaveLength(2);
    expect(JSON.parse(instances[0].sent[1])).toEqual({ type: 'test' });
  });

  it('send does nothing when no data channel', () => {
    const cm = new ConnectionManager('ws://test');
    expect(() => cm.send({ type: 'deck-hash', hash: 'abc' })).not.toThrow();
  });

  it('disconnect closes connections', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances).toHaveLength(1));
    cm.disconnect();
    expect(cm.connected).toBe(false);
  });

  it('off removes listener', async () => {
    const cm = new ConnectionManager('ws://test');
    const cb = vi.fn();
    cm.on('paired', cb);
    cm.off('paired', cb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    // Use playerIndex 1 to avoid triggering createOffer
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 1 }) });
    expect(cb).not.toHaveBeenCalled();
  });

  it('connected getter defaults to false', () => {
    const cm = new ConnectionManager('ws://test');
    expect(cm.connected).toBe(false);
  });

  it('data channel onopen sets connected and emits connected', async () => {
    const cm = new ConnectionManager('ws://test');
    const connectedCb = vi.fn();
    cm.on('connected', connectedCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    // Become player 0 to trigger createOffer which creates a data channel
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    // Access the internal data channel and trigger onopen
    const dc = (cm as any).dc;
    if (dc) {
      dc.readyState = 'open';
      dc.onopen?.();
      expect(cm.connected).toBe(true);
      expect(connectedCb).toHaveBeenCalled();
    }
  });

  it('data channel onclose emits disconnected', async () => {
    const cm = new ConnectionManager('ws://test');
    const dcCb = vi.fn();
    cm.on('disconnected', dcCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    const dc = (cm as any).dc;
    if (dc) {
      dc.onclose?.();
      expect(cm.connected).toBe(false);
      expect(dcCb).toHaveBeenCalled();
    }
  });

  it('data channel onmessage emits message event', async () => {
    const cm = new ConnectionManager('ws://test');
    const msgCb = vi.fn();
    cm.on('message', msgCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    const dc = (cm as any).dc;
    if (dc) {
      dc.onmessage?.({ data: JSON.stringify({ type: 'deck-hash', hash: 'abc' }) });
      expect(msgCb).toHaveBeenCalledWith({ type: 'deck-hash', hash: 'abc' });
    }
  });

  it('data channel ignores malformed messages', async () => {
    const cm = new ConnectionManager('ws://test');
    const msgCb = vi.fn();
    cm.on('message', msgCb);
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    const dc = (cm as any).dc;
    if (dc) {
      dc.onmessage?.({ data: 'not json{{{' });
      expect(msgCb).not.toHaveBeenCalled();
    }
  });

  it('send sends data via open data channel', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    const dc = (cm as any).dc;
    if (dc) {
      dc.readyState = 'open';
      const dcSent: string[] = [];
      dc.send = (data: string) => dcSent.push(data);
      cm.send({ type: 'deck-hash', hash: 'test123' });
      expect(dcSent).toHaveLength(1);
      expect(JSON.parse(dcSent[0])).toEqual({ type: 'deck-hash', hash: 'test123' });
    }
  });

  it('sendToServer does nothing when ws not OPEN', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].readyState = MockWebSocket.CLOSED;
    cm.sendToServer({ type: 'test' });
    expect(instances[0].sent).toHaveLength(1); // only the join message
  });

  it('ice-candidate from peer connection is forwarded', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    const pc = (cm as any).pc;
    if (pc && pc.onicecandidate) {
      pc.onicecandidate({ candidate: { type: 'candidate', candidate: 'test' } });
      const iceMsgs = instances[0].sent.filter(s => JSON.parse(s).type === 'ice-candidate');
      expect(iceMsgs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('ice-candidate with null candidate is ignored', async () => {
    const cm = new ConnectionManager('ws://test');
    cm.join(1, '0xAAA');
    await vi.waitFor(() => expect(instances[0].sent).toHaveLength(1));
    instances[0].onmessage?.({ data: JSON.stringify({ type: 'paired', opponent: '0xBBB', playerIndex: 0 }) });
    await vi.waitFor(() => instances[0].sent.length >= 2);
    const sentBefore = instances[0].sent.length;
    const pc = (cm as any).pc;
    if (pc && pc.onicecandidate) {
      pc.onicecandidate({ candidate: null });
      expect(instances[0].sent.length).toBe(sentBefore);
    }
  });
});
