import {
  GameController,
  cardRegistry,
  canSpawn, executeSpawn,
  canMove, executeMove,
  canAttack, executeAttack,
  canAttackHero, executeHeroAttack,
  canCast, executeCast,
  checkWinCondition,
  hashState,
  TIMEOUT_DAMAGE,
} from '@arcana/game-core';
import type { GameState } from '@arcana/game-core';
import {
  serializeState, canonicalizeAction,
  type GameAction, type MatchEvent, type SerializedGameState, type ActionLogEntry,
} from './protocol.js';

export type MatchPhase = 'waiting-for-decks' | 'playing' | 'game-over';

export interface ActionResult {
  ok: boolean;
  reason?: string;
  events: MatchEvent[];
  stateHash: string;
}

export class MatchRuntime {
  readonly duelId: number;
  readonly addresses: [string, string];
  private ctrl: GameController;
  private decks: [number[] | null, number[] | null] = [null, null];
  private _phase: MatchPhase = 'waiting-for-decks';
  private _seq = 0;
  private _actionLog: ActionLogEntry[] = [];
  private _winner: number | null = null;
  private _winReason = '';

  constructor(duelId: number, address0: string, address1: string) {
    this.duelId = duelId;
    this.addresses = [address0, address1];
    this.ctrl = new GameController();
  }

  get phase(): MatchPhase { return this._phase; }
  get seq(): number { return this._seq; }
  get actionLog(): readonly ActionLogEntry[] { return this._actionLog; }
  get winner(): number | null { return this._winner; }
  get winReason(): string { return this._winReason; }

  // --- Deck submission ---

  submitDeck(seat: 0 | 1, deck: number[]): void {
    if (this._phase !== 'waiting-for-decks') throw new Error('Not accepting decks');
    if (deck.length === 0) throw new Error('Deck is empty');
    for (const id of deck) {
      if (!cardRegistry.find(c => c.id === id)) {
        throw new Error(`Invalid card ID: ${id}`);
      }
    }
    this.decks[seat] = deck;

    if (this.decks[0] && this.decks[1]) {
      this.startGame();
    }
  }

  private startGame(): void {
    const seed = this.duelIdToSeed(this.duelId);
    this.ctrl.startGame(seed, [this.decks[0]!, this.decks[1]!]);
    this._phase = 'playing';
  }

  // --- Action execution ---

  getControllingPlayer(): number {
    if (!this.ctrl.isGameStarted()) return -1;
    return this.ctrl.getControllingPlayer();
  }

  executeAction(seat: number, action: GameAction, hmac = ''): ActionResult {
    if (this._phase !== 'playing') {
      return { ok: false, reason: 'Match not in playing phase', events: [], stateHash: '' };
    }

    const controlling = this.getControllingPlayer();
    if (controlling >= 0 && seat !== controlling && action.type !== 'end-turn') {
      return { ok: false, reason: 'not your turn', events: [], stateHash: '' };
    }

    const state = this.ctrl.getState();
    const events: MatchEvent[] = [];

    let result: { ok: boolean; reason?: string };
    try {
      result = this.validateAndExecute(state, action, events);
    } catch (err) {
      return { ok: false, reason: (err as Error).message, events: [], stateHash: '' };
    }
    if (!result.ok) {
      return { ok: false, reason: result.reason, events: [], stateHash: '' };
    }

    const winResult = this.checkWin();
    if (winResult) {
      this._phase = 'game-over';
      this._winner = winResult.winner;
      this._winReason = winResult.reason;
    }

    this._seq++;
    this._actionLog.push({
      seq: this._seq,
      action,
      hmac,
      timestamp: Date.now(),
    });

    const stateHash = hashState(this.ctrl.getState());
    return { ok: true, events, stateHash };
  }

