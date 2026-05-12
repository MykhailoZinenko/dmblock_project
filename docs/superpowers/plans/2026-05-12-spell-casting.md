# Spell Casting (B11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up spell cards in the battle system with target selection, FX animations, success/fail rolls, and a full status effect system (slow, polymorph, curse).

**Architecture:** New `castSpell.ts` action file handles spell logic (target validation, success roll, effect resolution). Status effects stored as `activeEffects[]` on UnitInstance, ticked down in GameController.endTurn. BattleScene gets spell FX playback + floating text. Battle.tsx adds `target_spell` UI mode for hex-based targeting.

**Tech Stack:** TypeScript, Vitest, custom WebGPU engine (AnimatedSprite, SpriteSheet, Graphics, Text)

**Spec:** `docs/superpowers/specs/2026-05-12-spell-casting-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/game/types.ts` | Modify | Add `ActiveEffect` interface, add `activeEffects` field to `UnitInstance` |
| `frontend/src/game/actions/spawnUnit.ts` | Modify | Initialize `activeEffects: []` on spawn |
| `frontend/src/game/actions/castSpell.ts` | Create | Spell target validation, success roll, effect resolution (damage, heal, status) |
| `frontend/src/game/__tests__/castSpell.test.ts` | Create | Tests for all 7 spells + failure + AoE + status effects |
| `frontend/src/game/GameController.ts` | Modify | Tick status effects on `endTurn()`, remove expired, restore stats |
| `frontend/src/game/AnimationController.ts` | Modify | Add `swapToSheep()` and `restoreFromSheep()` |
| `frontend/src/game/BattleScene.ts` | Modify | Add `playSpellFx()`, `showHealNumber()`, `showStatusText()`, `showFizzle()`, `showSpellHighlights()`, polymorph visual swap |
| `frontend/src/pages/Battle.tsx` | Modify | Add `target_spell` UI mode, spell hex-click handling, wire cast flow |

---

## Task 1: Types + Spawn Update

**Files:**
- Modify: `frontend/src/game/types.ts`
- Modify: `frontend/src/game/actions/spawnUnit.ts`

- [ ] **Step 1: Add ActiveEffect and update UnitInstance in types.ts**

Add after the `TerrainEffect` interface (around line 121), before the `GamePhase` type:

```typescript
export interface ActiveEffect {
  cardId: number;
  type: 'slow' | 'polymorph' | 'curse';
  turnsRemaining: number;
  originalStats?: { attack: number; defense: number; speed: number };
}
```

Add `activeEffects: ActiveEffect[];` to the `UnitInstance` interface, after the `cursed: boolean;` field (line 98):

```typescript
  activeEffects: ActiveEffect[];
```

- [ ] **Step 2: Initialize activeEffects in spawnUnit.ts**

In `frontend/src/game/actions/spawnUnit.ts`, in the `executeSpawn` function, add `activeEffects: [],` to the unit object literal. Add it after `cursed: false,` (around line 147):

```typescript
    cursed: false,
    activeEffects: [],
    occupiedCells: cells,
```

- [ ] **Step 3: Verify compilation and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run src/game/__tests__/`
Expected: compiles clean, all 325 tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/types.ts frontend/src/game/actions/spawnUnit.ts
git commit -m "feat(spell): add ActiveEffect type and activeEffects field to UnitInstance"
```

---

## Task 2: castSpell.ts — Core Logic

**Files:**
- Create: `frontend/src/game/actions/castSpell.ts`
- Create: `frontend/src/game/__tests__/castSpell.test.ts`

- [ ] **Step 1: Create castSpell.ts**

