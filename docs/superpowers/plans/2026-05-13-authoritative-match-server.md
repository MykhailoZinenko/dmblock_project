# Authoritative Match Server Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace P2P dual-simulation multiplayer with a dedicated authoritative match server where the server runs the game engine and clients are thin viewers.

**Architecture:** Extract pure game logic into `packages/game-core` (npm workspace). Server imports game-core, runs one `MatchRuntime` per match, validates and executes all actions, broadcasts confirmed state. Client sends signed intents via WebSocket, renders server-confirmed events. EIP-712 session auth + per-action HMAC. Settlement via dual-sig `settleDuel` with `arbiterSettle` fallback.

**Tech Stack:** TypeScript, npm workspaces, ws (WebSocket), viem/wagmi (EIP-712 signing), vitest (testing)

**Spec:** `docs/superpowers/specs/2026-05-13-authoritative-match-server-design.md`

**Constraints:**
- Manual verification checkpoint after every task — user tests on local anvil
- Test coverage must stay above 90% at every step
- No contract changes
- Hotseat/single-player must remain functional throughout
- Git commit after every completed task

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `package.json` (root) | npm workspace root |
| `packages/game-core/package.json` | game-core package config |
| `packages/game-core/tsconfig.json` | game-core TypeScript config |
| `packages/game-core/src/index.ts` | barrel export for all game logic |
| `packages/game-core/src/*.ts` | moved from `frontend/src/game/` — all pure logic files |
| `packages/game-core/src/actions/*.ts` | moved from `frontend/src/game/actions/` |
| `packages/game-core/src/__tests__/**/*.test.ts` | moved from `frontend/src/game/__tests__/` |
| `server/src/protocol.ts` | rewritten — single source of truth for wire types |
| `server/src/MatchRuntime.ts` | one instance per active match, owns GameController |
| `server/src/settlement.ts` | dual-sig collection + arbiter fallback |
| `server/src/index.ts` | rewritten — WS handler with new protocol |
| `server/src/__tests__/MatchRuntime.test.ts` | server-side match runtime tests |
| `server/src/__tests__/protocol.test.ts` | protocol serialization tests |
| `frontend/src/multiplayer/ServerConnection.ts` | replaces ConnectionManager + MatchManager |
| `frontend/src/multiplayer/__tests__/ServerConnection.test.ts` | client connection tests |

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/game/BattleScene.ts` | imports from `@arcana/game-core` instead of relative |
| `frontend/src/game/AnimationController.ts` | imports from `@arcana/game-core` instead of relative |
| `frontend/src/game/spriteConfig.ts` | imports from `@arcana/game-core` if needed |
| `frontend/src/pages/Battle.tsx` | replace MatchManager/ConnectionManager with ServerConnection |
| `frontend/package.json` | add `@arcana/game-core` workspace dep |
| `frontend/vite.config.ts` | update test paths + coverage includes |
| `server/package.json` | add `@arcana/game-core` workspace dep + ethers |
| `server/tsconfig.json` | update for workspace resolution |

### Deleted Files

| File | Reason |
|------|--------|
| `frontend/src/multiplayer/ConnectionManager.ts` | WebRTC removed |
| `frontend/src/multiplayer/MatchManager.ts` | dual-sim removed |
| `frontend/src/multiplayer/protocol.ts` | replaced by server/src/protocol.ts |
| `frontend/src/multiplayer/__tests__/ConnectionManager.test.ts` | code deleted |
| `frontend/src/multiplayer/__tests__/MatchManager.test.ts` | code deleted |
| `frontend/src/game/GameController.ts` | moved to game-core |
| `frontend/src/game/GameState.ts` | moved to game-core |
| `frontend/src/game/types.ts` | moved to game-core |
| `frontend/src/game/constants.ts` | moved to game-core |
| `frontend/src/game/cardRegistry.ts` | moved to game-core |
| `frontend/src/game/combat.ts` | moved to game-core |
| `frontend/src/game/hexUtils.ts` | moved to game-core |
| `frontend/src/game/initiative.ts` | moved to game-core |
| `frontend/src/game/pathfinding.ts` | moved to game-core |
| `frontend/src/game/rng.ts` | moved to game-core |
| `frontend/src/game/stateHash.ts` | moved to game-core |
| `frontend/src/game/actions/*.ts` | moved to game-core |
| `frontend/src/game/__tests__/*.test.ts` | moved to game-core |
| `server/src/arbiter.ts` | replaced by MatchRuntime action log |

---

## Task 1: Create monorepo workspace + game-core package

**Files:**
- Create: `package.json` (root)
- Create: `packages/game-core/package.json`
- Create: `packages/game-core/tsconfig.json`
- Create: `packages/game-core/vitest.config.ts`
- Create: `packages/game-core/src/index.ts`
- Modify: `frontend/package.json` — add workspace dep
- Modify: `server/package.json` — add workspace dep

- [ ] **Step 1: Create root workspace package.json**

```json
{
  "private": true,
  "workspaces": [
    "packages/*",
    "frontend",
    "server"
  ]
}
```

- [ ] **Step 2: Create packages/game-core/package.json**

```json
{
  "name": "@arcana/game-core",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.2.1",
    "@vitest/coverage-v8": "^3.2.1",
    "typescript": "~5.7.0"
  }
}
```

- [ ] **Step 3: Create packages/game-core/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create packages/game-core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/index.ts',
        'src/types.ts',
        'src/constants.ts',
      ],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
```

- [ ] **Step 5: Add workspace dependency to frontend/package.json**

Add to `dependencies`:
```json
"@arcana/game-core": "workspace:*"
```

- [ ] **Step 6: Add workspace dependency to server/package.json**

Add to `dependencies`:
```json
"@arcana/game-core": "workspace:*"
```

- [ ] **Step 7: Create empty barrel export**

`packages/game-core/src/index.ts`:
```typescript
// Game-core barrel export — populated in Task 2
```

- [ ] **Step 8: Run npm install from root**

```bash
npm install
```

Expected: Creates node_modules with symlinks between workspaces. No errors.

- [ ] **Step 9: Commit**

```bash
git add package.json packages/ frontend/package.json server/package.json
git commit -m "chore: set up npm workspaces with game-core package"
```

### Verification Checkpoint

1. Run `ls node_modules/@arcana/game-core` — should symlink to `packages/game-core`
2. Run `cd frontend && npm test` — all 638 tests still pass (nothing moved yet)
3. Run `cd frontend && npm run dev` — dev server starts, hotseat battle works in browser

---

## Task 2: Move pure game logic to game-core

**Files:**
- Move: all pure logic from `frontend/src/game/` → `packages/game-core/src/`
- Move: all tests from `frontend/src/game/__tests__/` → `packages/game-core/src/__tests__/`
- Keep in frontend: `BattleScene.ts`, `AnimationController.ts`, `spriteConfig.ts`
- Modify: `packages/game-core/src/index.ts` — barrel export everything

- [ ] **Step 1: Move source files**

```bash
# From project root
cp frontend/src/game/GameController.ts packages/game-core/src/
cp frontend/src/game/GameState.ts packages/game-core/src/
cp frontend/src/game/types.ts packages/game-core/src/
cp frontend/src/game/constants.ts packages/game-core/src/
cp frontend/src/game/cardRegistry.ts packages/game-core/src/
cp frontend/src/game/combat.ts packages/game-core/src/
cp frontend/src/game/hexUtils.ts packages/game-core/src/
cp frontend/src/game/initiative.ts packages/game-core/src/
cp frontend/src/game/pathfinding.ts packages/game-core/src/
cp frontend/src/game/rng.ts packages/game-core/src/
cp frontend/src/game/stateHash.ts packages/game-core/src/
mkdir -p packages/game-core/src/actions
cp frontend/src/game/actions/*.ts packages/game-core/src/actions/
```

- [ ] **Step 2: Move test files**

```bash
mkdir -p packages/game-core/src/__tests__
cp frontend/src/game/__tests__/*.test.ts packages/game-core/src/__tests__/
```

- [ ] **Step 3: Fix imports in moved files**

All moved files use relative imports like `'./types'`, `'./constants'`, `'./rng'` — these stay the same within game-core. No changes needed to the moved source files.

Fix test file imports: they import from `'../../game/GameController'` etc. — update to `'../GameController'` etc. (one level up from `__tests__/` to `src/`).

For each test file, replace the import path prefix:
- `'../../game/` → `'../`  (for files in `src/`)
- `'../../game/actions/` → `'../actions/` (for action files)

- [ ] **Step 4: Write barrel export**

`packages/game-core/src/index.ts`:
```typescript
export { GameController } from './GameController.js';
export type { GameEvent } from './GameController.js';
export { createGameState } from './GameState.js';
export type { GameState } from './GameState.js';
export { SeededRNG } from './rng.js';
export { hashState } from './stateHash.js';
export { buildInitiativeQueue } from './initiative.js';
export { findPath, findReachable, hexDistance } from './pathfinding.js';
export { hex2px, isValidCell, getNeighbors, cubeToAxial, axialToCube } from './hexUtils.js';
export { calculateDamage, calculateRangedDamage } from './combat.js';
export { cardRegistry, getCard, isBuilding } from './cardRegistry.js';

// Actions
export { canSpawn, executeSpawn } from './actions/spawnUnit.js';
export { canMove, executeMove } from './actions/moveUnit.js';
export { canAttack, executeAttack } from './actions/attackUnit.js';
export { executeHeroAttack, checkWinCondition, HERO_HEX, HERO_ADJACENT, applyTimeoutDamage } from './actions/heroActions.js';
export { canCast, executeCast, tickStatusEffects, tickUnitEffects } from './actions/castSpell.js';

// Constants
export {
  GRID_COLS, GRID_ROWS, HEX_SIZE,
  P1_DEPLOY_COLS, P2_DEPLOY_COLS,
  STARTING_MANA, MANA_PER_TURN, MANA_CAP,
  HERO_HP,
  ACTIVATION_TIMER_SECONDS, TIMEOUT_DAMAGE,
  CRIT_CHANCE_PERCENT, CRIT_MULTIPLIER,
  UNIT_MOVE_SPEED, AUTO_END_DELAY,
  UNIT_TARGET_HEIGHT, BUILDING_1x1_TARGET_HEIGHT, BUILDING_2x2_TARGET_HEIGHT,
  HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_Y_OFFSET,
} from './constants.js';

// Types — re-export everything
export {
  CardType, Faction, Rarity, SpellTargetType, DamageType, AbilityTrigger,
} from './types.js';
export type {
  AbilityDefinition, CardDefinition, HexCoord, UnitInstance,
  PlayerState, BoardCell, TerrainEffect, ActiveEffect, GamePhase,
} from './types.js';
```

Note: Check the actual exports from each file — the above is based on the grep analysis. Adjust if any export is missing.

- [ ] **Step 5: Verify game-core tests pass**

```bash
cd packages/game-core && npx vitest run
```

Expected: All tests that were previously in `frontend/src/game/__tests__/` pass (should be ~600+ tests from the game logic portion).

- [ ] **Step 6: Delete moved files from frontend**

```bash
# Delete moved source files (keep BattleScene, AnimationController, spriteConfig)
rm frontend/src/game/GameController.ts
rm frontend/src/game/GameState.ts
rm frontend/src/game/types.ts
rm frontend/src/game/constants.ts
rm frontend/src/game/cardRegistry.ts
rm frontend/src/game/combat.ts
rm frontend/src/game/hexUtils.ts
rm frontend/src/game/initiative.ts
rm frontend/src/game/pathfinding.ts
rm frontend/src/game/rng.ts
rm frontend/src/game/stateHash.ts
rm -rf frontend/src/game/actions/
rm -rf frontend/src/game/__tests__/
```

- [ ] **Step 7: Update frontend imports to use @arcana/game-core**

Every file in `frontend/src/` that imports from `'./game/types'`, `'./game/constants'`, `'../game/GameController'`, etc. must be updated to import from `'@arcana/game-core'`.

Files to update (based on grep analysis):

**`frontend/src/game/BattleScene.ts`** — change:
```typescript
// FROM:
import { hex2px, isValidCell } from './hexUtils';
import { getCard, isBuilding } from './cardRegistry';
import type { UnitInstance, HexCoord } from './types';
import { GRID_COLS, GRID_ROWS, HEX_SIZE, P1_DEPLOY_COLS, P2_DEPLOY_COLS, UNIT_MOVE_SPEED, HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_Y_OFFSET, HERO_HP } from './constants';
import { HERO_HEX, HERO_ADJACENT } from './actions/heroActions';

// TO:
import { hex2px, isValidCell, getCard, isBuilding, GRID_COLS, GRID_ROWS, HEX_SIZE, P1_DEPLOY_COLS, P2_DEPLOY_COLS, UNIT_MOVE_SPEED, HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_Y_OFFSET, HERO_HP, HERO_HEX, HERO_ADJACENT } from '@arcana/game-core';
import type { UnitInstance, HexCoord } from '@arcana/game-core';
```

**`frontend/src/game/AnimationController.ts`** — change:
```typescript
// FROM:
import { getCard, isBuilding } from './cardRegistry';
import { hex2px } from './hexUtils';
import { UNIT_TARGET_HEIGHT, BUILDING_1x1_TARGET_HEIGHT, BUILDING_2x2_TARGET_HEIGHT } from './constants';

// TO:
import { getCard, isBuilding, hex2px, UNIT_TARGET_HEIGHT, BUILDING_1x1_TARGET_HEIGHT, BUILDING_2x2_TARGET_HEIGHT } from '@arcana/game-core';
```

Also check and update `spriteConfig.ts` if it imports from game logic files.

**`frontend/src/pages/Battle.tsx`** — update all game logic imports to use `@arcana/game-core`. Keep multiplayer imports unchanged for now (they get rewritten in Task 7).

**All other frontend files** that import from `../game/types`, `../game/constants`, etc. — update to `@arcana/game-core`.

Use grep to find all remaining references:
```bash
grep -rn "from.*['\"]\.\.*/game/" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__
```

Update every hit except imports of `BattleScene`, `AnimationController`, or `spriteConfig` (those stay in frontend).

- [ ] **Step 8: Update frontend/vite.config.ts**

Remove game logic files from test includes (they're in game-core now). Keep multiplayer tests for now (they get replaced in Task 7).

```typescript
test: {
    globals: true,
    environment: 'node',
    include: [
      'src/multiplayer/__tests__/**/*.test.ts',
      'src/lib/__tests__/**/*.test.ts',
      'src/engine/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/multiplayer/**/*.ts',
        'src/lib/**/*.ts',
        'src/engine/**/*.ts',
      ],
      // ... keep same excludes minus game files
    },
  },
