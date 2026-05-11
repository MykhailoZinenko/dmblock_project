import { describe, it, expect } from 'vitest';
import { coordKey, findReachable, findPath } from '../pathfinding';

// Helper: convert HexCoord[] to Set of "col,row" strings for easy comparison
function toKeySet(coords: { col: number; row: number }[]): Set<string> {
  return new Set(coords.map((c) => `${c.col},${c.row}`));
}

// Odd-r offset neighbor reference (from hexUtils.ts):
// Even row: [+1,0], [0,-1], [-1,-1], [-1,0], [-1,+1], [0,+1]
// Odd  row: [+1,0], [+1,-1], [0,-1], [-1,0], [0,+1], [+1,+1]
//
// Neighbors of (7,5) [odd row]: (8,5), (8,4), (7,4), (6,5), (7,6), (8,6)
// Neighbors of (0,0) [even row]: (1,0), (0,-1)X, (-1,-1)X, (-1,0)X, (-1,+1)X, (0,1) => valid: (1,0), (0,1)
// Neighbors of (14,10) [even row]: (15,10)X, (14,9), (13,9), (13,10), (13,11)X, (14,11)X => valid: (14,9), (13,9), (13,10)

describe('coordKey', () => {
  it('formats col,row as a string', () => {
    expect(coordKey(3, 7)).toBe('3,7');
  });

  it('handles zero coordinates', () => {
    expect(coordKey(0, 0)).toBe('0,0');
  });

  it('handles edge-of-grid coordinates', () => {
    expect(coordKey(14, 10)).toBe('14,10');
  });
});

