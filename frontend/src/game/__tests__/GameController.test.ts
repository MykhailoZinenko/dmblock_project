import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameController } from '../GameController';
import { DamageType } from '../types';
import type { UnitInstance } from '../types';
import { STARTING_MANA, MANA_PER_TURN, MANA_CAP } from '../constants';

function makeUnit(overrides: Partial<UnitInstance> & { uid: number; playerId: number }): UnitInstance {
  return {
    cardId: 1, col: 0, row: 0,
    currentHp: 10, maxHp: 10, attack: 5, defense: 3,
    initiative: 10, speed: 3, ammo: 0, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    remainingAp: 3, retaliatedThisTurn: false, alive: true,
    cooldowns: {}, garrisonedIn: null, polymorphed: false, cursed: false,
    occupiedCells: [],
    ...overrides,
  };
}

function passAll(ctrl: GameController) {
  while (!ctrl.isQueueExhausted()) {
    ctrl.passActivation();
  }
  ctrl.endTurn();
}

describe('GameController', () => {
  let ctrl: GameController;

  beforeEach(() => {
    ctrl = new GameController();
  });

  describe('startGame', () => {
    it('sets phase to ACTIVATION and turnNumber to 1', () => {
      ctrl.startGame(42);
      expect(ctrl.getPhase()).toBe('ACTIVATION');
      expect(ctrl.getTurnNumber()).toBe(1);
    });

    it('with no units, getCurrentUnit returns null', () => {
      ctrl.startGame(42);
      expect(ctrl.getCurrentUnit()).toBeNull();
    });

    it('emits turnStart on startGame', () => {
      const cb = vi.fn();
      ctrl.on('turnStart', cb);
      ctrl.startGame(42);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('emits stateChange on startGame', () => {
      const cb = vi.fn();
      ctrl.on('stateChange', cb);
      ctrl.startGame(42);
      expect(cb).toHaveBeenCalled();
    });

    it('sets starting mana for both players', () => {
      ctrl.startGame(42);
      const state = ctrl.getState();
      expect(state.players[0].mana).toBe(STARTING_MANA);
      expect(state.players[1].mana).toBe(STARTING_MANA);
    });
  });

  describe('with units', () => {
    let unitA: UnitInstance;
    let unitB: UnitInstance;
    let unitC: UnitInstance;

    beforeEach(() => {
      ctrl.startGame(42);
      const state = ctrl.getState();
      unitA = makeUnit({ uid: 1, playerId: 0, initiative: 20, speed: 5 });
      unitB = makeUnit({ uid: 2, playerId: 1, initiative: 15, speed: 4 });
      unitC = makeUnit({ uid: 3, playerId: 0, initiative: 10, speed: 3 });
      state.units.push(unitA, unitB, unitC);
      ctrl.rebuildQueue();
    });

    it('getCurrentUnit returns highest initiative unit', () => {
      expect(ctrl.getCurrentUnit()!.uid).toBe(unitA.uid);
    });

    it('getControllingPlayer returns correct player ID', () => {
      expect(ctrl.getControllingPlayer()).toBe(0);
    });

    it('passActivation advances to next unit', () => {
      ctrl.passActivation();
      expect(ctrl.getCurrentUnit()!.uid).toBe(unitB.uid);
      expect(ctrl.getControllingPlayer()).toBe(1);
    });

    it('passActivation emits activationEnd then activationStart', () => {
      const endCb = vi.fn();
      const startCb = vi.fn();
      ctrl.on('activationEnd', endCb);
      ctrl.on('activationStart', startCb);
      ctrl.passActivation();
      expect(endCb).toHaveBeenCalledTimes(1);
      expect(startCb).toHaveBeenCalledTimes(1);
    });

    it('passActivation emits stateChange', () => {
      const cb = vi.fn();
      ctrl.on('stateChange', cb);
      ctrl.passActivation();
      expect(cb).toHaveBeenCalled();
    });

    it('isQueueExhausted is false during activations, true after all pass', () => {
      expect(ctrl.isQueueExhausted()).toBe(false);
      ctrl.passActivation();
      expect(ctrl.isQueueExhausted()).toBe(false);
      ctrl.passActivation();
      expect(ctrl.isQueueExhausted()).toBe(false);
      ctrl.passActivation();
      expect(ctrl.isQueueExhausted()).toBe(true);
    });

    it('passActivation on last unit does not auto-call endTurn', () => {
      ctrl.passActivation();
      ctrl.passActivation();
      ctrl.passActivation();
      expect(ctrl.isQueueExhausted()).toBe(true);
      expect(ctrl.getTurnNumber()).toBe(1);
    });

    it('endTurn increments turnNumber', () => {
      passAll(ctrl);
      expect(ctrl.getTurnNumber()).toBe(2);
    });

    it('endTurn increments mana for both players', () => {
      passAll(ctrl);
      const state = ctrl.getState();
      expect(state.players[0].mana).toBe(STARTING_MANA + MANA_PER_TURN);
      expect(state.players[1].mana).toBe(STARTING_MANA + MANA_PER_TURN);
    });

    it('mana caps at MANA_CAP', () => {
      const state = ctrl.getState();
      state.players[0].mana = MANA_CAP;
      state.players[1].mana = MANA_CAP - 1;
      passAll(ctrl);
      expect(state.players[0].mana).toBe(MANA_CAP);
      expect(state.players[1].mana).toBe(MANA_CAP);
    });

    it('endTurn resets AP and retaliation flags on alive units', () => {
      const state = ctrl.getState();
      state.units[0].remainingAp = 0;
      state.units[0].retaliatedThisTurn = true;
      state.units[1].remainingAp = 0;
      state.units[1].retaliatedThisTurn = true;
      passAll(ctrl);
      for (const unit of state.units) {
        if (unit.alive) {
          expect(unit.remainingAp).toBe(unit.speed);
          expect(unit.retaliatedThisTurn).toBe(false);
        }
      }
    });

    it('endTurn rebuilds initiative queue and resets activation index', () => {
      passAll(ctrl);
      const state = ctrl.getState();
      expect(state.currentActivationIndex).toBe(0);
      expect(state.activationQueue.length).toBe(3);
      expect(state.activationQueue[0].uid).toBe(unitA.uid);
    });

    it('multiple turns cycle correctly', () => {
      expect(ctrl.getTurnNumber()).toBe(1);
      passAll(ctrl);
      expect(ctrl.getTurnNumber()).toBe(2);
      passAll(ctrl);
      expect(ctrl.getTurnNumber()).toBe(3);
      const state = ctrl.getState();
      expect(state.players[0].mana).toBe(STARTING_MANA + 2 * MANA_PER_TURN);
    });

    it('dead units are excluded from queue on rebuild', () => {
      unitB.alive = false;
      passAll(ctrl);
      const state = ctrl.getState();
      expect(state.activationQueue.length).toBe(2);
      expect(state.activationQueue.find(u => u.uid === unitB.uid)).toBeUndefined();
    });
  });

  describe('event system', () => {
    it('on/off correctly registers and removes listeners', () => {
      const cb = vi.fn();
      ctrl.on('turnStart', cb);
      ctrl.startGame(42);
      expect(cb).toHaveBeenCalledTimes(1);
      ctrl.off('turnStart', cb);
      ctrl.startGame(99);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('off on unregistered event does not throw', () => {
      expect(() => ctrl.off('gameOver', vi.fn())).not.toThrow();
    });

    it('multiple listeners on same event all fire', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      ctrl.on('turnStart', cb1);
      ctrl.on('turnStart', cb2);
      ctrl.startGame(42);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('activationStart fires on rebuildQueue when units exist', () => {
      ctrl.startGame(42);
      const state = ctrl.getState();
      state.units.push(makeUnit({ uid: 1, playerId: 0, initiative: 10, speed: 3 }));
      const cb = vi.fn();
      ctrl.on('activationStart', cb);
      ctrl.rebuildQueue();
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('getControllingPlayer returns -1 when no units', () => {
      ctrl.startGame(42);
      expect(ctrl.getControllingPlayer()).toBe(-1);
    });

    it('passActivation with no units does nothing', () => {
      ctrl.startGame(42);
      expect(() => ctrl.passActivation()).not.toThrow();
    });

    it('isQueueExhausted is true when no units', () => {
      ctrl.startGame(42);
      expect(ctrl.isQueueExhausted()).toBe(true);
    });

    it('getState returns the internal state', () => {
      ctrl.startGame(42);
      const state = ctrl.getState();
      expect(state).toBeDefined();
      expect(state.players).toHaveLength(2);
      expect(state.board).toBeDefined();
      expect(state.rng).toBeDefined();
    });
  });
});