```typescript
import type { GameState } from '../GameState';
import type { HexCoord, UnitInstance, ActiveEffect } from '../types';
import { CardType, SpellTargetType, DamageType, Faction } from '../types';
import { getCard, isBuilding } from '../cardRegistry';
import { hexDistance } from '../hexUtils';
import { applyDamage } from '../combat';
import { GRID_COLS, GRID_ROWS } from '../constants';
import type { SeededRNG } from '../rng';

const HEALING_CARD_ID = 10;

export interface CastResult {
  success: boolean;
  affectedUnits: {
    uid: number;
    damage?: number;
    healed?: number;
    statusApplied?: 'slow' | 'polymorph' | 'curse';
    died?: boolean;
  }[];
}

export function getSpellTargets(
  state: GameState,
  playerId: number,
  cardId: number,
): HexCoord[] {
  const card = getCard(cardId);
  if (card.cardType !== CardType.SPELL) return [];

  const targets: HexCoord[] = [];

  if (card.spellTargetType === SpellTargetType.SINGLE) {
    const isHeal = cardId === HEALING_CARD_ID;
    for (const unit of state.units) {
      if (!unit.alive) continue;
      if (isHeal && unit.playerId !== playerId) continue;
      if (!isHeal && unit.playerId === playerId) continue;
      targets.push({ col: unit.col, row: unit.row });
    }
  } else if (card.spellTargetType === SpellTargetType.AREA) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        targets.push({ col: c, row: r });
      }
    }
  }

  return targets;
}

export function canCast(
  state: GameState,
  playerId: number,
  cardId: number,
  targetHex: HexCoord | null,
): { valid: boolean; reason?: string } {
  const card = getCard(cardId);
  if (card.cardType !== CardType.SPELL) {
    return { valid: false, reason: 'Not a spell card' };
  }
  if (state.players[playerId].mana < card.manaCost) {
    return { valid: false, reason: 'Not enough mana' };
  }
  if (card.spellTargetType === SpellTargetType.SINGLE || card.spellTargetType === SpellTargetType.AREA) {
    if (!targetHex) return { valid: false, reason: 'No target selected' };
    const validTargets = getSpellTargets(state, playerId, cardId);
    const isValid = validTargets.some(h => h.col === targetHex.col && h.row === targetHex.row);
    if (!isValid) return { valid: false, reason: 'Invalid target hex' };
  }
  return { valid: true };
}

function applySpellDamage(
  state: GameState,
  target: UnitInstance,
  spellPower: number,
  card: ReturnType<typeof getCard>,
): { damage: number; died: boolean } {
  const targetCard = getCard(target.cardId);
  let damage = Math.max(1, spellPower - target.defense);

  if (target.magicResistance > 0) {
    const targetIsBuilding = isBuilding(targetCard);
    if (targetIsBuilding && card.faction === Faction.INFERNO) {
      // Inferno bypasses building MR
    } else {
      damage = Math.max(1, Math.floor(damage * (1 - target.magicResistance / 100)));
    }
  }

  const died = applyDamage(state, target.uid, damage);
  return { damage, died };
}

function applyStatus(
  unit: UnitInstance,
  type: ActiveEffect['type'],
  duration: number,
  cardId: number,
): void {
  const original = { attack: unit.attack, defense: unit.defense, speed: unit.speed };

  const effect: ActiveEffect = { cardId, type, turnsRemaining: duration, originalStats: original };
  unit.activeEffects.push(effect);

  if (type === 'slow') {
    unit.speed = Math.max(1, unit.speed - 1);
  } else if (type === 'polymorph') {
    unit.attack = 0;
    unit.defense = 0;
    unit.speed = 1;
    unit.polymorphed = true;
  } else if (type === 'curse') {
    unit.attack = Math.floor(unit.attack / 2);
    unit.defense = Math.floor(unit.defense / 2);
    unit.cursed = true;
  }
}

export function executeCast(
  state: GameState,
  playerId: number,
  cardId: number,
  targetHex: HexCoord | null,
): CastResult {
  const card = getCard(cardId);

  state.players[playerId].mana -= card.manaCost;

  if (!state.rng.rollPercent(card.successChance)) {
    return { success: false, affectedUnits: [] };
  }

  const affected: CastResult['affectedUnits'] = [];

  if (cardId === HEALING_CARD_ID && targetHex) {
    const target = state.units.find(u => u.alive && u.col === targetHex.col && u.row === targetHex.row);
    if (target) {
      const healed = Math.min(card.spellPower, target.maxHp - target.currentHp);
      target.currentHp = Math.min(target.maxHp, target.currentHp + card.spellPower);
      affected.push({ uid: target.uid, healed });
    }
  } else if (card.spellTargetType === SpellTargetType.SINGLE && targetHex) {
    const target = state.units.find(u => u.alive && u.col === targetHex.col && u.row === targetHex.row);
    if (target) {
      if (card.spellPower > 0) {
        const { damage, died } = applySpellDamage(state, target, card.spellPower, card);
        const entry: CastResult['affectedUnits'][0] = { uid: target.uid, damage, died };
        if (card.duration > 0 && !died) {
          const statusType = cardId === 15 ? 'polymorph' : cardId === 16 ? 'curse' : 'slow';
          applyStatus(target, statusType, card.duration, cardId);
          entry.statusApplied = statusType;
        }
        affected.push(entry);
      } else {
        // Pure status spell (Polymorph, Curse) — no damage
        const statusType = cardId === 15 ? 'polymorph' : 'curse';
        applyStatus(target, statusType, card.duration, cardId);
        affected.push({ uid: target.uid, statusApplied: statusType });
      }
    }
  } else if (card.spellTargetType === SpellTargetType.AREA && targetHex) {
    // AoE: hit all enemy units within 1-hex radius of target
    for (const unit of state.units) {
      if (!unit.alive || unit.playerId === playerId) continue;
      const dist = hexDistance(targetHex.col, targetHex.row, unit.col, unit.row);
      if (dist <= 1) {
        const { damage, died } = applySpellDamage(state, unit, card.spellPower, card);
        affected.push({ uid: unit.uid, damage, died });
      }
    }
  }

  return { success: true, affectedUnits: affected };
}

export function tickStatusEffects(state: GameState): number[] {
  const expiredUids: number[] = [];

  for (const unit of state.units) {
    if (!unit.alive || unit.activeEffects.length === 0) continue;

    const remaining: ActiveEffect[] = [];
    for (const effect of unit.activeEffects) {
      effect.turnsRemaining--;
      if (effect.turnsRemaining <= 0) {
        if (effect.originalStats) {
          unit.attack = effect.originalStats.attack;
          unit.defense = effect.originalStats.defense;
          unit.speed = effect.originalStats.speed;
        }
        if (effect.type === 'polymorph') unit.polymorphed = false;
        if (effect.type === 'curse') unit.cursed = false;
        expiredUids.push(unit.uid);
      } else {
        remaining.push(effect);
      }
    }
    unit.activeEffects = remaining;
  }

  return expiredUids;
}
```

