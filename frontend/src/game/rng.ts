/**
 * Deterministic seeded PRNG using the mulberry32 algorithm.
 *
 * SECURITY-CRITICAL: This class is the sole source of randomness for the
 * battle engine. Same seed must produce identical results across all clients.
 * NEVER use Math.random() in game logic — use this class instead.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0; // Coerce to 32-bit integer
  }

  /**
   * Returns a float in [0, 1) and advances the internal state.
   * Uses the mulberry32 algorithm for deterministic output.
   */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer in [min, max).
   */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  /**
   * Returns true if the roll is below the threshold (0-100 scale).
   * threshold 0  → always false
   * threshold 100 → always true
   */
  rollPercent(threshold: number): boolean {
    if (threshold <= 0) return false;
    if (threshold >= 100) return true;
    return this.next() * 100 < threshold;
  }

  /**
   * Returns the current internal state for save/restore.
   */
  serialize(): number {
    return this.state;
  }

  /**
   * Restores a SeededRNG from a previously serialized state.
   */
  static deserialize(state: number): SeededRNG {
    const rng = new SeededRNG(0);
    rng.state = state;
    return rng;
  }
}
