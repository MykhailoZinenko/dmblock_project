import type { WebSocket } from "ws";

export type Player = {
  ws: WebSocket;
  address: string;
  index: 0 | 1;
};

export type Room = {
  duelId: number;
  players: (Player | null)[];
};

const rooms = new Map<number, Room>();

export function joinRoom(duelId: number, ws: WebSocket, address: string): { room: Room; playerIndex: 0 | 1 } | { error: string } {
  let room = rooms.get(duelId);

  if (!room) {
    room = { duelId, players: [null, null] };
    rooms.set(duelId, room);
  }

  const slot = room.players[0] === null ? 0 : room.players[1] === null ? 1 : -1;
  if (slot === -1) return { error: "Room full" };

  const playerIndex = slot as 0 | 1;
  room.players[playerIndex] = { ws, address, index: playerIndex };

  return { room, playerIndex };
}

export function leaveRoom(duelId: number, ws: WebSocket): Player | null {
  const room = rooms.get(duelId);
  if (!room) return null;

  for (let i = 0; i < 2; i++) {
    if (room.players[i]?.ws === ws) {
      const player = room.players[i]!;
      room.players[i] = null;
      if (room.players[0] === null && room.players[1] === null) {
        rooms.delete(duelId);
      }
      return player;
    }
  }
  return null;
}

export function getOpponent(room: Room, playerIndex: 0 | 1): Player | null {
  return room.players[playerIndex === 0 ? 1 : 0] ?? null;
}

export function getRoom(duelId: number): Room | undefined {
  return rooms.get(duelId);
}