  private validateAndExecute(
    state: GameState,
    action: GameAction,
    events: MatchEvent[],
  ): { ok: boolean; reason?: string } {
    switch (action.type) {
      case 'spawn': {
        const check = canSpawn(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        if (!check.valid) return { ok: false, reason: check.reason ?? 'Cannot spawn here' };
        const spawned = executeSpawn(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        events.push({
          type: 'unit-spawned', uid: spawned.uid,
          playerId: action.playerId, cardId: action.cardId,
          col: action.col, row: action.row,
        });
        events.push({ type: 'mana-changed', playerId: action.playerId, mana: state.players[action.playerId].mana });
        this.ctrl.passActivation();
        this.pushActivationEvent(events);
        return { ok: true };
      }
      case 'move': {
        const check = canMove(state, action.unitUid, { col: action.col, row: action.row });
        if (!check.valid) return { ok: false, reason: check.reason ?? 'Cannot move here' };
        const path = executeMove(state, action.unitUid, { col: action.col, row: action.row });
        events.push({ type: 'unit-moved', uid: action.unitUid, path });
        return { ok: true };
      }
      case 'attack': {
        const check = canAttack(state, action.attackerUid, action.targetUid);
        if (!check.valid) return { ok: false, reason: check.reason ?? 'Cannot attack' };
        const target = state.units.find(u => u.uid === action.targetUid)!;
        const attacker = state.units.find(u => u.uid === action.attackerUid)!;
        const result = executeAttack(state, action.attackerUid, action.targetUid);
        events.push({
          type: 'unit-attacked',
          attackerUid: action.attackerUid,
          targetUid: action.targetUid,
          damage: result.damage,
          retaliation: result.retaliation?.damage ?? 0,
          attackerHp: attacker.currentHp,
          targetHp: target.currentHp,
          crit: result.isCrit,
        });
        if (result.targetDied) events.push({ type: 'unit-died', uid: action.targetUid });
        if (result.retaliation?.attackerDied) events.push({ type: 'unit-died', uid: action.attackerUid });
        return { ok: true };
      }
      case 'attack-hero': {
        const check = canAttackHero(state, action.attackerUid, action.targetPlayerId);
        if (!check.valid) return { ok: false, reason: check.reason ?? 'Cannot attack hero' };
        const result = executeHeroAttack(state, action.attackerUid, action.targetPlayerId);
        events.push({
          type: 'hero-attacked',
          attackerUid: action.attackerUid,
          targetPlayerId: action.targetPlayerId,
          damage: result.damage,
          heroHp: state.players[action.targetPlayerId].heroHp,
        });
        return { ok: true };
      }
      case 'cast': {
        const check = canCast(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        if (!check.valid) return { ok: false, reason: check.reason ?? 'Cannot cast' };
        const result = executeCast(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        events.push({
          type: 'spell-cast',
          playerId: action.playerId,
          cardId: action.cardId,
          col: action.col, row: action.row,
        });
        for (const affected of result.affectedUnits) {
          if (affected.damage) {
            events.push({ type: 'hp-changed', uid: affected.uid, hp: state.units.find(u => u.uid === affected.uid)?.currentHp ?? 0 });
          }
          if (affected.healed) {
            events.push({ type: 'hp-changed', uid: affected.uid, hp: state.units.find(u => u.uid === affected.uid)?.currentHp ?? 0 });
          }
          if (affected.statusApplied) {
            events.push({ type: 'effect-applied', uid: affected.uid, effectId: affected.statusApplied, duration: 0 });
          }
          if (affected.died) {
            events.push({ type: 'unit-died', uid: affected.uid });
          }
        }
        events.push({ type: 'mana-changed', playerId: action.playerId, mana: state.players[action.playerId].mana });
        return { ok: true };
      }
      case 'pass': {
        this.ctrl.passActivation();
        this.pushActivationEvent(events);
        return { ok: true };
      }
      case 'end-turn': {
        this.ctrl.endTurn();
        const s = this.ctrl.getState();
        events.push({ type: 'turn-changed', turnNumber: s.turnNumber });
        events.push({ type: 'queue-rebuilt', queue: s.activationQueue.map(u => u.uid) });
        this.pushActivationEvent(events);
        for (const p of s.players) {
          events.push({ type: 'mana-changed', playerId: p.id, mana: p.mana });
        }
        return { ok: true };
      }
      default:
        return { ok: false, reason: 'Unknown action type' };
    }
  }

  private pushActivationEvent(events: MatchEvent[]): void {
    const unit = this.ctrl.getCurrentUnit();
    events.push({ type: 'activation-changed', uid: unit ? unit.uid : null });
  }

  // --- Win detection ---

  checkWin(): { winner: number; reason: string } | null {
    if (!this.ctrl.isGameStarted()) return null;
    const result = checkWinCondition(this.ctrl.getState());
    if (!result) return null;
    return { winner: result.winner, reason: 'Hero defeated' };
  }

  // --- Timeout ---

  applyTimeout(): MatchEvent[] {
    const state = this.ctrl.getState();
    const controlling = this.getControllingPlayer();
    if (controlling < 0) return [];

    const player = state.players[controlling];
    const damageIndex = Math.min(player.timeoutCount, TIMEOUT_DAMAGE.length - 1);
    const damage = TIMEOUT_DAMAGE[damageIndex];
    player.timeoutCount++;
    player.heroHp = Math.max(0, player.heroHp - damage);

    const events: MatchEvent[] = [
      { type: 'hero-hp-changed', playerId: controlling, hp: player.heroHp },
    ];

    this.ctrl.passActivation();
    this.pushActivationEvent(events);

    const winResult = this.checkWin();
    if (winResult) {
      this._phase = 'game-over';
      this._winner = winResult.winner;
      this._winReason = 'timeout';
    }

    this._seq++;
    this._actionLog.push({
      seq: this._seq,
      action: { type: 'pass' },
      hmac: 'timeout',
      timestamp: Date.now(),
    });

    return events;
  }

  // --- Snapshots ---

  getSnapshot(): SerializedGameState {
    return serializeState(this.ctrl.getState());
  }

  // --- Forfeit (disconnect) ---

  forfeit(losingSeat: 0 | 1): void {
    const winningSeat = losingSeat === 0 ? 1 : 0;
    this._phase = 'game-over';
    this._winner = winningSeat;
    this._winReason = 'opponent disconnected';
  }

  // --- Test helpers ---

  getStateForTest(): GameState {
    return this.ctrl.getState();
  }

  // --- Utilities ---

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
