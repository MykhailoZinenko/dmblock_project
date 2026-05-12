# Spell Casting UI (B11) — Design Spec

**Date:** 2026-05-12
**Goal:** Wire up spell cards in the battle system — cast from card picker, target selection via hex click, spell FX animations, success/fail roll, status effects with duration, mana deduction.

**Scope:** Base stats only (no hero trait scaling). Full duration/status effect system. No deck/hand/graveyard recycling (debug card picker shows all cards).

---

## 1. Game Logic — `castSpell.ts`

New file: `frontend/src/game/actions/castSpell.ts`

### `getSpellTargets(state, playerId, cardId) → HexCoord[]`

Returns valid target hexes based on SpellTargetType:
- `SINGLE` + damage/status spell (Blast, Storm, Surge, Polymorph, Curse): hexes occupied by alive enemy units
- `SINGLE` + heal spell (Healing): hexes occupied by alive friendly units
- `AREA` (Inferno): all board hexes (player picks center point; effect hits all enemies within 1-hex radius)
- `ALL_ENEMIES` / `ALL_ALLIES`: no target selection needed — affects all matching units. Return empty (auto-target).
- `HERO`: not implemented this pass

Healing is identified by cardId 10 (the only ally-target single spell). All other SINGLE spells target enemies.

### `canCast(state, playerId, cardId, targetHex) → { valid, reason? }`

Validates:
- Card is a spell (cardType === SPELL)
- Player has enough mana (mana >= manaCost)
- targetHex is in `getSpellTargets()` result (or null for ALL_* target types)

### `executeCast(state, playerId, cardId, targetHex, rng) → CastResult`

```typescript
interface CastResult {
  success: boolean;
  affectedUnits: {
    uid: number;
    damage?: number;
    healed?: number;
    statusApplied?: 'slow' | 'polymorph' | 'curse';
    died?: boolean;
  }[];
}
```

Execution flow:
1. Deduct manaCost from player's mana
2. Roll `rng.rollPercent(card.successChance)` — if false, return `{ success: false, affectedUnits: [] }`
3. If success, resolve effect by cardId:
   - **Healing (10)**: restore `spellPower` HP to target unit (cap at maxHp)
   - **Blast (11)**: deal `spellPower` magic damage to target unit (uses `applyDamage`)
   - **Storm (12)**: deal `spellPower` magic damage + apply Slow status for `duration` turns
   - **Surge (13)**: deal `spellPower` magic damage + apply Slow status for `duration` turns
   - **Inferno (14)**: deal `spellPower` magic damage to ALL enemy units within 1-hex radius of targetHex (uses `hexDistance`)
   - **Polymorph (15)**: apply Polymorph status for `duration` turns — set polymorphed=true, save+replace stats (atk=0, def=0, speed=1)
   - **Curse (16)**: apply Curse status for `duration` turns — set cursed=true, save+halve attack and defense
4. Return `CastResult` with all affected units and what happened

Magic damage from spells follows the same formula as combat: `max(1, spellPower - target.defense)` with MR reduction. Buildings have 100% MR so take 0 from spells (except Inferno faction → physical conversion).

---

## 2. Status Effect System

### New type: `ActiveEffect`

```typescript
interface ActiveEffect {
  cardId: number;
  type: 'slow' | 'polymorph' | 'curse';
  turnsRemaining: number;
  originalStats?: { attack: number; defense: number; speed: number };
}
```

### Changes to `UnitInstance`

Add field: `activeEffects: ActiveEffect[]` (initialized to `[]` on spawn).

### Status effects

**Slow** (Storm, Surge):
- On apply: `unit.speed = max(1, unit.speed - 1)`
- On expire: `unit.speed = originalStats.speed`

**Polymorph** (Polymorph):
- On apply: save `{ attack, defense, speed }`, set `attack=0, defense=0, speed=1, polymorphed=true`
- On expire: restore saved stats, `polymorphed=false`
- Visual: BattleScene swaps sprite to sheep (from `sheepSpriteConfig`)