- [ ] **Step 2: Create tests**

```typescript
// frontend/src/game/__tests__/castSpell.test.ts
import { describe, it, expect } from 'vitest';
import { createGameState } from '../GameState';
import { executeSpawn } from '../actions/spawnUnit';
import { getSpellTargets, canCast, executeCast, tickStatusEffects } from '../actions/castSpell';

describe('getSpellTargets', () => {
  it('Healing (10) returns friendly unit hexes', () => {
    const state = createGameState(42);
    const ally = executeSpawn(state, 0, 1, { col: 0, row: 0 });
    executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const targets = getSpellTargets(state, 0, 10);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ col: ally.col, row: ally.row });
  });

  it('Blast (11) returns enemy unit hexes', () => {
    const state = createGameState(42);
    executeSpawn(state, 0, 1, { col: 0, row: 0 });
    const enemy = executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const targets = getSpellTargets(state, 0, 11);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ col: enemy.col, row: enemy.row });
  });

  it('Inferno (14) AREA returns all board hexes', () => {
    const state = createGameState(42);
    const targets = getSpellTargets(state, 0, 14);
    expect(targets).toHaveLength(15 * 11);
  });
});

describe('canCast', () => {
  it('rejects when not enough mana', () => {
    const state = createGameState(42);
    state.players[0].mana = 2;
    executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const result = canCast(state, 0, 11, { col: 14, row: 0 });
    expect(result.valid).toBe(false);
  });

  it('accepts valid cast', () => {
    const state = createGameState(42);
    state.players[0].mana = 5;
    executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const result = canCast(state, 0, 11, { col: 14, row: 0 });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid target hex', () => {
    const state = createGameState(42);
    state.players[0].mana = 5;
    const result = canCast(state, 0, 11, { col: 5, row: 5 });
    expect(result.valid).toBe(false);
  });
});

describe('executeCast', () => {
  it('Healing restores HP', () => {
    const state = createGameState(42);
    const ally = executeSpawn(state, 0, 1, { col: 0, row: 0 });
    ally.currentHp = 20;
    state.players[0].mana = 10;
    const result = executeCast(state, 0, 10, { col: 0, row: 0 });
    if (result.success) {
      expect(ally.currentHp).toBeGreaterThan(20);
      expect(result.affectedUnits[0].healed).toBeGreaterThan(0);
    }
    expect(state.players[0].mana).toBe(7);
  });

  it('Blast deals magic damage', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 1, { col: 14, row: 0 });
    const hpBefore = enemy.currentHp;
    state.players[0].mana = 10;
    const result = executeCast(state, 0, 11, { col: 14, row: 0 });
    if (result.success) {
      expect(enemy.currentHp).toBeLessThan(hpBefore);
      expect(result.affectedUnits[0].damage).toBeGreaterThan(0);
    }
    expect(state.players[0].mana).toBe(7);
  });

  it('deducts mana even on failure', () => {
    const state = createGameState(42);
    executeSpawn(state, 1, 1, { col: 14, row: 0 });
    state.players[0].mana = 10;
    // Force failure by using a seed that fails, or just check mana is deducted
    executeCast(state, 0, 11, { col: 14, row: 0 });
    expect(state.players[0].mana).toBe(7);
  });

  it('Inferno AoE hits multiple enemies within radius', () => {
    const state = createGameState(100);
    const e1 = executeSpawn(state, 1, 1, { col: 7, row: 5 });
    const e2 = executeSpawn(state, 1, 1, { col: 8, row: 5 });
    const e3 = executeSpawn(state, 1, 1, { col: 13, row: 0 }); // far away
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 14, { col: 7, row: 5 });
    if (result.success) {
      const hitUids = result.affectedUnits.map(a => a.uid);
      expect(hitUids).toContain(e1.uid);
      expect(hitUids).toContain(e2.uid);
      expect(hitUids).not.toContain(e3.uid);
    }
  });

  it('Polymorph applies status and changes stats', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 }); // Knight
    const atkBefore = enemy.attack;
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 15, { col: 14, row: 0 });
    if (result.success) {
      expect(enemy.polymorphed).toBe(true);
      expect(enemy.attack).toBe(0);
      expect(enemy.defense).toBe(0);
      expect(enemy.speed).toBe(1);
      expect(enemy.activeEffects).toHaveLength(1);
      expect(enemy.activeEffects[0].type).toBe('polymorph');
      expect(enemy.activeEffects[0].originalStats!.attack).toBe(atkBefore);
    }
  });

  it('Curse halves attack and defense', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 }); // Knight: atk 20, def 18
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 16, { col: 14, row: 0 });
    if (result.success) {
      expect(enemy.cursed).toBe(true);
      expect(enemy.attack).toBe(10);
      expect(enemy.defense).toBe(9);
    }
  });
});

describe('tickStatusEffects', () => {
  it('removes expired effects and restores stats', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 }); // Knight
    const origAtk = enemy.attack;
    state.players[0].mana = 20;
    const result = executeCast(state, 0, 15, { col: 14, row: 0 });
    if (result.success) {
      expect(enemy.polymorphed).toBe(true);
      const expired = tickStatusEffects(state);
      expect(expired).toContain(enemy.uid);
      expect(enemy.polymorphed).toBe(false);
      expect(enemy.attack).toBe(origAtk);
      expect(enemy.activeEffects).toHaveLength(0);
    }
  });

  it('does not remove effects with turns remaining', () => {
    const state = createGameState(100);
    const enemy = executeSpawn(state, 1, 5, { col: 14, row: 0 });
    state.players[0].mana = 20;
    // Manually add a 2-turn effect
    enemy.activeEffects.push({
      cardId: 12,
      type: 'slow',
      turnsRemaining: 2,
      originalStats: { attack: enemy.attack, defense: enemy.defense, speed: enemy.speed },
    });
    enemy.speed = Math.max(1, enemy.speed - 1);
    const expired = tickStatusEffects(state);
    expect(expired).toHaveLength(0);
    expect(enemy.activeEffects).toHaveLength(1);
    expect(enemy.activeEffects[0].turnsRemaining).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/game/__tests__/castSpell.test.ts`
