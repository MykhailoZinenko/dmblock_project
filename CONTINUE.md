# Arcana Arena — Session State

## Current Phase: Battle System (B1–B12 in progress)

## Battle System Progress

### Game Logic Complete (339 tests, >99% coverage)
- **types.ts** — CardDefinition, UnitInstance, PlayerState, BoardCell, DamageType, AbilityDefinition
- **cardRegistry.ts** — 20 cards: stats, abilities, damageType, powerMultiplier, spriteKeys, fxKeys
- **hexUtils.ts** — Pointy-top odd-r: hex2px, px2hex, distance, neighbors, rings, direction
- **pathfinding.ts** — BFS findReachable + findPath with obstacle blocking
- **rng.ts** — Seeded PRNG (mulberry32), serialize/restore
- **stateHash.ts** — Canonical JSON + FNV-1a hashing
- **GameState.ts** — State shape + createGameState
- **initiative.ts** — Sort by initiative → speed → seeded random
- **GameController.ts** — Turn lifecycle, events, passActivation, endTurn, isQueueExhausted
- **spawnUnit.ts** — Deploy zone validation, 2×2 buildings, Peasant unarmed 20%
- **moveUnit.ts** — Reachable hexes, AP cost, board updates
- **combat.ts** — Damage formula (atk-def, MR, Inferno bypass buildings, crit)
- **attackUnit.ts** — Melee (adjacent, retaliation) + Ranged (enemy half ×0.5, melee block ×0.5, ammo, Marksman bypass) + **getAutoWalkHex/getAutoWalkTargets** for click-to-attack
- **castSpell.ts** — Spell targeting, success roll, damage/heal, status effects (slow/polymorph/curse), AoE, tickStatusEffects
- **spriteConfig.ts** — Animation definitions for all 20 cards + FX + polymorph sheep

### Battle Rendering (New Architecture)
- **AnimationController.ts** — Per-unit animation state machine: idle/run/attack/death transitions, texture caching, direction picking, fade
- **BattleScene.ts** — Engine-side manager: grid, unit sprites, HP bars, highlights, smooth movement, damage/heal numbers, projectile, death animation, spell FX, polymorph sheep swap
- **Battle.tsx** — React HUD (Arcana components) + input bridge, click-to-attack, spell targeting, auto-end activation

### Battle UI Features
- 15×11 hex grid with deploy zones
- Card picker (hand-styled cards with faction/rarity/stats)
- Arcana HUD: slate top bar (turn/status/mana bars), wood initiative sidebar, styled action buttons
- Priority turn system (zero-unit players get 1 free spawn)
- Unit spawning with idle animation + HP bar
- Smooth continuous movement (run animation, 300px/sec)
- Click-to-attack: melee auto-walk to nearest adjacent hex (cursor-directed), ranged shoot + projectile
- Directional attack animations (top/topright/side/bottomright/bottom with fallback chain)
- Death animation → fade out → removal
- Floating damage numbers (with crit display)
- Auto-end activation when AP exhausted (0.4s delay)
- HP bars with color coding (green > yellow > red)
- Spell casting: 7 spells (Healing, Blast, Storm, Surge, Inferno, Polymorph, Curse)
- Spell target selection via hex highlights (purple enemies, green allies, orange AoE)
- Spell FX animations from spellFxConfigs
- Success/fail roll with "FIZZLE!" on failure (mana still spent)
- Status effects: Slow (speed -1), Polymorph (sheep sprite, stats zeroed), Curse (stats halved)
- Status effects tick down on turn end, auto-expire and restore original stats
- Floating heal numbers (green +N), status text (purple)

### Not Yet Wired to UI
- Hero barrier + win condition
- Activation timer + timeout damage
- Abilities (B15–B25)

## Completed Phases (Pre-Battle)
- Phase 0 ✓ — Scaffolding
- Phase 1 ✓ — CardNFT + GameConfig + SVG (deployed Base Sepolia)
- Phase 2 ✓ — HeroNFT + Starter Deck (local)
- Phase 3 ✓ — Frontend (Wallet, Collection, Hero)
- Phase 4 ✓ — Marketplace (local)
- Phase 5 ✓ — Deck Builder (local)
- Phase 6 ✓ — Pack Opening + VRF (local)
- Phase 7 ✓ — DuelManager + FreedomRecord contracts

## Key Decisions This Session
- Battle.tsx refactored from 640-line monolith into 3 layers: AnimationController + BattleScene + Battle.tsx
- Attack costs 1 AP, ends activation (move freely + 1 attack, attack ends all movement)
- Click-to-attack auto-walk: cursor position determines approach direction (nearest adjacent hex to click)
- Damage formula (atk-def, min 1) kept per GDD — hero attack multiplier will scale effective attack later
- Arcana UI components (ArcanaPanel, ArcanaButton, ArcanaBar) used for battle HUD
- Sprite sizing normalized: UNIT_TARGET_HEIGHT = HEX_SIZE * 1.6, buildings 2.0/2.8

## Architecture
- `frontend/src/game/` — pure TS logic, deterministic, no rendering
- `frontend/src/game/AnimationController.ts` — per-unit sprite animation state machine
- `frontend/src/game/BattleScene.ts` — engine-side scene manager
- `frontend/src/pages/Battle.tsx` — React HUD bridge + input handling
- `frontend/src/engine/` — WebGPU primitives (untouched)
- Battle.tsx drives turn flow: advanceTurn() → priority → initiative → endTurn

## Plan Files
- `docs/superpowers/specs/2026-05-12-battle-polish-design.md`
- `docs/superpowers/plans/2026-05-12-battle-polish.md`

## Commands
```bash
cd contracts && forge test                              # 130 tests
cd frontend && npm run dev                              # localhost:5173/battle
cd frontend && npx vitest run src/game/__tests__/       # 339 tests
```
