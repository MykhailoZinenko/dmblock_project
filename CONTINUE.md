# Arcana Arena — Session State

## Current Phase: Battle System (B1–B12 in progress)

## Battle System Progress

### Game Logic Complete (319 tests, >99% coverage)
- **types.ts** — CardDefinition, UnitInstance, PlayerState, BoardCell, DamageType, AbilityDefinition, TerrainEffect
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
- **attackUnit.ts** — Melee (adjacent, retaliation) + Ranged (enemy half ×0.5, melee block ×0.5, ammo, Marksman bypass)
- **spriteConfig.ts** — Animation definitions for all 20 cards + FX + polymorph sheep

### Battle UI (Battle.tsx) — Functional but buggy
- 15×11 hex grid, deploy zones, card picker, initiative queue display
- Priority turn system (zero-unit players get 1 free spawn)
- Unit spawning, movement (green highlights), attack (red highlights)
- Floating damage numbers, death sprite removal

### Known Bugs — Fix First
1. **Movement animation** — jumps cell-to-cell, not smooth continuous path
2. **Damage values** — feel wrong, verify against GDD formulas
3. **No run/attack/death animations** — only idle plays, animation state machine not wired
4. **Sprite sizing inconsistencies**

### Not Yet Wired to UI
- Spell casting (logic exists in plan, UI not connected)
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
- Factions replace spell schools (Castle/Inferno/Necropolis/Dungeon)
- Barracks + Monastery size 2×2
- Inferno units deal magic damage → converts to physical vs buildings
- Mine Mode rework: 2 decoys + real (not invisibility)
- HeroTypes.sol: 17 traits (removed tactical, added faction magic 10-13)
- Priority spawn: 1 per player per global turn, spawned units enter queue next turn
- GameController.passActivation doesn't auto-endTurn — Battle.tsx drives via isQueueExhausted()
- Spells don't count as persistent units (not tracked in spawnedThisTurn)
- Passive abilities activate on spawn immediately

## Architecture
- `frontend/src/game/` — pure TS logic, deterministic, no rendering
- `frontend/src/pages/Battle.tsx` — React bridge to WebGPU engine
- `frontend/src/engine/` — WebGPU primitives (untouched)
- Battle.tsx drives turn flow: advanceTurn() → priority → initiative → endTurn

## Plan File
`docs/superpowers/plans/2026-05-12-battle-system.md`

## Commands
```bash
cd contracts && forge test                              # 130 tests
cd frontend && npm run dev                              # localhost:5173/battle
cd frontend && npx vitest run src/game/__tests__/       # 319 tests
```