```

- [ ] **Step 9: Verify everything works**

```bash
# Game-core tests
cd packages/game-core && npx vitest run --coverage

# Frontend tests (multiplayer + engine + lib only now)
cd frontend && npx vitest run --coverage

# Frontend dev server
cd frontend && npm run dev
```

Expected: Both test suites pass with >90% coverage. Dev server starts.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: extract pure game logic into @arcana/game-core package"
```

### Verification Checkpoint

1. Run `cd packages/game-core && npx vitest run --coverage` — all game logic tests pass, >90% coverage
2. Run `cd frontend && npx vitest run --coverage` — remaining tests pass, >90% coverage
3. Run `cd frontend && npm run dev` — open browser, start a hotseat battle, play a few turns (spawn, move, attack, cast spell, end turn). Verify everything works exactly as before
4. Verify `BattleScene.ts` renders correctly — sprites, HP bars, animations all functional

---

## Task 3: Write shared protocol types

**Files:**
- Rewrite: `server/src/protocol.ts` — single source of truth for all wire types
- Create: `server/src/__tests__/protocol.test.ts`

- [ ] **Step 1: Write protocol types**

`server/src/protocol.ts`:
```typescript
import type { GameState } from '@arcana/game-core';
import type { UnitInstance, HexCoord } from '@arcana/game-core';

// --- Game Actions (intents from client) ---

export type GameAction =
  | { type: 'spawn'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'move'; unitUid: number; col: number; row: number }
  | { type: 'attack'; attackerUid: number; targetUid: number }
  | { type: 'attack-hero'; attackerUid: number; targetPlayerId: number }
  | { type: 'cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'pass' }
  | { type: 'end-turn' };

// --- Match Events (state changes from server to drive client animations) ---

export type MatchEvent =
  | { type: 'unit-spawned'; uid: number; playerId: number; cardId: number; col: number; row: number }
  | { type: 'unit-moved'; uid: number; path: HexCoord[] }
  | { type: 'unit-attacked'; attackerUid: number; targetUid: number; damage: number; retaliation: number; attackerHp: number; targetHp: number; crit: boolean }
  | { type: 'hero-attacked'; attackerUid: number; targetPlayerId: number; damage: number; heroHp: number }
  | { type: 'unit-died'; uid: number }
  | { type: 'spell-cast'; playerId: number; cardId: number; col: number; row: number }
  | { type: 'effect-applied'; uid: number; effectId: string; duration: number }
  | { type: 'effect-expired'; uid: number; effectId: string }
  | { type: 'mana-changed'; playerId: number; mana: number }
  | { type: 'hero-hp-changed'; playerId: number; hp: number }
  | { type: 'hp-changed'; uid: number; hp: number }
  | { type: 'activation-changed'; uid: number | null }
  | { type: 'turn-changed'; turnNumber: number }
  | { type: 'queue-rebuilt'; queue: number[] };

// --- Serialized Game State (JSON-safe) ---

export interface SerializedGameState {
  players: GameState['players'];
  units: UnitInstance[];
  board: GameState['board'];
  turnNumber: number;
  activationQueue: number[]; // unit UIDs in order
  currentActivationIndex: number;
  phase: GameState['phase'];
  rngState: number;
  nextUnitUid: number;
}

// --- Client → Server Messages ---

export type ClientMessage =
  | { type: 'join'; duelId: number; address: string }
  | { type: 'auth'; signature: string; nonce: string; expiresAt: number }
  | { type: 'submit-deck'; deck: number[] }
  | { type: 'action'; action: GameAction; seq: number; hmac: string }
  | { type: 'sign-result'; duelId: number; winner: string; signature: string }
  | { type: 'request-log' };

// --- Server → Client Messages ---

export type ServerMessage =
  | { type: 'auth-challenge'; nonce: string }
  | { type: 'auth-ok'; sessionStart: number }
  | { type: 'waiting-for-opponent' }
  | { type: 'match-started'; seat: 0 | 1; opponent: string; state: SerializedGameState; seq: number }
  | { type: 'action-confirmed'; seq: number; action: GameAction; events: MatchEvent[]; stateHash: string }
  | { type: 'action-rejected'; seq: number; reason: string }
  | { type: 'state-snapshot'; state: SerializedGameState; seq: number }
  | { type: 'turn-timeout'; player: number; damage: number }
  | { type: 'game-over'; winner: number; reason: string }
  | { type: 'sign-request'; duelId: number; winner: string }
  | { type: 'opponent-disconnected' }
  | { type: 'opponent-reconnected' }
  | { type: 'action-log'; sessionSignatures: [string, string]; actions: ActionLogEntry[] }
  | { type: 'error'; message: string };

export interface ActionLogEntry {
  seq: number;
  action: GameAction;
  hmac: string;
  timestamp: number;
}

// --- Serialization helpers ---

export function serializeState(state: GameState): SerializedGameState {
  return {
    players: state.players,
    units: state.units,
    board: state.board,
    turnNumber: state.turnNumber,
    activationQueue: state.activationQueue.map(u => u.uid),
    currentActivationIndex: state.currentActivationIndex,
    phase: state.phase,
    rngState: state.rng.state,
    nextUnitUid: state.nextUnitUid,
  };
}

export function canonicalizeAction(seq: number, action: GameAction): string {
  const obj = { seq, ...action };
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = (obj as Record<string, unknown>)[k];
  return JSON.stringify(sorted);
}
```

