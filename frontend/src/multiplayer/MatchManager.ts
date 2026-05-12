import { ConnectionManager } from "./ConnectionManager.js";
import { hashState } from "../game/stateHash.js";
import type { GameAction, PeerMessage } from "./protocol.js";
import type { GameController } from "../game/GameController.js";
import { ACTIVATION_TIMER_SECONDS, TIMEOUT_DAMAGE } from "../game/constants.js";
import { canSpawn, executeSpawn } from "../game/actions/spawnUnit.js";
import { executeMove } from "../game/actions/moveUnit.js";
import { executeAttack } from "../game/actions/attackUnit.js";
import { executeHeroAttack } from "../game/actions/heroActions.js";
import { executeCast } from "../game/actions/castSpell.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchPhase =
  | "connecting"
  | "exchanging-decks"
  | "playing"
  | "game-over"
  | "settled";

type EventMap = {
  "phase-change": [phase: MatchPhase];
  "opponent-action": [action: GameAction];
  desync: [local: string, remote: string];
  "game-over": [winner: number];
  "opponent-signed": [winner: string, signature: string];
  "arbiter-result": [result: unknown];
  "opponent-disconnected": [];
  timeout: [playerId: number, damage: number];
};

type EventKey = keyof EventMap;

// ---------------------------------------------------------------------------
// MatchManager
// ---------------------------------------------------------------------------

export class MatchManager {
  // -- event emitter --
  private listeners = new Map<string, Set<Function>>();

  // -- state --
  private _phase: MatchPhase = "connecting";
  private conn: ConnectionManager;
  private ctrl: GameController | null = null;

  private myDeck: number[] = [];
  private opponentDeckHash: string | null = null;
  private opponentDeck: number[] | null = null;
  private deckResolve: ((deck: number[]) => void) | null = null;
  /** Opponent's deck-hash received before `exchangeDecks` ran (still had myDeck=[]). */
  private pendingOpponentHash: string | null = null;

  /**
   * When there is no activation unit, `GameController.getControllingPlayer()` is -1.
   * Battle sets this from React phase (priority seat or initiative) so `isMyTurn` stays correct.
   */
  private uiActivePlayer: number | null = null;

  private timerHandle: ReturnType<typeof setTimeout> | null = null;
  private activationStartTime = 0;
  private timeoutCount = 0;

  // ---------- constructor ----------

  constructor(conn: ConnectionManager) {
    this.conn = conn;

    conn.on("message", (msg: PeerMessage) => this.handlePeerMessage(msg));
    conn.on("disconnected", () => {
      this.emit("opponent-disconnected");
    });
  }

  // ---------- getters ----------

  get phase(): MatchPhase {
    return this._phase;
  }

  /** WebRTC seat — same index as `GameState.players[this]` for this client. */
  get playerIndex(): 0 | 1 {
    return this.conn.playerIndex;
  }

  /** Sync from `Battle` whenever UI phase / active seat changes. */
  setUiActivePlayer(playerId: number): void {
    this.uiActivePlayer = playerId;
  }

  get isMyTurn(): boolean {
    if (!this.ctrl) return false;
    const cp = this.ctrl.getControllingPlayer();
    const seat = cp >= 0 ? cp : this.uiActivePlayer;
    if (seat === null || seat < 0) return false;
    return seat === this.conn.playerIndex;
  }

  // ---------- event emitter ----------

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

  // ---------- phase helpers ----------

  private setPhase(phase: MatchPhase) {
    this._phase = phase;
    this.emit("phase-change", phase);
  }

  // ---------- deck exchange ----------

  async exchangeDecks(
    myDeck: number[],
  ): Promise<{ myDeck: number[]; opponentDeck: number[] }> {
    this.myDeck = myDeck;
    this.setPhase("exchanging-decks");

    const opponentDeck = await new Promise<number[]>((resolve) => {
      this.deckResolve = resolve;

      const hash = this.simpleHash(JSON.stringify(myDeck));
      this.conn.send({ type: "deck-hash", hash });

      if (this.pendingOpponentHash !== null) {
        this.opponentDeckHash = this.pendingOpponentHash;
        this.pendingOpponentHash = null;
        this.conn.send({ type: "deck-reveal", deck: this.myDeck });
      }
    });

    return { myDeck, opponentDeck };
  }

  // ---------- start game ----------

  startGame(duelId: number, ctrl: GameController): void {
    this.ctrl = ctrl;

    const seed = this.duelIdToSeed(duelId);

    // Player 0's deck goes first in the decks tuple
    const decks: [number[], number[]] =
      this.conn.playerIndex === 0
        ? [this.myDeck, this.opponentDeck!]
        : [this.opponentDeck!, this.myDeck];

    ctrl.startGame(seed, decks);
    this.setPhase("playing");

    // Listen for activation changes to restart timer
    ctrl.on("activationStart", () => {
      this.startActivationTimer();
    });

    ctrl.on("gameOver", (data: any) => {
      this.clearTimer();
      this.setPhase("game-over");
      this.emit("game-over", data?.winner ?? -1);
    });

    // Start the initial timer
    this.startActivationTimer();
  }

