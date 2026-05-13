import type { WebSocket } from 'ws';
import type { MatchRuntime } from './MatchRuntime.js';

export interface PlayerSession {
  ws: WebSocket;
  address: string;
  seat: 0 | 1;
  sessionKey: Buffer | null;
  sessionSignature: string;
  nonce: string;
  authenticated: boolean;
  heroId: number;
}

export interface Room {
  duelId: number;
  players: [PlayerSession | null, PlayerSession | null];
  runtime: MatchRuntime | null;
  disconnectTimers: [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null];
  activationTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

const rooms = new Map<number, Room>();

export function getRoom(duelId: number): Room | undefined {
  return rooms.get(duelId);
}

export function getOrCreateRoom(duelId: number): Room {
  let room = rooms.get(duelId);
  if (!room) {
    room = {
      duelId,
      players: [null, null],
      runtime: null,
      disconnectTimers: [null, null],
      activationTimer: null,
      createdAt: Date.now(),
    };
    rooms.set(duelId, room);
  }
  return room;
}

export function assignSeat(room: Room, ws: WebSocket, address: string, nonce: string): 0 | 1 | null {
  for (let i = 0; i < 2; i++) {
    const p = room.players[i as 0 | 1];
    if (p && p.address.toLowerCase() === address.toLowerCase()) {
      p.ws = ws;
      p.nonce = nonce;
      return i as 0 | 1;
    }
  }
  if (!room.players[0]) {
    room.players[0] = { ws, address, seat: 0, sessionKey: null, sessionSignature: '', nonce, authenticated: false, heroId: 0 };
    return 0;
  }
  if (!room.players[1]) {
    room.players[1] = { ws, address, seat: 1, sessionKey: null, sessionSignature: '', nonce, authenticated: false, heroId: 0 };
    return 1;
  }
  return null;
}

export function getOpponent(room: Room, seat: 0 | 1): PlayerSession | null {
  return room.players[seat === 0 ? 1 : 0];
}

export function cleanupRoom(duelId: number): void {
  const room = rooms.get(duelId);
  if (room) {
    if (room.activationTimer) clearTimeout(room.activationTimer);
    if (room.disconnectTimers[0]) clearTimeout(room.disconnectTimers[0]);
    if (room.disconnectTimers[1]) clearTimeout(room.disconnectTimers[1]);
    rooms.delete(duelId);
  }
}

export function getAllRooms(): Map<number, Room> {
  return rooms;
}
