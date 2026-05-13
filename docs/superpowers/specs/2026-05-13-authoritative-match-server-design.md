# Authoritative Match Server Migration

**Date:** 2026-05-13
**Status:** Design
**Scope:** Replace P2P dual-simulation multiplayer with a dedicated authoritative match server

## Problem

The current multiplayer architecture uses WebRTC peer-to-peer with dual simulation: both clients independently execute every game action and verify state hashes. This creates:

- Two writers to the same game state (each peer runs its own GameController)
- Desync risk from any non-determinism edge case
- No server-side action validation (cheating surface)
- Complex connection management (WebSocket signaling + WebRTC DataChannel)
- No reconnection support (peer drops = match lost)
- Action log stored on server but never verified or replayed

For a dApp where real money is at stake, the game server must be an authoritative, cryptographically auditable execution environment — not a passive relay.

## Architecture Overview

```
┌─────────────┐         WebSocket          ┌──────────────────┐
│  Client A   │◄──────────────────────────►│                  │
│ (thin view) │   intents → / ← confirmed  │   Match Server   │
└─────────────┘                            │                  │
                                           │  MatchRuntime    │
┌─────────────┐         WebSocket          │  ├─ GameController│
│  Client B   │◄──────────────────────────►│  ├─ Action Log   │
│ (thin view) │   intents → / ← confirmed  │  ├─ Snapshots    │
└─────────────┘                            │  └─ Settlement   │
                                           └──────────────────┘
                                                    │
                                           settleDuel / arbiterSettle
                                                    │
                                           ┌────────▼────────┐
                                           │  Base Sepolia   │
                                           │  DuelManager    │
                                           └─────────────────┘
```

**Principle:** The server is a convenience layer, not a trust layer. Every economically meaningful claim is backed by cryptographic proof independent of server trust.

## Monorepo Structure

```
dmblock_project/
├── package.json                  # NEW — npm workspace root
├── packages/
│   └── game-core/                # NEW — extracted pure game logic
│       ├── package.json          # name: @arcana/game-core
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # barrel export
│           ├── GameController.ts
│           ├── GameState.ts
│           ├── types.ts
│           ├── constants.ts
│           ├── cardRegistry.ts
│           ├── combat.ts
│           ├── hexUtils.ts
│           ├── initiative.ts
│           ├── pathfinding.ts
│           ├── rng.ts
│           ├── stateHash.ts
│           └── actions/
│               ├── spawnUnit.ts
│               ├── moveUnit.ts
│               ├── attackUnit.ts
│               ├── heroActions.ts
│               └── castSpell.ts
├── server/                       # REWRITTEN
│   ├── package.json              # depends on @arcana/game-core
│   └── src/
│       ├── index.ts              # WS server entry
│       ├── protocol.ts           # single source of truth for wire types
│       ├── rooms.ts              # room/player management
│       ├── MatchRuntime.ts       # NEW — one instance per active match
│       └── settlement.ts         # NEW — dual-sig + arbiter
├── frontend/                     # SLIMMED
│   └── src/
│       ├── game/                 # keeps BattleScene, AnimationController, spriteConfig
│       ├── multiplayer/          # REWRITTEN
│       │   ├── protocol.ts       # re-exports from shared protocol
│       │   └── ServerConnection.ts  # replaces ConnectionManager + MatchManager
│       └── pages/Battle.tsx      # simplified MP path
├── contracts/
└── docs/
```

### What moves to `packages/game-core`

All pure, deterministic game logic with zero UI/rendering dependencies:

- `GameController.ts` — state machine, turn flow, event emitter
- `GameState.ts` — data structure + `createGameState`
- `types.ts` — CardDefinition, UnitInstance, GamePhase, enums
- `constants.ts` — MANA_PER_TURN, MANA_CAP, ACTIVATION_TIMER_SECONDS, etc.
- `cardRegistry.ts` — all card definitions
- `combat.ts` — damage formulas
- `hexUtils.ts` — hex coordinate math
- `initiative.ts` — queue building
- `pathfinding.ts` — A* on hex grid
- `rng.ts` — seeded RNG
- `stateHash.ts` — FNV state hashing
- `actions/` — all 5 action files (spawnUnit, moveUnit, attackUnit, heroActions, castSpell)
- `__tests__/` — all 339 existing game logic tests

### What stays in `frontend/src/game/`

Rendering-only files that depend on the custom WebGPU engine:

- `BattleScene.ts` — sprite rendering, HP bars, animations, FX
- `AnimationController.ts` — per-unit sprite animation state machine
- `spriteConfig.ts` — sprite configuration data

These import types from `@arcana/game-core` but never game logic.

### What gets deleted

- `frontend/src/multiplayer/ConnectionManager.ts` — WebRTC management
- `frontend/src/multiplayer/MatchManager.ts` — dual-simulation orchestration
- `frontend/src/multiplayer/protocol.ts` — replaced by shared protocol
- All WebRTC-related code (SDP, ICE, DataChannel)
- Server-side SDP/ICE relay handlers

## Wire Protocol

Single source of truth in `server/src/protocol.ts`. WebSocket-only transport (no WebRTC).

### Client → Server

```typescript
type ClientMessage =
  | { type: 'join'; duelId: number; address: string }
  | { type: 'auth'; signature: string; nonce: string; expiresAt: number }
  | { type: 'submit-deck'; deck: number[] }
  | {
      type: 'action';
      action: GameAction;
      seq: number;
      hmac: string;
    }
  | { type: 'sign-result'; duelId: number; winner: string; signature: string }
  | { type: 'request-log' };
```

### Server → Client

```typescript
type ServerMessage =
  | { type: 'auth-challenge'; nonce: string }
  | { type: 'auth-ok'; sessionStart: number }
  | { type: 'waiting-for-opponent' }
  | {
      type: 'match-started';
      seat: 0 | 1;
      opponent: string;
      state: SerializedGameState;
      seq: number;
    }
  | {
      type: 'action-confirmed';
      seq: number;
      action: GameAction;
      events: MatchEvent[];
      stateHash: string;
    }
  | { type: 'action-rejected'; seq: number; reason: string }
  | { type: 'state-snapshot'; state: SerializedGameState; seq: number }
  | { type: 'turn-timeout'; player: number; damage: number }
  | { type: 'game-over'; winner: number; reason: string }
  | { type: 'sign-request'; duelId: number; winner: string }
  | { type: 'opponent-disconnected' }
  | { type: 'opponent-reconnected' }
  | {
      type: 'action-log';
      sessionSignatures: [string, string];
      actions: Array<{ seq: number; action: GameAction; hmac: string; timestamp: number }>;
    }
  | { type: 'error'; message: string };
```

### GameAction (unchanged from game logic)

```typescript
type GameAction =
  | { type: 'spawn'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'move'; unitUid: number; col: number; row: number }
  | { type: 'attack'; attackerUid: number; targetUid: number }
  | { type: 'attack-hero'; attackerUid: number; targetPlayerId: number }
  | { type: 'cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'pass' }
  | { type: 'end-turn' };
```

### MatchEvent (action side-effects for client animation)

```typescript
type MatchEvent =
  | { type: 'unit-spawned'; uid: number; playerId: number; cardId: number; col: number; row: number }
  | { type: 'unit-moved'; uid: number; path: { col: number; row: number }[] }
  | { type: 'unit-attacked'; attackerUid: number; targetUid: number; damage: number; retaliation: number }
  | { type: 'hero-attacked'; attackerUid: number; targetPlayerId: number; damage: number }
  | { type: 'unit-died'; uid: number }
  | { type: 'spell-cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'effect-applied'; uid: number; effectId: string }
  | { type: 'effect-expired'; uid: number; effectId: string }
  | { type: 'mana-changed'; playerId: number; mana: number }
  | { type: 'hp-changed'; uid: number; hp: number }
  | { type: 'hero-hp-changed'; playerId: number; hp: number }
  | { type: 'activation-changed'; uid: number }
  | { type: 'turn-changed'; turnNumber: number }
  | { type: 'queue-rebuilt'; queue: number[] }; // unit UIDs in order
```

The server emits these by diffing GameState before/after action execution. The client uses them to drive animations without running game logic.

### SerializedGameState

`SerializedGameState` is the JSON-serializable form of `GameState`. Identical structure but with `rng` replaced by `rngState: number` (the current seed value) so it can round-trip through JSON. The `board` 2D array, `units`, `players`, `activationQueue` (as UID array), and all other fields serialize directly.

## Security & Signing

### Session Authorization (one wallet popup at match start)

1. Client sends `join` with `duelId` + `address`
2. Server responds with `auth-challenge` containing random `nonce`
3. Client signs EIP-712 typed data:

