# Battle System Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing battle system work perfectly — proper animation state machine, smooth movement, click-to-attack auto-walk, auto-end turns, in-engine HP bars, and a cohesive Arcana HUD.

**Architecture:** Extract Battle.tsx (640 lines) into three layers: `AnimationController.ts` (per-unit animation state machine + texture caching), `BattleScene.ts` (engine sprite lifecycle, movement tweens, HP bars, highlights, damage numbers), and a slimmed `Battle.tsx` (React HUD with Arcana components + input→logic→scene bridge).

**Tech Stack:** TypeScript, React, custom WebGPU engine (AnimatedSprite, Graphics, Container, Ticker), Vitest, Arcana UI component library (ArcanaPanel, ArcanaButton, ArcanaBar)

**Spec:** `docs/superpowers/specs/2026-05-12-battle-polish-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/game/AnimationController.ts` | Create | Per-unit animation state machine: idle/run/attack/death transitions, texture loading+caching, direction picking, fade |
| `frontend/src/game/BattleScene.ts` | Create | Engine-side manager: grid rendering, unit sprite lifecycle (spawn/move/attack/death/remove), HP bars, highlights, damage numbers |
| `frontend/src/game/actions/attackUnit.ts` | Modify | Add `getAutoWalkHex()` + `getAutoWalkTargets()` for click-to-attack |
| `frontend/src/game/constants.ts` | Modify | Add `UNIT_MOVE_SPEED`, `AUTO_END_DELAY`, sizing constants |
| `frontend/src/pages/Battle.tsx` | Rewrite | Slim to React HUD (Arcana components) + input bridge to GameController + BattleScene |
| `frontend/src/components/CardPicker.tsx` | Modify | Use design tokens for disabled state transition |

---

## Task 1: Add Constants

**Files:**
- Modify: `frontend/src/game/constants.ts`

- [ ] **Step 1: Add new constants**

```typescript
// Add at end of frontend/src/game/constants.ts:

export const UNIT_MOVE_SPEED = 300; // pixels per second
export const AUTO_END_DELAY = 0.4; // seconds before auto-advancing after AP exhausted

// Sprite sizing — normalized heights relative to HEX_SIZE
export const UNIT_TARGET_HEIGHT = HEX_SIZE * 1.6;
export const BUILDING_1x1_TARGET_HEIGHT = HEX_SIZE * 2.0;
export const BUILDING_2x2_TARGET_HEIGHT = HEX_SIZE * 2.8;

// HP bar dimensions
export const HP_BAR_WIDTH = 36;
export const HP_BAR_HEIGHT = 4;
export const HP_BAR_Y_OFFSET = HEX_SIZE * 0.35;
```

- [ ] **Step 2: Verify project compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/constants.ts
git commit -m "feat(battle): add movement speed, sizing, and HP bar constants"
```

---

## Task 2: AnimationController

**Files:**
- Create: `frontend/src/game/AnimationController.ts`

This is the per-unit animation state machine. It owns one `AnimatedSprite` inside a `Container`, loads textures on demand, handles state transitions (idle→run→idle, idle→attack→idle, any→death→fade), and caches loaded textures.

- [ ] **Step 1: Create AnimationController**

```typescript
// frontend/src/game/AnimationController.ts

import { Container } from '../engine/nodes/Container';
import { AnimatedSprite } from '../engine/nodes/AnimatedSprite';
import { SpriteSheet } from '../engine/textures/SpriteSheet';
import type { Engine } from '../engine/Engine';
import type { Texture } from '../engine/textures/Texture';
import {
  unitSpriteConfigs,
  buildingSpriteConfigs,
  getAnimForState,
  getAttackAnim,
  type AnimState,
  type AnimDefinition,
  type UnitSpriteConfig,
} from './spriteConfig';
import { getCard, isBuilding } from './cardRegistry';
import { hex2px } from './hexUtils';
import { HEX_SIZE, UNIT_TARGET_HEIGHT, BUILDING_1x1_TARGET_HEIGHT, BUILDING_2x2_TARGET_HEIGHT } from './constants';

export type AttackDirection = 'top' | 'topright' | 'side' | 'bottomright' | 'bottom';

export function getAttackDirection(
  fromCol: number, fromRow: number,
  toCol: number, toRow: number,
): AttackDirection {
  const from = hex2px(fromCol, fromRow);
  const to = hex2px(toCol, toRow);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // atan2 gives angle in radians; dy is inverted (screen y goes down)
  const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  if (angle > 60) return 'top';
  if (angle > 30) return 'topright';
  if (angle > -30) return 'side';
  if (angle > -60) return 'bottomright';
  return 'bottom';
}

export class AnimationController {
  private engine: Engine;
  private cardId: number;
  private playerId: number;
  private container: Container;
  private sprite: AnimatedSprite | null = null;
  private currentState: AnimState | null = null;
  private textureCache: Map<string, Texture[]> = new Map();
  private unitConfig: UnitSpriteConfig | undefined;
  private isBuildingUnit: boolean;
  private baseScale: number = 1;
  private flipX: boolean;

  constructor(engine: Engine, cardId: number, playerId: number) {
    this.engine = engine;
    this.cardId = cardId;
    this.playerId = playerId;
    this.container = new Container();
    this.flipX = playerId === 1;

    const card = getCard(cardId);
    this.isBuildingUnit = isBuilding(card);
    this.unitConfig = unitSpriteConfigs[cardId];
  }

  getContainer(): Container {
    return this.container;
  }

  async playIdle(): Promise<void> {
    if (this.isBuildingUnit) {
      await this.loadBuildingSprite();
      return;
    }
    const cfg = this.unitConfig;
    if (!cfg) return;
    const state = cfg.defaultState ?? 'idle';
    await this.switchAnim(state, true);
  }

  async playRun(): Promise<void> {
    if (this.isBuildingUnit) return;
    const cfg = this.unitConfig;
    if (!cfg) return;
    const anim = getAnimForState(cfg, 'run');
    if (anim) {
      await this.switchAnim('run', true);
    }
    // If no run anim, stay on current state
  }

  async playAttack(direction: AttackDirection): Promise<void> {
    if (this.isBuildingUnit) return;
    const cfg = this.unitConfig;
    if (!cfg) return;
    const anim = getAttackAnim(cfg, direction);
    if (!anim) return;
    await this.switchAnim(anim.state, false);
    // Wait for animation to complete
    await this.waitForComplete();
    // Return to idle
    await this.playIdle();
  }

  async playDeath(): Promise<void> {
    if (this.isBuildingUnit) {
      // Buildings: just load destroyed sprite if available
      // For now, skip death anim — buildings will just fade
      return;
    }
    const cfg = this.unitConfig;
    if (!cfg) return;

    // Try death, then exploding
    const deathAnim = getAnimForState(cfg, 'death') ?? getAnimForState(cfg, 'exploding');
    if (deathAnim) {
      await this.switchAnim(deathAnim.state, false);
      await this.waitForComplete();
    }
  }

  async fadeTo(targetAlpha: number, durationSec: number): Promise<void> {
    const startAlpha = this.container.alpha;
    const delta = targetAlpha - startAlpha;
    if (Math.abs(delta) < 0.001) return;

    return new Promise<void>((resolve) => {
      let elapsed = 0;
      const tick = (dt: number) => {
        elapsed += dt;
        const t = Math.min(elapsed / durationSec, 1);
        this.container.alpha = startAlpha + delta * t;
        if (t >= 1) {
          this.engine.ticker.remove(tick);
          resolve();
        }
      };
      this.engine.ticker.add(tick);
    });
  }

