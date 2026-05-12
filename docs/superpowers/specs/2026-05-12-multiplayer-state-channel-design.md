# Phase 10: Multiplayer State Channel — Design Spec

## Goal

Two players play a real-time battle over WebRTC. A signaling/arbiter server brokers connections and witnesses all moves. On-chain settlement via DuelManager with arbiter fallback for disputes.

## Decisions

- **Networking:** WebRTC DataChannel (P2P), WebSocket signaling server for handshake
- **Signaling server:** Standalone Node.js + `ws` in `server/` directory
- **Game authority:** Dual-authority lockstep — both clients run identical GameController with same seed
- **Match flow:** Auto-connect via signaling after acceptDuel tx confirms, using duelId as room key
- **Deck selection:** Use most recently saved valid deck automatically (no selection screen)
- **Dispute resolution:** Trusted arbiter (the signaling server watches all moves, can co-sign results)
- **Contract change:** Add `arbiter` address + `arbiterSettle(duelId, winner, arbiterSig)` to DuelManager

## Architecture

```
Browser A                     Signaling/Arbiter Server              Browser B
---------                     ----------------------              ---------
acceptDuel tx confirms        Node.js + ws (port 3001)            acceptDuel tx confirms
  |                                  |                                  |
  +-- ws connect (room=duelId) ---->|<---- ws connect (room=duelId) ---+
  |   SDP offer ------------------>|---------------> SDP answer         |
  |   ICE candidates <----------->|<-------------> ICE candidates       |
  |        DataChannel opens       |          DataChannel opens         |
  |             |                  |                |                    |
  |             +--- P2P direct ---+----------------+                   |
  |                                |                                    |
  |  1. Exchange deck hashes       | (arbiter receives all actions)     |
  |  2. Exchange actual decks      |                                    |
  |  3. Verify deck hash matches   |                                    |
  |  4. seed = hash(duelId)        |                                    |
  |  5. Both start GameController  |                                    |
  |                                |                                    |
  |  Player acts --> send action --+--> opponent executes same action   |
  |  Both hash state, compare      |    arbiter also executes           |
  |                                |                                    |
  |  Game over --> both sign ------+--> either submits settleDuel()     |
  |  If one refuses --> arbiter ---+--> arbiterSettle()                 |
```

## Components

### 1. Signaling + Arbiter Server (`server/index.ts`)

Standalone Node.js server (~200 lines). Responsibilities:

