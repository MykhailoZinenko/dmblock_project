import { WebSocketServer, WebSocket } from 'ws';
import { MatchRuntime } from './MatchRuntime.js';
import {
  getOrCreateRoom, assignSeat, getOpponent, cleanupRoom, getAllRooms,
  type Room, type PlayerSession,
} from './rooms.js';
import { generateNonce, verifySession, deriveSessionKey, verifyHmac } from './auth.js';
import { cleanupSettlement } from './settlement.js';
import { calculateResults, getElo } from './ratings.js';
import { settleOnChain } from './chainSettlement.js';
import type { ClientMessage, ServerMessage, GameAction, MatchEvent } from './protocol.js';
import { ACTIVATION_TIMER_SECONDS } from '@arcana/game-core';

import { createServer } from 'http';

const PORT = Number(process.env.PORT ?? 3001);
const DISCONNECT_TIMEOUT_MS = 60_000;
const MATCH_CLEANUP_MS = 24 * 60 * 60 * 1000;

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const match = req.url?.match(/^\/api\/elo\/(.+)$/);
  if (match) {
    const addr = match[1];
    const elo = getElo(addr);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ address: addr, elo }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT, '0.0.0.0');

type ClientState = { duelId: number | null; seat: 0 | 1 };
const clients = new WeakMap<WebSocket, ClientState>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room: Room, msg: ServerMessage): void {
  for (const p of room.players) {
    if (p?.ws) send(p.ws, msg);
  }
}

function sendActionConfirmed(room: Room, action: GameAction, events: MatchEvent[]): void {
  if (!room.runtime) return;
  const controllingPlayer = room.runtime.getControllingPlayer();
  const isPriority = room.runtime.getTurnPhase().type === 'priority';
  const seq = room.runtime.seq;
  for (const p of room.players) {
    if (!p?.ws) continue;
    send(p.ws, {
      type: 'action-confirmed',
      seq,
      action,
      events,
      state: room.runtime.getSnapshotForSeat(p.seat),
      controllingPlayer,
      isPriority,
    });
  }
}

function startActivationTimer(room: Room): void {
  if (room.activationTimer) clearTimeout(room.activationTimer);
  room.activationTimer = setTimeout(() => {
    if (!room.runtime || room.runtime.phase !== 'playing') return;
    const controlling = room.runtime.getControllingPlayer();
    const events = room.runtime.applyTimeout();
    if (controlling >= 0) {
      broadcast(room, { type: 'turn-timeout', player: controlling, damage: events.length > 0 ? 3 : 0 });
    }
    sendActionConfirmed(room, { type: 'pass' }, events);
    if (room.runtime.phase === 'game-over') {
      handleGameOver(room);
    } else {
      startActivationTimer(room);
    }
  }, ACTIVATION_TIMER_SECONDS * 1000);
}

function handleGameOver(room: Room): void {
  if (!room.runtime) return;
  if (room.activationTimer) {
    clearTimeout(room.activationTimer);
    room.activationTimer = null;
  }
  const winner = room.runtime.winner;
  const isDraw = winner === null || winner < 0;
  const winnerAddress = isDraw ? '0x0000000000000000000000000000000000000000' : room.runtime.addresses[winner];
  const loserAddress = isDraw ? '0x0000000000000000000000000000000000000000' : room.runtime.addresses[winner === 0 ? 1 : 0];
  const turnCount = room.runtime.getStateForTest?.()?.turnNumber ?? 0;

  const results = calculateResults(winnerAddress, loserAddress, isDraw, turnCount);
  broadcast(room, { type: 'game-over', winner: winner ?? -1, reason: room.runtime.winReason, results });

  settleOnChain(room.duelId, winnerAddress).then(txHash => {
    if (txHash) broadcast(room, { type: 'duel-settled', txHash });
  });
}

function tryStartMatch(room: Room): void {
  if (!room.runtime || room.runtime.phase !== 'playing') return;
  const controllingPlayer = room.runtime.getControllingPlayer();
  const isPriority = room.runtime.getTurnPhase().type === 'priority';
  for (const p of room.players) {
    if (p?.ws) {
      send(p.ws, {
        type: 'match-started',
        seat: p.seat,
        opponent: room.players[p.seat === 0 ? 1 : 0]?.address ?? '',
        state: room.runtime.getSnapshotForSeat(p.seat),
        seq: room.runtime.seq,
        controllingPlayer,
        isPriority,
      });
    }
  }
  startActivationTimer(room);
}