  destroy(): void {
    if (this.sprite) {
      this.sprite.stop();
    }
    this.container.parent?.removeChild(this.container);
    this.textureCache.clear();
  }

  // ── Private ──────────────────────────────────────────

  private async loadBuildingSprite(): Promise<void> {
    if (this.sprite) return; // already loaded
    const cfg = buildingSpriteConfigs[this.cardId];
    if (!cfg) return;

    const tex = await this.engine.textures.load(`bld_${this.cardId}`, cfg.file);
    const spr = new AnimatedSprite([tex]);
    spr.anchor.set(0.5, 0.85);
    const card = getCard(this.cardId);
    const targetH = card.size >= 2 ? BUILDING_2x2_TARGET_HEIGHT : BUILDING_1x1_TARGET_HEIGHT;
    const s = targetH / Math.max(cfg.width, cfg.height);
    spr.scale.set(s, s);
    this.sprite = spr;
    this.container.addChild(spr);
  }

  private async switchAnim(state: AnimState, loop: boolean): Promise<void> {
    const cfg = this.unitConfig;
    if (!cfg) return;

    const anim = getAnimForState(cfg, state);
    if (!anim) return;

    // Load or retrieve cached frames
    const cacheKey = `${this.cardId}_${state}`;
    let frames = this.textureCache.get(cacheKey);

    if (!frames) {
      const texKey = `u${this.cardId}_${state}`;
      const tex = await this.engine.textures.load(texKey, `${cfg.basePath}/${anim.file}`);
      frames = anim.source === 'grid'
        ? SpriteSheet.fromGridRow(tex, anim.frameWidth, anim.frameHeight, anim.row! - 1, anim.frameCount)
        : SpriteSheet.fromStrip(tex, anim.frameWidth);
      this.textureCache.set(cacheKey, frames);
    }

    // Remove old sprite
    if (this.sprite) {
      this.sprite.stop();
      this.container.removeChild(this.sprite);
    }

    // Create new animated sprite
    const spr = new AnimatedSprite(frames);
    spr.anchor.set(0.5, 0.75);
    const s = UNIT_TARGET_HEIGHT / anim.frameHeight;
    this.baseScale = s;

    const shouldFlip = this.flipX && (anim.flipForLeft !== false);
    spr.scale.set(shouldFlip ? -s : s, s);

    spr.animationSpeed = 0.12;
    spr.loop = loop;
    spr.gotoAndPlay(0);

    this.sprite = spr;
    this.currentState = state;
    this.container.addChild(spr);
  }

  private waitForComplete(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.sprite || this.sprite.loop) {
        resolve();
        return;
      }
      this.sprite.onComplete = () => {
        if (this.sprite) this.sprite.onComplete = null;
        resolve();
      };
    });
  }
}
```

- [ ] **Step 2: Verify project compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `cd frontend && npx vitest run src/game/__tests__/`
Expected: 319 tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/AnimationController.ts
git commit -m "feat(battle): add AnimationController — per-unit animation state machine"
```

---

## Task 3: BattleScene

**Files:**
- Create: `frontend/src/game/BattleScene.ts`

Engine-side manager. Owns the scene graph layers, unit sprite lifecycle, highlights, HP bars, damage numbers, and movement tweens.

- [ ] **Step 1: Create BattleScene**