- **WebSocket rooms** keyed by `duelId`. Two slots per room (player1, player2).
- **WebRTC relay:** Forward SDP offers/answers and ICE candidates between the two players in a room.
- **Arbiter role:** Receive every game action message from both players. Run its own `GameController` with same seed + decks. Maintain authoritative game state.
- **Result signing:** When the game ends (arbiter's GameController emits `gameOver`), the server signs the result `(duelId, winner)` with its private key and sends the signature to both players.
- **Dispute path:** If a player requests arbiter settlement (opponent disconnected or refused to sign), the server provides its signature for `arbiterSettle()`.

**Message protocol (JSON over WebSocket):**

```typescript
// Signaling messages (client <-> server)
{ type: 'join', duelId: number, address: string }
{ type: 'paired', opponent: string, playerIndex: 0 | 1 }
{ type: 'sdp-offer', sdp: RTCSessionDescriptionInit }
{ type: 'sdp-answer', sdp: RTCSessionDescriptionInit }
{ type: 'ice-candidate', candidate: RTCIceCandidateInit }

// Game messages (also forwarded to arbiter via WS)
{ type: 'deck-hash', hash: string }
{ type: 'deck-reveal', deck: number[] }
{ type: 'action', action: GameAction }
{ type: 'state-hash', turnNumber: number, hash: string }
{ type: 'game-over', winner: 0 | 1 | null }

// Arbiter messages (server -> client)
{ type: 'arbiter-result', duelId: number, winner: string, signature: string }
```

### 2. ConnectionManager (`frontend/src/multiplayer/ConnectionManager.ts`)

Manages the WebRTC lifecycle. Pure TypeScript, no React dependency.

```typescript
class ConnectionManager extends EventEmitter {
  constructor(signalingUrl: string)
  
  // Connect to signaling server and join room
  join(duelId: number, address: string): Promise<void>
  
  // State
  get connected(): boolean
  get playerIndex(): 0 | 1
  get opponentAddress(): string
  
  // Send message to opponent via DataChannel
  send(msg: object): void
  
  // Send message to arbiter via WebSocket
  sendToArbiter(msg: object): void
  
  // Close everything
  disconnect(): void
  
  // Events
  on('paired', (opponent: string, playerIndex: 0|1) => void)
  on('connected', () => void)        // DataChannel open
  on('message', (msg: object) => void)  // From opponent
  on('arbiter-message', (msg: object) => void)  // From server
  on('disconnected', () => void)
  on('error', (err: Error) => void)
}
```

### 3. MatchManager (`frontend/src/multiplayer/MatchManager.ts`)

Orchestrates the full match lifecycle. Bridges ConnectionManager and GameController.

```typescript
class MatchManager extends EventEmitter {
  constructor(connection: ConnectionManager, gameController: GameController)
  
  // Phase 1: Deck exchange
  exchangeDecks(myDeck: number[]): Promise<{ myDeck: number[], opponentDeck: number[] }>
  
  // Phase 2: Start game
  startGame(duelId: number): void  // seed = hash(duelId)
  
  // Phase 3: During game
  submitAction(action: GameAction): void  // Validate, execute, send to opponent + arbiter
  
  // Phase 4: End game
  signResult(duelId: number, winner: string): Promise<string>  // EIP-191 signature
  getArbiterSignature(): Promise<string>  // Request from server if opponent won't sign
  
  // State
  get phase(): 'connecting' | 'exchanging-decks' | 'playing' | 'signing' | 'settled'
  get isMyTurn(): boolean  // Current activation belongs to my unit
  
  // Events
  on('action', (action: GameAction) => void)         // Opponent acted
  on('desync', (expected: string, got: string) => void)
  on('game-over', (winner: 0|1|null) => void)
  on('opponent-signed', (signature: string) => void)
  on('arbiter-result', (winner: string, signature: string) => void)
  on('opponent-disconnected', () => void)
  on('timeout', (playerId: number) => void)          // 45s activation timeout
}
```

**Action message format:**

```typescript
type GameAction =
  | { type: 'spawn', playerId: number, cardId: number, col: number, row: number }
  | { type: 'move', unitUid: number, col: number, row: number }
  | { type: 'attack', attackerUid: number, targetUid: number }
  | { type: 'attack-hero', attackerUid: number, targetPlayerId: number }
  | { type: 'cast', playerId: number, cardId: number, col: number, row: number }
  | { type: 'pass' }
  | { type: 'end-turn' }
```

### 4. DuelManager Contract Change

Add to `DuelManager.sol`:

```solidity
// New storage field
address public arbiter;

// New admin setter
function setArbiter(address arbiter_) external onlyOwner;

// New settlement path
function arbiterSettle(uint256 duelId, address winner) external;
```

`arbiterSettle` requirements:
- `msg.sender == arbiter`
- Duel status must be Active (1)
- Winner must be player1, player2, or address(0) for draw
- Same payout/ELO logic as `settleDuel`

### 5. Battle.tsx Changes

The existing Battle.tsx currently controls both sides locally. For multiplayer:

- Accept `duelId` as a URL param: `/battle?duel=123`
- If `duelId` present: create ConnectionManager + MatchManager, enter multiplayer mode
- If no `duelId`: keep existing local sandbox behavior
- In multiplayer mode:
  - Only allow actions when `matchManager.isMyTurn` is true
  - On player action: call `matchManager.submitAction()` instead of directly calling GameController
  - On opponent action (via MatchManager event): GameController executes, BattleScene animates
  - 45-second activation timer (visual countdown, timeout triggers stamp damage via MatchManager)
  - On game over: show result + "Submit to Chain" button that calls `settleDuel()` or `arbiterSettle()`

### 6. DuelLobby.tsx Changes

- When a duel becomes Active (status 1), show a "Enter Battle" button that navigates to `/battle?duel={duelId}`
- Auto-redirect to battle page after acceptDuel tx confirms
- Show "Waiting for opponent..." state while WebRTC connects

## Match Lifecycle (End to End)

1. **Player A** creates duel on-chain (locks ETH)
2. **Player B** sees it in Open Challenges, clicks Accept (locks ETH)
3. Both clients detect duel is now Active (status 1)
4. Both auto-navigate to `/battle?duel={duelId}`
5. Both connect to signaling server, join room `duelId`
6. Server pairs them, assigns playerIndex (0 = player1 from contract, 1 = player2)
7. WebRTC DataChannel opens
8. **Deck exchange:** Both send deck hash, then reveal decks, verify hashes match
9. **Game start:** `seed = fnv1a(duelId)`, both create GameController with same seed + decks
10. **Gameplay:** Actions flow P2P (+ copy to arbiter). State hashes compared each action.
11. **Game over:** Both clients detect winner. Both sign `(duelId, winnerAddress)` with their wallet.
12. **Happy path:** Both signatures collected. Either player submits `settleDuel(duelId, winner, sig1, sig2)`.
13. **Dispute path:** Loser refuses to sign or disconnects. Winner requests arbiter signature. Submits `arbiterSettle(duelId, winner)` (called by arbiter address, or winner submits with arbiter sig — TBD by contract design).
14. **Timeout path:** No settlement within 24h → either player calls `claimExpired()`.

## Timeout / Disconnection

- **45-second activation timer:** MatchManager tracks time per activation. If opponent doesn't act within 45s, stamp damage is applied to their hero (3 → 6 → 12 → 24, capped). Both clients apply it deterministically. Arbiter also applies it.
- **Disconnection:** If WebRTC channel closes mid-match, remaining player keeps playing (opponent's units auto-timeout). After all timeouts kill the disconnected player's hero, the match ends normally. Winner can settle via arbiter.
- **Both disconnect:** Neither submits. After 24h, `claimExpired()` refunds both.

## Security Properties

- **No ETH theft:** Arbiter can only settle with a valid winner (player1, player2, or draw). Contract enforces this.
- **No false wins:** Arbiter runs the same deterministic game logic. Its result matches the honest client's result.
- **Arbiter trust:** The arbiter server is trusted to run correct game logic and sign honestly. This is a documented tradeoff — full trustless verification would require on-chain game replay (not practical).
- **Deck integrity:** Hash-commit-reveal prevents either player from changing their deck after seeing the opponent's.

## Tech Stack

- **Server:** Node.js, `ws` library, viem (for signing)
- **Client:** Native WebRTC API (`RTCPeerConnection`, `RTCDataChannel`), existing wagmi for chain interaction
- **Signing:** EIP-191 personal sign (same as existing `settleDuel` uses)
