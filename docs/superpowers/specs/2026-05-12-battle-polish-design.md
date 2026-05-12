# Battle System Polish — Design Spec

**Date:** 2026-05-12
**Goal:** Make the existing battle system work perfectly — proper animations, smooth movement, click-to-attack auto-walk, auto-end turns, in-engine HP bars, and a cohesive HUD using the Arcana UI component library.

**Scope:** UI/rendering/interaction polish only. No new game mechanics, no abilities, no spells, no hero barrier. Pure quality-of-life fixes to the existing B1-B10 implementation.

---

## Architecture

Refactor the 640-line `Battle.tsx` monolith into a layered architecture:

| File | Responsibility |
|---|---|
| `BattleScene.ts` | Engine-side sprite lifecycle, animation, tweens, HP bars. No React, no game logic. |
| `AnimationController.ts` | Per-unit animation state machine. Texture loading, state transitions, direction picking. |
| `Battle.tsx` | React page. Arcana HUD overlay, card picker bridge, input→game logic→scene calls. |

**Why split?** The animation state machine alone (run during move, directional attack, death+fade) adds ~200 lines of async texture loading and sequencing. Cramming that into Battle.tsx would make it unmaintainable. BattleScene owns all engine objects; Battle.tsx owns all React state. They communicate through a clean interface.

### BattleScene API

```typescript
class BattleScene {
  constructor(engine: Engine)

  // Lifecycle
  createGrid(): void
  destroy(): void

  // Units
  spawnUnit(unit: UnitInstance): Promise<void>
  moveUnit(uid: number, path: HexCoord[], onDone: () => void): void
  playAttack(uid: number, targetHex: HexCoord, onDone: () => void): void
  playDeath(uid: number, onDone: () => void): void
  removeUnit(uid: number): void
  updateHpBar(uid: number, currentHp: number, maxHp: number): void

  // Highlights
  clearHighlights(): void
  showDeployHighlights(cardId: number, player: number, validHexes: HexCoord[]): void
  showMoveHighlights(unitHex: HexCoord, reachable: HexCoord[], attackable: AttackableTarget[]): void

  // Feedback
  showDamageNumber(hex: HexCoord, damage: number, isCrit: boolean): void
}
```

### AnimationController API

```typescript
class AnimationController {
  constructor(engine: Engine, cardId: number, playerId: number)

  // Returns the Container with the sprite inside
  getContainer(): Container

  // State transitions (async — load textures on demand, cached after first load)
  playIdle(): Promise<void>
  playRun(): Promise<void>
  playAttack(direction: AttackDirection): Promise<void>  // resolves when anim completes
  playDeath(): Promise<void>  // resolves when anim completes
  fadeTo(alpha: number, durationSec: number): Promise<void>

  // Cleanup
  destroy(): void
}

type AttackDirection = 'top' | 'topright' | 'side' | 'bottomright' | 'bottom';
```

---

## 1. Animation State Machine

### States and Transitions

```
spawn → idle (loop)
idle → run (on move start, loop)
run → idle (on move end)
idle → attack_* (on attack, play once)
attack_* → idle (on anim complete)
* → death (on unit killed, play once)
death → fade → remove
```

### Direction Picking for Attacks

Calculate angle from attacker hex center to target hex center:
- `> 60°` → `top`
- `30° to 60°` → `topright`
- `-30° to 30°` → `side`
- `-60° to -30°` → `bottomright`
- `< -60°` → `bottom`

Fallback chain when a direction anim doesn't exist:
1. Exact direction (e.g. `attack_topright`)
2. `attack_side`
3. `attackFallback` from spriteConfig (e.g. Peasant uses `interact`)
4. Stay on `idle` (last resort)

For P2 units (right side, facing left): use `flipForLeft` flag from AnimDefinition. Flip the sprite's scale.x negative.

### Texture Caching

Each animation is loaded once per `(cardId, animState)` key. The AnimationController holds a `Map<AnimState, Texture[]>` that persists for the unit's lifetime. BattleScene additionally maintains a global `Map<string, Texture>` for base texture files to avoid re-fetching from the engine's texture manager.

### Death Animation