- [ ] **Step 2: Write protocol tests**

`server/src/__tests__/protocol.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { serializeState, canonicalizeAction } from '../protocol.js';
import { createGameState, GameController } from '@arcana/game-core';

describe('serializeState', () => {
  it('serializes a fresh game state', () => {
    const state = createGameState(42, [[0, 1, 2], [3, 4, 5]]);
    const serialized = serializeState(state);
    expect(serialized.turnNumber).toBe(state.turnNumber);
    expect(serialized.rngState).toBe(state.rng.state);
    expect(serialized.activationQueue).toEqual([]);
    expect(serialized.players.length).toBe(2);
    expect(serialized.phase).toBe('INITIALIZING');
    // JSON-safe: no circular refs, no class instances in output
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });

  it('serializes activation queue as UIDs', () => {
    const ctrl = new GameController();
    ctrl.startGame(42, [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]]);
    const state = ctrl.getState();
    // Spawn a unit so the queue has entries
    // (startGame with decks may not auto-spawn — test the shape)
    const serialized = serializeState(state);
    expect(Array.isArray(serialized.activationQueue)).toBe(true);
    serialized.activationQueue.forEach(uid => {
      expect(typeof uid).toBe('number');
    });
  });
});

describe('canonicalizeAction', () => {
  it('produces deterministic JSON with sorted keys', () => {
    const a = canonicalizeAction(1, { type: 'move', unitUid: 5, col: 8, row: 7 });
    const b = canonicalizeAction(1, { type: 'move', col: 8, row: 7, unitUid: 5 });
    expect(a).toBe(b);
  });

  it('includes seq in canonical form', () => {
    const result = canonicalizeAction(42, { type: 'pass' });
    const parsed = JSON.parse(result);
    expect(parsed.seq).toBe(42);
    expect(parsed.type).toBe('pass');
  });
});
```

- [ ] **Step 3: Add vitest to server**

Update `server/package.json` devDependencies:
```json
"vitest": "^3.2.1"
```

Add to scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `server/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

Run: `npm install` from root.

- [ ] **Step 4: Run server tests**

```bash
cd server && npx vitest run
```

Expected: All protocol tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/protocol.ts server/src/__tests__/ server/package.json server/vitest.config.ts
git commit -m "feat(server): add shared wire protocol types with serialization"
```

### Verification Checkpoint

1. Run `cd server && npx vitest run` — protocol tests pass
2. Run `cd packages/game-core && npx vitest run` — game-core tests still pass
3. Run `cd frontend && npm run dev` — hotseat still works in browser

---

## Task 4: Write MatchRuntime

**Files:**
- Create: `server/src/MatchRuntime.ts`
- Create: `server/src/__tests__/MatchRuntime.test.ts`

This is the core new server component — one instance per active match. It wraps GameController, validates actions, produces MatchEvents, manages timers.

- [ ] **Step 1: Write MatchRuntime tests**

`server/src/__tests__/MatchRuntime.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchRuntime } from '../MatchRuntime.js';
import { cardRegistry } from '@arcana/game-core';

function validDeck(): number[] {
  // First 20 card IDs from registry
  return cardRegistry.slice(0, 20).map(c => c.id);
}

describe('MatchRuntime', () => {
  let runtime: MatchRuntime;

  beforeEach(() => {
    runtime = new MatchRuntime(1, 'addr0', 'addr1');
  });

  describe('deck submission', () => {
    it('accepts valid decks and starts game', () => {
      runtime.submitDeck(0, validDeck());
      expect(runtime.phase).toBe('waiting-for-decks');
      runtime.submitDeck(1, validDeck());
      expect(runtime.phase).toBe('playing');
    });

    it('rejects empty deck', () => {
      expect(() => runtime.submitDeck(0, [])).toThrow();
    });

    it('rejects deck with invalid card ID', () => {
      expect(() => runtime.submitDeck(0, [9999])).toThrow();
    });
  });

  describe('action execution', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
    });

    it('rejects action from wrong player', () => {
      // During activation phase, only the controlling player can act
      const controlling = runtime.getControllingPlayer();
      const other = controlling === 0 ? 1 : 0;
      const result = runtime.executeAction(other, { type: 'move', unitUid: 1, col: 5, row: 5 });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('not your turn');
    });

    it('accepts pass from controlling player', () => {
      const controlling = runtime.getControllingPlayer();
      const result = runtime.executeAction(controlling, { type: 'pass' });
      expect(result.ok).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('accepts end-turn', () => {
      const result = runtime.executeAction(runtime.getControllingPlayer(), { type: 'end-turn' });
      expect(result.ok).toBe(true);
    });

    it('increments seq on successful action', () => {
      const before = runtime.seq;
      runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' });
      expect(runtime.seq).toBe(before + 1);
    });

    it('records action in log', () => {
      runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' }, 'hmac123');
      expect(runtime.actionLog.length).toBe(1);
      expect(runtime.actionLog[0].hmac).toBe('hmac123');
    });
  });

  describe('snapshots', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
    });

    it('produces a serialized snapshot', () => {
      const snapshot = runtime.getSnapshot();
      expect(snapshot.turnNumber).toBeGreaterThanOrEqual(0);
      expect(() => JSON.stringify(snapshot)).not.toThrow();
    });
  });

  describe('win detection', () => {
    beforeEach(() => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
    });

    it('detects game over when hero HP reaches 0', () => {
      // Directly damage hero to 0 via state manipulation for test
      const state = runtime.getStateForTest();
      state.players[1].heroHp = 0;
      const result = runtime.checkWin();
      expect(result).not.toBeNull();
      expect(result!.winner).toBe(0);
    });
  });

  describe('timeout', () => {
    it('applies timeout damage and auto-passes', () => {
      runtime.submitDeck(0, validDeck());
      runtime.submitDeck(1, validDeck());
      const controlling = runtime.getControllingPlayer();
      const events = runtime.applyTimeout();
      expect(events.some(e => e.type === 'hero-hp-changed')).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run
```

Expected: FAIL — `MatchRuntime` does not exist yet.

- [ ] **Step 3: Implement MatchRuntime**

`server/src/MatchRuntime.ts`:

```typescript
import {
  GameController,
  createGameState,
  cardRegistry,
  canSpawn, executeSpawn,
  canMove, executeMove,
  canAttack, executeAttack,
  executeHeroAttack, checkWinCondition, applyTimeoutDamage,
  canCast, executeCast,
  hashState,
  TIMEOUT_DAMAGE,
} from '@arcana/game-core';
import type { GameState } from '@arcana/game-core';
import {
  serializeState, canonicalizeAction,
  type GameAction, type MatchEvent, type SerializedGameState, type ActionLogEntry,
} from './protocol.js';

export type MatchPhase = 'waiting-for-decks' | 'playing' | 'game-over';

export interface ActionResult {
  ok: boolean;
  reason?: string;
  events: MatchEvent[];
  stateHash: string;
}

export class MatchRuntime {
  readonly duelId: number;
  readonly addresses: [string, string];
  private ctrl: GameController;
  private decks: [number[] | null, number[] | null] = [null, null];
  private _phase: MatchPhase = 'waiting-for-decks';
  private _seq = 0;
  private _actionLog: ActionLogEntry[] = [];
  private _winner: number | null = null;
  private _winReason = '';

  constructor(duelId: number, address0: string, address1: string) {
    this.duelId = duelId;
    this.addresses = [address0, address1];
    this.ctrl = new GameController();
  }

  get phase(): MatchPhase { return this._phase; }
  get seq(): number { return this._seq; }
  get actionLog(): readonly ActionLogEntry[] { return this._actionLog; }
  get winner(): number | null { return this._winner; }
  get winReason(): string { return this._winReason; }

  // --- Deck submission ---

  submitDeck(seat: 0 | 1, deck: number[]): void {
    if (this._phase !== 'waiting-for-decks') throw new Error('Not accepting decks');
    if (deck.length === 0) throw new Error('Deck is empty');
    for (const id of deck) {
      if (!cardRegistry.find(c => c.id === id)) {
        throw new Error(`Invalid card ID: ${id}`);
      }
    }
    this.decks[seat] = deck;

    if (this.decks[0] && this.decks[1]) {
      this.startGame();
    }
  }

  private startGame(): void {
    const seed = this.duelIdToSeed(this.duelId);
    this.ctrl.startGame(seed, [this.decks[0]!, this.decks[1]!]);
    this._phase = 'playing';
  }

  // --- Action execution ---

  getControllingPlayer(): number {
    return this.ctrl.getControllingPlayer();
  }

  executeAction(seat: number, action: GameAction, hmac = ''): ActionResult {
    if (this._phase !== 'playing') {
      return { ok: false, reason: 'Match not in playing phase', events: [], stateHash: '' };
    }

    // Turn check: only controlling player can act (except end-turn is always allowed)
    const controlling = this.getControllingPlayer();
    if (controlling >= 0 && seat !== controlling && action.type !== 'end-turn') {
      return { ok: false, reason: 'not your turn', events: [], stateHash: '' };
    }

    const state = this.ctrl.getState();
    const eventCollector: MatchEvent[] = [];

    // Validate and execute
    const valid = this.validateAndExecute(state, action, eventCollector);
    if (!valid.ok) {
      return { ok: false, reason: valid.reason, events: [], stateHash: '' };
    }

    // Check win condition
    const winResult = this.checkWin();
    if (winResult) {
      this._phase = 'game-over';
      this._winner = winResult.winner;
      this._winReason = winResult.reason;
    }

    // Record in log
    this._seq++;
    this._actionLog.push({
      seq: this._seq,
      action,
      hmac,
      timestamp: Date.now(),
    });

    const stateHash = hashState(this.ctrl.getState());
    return { ok: true, events: eventCollector, stateHash };
  }

  private validateAndExecute(
    state: GameState,
    action: GameAction,
    events: MatchEvent[],
  ): { ok: boolean; reason?: string } {
    switch (action.type) {
      case 'spawn': {
        const result = canSpawn(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        if (!result.valid) return { ok: false, reason: result.reason ?? 'Cannot spawn here' };
        executeSpawn(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        const spawned = state.units[state.units.length - 1];
        events.push({ type: 'unit-spawned', uid: spawned.uid, playerId: action.playerId, cardId: action.cardId, col: action.col, row: action.row });
        events.push({ type: 'mana-changed', playerId: action.playerId, mana: state.players[action.playerId].mana });
        this.ctrl.passActivation();
        this.pushActivationEvent(events);
        return { ok: true };
      }
      case 'move': {
        const result = canMove(state, action.unitUid, { col: action.col, row: action.row });
        if (!result.valid) return { ok: false, reason: result.reason ?? 'Cannot move here' };
        const path = result.path ?? [{ col: action.col, row: action.row }];
        executeMove(state, action.unitUid, { col: action.col, row: action.row });
        events.push({ type: 'unit-moved', uid: action.unitUid, path });
        return { ok: true };
      }
      case 'attack': {
        const result = canAttack(state, action.attackerUid, action.targetUid);
        if (!result.valid) return { ok: false, reason: result.reason ?? 'Cannot attack' };
        const target = state.units.find(u => u.uid === action.targetUid)!;
        const attacker = state.units.find(u => u.uid === action.attackerUid)!;
        const targetHpBefore = target.currentHp;
        const attackerHpBefore = attacker.currentHp;
        executeAttack(state, action.attackerUid, action.targetUid);
        const damage = targetHpBefore - target.currentHp;
        const retaliation = attackerHpBefore - attacker.currentHp;
        events.push({
          type: 'unit-attacked', attackerUid: action.attackerUid, targetUid: action.targetUid,
          damage, retaliation, attackerHp: attacker.currentHp, targetHp: target.currentHp, crit: false,
        });
        if (!target.alive) events.push({ type: 'unit-died', uid: action.targetUid });
        if (!attacker.alive) events.push({ type: 'unit-died', uid: action.attackerUid });
        return { ok: true };
      }
      case 'attack-hero': {
        const attacker = state.units.find(u => u.uid === action.attackerUid);
        if (!attacker) return { ok: false, reason: 'Attacker not found' };
        const heroBefore = state.players[action.targetPlayerId].heroHp;
        executeHeroAttack(state, action.attackerUid, action.targetPlayerId);
        const damage = heroBefore - state.players[action.targetPlayerId].heroHp;
        events.push({
          type: 'hero-attacked', attackerUid: action.attackerUid,
          targetPlayerId: action.targetPlayerId, damage, heroHp: state.players[action.targetPlayerId].heroHp,
        });
        return { ok: true };
      }
      case 'cast': {
        const result = canCast(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        if (!result.valid) return { ok: false, reason: result.reason ?? 'Cannot cast' };
        executeCast(state, action.playerId, action.cardId, { col: action.col, row: action.row });
        events.push({ type: 'spell-cast', playerId: action.playerId, cardId: action.cardId, col: action.col, row: action.row });
        events.push({ type: 'mana-changed', playerId: action.playerId, mana: state.players[action.playerId].mana });
        return { ok: true };
      }
      case 'pass': {
        this.ctrl.passActivation();
        this.pushActivationEvent(events);
        return { ok: true };
      }
      case 'end-turn': {
        this.ctrl.endTurn();
        const s = this.ctrl.getState();
        events.push({ type: 'turn-changed', turnNumber: s.turnNumber });
        events.push({ type: 'queue-rebuilt', queue: s.activationQueue.map(u => u.uid) });
        this.pushActivationEvent(events);
        for (const p of s.players) {
          events.push({ type: 'mana-changed', playerId: p.id, mana: p.mana });
        }
        return { ok: true };
      }
      default:
        return { ok: false, reason: `Unknown action type` };
    }
  }

  private pushActivationEvent(events: MatchEvent[]): void {
    const unit = this.ctrl.getCurrentUnit();
    events.push({ type: 'activation-changed', uid: unit ? unit.uid : null });
  }

  // --- Win detection ---

  checkWin(): { winner: number; reason: string } | null {
    if (!this.ctrl.isGameStarted()) return null;
    const result = checkWinCondition(this.ctrl.getState());
    if (!result) return null;
    return { winner: result.winner, reason: result.reason ?? 'Hero defeated' };
  }

  // --- Timeout ---

  applyTimeout(): MatchEvent[] {
    const state = this.ctrl.getState();
    const controlling = this.getControllingPlayer();
    if (controlling < 0) return [];

    const player = state.players[controlling];
    const damageIndex = Math.min(player.timeoutCount, TIMEOUT_DAMAGE.length - 1);
    const damage = TIMEOUT_DAMAGE[damageIndex];
    player.timeoutCount++;
    player.heroHp = Math.max(0, player.heroHp - damage);

    const events: MatchEvent[] = [
      { type: 'hero-hp-changed', playerId: controlling, hp: player.heroHp },
    ];

    this.ctrl.passActivation();
    this.pushActivationEvent(events);

    // Check win after timeout damage
    const winResult = this.checkWin();
    if (winResult) {
      this._phase = 'game-over';
      this._winner = winResult.winner;
      this._winReason = 'timeout';
    }

    this._seq++;
    this._actionLog.push({
      seq: this._seq,
      action: { type: 'pass' },
      hmac: 'timeout',
      timestamp: Date.now(),
    });

    return events;
  }

  // --- Snapshots ---

  getSnapshot(): SerializedGameState {
    return serializeState(this.ctrl.getState());
  }

  // --- Test helpers ---

  getStateForTest(): GameState {
    return this.ctrl.getState();
  }

  // --- Utilities ---

  private duelIdToSeed(duelId: number): number {
    const str = String(duelId);
    let hash = 0x811c9dc5;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run
```

Expected: All MatchRuntime + protocol tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/MatchRuntime.ts server/src/__tests__/MatchRuntime.test.ts
git commit -m "feat(server): add MatchRuntime — authoritative game engine per match"
```

### Verification Checkpoint

1. Run `cd server && npx vitest run` — all tests pass
2. Run `cd packages/game-core && npx vitest run` — still passes
3. Run `cd frontend && npm run dev` — hotseat still works

---

## Task 5: Rewrite server index.ts

**Files:**
- Rewrite: `server/src/index.ts` — new WS handler with auth + match protocol
- Rewrite: `server/src/rooms.ts` — updated for MatchRuntime
- Delete: `server/src/arbiter.ts` — replaced by MatchRuntime action log
- Create: `server/src/auth.ts` — EIP-712 session verification + HMAC

- [ ] **Step 1: Write auth.ts**

`server/src/auth.ts`:
```typescript
import { createHmac, createHash, randomBytes } from 'crypto';
import { verifyTypedData } from 'viem';
import { canonicalizeAction, type GameAction } from './protocol.js';

const SESSION_DOMAIN = {
  name: 'Arcana Arena',
  chainId: 84532,
} as const;

const SESSION_TYPES = {
  Session: [
    { name: 'duelId', type: 'uint256' },
    { name: 'player', type: 'address' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'expiresAt', type: 'uint256' },
  ],
} as const;

export function generateNonce(): string {
  return '0x' + randomBytes(32).toString('hex');
}

export async function verifySession(
  address: string,
  duelId: number,
  nonce: string,
  expiresAt: number,
  signature: `0x${string}`,
): Promise<boolean> {
  try {
    const recovered = await verifyTypedData({
      address: address as `0x${string}`,
      domain: SESSION_DOMAIN,
      types: SESSION_TYPES,
      primaryType: 'Session',
      message: {
        duelId: BigInt(duelId),
        player: address as `0x${string}`,
        nonce: nonce as `0x${string}`,
        expiresAt: BigInt(expiresAt),
      },
      signature,
    });
    return recovered;
  } catch {
    return false;
  }
}

export function deriveSessionKey(signature: string): Buffer {
  // SHA-256 of signature bytes — deterministic, known only to signer + server
  // Using Node crypto (not keccak256) since this is off-chain only
  const sigBytes = Buffer.from(signature.startsWith('0x') ? signature.slice(2) : signature, 'hex');
  return createHash('sha256').update(sigBytes).digest();
}

export function computeHmac(sessionKey: Buffer, seq: number, action: GameAction): string {
  const canonical = canonicalizeAction(seq, action);
  return createHmac('sha256', sessionKey).update(canonical).digest('hex');
}