```typescript
// frontend/src/game/BattleScene.ts

import { Engine } from '../engine/Engine';
import { Container } from '../engine/nodes/Container';
import { Graphics } from '../engine/nodes/Graphics';
import { Text } from '../engine/nodes/Text';
import { AnimationController, getAttackDirection, type AttackDirection } from './AnimationController';
import { hex2px } from './hexUtils';
import { getCard, isBuilding } from './cardRegistry';
import type { UnitInstance, HexCoord } from './types';
import {
  GRID_COLS, GRID_ROWS, HEX_SIZE,
  P1_DEPLOY_COLS, P2_DEPLOY_COLS,
  UNIT_MOVE_SPEED,
  HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_Y_OFFSET,
} from './constants';

export interface AttackableTarget {
  unitUid: number;
  cells: HexCoord[];
  autoWalk: boolean; // true = reachable via auto-walk, false = directly attackable
}

interface UnitEntry {
  uid: number;
  anim: AnimationController;
  container: Container;
  hpBar: Graphics;
  label: Text;
  currentHp: number;
  maxHp: number;
}

export class BattleScene {
  private engine: Engine;
  private gridLayer: Container;
  private hlLayer: Container;
  private unitLayer: Container;
  private hlGfx: Graphics;
  private units: Map<number, UnitEntry> = new Map();

  constructor(engine: Engine) {
    this.engine = engine;

    this.gridLayer = new Container();
    this.gridLayer.zIndex = 0;
    this.hlLayer = new Container();
    this.hlLayer.zIndex = 5;
    this.unitLayer = new Container();
    this.unitLayer.zIndex = 10;

    engine.stage.addChild(this.gridLayer);
    engine.stage.addChild(this.hlLayer);
    engine.stage.addChild(this.unitLayer);

    this.hlGfx = new Graphics();
    this.hlLayer.addChild(this.hlGfx);
    this.hlGfx.visible = false;
  }

  // ── Grid ─────────────────────────────────────────────

  createGrid(): void {
    const grid = new Graphics();
    this.gridLayer.addChild(grid);
    const p1Set = new Set(P1_DEPLOY_COLS);
    const p2Set = new Set(P2_DEPLOY_COLS);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const p = hex2px(c, r);
        if (p1Set.has(c)) {
          grid.lineStyle(2, 0x3366cc);
          grid.beginFill(0x2244aa, 0.2);
        } else if (p2Set.has(c)) {
          grid.lineStyle(2, 0xcc3344);
          grid.beginFill(0xaa2244, 0.2);
        } else {
          grid.lineStyle(2, 0x3a5a3a);
          grid.beginFill(0x2a4a2a, 0.3);
        }
        grid.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
        grid.endFill();
      }
    }
  }

  // ── Units ────────────────────────────────────────────

  async spawnUnit(unit: UnitInstance): Promise<void> {
    const pos = hex2px(unit.col, unit.row);
    const anim = new AnimationController(this.engine, unit.cardId, unit.playerId);
    const container = anim.getContainer();
    container.position.set(pos.x, pos.y);

    // HP bar
    const hpBar = new Graphics();
    this.drawHpBar(hpBar, unit.currentHp, unit.maxHp);
    hpBar.position.set(0, HP_BAR_Y_OFFSET);
    container.addChild(hpBar);

    // Name label
    const card = getCard(unit.cardId);
    const lbl = new Text(card.name, {
      fontSize: 14,
      fill: unit.playerId === 0 ? 0x6699ff : 0xff6666,
    });
    lbl.position.set(-20, -HEX_SIZE * 0.9);
    container.addChild(lbl);

    this.unitLayer.addChild(container);
    await anim.playIdle();

    this.units.set(unit.uid, {
      uid: unit.uid,
      anim,
      container,
      hpBar,
      label: lbl,
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
    });
  }

  moveUnit(uid: number, path: HexCoord[], onDone: () => void): void {
    const entry = this.units.get(uid);
    if (!entry || path.length < 2) {
      onDone();
      return;
    }

    // Build pixel waypoints
    const waypoints = path.map(h => hex2px(h.col, h.row));

    // Compute cumulative distances
    const cumDist: number[] = [0];
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i - 1].x;
      const dy = waypoints[i].y - waypoints[i - 1].y;
      cumDist.push(cumDist[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    const totalDist = cumDist[cumDist.length - 1];

    // Switch to run animation
    entry.anim.playRun();

    let traveled = 0;
    const tick = (dt: number) => {
      traveled += UNIT_MOVE_SPEED * dt;
      if (traveled >= totalDist) {
        // Arrived
        const final = waypoints[waypoints.length - 1];
        entry.container.position.set(final.x, final.y);
        this.engine.ticker.remove(tick);
        entry.anim.playIdle();
        onDone();
        return;
      }

      // Find current segment
      let seg = 0;
      for (let i = 1; i < cumDist.length; i++) {
        if (cumDist[i] >= traveled) {
          seg = i - 1;
          break;
        }
      }
      const segStart = cumDist[seg];
      const segEnd = cumDist[seg + 1];
      const t = (traveled - segStart) / (segEnd - segStart);
      const x = waypoints[seg].x + (waypoints[seg + 1].x - waypoints[seg].x) * t;
      const y = waypoints[seg].y + (waypoints[seg + 1].y - waypoints[seg].y) * t;
      entry.container.position.set(x, y);
    };

    this.engine.ticker.add(tick);
  }

  async playAttack(uid: number, targetHex: HexCoord, onDone: () => void): Promise<void> {
    const entry = this.units.get(uid);
    if (!entry) {
      onDone();
      return;
    }

    // Determine direction from unit's current pixel position to target
    const unitPos = entry.container.position;
    const targetPos = hex2px(targetHex.col, targetHex.row);
    const dx = targetPos.x - unitPos.x;
    const dy = targetPos.y - unitPos.y;
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI);

    let direction: AttackDirection;
    if (angle > 60) direction = 'top';
    else if (angle > 30) direction = 'topright';
    else if (angle > -30) direction = 'side';
    else if (angle > -60) direction = 'bottomright';
    else direction = 'bottom';

    await entry.anim.playAttack(direction);
    onDone();
  }

  async playDeath(uid: number, onDone: () => void): Promise<void> {
    const entry = this.units.get(uid);
    if (!entry) {
      onDone();
      return;
    }

    await entry.anim.playDeath();
    await entry.anim.fadeTo(0, 0.5);
    this.removeUnit(uid);
    onDone();
  }

  removeUnit(uid: number): void {
    const entry = this.units.get(uid);
    if (!entry) return;
    entry.anim.destroy();
    this.units.delete(uid);
  }

  updateHpBar(uid: number, currentHp: number, maxHp: number): void {
    const entry = this.units.get(uid);
    if (!entry) return;
    entry.currentHp = currentHp;
    entry.maxHp = maxHp;
    this.drawHpBar(entry.hpBar, currentHp, maxHp);
  }

  // ── Highlights ───────────────────────────────────────

  clearHighlights(): void {
    this.hlGfx.clear();
    this.hlGfx.visible = false;
  }

  showDeployHighlights(validHexes: HexCoord[]): void {
    this.hlGfx.clear();
    for (const h of validHexes) {
      const p = hex2px(h.col, h.row);
      this.hlGfx.lineStyle(2, 0xf1c40f);
      this.hlGfx.beginFill(0xf1c40f, 0.15);
      this.hlGfx.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
      this.hlGfx.endFill();
    }
    this.hlGfx.visible = true;
  }

  showMoveHighlights(
    unitHex: HexCoord,
    reachable: HexCoord[],
    attackable: AttackableTarget[],
  ): void {
    this.hlGfx.clear();

    // Yellow on current unit hex
    const up = hex2px(unitHex.col, unitHex.row);
    this.hlGfx.lineStyle(3, 0xf1c40f);
    this.hlGfx.beginFill(0xf1c40f, 0.2);
    this.hlGfx.drawRegularPolygon(up.x, up.y, HEX_SIZE - 2, 6);
    this.hlGfx.endFill();

    // Green on reachable move hexes
    for (const h of reachable) {
      const p = hex2px(h.col, h.row);
      this.hlGfx.lineStyle(2, 0x2ecc71);
      this.hlGfx.beginFill(0x2ecc71, 0.15);
      this.hlGfx.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
      this.hlGfx.endFill();
    }

    // Attackable targets: red (direct) or orange (auto-walk)
    for (const target of attackable) {
      const color = target.autoWalk ? 0xe67e22 : 0xe74c3c;
      const alpha = target.autoWalk ? 0.2 : 0.2;
      for (const cell of target.cells) {
        const p = hex2px(cell.col, cell.row);
        this.hlGfx.lineStyle(2, color);
        this.hlGfx.beginFill(color, alpha);
        this.hlGfx.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
        this.hlGfx.endFill();
      }
    }

    this.hlGfx.visible = true;
  }

  // ── Damage Numbers ───────────────────────────────────

  showDamageNumber(hex: HexCoord, damage: number, isCrit: boolean): void {
    const pos = hex2px(hex.col, hex.row);
    const txt = new Text(`${isCrit ? 'CRIT ' : ''}${damage}`, {
      fontSize: isCrit ? 26 : 22,
      fill: isCrit ? 0xff4444 : 0xffffff,
    });
    txt.position.set(pos.x - 15, pos.y - HEX_SIZE * 1.2);
    this.unitLayer.addChild(txt);

    let t = 0;
    const fn = (dt: number) => {
      t += dt;
      txt.position.y -= 40 * dt;
      txt.alpha = Math.max(0, 1 - t);
      if (t > 1) {
        this.engine.ticker.remove(fn);
        this.unitLayer.removeChild(txt);
      }
    };
    this.engine.ticker.add(fn);
  }

  // ── Cleanup ──────────────────────────────────────────

  destroy(): void {
    for (const entry of this.units.values()) {
      entry.anim.destroy();
    }
    this.units.clear();
    this.engine.stage.removeChild(this.gridLayer);
    this.engine.stage.removeChild(this.hlLayer);
    this.engine.stage.removeChild(this.unitLayer);
  }

  // ── Private ──────────────────────────────────────────

  private drawHpBar(gfx: Graphics, currentHp: number, maxHp: number): void {
    gfx.clear();
    const ratio = maxHp > 0 ? currentHp / maxHp : 0;

    // Background
    gfx.beginFill(0x000000, 0.5);
    gfx.drawRect(-HP_BAR_WIDTH / 2, 0, HP_BAR_WIDTH, HP_BAR_HEIGHT);
    gfx.endFill();

    // Fill
    let color = 0x2ecc71; // green
    if (ratio <= 0.25) color = 0xe74c3c; // red
    else if (ratio <= 0.5) color = 0xf1c40f; // yellow

    const fillW = HP_BAR_WIDTH * Math.max(0, Math.min(1, ratio));
    if (fillW > 0) {
      gfx.beginFill(color, 0.9);
      gfx.drawRect(-HP_BAR_WIDTH / 2, 0, fillW, HP_BAR_HEIGHT);
      gfx.endFill();
    }
  }
}
```

- [ ] **Step 2: Verify project compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run existing tests**

