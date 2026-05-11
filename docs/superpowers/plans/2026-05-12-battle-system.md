# Battle System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully playable tactical hex-grid card battle with all 20 card abilities, two local players (hot-seat), debug card picker, and a security-first architecture ready for state channel multiplayer.

**Architecture:**
- `frontend/src/game/` — pure TypeScript game logic. No rendering, no React, no engine imports. Fully unit-testable. Deterministic: seeded PRNG, canonical state serialization, input validation at every boundary.
- `frontend/src/pages/Battle.tsx` — React page bridging game state to engine rendering. React manages overlay UI only (card picker, initiative sidebar, timer). Board/units/animations live in engine scene graph.
- `frontend/src/engine/` — existing WebGPU primitives. Consumed, not modified.

**Tech Stack:** TypeScript, Vitest, React, WebGPU engine (custom), seeded PRNG (mulberry32)

---

## Board Layout (HoMM3 style)
- **Grid:** 15 columns × 11 rows, pointy-top hex, odd-r offset
- **Orientation:** Left vs right
- **P1 deploy zone:** columns 0–1 (left)
- **P2 deploy zone:** columns 13–14 (right)
- **Hero positions:** off-grid at left/right edges
- **"Enemy half"** for ranged penalty: cols 8–14 for P1, cols 0–6 for P2
- **2×2 buildings** occupy 4 hex cells (top-left is anchor)

## Turn Structure (GDD rule change)
- Units activate one by one in initiative order (high → low, ties: speed, then seeded random)
- Per unit activation, controlling player chooses **ONE**:
  - **Play a card** (pay mana, place unit or cast spell) → unit's activation is **skipped**
  - **Act with the unit** (move + attack) → no card play allowed
  - **Pass** → skip
- Global turn ends when all units activated. Mana +1 (cap 12). New initiative queue built.

## Faction-Based Spell System
- Factions replace schools: Castle, Inferno, Necropolis, Dungeon
- Faction immunity bitmask on buildings: all buildings have 100% magic resistance
- Exception: Inferno faction units deal magic damage → against buildings, converts to physical
- Spells belong to a faction but deal generic magic damage

## Security Architecture
- Seeded PRNG (mulberry32) initialized from match seed — no Math.random()
- Every state transition produces a canonical hash (deterministic JSON serialization)
- All actions validated server-side equivalent: reject impossible moves even from local client
- Engine version hash verified at match handshake (future multiplayer)
- No floating point in game logic — integer math only for damage/healing

---

## Phase B1: Card Registry + Core Types ✅ DONE

Files already created:
- `frontend/src/game/types.ts` — CardDefinition, UnitInstance, PlayerState, BoardCell, enums, AbilityDefinition
- `frontend/src/game/cardRegistry.ts` — 20 cards with full stats, abilities, spriteKeys, fxKeys, damageType, powerMultiplier
- `frontend/src/game/constants.ts` — grid dimensions, mana, hero HP, timer, crit

---

## Phase B2: Hex Grid Utilities + Pathfinding

### Task 1: Hex coordinate math

**Files:**
- Create: `frontend/src/game/hexUtils.ts`
- Test: `frontend/src/game/__tests__/hexUtils.test.ts`

- [ ] **Step 1: Write failing tests for hex2px and px2hex**

```typescript
import { describe, it, expect } from 'vitest';
import { hex2px, px2hex, hexDistance, hexNeighbors, hexRing, isValidCell } from '../hexUtils';
import { GRID_COLS, GRID_ROWS, HEX_SIZE } from '../constants';

describe('hex2px', () => {
  it('converts (0,0) to pixel origin', () => {
    const p = hex2px(0, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('offsets odd rows by half hex width', () => {
    const even = hex2px(0, 0);
    const odd = hex2px(0, 1);
    expect(odd.x).toBeGreaterThan(even.x);
  });
});

describe('px2hex', () => {
  it('round-trips with hex2px for all valid cells', () => {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const px = hex2px(c, r);
        const back = px2hex(px.x, px.y);
        expect(back).toEqual({ col: c, row: r });
      }
    }
  });
});

describe('hexDistance', () => {
  it('returns 0 for same cell', () => {
    expect(hexDistance(3, 3, 3, 3)).toBe(0);
  });
  it('returns 1 for adjacent cells', () => {
    expect(hexDistance(2, 2, 3, 2)).toBe(1);
  });
  it('returns correct distance across grid', () => {
    expect(hexDistance(0, 0, 2, 2)).toBe(3);
  });
});

describe('hexNeighbors', () => {
  it('returns 6 neighbors for interior cell', () => {
    const n = hexNeighbors(5, 5);
    expect(n).toHaveLength(6);
  });
  it('filters out-of-bounds for corner cell', () => {
    const n = hexNeighbors(0, 0);
    expect(n.length).toBeLessThan(6);
    n.forEach(h => {
      expect(isValidCell(h.col, h.row)).toBe(true);
    });
  });
});

describe('isValidCell', () => {
  it('accepts valid cells', () => {
    expect(isValidCell(0, 0)).toBe(true);
    expect(isValidCell(14, 10)).toBe(true);
  });
  it('rejects out-of-bounds', () => {
    expect(isValidCell(-1, 0)).toBe(false);
    expect(isValidCell(15, 0)).toBe(false);
    expect(isValidCell(0, 11)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/game/__tests__/hexUtils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement hexUtils.ts**

```typescript
import { GRID_COLS, GRID_ROWS, HEX_SIZE } from './constants';
import type { HexCoord } from './types';

const S3 = Math.sqrt(3);

export function hex2px(col: number, row: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * S3 * (col + 0.5 * (row & 1)),
    y: HEX_SIZE * 1.5 * row,
  };
}

export function px2hex(px: number, py: number): HexCoord {
  // Convert pixel to axial (fractional), then round
  const q = (px * S3 / 3 - py / 3) / HEX_SIZE;
  const r = (py * 2 / 3) / HEX_SIZE;
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { col: rq + (rr - (rr & 1)) / 2, row: rr };
}

// Convert offset (col, row) to cube coordinates for distance calc
function offsetToCube(col: number, row: number): { q: number; r: number; s: number } {
  const q = col - (row - (row & 1)) / 2;
  const r = row;
  return { q, r, s: -q - r };
}

