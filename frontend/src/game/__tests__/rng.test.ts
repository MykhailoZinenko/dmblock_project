import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng';

describe('SeededRNG', () => {
  describe('determinism', () => {
    it('same seed produces identical sequence of 100+ values', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const values1: number[] = [];
      const values2: number[] = [];

      for (let i = 0; i < 150; i++) {
        values1.push(rng1.next());
        values2.push(rng2.next());
      }

      expect(values1).toEqual(values2);
    });

    it('different seeds produce different sequences', () => {
      const rng1 = new SeededRNG(1);
      const rng2 = new SeededRNG(2);
      const values1: number[] = [];
      const values2: number[] = [];

      for (let i = 0; i < 20; i++) {
        values1.push(rng1.next());
        values2.push(rng2.next());
      }

      // At least some values should differ
      const allSame = values1.every((v, i) => v === values2[i]);
      expect(allSame).toBe(false);
    });
  });

  describe('next()', () => {
    it('returns values in [0, 1)', () => {
      const rng = new SeededRNG(123);
      for (let i = 0; i < 1000; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('nextInt()', () => {
    it('always returns integer in [min, max) over 1000+ rolls', () => {
      const rng = new SeededRNG(999);
      for (let i = 0; i < 2000; i++) {
        const val = rng.nextInt(3, 10);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(3);
        expect(val).toBeLessThan(10);
      }
    });

    it('handles min=0 correctly', () => {
      const rng = new SeededRNG(555);
      for (let i = 0; i < 500; i++) {
        const val = rng.nextInt(0, 5);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(5);
      }
    });

    it('handles range of 1 (always returns min)', () => {
      const rng = new SeededRNG(777);
      for (let i = 0; i < 100; i++) {
        expect(rng.nextInt(7, 8)).toBe(7);
      }
    });

    it('distribution is roughly uniform (bucket test)', () => {
      const rng = new SeededRNG(12345);
      const buckets = [0, 0, 0, 0, 0]; // 5 buckets for nextInt(0, 5)
      const rolls = 10000;

      for (let i = 0; i < rolls; i++) {
        buckets[rng.nextInt(0, 5)]++;
      }

      const expected = rolls / 5;
      for (const count of buckets) {
        // Each bucket should be within 10% of expected
        expect(count).toBeGreaterThan(expected * 0.85);
        expect(count).toBeLessThan(expected * 1.15);
      }
    });

    it('nextInt(0, 2) is roughly 50/50 over many rolls (no bias)', () => {
      const rng = new SeededRNG(54321);
      let zeros = 0;
      let ones = 0;
      const rolls = 10000;

      for (let i = 0; i < rolls; i++) {
        const val = rng.nextInt(0, 2);
        if (val === 0) zeros++;
        else ones++;
      }

      // Should be within 5% of 50%
      expect(zeros / rolls).toBeGreaterThan(0.45);
      expect(zeros / rolls).toBeLessThan(0.55);
      expect(ones / rolls).toBeGreaterThan(0.45);
      expect(ones / rolls).toBeLessThan(0.55);
    });
  });

  describe('rollPercent()', () => {
    it('threshold 0 always returns false', () => {
      const rng = new SeededRNG(100);
      for (let i = 0; i < 500; i++) {
        expect(rng.rollPercent(0)).toBe(false);
      }
    });

    it('threshold 100 always returns true', () => {
      const rng = new SeededRNG(200);
      for (let i = 0; i < 500; i++) {
        expect(rng.rollPercent(100)).toBe(true);
      }
    });

    it('threshold 50 is approximately 50% over 1000+ rolls', () => {
      const rng = new SeededRNG(300);
      let trueCount = 0;
      const rolls = 5000;

      for (let i = 0; i < rolls; i++) {
        if (rng.rollPercent(50)) trueCount++;
      }

      const ratio = trueCount / rolls;
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.55);
    });

    it('threshold 75 produces roughly 75% true', () => {
      const rng = new SeededRNG(400);
      let trueCount = 0;
      const rolls = 5000;

      for (let i = 0; i < rolls; i++) {
        if (rng.rollPercent(75)) trueCount++;
      }

      const ratio = trueCount / rolls;
      expect(ratio).toBeGreaterThan(0.70);
      expect(ratio).toBeLessThan(0.80);
    });
  });

  describe('serialize / deserialize', () => {
    it('advance 50 steps, serialize, deserialize, both produce identical next 50 values', () => {
      const rng = new SeededRNG(42);

      // Advance 50 steps
      for (let i = 0; i < 50; i++) {
        rng.next();
      }

      const state = rng.serialize();
      const restored = SeededRNG.deserialize(state);

      // Both should produce identical next 50 values
      for (let i = 0; i < 50; i++) {
        expect(rng.next()).toBe(restored.next());
      }
    });

    it('serialize returns a number', () => {
      const rng = new SeededRNG(42);
      rng.next();
      const state = rng.serialize();
      expect(typeof state).toBe('number');
    });

    it('deserialized RNG continues the sequence correctly', () => {
      const rng1 = new SeededRNG(99);
      const fullSequence: number[] = [];

      // Generate 100 values from original
      for (let i = 0; i < 100; i++) {
        fullSequence.push(rng1.next());
      }

      // Now start fresh, advance 50, serialize, restore, get next 50
      const rng2 = new SeededRNG(99);
      for (let i = 0; i < 50; i++) {
        rng2.next();
      }
      const restored = SeededRNG.deserialize(rng2.serialize());
      const restoredValues: number[] = [];
      for (let i = 0; i < 50; i++) {
        restoredValues.push(restored.next());
      }

      expect(restoredValues).toEqual(fullSequence.slice(50));
    });
  });

  describe('edge cases', () => {
    it('seed 0 works and produces valid values', () => {
      const rng = new SeededRNG(0);
      for (let i = 0; i < 100; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('negative seed works and produces valid values', () => {
      const rng = new SeededRNG(-12345);
      for (let i = 0; i < 100; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('very large seed works and produces valid values', () => {
      const rng = new SeededRNG(2147483647); // Max 32-bit signed int
      for (let i = 0; i < 100; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('negative seed produces different sequence than positive', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(-42);

      const v1 = rng1.next();
      const v2 = rng2.next();
      expect(v1).not.toBe(v2);
    });
  });
});
