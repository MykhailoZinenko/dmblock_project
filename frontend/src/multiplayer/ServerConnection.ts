import { canonicalizeAction } from '@server/protocol';
import type {
  GameAction, ServerMessage, ClientMessage,
  MatchEvent, SerializedGameState, ActionLogEntry,
} from '@server/protocol';

export type ConnectionState =
  | 'connecting'
  | 'authenticating'
  | 'waiting'
  | 'playing'
  | 'game-over'
  | 'disconnected';

type EventMap = {
  'state-change': [state: ConnectionState];
  'auth-challenge': [nonce: string];
  'match-started': [state: SerializedGameState, seat: 0 | 1, opponent: string, seq: number];
  'action-confirmed': [seq: number, action: GameAction, events: MatchEvent[], stateHash: string];
  'action-rejected': [seq: number, reason: string];
  'state-snapshot': [state: SerializedGameState, seq: number];
  'turn-timeout': [player: number, damage: number];
  'game-over': [winner: number, reason: string];
  'sign-request': [duelId: number, winner: string];
  'action-log': [sessionSignatures: [string, string], actions: ActionLogEntry[]];
  'opponent-disconnected': [];
  'opponent-reconnected': [];
  'error': [message: string];
};

type EventKey = keyof EventMap;

const SESSION_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);

const SESSION_DOMAIN = {
  name: 'Arcana Arena',
  chainId: SESSION_CHAIN_ID,
} as const;

const SESSION_TYPES = {
  Session: [
    { name: 'duelId', type: 'uint256' },
    { name: 'player', type: 'address' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'expiresAt', type: 'uint256' },
  ],
} as const;

export class ServerConnection {
  private ws: WebSocket | null = null;
  private _state: ConnectionState = 'connecting';
  private _seat: 0 | 1 = 0;
  private _seq = 0;
  private listeners = new Map<string, Set<Function>>();
  private sessionKey: CryptoKey | null = null;
  private readonly duelId: number;
  private readonly address: string;

  constructor(url: string, duelId: number, address: string) {
    this.duelId = duelId;
    this.address = address;
    this.connect(url);
  }

  get state(): ConnectionState { return this._state; }
  get seat(): 0 | 1 { return this._seat; }

  private connect(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.sendRaw({ type: 'join', duelId: this.duelId, address: this.address });
    };
    this.ws.onmessage = (event) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      this.handleMessage(msg);
    };
    this.ws.onclose = () => {
      if (this._state !== 'game-over') {
        this.setState('disconnected');
      }
    };
    this.ws.onerror = () => {
      this.emit('error', 'WebSocket connection error');
    };
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'auth-challenge':
        this.setState('authenticating');
        this.emit('auth-challenge', msg.nonce);
        break;
      case 'auth-ok':
        this.setState('waiting');
        break;
      case 'waiting-for-opponent':
        this.setState('waiting');
        break;
      case 'match-started':
        this._seat = msg.seat;
        this.setState('playing');
        this.emit('match-started', msg.state, msg.seat, msg.opponent, msg.seq);
        break;
      case 'action-confirmed':
        this.emit('action-confirmed', msg.seq, msg.action, msg.events, msg.stateHash);
        break;
      case 'action-rejected':
        this.emit('action-rejected', msg.seq, msg.reason);
        break;
      case 'state-snapshot':
        this.emit('state-snapshot', msg.state, msg.seq);
        break;
      case 'turn-timeout':
        this.emit('turn-timeout', msg.player, msg.damage);
        break;
      case 'game-over':
        this.setState('game-over');
        this.emit('game-over', msg.winner, msg.reason);
        break;
      case 'sign-request':
        this.emit('sign-request', msg.duelId, msg.winner);
        break;
      case 'action-log':
        this.emit('action-log', msg.sessionSignatures, msg.actions);
        break;
      case 'opponent-disconnected':
        this.emit('opponent-disconnected');
        break;
      case 'opponent-reconnected':
        this.emit('opponent-reconnected');
        break;
      case 'error':
        this.emit('error', msg.message);
        break;
    }
  }

  // --- Public API ---

  async authenticate(
    signTypedData: (params: {
      domain: typeof SESSION_DOMAIN;
      types: typeof SESSION_TYPES;
      primaryType: 'Session';
      message: Record<string, unknown>;
    }) => Promise<`0x${string}`>,
    nonce: string,
  ): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const message = {
      duelId: BigInt(this.duelId),
      player: this.address as `0x${string}`,
      nonce: nonce as `0x${string}`,
      expiresAt: BigInt(expiresAt),
    };

    const signature = await signTypedData({
      domain: SESSION_DOMAIN,
      types: SESSION_TYPES,
      primaryType: 'Session',
      message,
    });

    const sigBytes = hexToBytes(signature);
    const keyMaterial = await crypto.subtle.digest('SHA-256', sigBytes);
    this.sessionKey = await crypto.subtle.importKey(
      'raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );

    this.sendRaw({ type: 'auth', signature, nonce, expiresAt });
  }

  submitDeck(deck: number[]): void {
    this.sendRaw({ type: 'submit-deck', deck });
  }

  async sendAction(action: GameAction): Promise<void> {
    if (!this.sessionKey) return;
    this._seq++;
    const hmac = await this.computeHmac(this._seq, action);
    this.sendRaw({ type: 'action', action, seq: this._seq, hmac });
  }

  sendSignResult(duelId: number, winner: string, signature: string): void {
    this.sendRaw({ type: 'sign-result', duelId, winner, signature });
  }

  requestLog(): void {
    this.sendRaw({ type: 'request-log' });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  // --- Event emitter ---

  on<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void): void {
    this.listeners.get(event)?.delete(cb);
  }

  // --- Internals ---

  private emit<K extends EventKey>(event: K, ...args: EventMap[K]): void {
    this.listeners.get(event)?.forEach(cb => (cb as Function)(...args));
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    this.emit('state-change', state);
  }

  private sendRaw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async computeHmac(seq: number, action: GameAction): Promise<string> {
    if (!this.sessionKey) return '';
    const canonical = canonicalizeAction(seq, action);
    const encoded = new TextEncoder().encode(canonical);
    const sig = await crypto.subtle.sign('HMAC', this.sessionKey, encoded);
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

export type { GameAction, MatchEvent, SerializedGameState, ActionLogEntry } from '@server/protocol';