```
Domain: { name: "Arcana Arena", chainId: 84532, verifyingContract: <DuelManager> }
Types: { Session: [
  { name: "duelId", type: "uint256" },
  { name: "player", type: "address" },
  { name: "nonce", type: "bytes32" },
  { name: "expiresAt", type: "uint256" }
]}
```

4. Client sends `auth` with signature
5. Server verifies via `ethers.verifyTypedData`, stores session
6. Session key derived: `sessionKey = keccak256(signature)`

### Per-Action Authentication

Each action message includes:

- `seq` — monotonically increasing sequence number
- `hmac` — `HMAC-SHA256(sessionKey, canonical(seq + action))`

Server verifies HMAC before processing. This proves:
- Action came from the authenticated session holder
- Action wasn't tampered with in transit
- Actions are ordered (seq prevents replay)

### Settlement (one wallet popup at match end)

EIP-712 typed data matching `settleDuel` contract expectations:

```
Types: { Settlement: [
  { name: "duelId", type: "uint256" },
  { name: "winner", type: "address" }
]}
```

### Action Log as Evidence

Full log available to either player via `request-log`:
- Both session EIP-712 signatures (proves who played)
- All actions with HMACs and timestamps (proves what happened)
- Independently verifiable: anyone with the session signatures can recompute session keys and verify HMACs

### Trust Boundaries

| Layer | Trust assumption | Verification |
|-------|-----------------|--------------|
| Wallet identity | Player is who they claim | EIP-712 session signature |
| Action authorship | Player X sent action Y | HMAC per action, chained to session sig |
| Action ordering | Actions in this sequence | Server-assigned seq in HMAC input |
| Match outcome | Player X won | Dual-sig `settleDuel` — both players agree |
| Dispute fallback | Loser refuses to sign | `arbiterSettle` backed by action log |
| Transcript integrity | This is what happened | Full action log with HMACs + session sigs |

**Server cannot:**
- Steal funds (settlement requires player sigs or arbiter path with on-chain timeout)
- Forge player actions (needs session key derived from wallet sig)
- Settle wrong winner via dual-sig (needs both players to sign)

**Server can (if compromised):**
- Refuse to relay (griefing → disconnect → `claimExpired` on-chain)
- Use `arbiterSettle` dishonestly — mitigated by action log transparency + on-chain timeout window

## Match Lifecycle

### 1. Connection & Auth

```
Client A                    Server                     Client B
   │                          │                           │
   ├─ join(duelId, addr) ────►│                           │
   │◄─ auth-challenge(nonce) ─┤                           │
   ├─ auth(sig, nonce, exp) ─►│                           │
   │◄─ auth-ok ──────────────┤                           │
   │◄─ waiting-for-opponent ──┤                           │
   │                          │◄── join(duelId, addr) ────┤
   │                          ├── auth-challenge(nonce) ──►│
   │                          │◄── auth(sig, nonce, exp) ──┤
   │                          ├── auth-ok ────────────────►│
```

### 2. Deck Submission & Match Start

```
   ├─ submit-deck([1,2,...]) ─►│                           │
   │                          │◄── submit-deck([3,4,...]) ─┤
   │                          │                           │
   │                    Server validates both decks        │
   │                    Server creates MatchRuntime        │
   │                    ctrl.startGame(seed, [deck0, deck1])
   │                          │                           │
   │◄─ match-started(seat=0) ─┤── match-started(seat=1) ──►│
```

Server validates decks: all card IDs exist in cardRegistry, array is non-empty. Duplicates are allowed (players can own multiple copies of a card).

Neither player sees the other's deck — server reveals cards only as they appear in confirmed actions.

### 3. Play Loop

```
   ├─ action(move, seq, hmac)─►│                           │
   │                     verify HMAC                       │
   │                     verify it's this player's turn     │
   │                     validate action (canMove, etc.)    │
   │                     execute action                     │
   │                     increment server seq               │
   │◄─ action-confirmed ──────┤── action-confirmed ───────►│
   │                          │                           │
   │                          │◄── action(attack, seq, hmac)┤
   │                     [same validation flow]             │
   │◄─ action-confirmed ──────┤── action-confirmed ───────►│
```

If action is invalid:
```
   ├─ action(illegal, seq, hmac)►│                         │
   │◄─ action-rejected(reason) ──┤                         │
```

### 4. Activation Timeout