export function hexDistance(c1: number, r1: number, c2: number, r2: number): number {
  const a = offsetToCube(c1, r1);
  const b = offsetToCube(c2, r2);
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

const EVEN_NEIGHBORS = [
  [+1, 0], [0, -1], [-1, -1], [-1, 0], [-1, +1], [0, +1],
] as const;
const ODD_NEIGHBORS = [
  [+1, 0], [+1, -1], [0, -1], [-1, 0], [0, +1], [+1, +1],
] as const;

export function hexNeighbors(col: number, row: number): HexCoord[] {
  const offsets = (row & 1) === 0 ? EVEN_NEIGHBORS : ODD_NEIGHBORS;
  const result: HexCoord[] = [];
  for (const [dc, dr] of offsets) {
    const nc = col + dc;
    const nr = row + dr;
    if (isValidCell(nc, nr)) result.push({ col: nc, row: nr });
  }
  return result;
}

export function hexRing(col: number, row: number, radius: number): HexCoord[] {
  if (radius === 0) return [{ col, row }];
  const results: HexCoord[] = [];
  const center = offsetToCube(col, row);
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (hexDistance(col, row, c, r) === radius) {
        results.push({ col: c, row: r });
      }
    }
  }
  return results;
}

export function hexesInRadius(col: number, row: number, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (hexDistance(col, row, c, r) <= radius) {
        results.push({ col: c, row: r });
      }
    }
  }
  return results;
}

