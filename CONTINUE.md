# Arcana Arena — Session State

**Last updated:** 2026-05-12

## Current Phase: Battle System (B1–B12 in progress)

## Battle System Progress

### Game Logic Complete (339 tests)
- **types.ts** — CardDefinition, UnitInstance (with ActiveEffect[]), PlayerState, BoardCell, DamageType
- **cardRegistry.ts** — 20 cards: stats, abilities, damageType, powerMultiplier, spriteKeys, fxKeys
- **hexUtils.ts** — Pointy-top odd-r: hex2px, px2hex, distance, neighbors, rings, direction
- **pathfinding.ts** — BFS findReachable + findPath with obstacle blocking
- **rng.ts** — Seeded PRNG (mulberry32), serialize/restore
- **stateHash.ts** — Canonical JSON + FNV-1a hashing
- **GameState.ts** — State shape + createGameState
- **initiative.ts** — Sort by initiative → speed → seeded random
- **GameController.ts** — Turn lifecycle, events, passActivation (skips dead units), endTurn (ticks effects → mana → AP reset → queue), effectExpired event
- **spawnUnit.ts** — Deploy zone validation, 2×2 buildings, Peasant unarmed 20%
- **moveUnit.ts** — Reachable hexes, AP cost, board updates
- **combat.ts** — Physical: atk-def. Magic: raw atk, reduced by MR only. Inferno bypasses building MR. Crit 10%/1.5×
- **attackUnit.ts** — Melee + Ranged (halved on enemy half / melee blocked). Auto-walk (getAutoWalkHex). Ranged can melee with ×0.5. All units retaliate in melee (ranged ×0.5)
- **castSpell.ts** — 7 spells: Healing, Blast, Storm, Surge, Inferno (AoE), Polymorph, Curse. Success roll, fizzle on fail (mana spent). Status effects: slow/polymorph/curse with activationsLeft tracking. tickUnitEffects on activation end, tickStatusEffects at turn start
- **spriteConfig.ts** — Animation definitions for all 20 cards + FX + polymorph sheep

### Battle Rendering Architecture
- **AnimationController.ts** — Per-unit animation state machine with swappable sprite config (for polymorph). Idle/run/attack(directional)/death/fade. Texture caching per (cardId, state)
- **BattleScene.ts** — Engine-side manager: hex grid, unit sprites + HP bars, highlights (green move, red attack, orange auto-walk, purple/green/orange spell), smooth movement (300px/s), arrow projectile, damage/heal/status floating text, fizzle text, spell FX, polymorph sprite swap, death anim + fade
- **Battle.tsx** — React HUD (Arcana components: slate top bar, wood initiative sidebar, ArcanaButton/ArcanaBar) + input bridge. UI modes: pick_card, place_card, target_spell, unit_turn, unit_acted, animating. Click-to-attack with nearby-hex fallback. Auto-end on 0 AP. Priority phase pass button. Debug +5 mana buttons. Activated unit tracking to prevent re-activation after priority spawn

### Known UI Bugs (Not Yet Fixed)
- Pathfinding: units sometimes take weird paths or go to wrong cell
- Sprite click targeting: anchor offset can cause clicks to miss (partially mitigated with nearby-hex check)
- Various small UI polish issues the user has noticed

### Not Yet Wired to UI
- Hero barrier + win condition (B12)
- Activation timer + timeout damage (B13)
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
- AP model: 1 AP per hex, 1 AP for attack, attack ends activation (move freely + 1 attack)
- Click-to-attack auto-walk: cursor position determines approach direction
- Magic damage bypasses defense — only MR reduces it (both unit attacks and spells)
- Ranged units can melee with ×0.5 damage, retaliate in melee with ×0.5
- Spell duration = N unit activations of the affected unit. Expires at turn start
- Status effects tick at turn start BEFORE AP reset and queue rebuild
- AnimationController uses swappable config for polymorph — no hardcoded sprite checks
- Arcana UI components (ArcanaPanel, ArcanaButton, ArcanaBar) for battle HUD
- Priority phase allows pass (button) and spell casting
- Dead units skipped in activation queue automatically

## Spec/Plan Files
- `docs/superpowers/specs/2026-05-12-battle-polish-design.md`
- `docs/superpowers/specs/2026-05-12-spell-casting-design.md`
- `docs/superpowers/plans/2026-05-12-battle-polish.md`
- `docs/superpowers/plans/2026-05-12-spell-casting.md`

## Commands
```bash
cd contracts && forge test                              # 130 tests
cd frontend && npm run dev                              # localhost:5173/battle
cd frontend && npx vitest run src/game/__tests__/       # 339 tests
```