Server runs the activation timer. On expiry:

1. Auto-pass the current activation
2. Apply escalating timeout damage to the timed-out player's hero
3. Broadcast `turn-timeout` + `action-confirmed(pass)` to both clients

### 5. Disconnection

```
   ╳ (WS closes)              │                           │
   │                     start 60s timer                   │
   │                          ├── opponent-disconnected ──►│
   │                          │                           │
   [within 60s:]              │                           │
   ├─ join(duelId, addr) ────►│                           │
   ├─ auth(...) ─────────────►│                           │
   │◄─ state-snapshot ────────┤── opponent-reconnected ──►│
   │                     cancel timer                      │
   │                          │                           │
   [after 60s without reconnect:]                          │
   │                          ├── game-over(winner=B) ────►│
   │                          ├── sign-request ───────────►│
```

### 6. Settlement

**Normal (both cooperate):**

1. Server sends `game-over` + `sign-request` to both
2. Both sign EIP-712 settlement payload
3. Both send `sign-result`
4. Server (or either client) submits `settleDuel` on-chain

**Loser refuses (120s timeout):**

1. Server calls `arbiterSettle` using its registered arbiter key
2. Action log preserved as evidence

**Both disconnect:**

1. Neither returns within 60s → match abandoned
2. No settlement → duel expires on-chain via `claimExpired`
3. Funds returned to both players

**Draw (both heroes die same action):**

1. `winner = address(0)` in settlement payload
2. Contract handles draw payout logic

## Snapshots & Persistence

**In-memory only** (no database for now):

- Full `GameState` snapshot every 3 turns + on match start and game over
- Stored in `Map<duelId, snapshot[]>`
- Used for reconnection (`state-snapshot` message)
- Cleanup: deleted when match settles, or after 24h via periodic sweep

If the server process crashes, active matches are lost. Acceptable at current scale; persistence (Redis/SQLite) is a future hardening step.

## Client Architecture

### ServerConnection

Replaces ConnectionManager + MatchManager. WebSocket client only — no game logic execution.

```typescript
class ServerConnection {
  // State
  state: 'connecting' | 'authenticating' | 'waiting' | 'playing' | 'game-over';
  seat: 0 | 1;
  
  // Connection
  connect(url: string, duelId: number, address: string): void;
  
  // Auth
  authenticate(signTypedData: WagmiSignFn): Promise<void>;
  
  // Deck
  submitDeck(deck: number[]): void;
  
  // Actions
  sendAction(action: GameAction): void;  // fire-and-forget intent
  
  // Events (for Battle.tsx to subscribe)
  on('match-started', (state, seat) => void): void;
  on('action-confirmed', (seq, action, events) => void): void;
  on('action-rejected', (seq, reason) => void): void;
  on('state-snapshot', (state) => void): void;
  on('game-over', (winner, reason) => void): void;
  on('sign-request', (duelId, winner) => void): void;
  on('opponent-disconnected' | 'opponent-reconnected', () => void): void;
  
  // Cleanup
  disconnect(): void;
}
```

### Battle.tsx Changes

**Hotseat/single-player:** Unchanged. Uses GameController directly.

**Multiplayer:** Two key changes:

1. **No local game logic execution.** Battle sends intents via `serverConn.sendAction()` and waits for `action-confirmed` before playing animations or updating UI.

2. **No optimistic execution.** Turn-based game with sub-100ms WS round trips doesn't need it. Flow: click → intent sent → server confirms → animate. Eliminates the entire class of revert-on-reject bugs.

**Turn tracking:** Server state determines whose turn it is. No local `isMyTurn` computation from queue inspection.

**Timer display:** Client shows countdown based on server-provided activation start time. Server enforces the actual cutoff.

## Migration: What Gets Deleted

| File | Reason |
|------|--------|
| `frontend/src/multiplayer/ConnectionManager.ts` | WebRTC removed |
| `frontend/src/multiplayer/MatchManager.ts` | Dual-simulation removed |
| `frontend/src/multiplayer/protocol.ts` | Replaced by shared protocol |
| Server SDP/ICE relay handlers in `index.ts` | WebRTC removed |
| `server/src/arbiter.ts` | Replaced by MatchRuntime action log |

## Out of Scope

- Database persistence for snapshots (future hardening)
- Spectator mode
- Match replay system
- On-chain action hash / Merkle root
- EIP-4337 session keys
- Optimistic client-side execution
