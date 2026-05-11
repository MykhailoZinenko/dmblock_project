import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameController } from '../GameController';
import { DamageType, UnitInstance } from '../types';
import { STARTING_MANA, MANA_PER_TURN, MANA_CAP } from '../constants';

function makeUnit(overrides: Partial<UnitInstance> & { uid: number; playerId: number }): UnitInstance {
  return {
    cardId: 1,
    col: 0,
    row: 0,
    currentHp: 10,
    maxHp: 10,
    attack: 5,
    defense: 3,
    initiative: 10,
    speed: 3,
    ammo: 0,
    magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    remainingAp: 3,
    retaliatedThisTurn: false,
    alive: true,
    cooldowns: {},
    garrisonedIn: null,
    polymorphed: false,
    cursed: false,
    occupiedCells: [],
    ...overrides,
  };
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

      // Unit A: initiative 20 (highest), player 0
      unitA = makeUnit({ uid: 1, playerId: 0, initiative: 20, speed: 5 });
      // Unit B: initiative 15, player 1
      unitB = makeUnit({ uid: 2, playerId: 1, initiative: 15, speed: 4 });
      // Unit C: initiative 10, player 0
      unitC = makeUnit({ uid: 3, playerId: 0, initiative: 10, speed: 3 });

      state.units.push(unitA, unitB, unitC);
      ctrl.rebuildQueue();
    });

    it('getCurrentUnit returns highest initiative unit', () => {
      const current = ctrl.getCurrentUnit();
      expect(current).not.toBeNull();
      expect(current!.uid).toBe(unitA.uid);
    });

    it('getControllingPlayer returns correct player ID', () => {
      expect(ctrl.getControllingPlayer()).toBe(0); // unitA is player 0
    });

    it('passActivation advances to next unit', () => {
      ctrl.passActivation();
      const current = ctrl.getCurrentUnit();
      expect(current).not.toBeNull();
      expect(current!.uid).toBe(unitB.uid);
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

    it('passActivation on last unit triggers endTurn', () => {
      const turnEndCb = vi.fn();
      const turnStartCb = vi.fn();
      ctrl.on('turnEnd', turnEndCb);
      ctrl.on('turnStart', turnStartCb);

      // Pass all three units
      ctrl.passActivation(); // A -> B
      ctrl.passActivation(); // B -> C
      ctrl.passActivation(); // C -> end of turn

      expect(turnEndCb).toHaveBeenCalledTimes(1);
      expect(turnStartCb).toHaveBeenCalledTimes(1);
      expect(ctrl.getTurnNumber()).toBe(2);
    });

    it('endTurn increments turnNumber', () => {
      // Pass all to trigger endTurn
      ctrl.passActivation();
      ctrl.passActivation();
      ctrl.passActivation();
      expect(ctrl.getTurnNumber()).toBe(2);
    });

    it('endTurn increments mana for both players', () => {
      ctrl.passActivation();
      ctrl.passActivation();
      ctrl.passActivation();
      const state = ctrl.getState();
      expect(state.players[0].mana).toBe(STARTING_MANA + MANA_PER_TURN);
      expect(state.players[1].mana).toBe(STARTING_MANA + MANA_PER_TURN);
    });

    it('mana caps at MANA_CAP', () => {
      const state = ctrl.getState();
      state.players[0].mana = MANA_CAP;
      state.players[1].mana = MANA_CAP - 1;

      // Trigger endTurn
      ctrl.passActivation();
      ctrl.passActivation();
      ctrl.passActivation();

      expect(state.players[0].mana).toBe(MANA_CAP);
      expect(state.players[1].mana).toBe(MANA_CAP);
    });

    it('endTurn resets AP and retaliation flags on alive units', () => {
      const state = ctrl.getState();
      state.units[0].remainingAp = 0;
      state.units[0].retaliatedThisTurn = true;
      state.units[1].remainingAp = 0;
      state.units[1].retaliatedThisTurn = true;

      // Trigger endTurn
      ctrl.passActivation();
      ctrl.passActivation();
      ctrl.passActivation();

      for (const unit of state.units) {
        if (unit.alive) {
          expect(unit.remainingAp).toBe(unit.speed);
          expect(unit.retaliatedThisTurn).toBe(false);
        }
      }
    });

    it('endTurn rebuilds initiative queue and resets activation index', () => {
      ctrl.passActivation();
      ctrl.passActivation();
      ctrl.passActivation();

      const state = ctrl.getState();
      expect(state.currentActivationIndex).toBe(0);
      expect(state.activationQueue.length).toBe(3);
      // First in queue should still be highest initiative
      expect(state.activationQueue[0].uid).toBe(unitA.uid);
    });

    it('multiple turns cycle correctly', () => {
      // Turn 1
      expect(ctrl.getTurnNumber()).toBe(1);
      ctrl.passActivation();
      ctrl.passActivation();
      ctrl.passActivation();

      // Turn 2
      expect(ctrl.getTurnNumber()).toBe(2);
      ctrl.passActivation();
      ctrl.passActivation();
      ctrl.passActivation();

      // Turn 3
      expect(ctrl.getTurnNumber()).toBe(3);
      const state = ctrl.getState();
      expect(state.players[0].mana).toBe(STARTING_MANA + 2 * MANA_PER_TURN);
    });

    it('dead units are excluded from queue on rebuild', () => {
      const state = ctrl.getState();
      unitB.alive = false;

      // Current queue still has 3 (built before death), pass all to trigger endTurn + rebuild
      ctrl.passActivation(); // A -> B
      ctrl.passActivation(); // B -> C
      ctrl.passActivation(); // C -> endTurn rebuilds queue

      // After rebuild, queue should only have 2 alive units
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
      // Trigger another turnStart by ending turn (no units, so passActivation won't work)
      // Just call startGame again to get turnStart
      ctrl.startGame(99);
      // cb should not be called again
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('off on unregistered event does not throw', () => {
      const cb = vi.fn();
      expect(() => ctrl.off('gameOver', cb)).not.toThrow();
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

  describe('getControllingPlayer edge cases', () => {
    it('returns -1 when no units', () => {
      ctrl.startGame(42);
      expect(ctrl.getControllingPlayer()).toBe(-1);
    });
  });

  describe('no units passActivation', () => {
    it('passActivation with no units does nothing harmful', () => {
      ctrl.startGame(42);
      // Should not throw
      expect(() => ctrl.passActivation()).not.toThrow();
    });
  });

  describe('getState returns the internal state', () => {
    it('returns the game state object', () => {
      ctrl.startGame(42);
      const state = ctrl.getState();
      expect(state).toBeDefined();
      expect(state.players).toHaveLength(2);
      expect(state.board).toBeDefined();
      expect(state.rng).toBeDefined();
    });
  });
});
