# Phase 10: Multiplayer State Channel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two players connect via WebRTC, play a real-time battle with lockstep game state, and settle the result on-chain via DuelManager.

**Architecture:** Standalone Node.js signaling/arbiter server brokers WebRTC connections and witnesses all game actions. Both clients run identical GameController (same seed + decks). Actions relay P2P via DataChannel + copy to arbiter. Settlement via dual player signatures (happy path) or arbiter signature (dispute path).

**Tech Stack:** Node.js + `ws` (server), native WebRTC API (client), existing wagmi/viem (chain), EIP-191 signing.

**Spec:** `docs/superpowers/specs/2026-05-12-multiplayer-state-channel-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `contracts/src/DuelManager.sol` | Modify | Add arbiter address + arbiterSettle() |
| `contracts/src/interfaces/IDuelManager.sol` | Modify | Add arbiterSettle to interface |
| `contracts/test/DuelManager.t.sol` | Modify | Tests for arbiterSettle |
| `frontend/src/abi/DuelManager.ts` | Modify | Add arbiter/arbiterSettle ABI entries |
| `server/package.json` | Create | Server dependencies (ws) |
| `server/tsconfig.json` | Create | TypeScript config |
| `server/src/index.ts` | Create | Signaling + arbiter server |
| `server/src/rooms.ts` | Create | Room management (join/leave/pair) |
| `server/src/arbiter.ts` | Create | Arbiter game logic runner |
| `server/src/protocol.ts` | Create | Shared message type definitions |
| `frontend/src/multiplayer/protocol.ts` | Create | Same message types (client copy) |
| `frontend/src/multiplayer/ConnectionManager.ts` | Create | WebRTC lifecycle |
| `frontend/src/multiplayer/MatchManager.ts` | Create | Match orchestration |
| `frontend/src/game/GameController.ts` | Modify | Accept deck arrays in startGame |
| `frontend/src/pages/Battle.tsx` | Modify | Multiplayer mode via duelId param |
| `frontend/src/pages/DuelLobby.tsx` | Modify | Enter Battle button + auto-navigate |

---

## Task 1: Contract — Add arbiter + arbiterSettle

**Files:**
- Modify: `contracts/src/DuelManager.sol`
- Modify: `contracts/src/interfaces/IDuelManager.sol`
- Test: `contracts/test/DuelManager.t.sol`

- [ ] **Step 1: Write failing tests for arbiterSettle**

Add to `contracts/test/DuelManager.t.sol` at the end (before the closing `}`):

```solidity
// --- Arbiter ---

function test_SetArbiter() public {
    vm.prank(admin);
    dm.setArbiter(address(42));
    assertEq(dm.arbiter(), address(42));
}

function test_SetArbiter_OnlyOwner() public {
    vm.prank(player1);
    vm.expectRevert();
    dm.setArbiter(address(42));
}

function test_ArbiterSettle_Winner() public {
    // Setup: create + accept duel
    vm.prank(player1);
    uint256 duelId = dm.createDuel{value: 1 ether}();
    vm.prank(player2);
    dm.acceptDuel{value: 1 ether}(duelId);

    // Set arbiter
    vm.prank(admin);
    dm.setArbiter(address(42));

    // Arbiter settles in favor of player1
    uint256 p1Before = player1.balance;
    vm.prank(address(42));
    dm.arbiterSettle(duelId, player1);

    Duel memory d = dm.getDuel(duelId);
    assertEq(d.status, 2); // Settled
    assertEq(d.winner, player1);
    // Winner gets pot minus 5% fee: 2 ETH * 0.95 = 1.9 ETH
    assertEq(player1.balance, p1Before + 1.9 ether);
}

function test_ArbiterSettle_Draw() public {
    vm.prank(player1);
    uint256 duelId = dm.createDuel{value: 1 ether}();
    vm.prank(player2);
    dm.acceptDuel{value: 1 ether}(duelId);

    vm.prank(admin);
    dm.setArbiter(address(42));

    uint256 p1Before = player1.balance;
    uint256 p2Before = player2.balance;

    vm.prank(address(42));
    dm.arbiterSettle(duelId, address(0));

    assertEq(player1.balance, p1Before + 1 ether);
    assertEq(player2.balance, p2Before + 1 ether);
}

function test_ArbiterSettle_NotArbiter_Reverts() public {
    vm.prank(player1);
    uint256 duelId = dm.createDuel{value: 1 ether}();
    vm.prank(player2);
    dm.acceptDuel{value: 1 ether}(duelId);

    vm.prank(admin);
    dm.setArbiter(address(42));

    vm.prank(player1);
    vm.expectRevert(abi.encodeWithSignature("NotArbiter()"));
    dm.arbiterSettle(duelId, player1);
}