  // ---------- submit action (local player) ----------

  submitAction(action: GameAction): void {
    if (this._phase !== "playing") return;

    // Only allow actions on your turn, except pass/end-turn are always allowed
    const alwaysAllowed = action.type === "pass" || action.type === "end-turn";
    if (!this.isMyTurn && !alwaysAllowed) return;

    // Execute locally
    this.executeAction(action);

    // Send to peer
    this.conn.send({ type: "action", action });

    // Send copy to server for record-keeping
    this.conn.sendToServer({ type: "action", action });

    // Send state hash for verification
    const hash = hashState(this.ctrl!.getState());
    this.conn.send({ type: "state-hash", hash });
  }

  // ---------- execute action ----------

  private executeAction(action: GameAction): void {
    if (!this.ctrl) return;
    const state = this.ctrl.getState();

    switch (action.type) {
      case "spawn": {
        const result = canSpawn(state, action.playerId, action.cardId, {
          col: action.col,
          row: action.row,
        });
        if (result.valid) {
          executeSpawn(state, action.playerId, action.cardId, {
            col: action.col,
            row: action.row,
          });
        }
        break;
      }
      case "move":
        executeMove(state, action.unitUid, {
          col: action.col,
          row: action.row,
        });
        break;
      case "attack":
        executeAttack(state, action.attackerUid, action.targetUid);
        break;
      case "attack-hero":
        executeHeroAttack(state, action.attackerUid, action.targetPlayerId);
        break;
      case "cast":
        executeCast(state, action.playerId, action.cardId, {
          col: action.col,
          row: action.row,
        });
        break;
      case "pass":
        this.ctrl.passActivation();
        break;
      case "end-turn":
        this.ctrl.endTurn();
        break;
    }
  }

  // ---------- activation timer ----------

  startActivationTimer(): void {
    this.clearTimer();
    this.activationStartTime = Date.now();

    this.timerHandle = setTimeout(() => {
      this.handleTimeout();
    }, ACTIVATION_TIMER_SECONDS * 1000);
  }

  clearTimer(): void {
    if (this.timerHandle !== null) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }

  getTimerRemaining(): number {
    if (this.activationStartTime === 0) return ACTIVATION_TIMER_SECONDS;
    const elapsed = (Date.now() - this.activationStartTime) / 1000;
    return Math.max(0, ACTIVATION_TIMER_SECONDS - elapsed);
  }

  private handleTimeout(): void {
    if (!this.ctrl) return;

    const timedOutPlayer = this.ctrl.getControllingPlayer();
    const damageIndex = Math.min(this.timeoutCount, TIMEOUT_DAMAGE.length - 1);
    const damage = TIMEOUT_DAMAGE[damageIndex];
    this.timeoutCount++;

    this.emit("timeout", timedOutPlayer, damage);

    // Auto-pass the activation
    this.ctrl.passActivation();
  }

  // ---------- handle peer messages ----------

  private handlePeerMessage(msg: PeerMessage): void {
    switch (msg.type) {
      case "deck-hash":
        if (this.myDeck.length === 0) {
          this.pendingOpponentHash = msg.hash;
          break;
        }
        this.opponentDeckHash = msg.hash;
        // Now reveal our deck to the opponent
        this.conn.send({ type: "deck-reveal", deck: this.myDeck });
        break;

      case "deck-reveal": {
        const receivedHash = this.simpleHash(JSON.stringify(msg.deck));
        if (this.opponentDeckHash && receivedHash !== this.opponentDeckHash) {
          // Deck hash mismatch — opponent tampered
          this.emit("desync", this.opponentDeckHash, receivedHash);
          return;
        }
        this.opponentDeck = msg.deck;
        if (this.deckResolve) {
          this.deckResolve(msg.deck);
          this.deckResolve = null;
        }
        break;
      }

      case "action":
        if (this._phase !== "playing") return;
        this.executeAction(msg.action);
        this.emit("opponent-action", msg.action);
        break;

      case "state-hash": {
        if (!this.ctrl) return;
        const localHash = hashState(this.ctrl.getState());
        if (localHash !== msg.hash) {
          this.emit("desync", localHash, msg.hash);
        }
        break;
      }

      case "sign-result":
        this.emit("opponent-signed", msg.winner, msg.signature);
        break;
    }
  }

  // ---------- destroy ----------

  destroy(): void {
    this.clearTimer();
    this.conn.disconnect();
  }

  // ---------- hashing utilities ----------

  private simpleHash(str: string): string {
    let hash = 0x811c9dc5; // FNV-1a offset basis
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  private duelIdToSeed(duelId: number): number {
    const str = String(duelId);
    let hash = 0x811c9dc5;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }
}
