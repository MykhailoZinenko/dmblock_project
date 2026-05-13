import { createGameState } from './GameState';
import type { GameState } from './GameState';
import { buildInitiativeQueue } from './initiative';
import { MANA_PER_TURN, MANA_CAP } from './constants';
import type { UnitInstance, GamePhase } from './types';
import { tickStatusEffects, tickUnitEffects } from './actions/castSpell';

export type GameEvent =
  | 'turnStart'
  | 'activationStart'
  | 'activationEnd'
  | 'turnEnd'
  | 'unitSpawned'
  | 'unitMoved'
  | 'unitAttacked'
  | 'unitDied'
  | 'spellCast'
  | 'effectExpired'
  | 'gameOver'
  | 'stateChange';

export class GameController {
  /** Set in `startGame`. Multiplayer UI may render before decks finish exchanging. */
  private state: GameState | undefined;
  private listeners: Map<GameEvent, Set<Function>> = new Map();

  constructor() {}

  private requireState(): GameState {
    if (this.state === undefined) {
      throw new Error('GameController: used before startGame()');
    }
    return this.state;
  }

  // --- Lifecycle ---

  /** True after `startGame` — multiplayer may have a controller instance while decks are still exchanging. */
  isGameStarted(): boolean {
    return this.state !== undefined;
  }

  startGame(seed: number, decks?: [number[], number[]]): void {
    this.state = createGameState(seed, decks);
    this.state.turnNumber = 1;
    this.state.phase = 'ACTIVATION';
    this.state.activationQueue = buildInitiativeQueue(this.state.units, this.state.rng);
    this.state.currentActivationIndex = 0;
    this.emit('stateChange', this.state);
    this.emit('turnStart', { turnNumber: this.state.turnNumber });
    if (this.state.activationQueue.length > 0) {
      this.emit('activationStart', { unit: this.state.activationQueue[0] });
    }
  }

  // --- Getters ---

  getState(): GameState {
    return this.requireState();
  }

  getCurrentUnit(): UnitInstance | null {
    const s = this.state;
    if (
      s === undefined ||
      !s.activationQueue.length ||
      s.currentActivationIndex >= s.activationQueue.length
    ) {
      return null;
    }
    return s.activationQueue[s.currentActivationIndex];
  }

  getControllingPlayer(): number {
    const unit = this.getCurrentUnit();
    return unit ? unit.playerId : -1;
  }

  getTurnNumber(): number {
    return this.requireState().turnNumber;
  }

  getPhase(): GamePhase {
    return this.requireState().phase;
  }

  // --- Turn actions ---

  passActivation(): void {
    const s = this.requireState();
    if (!s.activationQueue.length) {
      return;
    }
    this.nextActivation();
  }

  rebuildQueue(): void {
    const s = this.requireState();
    s.activationQueue = buildInitiativeQueue(s.units, s.rng);
    s.currentActivationIndex = 0;
    this.emit('stateChange', s);
    if (s.activationQueue.length > 0) {
      this.emit('activationStart', { unit: s.activationQueue[0] });
    }
  }

  private nextActivation(): void {
    const s = this.requireState();
    const currentUnit = this.getCurrentUnit();
    if (currentUnit && currentUnit.alive) {
      tickUnitEffects(currentUnit);
    }
    this.emit('activationEnd', { unit: currentUnit });

    s.currentActivationIndex++;

    // Skip dead units
    while (
      s.currentActivationIndex < s.activationQueue.length &&
      !s.activationQueue[s.currentActivationIndex].alive
    ) {
      s.currentActivationIndex++;
    }

    this.emit('stateChange', s);

    if (s.currentActivationIndex < s.activationQueue.length) {
      this.emit('activationStart', {
        unit: s.activationQueue[s.currentActivationIndex],
      });
    }
  }

  isQueueExhausted(): boolean {
    const s = this.requireState();
    return s.currentActivationIndex >= s.activationQueue.length;
  }

  endTurn(): void {
    const s = this.requireState();
    s.turnNumber++;

    // Expire status effects FIRST — before AP reset, mana, queue rebuild
    const expiredUids = tickStatusEffects(s);
    for (const uid of expiredUids) {
      this.emit('effectExpired', { uid });
    }

    // Add mana (capped)
    for (const player of s.players) {
      player.mana = Math.min(player.mana + MANA_PER_TURN, MANA_CAP);
    }

    // Draw a card for each player (if deck has cards and hand not full)
    const HAND_LIMIT = 6;
    for (const p of s.players) {
      if (p.deck.length > 0 && p.hand.length < HAND_LIMIT) {
        p.hand.push(p.deck.shift()!);
      }
    }

    // Reset alive units (after effects cleared so speed is restored)
    for (const unit of s.units) {
      if (unit.alive) {
        unit.remainingAp = unit.speed;
        unit.retaliatedThisTurn = false;
      }
    }

    // Rebuild queue
    s.activationQueue = buildInitiativeQueue(s.units, s.rng);
    s.currentActivationIndex = 0;
    s.phase = 'ACTIVATION';

    this.emit('stateChange', s);
    this.emit('turnEnd', { turnNumber: s.turnNumber - 1 });
    this.emit('turnStart', { turnNumber: s.turnNumber });

    if (s.activationQueue.length > 0) {
      this.emit('activationStart', { unit: s.activationQueue[0] });
    }
  }

  // --- Event system ---

  on(event: GameEvent, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: GameEvent, callback: Function): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  private emit(event: GameEvent, data?: any): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }
}