wss.on('connection', (ws) => {
  clients.set(ws, { duelId: null, seat: 0 });

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    const clientState = clients.get(ws)!;

    switch (msg.type) {
      case 'join': {
        const room = getOrCreateRoom(msg.duelId);
        const nonce = generateNonce();
        const seat = assignSeat(room, ws, msg.address, nonce);
        if (seat === null) {
          send(ws, { type: 'error', message: 'Room is full' });
          return;
        }
        clientState.duelId = msg.duelId;
        clientState.seat = seat;

        const player = room.players[seat]!;

        // Cancel disconnect timer if reconnecting
        if (room.disconnectTimers[seat]) {
          clearTimeout(room.disconnectTimers[seat]!);
          room.disconnectTimers[seat] = null;
        }

        // Always require auth (client needs fresh session key after page refresh)
        player.authenticated = false;
        send(ws, { type: 'auth-challenge', nonce });
        break;
      }

      case 'auth': {
        if (clientState.duelId === null) {
          send(ws, { type: 'error', message: 'Not in a room' });
          return;
        }
        const room = getOrCreateRoom(clientState.duelId);
        const player = room.players[clientState.seat];
        if (!player) {
          send(ws, { type: 'error', message: 'No seat assigned' });
          return;
        }

        verifySession(
          player.address, clientState.duelId, player.nonce,
          msg.expiresAt, msg.signature as `0x${string}`,
        )
          .then((valid) => {
            if (!valid) {
              send(ws, { type: 'error', message: 'Invalid session signature' });
              return;
            }
            player.authenticated = true;
            player.sessionKey = deriveSessionKey(msg.signature);
            player.sessionSignature = msg.signature;
            const isReconnect = !!(room.runtime && room.runtime.phase === 'playing');
            send(ws, { type: 'auth-ok', sessionStart: Date.now() });

            if (isReconnect) {
              const opp = getOpponent(room, clientState.seat);
              if (opp?.ws) send(opp.ws, { type: 'opponent-reconnected' });
              send(ws, {
                type: 'match-started',
                seat: clientState.seat,
                opponent: opp?.address ?? '',
                state: room.runtime.getSnapshotForSeat(clientState.seat),
                seq: room.runtime.seq,
                controllingPlayer: room.runtime.getControllingPlayer(),
                isPriority: room.runtime.getTurnPhase().type === 'priority',
              });
              startActivationTimer(room);
              return;
            }
            send(ws, { type: 'waiting-for-opponent' });
          })
          .catch(() => {
            send(ws, { type: 'error', message: 'Auth verification failed' });
          });
        break;
      }

      case 'submit-deck': {
        if (clientState.duelId === null) return;
        const room = getOrCreateRoom(clientState.duelId);
        const player = room.players[clientState.seat];
        if (!player?.authenticated) {
          send(ws, { type: 'error', message: 'Not authenticated' });
          return;
        }

        if (!room.runtime) {
          const p0 = room.players[0];
          const p1 = room.players[1];
          if (!p0 || !p1) {
            send(ws, { type: 'waiting-for-opponent' });
            return;
          }
          room.runtime = new MatchRuntime(clientState.duelId, p0.address, p1.address);
        }

        try {
          room.runtime.submitDeck(clientState.seat, msg.deck);
        } catch (err) {
          send(ws, { type: 'error', message: `Deck rejected: ${(err as Error).message}` });
          return;
        }

        if (room.runtime.phase === 'playing') {
          tryStartMatch(room);
        }
        break;
      }

      case 'action': {
        if (clientState.duelId === null) return;
        const room = getOrCreateRoom(clientState.duelId);
        if (!room.runtime || room.runtime.phase !== 'playing') return;
        const player = room.players[clientState.seat];
        if (!player?.sessionKey) return;

        if (!verifyHmac(player.sessionKey, msg.seq, msg.action, msg.hmac)) {
          send(ws, { type: 'action-rejected', seq: msg.seq, reason: 'Invalid HMAC' });
          return;
        }

        const result = room.runtime.executeAction(clientState.seat, msg.action, msg.hmac);
        if (!result.ok) {
          send(ws, { type: 'action-rejected', seq: msg.seq, reason: result.reason ?? 'Invalid action' });
          return;
        }

        sendActionConfirmed(room, msg.action, result.events);

        if (room.runtime.phase === 'game-over') {
          handleGameOver(room);
        } else {
          startActivationTimer(room);
        }
        break;
      }

      case 'sign-result': {
        if (clientState.duelId === null) return;
        try {
          const result = submitSignature(msg.duelId, clientState.seat, msg.signature);
          if (result.complete) {
            console.log(`Settlement complete for duel ${msg.duelId}: both signatures collected`);
            cleanupSettlement(msg.duelId);
          }
        } catch {
          // No settlement in progress
        }
        break;
      }

      case 'request-log': {
        if (clientState.duelId === null) return;
        const room = getOrCreateRoom(clientState.duelId);
        if (!room.runtime) return;
        const p0 = room.players[0];
        const p1 = room.players[1];
        send(ws, {
          type: 'action-log',
          sessionSignatures: [p0?.sessionSignature ?? '', p1?.sessionSignature ?? ''],
          actions: [...room.runtime.actionLog],
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    const clientState = clients.get(ws);
    if (!clientState?.duelId) return;

    const duelId = clientState.duelId;
    const room = getOrCreateRoom(duelId);
    const seat = clientState.seat;

    // Game already over — clean up immediately
    if (room.runtime && room.runtime.phase === 'game-over') {
      cleanupRoom(duelId);
      cleanupSettlement(duelId);
      return;
    }

    const opp = getOpponent(room, seat);
    if (opp?.ws) send(opp.ws, { type: 'opponent-disconnected' });

    room.disconnectTimers[seat] = setTimeout(() => {
      if (!room.runtime || room.runtime.phase !== 'playing') {
        cleanupRoom(duelId);
        return;
      }
      room.runtime.forfeit(seat);
      handleGameOver(room);
    }, DISCONNECT_TIMEOUT_MS);
  });
});

// Periodic cleanup of stale rooms
setInterval(() => {
  const now = Date.now();
  for (const [duelId, room] of getAllRooms()) {
    if (room.runtime?.phase === 'game-over') {
      const log = room.runtime.actionLog;
      const lastActionTime = log.length > 0 ? log[log.length - 1].timestamp : room.createdAt;
      if (now - lastActionTime > MATCH_CLEANUP_MS) {
        cleanupSettlement(duelId);
        cleanupRoom(duelId);
      }
    }
  }
}, 60_000);

console.log(`Match server listening on 0.0.0.0:${PORT}`);