export function isValidCell(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

export function hexDirection(fromCol: number, fromRow: number, toCol: number, toRow: number): HexCoord {
  const fc = offsetToCube(fromCol, fromRow);
  const tc = offsetToCube(toCol, toRow);
  const dq = tc.q - fc.q;
  const dr = tc.r - fc.r;
  const ds = tc.s - fc.s;
  // Normalize to unit direction in cube coords
  const maxD = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
  if (maxD === 0) return { col: 0, row: 0 };
  return {
    col: Math.round(dq / maxD),
    row: Math.round(dr / maxD),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/game/__tests__/hexUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/hexUtils.ts frontend/src/game/__tests__/hexUtils.test.ts
git commit -m "feat: hex grid coordinate math + distance + neighbors"
```

### Task 2: BFS pathfinding

**Files:**
- Create: `frontend/src/game/pathfinding.ts`
- Test: `frontend/src/game/__tests__/pathfinding.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { findReachable, findPath } from '../pathfinding';

describe('findReachable', () => {
  it('returns origin at speed 0', () => {
    const result = findReachable(5, 5, 0, new Set());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ col: 5, row: 5 });
  });

  it('returns correct count at speed 1 (no obstacles)', () => {
    const result = findReachable(5, 5, 1, new Set());
    expect(result).toHaveLength(7); // center + 6 neighbors
  });

  it('excludes occupied hexes', () => {
    const occupied = new Set(['6,5']); // block one neighbor
    const result = findReachable(5, 5, 1, occupied);
    expect(result).toHaveLength(6);
    expect(result.find(h => h.col === 6 && h.row === 5)).toBeUndefined();
  });

  it('cannot path through occupied hexes', () => {
    // Wall of occupied hexes around (5,5) except one gap
    const neighbors = [
      '6,5', '5,4', '4,4', '4,5', '4,6', '5,6', // all neighbors blocked except...
    ];
    // Actually block all 6 neighbors
    const occupied = new Set(['6,5', '5,4', '4,4', '4,5', '4,6', '5,6']);
    const result = findReachable(5, 5, 3, occupied);
    expect(result).toHaveLength(1); // only origin
  });
});

describe('findPath', () => {
  it('returns direct path between adjacent hexes', () => {
    const path = findPath(5, 5, 6, 5, new Set());
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual({ col: 5, row: 5 });
    expect(path[1]).toEqual({ col: 6, row: 5 });
  });

  it('returns empty for blocked path', () => {
    const occupied = new Set(['6,5', '5,4', '4,4', '4,5', '4,6', '5,6']);
    const path = findPath(5, 5, 8, 5, occupied);
    expect(path).toHaveLength(0);
  });

  it('returns empty if target is occupied', () => {
    const occupied = new Set(['6,5']);
    const path = findPath(5, 5, 6, 5, occupied);
    expect(path).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/game/__tests__/pathfinding.test.ts`

- [ ] **Step 3: Implement pathfinding.ts**

```typescript
import { hexNeighbors, isValidCell } from './hexUtils';
import type { HexCoord } from './types';

function coordKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function findReachable(
  col: number, row: number, speed: number, occupied: Set<string>
): HexCoord[] {
  const visited = new Map<string, number>(); // key → remaining AP
  const queue: { col: number; row: number; ap: number }[] = [{ col, row, ap: speed }];
  visited.set(coordKey(col, row), speed);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.ap <= 0) continue;

    for (const n of hexNeighbors(curr.col, curr.row)) {
      const key = coordKey(n.col, n.row);
      if (occupied.has(key)) continue;
      const newAp = curr.ap - 1;
      const existing = visited.get(key);
      if (existing !== undefined && existing >= newAp) continue;
      visited.set(key, newAp);
      queue.push({ col: n.col, row: n.row, ap: newAp });
    }
  }

  return Array.from(visited.keys()).map(k => {
    const [c, r] = k.split(',').map(Number);
    return { col: c, row: r };
  });
}

export function findPath(
  fromCol: number, fromRow: number,
  toCol: number, toRow: number,
  occupied: Set<string>,
): HexCoord[] {
  const targetKey = coordKey(toCol, toRow);
  if (occupied.has(targetKey)) return [];
  if (fromCol === toCol && fromRow === toRow) return [{ col: fromCol, row: fromRow }];

  const cameFrom = new Map<string, string>();
  const startKey = coordKey(fromCol, fromRow);
  cameFrom.set(startKey, '');
  const queue: HexCoord[] = [{ col: fromCol, row: fromRow }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currKey = coordKey(curr.col, curr.row);

    if (currKey === targetKey) {
      const path: HexCoord[] = [];
      let k = targetKey;
      while (k !== '') {
        const [c, r] = k.split(',').map(Number);
        path.unshift({ col: c, row: r });
        k = cameFrom.get(k)!;
      }
      return path;
    }

    for (const n of hexNeighbors(curr.col, curr.row)) {
      const nk = coordKey(n.col, n.row);
      if (cameFrom.has(nk)) continue;
      if (occupied.has(nk) && nk !== targetKey) continue;
      cameFrom.set(nk, currKey);
      queue.push(n);
    }
  }

  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/game/__tests__/pathfinding.test.ts`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/pathfinding.ts frontend/src/game/__tests__/pathfinding.test.ts
git commit -m "feat: BFS hex pathfinding with obstacle blocking"
```

---

## Phase B3: Seeded PRNG + State Hashing

Security-critical foundation. Must exist before any game logic that uses randomness or state verification.

### Task 3: Deterministic PRNG

**Files:**
- Create: `frontend/src/game/rng.ts`
- Test: `frontend/src/game/__tests__/rng.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../rng';

describe('SeededRNG', () => {
  it('produces deterministic sequence from same seed', () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different sequence from different seed', () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(99);
    const same = Array.from({ length: 10 }, () => a.next() === b.next());
    expect(same.some(v => !v)).toBe(true);
  });

  it('nextInt returns integer in range [min, max)', () => {
    const rng = new SeededRNG(1);
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(0, 100);
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(100);
    }
  });

  it('rollPercent returns boolean for threshold check', () => {
    const rng = new SeededRNG(1);
    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (rng.rollPercent(50)) trueCount++;
    }
    expect(trueCount).toBeGreaterThan(400);
    expect(trueCount).toBeLessThan(600);
  });

  it('serialize and restore produce same sequence', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 50; i++) rng.next();
    const state = rng.serialize();
    const restored = SeededRNG.deserialize(state);
    for (let i = 0; i < 50; i++) {
      expect(rng.next()).toBe(restored.next());
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement rng.ts (mulberry32)**

```typescript
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return min + ((this.next() * (max - min)) | 0);
  }

  rollPercent(threshold: number): boolean {
    return this.nextInt(0, 100) < threshold;
  }

  serialize(): number {
    return this.state;
  }

  static deserialize(state: number): SeededRNG {
    const rng = new SeededRNG(0);
    rng.state = state;
    return rng;
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/rng.ts frontend/src/game/__tests__/rng.test.ts
git commit -m "feat: deterministic seeded PRNG (mulberry32) with serialize/restore"
```

### Task 4: Canonical state hashing

**Files:**
- Create: `frontend/src/game/stateHash.ts`
- Test: `frontend/src/game/__tests__/stateHash.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { canonicalize, hashState } from '../stateHash';

describe('canonicalize', () => {
  it('produces identical strings regardless of key order', () => {
    const a = canonicalize({ b: 2, a: 1 });
    const b = canonicalize({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('handles nested objects and arrays', () => {
    const obj = { units: [{ hp: 10, id: 1 }], turn: 3 };
    const result = canonicalize(obj);
    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual(obj);
  });
});

describe('hashState', () => {
  it('produces same hash for same input', () => {
    const a = hashState({ x: 1 });
    const b = hashState({ x: 1 });
    expect(a).toBe(b);
  });

  it('produces different hash for different input', () => {
    const a = hashState({ x: 1 });
    const b = hashState({ x: 2 });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement stateHash.ts**

```typescript
export function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

function canonicalReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

export function canonicalizeDeep(obj: unknown): string {
  return JSON.stringify(obj, canonicalReplacer);
}

// Simple FNV-1a 32-bit hash — fast, deterministic, no crypto dependency
export function hashState(obj: unknown): string {
  const str = canonicalizeDeep(obj);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/stateHash.ts frontend/src/game/__tests__/stateHash.test.ts
git commit -m "feat: canonical state serialization + FNV-1a hashing"
```

---

## Phase B4: Battle Page Scaffold

### Task 5: Battle route + hex grid rendering

**Files:**
- Create: `frontend/src/pages/Battle.tsx`
- Modify: `frontend/src/App.tsx` — add `/battle` route

- [ ] **Step 1: Add route to App.tsx**

Add `import Battle from './pages/Battle';` and `<Route path="/battle" element={<Battle />} />`.

- [ ] **Step 2: Create Battle.tsx with hex grid**

Renders a 15×11 hex grid using engine Graphics. P1 deploy zone (cols 0–1) tinted blue, P2 deploy zone (cols 13–14) tinted red. Hero HP labels at left/right edges. Mana counter. Camera controls (WASD/scroll). Reference `Visual13.tsx` patterns for engine init, hex rendering, camera binding.

- [ ] **Step 3: Verify in browser**

Run: `cd frontend && npm run dev`
Navigate to `http://localhost:5173/battle`
Expected: 15×11 hex grid, blue/red deploy zones, hero HP labels, mana text, camera pan/zoom works.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Battle.tsx frontend/src/App.tsx
git commit -m "feat: battle page scaffold — 15×11 hex grid with deploy zones"
```

---

## Phase B5: Game State Machine + Initiative Queue

### Task 6: GameState + initiative sorting

**Files:**
- Create: `frontend/src/game/GameState.ts`
- Create: `frontend/src/game/initiative.ts`
- Test: `frontend/src/game/__tests__/initiative.test.ts`

- [ ] **Step 1: Write failing tests for initiative sorting**

```typescript
import { describe, it, expect } from 'vitest';
import { buildInitiativeQueue } from '../initiative';
import { DamageType } from '../types';
import type { UnitInstance } from '../types';
import { SeededRNG } from '../rng';

function makeUnit(uid: number, playerId: number, init: number, spd: number): UnitInstance {
  return {
    uid, cardId: 0, playerId, col: 0, row: 0,
    currentHp: 10, maxHp: 10, attack: 5, defense: 3,
    initiative: init, speed: spd, ammo: 0, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    remainingAp: spd, retaliatedThisTurn: false, alive: true,
    cooldowns: {}, garrisonedIn: null, polymorphed: false, cursed: false,
    occupiedCells: [],
  };
}

describe('buildInitiativeQueue', () => {
  it('sorts by initiative descending', () => {
    const units = [makeUnit(1, 0, 5, 3), makeUnit(2, 0, 7, 3), makeUnit(3, 0, 3, 3)];
    const rng = new SeededRNG(42);
    const queue = buildInitiativeQueue(units, rng);
    expect(queue.map(u => u.uid)).toEqual([2, 1, 3]);
  });

  it('breaks initiative ties by speed descending', () => {
    const units = [makeUnit(1, 0, 5, 2), makeUnit(2, 0, 5, 4)];
    const rng = new SeededRNG(42);
    const queue = buildInitiativeQueue(units, rng);
    expect(queue[0].uid).toBe(2);
  });

  it('breaks speed ties deterministically with RNG', () => {
    const units = [makeUnit(1, 0, 5, 3), makeUnit(2, 0, 5, 3)];
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const q1 = buildInitiativeQueue([...units], rng1);
    const q2 = buildInitiativeQueue([...units], rng2);
    expect(q1.map(u => u.uid)).toEqual(q2.map(u => u.uid));
  });

  it('only includes alive units', () => {
    const dead = makeUnit(1, 0, 10, 3);
    dead.alive = false;
    const alive = makeUnit(2, 0, 5, 3);
    const rng = new SeededRNG(42);
    const queue = buildInitiativeQueue([dead, alive], rng);
    expect(queue).toHaveLength(1);
    expect(queue[0].uid).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

- [ ] **Step 3: Implement initiative.ts**

```typescript
import type { UnitInstance } from './types';
import type { SeededRNG } from './rng';

export function buildInitiativeQueue(units: UnitInstance[], rng: SeededRNG): UnitInstance[] {
  const alive = units.filter(u => u.alive);
  const tagged = alive.map(u => ({ unit: u, tiebreaker: rng.next() }));
  tagged.sort((a, b) => {
    if (b.unit.initiative !== a.unit.initiative) return b.unit.initiative - a.unit.initiative;
    if (b.unit.speed !== a.unit.speed) return b.unit.speed - a.unit.speed;
    return a.tiebreaker - b.tiebreaker;
  });
  return tagged.map(t => t.unit);
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Implement GameState.ts**

```typescript
import type { UnitInstance, PlayerState, BoardCell, GamePhase, HexCoord } from './types';
import { GRID_COLS, GRID_ROWS, STARTING_MANA, HERO_HP } from './constants';
import { SeededRNG } from './rng';
import { buildInitiativeQueue } from './initiative';

export interface GameState {
  players: [PlayerState, PlayerState];
  units: UnitInstance[];
  board: BoardCell[][];
  turnNumber: number;
  activationQueue: UnitInstance[];
  currentActivationIndex: number;
  phase: GamePhase;
  rng: SeededRNG;
  nextUnitUid: number;
}

export function createGameState(seed: number): GameState {
  const board: BoardCell[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      row.push({ col: c, row: r, unitUid: null, terrainEffect: null });
    }
    board.push(row);
  }

  return {
    players: [
      { id: 0, mana: STARTING_MANA, heroHp: HERO_HP, timeoutCount: 0 },
      { id: 1, mana: STARTING_MANA, heroHp: HERO_HP, timeoutCount: 0 },
    ],
    units: [],
    board,
    turnNumber: 1,
    activationQueue: [],
    currentActivationIndex: 0,
    phase: 'INITIALIZING',
    rng: new SeededRNG(seed),
    nextUnitUid: 1,
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/game/GameState.ts frontend/src/game/initiative.ts frontend/src/game/__tests__/initiative.test.ts
git commit -m "feat: game state machine + initiative queue with seeded tiebreaking"
```

---

## Phase B6: GameController + Event System

### Task 7: GameController with turn lifecycle

**Files:**
- Create: `frontend/src/game/GameController.ts`
- Test: `frontend/src/game/__tests__/GameController.test.ts`

Core controller that manages the turn loop: startGame → activation cycle → endTurn → next turn. Emits typed events for UI binding. Validates all inputs.

- [ ] **Step 1: Write failing tests for turn lifecycle**

Test: startGame sets phase to ACTIVATION, getCurrentUnit returns first in initiative, nextActivation advances index, endTurn increments turn number and rebuilds queue, mana increments.

- [ ] **Step 2: Implement GameController.ts**

EventEmitter-based. Methods: `startGame(seed)`, `getCurrentUnit()`, `getControllingPlayer()`, `nextActivation()`, `endTurn()`, `passActivation()`. Events: `turnStart`, `activationStart`, `activationEnd`, `turnEnd`, `gameOver`, `stateChange`.

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Wire initiative sidebar in Battle.tsx** — React overlay showing unit activation order, highlight current

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: GameController with turn lifecycle + initiative sidebar"
```

---

## Phase B7: Unit Spawning via Card Picker

### Task 8: Spawn action logic

**Files:**
- Create: `frontend/src/game/actions/spawnUnit.ts`
- Test: `frontend/src/game/__tests__/spawnUnit.test.ts`

- [ ] **Step 1: Write failing tests**

Test: canSpawn checks mana, card type, deploy zone validity. executeSpawn deducts mana, creates UnitInstance, places on board, handles 2×2 buildings (occupy 4 cells). Rejects spawning on occupied cells. For Peasant: 20% chance rolls unarmed flag.

- [ ] **Step 2: Implement spawnUnit.ts**

`canSpawn(state, playerId, cardId, hex)` — validates mana, deploy zone (P1: cols 0-1, P2: cols 13-14), hex unoccupied (+ 2×2 check for buildings). `executeSpawn(state, playerId, cardId, hex)` — deducts mana, creates UnitInstance from CardDefinition stats, assigns uid, places on board, returns updated state.

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Commit**

### Task 9: Card picker UI

**Files:**
- Create: `frontend/src/components/CardPicker.tsx`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Create CardPicker.tsx**

React component: shows all 20 cards in a scrollable row at bottom of screen. Each card shows name, mana cost, type icon. Grayed out if mana insufficient. Click selects card. Units: enter hex placement mode (highlight deploy zone). Spells: enter target selection mode. ArcanaCard or minimal card display.

- [ ] **Step 2: Wire into Battle.tsx**

On card select → highlight valid deploy hexes → on hex click → call spawnUnit → create AnimatedSprite at hex position. For 2×2 buildings, sprite spans 4 cells.

- [ ] **Step 3: Verify in browser**

Spawn Peasant (cost 1), sprite appears, mana drops. Spawn Knight (cost 7) — grayed if mana < 7. Initiative queue updates with new unit.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: card picker UI + unit spawning on hex grid"
```

---

## Phase B8: Movement with AP

### Task 10: Movement action logic + UI

**Files:**
- Create: `frontend/src/game/actions/moveUnit.ts`
- Test: `frontend/src/game/__tests__/moveUnit.test.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Write failing tests**

Test: getReachableHexes returns correct set for speed 3. Buildings (speed 0) return empty. executeMove deducts AP, updates board cells, handles 2×2 movement (buildings can't move).

- [ ] **Step 2: Implement moveUnit.ts**

Uses `findReachable` from pathfinding module. Validates unit belongs to active player, has remaining AP, target is reachable and unoccupied.

- [ ] **Step 3: Wire movement UI in Battle.tsx**

On unit's activation: click unit to select "act". Show green-highlighted reachable hexes. Click destination → animate sprite along path (ticker-based eased animation from Visual13). Update AP display.

- [ ] **Step 4: Run tests + verify in browser**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: unit movement with AP, path animation, reachable hex highlighting"
```

---

## Phase B9: Melee Combat + Retaliation

### Task 11: Combat formulas + melee

**Files:**
- Create: `frontend/src/game/combat.ts`
- Create: `frontend/src/game/actions/attackUnit.ts`
- Test: `frontend/src/game/__tests__/combat.test.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Write failing tests**

Test: `calculateDamage` with `max(1, attack - defense)`. Crit at 10% (seeded RNG). Magic damage vs magic resistance. Goblin magic damage converts to physical against buildings. Retaliation once per turn.

- [ ] **Step 2: Implement combat.ts**

```
baseDamage = max(1, attacker.attack - target.defense)
if attacker.damageType === MAGIC && target is building:
  if attacker faction is INFERNO: treat as physical (bypass magicResistance)
  else: apply magicResistance reduction
if crit: damage *= 1.5
finalDamage = floor(damage)
```

- [ ] **Step 3: Implement attackUnit.ts**

`canAttack(state, unitId)` — melee: check adjacent enemies. Returns targets list. `executeAttack(state, attackerUid, targetUid)` — calculate damage, apply, trigger retaliation if defender alive + hasn't retaliated this turn + is melee-adjacent. Consumes all remaining AP.

- [ ] **Step 4: Wire combat UI**

After movement, highlight attackable enemies in red. Click to attack. Play attack animation. Floating damage number. On death: remove sprite + unit from state.

- [ ] **Step 5: Run tests + verify in browser**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: melee combat with damage formula, retaliation, death handling"
```

---

## Phase B10: Ranged Combat

### Task 12: Ranged attack + distance modifiers

**Files:**
- Modify: `frontend/src/game/combat.ts`
- Modify: `frontend/src/game/actions/attackUnit.ts`
- Test: `frontend/src/game/__tests__/ranged.test.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Write failing tests**

Test: ranged can target any hex. Half damage on enemy half. Half damage if blocked by adjacent melee enemy. Both conditions stack (×0.25). Ammo decrements. No ammo = can't attack. No retaliation from ranged attacks. Marksman passive (Sniper) bypasses distance penalty.

- [ ] **Step 2: Update combat.ts**

Add ranged modifiers. Check enemy half (P1 shooting cols 8-14, P2 shooting cols 0-6). Check melee blocking (attacker has adjacent enemy melee unit). Decrement ammo.

- [ ] **Step 3: Update attackUnit.ts**

Ranged targets: any enemy unit on board if ammo > 0. No adjacency requirement.

- [ ] **Step 4: Wire ranged UI**

Projectile animation (lerp sprite from attacker to target). Show ammo counter on unit overlay.

- [ ] **Step 5: Run tests + verify in browser**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: ranged combat with distance penalty, melee blocking, ammo"
```

---

## Phase B11: Spell Casting

### Task 13: Spell resolution

**Files:**
- Create: `frontend/src/game/actions/castSpell.ts`
- Create: `frontend/src/game/spellEffects.ts`
- Test: `frontend/src/game/__tests__/spells.test.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Write failing tests**

Test: Healing heals target (base 15 in debug mode). Blast deals damage. Success/fail roll uses seeded RNG. Fail = mana spent, no effect. AREA target type hits hex + radius cells. Magic resistance reduces spell damage. Buildings immune (100% MR).

- [ ] **Step 2: Implement spellEffects.ts**

Switch on spell card: Healing → heal, Blast → damage, Storm → damage + blind flag, Surge → damage + slow, Inferno → AoE damage (hexesInRadius), Polymorph → transform target, Curse → stat reduction + block buffs.

- [ ] **Step 3: Implement castSpell.ts**

`canCast(state, playerId, cardId)` — validates mana, card is spell type. `executeCast(state, playerId, cardId, targetHex, rng)` — deducts mana, rolls success, applies effect or burns.

- [ ] **Step 4: Wire spell UI**

Card picker: click spell → show valid targets (varies by target type). Cast → play FX animation. Show SUCCESS/FAIL text.

- [ ] **Step 5: Run tests + verify in browser**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: spell casting with success/fail, AoE, magic resistance"
```

---

## Phase B12: Hero Barrier + Win Condition

### Task 14: Hero targeting + game over

**Files:**
- Create: `frontend/src/game/heroSystem.ts`
- Test: `frontend/src/game/__tests__/heroSystem.test.ts`
- Modify: `frontend/src/game/actions/attackUnit.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Write failing tests**

Test: barrier up when units alive. Barrier drops on last unit death. Can't target hero while barrier up. Hero takes damage when barrier down. Hero HP 0 = game over. Buildings count as units for barrier.

- [ ] **Step 2: Implement heroSystem.ts**

`isBarrierUp(state, playerId)`, `canTargetHero(state, attackerUid, targetPlayerId)`, `applyHeroDamage(state, playerId, damage)`, `checkWinCondition(state)`.

- [ ] **Step 3: Wire game over UI**

Barrier-drop visual effect. Hero HP bar at edges. Game over overlay with winner. Rematch button (reset state).

- [ ] **Step 4: Run tests + verify in browser**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: hero barrier, hero targeting, win condition, game over screen"
```

---

## Phase B13: Activation Timer + Timeout Damage

### Task 15: Timer + stamp damage

**Files:**
- Create: `frontend/src/game/timer.ts`
- Modify: `frontend/src/game/GameController.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Implement timer.ts**

`ActivationTimer` class. 45-second countdown. Emits `tick` and `expired`. Tracks timeout count per player for escalating damage (3, 6, 12, 24).

- [ ] **Step 2: Wire into GameController**

Start timer on activation start. Stop on any player action. On expire: auto-pass, apply stamp damage to hero.

- [ ] **Step 3: Wire timer UI**

Large countdown display. Color transitions: white → yellow → red. On expire: red flash on hero.

- [ ] **Step 4: Verify in browser**

Wait 45s, timer expires, hero takes 3 damage, next timeout = 6 damage.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: 45-second activation timer with escalating timeout damage"
```

---

## Phase B14: Edge Cases + Turn Polish

### Task 16: Zero-units rule, mana growth, buildings, pass

**Files:**
- Modify: `frontend/src/game/GameController.ts`
- Modify: `frontend/src/game/combat.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Implement zero-units free action**

At turn start, if a player has zero units, grant one free card action before initiative order begins.

- [ ] **Step 2: Buildings: speed 0 → no movement, 100% MR**

Already handled in data, verify edge cases: buildings in initiative queue (init 0, always last), buildings can't be selected for "act" option (only pass through).

- [ ] **Step 3: Pass button UI**

Explicit "Pass" button during activation. Also "End Turn" when all units have activated.

- [ ] **Step 4: Mana growth display**

+1 floats up from mana bar at turn start. Cap at 12.

- [ ] **Step 5: Verify all edge cases in browser**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: zero-units free action, mana growth, pass button, building edge cases"
```

---

## Phase B15: Cooldown System

Foundation for all active abilities. Must exist before any ability implementation.

### Task 17: Cooldown tracking

**Files:**
- Create: `frontend/src/game/abilities/cooldowns.ts`
- Test: `frontend/src/game/__tests__/cooldowns.test.ts`
- Modify: `frontend/src/game/GameController.ts`

- [ ] **Step 1: Write failing tests**

Test: `startCooldown(unit, abilityId, turns)` sets cooldown. `tickCooldowns(unit)` decrements all by 1, removes at 0. `canUseAbility(unit, abilityId)` returns false if on cooldown.

- [ ] **Step 2: Implement cooldowns.ts**

```typescript
export function canUseAbility(unit: UnitInstance, abilityId: string): boolean {
  return (unit.cooldowns[abilityId] ?? 0) <= 0;
}

export function startCooldown(unit: UnitInstance, abilityId: string, turns: number): void {
  unit.cooldowns[abilityId] = turns;
}

export function tickCooldowns(unit: UnitInstance): void {
  for (const key of Object.keys(unit.cooldowns)) {
    unit.cooldowns[key]--;
    if (unit.cooldowns[key] <= 0) delete unit.cooldowns[key];
  }
}
```

- [ ] **Step 3: Wire into GameController** — tick cooldowns at each unit's activation start

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: ability cooldown system with per-unit tracking"
```

---

## Phase B16: Simple Passives

### Task 18: Damage modifier passives

**Files:**
- Create: `frontend/src/game/abilities/passives.ts`
- Test: `frontend/src/game/__tests__/passives.test.ts`
- Modify: `frontend/src/game/combat.ts`

Implement all simple damage multiplier passives that just modify the combat formula:

- [ ] **Step 1: Write failing tests**

Test each passive:
- Peasant `sheep_slayer`: ×2 damage to polymorphed targets
- Peasant `unarmed`: 20% spawn chance → ×0.5 damage flag
- Militiaman `siege_expert`: ×2 damage to buildings
- Torchbearer `arsonist`: ×1.5 damage to buildings
- Sniper `marksman`: no ranged distance penalty
- Spearman `charge`: bonus damage = distance traveled × 2
- Pyro-Goblin `fire_resistant`: ×0.5 incoming fire damage

- [ ] **Step 2: Implement passives.ts**

`getDamageMultiplier(attacker, target, context)` — checks all passive abilities on attacker and target, returns cumulative multiplier. Context includes distance traveled, target status flags.

- [ ] **Step 3: Integrate into combat.ts**

Call `getDamageMultiplier` during damage calculation.

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: passive damage modifiers — sheep slayer, siege expert, marksman, charge"
```

---

## Phase B17: Simple Actives

### Task 19: Cooldown-based active abilities

**Files:**
- Create: `frontend/src/game/abilities/actives.ts`
- Test: `frontend/src/game/__tests__/actives.test.ts`
- Modify: `frontend/src/game/GameController.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Write failing tests**

Test each active:
- Militiaman `craft_axe`: ×2 damage this turn, 2-turn CD
- Archer `double_shot`: two attacks this activation, 3-turn CD
- Sniper `volley`: AoE shot (target + ring 1), 4-turn CD
- Monk `monk_heal`: heal ally at ×0.5 base spell power, 2-turn CD
- Monk `mana_orbs`: skip turn, DEF ×0.5 until round end, generate mana (cap 3), 2-turn CD

- [ ] **Step 2: Implement actives.ts**

Each ability as a function: validates cooldown, applies effect, starts cooldown. `useAbility(state, unitUid, abilityId, targetHex?)`.

- [ ] **Step 3: Wire ability buttons in Battle.tsx**

During unit activation, show available active abilities as buttons. Grayed if on cooldown. Click to activate → select target if needed → resolve.

- [ ] **Step 4: Run tests + verify in browser**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: active abilities — craft axe, double shot, volley, monk heal, mana orbs"
```

---

## Phase B18: Status Effects (Burn, Blind, Slow)

### Task 20: Status effect system

**Files:**
- Create: `frontend/src/game/statusEffects.ts`
- Test: `frontend/src/game/__tests__/statusEffects.test.ts`
- Modify: `frontend/src/game/types.ts` — add status effect fields to UnitInstance
- Modify: `frontend/src/game/GameController.ts`

- [ ] **Step 1: Write failing tests**

Test: apply burn (damage per turn start), apply blind (skip activation), apply slow (reduce initiative + speed). Duration ticks down. Same effect replaces, doesn't stack. Polymorphed/cursed are separate flags with their own logic.

- [ ] **Step 2: Add status fields to UnitInstance**

```typescript
statusEffects: StatusEffect[];
// where StatusEffect = { type: 'burn'|'blind'|'slow', value: number, turnsRemaining: number, sourcePlayerId: number }
```

- [ ] **Step 3: Implement statusEffects.ts**

`applyStatus(unit, effect)`, `tickStatuses(unit)` (at activation start: tick duration, apply per-turn effects like burn damage, check blind skip), `removeStatus(unit, type)`.

- [ ] **Step 4: Wire Torchbearer burning_strike** — on melee hit, apply burn for 1 turn (×0.5 base ATK as fire damage)

- [ ] **Step 5: Wire Torchbearer volatile** — 25% chance self-burn on attack

- [ ] **Step 6: Wire spell status effects** — Storm applies blind, Surge applies slow

- [ ] **Step 7: Wire status effect icons on unit sprites** — small icon overlay (burn/blind/slow)

- [ ] **Step 8: Run tests + verify in browser**

- [ ] **Step 9: Commit**

```bash
git commit -m "feat: status effects — burn, blind, slow with per-turn tick and visual indicators"
```

---

## Phase B19: Polymorph + Curse

### Task 21: Transformation and stat debuff

**Files:**
- Modify: `frontend/src/game/spellEffects.ts`
- Modify: `frontend/src/game/statusEffects.ts`
- Test: `frontend/src/game/__tests__/polymorph.test.ts`

- [ ] **Step 1: Write failing tests**

Polymorph: target becomes sheep (ATK 0, DEF 0, Init 0, Speed 1, can't attack/use abilities). Duration scales with spellPower. Sprite swaps to sheep. Dispellable (Healing on polymorphed target removes it). Peasant sheep_slayer deals ×2 to polymorphed.

Curse: reduces ATK, DEF, HP by spellPower%. Forbids buffs/dispels on target. Duration scales.

- [ ] **Step 2: Implement polymorph logic**

On cast success: store original stats, replace with sheep stats, set `polymorphed: true`. On expiry: restore original stats. Visual: swap sprite to `happysheep_idle`.

- [ ] **Step 3: Implement curse logic**

On cast success: reduce stats by %, set `cursed: true` (blocks healing/buffs targeting this unit). On expiry: restore stats.

- [ ] **Step 4: Run tests + verify in browser**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: polymorph (sheep transform) + curse (stat debuff, blocks buffs)"
```

---

## Phase B20: Spearman Pierce + Pyro-Goblin Cascade

### Task 22: Directional attack mechanics

**Files:**
- Create: `frontend/src/game/abilities/directional.ts`
- Test: `frontend/src/game/__tests__/directional.test.ts`
- Modify: `frontend/src/game/actions/attackUnit.ts`

- [ ] **Step 1: Write failing tests**

Pierce: Spearman attack hits target + 1 cell behind in same direction. Second cell takes same damage. Direction determined by attacker→target hex vector.

Cascade: Pyro-Goblin ranged attack continues 3 cells behind target, each hit unit takes ×0.5 damage.

- [ ] **Step 2: Implement directional.ts**

`getPierceTargets(attackerHex, targetHex)`: returns [targetHex, behindHex] — the cell directly behind target in attack direction. `getCascadeCells(attackerHex, targetHex, count)`: returns cells behind target along line.

Uses `hexDirection` from hexUtils to determine attack vector, then projects along that direction.

- [ ] **Step 3: Wire into attackUnit.ts**

If attacker has `pierce` ability: apply damage to both cells. If attacker has `cascade` ability: apply ×0.5 damage to cascade cells.

- [ ] **Step 4: Visual: show damage numbers on all hit targets**

- [ ] **Step 5: Run tests + verify in browser**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: spearman pierce (2-cell hit) + pyro-goblin cascade (3-cell splash)"
```

---

## Phase B21: On-Death Triggers (Demolitionist)

### Task 23: Explosive + Detonate + Mine Mode

**Files:**
- Create: `frontend/src/game/abilities/onDeath.ts`
- Test: `frontend/src/game/__tests__/demolitionist.test.ts`
- Modify: `frontend/src/game/GameController.ts`

- [ ] **Step 1: Write failing tests**

Explosive: on death, 100 magic damage to ALL units (allies too!) in surrounding hexes (ring 1). Detonate: active ability, kills self → triggers explosive. Mine Mode: set hidden flag, 3-turn timer, invisible to all, proximity detonation (any unit enters adjacent hex → auto-detonate).

- [ ] **Step 2: Implement onDeath.ts**

`handleUnitDeath(state, unitUid)` — check for on-death abilities. Explosive: calculate AoE damage, apply to all units in range (including friendly), chain check (if explosion kills another Demolitionist, chain reaction).

- [ ] **Step 3: Implement detonate active**

Kills unit → triggers `handleUnitDeath`.

- [ ] **Step 4: Implement mine mode**

Set `hidden: true`, `mineTimer: 3` on unit. Hidden units: not visible on either player's board (remove sprite), not targetable. On any unit movement: check if destination is adjacent to hidden Demolitionist → auto-detonate. After 3 turns: unhide, 1-turn cooldown.

- [ ] **Step 5: Visual: explosion FX, screen shake, chain reaction**

- [ ] **Step 6: Run tests + verify in browser**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: demolitionist explosive, detonate, mine mode with chain reactions"
```

---

## Phase B22: Garrison System (Tower Mount)

### Task 24: Units entering buildings

**Files:**
- Create: `frontend/src/game/abilities/garrison.ts`
- Test: `frontend/src/game/__tests__/garrison.test.ts`
- Modify: `frontend/src/game/actions/moveUnit.ts`
- Modify: `frontend/src/game/combat.ts`

- [ ] **Step 1: Write failing tests**

Only ranged units (Archer, Sniper) can enter Tower. Costs +1 movement AP. Inside: immune to melee attacks and melee blocking penalty. Takes ×1.5 ranged damage. Tower destroyed → garrisoned unit ejected to nearest empty hex, takes fall damage (10% max HP). Vantage Point active: garrisoned unit gets ×1.5 damage + no distance penalty next turn.

- [ ] **Step 2: Implement garrison.ts**

`canEnterGarrison(unit, building)`: check unit has `tower_mount` ability, building has `garrison`, unit is ranged, unit has enough AP. `enterGarrison(state, unitUid, buildingUid)`: set `unit.garrisonedIn = buildingUid`, remove unit from board cell (visually inside building). `exitGarrison(state, unitUid)`: place in nearest empty hex.

- [ ] **Step 3: Modify combat targeting**

Garrisoned units: can't be melee attacked. Ranged attacks against them deal ×1.5. Garrisoned units can still shoot (from building position).

- [ ] **Step 4: Implement Vantage Point active**

Tower ability: ×1.5 damage + no distance penalty for garrisoned unit next turn. 3-turn CD.

- [ ] **Step 5: Visual: unit sprite partially hidden behind tower, small indicator**

- [ ] **Step 6: Run tests + verify in browser**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: garrison system — tower mount, vantage point, melee immunity"
```

---

## Phase B23: Aura System (Shield Wall, Divine Favour, Sacred Ground)

### Task 25: Persistent area buffs

**Files:**
- Create: `frontend/src/game/abilities/auras.ts`
- Test: `frontend/src/game/__tests__/auras.test.ts`
- Modify: `frontend/src/game/combat.ts`

- [ ] **Step 1: Write failing tests**

Shield Wall (Knight): allied units in adjacent hexes get +DEF bonus. Bonus recalculates when Knight moves or dies. Divine Favour (Barracks): enables Knight's Divine Blessing. Barracks destroyed → all Knights revert to base stats. Sacred Ground (Monastery): all healing ×1.25 while Monastery alive.

- [ ] **Step 2: Implement auras.ts**

`recalculateAuras(state)` — called after any unit moves/dies/spawns. Scans all units with aura abilities, applies/removes bonuses. Knight Shield Wall: +3 DEF to adjacent allies. Stores applied bonuses separately from base stats so removal is clean.

- [ ] **Step 3: Implement Divine Blessing active**

Knight checks if any friendly Barracks alive. If yes: switch to warrior_v1 sprite, +5 ATK, +5 DEF, +20 HP. On Barracks death: revert all active blessings.

- [ ] **Step 4: Implement Fortify active (Barracks)**

+5 DEF to all allied units in surrounding hexes for 2 turns. 3-turn CD.

- [ ] **Step 5: Visual: aura glow under buffed units, buff icons**

- [ ] **Step 6: Run tests + verify in browser**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: aura system — shield wall, divine favour, sacred ground, fortify"
```

---

## Phase B24: Terrain Effects (Firewall)

### Task 26: Torchbearer Firewall

**Files:**
- Create: `frontend/src/game/abilities/terrainEffects.ts`
- Test: `frontend/src/game/__tests__/terrainEffects.test.ts`
- Modify: `frontend/src/game/types.ts` (TerrainEffect already defined)
- Modify: `frontend/src/game/actions/moveUnit.ts`
- Modify: `frontend/src/game/GameController.ts`

- [ ] **Step 1: Write failing tests**

Firewall: 3 cells in front of Torchbearer. ×1.5 ATK damage per turn to units inside. Moving through fire cell also deals damage. Lasts 2 turns. CD: 2 turns after wall expires. Fire-resistant units (Pyro-Goblin) take ×0.5.

- [ ] **Step 2: Implement terrainEffects.ts**

`createFirewall(state, casterUid, direction)`: places TerrainEffect on 3 cells in front. `tickTerrainEffects(state)`: at turn start, damage units standing in fire, decrement duration, remove expired. `checkMovementDamage(state, unitUid, path)`: damage unit for each fire cell traversed.

- [ ] **Step 3: Modify moveUnit to check terrain damage**

- [ ] **Step 4: Visual: fire sprites on affected hexes, damage on movement through**

- [ ] **Step 5: Run tests + verify in browser**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: firewall terrain effect — 3 cells, damage on stay/movement, 2-turn duration"
```

---

## Phase B25: God's Rage (Monastery Sacrifice)

### Task 27: Sacrifice mechanic

**Files:**
- Create: `frontend/src/game/abilities/sacrifice.ts`
- Test: `frontend/src/game/__tests__/sacrifice.test.ts`
- Modify: `frontend/src/game/GameController.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Write failing tests**

God's Rage: player selects units to sacrifice. Total sacrificed HP capped at Monastery's current HP. Destroys Monastery. Deals `(sacrificedHP + monasteryHP) / 1.5 / enemyCount` damage to ALL enemy units and buildings. Must sacrifice at least 1 unit.

- [ ] **Step 2: Implement sacrifice.ts**

`canGodsRage(state, monasteryUid)`: check Monastery alive, player has other units. `executeGodsRage(state, monasteryUid, sacrificeUids)`: validate HP cap, kill sacrificed units, destroy Monastery, calculate and distribute damage.

- [ ] **Step 3: Wire sacrifice UI**

Multi-select mode: click units to sacrifice (highlight selected, show running HP total vs cap). Confirm button. On confirm: big explosion FX, all enemies take damage.

- [ ] **Step 4: Run tests + verify in browser**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: God's Rage — monastery sacrifice, pooled AoE damage"
```

---

## Phase B26: Integration Test + Polish

### Task 28: Full game flow test

**Files:**
- Test: `frontend/src/game/__tests__/integration.test.ts`
- Modify: `frontend/src/pages/Battle.tsx`

- [ ] **Step 1: Write integration test**

Simulate a full game: P1 spawns units, P2 spawns units, movement, combat, spell casting, ability usage, death triggers, hero barrier drops, hero death → game over. All through GameController API. Verify state hash determinism: replay same actions from same seed → identical final hash.

- [ ] **Step 2: Polish battle UI**

Turn counter, active player indicator, pass confirmation, smooth camera following current unit, death animations, HP bar updates.

- [ ] **Step 3: Verify complete gameplay loop in browser**

Play a full match against yourself (hot-seat). All abilities work. Timer works. Game ends correctly.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: battle system integration test + UI polish"
```

---

## After All Battle Phases

- **B27:** Replace card picker with deck system (20 random in-game copies, draw 4, draw 1/turn, 6 hand limit)
- **B28:** Duel lobby frontend (DuelManager contract integration)
- **B29:** State channel + WebRTC multiplayer
- **B30:** Engine version hash verification at match handshake

---

## Key Design Decisions

1. **GameController mutates GameState + emits events** — avoids deep copying at 60fps
2. **React for overlays only** — card picker, initiative sidebar, timer, game-over. Board lives in engine scene graph
3. **Simplified formulas for debug** — no hero stat modifiers. `max(1, atk - def)`, flat 10% crit. Full GDD formulas added when hero system wires up
4. **Seeded PRNG** — all random rolls deterministic from match seed
5. **Integer-only game math** — no floating point in damage/healing calculations, use `Math.floor` everywhere
6. **Canonical state hashing** — every transition produces verifiable hash for future state channel
7. **Input validation everywhere** — reject impossible actions even from local client
8. **Factions replace schools** — Castle/Inferno/Necropolis/Dungeon for spell affinity, not Earth/Fire/Air/Water
9. **Goblin magic → physical vs buildings** — Inferno faction units deal magic damage that converts to physical against buildings (bypasses magic resistance)

## Verification Strategy

Each phase: (1) Vitest unit tests for game logic, (2) visual browser test on `/battle` page, (3) git commit on pass.
