import type { HexCoord } from './types';
import { hexNeighbors, isValidCell } from './hexUtils';

/**
 * Returns a "col,row" string key for set lookups.
 */
export function coordKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * BFS flood-fill from origin with a step budget (speed).
 * Returns all reachable hexes including origin.
 * Cannot enter or path through occupied hexes.
 * Speed 0 = only origin.
 */
export function findReachable(
  col: number,
  row: number,
  speed: number,
  occupied: Set<string>,
): HexCoord[] {
  const startKey = coordKey(col, row);
  const visited = new Set<string>([startKey]);
  const result: HexCoord[] = [{ col, row }];

  if (speed === 0) {
    return result;
  }

  // BFS with distance tracking
  let frontier: HexCoord[] = [{ col, row }];

  for (let step = 0; step < speed; step++) {
    const nextFrontier: HexCoord[] = [];
    for (const cell of frontier) {
      const neighbors = hexNeighbors(cell.col, cell.row);
      for (const n of neighbors) {
        const key = coordKey(n.col, n.row);
        if (!visited.has(key) && !occupied.has(key)) {
          visited.add(key);
          result.push(n);
          nextFrontier.push(n);
        }
      }
    }
    frontier = nextFrontier;
  }

  return result;
}

/**
 * BFS shortest path from start to end (inclusive).
 * Returns ordered array of hexes from start to end.
 * Returns empty array if path is blocked, target is occupied,
 * or start/end are out of bounds.
 * Cannot path through occupied hexes.
 */
export function findPath(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
  occupied: Set<string>,
): HexCoord[] {
  // Out-of-bounds check
  if (!isValidCell(fromCol, fromRow) || !isValidCell(toCol, toRow)) {
    return [];
  }

  const targetKey = coordKey(toCol, toRow);

  // Target is occupied — unreachable
  if (occupied.has(targetKey)) {
    return [];
  }

  // Same cell
  if (fromCol === toCol && fromRow === toRow) {
    return [{ col: fromCol, row: fromRow }];
  }

  const startKey = coordKey(fromCol, fromRow);
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, string>();

  let frontier: HexCoord[] = [{ col: fromCol, row: fromRow }];

  while (frontier.length > 0) {
    const nextFrontier: HexCoord[] = [];
    for (const cell of frontier) {
      const cellKey = coordKey(cell.col, cell.row);
      const neighbors = hexNeighbors(cell.col, cell.row);
      for (const n of neighbors) {
        const key = coordKey(n.col, n.row);
        if (visited.has(key) || occupied.has(key)) {
          continue;
        }
        visited.add(key);
        parent.set(key, cellKey);

        if (key === targetKey) {
          // Reconstruct path
          const path: HexCoord[] = [];
          let cur = key;
          while (cur !== undefined) {
            const [c, r] = cur.split(',').map(Number);
            path.push({ col: c, row: r });
            cur = parent.get(cur)!;
          }
          path.reverse();
          return path;
        }

        nextFrontier.push(n);
      }
    }
    frontier = nextFrontier;
  }

  // No path found
  return [];
}
