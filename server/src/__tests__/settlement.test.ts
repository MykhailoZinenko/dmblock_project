import { describe, it, expect, vi, afterEach } from 'vitest';
import { initSettlement, submitSignature, getSettlement, cleanupSettlement, startArbiterTimeout } from '../settlement.js';

describe('settlement', () => {
  afterEach(() => {
    cleanupSettlement(1);
    cleanupSettlement(2);
  });

  describe('initSettlement', () => {
    it('creates a settlement state', () => {
      const state = initSettlement(1, '0xWinner');
      expect(state.duelId).toBe(1);
      expect(state.winnerAddress).toBe('0xWinner');
      expect(state.signatures).toEqual([null, null]);
    });

    it('is retrievable after creation', () => {
      initSettlement(1, '0xWinner');
      expect(getSettlement(1)).toBeDefined();
      expect(getSettlement(1)!.winnerAddress).toBe('0xWinner');
    });
  });

  describe('submitSignature', () => {
    it('records signature for a seat', () => {
      initSettlement(1, '0xWinner');
      const result = submitSignature(1, 0, '0xSig0');
      expect(result.complete).toBe(false);
      expect(result.signatures[0]).toBe('0xSig0');
      expect(result.signatures[1]).toBeNull();
    });

    it('returns complete when both signatures collected', () => {
      initSettlement(1, '0xWinner');
      submitSignature(1, 0, '0xSig0');
      const result = submitSignature(1, 1, '0xSig1');
      expect(result.complete).toBe(true);
      expect(result.signatures).toEqual(['0xSig0', '0xSig1']);
    });

    it('throws when no settlement exists', () => {
      expect(() => submitSignature(999, 0, '0xSig')).toThrow('No settlement in progress');
    });
  });

  describe('cleanupSettlement', () => {
    it('removes settlement state', () => {
      initSettlement(1, '0xWinner');
      cleanupSettlement(1);
      expect(getSettlement(1)).toBeUndefined();
    });

    it('is safe to call on nonexistent settlement', () => {
      expect(() => cleanupSettlement(999)).not.toThrow();
    });
  });

  describe('startArbiterTimeout', () => {
    it('calls callback after timeout', () => {
      vi.useFakeTimers();
      initSettlement(1, '0xWinner');
      const cb = vi.fn();
      startArbiterTimeout(1, cb);
      vi.advanceTimersByTime(120_001);
      expect(cb).toHaveBeenCalledWith(1, '0xWinner');
      vi.useRealTimers();
    });

    it('does not call callback before timeout', () => {
      vi.useFakeTimers();
      initSettlement(1, '0xWinner');
      const cb = vi.fn();
      startArbiterTimeout(1, cb);
      vi.advanceTimersByTime(60_000);
      expect(cb).not.toHaveBeenCalled();
      vi.useRealTimers();
      cleanupSettlement(1);
    });

    it('timeout is cancelled by cleanup', () => {
      vi.useFakeTimers();
      initSettlement(1, '0xWinner');
      const cb = vi.fn();
      startArbiterTimeout(1, cb);
      cleanupSettlement(1);
      vi.advanceTimersByTime(200_000);
      expect(cb).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