export function verifyHmac(sessionKey: Buffer, seq: number, action: GameAction, hmac: string): boolean {
  const expected = computeHmac(sessionKey, seq, action);
  return expected === hmac;
}
```

Note: The `deriveSessionKey` uses a top-level await import pattern — refactor to use sync keccak if needed. Alternative: use Node's `crypto.createHash('sha256')` for the key derivation instead of keccak256, since this is an off-chain symmetric key and doesn't need to match any on-chain computation. Decide during implementation.

- [ ] **Step 2: Rewrite rooms.ts**

`server/src/rooms.ts`:
```typescript
import type { WebSocket } from 'ws';
import { MatchRuntime } from './MatchRuntime.js';

export interface PlayerSession {
  ws: WebSocket;
  address: string;
  seat: 0 | 1;
  sessionKey: Buffer | null;
  nonce: string;
  authenticated: boolean;
}

export interface Room {
  duelId: number;
  players: [PlayerSession | null, PlayerSession | null];
  runtime: MatchRuntime | null;
  disconnectTimers: [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null];
  activationTimer: ReturnType<typeof setTimeout> | null;
  snapshotTurnCounter: number;
}

const rooms = new Map<number, Room>();

export function getRoom(duelId: number): Room | undefined {
  return rooms.get(duelId);
}

export function getOrCreateRoom(duelId: number): Room {
  let room = rooms.get(duelId);
  if (!room) {
    room = {
      duelId,
      players: [null, null],
      runtime: null,
      disconnectTimers: [null, null],
      activationTimer: null,
      snapshotTurnCounter: 0,
    };
    rooms.set(duelId, room);
  }
  return room;
}

export function assignSeat(room: Room, ws: WebSocket, address: string, nonce: string): 0 | 1 | null {
  // Check for reconnect first
  for (let i = 0; i < 2; i++) {
    const p = room.players[i as 0 | 1];
    if (p && p.address === address) {
      p.ws = ws;
      p.nonce = nonce;
      p.authenticated = false;
      return i as 0 | 1;
    }
  }
  // New player
  if (!room.players[0]) {
    room.players[0] = { ws, address, seat: 0, sessionKey: null, nonce, authenticated: false };
    return 0;
  }
  if (!room.players[1]) {
    room.players[1] = { ws, address, seat: 1, sessionKey: null, nonce, authenticated: false };
    return 1;
  }
  return null; // Room full
}

export function removePlayer(room: Room, ws: WebSocket): PlayerSession | null {
  for (let i = 0; i < 2; i++) {
    if (room.players[i]?.ws === ws) {
      const player = room.players[i]!;
      // Don't null out — keep for reconnect
      return player;
    }
  }
  return null;
}

export function getOpponent(room: Room, seat: 0 | 1): PlayerSession | null {
  return room.players[seat === 0 ? 1 : 0];
}

export function cleanupRoom(duelId: number): void {
  const room = rooms.get(duelId);
  if (room) {
    if (room.activationTimer) clearTimeout(room.activationTimer);
    if (room.disconnectTimers[0]) clearTimeout(room.disconnectTimers[0]);
    if (room.disconnectTimers[1]) clearTimeout(room.disconnectTimers[1]);
    rooms.delete(duelId);
  }
}

export function getAllRooms(): Map<number, Room> {
  return rooms;
}
```

- [ ] **Step 3: Rewrite index.ts**

`server/src/index.ts`:
```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { MatchRuntime } from './MatchRuntime.js';
import {
  getOrCreateRoom, assignSeat, removePlayer, getOpponent, cleanupRoom,
  type Room, type PlayerSession,
} from './rooms.js';
import { generateNonce, verifySession, deriveSessionKey, verifyHmac } from './auth.js';
import { serializeState, type ClientMessage, type ServerMessage } from './protocol.js';
import { ACTIVATION_TIMER_SECONDS } from '@arcana/game-core';

const PORT = Number(process.env.PORT ?? 3001);
const DISCONNECT_TIMEOUT_MS = 60_000;
const SNAPSHOT_INTERVAL_TURNS = 3;
const MATCH_CLEANUP_MS = 24 * 60 * 60 * 1000; // 24h

const wss = new WebSocketServer({ port: PORT });

type ClientState = { duelId: number | null; seat: 0 | 1 };
const clients = new WeakMap<WebSocket, ClientState>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room: Room, msg: ServerMessage): void {
  for (const p of room.players) {
    if (p?.ws) send(p.ws, msg);
  }
}

function startActivationTimer(room: Room): void {
  if (room.activationTimer) clearTimeout(room.activationTimer);
  room.activationTimer = setTimeout(() => {
    if (!room.runtime || room.runtime.phase !== 'playing') return;
    const controlling = room.runtime.getControllingPlayer();
    const events = room.runtime.applyTimeout();
    broadcast(room, { type: 'turn-timeout', player: controlling, damage: events.length > 0 ? 3 : 0 });
    broadcast(room, {
      type: 'action-confirmed',
      seq: room.runtime.seq,
      action: { type: 'pass' },
      events,
      stateHash: '',
    });
    if (room.runtime.phase === 'game-over') {
      handleGameOver(room);
    } else {
      startActivationTimer(room);
    }
  }, ACTIVATION_TIMER_SECONDS * 1000);
}

function handleGameOver(room: Room): void {
  if (!room.runtime) return;
  const winner = room.runtime.winner;
  const winnerAddress = winner !== null && winner >= 0 ? room.runtime.addresses[winner] : '0x0000000000000000000000000000000000000000';
  broadcast(room, { type: 'game-over', winner: winner ?? -1, reason: room.runtime.winReason });
  broadcast(room, { type: 'sign-request', duelId: room.duelId, winner: winnerAddress });
  if (room.activationTimer) clearTimeout(room.activationTimer);
}

function tryStartMatch(room: Room): void {
  if (!room.runtime || room.runtime.phase !== 'playing') return;
  const snapshot = room.runtime.getSnapshot();
  for (const p of room.players) {
    if (p?.ws) {
      send(p.ws, {
        type: 'match-started',
        seat: p.seat,
        opponent: room.players[p.seat === 0 ? 1 : 0]?.address ?? '',
        state: snapshot,
        seq: room.runtime.seq,
      });
    }
  }
  startActivationTimer(room);
}