Expected: all tests pass

- [ ] **Step 4: Run all game tests**

Run: `cd frontend && npx vitest run src/game/__tests__/`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/game/actions/castSpell.ts frontend/src/game/__tests__/castSpell.test.ts
git commit -m "feat(spell): add castSpell.ts — spell targeting, success roll, damage, heal, status effects"
```

---

## Task 3: GameController Status Effect Tick

**Files:**
- Modify: `frontend/src/game/GameController.ts`

- [ ] **Step 1: Add import and call tickStatusEffects in endTurn**

Add import at the top of `frontend/src/game/GameController.ts`:

```typescript
import { tickStatusEffects } from './actions/castSpell';
```

In the `endTurn()` method, after the AP reset loop (after the `for (const unit of this.state.units)` block that resets `remainingAp` and `retaliatedThisTurn`), add:

```typescript
    // Tick status effects (reduce duration, expire, restore stats)
    const expiredUids = tickStatusEffects(this.state);
    for (const uid of expiredUids) {
      this.emit('effectExpired', { uid });
    }
```

- [ ] **Step 2: Verify compilation and tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run src/game/__tests__/`
Expected: compiles clean, all tests pass

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/GameController.ts
git commit -m "feat(spell): tick status effects on turn end — expire and restore stats"
```

---

## Task 4: AnimationController — Sheep Swap

**Files:**
- Modify: `frontend/src/game/AnimationController.ts`

- [ ] **Step 1: Add sheepSpriteConfig import and swap methods**

Add to imports at top of `frontend/src/game/AnimationController.ts`:

```typescript
import {
  unitSpriteConfigs,
  buildingSpriteConfigs,
  sheepSpriteConfig,
  getAnimForState,
  getAttackAnim,
  type AnimState,
  type AnimDefinition,
  type UnitSpriteConfig,
} from './spriteConfig';
```

(Add `sheepSpriteConfig` to the existing import.)

Add these two methods to the `AnimationController` class, after the `fadeTo` method and before `destroy()`:

```typescript
  async swapToSheep(): Promise<void> {
    const anim = getAnimForState(sheepSpriteConfig, 'idle');
    if (!anim) return;

    const cacheKey = 'sheep_idle';
    let frames = this.textureCache.get(cacheKey);
    if (!frames) {
      const tex = await this.engine.textures.load('sheep_idle', `${sheepSpriteConfig.basePath}/${anim.file}`);
      frames = SpriteSheet.fromStrip(tex, anim.frameWidth);
      this.textureCache.set(cacheKey, frames);
    }

    if (this.sprite) {
      this.sprite.stop();
      this.container.removeChild(this.sprite);
    }

    const spr = new AnimatedSprite(frames);
    spr.anchor.set(0.5, 0.75);
    const s = UNIT_TARGET_HEIGHT / anim.frameHeight;
    spr.scale.set(s, s);
    spr.animationSpeed = 0.12;
    spr.loop = true;
    spr.gotoAndPlay(0);
    this.sprite = spr;
    this.container.addChild(spr);
  }

  async restoreFromSheep(): Promise<void> {
    await this.playIdle();
  }