Run: `cd frontend && npx vitest run src/game/__tests__/`
Expected: 319 tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/BattleScene.ts
git commit -m "feat(battle): add BattleScene — engine sprite lifecycle, HP bars, highlights, movement tweens"
```

---

## Task 4: Auto-Walk Attack Logic

**Files:**
- Modify: `frontend/src/game/actions/attackUnit.ts`

Add `getAutoWalkHex()` for click-to-attack — finds the best adjacent hex to walk to before melee attacking, using cursor position for directional control. Also add `getAutoWalkTargets()` to compute which enemies are reachable via auto-walk for highlight purposes.

- [ ] **Step 1: Write tests**

Create: `frontend/src/game/__tests__/autoWalkAttack.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createGameState } from '../GameState';
import { executeSpawn } from '../actions/spawnUnit';
import { getAutoWalkHex, getAutoWalkTargets } from '../actions/attackUnit';
import { hex2px } from '../hexUtils';

describe('getAutoWalkHex', () => {
  it('returns null when target is out of AP range', () => {
    const state = createGameState(42);
    // Spawn attacker at (0,0) with speed 3
    const attacker = executeSpawn(state, 0, 1, { col: 0, row: 0 }); // Militiaman, speed 3
    // Spawn target far away at (10,5)
    const target = executeSpawn(state, 1, 1, { col: 10, row: 5 });
    const cursor = hex2px(10, 5);
    const result = getAutoWalkHex(state, attacker.uid, target.uid, cursor);
    expect(result).toBeNull();
  });

  it('returns adjacent hex when target is within AP range', () => {
    const state = createGameState(42);
    // Spawn attacker at (1,0) with speed 3
    const attacker = executeSpawn(state, 0, 1, { col: 1, row: 0 });
    // Spawn target at (3,0) — distance 2, need 1 AP for move + 1 for attack = within speed 3
    const target = executeSpawn(state, 1, 1, { col: 3, row: 0 });
    const cursor = hex2px(3, 0);
    const result = getAutoWalkHex(state, attacker.uid, target.uid, cursor);
    expect(result).not.toBeNull();
    // Result should be adjacent to target (distance 1 from target)
    expect(result!.col).toBe(2);
    expect(result!.row).toBe(0);
  });

  it('returns null when already adjacent (no walk needed)', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 1, row: 0 });
    const target = executeSpawn(state, 1, 1, { col: 2, row: 0 });
    const cursor = hex2px(2, 0);
    const result = getAutoWalkHex(state, attacker.uid, target.uid, cursor);
    // Already adjacent — return null (no walk needed, just attack directly)
    expect(result).toBeNull();
  });

  it('picks hex closest to cursor for directional control', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 0, row: 5 });
    const target = executeSpawn(state, 1, 1, { col: 2, row: 5 });
    // Click above the target — should prefer approaching from above
    const cursorAbove = hex2px(2, 4);
    const resultAbove = getAutoWalkHex(state, attacker.uid, target.uid, cursorAbove);
    // Click below the target — should prefer approaching from below
    const cursorBelow = hex2px(2, 6);
    const resultBelow = getAutoWalkHex(state, attacker.uid, target.uid, cursorBelow);
    // The two results should be different hexes (different approach directions)
    if (resultAbove && resultBelow) {
      expect(resultAbove.row !== resultBelow.row || resultAbove.col !== resultBelow.col).toBe(true);
    }
  });
});