function test_ArbiterSettle_NotActive_Reverts() public {
    vm.prank(player1);
    uint256 duelId = dm.createDuel{value: 1 ether}();
    // Still Open, not Active

    vm.prank(admin);
    dm.setArbiter(address(42));

    vm.prank(address(42));
    vm.expectRevert(abi.encodeWithSignature("DuelNotActive()"));
    dm.arbiterSettle(duelId, player1);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd contracts && forge test --match-test "test_.*Arbiter" -vvv`
Expected: compilation errors (arbiter/arbiterSettle don't exist)

- [ ] **Step 3: Add to interface**

In `contracts/src/interfaces/IDuelManager.sol`, add before closing `}`:

```solidity
function arbiterSettle(uint256 duelId, address winner) external;
function arbiter() external view returns (address);
function setArbiter(address arbiter_) external;
```

- [ ] **Step 4: Implement in DuelManager.sol**

Add error after existing errors:

```solidity
error NotArbiter();
```

Add to DuelManagerStorage struct (after `uint32 seasonId;`):

```solidity
address arbiter;
```

Add admin setter (in Admin section):

```solidity
function setArbiter(address arbiter_) external onlyOwner {
    _getStorage().arbiter = arbiter_;
}
```

Add view (in Views section):

```solidity
function arbiter() external view returns (address) {
    return _getStorage().arbiter;
}
```

Add arbiterSettle function (after `claimExpired`):

```solidity
function arbiterSettle(uint256 duelId, address winner) external nonReentrant {
    DuelManagerStorage storage s = _getStorage();
    if (msg.sender != s.arbiter) revert NotArbiter();
    Duel storage d = s.duels[duelId];
    if (d.status != 1) revert DuelNotActive();
    if (winner != address(0) && winner != d.player1 && winner != d.player2) revert WinnerNotParticipant();

    d.status = 2; // Settled
    d.settledAt = block.timestamp;
    d.winner = winner;

    uint256 totalPot = d.lockedBet * 2;

    if (winner == address(0)) {
        (bool ok1,) = d.player1.call{value: d.lockedBet}("");
        require(ok1, "Refund p1 failed");
        (bool ok2,) = d.player2.call{value: d.lockedBet}("");
        require(ok2, "Refund p2 failed");
    } else {
        uint256 fee = totalPot * s.protocolFee / 10000;
        uint256 payout = totalPot - fee;

        (bool ok1,) = winner.call{value: payout}("");
        require(ok1, "Payout failed");
        if (fee > 0) {
            (bool ok2,) = s.treasury.call{value: fee}("");
            require(ok2, "Fee transfer failed");
        }

        address loser = winner == d.player1 ? d.player2 : d.player1;
        _updateElo(winner, loser, s);

        emit DuelSettled(duelId, winner, payout, fee);
    }
}
```

- [ ] **Step 5: Run tests**

Run: `cd contracts && forge test --match-test "test_.*Arbiter" -vvv`
Expected: all 5 new tests PASS

- [ ] **Step 6: Run full suite**

Run: `cd contracts && forge test`
Expected: all tests pass (143+)

- [ ] **Step 7: Commit**

```bash
git add contracts/src/DuelManager.sol contracts/src/interfaces/IDuelManager.sol contracts/test/DuelManager.t.sol
git commit -m "feat(contract): add arbiter + arbiterSettle to DuelManager"
```

---

## Task 2: Update DuelManager ABI

**Files:**
- Modify: `frontend/src/abi/DuelManager.ts`

- [ ] **Step 1: Add arbiter, setArbiter, arbiterSettle, NotArbiter to ABI**

Add these entries to the ABI array in `frontend/src/abi/DuelManager.ts`:

```typescript
{
  "type": "function",
  "name": "arbiter",
  "inputs": [],
  "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
  "stateMutability": "view"
},
{
  "type": "function",
  "name": "setArbiter",
  "inputs": [{ "name": "arbiter_", "type": "address", "internalType": "address" }],
  "outputs": [],
  "stateMutability": "nonpayable"
},
{
  "type": "function",
  "name": "arbiterSettle",
  "inputs": [
    { "name": "duelId", "type": "uint256", "internalType": "uint256" },
    { "name": "winner", "type": "address", "internalType": "address" }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
},
{
  "type": "error",
  "name": "NotArbiter",
  "inputs": []
},
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add -f frontend/src/abi/DuelManager.ts
git commit -m "feat(abi): add arbiter + arbiterSettle to DuelManager ABI"
```

---

## Task 3: Signaling Server — Rooms + WebRTC Relay

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/protocol.ts`
- Create: `server/src/rooms.ts`
- Create: `server/src/index.ts`

- [ ] **Step 1: Initialize server project**

Run:
```bash
mkdir -p server/src
```

Create `server/package.json`:

```json
{
  "name": "arcana-arena-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.13",
    "tsx": "^4.19.0",
    "typescript": "~5.7.0"
  }
}
```

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Run: `cd server && npm install`

- [ ] **Step 2: Create protocol types**

Create `server/src/protocol.ts`:

```typescript
export type ClientMessage =
  | { type: 'join'; duelId: number; address: string }
  | { type: 'sdp-offer'; sdp: unknown }
  | { type: 'sdp-answer'; sdp: unknown }
  | { type: 'ice-candidate'; candidate: unknown }
  | { type: 'deck-hash'; hash: string }
  | { type: 'deck-reveal'; deck: number[] }
  | { type: 'action'; action: GameAction }
  | { type: 'state-hash'; hash: string }
  | { type: 'sign-result'; duelId: number; winner: string; signature: string }
  | { type: 'request-arbiter'; duelId: number };

export type ServerMessage =
  | { type: 'paired'; opponent: string; playerIndex: 0 | 1 }
  | { type: 'sdp-offer'; sdp: unknown }
  | { type: 'sdp-answer'; sdp: unknown }
  | { type: 'ice-candidate'; candidate: unknown }
  | { type: 'opponent-disconnected' }
  | { type: 'arbiter-result'; duelId: number; winner: string; signature: string }
  | { type: 'error'; message: string };

export type GameAction =
  | { type: 'spawn'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'move'; unitUid: number; col: number; row: number }
  | { type: 'attack'; attackerUid: number; targetUid: number }
  | { type: 'attack-hero'; attackerUid: number; targetPlayerId: number }
  | { type: 'cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'pass' }
  | { type: 'end-turn' };
```

- [ ] **Step 3: Create room manager**

Create `server/src/rooms.ts`:

```typescript
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
```

- [ ] **Step 4: Create signaling server**

Create `server/src/index.ts`:

```typescript
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
```

- [ ] **Step 5: Verify server starts**

Run: `cd server && npm run dev`
Expected: prints "Signaling server listening on ws://localhost:3001"
Kill with Ctrl+C.

- [ ] **Step 6: Test with wscat**

Terminal 1: `cd server && npm start`

Terminal 2:
```bash
npx wscat -c ws://localhost:3001
> {"type":"join","duelId":1,"address":"0xAAA"}
```

Terminal 3:
```bash
npx wscat -c ws://localhost:3001
> {"type":"join","duelId":1,"address":"0xBBB"}
```

Expected: Both receive `{"type":"paired",...}` messages with correct opponent address and playerIndex (0 and 1).

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "feat: signaling server with WebSocket rooms + WebRTC relay"
```

---

## Task 4: ConnectionManager (WebRTC client)

**Files:**
- Create: `frontend/src/multiplayer/protocol.ts`
- Create: `frontend/src/multiplayer/ConnectionManager.ts`

- [ ] **Step 1: Create client protocol types**

Create `frontend/src/multiplayer/protocol.ts`:

```typescript
export type GameAction =
  | { type: 'spawn'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'move'; unitUid: number; col: number; row: number }
  | { type: 'attack'; attackerUid: number; targetUid: number }
  | { type: 'attack-hero'; attackerUid: number; targetPlayerId: number }
  | { type: 'cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'pass' }
  | { type: 'end-turn' };

export type PeerMessage =
  | { type: 'deck-hash'; hash: string }
  | { type: 'deck-reveal'; deck: number[] }
  | { type: 'action'; action: GameAction }
  | { type: 'state-hash'; hash: string }
  | { type: 'sign-result'; winner: string; signature: string };
```

- [ ] **Step 2: Create ConnectionManager**

Create `frontend/src/multiplayer/ConnectionManager.ts`:

```typescript
import type { PeerMessage } from "./protocol.js";

type EventMap = {
  paired: [opponent: string, playerIndex: 0 | 1];
  connected: [];
  message: [msg: PeerMessage];
  disconnected: [];
  error: [err: Error];
};

type EventKey = keyof EventMap;

export class ConnectionManager {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private listeners = new Map<string, Set<Function>>();

  private _playerIndex: 0 | 1 = 0;
  private _opponent = "";
  private _connected = false;

  constructor(private signalingUrl: string) {}

  get playerIndex() { return this._playerIndex; }
  get opponentAddress() { return this._opponent; }
  get connected() { return this._connected; }

  on<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void) {
    this.listeners.get(event)?.delete(cb);
  }

  private emit<K extends EventKey>(event: K, ...args: EventMap[K]) {
    this.listeners.get(event)?.forEach((cb) => (cb as Function)(...args));
  }

  join(duelId: number, address: string): void {
    this.ws = new WebSocket(this.signalingUrl);

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: "join", duelId, address }));
    };

    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      this.handleSignalingMessage(msg);
    };

    this.ws.onclose = () => {
      if (this._connected) {
        this._connected = false;
        this.emit("disconnected");
      }
    };

    this.ws.onerror = () => {
      this.emit("error", new Error("WebSocket error"));
    };
  }

  private handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case "paired":
        this._playerIndex = msg.playerIndex;
        this._opponent = msg.opponent;
        this.emit("paired", msg.opponent, msg.playerIndex);
        if (msg.playerIndex === 0) {
          this.createOffer();
        }
        break;

      case "sdp-offer":
        this.handleOffer(msg.sdp);
        break;

      case "sdp-answer":
        this.pc?.setRemoteDescription(msg.sdp);
        break;

      case "ice-candidate":
        this.pc?.addIceCandidate(msg.candidate);
        break;

      case "opponent-disconnected":
        this._connected = false;
        this.emit("disconnected");
        break;
    }
  }

  private setupPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.ws?.send(JSON.stringify({ type: "ice-candidate", candidate: evt.candidate }));
      }
    };

    this.pc.ondatachannel = (evt) => {
      this.setupDataChannel(evt.channel);
    };
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.onopen = () => {
      this._connected = true;
      this.emit("connected");
    };
    dc.onclose = () => {
      this._connected = false;
      this.emit("disconnected");
    };
    dc.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as PeerMessage;
        this.emit("message", msg);
      } catch { /* ignore malformed */ }
    };
  }

  private async createOffer() {
    this.setupPeerConnection();
    const dc = this.pc!.createDataChannel("game");
    this.setupDataChannel(dc);

    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.ws?.send(JSON.stringify({ type: "sdp-offer", sdp: offer }));
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    this.setupPeerConnection();
    await this.pc!.setRemoteDescription(sdp);
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    this.ws?.send(JSON.stringify({ type: "sdp-answer", sdp: answer }));
  }

  send(msg: PeerMessage) {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify(msg));
    }
  }

  sendToServer(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    this.dc?.close();
    this.pc?.close();
    this.ws?.close();
    this._connected = false;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/multiplayer/
git commit -m "feat: ConnectionManager with WebRTC DataChannel + signaling"
```

---

## Task 5: GameController — Accept deck arrays

Currently `startGame(seed)` creates an empty board. For multiplayer, each player needs a deck (array of cardIds). Cards are drawn from the deck into the hand.

**Files:**
- Modify: `frontend/src/game/GameController.ts`
- Modify: `frontend/src/game/GameState.ts`
- Modify: `frontend/src/game/types.ts`

- [ ] **Step 1: Add hand + deck to PlayerState**

In `frontend/src/game/types.ts`, add to `PlayerState`:

```typescript
deck: number[];        // Remaining cards to draw (cardIds)
hand: number[];        // Cards currently in hand (cardIds)
```

- [ ] **Step 2: Update createGameState to accept decks**

In `frontend/src/game/GameState.ts`, modify `createGameState` signature:

```typescript
export function createGameState(
  seed: number,
  decks?: [number[], number[]],
): GameState {
```

When `decks` is provided, shuffle each deck using the RNG and deal starting hands (4 cards):

```typescript
const rng = createRng(seed);

function shuffleDeck(deck: number[], rng: SeededRNG): number[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const STARTING_HAND_SIZE = 4;

const p0Deck = decks ? shuffleDeck(decks[0], rng) : [];
const p1Deck = decks ? shuffleDeck(decks[1], rng) : [];
const p0Hand = p0Deck.splice(0, STARTING_HAND_SIZE);
const p1Hand = p1Deck.splice(0, STARTING_HAND_SIZE);

// In player state initialization:
players: [
  { id: 0, mana: STARTING_MANA, heroHp: HERO_HP, timeoutCount: 0, deck: p0Deck, hand: p0Hand },
  { id: 1, mana: STARTING_MANA, heroHp: HERO_HP, timeoutCount: 0, deck: p1Deck, hand: p1Hand },
],
```

- [ ] **Step 3: Update GameController.startGame**

In `GameController.ts`, change signature:

```typescript
startGame(seed: number, decks?: [number[], number[]]): void {
  this.state = createGameState(seed, decks);
  // ... rest unchanged
}
```

- [ ] **Step 4: Add drawCard to endTurn**

In `GameController.ts` `endTurn()` method, after mana regen and before rebuildQueue, add card draw:

```typescript
const HAND_LIMIT = 6;
for (const p of state.players) {
  if (p.deck.length > 0 && p.hand.length < HAND_LIMIT) {
    p.hand.push(p.deck.shift()!);
  }
}
```

- [ ] **Step 5: Verify existing tests still pass**

Run: `cd frontend && npx vitest run src/game/__tests__/ --reporter=verbose 2>&1 | tail -5`
Expected: all 339+ tests pass (existing tests don't pass decks, so they use the empty-deck fallback)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/game/types.ts frontend/src/game/GameState.ts frontend/src/game/GameController.ts
git commit -m "feat(game): GameController accepts deck arrays, hand/draw system"
```

---

## Task 6: MatchManager — Orchestrate multiplayer match

**Files:**
- Create: `frontend/src/multiplayer/MatchManager.ts`

- [ ] **Step 1: Create MatchManager**

Create `frontend/src/multiplayer/MatchManager.ts`:

```typescript
import { ConnectionManager } from "./ConnectionManager.js";
import { hashState } from "../game/stateHash.js";
import type { GameAction, PeerMessage } from "./protocol.js";
import type { GameController } from "../game/GameController.js";
import { ACTIVATION_TIMER_SECONDS, TIMEOUT_DAMAGE } from "../game/constants.js";

type MatchPhase = "connecting" | "exchanging-decks" | "playing" | "game-over" | "settled";

type EventMap = {
  "phase-change": [phase: MatchPhase];
  "opponent-action": [action: GameAction];
  "desync": [myHash: string, theirHash: string];
  "game-over": [winner: 0 | 1 | null];
  "opponent-signed": [winner: string, signature: string];
  "arbiter-result": [duelId: number, winner: string, signature: string];
  "opponent-disconnected": [];
  "timeout": [playerId: number];
};

type EventKey = keyof EventMap;

export class MatchManager {
  private conn: ConnectionManager;
  private ctrl: GameController | null = null;
  private _phase: MatchPhase = "connecting";
  private listeners = new Map<string, Set<Function>>();

  private myDeck: number[] = [];
  private opponentDeckHash = "";
  private opponentDeck: number[] = [];
  private deckResolve: ((deck: number[]) => void) | null = null;

  private timerHandle: ReturnType<typeof setTimeout> | null = null;
  private activationStartTime = 0;

  constructor(conn: ConnectionManager) {
    this.conn = conn;

    conn.on("message", (msg) => this.handlePeerMessage(msg));
    conn.on("disconnected", () => this.emit("opponent-disconnected"));
  }

  get phase() { return this._phase; }

  get isMyTurn(): boolean {
    if (!this.ctrl || this._phase !== "playing") return false;
    const controlling = this.ctrl.getControllingPlayer();
    return controlling === this.conn.playerIndex;
  }

  on<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  private emit<K extends EventKey>(event: K, ...args: EventMap[K]) {
    this.listeners.get(event)?.forEach((cb) => (cb as Function)(...args));
  }

  private setPhase(p: MatchPhase) {
    this._phase = p;
    this.emit("phase-change", p);
  }

  // --- Phase 1: Deck Exchange ---

  async exchangeDecks(myDeck: number[]): Promise<{ myDeck: number[]; opponentDeck: number[] }> {
    this.myDeck = myDeck;
    this.setPhase("exchanging-decks");

    const myHash = this.simpleHash(JSON.stringify(myDeck));
    this.conn.send({ type: "deck-hash", hash: myHash });

    const opponentDeck = await new Promise<number[]>((resolve) => {
      this.deckResolve = resolve;
    });

    return { myDeck, opponentDeck };
  }

  private simpleHash(str: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  // --- Phase 2: Start Game ---

  startGame(duelId: number, ctrl: GameController): void {
    this.ctrl = ctrl;
    const seed = this.duelIdToSeed(duelId);

    const decks: [number[], number[]] = this.conn.playerIndex === 0
      ? [this.myDeck, this.opponentDeck]
      : [this.opponentDeck, this.myDeck];

    ctrl.startGame(seed, decks);
    this.setPhase("playing");
    this.startActivationTimer();

    ctrl.on("activationStart", () => this.startActivationTimer());
    ctrl.on("gameOver", () => {
      this.clearTimer();
      this.setPhase("game-over");
      const state = ctrl.getState();
      const winner = state.players[0].heroHp <= 0 ? 1 : state.players[1].heroHp <= 0 ? 0 : null;
      this.emit("game-over", winner);
    });
  }

  private duelIdToSeed(duelId: number): number {
    let h = 0x811c9dc5;
    const s = String(duelId);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // --- Phase 3: Actions ---

  submitAction(action: GameAction): void {
    if (!this.ctrl || this._phase !== "playing") return;
    if (!this.isMyTurn && action.type !== "pass" && action.type !== "end-turn") return;

    this.executeAction(action);

    this.conn.send({ type: "action", action });
    this.conn.sendToServer({ type: "action", action });

    const hash = hashState(this.ctrl.getState());
    this.conn.send({ type: "state-hash", hash });
  }

  private executeAction(action: GameAction): void {
    if (!this.ctrl) return;
    const state = this.ctrl.getState();

    switch (action.type) {
      case "spawn": {
        const { spawnUnit, canSpawn } = require("../game/actions/spawnUnit.js");
        const check = canSpawn(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        if (check.valid) spawnUnit(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        break;
      }
      case "move": {
        const { executeMove } = require("../game/actions/moveUnit.js");
        executeMove(state, action.unitUid, { col: action.col, row: action.row });
        break;
      }
      case "attack": {
        const { executeAttack } = require("../game/actions/attackUnit.js");
        executeAttack(state, action.attackerUid, action.targetUid);
        break;
      }
      case "attack-hero": {
        const { executeHeroAttack } = require("../game/actions/attackUnit.js");
        executeHeroAttack(state, action.attackerUid, action.targetPlayerId);
        break;
      }
      case "cast": {
        const { executeCast } = require("../game/actions/castSpell.js");
        executeCast(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        break;
      }
      case "pass":
        this.ctrl.passActivation();
        break;
      case "end-turn":
        this.ctrl.endTurn();
        break;
    }
  }

  // --- Timeout ---

  private startActivationTimer() {
    this.clearTimer();
    this.activationStartTime = Date.now();
    this.timerHandle = setTimeout(() => {
      if (!this.ctrl) return;
      const controlling = this.ctrl.getControllingPlayer();
      if (controlling >= 0) {
        this.emit("timeout", controlling);
        const state = this.ctrl.getState();
        const player = state.players[controlling];
        const dmg = TIMEOUT_DAMAGE[Math.min(player.timeoutCount, TIMEOUT_DAMAGE.length - 1)];
        player.heroHp -= dmg;
        player.timeoutCount++;
        this.ctrl.passActivation();
      }
    }, ACTIVATION_TIMER_SECONDS * 1000);
  }

  private clearTimer() {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }

  getTimerRemaining(): number {
    if (!this.activationStartTime) return ACTIVATION_TIMER_SECONDS;
    const elapsed = (Date.now() - this.activationStartTime) / 1000;
    return Math.max(0, ACTIVATION_TIMER_SECONDS - elapsed);
  }

  // --- Peer Message Handling ---

  private handlePeerMessage(msg: PeerMessage) {
    switch (msg.type) {
      case "deck-hash":
        this.opponentDeckHash = msg.hash;
        this.conn.send({ type: "deck-reveal", deck: this.myDeck });
        break;

      case "deck-reveal": {
        const hash = this.simpleHash(JSON.stringify(msg.deck));
        if (this.opponentDeckHash && hash !== this.opponentDeckHash) {
          console.error("Deck hash mismatch!");
        }
        this.opponentDeck = msg.deck;
        if (this.deckResolve) {
          this.deckResolve(msg.deck);
          this.deckResolve = null;
        }
        break;
      }

      case "action":
        this.executeAction(msg.action);
        this.emit("opponent-action", msg.action);
        break;

      case "state-hash": {
        if (!this.ctrl) break;
        const myHash = hashState(this.ctrl.getState());
        if (myHash !== msg.hash) {
          this.emit("desync", myHash, msg.hash);
        }
        break;
      }

      case "sign-result":
        this.emit("opponent-signed", msg.winner, msg.signature);
        break;
    }
  }

  // --- Cleanup ---

  destroy() {
    this.clearTimer();
    this.conn.disconnect();
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

Fix any import issues. The `require()` calls in `executeAction` should be converted to static imports at the top of the file:

```typescript
import { canSpawn, spawnUnit } from "../game/actions/spawnUnit.js";
import { executeMove } from "../game/actions/moveUnit.js";
import { executeAttack, executeHeroAttack } from "../game/actions/attackUnit.js";
import { executeCast } from "../game/actions/castSpell.js";
```

Expected: no errors after fixing imports

- [ ] **Step 3: Commit**

```bash
git add frontend/src/multiplayer/MatchManager.ts
git commit -m "feat: MatchManager orchestrates deck exchange, actions, timeouts"
```

---

## Task 7: Battle.tsx — Multiplayer mode

**Files:**
- Modify: `frontend/src/pages/Battle.tsx`

This is the largest integration task. Battle.tsx needs to:
1. Read `duelId` from URL params
2. If present: create ConnectionManager + MatchManager, connect, exchange decks, start game
3. Route player actions through MatchManager instead of direct GameController calls
4. Only allow actions when it's the player's turn
5. Listen for opponent actions and animate them

- [ ] **Step 1: Add multiplayer initialization**

At the top of the Battle component, add:

```typescript
import { useSearchParams } from "react-router";
import { useAccount } from "wagmi";
import { ConnectionManager } from "../multiplayer/ConnectionManager";
import { MatchManager } from "../multiplayer/MatchManager";
import { listDecks } from "../lib/deckStorage";
import { DECK_SIZE } from "../lib/deckValidation";
```

Add refs and state:

```typescript
const [searchParams] = useSearchParams();
const duelId = searchParams.get("duel") ? Number(searchParams.get("duel")) : null;
const { address } = useAccount();

const connRef = useRef<ConnectionManager | null>(null);
const matchRef = useRef<MatchManager | null>(null);
const [multiplayerStatus, setMultiplayerStatus] = useState<string>("");
const isMultiplayer = duelId !== null;
```

- [ ] **Step 2: Add multiplayer connection effect**

Add an effect that runs when `duelId` is present:

```typescript
useEffect(() => {
  if (!isMultiplayer || !address || !duelId) return;

  const conn = new ConnectionManager("ws://localhost:3001");
  connRef.current = conn;

  conn.on("paired", (_opponent, _idx) => {
    setMultiplayerStatus("Connected. Exchanging decks...");
  });

  conn.on("connected", async () => {
    const decks = listDecks(address);
    const validDeck = decks.find((d) => d.slots.filter((s) => s !== null).length === DECK_SIZE);
    if (!validDeck) { setMultiplayerStatus("No valid deck!"); return; }

    const myDeckIds = validDeck.slots.filter((s): s is number => s !== null);

    const match = new MatchManager(conn);
    matchRef.current = match;

    const { opponentDeck } = await match.exchangeDecks(myDeckIds);

    const ctrl = new GameController();
    ctrlRef.current = ctrl;
    match.startGame(duelId, ctrl);

    // Wire up scene + events (same as existing init)
    // ... scene setup code already exists in Battle.tsx
    setMultiplayerStatus("Battle started!");
  });

  conn.join(duelId, address);

  return () => { conn.disconnect(); };
}, [duelId, address]);
```

- [ ] **Step 3: Gate actions behind isMyTurn**

In all action handlers (spawn, move, attack, cast, pass), add a guard:

```typescript
if (isMultiplayer && matchRef.current && !matchRef.current.isMyTurn) return;
```

When an action executes, route through MatchManager:

```typescript
if (isMultiplayer && matchRef.current) {
  matchRef.current.submitAction({ type: "spawn", playerId, cardId, col, row });
} else {
  // existing direct GameController calls
}
```

- [ ] **Step 4: Listen for opponent actions**

```typescript
match.on("opponent-action", (action) => {
  // Re-render scene based on updated game state
  // The GameController state is already updated by MatchManager
  forceUpdate();
});

match.on("game-over", (winner) => {
  setMultiplayerStatus(
    winner === null ? "Draw!" :
    winner === connRef.current?.playerIndex ? "You win!" : "You lose!"
  );
});

match.on("desync", (myHash, theirHash) => {
  console.error(`Desync! my=${myHash} theirs=${theirHash}`);
  setMultiplayerStatus("State desync detected!");
});
```

- [ ] **Step 5: Show multiplayer status overlay**

Add a status bar when in multiplayer mode:

```typescript
{isMultiplayer && (
  <div style={{
    position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.7)", color: "var(--color-gold)",
    padding: "4px 16px", borderRadius: 8, fontSize: 14, zIndex: 100,
  }}>
    {multiplayerStatus || (matchRef.current?.isMyTurn ? "Your turn" : "Opponent's turn")}
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Battle.tsx
git commit -m "feat: Battle.tsx multiplayer mode via duelId URL param"
```

---

## Task 8: DuelLobby — Enter Battle flow

**Files:**
- Modify: `frontend/src/pages/DuelLobby.tsx`

- [ ] **Step 1: Add Enter Battle button for active duels**

Import `useNavigate` from react-router. For active duels where the connected player is a participant, show an "Enter Battle" button instead of "Claim Expired":

```typescript
import { Link, useNavigate } from "react-router";

// In DuelLobby component:
const navigate = useNavigate();

const handleEnterBattle = (duelId: number) => {
  navigate(`/battle?duel=${duelId}`);
};
```

In the Active Duels section, change the DuelCard action:

```typescript
{myActiveDuels.map((d) => (
  <DuelCard key={d.duelId} duel={d} action="battle"
    onAction={() => handleEnterBattle(d.duelId)} disabled={txInProgress} />
))}
```

Update DuelCard to handle the "battle" action:

```typescript
action: "accept" | "cancel" | "claim" | "battle" | "none";

// In button render:
{action === "battle" ? "Enter Battle" :
 action === "accept" ? `Accept (${formatEther(duel.player1Bet)} ETH)` :
 action === "cancel" ? "Cancel Duel" :
 "Claim Expired"}
```

- [ ] **Step 2: Auto-navigate after accepting a duel**

After `isSuccess` in the accept flow, navigate to battle:

```typescript
if (isSuccess) {
  setTimeout(() => {
    refetch();
    reset();
    setBetEth("");
    // If we just accepted a duel, navigate to battle
    if (lastAcceptedDuelId !== null) {
      navigate(`/battle?duel=${lastAcceptedDuelId}`);
    }
  }, 1000);
}
```

Track the last accepted duel:

```typescript
const [lastAcceptedDuelId, setLastAcceptedDuelId] = useState<number | null>(null);

const handleAccept = (duelId: number, bet: bigint) => {
  setLastAcceptedDuelId(duelId);
  writeContract({ ... });
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DuelLobby.tsx
git commit -m "feat: DuelLobby Enter Battle button + auto-navigate on accept"
```

---

## Task 9: End-to-End Verification

- [ ] **Step 1: Start all services**

Terminal 1: `cd contracts && anvil`
Terminal 2: Deploy all phases (1, 2, 4, 6, 7) + set arbiter
Terminal 3: `cd server && npm run dev`
Terminal 4: `cd frontend && npm run dev`

- [ ] **Step 2: Deploy and configure**

```bash
# Deploy phases as before, then set arbiter on DuelManager:
cast send <DUEL_MANAGER_PROXY> "setArbiter(address)" <SERVER_WALLET_ADDRESS> \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --rpc-url http://127.0.0.1:8545
```

- [ ] **Step 3: Test happy path**

1. Browser tab 1 (Account #0): Create hero, build deck, create duel with 0.01 ETH
2. Browser tab 2 (Account #1): Create hero, build deck, accept the duel
3. Tab 2 auto-navigates to `/battle?duel=0`
4. Tab 1 clicks "Enter Battle" on the active duel → navigates to `/battle?duel=0`
5. Both tabs show "Connected. Exchanging decks..." then "Battle started!"
6. Tab 1 spawns a unit → appears on Tab 2
7. Tab 2 spawns a unit → appears on Tab 1
8. Play through a few turns, verify state stays in sync
9. When one hero dies, both see the result

- [ ] **Step 4: Test disconnect**

1. Start a match between two tabs
2. Close Tab 2 mid-game
3. Tab 1 shows "Opponent disconnected"
4. Opponent's units time out (45s each) until hero dies
5. Winner can settle via arbiter

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end multiplayer adjustments"
```

---

## Verification Summary

| Task | How to verify |
|------|---------------|
| 1. Contract arbiterSettle | `forge test --match-test "test_.*Arbiter"` — 5 tests pass |
| 2. ABI update | `cd frontend && npx tsc --noEmit` — clean compile |
| 3. Signaling server | Start server + two wscat clients → both receive `paired` |
| 4. ConnectionManager | TypeScript compiles |
| 5. GameController decks | `npx vitest run src/game/__tests__/` — 339+ tests still pass |
| 6. MatchManager | TypeScript compiles |
| 7. Battle.tsx multiplayer | Two browser tabs connect + see each other's actions |
| 8. DuelLobby flow | Accept duel → auto-navigate to `/battle?duel=N` |
| 9. End-to-end | Full duel: create → accept → battle → win → settle on-chain |