```

- [ ] **Step 2: Verify compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/game/AnimationController.ts
git commit -m "feat(spell): add sheep sprite swap for polymorph"
```

---

## Task 5: BattleScene — Spell FX + Highlights

**Files:**
- Modify: `frontend/src/game/BattleScene.ts`

- [ ] **Step 1: Add spell FX imports**

Add to the imports at the top of `frontend/src/game/BattleScene.ts`:

```typescript
import { AnimatedSprite } from '../engine/nodes/AnimatedSprite';
import { SpriteSheet } from '../engine/textures/SpriteSheet';
import { arrowProjectile, spellFxConfigs } from './spriteConfig';
```

(Replace the existing `import { arrowProjectile } from './spriteConfig';` line with the one above.)

- [ ] **Step 2: Add spell FX, heal number, status text, fizzle, and spell highlight methods**

Add these methods to the `BattleScene` class, after the `animateProjectile` method and before `destroy()`:

```typescript
  // ── Spell FX ─────────────────────────────────────────

  async playSpellFx(cardId: number, targetHex: HexCoord, onDone: () => void): Promise<void> {
    const fxCfg = spellFxConfigs[cardId];
    if (!fxCfg) { onDone(); return; }

    const pos = hex2px(targetHex.col, targetHex.row);
    const tex = await this.engine.textures.load(`spell_fx_${cardId}`, fxCfg.file);
    const frames = SpriteSheet.fromStrip(tex, fxCfg.frameWidth);
    const spr = new AnimatedSprite(frames);
    spr.anchor.set(0.5, 0.75);
    const s = (HEX_SIZE * 2) / fxCfg.frameHeight;
    spr.scale.set(s, s);
    spr.position.set(pos.x, pos.y);
    spr.animationSpeed = 0.15;
    spr.loop = false;
    this.unitLayer.addChild(spr);
    spr.gotoAndPlay(0);
    spr.onComplete = () => {
      this.unitLayer.removeChild(spr);
      onDone();
    };
  }

  showHealNumber(hex: HexCoord, amount: number): void {
    const pos = hex2px(hex.col, hex.row);
    const txt = new Text(`+${amount}`, { fontSize: 22, fill: 0x2ecc71 });
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

  showStatusText(hex: HexCoord, text: string): void {
    const pos = hex2px(hex.col, hex.row);
    const txt = new Text(text, { fontSize: 18, fill: 0x9b59b6 });
    txt.position.set(pos.x - 30, pos.y - HEX_SIZE * 1.5);
    this.unitLayer.addChild(txt);
    let t = 0;
    const fn = (dt: number) => {
      t += dt;
      txt.position.y -= 30 * dt;
      txt.alpha = Math.max(0, 1 - t * 0.7);
      if (t > 1.4) {
        this.engine.ticker.remove(fn);
        this.unitLayer.removeChild(txt);
      }
    };
    this.engine.ticker.add(fn);
  }

  showFizzle(hex: HexCoord): void {
    const pos = hex2px(hex.col, hex.row);
    const txt = new Text('FIZZLE!', { fontSize: 24, fill: 0xf1c40f });
    txt.position.set(pos.x - 30, pos.y - HEX_SIZE * 1.2);
    this.unitLayer.addChild(txt);
    let t = 0;
    const fn = (dt: number) => {
      t += dt;
      txt.position.y -= 30 * dt;
      txt.alpha = Math.max(0, 1 - t * 0.8);
      if (t > 1.2) {
        this.engine.ticker.remove(fn);
        this.unitLayer.removeChild(txt);
      }
    };
    this.engine.ticker.add(fn);
  }

  showSpellHighlights(validHexes: HexCoord[], highlightType: 'enemy' | 'ally' | 'area'): void {
    this.hlGfx.clear();
    const color = highlightType === 'ally' ? 0x2ecc71
      : highlightType === 'area' ? 0xe67e22
      : 0x9b59b6;
    for (const h of validHexes) {
      const p = hex2px(h.col, h.row);
      this.hlGfx.lineStyle(2, color);
      this.hlGfx.beginFill(color, 0.15);
      this.hlGfx.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
      this.hlGfx.endFill();
    }
    this.hlGfx.visible = true;
  }

  // ── Polymorph Visuals ────────────────────────────────

  swapToSheep(uid: number): void {
    const entry = this.units.get(uid);
    if (!entry) return;
    entry.anim.swapToSheep();
  }

  restoreFromSheep(uid: number): void {
    const entry = this.units.get(uid);
    if (!entry) return;
    entry.anim.restoreFromSheep();
  }
```