describe('getAutoWalkTargets', () => {
  it('returns empty when no enemies are reachable via auto-walk', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 0, row: 0 });
    const target = executeSpawn(state, 1, 1, { col: 10, row: 5 });
    const targets = getAutoWalkTargets(state, attacker.uid);
    expect(targets).toHaveLength(0);
  });

  it('returns enemies reachable within AP budget (move + 1 for attack)', () => {
    const state = createGameState(42);
    const attacker = executeSpawn(state, 0, 1, { col: 1, row: 0 }); // speed 3
    const target = executeSpawn(state, 1, 1, { col: 3, row: 0 }); // distance 2
    const targets = getAutoWalkTargets(state, attacker.uid);
    expect(targets.some(t => t.unitUid === target.uid)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/game/__tests__/autoWalkAttack.test.ts`
Expected: FAIL — `getAutoWalkHex` and `getAutoWalkTargets` not exported

- [ ] **Step 3: Implement getAutoWalkHex and getAutoWalkTargets**

Add to `frontend/src/game/actions/attackUnit.ts` after existing exports:

```typescript
import { findReachable } from '../pathfinding';
import { getOccupiedSet } from './moveUnit';
import { hex2px } from '../hexUtils';

/**
 * For melee auto-walk: find the best hex adjacent to the target that the
 * attacker can reach within (remainingAp - 1), picking the one closest
 * to the cursor position for directional control.
 *
 * Returns null if already adjacent (no walk needed) or no valid hex exists.
 */
export function getAutoWalkHex(
  state: GameState,
  attackerUid: number,
  targetUid: number,
  cursorWorldPos: { x: number; y: number },
): HexCoord | null {
  const attacker = state.units.find(u => u.uid === attackerUid);
  const target = state.units.find(u => u.uid === targetUid);
  if (!attacker || !target || !attacker.alive || !target.alive) return null;

  const card = getCard(attacker.cardId);
  if (isBuilding(card) || isRanged(card)) return null;

  // Already adjacent? No walk needed.
  const adjCells = getAdjacentCells(attacker);
  for (const cell of target.occupiedCells) {
    if (adjCells.has(`${cell.col},${cell.row}`)) return null;
  }

  // Budget for movement: need to reserve 1 AP for the attack
  const moveBudget = attacker.remainingAp - 1;
  if (moveBudget <= 0) return null;

  // Get all hexes reachable within moveBudget
  const occupied = getOccupiedSet(state);
  for (const cell of attacker.occupiedCells) {
    occupied.delete(coordKey(cell.col, cell.row));
  }
  const reachable = findReachable(attacker.col, attacker.row, moveBudget, occupied);
  const reachableSet = new Set(reachable.map(h => `${h.col},${h.row}`));

  // Find hexes adjacent to target that are in reachable set
  const targetAdj = new Set<string>();
  for (const tc of target.occupiedCells) {
    for (const n of hexNeighbors(tc.col, tc.row)) {
      targetAdj.add(`${n.col},${n.row}`);
    }
  }
  // Exclude hexes occupied by units (except attacker's own cells)
  const candidates: HexCoord[] = [];
  for (const key of targetAdj) {
    if (!reachableSet.has(key)) continue;
    if (occupied.has(key)) continue;
    const [c, r] = key.split(',').map(Number);
    candidates.push({ col: c, row: r });
  }

  if (candidates.length === 0) return null;

  // Pick candidate closest to cursor position
  let best = candidates[0];
  let bestDist = Infinity;
  for (const cand of candidates) {
    const p = hex2px(cand.col, cand.row);
    const dx = p.x - cursorWorldPos.x;
    const dy = p.y - cursorWorldPos.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = cand;
    }
  }

  return best;
}

/**
 * Returns all enemy units that can be reached via auto-walk + attack
 * by the given melee attacker. Used for orange highlights.
 * Excludes enemies already adjacent (those get red highlights via getAttackTargets).
 */
export function getAutoWalkTargets(
  state: GameState,
  attackerUid: number,
): { unitUid: number; cells: HexCoord[] }[] {
  const attacker = state.units.find(u => u.uid === attackerUid);
  if (!attacker || !attacker.alive) return [];

  const card = getCard(attacker.cardId);
  if (isBuilding(card) || isRanged(card)) return [];

  const moveBudget = attacker.remainingAp - 1;
  if (moveBudget <= 0) return [];

  // Build reachable set
  const occupied = getOccupiedSet(state);
  for (const cell of attacker.occupiedCells) {
    occupied.delete(coordKey(cell.col, cell.row));
  }
  const reachable = findReachable(attacker.col, attacker.row, moveBudget, occupied);
  const reachableSet = new Set(reachable.map(h => `${h.col},${h.row}`));

  // Already adjacent enemies (handled by getAttackTargets, skip here)
  const directTargets = getAttackTargets(state, attackerUid);
  const directUids = new Set(directTargets.map(t => t.unitUid));

  const results: { unitUid: number; cells: HexCoord[] }[] = [];

  for (const unit of state.units) {
    if (!unit.alive || unit.playerId === attacker.playerId) continue;
    if (directUids.has(unit.uid)) continue;

    // Check if any hex adjacent to this enemy is reachable
    let canReach = false;
    for (const tc of unit.occupiedCells) {
      for (const n of hexNeighbors(tc.col, tc.row)) {
        const key = `${n.col},${n.row}`;
        if (reachableSet.has(key) && !occupied.has(key)) {
          canReach = true;
          break;
        }
      }
      if (canReach) break;
    }

    if (canReach) {
      results.push({
        unitUid: unit.uid,
        cells: [...unit.occupiedCells],
      });
    }
  }

  return results;
}
```

You also need to add the missing imports at the top of `attackUnit.ts`. Add these to the existing import lines:

```typescript
// Add to existing imports at top of attackUnit.ts:
import { findReachable, coordKey } from '../pathfinding';
import { getOccupiedSet } from './moveUnit';
import { hex2px } from '../hexUtils';
import type { HexCoord } from '../types';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/game/__tests__/autoWalkAttack.test.ts`
Expected: PASS

- [ ] **Step 5: Run all game tests**

Run: `cd frontend && npx vitest run src/game/__tests__/`
Expected: all tests pass (319 + new tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/game/actions/attackUnit.ts frontend/src/game/__tests__/autoWalkAttack.test.ts
git commit -m "feat(battle): add auto-walk attack logic — getAutoWalkHex + getAutoWalkTargets"
```

---

## Task 5: Rewrite Battle.tsx — React HUD + Input Bridge

**Files:**
- Rewrite: `frontend/src/pages/Battle.tsx`
- Modify: `frontend/src/components/CardPicker.tsx`

This is the biggest task. Battle.tsx gets completely rewritten to:
1. Use `BattleScene` for all engine operations
2. Use Arcana UI components for HUD
3. Implement click-to-attack with auto-walk
4. Auto-end activation when AP exhausted

- [ ] **Step 1: Update CardPicker disabled state to use tokens**

In `frontend/src/components/CardPicker.tsx`, find the `wrapper` style object inside `CardThumb` (around line 87-98). Change the opacity and transition lines:

Replace:
```typescript
    opacity: disabled ? 0.35 : affordable ? 1 : 0.45,
```

With:
```typescript
    opacity: disabled ? 0.5 : affordable ? 1 : 0.45,
```

- [ ] **Step 2: Rewrite Battle.tsx**

Replace the entire contents of `frontend/src/pages/Battle.tsx` with:

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { Engine } from '../engine/Engine';
import { BattleScene, type AttackableTarget } from '../game/BattleScene';
import { hex2px, px2hex, isValidCell } from '../game/hexUtils';
import {
  GRID_COLS, GRID_ROWS, HEX_SIZE,
  P1_DEPLOY_COLS, P2_DEPLOY_COLS,
  HERO_HP, STARTING_MANA, AUTO_END_DELAY,
} from '../game/constants';
import { GameController } from '../game/GameController';
import { canSpawn, executeSpawn } from '../game/actions/spawnUnit';
import { getReachableHexes, canMove, executeMove } from '../game/actions/moveUnit';
import {
  getAttackTargets, canAttack, executeAttack,
  getAutoWalkHex, getAutoWalkTargets,
} from '../game/actions/attackUnit';
import { getCard, isBuilding, isMelee } from '../game/cardRegistry';
import { CardType } from '../game/types';
import type { UnitInstance, HexCoord } from '../game/types';
import { CardPicker } from '../components/CardPicker';
import { ArcanaPanel, ArcanaButton, ArcanaBar } from '../ui/components/index';

// ─── Turn phase ────────────────────────────────────────
type TurnPhase =
  | { type: 'priority'; player: number }
  | { type: 'initiative' };

// ─── UI mode ───────────────────────────────────────────
type UIMode =
  | { type: 'pick_card' }
  | { type: 'place_card'; cardId: number }
  | { type: 'unit_turn' }
  | { type: 'unit_acted' }
  | { type: 'animating' }; // locked during animations

// ─── Priority state ────────────────────────────────────
interface PriorityState {
  p0Used: boolean;
  p1Used: boolean;
  spawnedThisTurn: Set<number>;
}

export default function Battle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const ctrlRef = useRef<GameController | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);

  const [phase, setPhase] = useState<TurnPhase>({ type: 'priority', player: 0 });
  const [ui, setUI] = useState<UIMode>({ type: 'pick_card' });
  const [priority, setPriority] = useState<PriorityState>({ p0Used: false, p1Used: false, spawnedThisTurn: new Set() });
  const [mana, setMana] = useState([STARTING_MANA, STARTING_MANA]);
  const [turn, setTurn] = useState(1);
  const [queueInfo, setQueueInfo] = useState<{ labels: string[]; index: number }>({ labels: [], index: 0 });

  const phaseRef = useRef(phase);   phaseRef.current = phase;
  const uiRef = useRef(ui);         uiRef.current = ui;
  const prioRef = useRef(priority); prioRef.current = priority;

  // ─── Active player ───────────────────────────────────
  const getActivePlayer = useCallback((): number => {
    const p = phaseRef.current;
    if (p.type === 'priority') return p.player;
    const ctrl = ctrlRef.current;
    if (!ctrl) return 0;
    const cp = ctrl.getControllingPlayer();
    return cp >= 0 ? cp : 0;
  }, []);

  // ─── Sync React state ───────────────────────────────
  const syncUI = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    const s = ctrl.getState();
    setMana([s.players[0].mana, s.players[1].mana]);
    setTurn(s.turnNumber);
    setQueueInfo({
      labels: s.activationQueue.map(u => {
        const c = getCard(u.cardId);
        return `${u.playerId === 0 ? 'P1' : 'P2'} ${c.name}`;
      }),
      index: s.currentActivationIndex,
    });
  }, []);

  // ─── Show highlights for active unit ─────────────────
  const showActiveUnitHL = useCallback(() => {
    const ctrl = ctrlRef.current;
    const scene = sceneRef.current;
    if (!ctrl || !scene) return;
    const cu = ctrl.getCurrentUnit();
    if (!cu) { scene.clearHighlights(); return; }

    const reachable = getReachableHexes(ctrl.getState(), cu.uid);
    const directTargets = getAttackTargets(ctrl.getState(), cu.uid);
    const autoWalkTargets = getAutoWalkTargets(ctrl.getState(), cu.uid);

    const attackable: AttackableTarget[] = [];
    for (const t of directTargets) {
      const target = ctrl.getState().units.find(u => u.uid === t.unitUid);
      if (target) {
        attackable.push({
          unitUid: t.unitUid,
          cells: [...target.occupiedCells],
          autoWalk: false,
        });
      }
    }
    for (const t of autoWalkTargets) {
      attackable.push({
        unitUid: t.unitUid,
        cells: t.cells,
        autoWalk: true,
      });
    }

    scene.showMoveHighlights(
      { col: cu.col, row: cu.row },
      reachable,
      attackable,
    );
  }, []);

  // ─── Auto-end activation ────────────────────────────
  const scheduleAutoEnd = useCallback(() => {
    const ctrl = ctrlRef.current;
    const engine = engineRef.current;
    if (!ctrl || !engine) return;
    const cu = ctrl.getCurrentUnit();
    if (!cu || cu.remainingAp > 0) return;

    let elapsed = 0;
    const tick = (dt: number) => {
      elapsed += dt;
      if (elapsed >= AUTO_END_DELAY) {
        engine.ticker.remove(tick);
        ctrl.passActivation();
        sceneRef.current?.clearHighlights();
        advanceTurn();
      }
    };
    engine.ticker.add(tick);
  }, []);

  // ─── Advance turn ───────────────────────────────────
  const advanceTurn = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    const state = ctrl.getState();
    const prio = prioRef.current;

    const p0Units = state.units.filter(u => u.alive && u.playerId === 0).length;
    const p1Units = state.units.filter(u => u.alive && u.playerId === 1).length;

    const p0Needs = p0Units === 0 && !prio.p0Used;
    const p1Needs = p1Units === 0 && !prio.p1Used;

    if (p0Needs && p1Needs) {
      const first = state.rng.rollPercent(50) ? 0 : 1;
      setPhase({ type: 'priority', player: first });
      setUI({ type: 'pick_card' });
      sceneRef.current?.clearHighlights();
      syncUI();
      return;
    }
    if (p0Needs) {
      setPhase({ type: 'priority', player: 0 });
      setUI({ type: 'pick_card' });
      sceneRef.current?.clearHighlights();
      syncUI();
      return;
    }
    if (p1Needs) {
      setPhase({ type: 'priority', player: 1 });
      setUI({ type: 'pick_card' });
      sceneRef.current?.clearHighlights();
      syncUI();
      return;
    }

    const wasAlreadyInitiative = phaseRef.current.type === 'initiative';
    setPhase({ type: 'initiative' });
    phaseRef.current = { type: 'initiative' };

    if (!wasAlreadyInitiative && prio.spawnedThisTurn.size > 0) {
      state.activationQueue = state.activationQueue.filter(u => !prio.spawnedThisTurn.has(u.uid));
      state.currentActivationIndex = 0;
    }

    if (ctrl.isQueueExhausted()) {
      ctrl.endTurn();
      const newPrio: PriorityState = { p0Used: false, p1Used: false, spawnedThisTurn: new Set() };
      setPriority(newPrio);
      prioRef.current = newPrio;
      setPhase({ type: 'priority', player: 0 });
      phaseRef.current = { type: 'priority', player: 0 };
      advanceTurn();
      return;
    }

    const cu = ctrl.getCurrentUnit();
    if (cu) {
      setUI({ type: 'unit_turn' });
      showActiveUnitHL();
    }
    syncUI();
  }, [syncUI, showActiveUnitHL]);

  // ─── Card selected from picker ──────────────────────
  const onCardSelect = useCallback((cardId: number) => {
    const card = getCard(cardId);
    if (card.cardType !== CardType.UNIT) return;
    const ctrl = ctrlRef.current;
    const scene = sceneRef.current;
    if (!ctrl || !scene) return;

    setUI({ type: 'place_card', cardId });

    const player = getActivePlayer();
    const state = ctrl.getState();
    const cols = player === 0 ? P1_DEPLOY_COLS : P2_DEPLOY_COLS;
    const validHexes: HexCoord[] = [];
    for (const col of cols) {
      for (let row = 0; row < GRID_ROWS; row++) {
        if (canSpawn(state, player, cardId, { col, row }).valid) {
          validHexes.push({ col, row });
        }
      }
    }
    scene.showDeployHighlights(validHexes);
  }, [getActivePlayer]);

  const onCardCancel = useCallback(() => {
    const p = phaseRef.current;
    if (p.type === 'priority') {
      setUI({ type: 'pick_card' });
      sceneRef.current?.clearHighlights();
    } else {
      setUI({ type: 'unit_turn' });
      showActiveUnitHL();
    }
  }, [showActiveUnitHL]);

  const onPass = useCallback(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    ctrl.passActivation();
    sceneRef.current?.clearHighlights();
    advanceTurn();
  }, [advanceTurn]);

  // ─── Hex click handler ──────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { col, row, worldX, worldY } = detail;
      const ctrl = ctrlRef.current;
      const scene = sceneRef.current;
      if (!ctrl || !scene) return;
      const state = ctrl.getState();
      const currentUI = uiRef.current;
      const currentPhase = phaseRef.current;

      // Ignore clicks during animations
      if (currentUI.type === 'animating') return;

      if (currentUI.type === 'place_card') {
        const player = getActivePlayer();
        const result = canSpawn(state, player, currentUI.cardId, { col, row });
        if (!result.valid) return;

        const unit = executeSpawn(state, player, currentUI.cardId, { col, row });
        scene.spawnUnit(unit);

        if (currentPhase.type === 'priority') {
          ctrl.rebuildQueue();
          const prev = prioRef.current;
          const newSpawned = new Set(prev.spawnedThisTurn);
          newSpawned.add(unit.uid);
          const newPrio = {
            p0Used: player === 0 ? true : prev.p0Used,
            p1Used: player === 1 ? true : prev.p1Used,
            spawnedThisTurn: newSpawned,
          };
          setPriority(newPrio);
          prioRef.current = newPrio;
          scene.clearHighlights();
          advanceTurn();
        } else {
          const prev = prioRef.current;
          const newSpawned = new Set(prev.spawnedThisTurn);
          newSpawned.add(unit.uid);
          const newPrio = { ...prev, spawnedThisTurn: newSpawned };
          setPriority(newPrio);
          prioRef.current = newPrio;
          ctrl.passActivation();
          scene.clearHighlights();
          advanceTurn();
        }
        return;
      }

      if (currentUI.type !== 'unit_turn' && currentUI.type !== 'unit_acted') return;

      const cu = ctrl.getCurrentUnit();
      if (!cu) return;

      // Check if clicking on an enemy unit
      const targetUnit = state.units.find(u =>
        u.alive && u.playerId !== cu.playerId &&
        u.occupiedCells.some(c => c.col === col && c.row === row),
      );

      if (targetUnit) {
        // Direct attack (already adjacent or ranged)?
        if (canAttack(state, cu.uid, targetUnit.uid).valid) {
          setUI({ type: 'animating' });
          uiRef.current = { type: 'animating' };
          scene.clearHighlights();

          const attackResult = executeAttack(state, cu.uid, targetUnit.uid);
          scene.updateHpBar(targetUnit.uid, targetUnit.currentHp, targetUnit.maxHp);

          scene.playAttack(cu.uid, { col: targetUnit.col, row: targetUnit.row }, () => {
            scene.showDamageNumber(
              { col: targetUnit.col, row: targetUnit.row },
              attackResult.damage, attackResult.isCrit,
            );

            if (attackResult.targetDied) {
              scene.playDeath(targetUnit.uid, () => {});
            }

            if (attackResult.retaliation) {
              scene.updateHpBar(cu.uid, cu.currentHp, cu.maxHp);
              scene.showDamageNumber(
                { col: cu.col, row: cu.row },
                attackResult.retaliation.damage, attackResult.retaliation.isCrit,
              );
              if (attackResult.retaliation.attackerDied) {
                scene.playDeath(cu.uid, () => {});
              }
            }

            syncUI();
            // Attack ends activation — auto-end
            scheduleAutoEnd();
            setUI({ type: 'unit_acted' });
            uiRef.current = { type: 'unit_acted' };
          });
          return;
        }

        // Auto-walk attack (melee, not adjacent)?
        const card = getCard(cu.cardId);
        if (isMelee(card)) {
          const walkHex = getAutoWalkHex(state, cu.uid, targetUnit.uid, { x: worldX, y: worldY });
          if (walkHex) {
            setUI({ type: 'animating' });
            uiRef.current = { type: 'animating' };
            scene.clearHighlights();

            // Execute move in game state
            const path = executeMove(state, cu.uid, walkHex);

            // Animate move, then attack
            scene.moveUnit(cu.uid, path, () => {
              // Now adjacent — execute attack
              const attackResult = executeAttack(state, cu.uid, targetUnit.uid);
              scene.updateHpBar(targetUnit.uid, targetUnit.currentHp, targetUnit.maxHp);

              scene.playAttack(cu.uid, { col: targetUnit.col, row: targetUnit.row }, () => {
                scene.showDamageNumber(
                  { col: targetUnit.col, row: targetUnit.row },
                  attackResult.damage, attackResult.isCrit,
                );

                if (attackResult.targetDied) {
                  scene.playDeath(targetUnit.uid, () => {});
                }

                if (attackResult.retaliation) {
                  scene.updateHpBar(cu.uid, cu.currentHp, cu.maxHp);
                  scene.showDamageNumber(
                    { col: cu.col, row: cu.row },
                    attackResult.retaliation.damage, attackResult.retaliation.isCrit,
                  );
                  if (attackResult.retaliation.attackerDied) {
                    scene.playDeath(cu.uid, () => {});
                  }
                }

                syncUI();
                scheduleAutoEnd();
                setUI({ type: 'unit_acted' });
                uiRef.current = { type: 'unit_acted' };
              });
            });
            return;
          }
        }
        return;
      }

      // Not clicking an enemy — try to move
      if (currentUI.type === 'unit_acted') return; // can't move after attack
      if (!canMove(state, cu.uid, { col, row }).valid) return;

      setUI({ type: 'animating' });
      uiRef.current = { type: 'animating' };
      scene.clearHighlights();

      const path = executeMove(state, cu.uid, { col, row });
      scene.moveUnit(cu.uid, path, () => {
        setUI({ type: 'unit_acted' });
        uiRef.current = { type: 'unit_acted' };

        if (cu.remainingAp > 0) {
          showActiveUnitHL();
        } else {
          scheduleAutoEnd();
        }
        syncUI();
      });
    };

    window.addEventListener('hex-click', handler);
    return () => window.removeEventListener('hex-click', handler);
  }, [getActivePlayer, advanceTurn, showActiveUnitHL, syncUI, scheduleAutoEnd]);

  // ─── Engine init ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | null = null;
    const keys: Record<string, boolean> = {};
    const onKD = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKU = (e: KeyboardEvent) => { keys[e.code] = false; };

    (async () => {
      engine = await Engine.create(canvas, { backgroundColor: 0x1a2a1a });
      engineRef.current = engine;
      await engine.loadFont('/assets/fonts/PatrickHand.png', '/assets/fonts/PatrickHand.json');

      const ctrl = new GameController();
      ctrl.startGame(Date.now());
      ctrlRef.current = ctrl;

      const scene = new BattleScene(engine);
      scene.createGrid();
      sceneRef.current = scene;

      // Camera
      const mid = hex2px((GRID_COLS - 1) / 2, (GRID_ROWS - 1) / 2);
      engine.camera.position.set(mid.x, mid.y);
      engine.camera.zoom = 0.9;
      engine.camera.dirty = true;

      // Click → hex-click event (now includes worldX, worldY for cursor direction)
      engine.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;
        const rect = engine!.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = engine!.camera.screenToWorld(
          (e.clientX - rect.left) * dpr,
          (e.clientY - rect.top) * dpr,
        );
        const h = px2hex(w.x, w.y);
        if (isValidCell(h.col, h.row)) {
          window.dispatchEvent(new CustomEvent('hex-click', {
            detail: { col: h.col, row: h.row, worldX: w.x, worldY: w.y },
          }));
        }
      });

      // Camera controls
      window.addEventListener('keydown', onKD);
      window.addEventListener('keyup', onKU);
      engine.canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        engine!.camera.zoom = Math.max(0.3, Math.min(5, engine!.camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
        engine!.camera.dirty = true;
      }, { passive: false });
      engine.ticker.add((dt: number) => {
        const sp = 200; let moved = false;
        if (keys['KeyW'] || keys['ArrowUp'])    { engine!.camera.position.y -= sp * dt; moved = true; }
        if (keys['KeyS'] || keys['ArrowDown'])  { engine!.camera.position.y += sp * dt; moved = true; }
        if (keys['KeyA'] || keys['ArrowLeft'])  { engine!.camera.position.x -= sp * dt; moved = true; }
        if (keys['KeyD'] || keys['ArrowRight']) { engine!.camera.position.x += sp * dt; moved = true; }
        if (moved) engine!.camera.dirty = true;
      });
    })();

    return () => {
      window.removeEventListener('keydown', onKD);
      window.removeEventListener('keyup', onKU);
      engineRef.current = null;
      ctrlRef.current = null;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      engine?.destroy();
    };
  }, []);

  // ─── Derived display values ─────────────────────────
  const activePlayer = getActivePlayer();
  const isPriority = phase.type === 'priority';
  const isPlacing = ui.type === 'place_card';
  const isAnimating = ui.type === 'animating';
  const cardPickerDisabled = ui.type === 'unit_acted' || isAnimating;
  const showPassBtn = phase.type === 'initiative' && (ui.type === 'unit_turn' || ui.type === 'unit_acted');
  const currentUnit = ctrlRef.current?.getCurrentUnit();

  let statusText = '';
  if (isPriority) {
    statusText = `P${phase.player + 1} — Deploy a unit`;
  } else if (currentUnit) {
    const card = getCard(currentUnit.cardId);
    statusText = `P${activePlayer + 1} — ${card.name} (AP: ${currentUnit.remainingAp}/${currentUnit.speed})`;
  } else {
    statusText = `P${activePlayer + 1}`;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} onContextMenu={e => e.preventDefault()} />

      {/* ─── Top Bar ───────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
        pointerEvents: 'none',
      }}>
        <ArcanaPanel variant="slate" style={{ margin: '0 auto', pointerEvents: 'auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '2px 12px', fontFamily: 'var(--font-display)',
            color: 'var(--color-text)', fontSize: 'var(--text-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: 'bold' }}>Turn {turn}</span>
              <span>{statusText}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#6699ff', fontSize: 'var(--text-xs)' }}>P1</span>
                <div style={{ width: 80 }}>
                  <ArcanaBar value={mana[0]} max={12} color="blue">
                    <span style={{ fontSize: 'var(--text-xs)' }}>{mana[0]}</span>
                  </ArcanaBar>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#ff6666', fontSize: 'var(--text-xs)' }}>P2</span>
                <div style={{ width: 80 }}>
                  <ArcanaBar value={mana[1]} max={12} color="blue">
                    <span style={{ fontSize: 'var(--text-xs)' }}>{mana[1]}</span>
                  </ArcanaBar>
                </div>
              </div>
            </div>
          </div>
        </ArcanaPanel>
      </div>

      {/* ─── Initiative Sidebar ────────────────────── */}
      <div style={{
        position: 'fixed', top: 80, right: 8, zIndex: 10,
        width: 160, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto',
      }}>
        <ArcanaPanel variant="wood">
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 'var(--text-xs)',
            color: 'var(--color-text)',
          }}>
            <div style={{
              fontWeight: 'bold', fontSize: 'var(--text-sm)',
              color: 'var(--color-gold)', marginBottom: 6,
              textAlign: 'center',
            }}>Initiative</div>
            {queueInfo.labels.length === 0 && (
              <div style={{ opacity: 0.5, textAlign: 'center' }}>No units</div>
            )}
            {queueInfo.labels.map((label, i) => (
              <div key={i} style={{
                padding: '3px 6px',
                background: i === queueInfo.index ? 'rgba(221,179,109,0.3)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 1,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {i === queueInfo.index && (
                  <span style={{ color: 'var(--color-gold)' }}>&#9654;</span>
                )}
                <span>{label}</span>
              </div>
            ))}
          </div>
        </ArcanaPanel>
      </div>

      {/* ─── Action Buttons ────────────────────────── */}
      {showPassBtn && !isAnimating && (
        <div style={{
          position: 'fixed', bottom: 190, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 10, zIndex: 101,
        }}>
          <ArcanaButton variant="blue" size="sm" onClick={onPass}>Pass</ArcanaButton>
        </div>
      )}

      {/* ─── Card Picker ──────────────────────────── */}
      <CardPicker
        currentMana={mana[activePlayer]}
        onCardSelect={onCardSelect}
        selectedCardId={isPlacing ? ui.cardId : null}
        onCancel={onCardCancel}
        disabled={cardPickerDisabled}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify project compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (fix any import issues)

