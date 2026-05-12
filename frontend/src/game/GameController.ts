import { createGameState } from './GameState';
import type { GameState } from './GameState';
import { buildInitiativeQueue } from './initiative';
import { MANA_PER_TURN, MANA_CAP } from './constants';
import type { UnitInstance, GamePhase } from './types';
import { tickStatusEffects } from './actions/castSpell';

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
  private state!: GameState;
  private listeners: Map<GameEvent, Set<Function>> = new Map();

  constructor() {}

  // --- Lifecycle ---

  startGame(seed: number): void {
    this.state = createGameState(seed);
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
    return this.state;
  }

  getCurrentUnit(): UnitInstance | null {
    if (
      !this.state.activationQueue.length ||
      this.state.currentActivationIndex >= this.state.activationQueue.length
    ) {
      return null;
    }
    return this.state.activationQueue[this.state.currentActivationIndex];
  }

  getControllingPlayer(): number {
    const unit = this.getCurrentUnit();
    return unit ? unit.playerId : -1;
  }

  getTurnNumber(): number {
    return this.state.turnNumber;
  }

  getPhase(): GamePhase {
    return this.state.phase;
  }

  // --- Turn actions ---

  passActivation(): void {
    if (!this.state.activationQueue.length) {
      return;
    }
    this.nextActivation();
  }

  rebuildQueue(): void {
    this.state.activationQueue = buildInitiativeQueue(this.state.units, this.state.rng);
    this.state.currentActivationIndex = 0;
    this.emit('stateChange', this.state);
    if (this.state.activationQueue.length > 0) {
      this.emit('activationStart', { unit: this.state.activationQueue[0] });
    }
  }

  private nextActivation(): void {
    const currentUnit = this.getCurrentUnit();
    this.emit('activationEnd', { unit: currentUnit });

    this.state.currentActivationIndex++;

    // Skip dead units
    while (
      this.state.currentActivationIndex < this.state.activationQueue.length &&
      !this.state.activationQueue[this.state.currentActivationIndex].alive
    ) {
      this.state.currentActivationIndex++;
    }

    this.emit('stateChange', this.state);

    if (this.state.currentActivationIndex < this.state.activationQueue.length) {
      this.emit('activationStart', {
        unit: this.state.activationQueue[this.state.currentActivationIndex],
      });
    }
  }

  isQueueExhausted(): boolean {
    return this.state.currentActivationIndex >= this.state.activationQueue.length;
  }

  endTurn(): void {
    this.state.turnNumber++;

    // Add mana (capped)
    for (const player of this.state.players) {
      player.mana = Math.min(player.mana + MANA_PER_TURN, MANA_CAP);
    }

    // Reset alive units
    for (const unit of this.state.units) {
      if (unit.alive) {
        unit.remainingAp = unit.speed;
        unit.retaliatedThisTurn = false;
      }
    }

    const expiredUids = tickStatusEffects(this.state);
    for (const uid of expiredUids) {
      this.emit('effectExpired', { uid });
    }

    // Rebuild queue
    this.state.activationQueue = buildInitiativeQueue(this.state.units, this.state.rng);
    this.state.currentActivationIndex = 0;
    this.state.phase = 'ACTIVATION';

    this.emit('stateChange', this.state);
    this.emit('turnEnd', { turnNumber: this.state.turnNumber - 1 });
    this.emit('turnStart', { turnNumber: this.state.turnNumber });

    if (this.state.activationQueue.length > 0) {
      this.emit('activationStart', { unit: this.state.activationQueue[0] });
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