**Curse** (Curse):
- On apply: save `{ attack, defense, speed }`, set `attack = floor(attack/2), defense = floor(defense/2), cursed=true`
- On expire: restore saved stats, `cursed=false`

### Turn-end tick

In `GameController.endTurn()`, after resetting AP:
1. For each alive unit with `activeEffects`:
2. Decrement `turnsRemaining` for each effect
3. If `turnsRemaining <= 0`: remove effect, restore `originalStats`, clear flags
4. Emit `'effectExpired'` event

---

## 3. UI Flow

### New UIMode: `target_spell`

```typescript
| { type: 'target_spell'; cardId: number }
```

### Flow

1. Player selects a spell card from card picker → `onCardSelect` detects `cardType === SPELL`
2. UI enters `target_spell` mode
3. BattleScene highlights valid target hexes:
   - Purple (`0x9b59b6`) for enemy-target spells
   - Green (`0x2ecc71`) for ally-target spells (Healing)
   - Orange (`0xe67e22`) for AoE center selection (Inferno)
4. Player clicks a highlighted hex → `executeCast()` runs
5. Results:
   - **Success**: play spell FX animation on target hex, show damage/heal numbers on affected units, update HP bars
   - **Fail**: show "FIZZLE!" floating text (yellow) at target hex, no FX
6. Casting counts as the active unit's action → `passActivation()` → `advanceTurn()`
7. ESC cancels targeting, returns to `unit_turn`

### CardPicker change

Currently `onCardSelect` rejects spells (`if (card.cardType !== CardType.UNIT) return`). Remove that check — allow spell selection, route to targeting flow.

---

## 4. BattleScene Additions

### `playSpellFx(cardId, targetHex, onDone)`

1. Look up `spellFxConfigs[cardId]`
2. Load texture, create AnimatedSprite from strip
3. Position at target hex center
4. Play once (loop=false), call `onDone` on complete
5. Remove sprite after

### `showHealNumber(hex, amount)`

Same as `showDamageNumber` but green (`0x2ecc71`) text, shows `+{amount}`.

### `showStatusText(hex, text)`

Floating text for status application ("SLOWED", "POLYMORPHED", "CURSED") in purple.

### `showFizzle(hex)`

Floating "FIZZLE!" text in yellow (`0xf1c40f`).

### Polymorph sprite swap

When polymorph is applied, call `AnimationController` method to swap sprite to sheep idle. On expire, swap back to original idle. Add `swapToSheep()` and `restoreFromSheep()` methods to AnimationController.

---

## 5. Highlight Method

### `showSpellHighlights(validHexes, highlightType: 'enemy' | 'ally' | 'area')`

New BattleScene method. Uses:
- Purple for enemy targets
- Green for ally targets
- Orange for AoE center

---

## 6. Files Changed

### New Files
- `frontend/src/game/actions/castSpell.ts` — spell casting logic, target validation, effect resolution
- `frontend/src/game/__tests__/castSpell.test.ts` — spell casting tests

### Modified Files
- `frontend/src/game/types.ts` — add `ActiveEffect` interface, add `activeEffects` to `UnitInstance`
- `frontend/src/game/actions/spawnUnit.ts` — initialize `activeEffects: []` on spawn
- `frontend/src/game/GameController.ts` — tick status effects on `endTurn()`
- `frontend/src/game/BattleScene.ts` — add `playSpellFx()`, `showHealNumber()`, `showStatusText()`, `showFizzle()`, `showSpellHighlights()`, polymorph sprite swap
- `frontend/src/game/AnimationController.ts` — add `swapToSheep()`, `restoreFromSheep()`
- `frontend/src/pages/Battle.tsx` — add `target_spell` UI mode, spell targeting hex-click handling, wire spell cast flow
- `frontend/src/components/CardPicker.tsx` — allow spell card selection

---

## 7. Out of Scope

- Hero trait scaling (Wisdom, Arcane Mastery, hero.spellPower multiplier)
- Deck/hand/graveyard recycling (debug mode shows all cards)
- Hero targeting (SpellTargetType.HERO)
- ALL_ENEMIES / ALL_ALLIES auto-targeting (no current spells use these)
- Sound effects