1. If spriteConfig has `death` or `exploding` anim for this cardId: play it (loop=false)
2. On complete (or immediately if no death anim): fade alpha from 1→0 over 0.5s
3. After fade: remove Container from scene, delete from sprite map
4. HP bar fades along with the sprite (it's a child of the same Container)

---

## 2. Smooth Movement

### Current Problem

`animateMove()` does step-by-step 0.2s tweens per cell with easeOut per hop. This creates visible pauses at each cell boundary.

### Solution

One continuous movement along the full path:
- Compute total path pixel length
- Move at constant speed: `300 px/sec` (tunable constant)
- On each engine tick, advance the unit's position along the path by `speed * dt`
- Interpolate between path waypoints (hex centers) linearly
- Run animation plays during entire movement
- Idle animation resumes on arrival

### Implementation

```typescript
moveUnit(uid: number, path: HexCoord[], onDone: () => void): void {
  // 1. Switch to run anim
  // 2. Build pixel waypoint array from path
  // 3. Compute total distance
  // 4. Add ticker callback that:
  //    - Advances distance traveled by speed * dt
  //    - Finds current segment, lerps position
  //    - On reaching end: switch to idle, call onDone
}
```

Speed constant: `UNIT_MOVE_SPEED = 300` (pixels per second). At HEX_SIZE=48, that's ~6 hexes/sec — fast enough to feel responsive, slow enough to see the path.

---

## 3. Click-to-Attack with Auto-Walk

### Melee Units

When a melee unit is active and the player clicks on an enemy unit:

1. **Find all valid approach hexes:** hexes adjacent to the target that are reachable by the attacker within `remainingAp - 1` (need 1 AP reserved for the attack itself)
2. **Pick best hex by cursor proximity:** among valid approach hexes, choose the one whose pixel center is closest to the click position. This gives the player directional control — clicking the left side of an enemy approaches from the left
3. **Execute combined action:**
   - Auto-path to chosen hex (deduct movement AP)
   - Play movement animation along path
   - On arrival: play attack animation (direction based on attacker→target angle)
   - Execute attack (deduct 1 AP, which sets remainingAp to 0 since attack ends activation)
   - Show damage number, handle retaliation, handle death
4. **If already adjacent:** skip movement, just attack from current position

### Ranged Units

Clicking an enemy with a ranged unit (ammo > 0):
- No movement needed — ranged can hit any enemy
- Play `shoot` anim on attacker
- Animate arrow projectile from attacker hex to target hex (arrow sprite from `arrowProjectile` config, ~400px/sec)
- On projectile arrival: apply damage, show damage number
- Consume 1 AP (attack ends activation → remainingAp = 0)

### Highlight Changes

When a unit is active, show three highlight colors:
- **Green hexes:** reachable movement destinations (existing)
- **Red hexes:** cells of enemies that are directly attackable from current position (existing)
- **Orange hexes:** cells of enemies that are attackable via auto-walk (reachable adjacent hex exists within AP budget). These are enemies you can click to auto-path+attack

### New Game Logic Function

```typescript
// Located in attackUnit.ts — pure game logic, no engine dependency
function getAutoWalkHex(
  state: GameState,
  attackerUid: number,
  targetUid: number,
  cursorWorldPos: { x: number; y: number }
): HexCoord | null
```

Returns the best adjacent-to-target hex that the attacker can reach with `remainingAp - 1`, choosing the one closest to cursor position. Returns null if no valid hex exists. Uses `hex2px` to convert candidate hexes to pixel coords for distance comparison — this is pure math, no engine dependency. Battle.tsx passes `cursorWorldPos` from the pointerdown event (already converted to world space via `camera.screenToWorld`).

---

## 4. AP Model Corrections

### Rules (per GDD + user clarification)

- **Move:** 1 AP per hex traversed
- **Attack:** costs 1 AP, limited to 1 per activation, ends activation immediately
- After attack: `remainingAp = 0` (attack ends all further action)
- A speed-3 unit can: move 3 (no attack), move 2 + attack, move 1 + attack, or attack if adjacent

### Code Changes

`attackUnit.ts` line 167: `attacker.remainingAp = 0` — this is already correct since attack ends activation.

The `canAttack` check `remainingAp > 0` (line 83) is correct — need at least 1 AP to attack.

No changes needed to the core attack/move logic. The change is in the UI layer:
- Auto-walk validation: `remainingAp >= pathLength + 1` (movement cost + attack cost)
- Highlight calculation: show orange on enemies where at least one adjacent hex is reachable within `remainingAp - 1`

### Auto-End Activation

After every action (move or attack), check:
- If `remainingAp === 0`: auto-advance to next unit after 0.4s delay
- The delay lets the player see the result of their action before the turn moves on
- No manual "End Turn" button needed when AP is exhausted

If a unit has AP remaining but no valid moves AND no valid attacks (completely stuck), show a subtle prompt but don't auto-end — let the player pass manually.

---

## 5. HP Bars (In-Engine)

### Rendering

Each unit's Container gets an HP bar as a child Graphics node:

- **Size:** 36px wide × 4px tall, centered horizontally under the sprite
- **Position:** below the sprite anchor, above the name label (y offset ~`HEX_SIZE * 0.5`)
- **Background:** dark semi-transparent rect (`0x000000`, alpha 0.5)
- **Fill:** colored rect proportional to `currentHp / maxHp`
- **Colors:** green `0x2ecc71` (>50%), yellow `0xf1c40f` (25-50%), red `0xe74c3c` (<25%)

### Updates

`updateHpBar(uid, currentHp, maxHp)` redraws the fill rect whenever HP changes. Called after every damage/heal event.

The bar is a child of the unit Container, so it:
- Moves with the unit during movement animation
- Fades with the unit during death
- Gets removed when the unit is removed

---

## 6. Battle HUD Redesign

Replace all inline-styled HTML divs with Arcana UI components and design tokens.

### Layout

```
+--[ArcanaPanel slate]--full width top bar------------------+
|  Turn 3  |  P1's Turn — Knight  |  [mana P1] [mana P2]   |
+-----------------------------------------------------------+
|                                                    [wood] |
|                                                    Init   |
|              GAME CANVAS                           Queue  |
|                                                    Panel  |
|                                                           |
|                                                           |
|         [ArcanaButton] Pass    End Turn                    |
+---[Card Picker — existing design]-------------------------+
```

### Top Bar

`ArcanaPanel variant="slate"` fixed at top, full width, ~50px tall:
- Left: Turn number, active unit status
- Right: Both players' mana as `ArcanaBar color="blue"` (small, inline)
- Uses `--font-display`, `--color-text`, `--color-gold` for active indicators

### Initiative Sidebar

`ArcanaPanel variant="wood"` fixed right side, below top bar:
- Vertical list of queued units
- Active unit highlighted with `--color-gold` background
- Each entry shows: player color dot + unit name
- Scrollable if queue is long

### Action Buttons

`ArcanaButton` components positioned above the card picker:
- `variant="blue"` for Pass
- `variant="red"` for End Turn (only shown when unit has acted but still has AP)
- Centered horizontally, spaced with `--space-3`
- Hidden entirely when AP is 0 (auto-end handles it)

### Card Picker

Keep existing CardPicker component (already well-styled). Changes:
- Smooth opacity transition when disabled (`--duration-normal`)
- Uses `--opacity-disabled` token

---

## 7. Sprite Sizing

### Current Problem

Sprites have inconsistent sizing because each unit type has different frame dimensions (128×128, 192×192, 320×320) and the scale calculation varies between unit types and buildings.

### Solution

Normalize all sprites to fit within a consistent bounding box relative to HEX_SIZE:

- **Units:** target height = `HEX_SIZE * 1.6` (≈77px). Scale = `targetHeight / frameHeight`
- **Buildings (size 1):** target height = `HEX_SIZE * 2.0` (≈96px)
- **Buildings (size 2):** target height = `HEX_SIZE * 2.8` (≈134px)
- Anchor: units at `(0.5, 0.75)`, buildings at `(0.5, 0.85)`
- P2 units: negate scale.x for flip

This replaces the current per-type `HEX_SIZE * 1.8 / anim.frameHeight` and `HEX_SIZE * 2.5 / Math.max(...)` formulas with consistent ratios.

---

## 8. Files Changed

### New Files
- `frontend/src/game/BattleScene.ts` — engine sprite/animation manager
- `frontend/src/game/AnimationController.ts` — per-unit animation state machine

### Modified Files
- `frontend/src/pages/Battle.tsx` — slim down to React HUD + input bridge
- `frontend/src/game/actions/attackUnit.ts` — add `getAutoWalkHex()` function
- `frontend/src/game/actions/moveUnit.ts` — no changes needed (AP model is correct)
- `frontend/src/game/constants.ts` — add `UNIT_MOVE_SPEED = 300`
- `frontend/src/components/CardPicker.tsx` — minor: use design tokens for disabled state

### Unchanged
- All game logic files (combat.ts, GameController.ts, initiative.ts, etc.) — AP/damage formulas are correct
- spriteConfig.ts — animation definitions are complete
- Engine files — consumed as-is

---

## 9. Testing Strategy

### Manual Testing (primary)
- Spawn units for both players, verify idle animation plays correctly
- Move a unit: verify run animation during movement, smooth continuous path, idle on arrival
- Melee attack adjacent enemy: verify attack direction anim, damage number, retaliation
- Click distant enemy with melee unit: verify auto-walk + attack sequence
- Kill a unit: verify death animation → fade → removal
- Verify HP bars update on damage, color changes at thresholds
- Verify auto-end when AP exhausted
- Verify HUD renders with Arcana components, matches game visual style
- Test ranged attack: shoot anim, arrow projectile, damage at distance

### Unit Tests (existing)
- 319 existing tests continue passing (game logic unchanged)
- No new unit tests needed — changes are rendering/UI only

---

## 10. Out of Scope

- Spell casting UI (B11)
- Hero barrier + win condition (B12)
- Activation timer + timeout damage (B13)
- Ability system (B15-B25)
- Multiplayer / state channel
- Sound effects
- Hero stat modifiers (effectiveAttack formula)
