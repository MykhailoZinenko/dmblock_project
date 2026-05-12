import { WebSocketServer, WebSocket } from "ws";
import { joinRoom, leaveRoom, getOpponent, type Room, type Player } from "./rooms.js";
import type { ClientMessage, ServerMessage } from "./protocol.js";

const PORT = Number(process.env.PORT ?? 3001);
const wss = new WebSocketServer({ port: PORT });

type ClientState = { duelId: number | null; room: Room | null; playerIndex: 0 | 1 };

const clients = new WeakMap<WebSocket, ClientState>();

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on("connection", (ws) => {
  clients.set(ws, { duelId: null, room: null, playerIndex: 0 });

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    const state = clients.get(ws)!;

    switch (msg.type) {
      case "join": {
        const result = joinRoom(msg.duelId, ws, msg.address);
        if ("error" in result) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        state.duelId = msg.duelId;
        state.room = result.room;
        state.playerIndex = result.playerIndex;

        const opponent = getOpponent(result.room, result.playerIndex);
        if (opponent) {
          send(ws, { type: "paired", opponent: opponent.address, playerIndex: result.playerIndex });
          send(opponent.ws, { type: "paired", opponent: msg.address, playerIndex: opponent.index });
        }
        break;
      }

      case "sdp-offer":
      case "sdp-answer":
      case "ice-candidate": {
        const opponent = state.room ? getOpponent(state.room, state.playerIndex) : null;
        if (opponent) {
          send(opponent.ws, msg as ServerMessage);
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on("close", () => {
    const state = clients.get(ws);
    if (state?.duelId !== null && state?.duelId !== undefined) {
      const left = leaveRoom(state.duelId, ws);
      if (left && state.room) {
        const opponent = getOpponent(state.room, left.index);
        if (opponent) {
          send(opponent.ws, { type: "opponent-disconnected" });
        }
      }
    }
  });
});

console.log(`Signaling server listening on ws://localhost:${PORT}`);