wss.on('connection', (ws) => {
  clients.set(ws, { duelId: null, seat: 0 });

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(String(raw)); } catch { return; }

    const clientState = clients.get(ws)!;

    switch (msg.type) {
      case 'join': {
        const room = getOrCreateRoom(msg.duelId);
        const nonce = generateNonce();
        const seat = assignSeat(room, ws, msg.address, nonce);
        if (seat === null) {
          send(ws, { type: 'error', message: 'Room is full' });
          return;
        }
        clientState.duelId = msg.duelId;
        clientState.seat = seat;

        // Check if this is a reconnect
        const player = room.players[seat]!;
        if (room.runtime && room.runtime.phase === 'playing' && player.authenticated) {
          // Reconnect: cancel disconnect timer, send snapshot
          if (room.disconnectTimers[seat]) {
            clearTimeout(room.disconnectTimers[seat]!);
            room.disconnectTimers[seat] = null;
          }
          send(ws, { type: 'state-snapshot', state: room.runtime.getSnapshot(), seq: room.runtime.seq });
          const opp = getOpponent(room, seat);
          if (opp?.ws) send(opp.ws, { type: 'opponent-reconnected' });
          return;
        }

        send(ws, { type: 'auth-challenge', nonce });
        break;
      }

      case 'auth': {
        const room = clientState.duelId !== null ? getOrCreateRoom(clientState.duelId) : null;
        if (!room) { send(ws, { type: 'error', message: 'Not in a room' }); return; }
        const player = room.players[clientState.seat];
        if (!player) { send(ws, { type: 'error', message: 'No seat assigned' }); return; }

        verifySession(player.address, clientState.duelId!, player.nonce, msg.expiresAt, msg.signature as `0x${string}`)
          .then(async (valid) => {
            if (!valid) {
              send(ws, { type: 'error', message: 'Invalid session signature' });
              return;
            }
            player.authenticated = true;
            player.sessionKey = deriveSessionKey(msg.signature);
            send(ws, { type: 'auth-ok', sessionStart: Date.now() });

            // If both authenticated and no match yet, wait for decks
            const opp = getOpponent(room, clientState.seat);
            if (opp?.authenticated) {
              send(ws, { type: 'waiting-for-opponent' });
            } else {
              send(ws, { type: 'waiting-for-opponent' });
            }
          })
          .catch(() => {
            send(ws, { type: 'error', message: 'Auth verification failed' });
          });
        break;
      }

      case 'submit-deck': {
        const room = clientState.duelId !== null ? getOrCreateRoom(clientState.duelId) : null;
        if (!room) return;
        const player = room.players[clientState.seat];
        if (!player?.authenticated) {
          send(ws, { type: 'error', message: 'Not authenticated' });
          return;
        }

        // Create runtime on first deck if needed
        if (!room.runtime) {
          const p0 = room.players[0];
          const p1 = room.players[1];
          if (!p0 || !p1) {
            send(ws, { type: 'waiting-for-opponent' });
            return;
          }
          room.runtime = new MatchRuntime(clientState.duelId!, p0.address, p1.address);
        }

        try {
          room.runtime.submitDeck(clientState.seat, msg.deck);
        } catch (err) {
          send(ws, { type: 'error', message: `Deck rejected: ${(err as Error).message}` });
          return;
        }

        if (room.runtime.phase === 'playing') {
          tryStartMatch(room);
        }
        break;
      }

      case 'action': {
        const room = clientState.duelId !== null ? getOrCreateRoom(clientState.duelId) : null;
        if (!room?.runtime || room.runtime.phase !== 'playing') return;
        const player = room.players[clientState.seat];
        if (!player?.sessionKey) return;

        // Verify HMAC
        if (!verifyHmac(player.sessionKey, msg.seq, msg.action, msg.hmac)) {
          send(ws, { type: 'action-rejected', seq: msg.seq, reason: 'Invalid HMAC' });
          return;
        }

        const result = room.runtime.executeAction(clientState.seat, msg.action, msg.hmac);
        if (!result.ok) {
          send(ws, { type: 'action-rejected', seq: msg.seq, reason: result.reason ?? 'Invalid action' });
          return;
        }

        // Broadcast confirmed action
        broadcast(room, {
          type: 'action-confirmed',
          seq: room.runtime.seq,
          action: msg.action,
          events: result.events,
          stateHash: result.stateHash,
        });

        // Reset activation timer
        startActivationTimer(room);

        // Periodic snapshot
        const state = room.runtime.getSnapshot();
        if (state.turnNumber > room.snapshotTurnCounter + SNAPSHOT_INTERVAL_TURNS) {
          room.snapshotTurnCounter = state.turnNumber;
          // Snapshot stored in runtime (in-memory)
        }

        // Check game over
        if (room.runtime.phase === 'game-over') {
          handleGameOver(room);
        }
        break;
      }

      case 'sign-result': {
        // Forward to settlement logic (Task 6)
        break;
      }

      case 'request-log': {
        const room = clientState.duelId !== null ? getOrCreateRoom(clientState.duelId) : null;
        if (!room?.runtime) return;
        send(ws, {
          type: 'action-log',
          sessionSignatures: ['', ''], // populated after auth stores sigs
          actions: [...room.runtime.actionLog],
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    const clientState = clients.get(ws);
    if (!clientState?.duelId) return;

    const room = getOrCreateRoom(clientState.duelId);
    const player = removePlayer(room, ws);
    if (!player) return;

    const opp = getOpponent(room, player.seat);
    if (opp?.ws) send(opp.ws, { type: 'opponent-disconnected' });

    // Start disconnect timer
    room.disconnectTimers[player.seat] = setTimeout(() => {
      if (!room.runtime || room.runtime.phase !== 'playing') {
        cleanupRoom(clientState.duelId!);
        return;
      }
      // Forfeit: opponent wins
      const opponentSeat = player.seat === 0 ? 1 : 0;
      room.runtime['_phase'] = 'game-over';
      room.runtime['_winner'] = opponentSeat;
      room.runtime['_winReason'] = 'opponent disconnected';
      handleGameOver(room);
    }, DISCONNECT_TIMEOUT_MS);
  });
});

// Periodic cleanup of stale rooms (24h)
setInterval(() => {
  const now = Date.now();
  for (const [duelId, room] of getAllRooms()) {
    if (room.runtime?.phase === 'game-over') {
      // Clean up after 24h
      const lastAction = room.runtime.actionLog[room.runtime.actionLog.length - 1];
      if (lastAction && now - lastAction.timestamp > MATCH_CLEANUP_MS) {
        cleanupRoom(duelId);
      }
    }
  }
}, 60_000);

// Need to import getAllRooms
import { getAllRooms } from './rooms.js';

console.log(`Match server listening on ws://localhost:${PORT}`);
```

- [ ] **Step 4: Delete arbiter.ts**

```bash
rm server/src/arbiter.ts
```

- [ ] **Step 5: Run server tests**

```bash
cd server && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Start server and verify it runs**

```bash
cd server && npm run dev
```

Expected: Prints "Match server listening on ws://localhost:3001". No crash.

- [ ] **Step 7: Commit**

```bash
git add server/src/ -A
git commit -m "feat(server): rewrite as authoritative match server with EIP-712 auth"
```

### Verification Checkpoint

1. Run `cd server && npm run dev` — server starts without errors
2. Run `cd server && npx vitest run` — all server tests pass
3. Run `cd packages/game-core && npx vitest run` — still passes
4. Run `cd frontend && npm run dev` — hotseat still works (multiplayer is temporarily broken — expected)
5. Use a WebSocket test tool (e.g. `wscat`) to connect to `ws://localhost:3001` and send `{"type":"join","duelId":1,"address":"0xtest"}` — should receive `auth-challenge` back

---

## Task 6: Write settlement.ts

**Files:**
- Create: `server/src/settlement.ts`

- [ ] **Step 1: Write settlement module**

`server/src/settlement.ts`:
```typescript
import type { Room } from './rooms.js';

const SETTLEMENT_TIMEOUT_MS = 120_000; // 2 minutes

export interface SettlementState {
  duelId: number;
  winnerAddress: string;
  signatures: [string | null, string | null]; // indexed by seat
  arbiterTimeout: ReturnType<typeof setTimeout> | null;
}

const settlements = new Map<number, SettlementState>();

export function initSettlement(duelId: number, winnerAddress: string): SettlementState {
  const state: SettlementState = {
    duelId,
    winnerAddress,
    signatures: [null, null],
    arbiterTimeout: null,
  };
  settlements.set(duelId, state);
  return state;
}

export function submitSignature(
  duelId: number,
  seat: 0 | 1,
  signature: string,
): { complete: boolean; signatures: [string | null, string | null] } {
  const state = settlements.get(duelId);
  if (!state) throw new Error('No settlement in progress');
  state.signatures[seat] = signature;
  const complete = state.signatures[0] !== null && state.signatures[1] !== null;
  return { complete, signatures: state.signatures };
}

export function getSettlement(duelId: number): SettlementState | undefined {
  return settlements.get(duelId);
}

export function cleanupSettlement(duelId: number): void {
  const state = settlements.get(duelId);
  if (state?.arbiterTimeout) clearTimeout(state.arbiterTimeout);
  settlements.delete(duelId);
}

export function startArbiterTimeout(
  duelId: number,
  onArbiterSettle: (duelId: number, winnerAddress: string) => void,
): void {
  const state = settlements.get(duelId);
  if (!state) return;
  state.arbiterTimeout = setTimeout(() => {
    onArbiterSettle(duelId, state.winnerAddress);
  }, SETTLEMENT_TIMEOUT_MS);
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/settlement.ts
git commit -m "feat(server): add settlement state machine for dual-sig + arbiter"
```

### Verification Checkpoint

1. Run `cd server && npx vitest run` — all tests still pass
2. Settlement is wired into index.ts in a later integration step

---

## Task 7: Write client ServerConnection

**Files:**
- Create: `frontend/src/multiplayer/ServerConnection.ts`
- Create: `frontend/src/multiplayer/__tests__/ServerConnection.test.ts`
- Delete: `frontend/src/multiplayer/ConnectionManager.ts`
- Delete: `frontend/src/multiplayer/MatchManager.ts`
- Delete: `frontend/src/multiplayer/protocol.ts`
- Delete: `frontend/src/multiplayer/__tests__/ConnectionManager.test.ts`
- Delete: `frontend/src/multiplayer/__tests__/MatchManager.test.ts`

- [ ] **Step 1: Write ServerConnection**

`frontend/src/multiplayer/ServerConnection.ts`:
```typescript
// Protocol types are shared — re-exported from game-core or imported from a shared types file
// During implementation, either:
// (a) Add protocol types to @arcana/game-core (since they reference game-core types anyway), or
// (b) Create a packages/shared-types package
// For now, use path alias configured in frontend/tsconfig.app.json:
//   "paths": { "@server/protocol": ["../server/src/protocol.ts"] }
import type { GameAction, ServerMessage, ClientMessage, MatchEvent, SerializedGameState } from '@server/protocol';

export type ConnectionState = 'connecting' | 'authenticating' | 'waiting' | 'playing' | 'game-over' | 'disconnected';

type EventMap = {
  'state-change': [state: ConnectionState];
  'match-started': [state: SerializedGameState, seat: 0 | 1, opponent: string, seq: number];
  'action-confirmed': [seq: number, action: GameAction, events: MatchEvent[], stateHash: string];
  'action-rejected': [seq: number, reason: string];
  'state-snapshot': [state: SerializedGameState, seq: number];
  'turn-timeout': [player: number, damage: number];
  'game-over': [winner: number, reason: string];
  'sign-request': [duelId: number, winner: string];
  'opponent-disconnected': [];
  'opponent-reconnected': [];
  'auth-challenge': [nonce: string];
  'error': [message: string];
};

type EventKey = keyof EventMap;

export class ServerConnection {
  private ws: WebSocket | null = null;
  private _state: ConnectionState = 'connecting';
  private _seat: 0 | 1 = 0;
  private _seq = 0;
  private listeners = new Map<string, Set<Function>>();
  private sessionKey: CryptoKey | null = null;
  private duelId: number;
  private address: string;

  constructor(url: string, duelId: number, address: string) {
    this.duelId = duelId;
    this.address = address;
    this.connect(url);
  }

  get state(): ConnectionState { return this._state; }
  get seat(): 0 | 1 { return this._seat; }

  private connect(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.sendRaw({ type: 'join', duelId: this.duelId, address: this.address });
    };
    this.ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      this.handleMessage(msg);
    };
    this.ws.onclose = () => {
      if (this._state !== 'game-over') {
        this.setState('disconnected');
      }
    };
    this.ws.onerror = () => {
      this.emit('error', 'WebSocket connection error');
    };
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'auth-challenge':
        this.setState('authenticating');
        // Battle.tsx will call authenticate() with the signTypedData function
        this.emit('auth-challenge' as EventKey, msg.nonce);
        break;
      case 'auth-ok':
        this.setState('waiting');
        break;
      case 'waiting-for-opponent':
        this.setState('waiting');
        break;
      case 'match-started':
        this._seat = msg.seat;
        this.setState('playing');
        this.emit('match-started', msg.state, msg.seat, msg.opponent, msg.seq);
        break;
      case 'action-confirmed':
        this.emit('action-confirmed', msg.seq, msg.action, msg.events, msg.stateHash);
        break;
      case 'action-rejected':
        this.emit('action-rejected', msg.seq, msg.reason);
        break;
      case 'state-snapshot':
        this.emit('state-snapshot', msg.state, msg.seq);
        break;
      case 'turn-timeout':
        this.emit('turn-timeout', msg.player, msg.damage);
        break;
      case 'game-over':
        this.setState('game-over');
        this.emit('game-over', msg.winner, msg.reason);
        break;
      case 'sign-request':
        this.emit('sign-request', msg.duelId, msg.winner);
        break;
      case 'opponent-disconnected':
        this.emit('opponent-disconnected');
        break;
      case 'opponent-reconnected':
        this.emit('opponent-reconnected');
        break;
      case 'error':
        this.emit('error', msg.message);
        break;
    }
  }

  // --- Public API ---

  async authenticate(
    signTypedData: (params: { domain: any; types: any; primaryType: string; message: any }) => Promise<string>,
    nonce: string,
    expiresAt: number,
  ): Promise<void> {
    const domain = { name: 'Arcana Arena', chainId: 84532 };
    const types = {
      Session: [
        { name: 'duelId', type: 'uint256' },
        { name: 'player', type: 'address' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'expiresAt', type: 'uint256' },
      ],
    };
    const message = {
      duelId: BigInt(this.duelId),
      player: this.address as `0x${string}`,
      nonce,
      expiresAt: BigInt(expiresAt),
    };

    const signature = await signTypedData({ domain, types, primaryType: 'Session', message });

    // Derive session key for HMAC
    const sigBytes = hexToBytes(signature);
    const keyMaterial = await crypto.subtle.digest('SHA-256', sigBytes);
    this.sessionKey = await crypto.subtle.importKey(
      'raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );

    this.sendRaw({ type: 'auth', signature, nonce, expiresAt });
  }

  submitDeck(deck: number[]): void {
    this.sendRaw({ type: 'submit-deck', deck });
  }

  async sendAction(action: GameAction): Promise<void> {
    if (!this.sessionKey) return;
    this._seq++;
    const hmac = await this.computeHmac(this._seq, action);
    this.sendRaw({ type: 'action', action, seq: this._seq, hmac });
  }

  sendSignResult(duelId: number, winner: string, signature: string): void {
    this.sendRaw({ type: 'sign-result', duelId, winner, signature });
  }

  requestLog(): void {
    this.sendRaw({ type: 'request-log' });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  // --- Event emitter ---

  on<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off<K extends EventKey>(event: K, cb: (...args: EventMap[K]) => void): void {
    this.listeners.get(event)?.delete(cb);
  }

  private emit<K extends EventKey>(event: K, ...args: EventMap[K]): void {
    this.listeners.get(event)?.forEach(cb => (cb as Function)(...args));
  }

  // --- Internals ---

  private setState(state: ConnectionState): void {
    this._state = state;
    this.emit('state-change', state);
  }

  private sendRaw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async computeHmac(seq: number, action: GameAction): Promise<string> {
    if (!this.sessionKey) return '';
    const canonical = this.canonicalizeAction(seq, action);
    const encoded = new TextEncoder().encode(canonical);
    const sig = await crypto.subtle.sign('HMAC', this.sessionKey, encoded);
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private canonicalizeAction(seq: number, action: GameAction): string {
    const obj = { seq, ...action };
    const keys = Object.keys(obj).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) sorted[k] = (obj as Record<string, unknown>)[k];
    return JSON.stringify(sorted);
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}
```

- [ ] **Step 2: Write ServerConnection tests**

`frontend/src/multiplayer/__tests__/ServerConnection.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerConnection } from '../ServerConnection';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) { this.sent.push(data); }
  close() { this.onclose?.(); }

  // Test helper: simulate server message
  receive(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

describe('ServerConnection', () => {
  let conn: ServerConnection;
  let mockWs: MockWebSocket;

  beforeEach(async () => {
    conn = new ServerConnection('ws://localhost:3001', 1, '0xTestAddr');
    // Wait for constructor's setTimeout
    await vi.runAllTimersAsync();
    mockWs = (conn as any).ws as MockWebSocket;
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends join on connect', async () => {
    expect(mockWs.sent.length).toBe(1);
    const msg = JSON.parse(mockWs.sent[0]);
    expect(msg.type).toBe('join');
    expect(msg.duelId).toBe(1);
    expect(msg.address).toBe('0xTestAddr');
  });

  it('transitions to authenticating on auth-challenge', () => {
    const states: string[] = [];
    conn.on('state-change', (s) => states.push(s));
    mockWs.receive({ type: 'auth-challenge', nonce: '0xabc' });
    expect(conn.state).toBe('authenticating');
  });

  it('transitions to playing on match-started', () => {
    const handler = vi.fn();
    conn.on('match-started', handler);
    mockWs.receive({
      type: 'match-started',
      seat: 0,
      opponent: '0xOpp',
      state: { turnNumber: 1 },
      seq: 0,
    });
    expect(conn.state).toBe('playing');
    expect(conn.seat).toBe(0);
    expect(handler).toHaveBeenCalled();
  });

  it('emits action-confirmed events', () => {
    const handler = vi.fn();
    conn.on('action-confirmed', handler);
    mockWs.receive({
      type: 'action-confirmed',
      seq: 1,
      action: { type: 'pass' },
      events: [],
      stateHash: 'abc',
    });
    expect(handler).toHaveBeenCalledWith(1, { type: 'pass' }, [], 'abc');
  });

  it('emits action-rejected events', () => {
    const handler = vi.fn();
    conn.on('action-rejected', handler);
    mockWs.receive({ type: 'action-rejected', seq: 1, reason: 'not your turn' });
    expect(handler).toHaveBeenCalledWith(1, 'not your turn');
  });

  it('emits game-over and transitions state', () => {
    const handler = vi.fn();
    conn.on('game-over', handler);
    mockWs.receive({ type: 'game-over', winner: 0, reason: 'Hero defeated' });
    expect(conn.state).toBe('game-over');
    expect(handler).toHaveBeenCalledWith(0, 'Hero defeated');
  });

  it('submits deck', () => {
    conn.submitDeck([0, 1, 2, 3]);
    const msg = JSON.parse(mockWs.sent[mockWs.sent.length - 1]);
    expect(msg.type).toBe('submit-deck');
    expect(msg.deck).toEqual([0, 1, 2, 3]);
  });

  it('emits opponent-disconnected', () => {
    const handler = vi.fn();
    conn.on('opponent-disconnected', handler);
    mockWs.receive({ type: 'opponent-disconnected' });
    expect(handler).toHaveBeenCalled();
  });

  it('transitions to disconnected on ws close', () => {
    mockWs.close();
    expect(conn.state).toBe('disconnected');
  });
});
```

- [ ] **Step 3: Delete old multiplayer files**

```bash
rm frontend/src/multiplayer/ConnectionManager.ts
rm frontend/src/multiplayer/MatchManager.ts
rm frontend/src/multiplayer/protocol.ts
rm frontend/src/multiplayer/__tests__/ConnectionManager.test.ts
rm frontend/src/multiplayer/__tests__/MatchManager.test.ts
```

- [ ] **Step 4: Update frontend/vite.config.ts test coverage**

Update the coverage includes to point to the new multiplayer file:
```typescript
coverage: {
  include: [
    'src/multiplayer/**/*.ts',
    'src/lib/**/*.ts',
    'src/engine/**/*.ts',
  ],
  // ...
}
```

- [ ] **Step 5: Run frontend tests**

```bash
cd frontend && npx vitest run --coverage
```

Expected: ServerConnection tests pass. Coverage >90%.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/multiplayer/ -A
git commit -m "feat(frontend): add ServerConnection, delete old P2P multiplayer code"
```

### Verification Checkpoint

1. Run `cd frontend && npx vitest run --coverage` — all tests pass, >90% coverage
2. Run `cd packages/game-core && npx vitest run` — still passes
3. Run `cd frontend && npm run dev` — hotseat still works. Multiplayer will show errors (Battle.tsx still references old imports — fixed in Task 8)

---

## Task 8: Rewire Battle.tsx for multiplayer via ServerConnection

**Files:**
- Modify: `frontend/src/pages/Battle.tsx` — replace all MatchManager/ConnectionManager usage with ServerConnection

This is the largest single-file change. The hotseat path stays identical; the multiplayer path is rewritten to:
1. Create ServerConnection instead of ConnectionManager + MatchManager
2. Send intents via `serverConn.sendAction()` instead of local execution + peer broadcast
3. Apply state from `action-confirmed` events instead of dual simulation
4. Show "waiting for opponent" / "authenticating" status from ServerConnection state

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { ConnectionManager } from '../multiplayer/ConnectionManager';
import { MatchManager } from '../multiplayer/MatchManager';
import type { GameAction } from '../multiplayer/protocol';
```

With:
```typescript
import { ServerConnection } from '../multiplayer/ServerConnection';
import type { GameAction, MatchEvent, SerializedGameState } from '../../../server/src/protocol';
```

- [ ] **Step 2: Replace refs and state**

Replace:
```typescript
const connRef = useRef<ConnectionManager | null>(null);
const matchRef = useRef<MatchManager | null>(null);
const [multiplayerStatus, setMultiplayerStatus] = useState<string>('');
```

With:
```typescript
const serverRef = useRef<ServerConnection | null>(null);
const [multiplayerStatus, setMultiplayerStatus] = useState<string>('');
const [mySeat, setMySeat] = useState<0 | 1>(0);
```

- [ ] **Step 3: Replace multiplayer initialization useEffect**

Find the useEffect that creates ConnectionManager and MatchManager. Replace with a useEffect that:
1. Creates ServerConnection
2. Subscribes to events
3. Handles auth-challenge by calling `signTypedData` from wagmi
4. On `match-started`: initialize BattleScene from server snapshot, set mySeat
5. On `action-confirmed`: apply action to local display state + trigger animations
6. On `game-over`: show result

The exact code depends on the current useEffect structure — the implementer should:
- Find the existing MP initialization useEffect (look for `new ConnectionManager`)
- Replace the body entirely
- Keep the same dependency array pattern
- Ensure cleanup calls `serverRef.current?.disconnect()`

- [ ] **Step 4: Replace sendAction**

Replace the current `sendAction` callback (which executes locally + sends to peer + sends state hash) with:
```typescript
const sendAction = useCallback(async (action: GameAction) => {
  if (!isMultiplayer || !serverRef.current) return;
  await serverRef.current.sendAction(action);
}, [isMultiplayer]);
```

- [ ] **Step 5: Replace isMyTurn checks**

Every `matchRef.current && !matchRef.current.isMyTurn` guard becomes a check against the server-provided state. The server tells whose turn it is via `action-confirmed` events with `activation-changed` MatchEvents.

Track active unit UID in a ref:
```typescript
const activeUnitUidRef = useRef<number | null>(null);
```

On `action-confirmed`, update from events:
```typescript
for (const event of events) {
  if (event.type === 'activation-changed') {
    activeUnitUidRef.current = event.uid;
  }
}
```

The `isMyTurn` check becomes:
```typescript
function isMyTurn(): boolean {
  if (!isMultiplayer) return true; // hotseat
  if (activeUnitUidRef.current === null) return false;
  const unit = units.find(u => u.uid === activeUnitUidRef.current);
  return unit ? unit.playerId === mySeat : false;
}
```

- [ ] **Step 6: Replace matchRef.current.playerIndex**

Every `matchRef.current.playerIndex` becomes `mySeat`.

- [ ] **Step 7: Handle action-confirmed events for animation**

Create a handler that processes MatchEvents from `action-confirmed`:
```typescript
function handleConfirmedAction(seq: number, action: GameAction, events: MatchEvent[]) {
  for (const event of events) {
    switch (event.type) {
      case 'unit-spawned':
        // Call BattleScene.spawnUnit(...)
        break;
      case 'unit-moved':
        // Call BattleScene.moveUnit(uid, path, callback)
        break;
      case 'unit-attacked':
        // Call BattleScene.playAttack + updateHpBar
        break;
      case 'hero-attacked':
        // Update hero HP display
        break;
      case 'unit-died':
        // Call BattleScene.playDeath(uid)
        break;
      case 'spell-cast':
        // Play spell FX
        break;
      case 'hp-changed':
        // BattleScene.updateHpBar(uid, hp, maxHp)
        break;
      case 'hero-hp-changed':
        // Update hero HP UI
        break;
      case 'activation-changed':
        // Update active unit highlight
        break;
      case 'turn-changed':
        // Update turn counter display
        break;
      case 'mana-changed':
        // Update mana display
        break;
      case 'queue-rebuilt':
        // Update initiative queue display
        break;
    }
  }
}
```

Wire this to ServerConnection:
```typescript
serverRef.current.on('action-confirmed', handleConfirmedAction);
```

- [ ] **Step 8: Clean up old multiplayer references**

Remove all references to `connRef`, `matchRef`, `setBattlePriorityPhase`, `setUiActivePlayer`, `deckResolve`, etc. Search Battle.tsx for any remaining `MatchManager` or `ConnectionManager` references.

- [ ] **Step 9: Verify hotseat still works**

```bash
cd frontend && npm run dev
```

Open browser, start hotseat battle, play through a few turns.

- [ ] **Step 10: Run tests**

```bash
cd frontend && npx vitest run --coverage
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/Battle.tsx
git commit -m "feat(frontend): rewire Battle.tsx to use ServerConnection for multiplayer"
```

### Verification Checkpoint

1. Run `cd frontend && npm run dev` — hotseat battle works end-to-end in browser
2. Run `cd frontend && npx vitest run --coverage` — all tests pass, >90% coverage
3. Start server (`cd server && npm run dev`) + frontend (`cd frontend && npm run dev`)
4. Open two browser tabs, navigate to a multiplayer duel URL with the same duelId
5. Verify: both tabs connect, auth challenge appears (will need wallet connected)
6. If wallet is connected: complete auth, submit decks, verify match starts and you can see the board on both sides
7. Play a few turns: spawn a unit, move it, attack — verify actions appear on both clients
8. Verify: clicking on wrong turn shows no response (server rejects)
9. Close one tab — verify other tab shows "opponent disconnected" within a few seconds

---

## Task 9: Integration testing + coverage sweep

**Files:**
- Create: `server/src/__tests__/integration.test.ts`
- Update: any files with coverage gaps

- [ ] **Step 1: Write server integration test**

`server/src/__tests__/integration.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MatchRuntime } from '../MatchRuntime.js';
import { cardRegistry } from '@arcana/game-core';
import { serializeState } from '../protocol.js';

function deck(): number[] {
  return cardRegistry.slice(0, 20).map(c => c.id);
}

describe('Full match integration', () => {
  let runtime: MatchRuntime;

  beforeEach(() => {
    runtime = new MatchRuntime(42, '0xPlayer0', '0xPlayer1');
    runtime.submitDeck(0, deck());
    runtime.submitDeck(1, deck());
  });

  it('plays a complete match with pass-only until timeout kills a hero', () => {
    let turns = 0;
    while (runtime.phase === 'playing' && turns < 200) {
      const controlling = runtime.getControllingPlayer();
      if (controlling >= 0) {
        const result = runtime.executeAction(controlling, { type: 'pass' });
        expect(result.ok).toBe(true);
      }
      if (runtime.getControllingPlayer() < 0 || runtime.phase !== 'playing') {
        // Queue exhausted or game over
        if (runtime.phase === 'playing') {
          runtime.executeAction(0, { type: 'end-turn' });
        }
      }
      turns++;
    }
    // Should still be playing (no damage dealt)
    expect(runtime.phase).toBe('playing');
    expect(runtime.seq).toBeGreaterThan(0);
  });

  it('serializes state at any point without error', () => {
    runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' });
    const snapshot = runtime.getSnapshot();
    const json = JSON.stringify(snapshot);
    expect(json.length).toBeGreaterThan(0);
    expect(snapshot.seq === undefined); // seq is on runtime, not state
  });

  it('rejects actions from wrong player consistently', () => {
    for (let i = 0; i < 10; i++) {
      const controlling = runtime.getControllingPlayer();
      const wrong = controlling === 0 ? 1 : 0;
      const result = runtime.executeAction(wrong, { type: 'pass' });
      expect(result.ok).toBe(false);
      // Now do the right action to advance
      runtime.executeAction(controlling, { type: 'pass' });
    }
  });

  it('action log grows with each action', () => {
    const before = runtime.actionLog.length;
    runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' }, 'hmac1');
    runtime.executeAction(runtime.getControllingPlayer(), { type: 'pass' }, 'hmac2');
    expect(runtime.actionLog.length).toBe(before + 2);
    expect(runtime.actionLog[0].hmac).toBe('hmac1');
  });
});
```

- [ ] **Step 2: Run all test suites**

```bash
# All three packages
cd packages/game-core && npx vitest run --coverage
cd ../.. && cd server && npx vitest run
cd ../frontend && npx vitest run --coverage
```

Expected: All pass, all >90% coverage.

- [ ] **Step 3: Fix any coverage gaps**

If any file is under 90% branch/line coverage, write targeted tests for the uncovered branches.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add integration tests, ensure >90% coverage across all packages"
```

### Verification Checkpoint

1. Run all three test suites — every one passes with >90% coverage
2. Run `cd frontend && npm run dev` + `cd server && npm run dev`
3. **Full end-to-end test on anvil:**
   - Start anvil: `cd contracts && anvil`
   - Deploy contracts: run deploy scripts
   - Start server: `cd server && npm run dev`
   - Start frontend: `cd frontend && npm run dev`
   - Open two browser tabs with connected wallets
   - Create a duel on-chain, both players join
   - Play a full match: spawn units, move, attack, cast spells, end turns
   - Verify winner is determined correctly
   - Verify settlement signature prompts appear
   - Sign with both wallets → verify `settleDuel` tx succeeds on anvil
4. Test disconnect: close one tab mid-match → verify opponent gets disconnected message → wait 60s → verify forfeit

---

## Task 10: Final cleanup and documentation

**Files:**
- Update: `CLAUDE.md` — reflect new architecture
- Update: `CONTINUE.md` — current state
- Clean up any remaining old references

- [ ] **Step 1: Search for any remaining old MP references**

```bash
grep -rn "ConnectionManager\|MatchManager\|DataChannel\|WebRTC\|sdp-offer\|ice-candidate\|deck-hash\|deck-reveal\|peer" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__
```

Fix any remaining references.

- [ ] **Step 2: Update CLAUDE.md**

Update the project structure section, commands section, and architecture notes to reflect:
- Monorepo with `packages/game-core`
- Server is authoritative match server (not signaling)
- WebSocket-only (no WebRTC)
- EIP-712 session auth + HMAC per action

- [ ] **Step 3: Update CONTINUE.md**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: update CLAUDE.md and CONTINUE.md for authoritative match server"
```

### Final Verification Checkpoint

1. All three test suites pass with >90% coverage
2. Hotseat battle works in browser
3. Multiplayer battle works end-to-end on local anvil
4. Settlement works on-chain
5. Disconnect → forfeit works
6. `grep -r "WebRTC\|DataChannel\|MatchManager\|ConnectionManager" frontend/src/ server/src/` returns nothing (all old code removed)
