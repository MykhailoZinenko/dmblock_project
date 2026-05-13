import { describe, it, expect } from 'vitest';
import {
  hex2px,
  px2hex,
  hexDistance,
  hexNeighbors,
  hexRing,
  hexesInRadius,
  isValidCell,
  hexDirection,
  offsetToCube,
} from '../hexUtils';
import { GRID_COLS, GRID_ROWS, HEX_SIZE } from '../constants';

const S3 = Math.sqrt(3);

describe('isValidCell', () => {
  it('accepts (0,0)', () => {
    expect(isValidCell(0, 0)).toBe(true);
  });

  it('accepts (14,10) — max corner', () => {
    expect(isValidCell(14, 10)).toBe(true);
  });

  it('accepts interior cell', () => {
    expect(isValidCell(7, 5)).toBe(true);
  });

  it('rejects negative col', () => {
    expect(isValidCell(-1, 0)).toBe(false);
  });

  it('rejects negative row', () => {
    expect(isValidCell(0, -1)).toBe(false);
  });

  it('rejects col === GRID_COLS', () => {
    expect(isValidCell(GRID_COLS, 0)).toBe(false);
  });

  it('rejects row === GRID_ROWS', () => {
    expect(isValidCell(0, GRID_ROWS)).toBe(false);
  });

  it('rejects both out of bounds', () => {
    expect(isValidCell(20, 20)).toBe(false);
  });

  it('rejects fractional coordinates', () => {
    expect(isValidCell(1.5, 2)).toBe(false);
    expect(isValidCell(1, 2.5)).toBe(false);
  });
});

describe('hex2px', () => {
  it('returns pixel center for (0,0)', () => {
    const p = hex2px(0, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('(1,0) is one hex width to the right', () => {
    const p = hex2px(1, 0);
    expect(p.x).toBeCloseTo(HEX_SIZE * S3);
    expect(p.y).toBeCloseTo(0);
  });

  it('(0,1) odd row offsets x by half hex width', () => {
    const p = hex2px(0, 1);
    expect(p.x).toBeCloseTo(HEX_SIZE * S3 * 0.5);
    expect(p.y).toBeCloseTo(HEX_SIZE * 1.5);
  });

  it('(0,2) even row has no x offset', () => {
    const p = hex2px(0, 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(HEX_SIZE * 3);
  });

  it('(2,3) matches manual calculation', () => {
    const p = hex2px(2, 3);
    // odd row: x = SIZE * S3 * (2 + 0.5) = SIZE * S3 * 2.5
    // y = SIZE * 1.5 * 3
    expect(p.x).toBeCloseTo(HEX_SIZE * S3 * 2.5);
    expect(p.y).toBeCloseTo(HEX_SIZE * 4.5);
  });
});

describe('px2hex', () => {
  it('round-trips with hex2px for ALL 165 valid cells', () => {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const p = hex2px(c, r);
        const h = px2hex(p.x, p.y);
        expect(h, `round-trip failed for (${c},${r})`).toEqual({ col: c, row: r });
      }
    }
  });

  it('handles pixel positions near hex boundaries', () => {
    // Slightly offset from center of (3,3), should still return (3,3)
    const p = hex2px(3, 3);
    const h = px2hex(p.x + 5, p.y + 5);
    expect(h).toEqual({ col: 3, row: 3 });
  });

  it('handles origin pixel', () => {
    const h = px2hex(0, 0);
    expect(h).toEqual({ col: 0, row: 0 });
  });

  it('handles negative pixel coordinates gracefully', () => {
    // Should return some coordinate (possibly invalid), but must not crash
    const h = px2hex(-100, -100);
    expect(h).toHaveProperty('col');
    expect(h).toHaveProperty('row');
  });
});

describe('offsetToCube', () => {
  it('converts (0,0) to cube (0,0,0)', () => {
    const c = offsetToCube(0, 0);
    expect(c.q).toBe(0);
    expect(c.r).toBe(0);
    expect(c.s + 0).toBe(0);
  });

  it('cube coordinates always sum to zero', () => {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cube = offsetToCube(c, r);
        expect(cube.q + cube.r + cube.s).toBe(0);
      }
    }
  });

  it('converts odd row correctly', () => {
    // (0,1) odd-r: q = col - (row - (row&1)) / 2 = 0 - (1-1)/2 = 0
    // r = row = 1, s = -q - r = -1
    const c = offsetToCube(0, 1);
    expect(c.q).toBe(0);
    expect(c.r).toBe(1);
    expect(c.s).toBe(-1);
  });

  it('converts even row correctly', () => {
    // (1,2) even-r: q = 1 - (2-0)/2 = 1-1 = 0
    // r = 2, s = -0 - 2 = -2
    const c = offsetToCube(1, 2);
    expect(c.q).toBe(0);
    expect(c.r).toBe(2);
    expect(c.s).toBe(-2);
  });
});

