import { GRID_COLS, GRID_ROWS, HEX_SIZE } from './constants';
import type { HexCoord } from './types';

const S3 = Math.sqrt(3);

// ---- Coordinate conversions ----

/** Convert offset (col, row) to cube coordinates (q, r, s). Odd-r offset. */
export function offsetToCube(col: number, row: number): { q: number; r: number; s: number } {
  const q = col - (row - (row & 1)) / 2;
  const r = row;
  const s = -q - r;
  return { q, r, s };
}

/** Convert cube coordinates back to odd-r offset. */
function cubeToOffset(q: number, r: number): HexCoord {
  const col = q + (r - (r & 1)) / 2;
  return { col, row: r };
}

// ---- Pixel conversions ----

/** Convert offset (col, row) to pixel center. Pointy-top, odd-r offset. */
export function hex2px(col: number, row: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * S3 * (col + 0.5 * (row & 1)),
    y: HEX_SIZE * 1.5 * row,
  };
}

/** Convert pixel coordinates to the nearest hex offset coordinate. */
export function px2hex(px: number, py: number): HexCoord {
  // Convert pixel to fractional axial (pointy-top)
  const q = (px * S3 / 3 - py / 3) / HEX_SIZE;
  const r = (py * 2 / 3) / HEX_SIZE;
  const s = -q - r;

  // Round to nearest cube coordinate
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }

  return cubeToOffset(rq, rr);
}

// ---- Distance ----

/** Hex distance between two cells (Chebyshev distance in cube coords). */
export function hexDistance(c1: number, r1: number, c2: number, r2: number): number {
  const a = offsetToCube(c1, r1);
  const b = offsetToCube(c2, r2);
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

// ---- Bounds check ----

/** Check if (col, row) is within the grid. */
export function isValidCell(col: number, row: number): boolean {
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    col >= 0 &&
    col < GRID_COLS &&
    row >= 0 &&
    row < GRID_ROWS
  );
}

// ---- Neighbors ----

// Odd-r offset neighbor deltas: [even-row deltas, odd-row deltas]
// Each entry: [dcol, drow]
const EVEN_ROW_DIRS: readonly [number, number][] = [
  [+1, 0], [0, -1], [-1, -1],
  [-1, 0], [-1, +1], [0, +1],
];
const ODD_ROW_DIRS: readonly [number, number][] = [
  [+1, 0], [+1, -1], [0, -1],
  [-1, 0], [0, +1], [+1, +1],
];

/** Return array of valid adjacent HexCoords. Handles odd/even row offsets. */
export function hexNeighbors(col: number, row: number): HexCoord[] {
  const dirs = (row & 1) === 0 ? EVEN_ROW_DIRS : ODD_ROW_DIRS;
  const result: HexCoord[] = [];
  for (const [dc, dr] of dirs) {
    const nc = col + dc;
    const nr = row + dr;
    if (isValidCell(nc, nr)) {
      result.push({ col: nc, row: nr });
    }
  }
  return result;
}

// ---- Ring & area ----

/** All cells at exactly `radius` hex distance from (col, row). */
export function hexRing(col: number, row: number, radius: number): HexCoord[] {
  if (radius === 0) {
    return isValidCell(col, row) ? [{ col, row }] : [];
  }

  const center = offsetToCube(col, row);
  const results: HexCoord[] = [];

  // Cube direction vectors for the 6 hex directions
  const cubeDirs: [number, number, number][] = [
    [+1, -1, 0], [+1, 0, -1], [0, +1, -1],
    [-1, +1, 0], [-1, 0, +1], [0, -1, +1],
  ];

  // Start at the hex radius steps in direction 4 ([-1, 0, +1]) from center
  let cq = center.q + cubeDirs[4][0] * radius;
  let cr = center.r + cubeDirs[4][1] * radius;
  let cs = center.s + cubeDirs[4][2] * radius;

  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      const offset = cubeToOffset(cq, cr);
      if (isValidCell(offset.col, offset.row)) {
        results.push(offset);
      }
      cq += cubeDirs[side][0];
      cr += cubeDirs[side][1];
      cs += cubeDirs[side][2];
    }
  }

  return results;
}

/** All cells within `radius` hex distance (inclusive). */
export function hexesInRadius(col: number, row: number, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let r = 0; r <= radius; r++) {
    results.push(...hexRing(col, row, r));
  }
  return results;
}

// ---- Direction ----

/** Normalized direction vector in cube coords from one hex to another. */
export function hexDirection(
  fromCol: number, fromRow: number,
  toCol: number, toRow: number,
): { q: number; r: number; s: number } {
  const a = offsetToCube(fromCol, fromRow);
  const b = offsetToCube(toCol, toRow);

  const dq = b.q - a.q;
  const dr = b.r - a.r;
  const ds = b.s - a.s;

  if (dq === 0 && dr === 0 && ds === 0) {
    return { q: 0, r: 0, s: 0 };
  }

  const maxAbs = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
  return {
    q: dq / maxAbs,
    r: dr / maxAbs,
    s: ds / maxAbs,
  };
}