- [ ] **Step 4: Run existing game tests**

Run: `cd frontend && npx vitest run src/game/__tests__/`
Expected: all tests pass

- [ ] **Step 5: Start dev server and test in browser**

Run: `cd frontend && npm run dev`
Navigate to `http://localhost:5173/battle`

Manual verification checklist:
1. Grid renders correctly with deploy zones
2. Card picker appears at bottom with Arcana styling
3. Top bar shows turn/status/mana with ArcanaPanel + ArcanaBar
4. Initiative sidebar shows with ArcanaPanel wood variant
5. Can select a card, see yellow deploy highlights, place a unit
6. Unit spawns with idle animation, HP bar visible below sprite
7. Unit moves with smooth continuous animation (not cell-hopping)
8. Run animation plays during movement
9. Click enemy to attack — attack direction animation plays
10. Damage numbers float up
11. HP bar updates after damage
12. Click distant enemy with melee unit — auto-walks then attacks
13. Orange highlights show on enemies reachable via auto-walk
14. After attack (AP=0), activation auto-advances after brief delay
15. Unit death plays death/fade animation
16. Pass button uses ArcanaButton styling

**Ask user to verify in browser** — stop and check before committing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Battle.tsx frontend/src/components/CardPicker.tsx
git commit -m "feat(battle): rewrite Battle.tsx — Arcana HUD, auto-walk attack, smooth movement, animation state machine"
```

---

## Task 6: Polish and Edge Cases

**Files:**
- Modify: `frontend/src/pages/Battle.tsx`
- Modify: `frontend/src/game/BattleScene.ts`

Fix edge cases discovered during testing.

- [ ] **Step 1: Handle ranged attack animation (shoot + arrow projectile)**

In `BattleScene.ts`, add an `animateProjectile` method and integrate it with `playAttack` for ranged units. Add after the `showDamageNumber` method:

```typescript
  async animateProjectile(
    fromHex: HexCoord,
    toHex: HexCoord,
    onDone: () => void,
  ): Promise<void> {
    const from = hex2px(fromHex.col, fromHex.row);
    const to = hex2px(toHex.col, toHex.row);

    // Simple projectile: a small Graphics dot that travels from→to
    const proj = new Graphics();
    proj.beginFill(0xffffff, 0.9);
    proj.drawCircle(0, 0, 3);
    proj.endFill();
    proj.position.set(from.x, from.y);
    this.unitLayer.addChild(proj);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 400; // pixels per second
    let traveled = 0;

    const tick = (dt: number) => {
      traveled += speed * dt;
      const t = Math.min(traveled / dist, 1);
      proj.position.set(from.x + dx * t, from.y + dy * t);
      if (t >= 1) {
        this.engine.ticker.remove(tick);
        this.unitLayer.removeChild(proj);
        onDone();
      }
    };
    this.engine.ticker.add(tick);
  }