describe('hexDistance', () => {
  it('same cell = 0', () => {
    expect(hexDistance(5, 5, 5, 5)).toBe(0);
  });

  it('adjacent cells = 1', () => {
    expect(hexDistance(5, 5, 6, 5)).toBe(1);
    expect(hexDistance(5, 5, 5, 6)).toBe(1);
  });

  it('is symmetric', () => {
    expect(hexDistance(0, 0, 7, 5)).toBe(hexDistance(7, 5, 0, 0));
    expect(hexDistance(3, 2, 10, 8)).toBe(hexDistance(10, 8, 3, 2));
  });

  it('known longer distances', () => {
    // (0,0) to (1,0): adjacent = 1
    expect(hexDistance(0, 0, 1, 0)).toBe(1);
    // (0,0) to (2,0): 2 steps right
    expect(hexDistance(0, 0, 2, 0)).toBe(2);
  });

  it('diagonal distance across grid', () => {
    // (0,0) to (14,10) should be a specific value
    const d = hexDistance(0, 0, 14, 10);
    expect(d).toBeGreaterThan(0);
    expect(Number.isInteger(d)).toBe(true);
  });

  it('distance along a row', () => {
    expect(hexDistance(0, 0, 5, 0)).toBe(5);
    expect(hexDistance(0, 5, 5, 5)).toBe(5);
  });

  it('distance between adjacent rows, same col, odd row', () => {
    // (3,4) to (3,5): adjacent
    expect(hexDistance(3, 4, 3, 5)).toBe(1);
  });
});

describe('hexNeighbors', () => {
  it('interior cell returns 6 neighbors', () => {
    const n = hexNeighbors(7, 5);
    expect(n).toHaveLength(6);
  });

  it('corner (0,0) returns fewer neighbors', () => {
    const n = hexNeighbors(0, 0);
    expect(n.length).toBeLessThan(6);
    expect(n.length).toBeGreaterThan(0);
    // All returned should be valid
    for (const h of n) {
      expect(isValidCell(h.col, h.row)).toBe(true);
    }
  });

  it('corner (14,10) returns fewer neighbors', () => {
    const n = hexNeighbors(14, 10);
    expect(n.length).toBeLessThan(6);
    for (const h of n) {
      expect(isValidCell(h.col, h.row)).toBe(true);
    }
  });

  it('all returned coords are valid', () => {
    const n = hexNeighbors(5, 5);
    for (const h of n) {
      expect(isValidCell(h.col, h.row)).toBe(true);
    }
  });

  it('all returned coords are at distance 1', () => {
    const n = hexNeighbors(5, 5);
    for (const h of n) {
      expect(hexDistance(5, 5, h.col, h.row)).toBe(1);
    }
  });

  it('odd vs even row produce different neighbor patterns', () => {
    const evenNeighbors = hexNeighbors(5, 4).map(h => `${h.col},${h.row}`).sort();
    const oddNeighbors = hexNeighbors(5, 5).map(h => `${h.col},${h.row}`).sort();
    expect(evenNeighbors).not.toEqual(oddNeighbors);
  });

  it('edge cell on left boundary', () => {
    const n = hexNeighbors(0, 5);
    for (const h of n) {
      expect(isValidCell(h.col, h.row)).toBe(true);
    }
    expect(n.length).toBeLessThanOrEqual(6);
  });

  it('edge cell on top boundary even row', () => {
    const n = hexNeighbors(5, 0);
    for (const h of n) {
      expect(isValidCell(h.col, h.row)).toBe(true);
    }
  });
});