describe('findReachable', () => {
  it('speed 0 returns only origin', () => {
    const result = findReachable(7, 5, 0, new Set());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ col: 7, row: 5 });
  });

  it('speed 1 from interior returns origin + 6 neighbors (7 total)', () => {
    const result = findReachable(7, 5, 1, new Set());
    expect(result).toHaveLength(7);
    const keys = toKeySet(result);
    expect(keys.has('7,5')).toBe(true);
    // Check all 6 neighbors of (7,5) [odd row]
    expect(keys.has('8,5')).toBe(true);
    expect(keys.has('8,4')).toBe(true);
    expect(keys.has('7,4')).toBe(true);
    expect(keys.has('6,5')).toBe(true);
    expect(keys.has('7,6')).toBe(true);
    expect(keys.has('8,6')).toBe(true);
  });

  it('speed 1 excludes occupied hexes', () => {
    const occupied = new Set(['8,5', '6,5']);
    const result = findReachable(7, 5, 1, occupied);
    const keys = toKeySet(result);
    expect(keys.has('8,5')).toBe(false);
    expect(keys.has('6,5')).toBe(false);
    // origin + 4 remaining neighbors
    expect(result).toHaveLength(5);
  });

  it('cannot path through occupied hex (wall blocks access beyond)', () => {
    // Block all 6 neighbors of (7,5) [odd row]: (8,5), (8,4), (7,4), (6,5), (7,6), (8,6)
    const occupied = new Set(['8,5', '8,4', '7,4', '6,5', '7,6', '8,6']);
    const result = findReachable(7, 5, 3, occupied);
    // Fully surrounded — only origin reachable
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ col: 7, row: 5 });
  });

  it('handles top-left corner (0,0)', () => {
    const result = findReachable(0, 0, 1, new Set());
    const keys = toKeySet(result);
    expect(keys.has('0,0')).toBe(true);
    // Even row 0 from (0,0): valid neighbors are (1,0) and (0,1)
    expect(keys.has('1,0')).toBe(true);
    expect(keys.has('0,1')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('handles bottom-right corner (14,10)', () => {
    const result = findReachable(14, 10, 1, new Set());
    const keys = toKeySet(result);
    expect(keys.has('14,10')).toBe(true);
    // Even row 10 from (14,10): valid neighbors are (14,9), (13,9), (13,10)
    expect(keys.has('14,9')).toBe(true);
    expect(keys.has('13,9')).toBe(true);
    expect(keys.has('13,10')).toBe(true);
    expect(result).toHaveLength(4);
  });

  it('speed 2 returns expanding rings', () => {
    const result = findReachable(7, 5, 2, new Set());
    // Interior cell with speed 2: 1 + 6 + 12 = 19 hexes
    expect(result).toHaveLength(19);
    const keys = toKeySet(result);
    expect(keys.has('7,5')).toBe(true);
    // distance-2 cell check
    expect(keys.has('9,5')).toBe(true);
  });

  it('speed 3 returns more hexes than speed 2', () => {
    const result2 = findReachable(7, 5, 2, new Set());
    const result3 = findReachable(7, 5, 3, new Set());
    expect(result3.length).toBeGreaterThan(result2.length);
  });

  it('speed 0 still returns origin even with no occupied set', () => {
    const result = findReachable(7, 5, 0, new Set());
    expect(result).toHaveLength(1);
  });

  it('wall with gap allows access beyond', () => {
    // Block all neighbors of (7,5) except (8,5)
    // Neighbors [odd row]: (8,5), (8,4), (7,4), (6,5), (7,6), (8,6)
    const occupied = new Set(['8,4', '7,4', '6,5', '7,6', '8,6']);
    const result = findReachable(7, 5, 2, occupied);
    const keys = toKeySet(result);
    // Can reach (8,5) and its neighbors at distance 2
    expect(keys.has('8,5')).toBe(true);
    expect(keys.has('7,5')).toBe(true);
    // Should have more than just origin + (8,5)
    expect(result.length).toBeGreaterThan(2);
  });
});

describe('findPath', () => {
  it('same start and end returns single element', () => {
    const path = findPath(7, 5, 7, 5, new Set());
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual({ col: 7, row: 5 });
  });

  it('adjacent hex returns 2-element path', () => {
    const path = findPath(7, 5, 8, 5, new Set());
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual({ col: 7, row: 5 });
    expect(path[1]).toEqual({ col: 8, row: 5 });
  });

  it('longer path has correct length', () => {
    // (7,5) to (9,5) is distance 2
    const path = findPath(7, 5, 9, 5, new Set());
    expect(path).toHaveLength(3);
    expect(path[0]).toEqual({ col: 7, row: 5 });
    expect(path[path.length - 1]).toEqual({ col: 9, row: 5 });
  });

  it('blocked target returns empty array', () => {
    const occupied = new Set(['9,5']);
    const path = findPath(7, 5, 9, 5, occupied);
    expect(path).toHaveLength(0);
  });

  it('fully surrounded start returns empty for unreachable target', () => {
    // Neighbors of (7,5) [odd row]: (8,5), (8,4), (7,4), (6,5), (7,6), (8,6)
    const occupied = new Set(['8,5', '8,4', '7,4', '6,5', '7,6', '8,6']);
    const path = findPath(7, 5, 10, 5, occupied);
    expect(path).toHaveLength(0);
  });

  it('path avoids obstacles', () => {
    // Block direct route through (8,5)
    const occupied = new Set(['8,5']);
    const path = findPath(7, 5, 9, 5, occupied);
    const keys = toKeySet(path);
    expect(keys.has('8,5')).toBe(false);
    // Path must exist (go around)
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ col: 7, row: 5 });
    expect(path[path.length - 1]).toEqual({ col: 9, row: 5 });
  });

  it('finds shortest route around obstacles', () => {
    // Block (8,5), detour from (7,5) to (9,5) requires going through a neighbor
    const occupied = new Set(['8,5']);
    const path = findPath(7, 5, 9, 5, occupied);
    expect(path.length).toBeGreaterThanOrEqual(3);
    expect(path.length).toBeLessThanOrEqual(4);
    expect(path[0]).toEqual({ col: 7, row: 5 });
    expect(path[path.length - 1]).toEqual({ col: 9, row: 5 });
    expect(path.find(h => h.col === 8 && h.row === 5)).toBeUndefined();
  });

  it('returns empty for out-of-bounds target', () => {
    const path = findPath(7, 5, -1, 0, new Set());
    expect(path).toHaveLength(0);
  });

  it('returns empty for out-of-bounds start', () => {
    const path = findPath(-1, 0, 7, 5, new Set());
    expect(path).toHaveLength(0);
  });

  it('path across the board is possible with no obstacles', () => {
    const path = findPath(0, 0, 14, 10, new Set());
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ col: 0, row: 0 });
    expect(path[path.length - 1]).toEqual({ col: 14, row: 10 });
  });

  it('each step in path is adjacent to the previous', () => {
    const path = findPath(0, 0, 5, 5, new Set());
    expect(path.length).toBeGreaterThan(1);
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      // Distance between consecutive path cells should be 1
      const dx = Math.abs(prev.col - curr.col);
      const dy = Math.abs(prev.row - curr.row);
      expect(dx + dy).toBeLessThanOrEqual(2);
      expect(dx).toBeLessThanOrEqual(1);
      expect(dy).toBeLessThanOrEqual(1);
    }
  });
});