```

Then in `Battle.tsx`, when attacking with a ranged unit, chain `playAttack` → `animateProjectile` → damage. This requires checking `attackResult.attackType` in the hex click handler. In the direct attack section, after `const attackResult = executeAttack(...)`:

Check if ranged: if `attackResult.attackType === 'ranged'`, after `playAttack` completes, call `scene.animateProjectile(cuHex, targetHex, () => { /* show damage */ })`.

- [ ] **Step 2: Handle edge case — unit dies to retaliation during auto-walk attack**

If the attacker dies to retaliation, the auto-end timer should still fire (the unit is dead, activation should advance). Verify in `scheduleAutoEnd` that it also fires when the current unit is dead. The existing `cu.remainingAp > 0` check already handles this since `remainingAp = 0` after attack.

- [ ] **Step 3: Test all flows in browser**

Run: `cd frontend && npm run dev`

Full test pass:
1. Spawn P1 melee + P2 melee → move P1 near P2 → click P2 → auto-walk+attack
2. Spawn P1 ranged → click distant P2 → shoot anim + projectile
3. Let a unit die → death anim → fade
4. Unit with 0 AP → auto-ends after delay
5. Both players go through full turn cycle

**Ask user to verify in browser.**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/BattleScene.ts frontend/src/pages/Battle.tsx
git commit -m "feat(battle): add ranged projectile animation, edge case fixes"
```

---

## Task 7: Final Cleanup

- [ ] **Step 1: Run all game tests**

Run: `cd frontend && npx vitest run src/game/__tests__/`
Expected: all tests pass

- [ ] **Step 2: Run full project type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify dev server runs clean**

Run: `cd frontend && npm run dev`
Expected: no console errors, battle page loads and plays correctly

- [ ] **Step 4: Update CONTINUE.md**

Update the battle system section to reflect completed work:
- Animation state machine: idle/run/attack/death ✓
- Smooth continuous movement ✓
- Click-to-attack with auto-walk ✓
- Auto-end activation when AP exhausted ✓
- In-engine HP bars ✓
- Arcana HUD (top bar, initiative sidebar, action buttons) ✓
- Ranged projectile animation ✓
- Known bugs: (list any remaining)
- Next: spell casting UI (B11), hero barrier (B12)

- [ ] **Step 5: Commit**

```bash
git add CONTINUE.md
git commit -m "docs: update CONTINUE.md — battle polish complete"
```