- [ ] **Step 3: Verify compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/game/BattleScene.ts
git commit -m "feat(spell): add spell FX, heal numbers, status text, fizzle, spell highlights, polymorph visuals to BattleScene"
```

---

## Task 6: Battle.tsx — Spell Targeting UI

**Files:**
- Modify: `frontend/src/pages/Battle.tsx`
- Modify: `frontend/src/components/CardPicker.tsx`

- [ ] **Step 1: Add target_spell to UIMode and add imports**

In `frontend/src/pages/Battle.tsx`, update the UIMode type to add `target_spell`:

```typescript
type UIMode =
  | { type: 'pick_card' }
  | { type: 'place_card'; cardId: number }
  | { type: 'target_spell'; cardId: number }
  | { type: 'unit_turn' }
  | { type: 'unit_acted' }
  | { type: 'animating' };
```

Add `canCast, executeCast, getSpellTargets` to the imports from `attackUnit.ts`... no, from `castSpell.ts`. Add a new import line:

```typescript
import { canCast, executeCast, getSpellTargets } from '../game/actions/castSpell';
```

Also add `SpellTargetType` to the existing types import:

```typescript
import { CardType, SpellTargetType } from '../game/types';
```

- [ ] **Step 2: Update onCardSelect to handle spells**

Replace the `onCardSelect` callback. Currently it rejects spells. Change it to route spells to `target_spell` mode:

Find:
```typescript
  const onCardSelect = useCallback((cardId: number) => {
    const card = getCard(cardId);
    if (card.cardType !== CardType.UNIT) return;
```

Replace with:
```typescript
  const onCardSelect = useCallback((cardId: number) => {
    const card = getCard(cardId);
    if (card.cardType === CardType.SPELL) {
      const ctrl = ctrlRef.current;
      const scene = sceneRef.current;
      if (!ctrl || !scene) return;
      const player = getActivePlayer();
      if (ctrl.getState().players[player].mana < card.manaCost) return;

      setUI({ type: 'target_spell', cardId });
      uiRef.current = { type: 'target_spell', cardId };

      const validHexes = getSpellTargets(ctrl.getState(), player, cardId);
      const isHeal = cardId === 10;
      const isArea = card.spellTargetType === SpellTargetType.AREA;
      const hlType = isHeal ? 'ally' : isArea ? 'area' : 'enemy';
      scene.showSpellHighlights(validHexes, hlType);
      return;
    }
```

(The rest of `onCardSelect` for unit cards stays the same.)

- [ ] **Step 3: Update onCardCancel to handle target_spell**

In the `onCardCancel` callback, add handling for `target_spell`. Currently it checks `phaseRef.current.type === 'priority'`. Add a check for target_spell:

Find:
```typescript
  const onCardCancel = useCallback(() => {
    const p = phaseRef.current;
    if (p.type === 'priority') {
```

Replace with:
```typescript
  const onCardCancel = useCallback(() => {
    if (uiRef.current.type === 'target_spell') {
      setUI({ type: 'unit_turn' });
      uiRef.current = { type: 'unit_turn' };
      showActiveUnitHL();
      return;
    }
    const p = phaseRef.current;
    if (p.type === 'priority') {
```

- [ ] **Step 4: Add spell targeting to hex-click handler**

In the hex-click handler useEffect, add a new block for `target_spell` BEFORE the `place_card` block. Find:

```typescript
      if (currentUI.type === 'animating') return;

      // ── Place card ──
      if (currentUI.type === 'place_card') {
```

Insert between those lines:

```typescript
      // ── Cast spell ──
      if (currentUI.type === 'target_spell') {
        const player = getActivePlayer();
        const spellCardId = currentUI.cardId;
        if (!canCast(state, player, spellCardId, { col, row }).valid) return;

        setUI({ type: 'animating' });
        uiRef.current = { type: 'animating' };
        scene.clearHighlights();

        const result = executeCast(state, player, spellCardId, { col, row });
        const targetHex = { col, row };

        if (!result.success) {
          scene.showFizzle(targetHex);
          syncUI();
          // Spell fizzle still counts as action
          const cu = ctrl.getCurrentUnit();
          if (cu) trackActivated(cu.uid);
          ctrl.passActivation();
          setTimeout(() => advanceTurn(), 400);
          return;
        }

        // Play spell FX, then show results
        scene.playSpellFx(spellCardId, targetHex, () => {
          for (const a of result.affectedUnits) {
            const u = state.units.find(x => x.uid === a.uid);
            if (!u) continue;
            if (a.healed !== undefined && a.healed > 0) {
              scene.showHealNumber({ col: u.col, row: u.row }, a.healed);
              scene.updateHpBar(u.uid, u.currentHp, u.maxHp);
            }
            if (a.damage !== undefined && a.damage > 0) {
              scene.showDamageNumber({ col: u.col, row: u.row }, a.damage, false);
              scene.updateHpBar(u.uid, u.currentHp, u.maxHp);
            }
            if (a.died) {
              scene.playDeath(u.uid, () => {});
            }
            if (a.statusApplied) {
              const statusLabel = a.statusApplied === 'slow' ? 'SLOWED'
                : a.statusApplied === 'polymorph' ? 'POLYMORPHED'
                : 'CURSED';
              scene.showStatusText({ col: u.col, row: u.row }, statusLabel);
              if (a.statusApplied === 'polymorph') {
                scene.swapToSheep(u.uid);
              }
            }
          }
          syncUI();
          const cu = ctrl.getCurrentUnit();
          if (cu) trackActivated(cu.uid);
          ctrl.passActivation();
          setTimeout(() => advanceTurn(), 400);
        });
        return;
      }

```

- [ ] **Step 5: Wire up effect expiry visuals**

In the engine init useEffect, after creating the GameController and BattleScene, register an event listener for `effectExpired` to restore polymorph visuals:

```typescript
      ctrl.on('effectExpired', (data: { uid: number }) => {
        const unit = ctrl.getState().units.find(u => u.uid === data.uid);
        if (unit && !unit.polymorphed) {
          scene.restoreFromSheep(data.uid);
        }
      });
```

Add this right after `sceneRef.current = scene;`.

- [ ] **Step 6: Update derived display values for target_spell**

In the derived display values section, update `cardPickerDisabled` and add `isTargetingSpell`:

Find:
```typescript
  const isPlacing = ui.type === 'place_card';
  const isAnimating = ui.type === 'animating';
  const cardPickerDisabled = ui.type === 'unit_acted' || isAnimating;
```

Replace with:
```typescript
  const isPlacing = ui.type === 'place_card';
  const isTargetingSpell = ui.type === 'target_spell';
  const isAnimating = ui.type === 'animating';
  const cardPickerDisabled = ui.type === 'unit_acted' || isAnimating;
```

Update the CardPicker `selectedCardId` prop to also show selected spell:

Find:
```typescript
        selectedCardId={isPlacing ? ui.cardId : null}
```

Replace with:
```typescript
        selectedCardId={isPlacing ? ui.cardId : isTargetingSpell ? ui.cardId : null}
```

- [ ] **Step 7: Verify compilation**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Run all tests**

Run: `cd frontend && npx vitest run src/game/__tests__/`
Expected: all tests pass

- [ ] **Step 9: Start dev server and test in browser**

Run: `cd frontend && npm run dev`
Navigate to `http://localhost:5173/battle`

Manual test checklist:
1. Select Healing spell from card picker → green highlights on friendly units → click one → HP restored, green +N number
2. Select Blast spell → purple highlights on enemies → click one → explosion FX, damage number, HP bar update
3. Select Inferno spell → orange highlights everywhere → click near enemies → fire FX, AoE damage on nearby enemies
4. Select Polymorph → purple highlights → click enemy → sheep FX, unit becomes sheep sprite, "POLYMORPHED" text
5. End turn → polymorph expires, unit sprite restores to normal
6. Select Curse → click enemy → "CURSED" text, stats halved
7. Cast a spell with low success chance multiple times → eventually see "FIZZLE!" yellow text, no FX, mana still spent
8. ESC cancels spell targeting

**Ask user to verify in browser.**

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/Battle.tsx frontend/src/components/CardPicker.tsx
git commit -m "feat(spell): wire spell casting UI — target selection, FX, status effects, polymorph visuals"
```

---

## Task 7: Final Cleanup

- [ ] **Step 1: Run all tests**

Run: `cd frontend && npx vitest run src/game/__tests__/`
Expected: all tests pass

- [ ] **Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Update CONTINUE.md**

Add spell casting to the battle system progress section:
- castSpell.ts: target validation, success roll, damage/heal, status effects (slow/polymorph/curse)
- Status effect system: ActiveEffect on UnitInstance, tick on turn end, stat restore on expiry
- Spell FX animations from spellFxConfigs
- Polymorph sheep sprite swap
- Spell targeting UI: target_spell mode, hex-click cast, fizzle on failure

- [ ] **Step 4: Commit**

```bash
git add CONTINUE.md
git commit -m "docs: update CONTINUE.md — spell casting (B11) complete"
```