describe('hexRing', () => {
  it('radius 0 returns just the center', () => {
    const r = hexRing(7, 5, 0);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ col: 7, row: 5 });
  });

  it('radius 1 returns up to 6 cells for interior', () => {
    const r = hexRing(7, 5, 1);
    expect(r).toHaveLength(6);
    // All should be at distance 1
    for (const h of r) {
      expect(hexDistance(7, 5, h.col, h.row)).toBe(1);
    }
  });

  it('radius 2 for interior cell', () => {
    const r = hexRing(7, 5, 2);
    // All should be at distance exactly 2
    for (const h of r) {
      expect(hexDistance(7, 5, h.col, h.row)).toBe(2);
    }
    // Interior radius-2 ring has 12 cells
    expect(r).toHaveLength(12);
  });

  it('all cells are valid', () => {
    const r = hexRing(0, 0, 3);
    for (const h of r) {
      expect(isValidCell(h.col, h.row)).toBe(true);
    }
  });

  it('ring near boundary has fewer cells', () => {
    const r = hexRing(0, 0, 1);
    expect(r.length).toBeLessThan(6);
    expect(r.length).toBeGreaterThan(0);
  });

  it('no duplicate cells', () => {
    const r = hexRing(7, 5, 3);
    const keys = r.map(h => `${h.col},${h.row}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('hexesInRadius', () => {
  it('radius 0 returns 1 cell (the center)', () => {
    const r = hexesInRadius(7, 5, 0);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ col: 7, row: 5 });
  });

  it('radius 1 returns 7 cells for interior', () => {
    const r = hexesInRadius(7, 5, 1);
    expect(r).toHaveLength(7); // center + 6 neighbors
  });

  it('includes all ring cells', () => {
    const radius = 2;
    const all = hexesInRadius(7, 5, radius);
    const ring0 = hexRing(7, 5, 0);
    const ring1 = hexRing(7, 5, 1);
    const ring2 = hexRing(7, 5, 2);

    const allKeys = new Set(all.map(h => `${h.col},${h.row}`));
    for (const h of [...ring0, ...ring1, ...ring2]) {
      expect(allKeys.has(`${h.col},${h.row}`)).toBe(true);
    }
  });

  it('all cells are within the radius distance', () => {
    const radius = 3;
    const cells = hexesInRadius(7, 5, radius);
    for (const h of cells) {
      expect(hexDistance(7, 5, h.col, h.row)).toBeLessThanOrEqual(radius);
    }
  });

  it('all cells are valid', () => {
    const cells = hexesInRadius(0, 0, 5);
    for (const h of cells) {
      expect(isValidCell(h.col, h.row)).toBe(true);
    }
  });

  it('no duplicate cells', () => {
    const cells = hexesInRadius(7, 5, 3);
    const keys = cells.map(h => `${h.col},${h.row}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('count matches sum of ring counts', () => {
    const radius = 2;
    const all = hexesInRadius(7, 5, radius);
    let ringSum = 0;
    for (let i = 0; i <= radius; i++) {
      ringSum += hexRing(7, 5, i).length;
    }
    expect(all).toHaveLength(ringSum);
  });
});

describe('hexDirection', () => {
  it('east direction', () => {
    const d = hexDirection(5, 5, 6, 5);
    expect(d.q).toBe(1);
    expect(d.r).toBe(0);
    expect(d.s).toBe(-1);
  });

  it('west direction', () => {
    const d = hexDirection(5, 5, 4, 5);
    expect(d.q).toBe(-1);
    expect(d.r).toBe(0);
    expect(d.s).toBe(1);
  });

  it('same cell returns zero vector', () => {
    const d = hexDirection(5, 5, 5, 5);
    expect(d.q).toBe(0);
    expect(d.r).toBe(0);
    expect(d.s).toBe(0);
  });

  it('diagonal direction normalizes to unit-ish vector', () => {
    const d = hexDirection(0, 0, 7, 5);
    // Should be normalized — each component in [-1, 1]
    expect(Math.abs(d.q)).toBeLessThanOrEqual(1);
    expect(Math.abs(d.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(d.s)).toBeLessThanOrEqual(1);
  });

  it('direction for adjacent cells matches cube delta', () => {
    // (5,4) even row to (5,5) — should be one of the 6 hex directions
    const d = hexDirection(5, 4, 5, 5);
    const maxAbs = Math.max(Math.abs(d.q), Math.abs(d.r), Math.abs(d.s));
    expect(maxAbs).toBe(1);
  });

  it('opposite directions are negated', () => {
    const d1 = hexDirection(5, 5, 8, 5);
    const d2 = hexDirection(8, 5, 5, 5);
    expect(d1.q + 0).toBe(-(d2.q) + 0);
    expect(d1.r + 0).toBe(-(d2.r) + 0);
    expect(d1.s + 0).toBe(-(d2.s) + 0);
  });
});
