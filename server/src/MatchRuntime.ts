import {
  GameController,
  buildInitiativeQueue,
  cardRegistry,
  canSpawn, executeSpawn,
  canMove, executeMove,
  canAttack, executeAttack,
  canAttackHero, executeHeroAttack,
  canCast, executeCast,
  checkWinCondition,
  hashState,
  TIMEOUT_DAMAGE,
  getCard, isMelee, isRanged, isBuilding,
  hexNeighbors,
  getOccupiedSet, getAutoWalkHex,
} from '@arcana/game-core';
import type { GameState, UnitInstance, HexCoord } from '@arcana/game-core';
import {
  serializeState, serializeStateForSeat,
  type GameAction, type MatchEvent, type SerializedGameState, type ActionLogEntry,
} from './protocol.js';

export type MatchPhase = 'waiting-for-decks' | 'playing' | 'game-over';
type TurnPhase = { type: 'priority'; player: number } | { type: 'initiative' };

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

  private turnPhase: TurnPhase = { type: 'priority', player: 0 };
  private priorityUsed: [boolean, boolean] = [false, false];
  private spawnedThisTurn = new Set<number>();

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

  submitDeck(seat: 0 | 1, deck: number[]): void {
    if (this._phase !== 'waiting-for-decks') throw new Error('Not accepting decks');
    if (deck.length === 0) throw new Error('Deck is empty');
    for (const id of deck) {
      if (!cardRegistry.find(c => c.id === id)) throw new Error(`Invalid card ID: ${id}`);
    }
    this.decks[seat] = deck;
    if (this.decks[0] && this.decks[1]) this.startGame();
  }

  private startGame(): void {
    const seed = this.duelIdToSeed(this.duelId);
    this.ctrl.startGame(seed, [this.decks[0]!, this.decks[1]!]);
    this._phase = 'playing';
    this.advanceTurnPhase();
  }

  // ── Turn phase management ──

  private advanceTurnPhase(depth = 0): void {
    if (depth > 5) return;
    const state = this.ctrl.getState();
    const p0Alive = state.units.filter(u => u.alive && u.playerId === 0).length;
    const p1Alive = state.units.filter(u => u.alive && u.playerId === 1).length;
    const p0Needs = p0Alive === 0 && !this.priorityUsed[0];
    const p1Needs = p1Alive === 0 && !this.priorityUsed[1];

    if (p0Needs && p1Needs) {
      this.turnPhase = { type: 'priority', player: state.rng.rollPercent(50) ? 0 : 1 };
      return;
    }
    if (p0Needs) { this.turnPhase = { type: 'priority', player: 0 }; return; }
    if (p1Needs) { this.turnPhase = { type: 'priority', player: 1 }; return; }

    this.turnPhase = { type: 'initiative' };

    if (this.spawnedThisTurn.size > 0) {
      const skip = this.spawnedThisTurn;
      state.activationQueue = state.activationQueue.filter(u => !skip.has(u.uid));
      state.currentActivationIndex = 0;
    }

    if (this.ctrl.isQueueExhausted()) {
      this.doEndTurnInternal();
      this.advanceTurnPhase(depth + 1);
    }
  }

  private doEndTurnInternal(): void {
    this.ctrl.endTurn();
    this.priorityUsed = [false, false];
    this.spawnedThisTurn.clear();
  }

  private endActivation(events: MatchEvent[]): void {
    this.ctrl.passActivation();
    if (this.ctrl.isQueueExhausted()) {
      this.doEndTurnInternal();
      const s = this.ctrl.getState();
      events.push({ type: 'turn-changed', turnNumber: s.turnNumber });
      events.push({ type: 'queue-rebuilt', queue: s.activationQueue.map(u => u.uid) });
      for (const p of s.players) {
        events.push({ type: 'mana-changed', playerId: p.id, mana: p.mana });
      }
      this.advanceTurnPhase();
    }
    this.pushActivationEvent(events);
  }

  getControllingPlayer(): number {
    if (!this.ctrl.isGameStarted()) return -1;
    if (this.turnPhase.type === 'priority') return this.turnPhase.player;
    return this.ctrl.getControllingPlayer();
  }

  getTurnPhase(): TurnPhase { return this.turnPhase; }

  // ── Action execution ──

  executeAction(seat: number, action: GameAction, hmac = ''): ActionResult {
    if (this._phase !== 'playing') {
      return { ok: false, reason: 'Match not in playing phase', events: [], stateHash: '' };
    }
    const controlling = this.getControllingPlayer();
    if (controlling >= 0 && seat !== controlling) {
      return { ok: false, reason: 'not your turn', events: [], stateHash: '' };
    }

    const events: MatchEvent[] = [];
    let result: { ok: boolean; reason?: string };
    try {
      result = this.processAction(seat, action, events);
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
    this._actionLog.push({ seq: this._seq, action, hmac, timestamp: Date.now() });
    return { ok: true, events, stateHash: hashState(this.ctrl.getState()) };
  }

  private processAction(
    seat: number,
    action: GameAction,
    events: MatchEvent[],
  ): { ok: boolean; reason?: string } {
    const state = this.ctrl.getState();

    switch (action.type) {
      case 'spawn': {
        if (action.playerId !== seat) return { ok: false, reason: 'Cannot spawn for other player' };
        const check = canSpawn(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        if (!check.valid) return { ok: false, reason: check.reason ?? 'Cannot spawn here' };
        const spawned = executeSpawn(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        events.push({ type: 'unit-spawned', unit: { ...spawned } });
        events.push({ type: 'mana-changed', playerId: action.playerId, mana: state.players[action.playerId].mana });

        if (this.turnPhase.type === 'priority') {
          this.spawnedThisTurn.add(spawned.uid);
          this.priorityUsed[seat as 0 | 1] = true;
          this.ctrl.rebuildQueue();
          this.advanceTurnPhase();
          events.push({ type: 'queue-rebuilt', queue: state.activationQueue.map(u => u.uid) });
          this.pushActivationEvent(events);
        } else {
          this.endActivation(events);
        }
        return { ok: true };
      }

      case 'move': {
        if (this.turnPhase.type === 'priority') return { ok: false, reason: 'Cannot move during priority phase' };
        const check = canMove(state, action.unitUid, { col: action.col, row: action.row });
        if (!check.valid) return { ok: false, reason: check.reason ?? 'Cannot move here' };
        const path = executeMove(state, action.unitUid, { col: action.col, row: action.row });
        events.push({ type: 'unit-moved', uid: action.unitUid, path });
        const unit = state.units.find(u => u.uid === action.unitUid);
        if (unit && unit.remainingAp <= 0) {
          this.endActivation(events);
        }
        return { ok: true };
      }

      case 'attack': {
        if (this.turnPhase.type === 'priority') return { ok: false, reason: 'Cannot attack during priority phase' };
        const attacker = state.units.find(u => u.uid === action.attackerUid);
        const target = state.units.find(u => u.uid === action.targetUid);
        if (!attacker || !target) return { ok: false, reason: 'Unit not found' };

        // Direct attack
        if (canAttack(state, action.attackerUid, action.targetUid).valid) {
          this.doAttack(state, action.attackerUid, action.targetUid, events);
          this.endActivation(events);
          return { ok: true };
        }

        // Auto-walk + attack for melee
        const card = getCard(attacker.cardId);
        if (isMelee(card)) {
          const walkHex = this.findAutoWalkHex(state, attacker, target);
          if (walkHex) {
            const path = executeMove(state, attacker.uid, walkHex);
            events.push({ type: 'unit-moved', uid: attacker.uid, path });
            if (canAttack(state, attacker.uid, target.uid).valid) {
              this.doAttack(state, attacker.uid, target.uid, events);
            }
            this.endActivation(events);
            return { ok: true };
          }
        }

        return { ok: false, reason: 'Cannot attack target' };
      }

      case 'attack-hero': {
        if (this.turnPhase.type === 'priority') return { ok: false, reason: 'Cannot attack hero during priority phase' };
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
        this.endActivation(events);
        return { ok: true };
      }

      case 'cast': {
        if (action.playerId !== seat) return { ok: false, reason: 'Cannot cast for other player' };
        const check = canCast(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        if (!check.valid) return { ok: false, reason: check.reason ?? 'Cannot cast' };
        const card = getCard(action.cardId);
        const result = executeCast(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        events.push({
          type: 'spell-cast', playerId: action.playerId,
          cardId: action.cardId, col: action.col, row: action.row,
        });
        if (result.success) {
          for (const affected of result.affectedUnits) {
            if (affected.damage || affected.healed) {
              const u = state.units.find(x => x.uid === affected.uid);
              if (u) events.push({ type: 'hp-changed', uid: affected.uid, hp: u.currentHp });
            }
            if (affected.statusApplied) {
              events.push({ type: 'effect-applied', uid: affected.uid, effectId: affected.statusApplied, duration: card.duration });
            }
            if (affected.died) {
              events.push({ type: 'unit-died', uid: affected.uid });
            }
          }
        }
        events.push({ type: 'mana-changed', playerId: action.playerId, mana: state.players[action.playerId].mana });

        if (this.turnPhase.type === 'priority') {
          this.priorityUsed[seat as 0 | 1] = true;
          this.advanceTurnPhase();
          this.pushActivationEvent(events);
        } else {
          this.endActivation(events);
        }
        return { ok: true };
      }

      case 'pass': {
        if (this.turnPhase.type === 'priority') {
          this.priorityUsed[seat as 0 | 1] = true;
          this.advanceTurnPhase();
          this.pushActivationEvent(events);
          return { ok: true };
        }
        this.endActivation(events);
        return { ok: true };
      }

      case 'end-turn': {
        if (this.turnPhase.type === 'priority') return { ok: false, reason: 'Cannot end turn during priority phase' };
        this.doEndTurnInternal();
        const s = this.ctrl.getState();
        events.push({ type: 'turn-changed', turnNumber: s.turnNumber });
        events.push({ type: 'queue-rebuilt', queue: s.activationQueue.map(u => u.uid) });
        for (const p of s.players) {
          events.push({ type: 'mana-changed', playerId: p.id, mana: p.mana });
        }
        this.advanceTurnPhase();
        this.pushActivationEvent(events);
        return { ok: true };
      }

      default:
        return { ok: false, reason: 'Unknown action type' };
    }
  }

  private doAttack(state: GameState, attackerUid: number, targetUid: number, events: MatchEvent[]): void {
    const target = state.units.find(u => u.uid === targetUid)!;
    const attacker = state.units.find(u => u.uid === attackerUid)!;
    const result = executeAttack(state, attackerUid, targetUid);
    events.push({
      type: 'unit-attacked',
      attackerUid, targetUid,
      damage: result.damage,
      retaliation: result.retaliation?.damage ?? 0,
      attackerHp: attacker.currentHp,
      targetHp: target.currentHp,
      crit: result.isCrit,
    });
    if (result.targetDied) events.push({ type: 'unit-died', uid: targetUid });
    if (result.retaliation?.attackerDied) events.push({ type: 'unit-died', uid: attackerUid });
  }

  private findAutoWalkHex(state: GameState, attacker: UnitInstance, target: UnitInstance): HexCoord | null {
    if (isBuilding(getCard(attacker.cardId)) || isRanged(getCard(attacker.cardId))) return null;
    const moveBudget = attacker.remainingAp - 1;
    if (moveBudget <= 0) return null;

    const center = { x: (attacker.col + target.col) / 2, y: (attacker.row + target.row) / 2 };
    return getAutoWalkHex(state, attacker.uid, target.uid, center);
  }

  private pushActivationEvent(events: MatchEvent[]): void {
    if (this.turnPhase.type === 'priority') {
      events.push({ type: 'activation-changed', uid: null });
      return;
    }
    const unit = this.ctrl.getCurrentUnit();
    events.push({ type: 'activation-changed', uid: unit ? unit.uid : null });
  }

  // ── Win / Timeout / Snapshots ──

  checkWin(): { winner: number; reason: string } | null {
    if (!this.ctrl.isGameStarted()) return null;
    const result = checkWinCondition(this.ctrl.getState());
    if (!result) return null;
    return { winner: result.winner, reason: 'Hero defeated' };
  }

  applyTimeout(): MatchEvent[] {
    const controlling = this.getControllingPlayer();
    if (controlling < 0) return [];

    const state = this.ctrl.getState();
    const player = state.players[controlling];
    const damageIndex = Math.min(player.timeoutCount, TIMEOUT_DAMAGE.length - 1);
    const damage = TIMEOUT_DAMAGE[damageIndex];
    player.timeoutCount++;
    player.heroHp = Math.max(0, player.heroHp - damage);

    const events: MatchEvent[] = [
      { type: 'hero-hp-changed', playerId: controlling, hp: player.heroHp },
    ];

    if (this.turnPhase.type === 'priority') {
      this.priorityUsed[controlling as 0 | 1] = true;
      this.advanceTurnPhase();
    } else {
      this.endActivation(events);
    }
    this.pushActivationEvent(events);

    const winResult = this.checkWin();
    if (winResult) {
      this._phase = 'game-over';
      this._winner = winResult.winner;
      this._winReason = 'timeout';
    }

    this._seq++;
    this._actionLog.push({ seq: this._seq, action: { type: 'pass' }, hmac: 'timeout', timestamp: Date.now() });
    return events;
  }

  getSnapshot(): SerializedGameState { return serializeState(this.ctrl.getState()); }
  getSnapshotForSeat(seat: 0 | 1): SerializedGameState { return serializeStateForSeat(this.ctrl.getState(), seat); }

  forfeit(losingSeat: 0 | 1): void {
    this._phase = 'game-over';
    this._winner = losingSeat === 0 ? 1 : 0;
    this._winReason = 'opponent disconnected';
  }

  getStateForTest(): GameState { return this.ctrl.getState(); }

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
