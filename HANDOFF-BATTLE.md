# Battle System Handoff — Phases 7-10 Combined

## Read These First
1. `CLAUDE.md` — project rules, architecture, commands
2. `GDD.md` — game design document v3.0 (simplified core)
3. `WORKSTREAM-GAME.md` — scope for phases 7-10
4. `ROADMAP.md` — full roadmap with phase status

---

## What Exists

### Smart Contracts (Solidity, Foundry)
All in `contracts/src/`. 113 tests passing (`cd contracts && forge test`).

- **GameConfig.sol** — upgradeable, stores all 20 card stats (attack, defense, HP, initiative, speed, ammo, manaCost, size, magicResistance), starter deck config, starting traits
- **CardNFT.sol** — ERC-721, batch mint, authorized minters, dynamic tokenURI with on-chain SVG
- **HeroNFT.sol** — ERC-721, hero creation (faction + archetype + ±1 stat variance), level-up with deterministic trait options, starter deck minting
- **DuelManager.sol** — upgradeable, ETH duel creation/acceptance/settlement via dual signatures, ELO tracking (K=32, floor 0, 25-match calibration), 24h expiry
- **FreedomRecord.sol** — immutable freed wallet records per season

**DuelManager has NO frontend yet. No duel lobby, no settlement UI, completely untested in browser.**

### Frontend (React + Vite + TypeScript)
All in `frontend/src/`.

**Pages that exist:**
- `/` — Home (hero summary or create CTA)
- `/create` — Hero creation (faction + archetype picker)
- `/collection` — Card grid with on-chain SVGs
- `/hero` — Hero profile with level-up UI
- `/tests` — Engine unit test runner (21 tests)
- `/tests/visual/*` — 13 visual engine tests as React routes
- `/tests/perf` — Performance benchmarks

**UI component library** (`src/ui/components/`):
ArcanaPanel, ArcanaButton, ArcanaIconButton, ArcanaRibbon, ArcanaTabs, ArcanaAvatar, ArcanaCard, ArcanaBar — all React TS with 9-slice/3-slice canvas rendering, design tokens in `src/styles/tokens.css`

**WebGPU Engine** (`src/engine/`, TypeScript, 29 files):
Full 2D renderer — sprites, animated sprites, graphics (vector drawing), text (MSDF), particles, camera (pan/zoom), interaction (pointer events, hit testing), asset loading. Scene graph with Node hierarchy.

Key capabilities:
- `Engine.create(canvas)` — async factory, initializes WebGPU
- `Sprite` / `AnimatedSprite` — texture rendering with animation frames
- `Graphics` — drawRect, drawCircle, drawPolygon, drawRegularPolygon (hex!)
- `Camera` — pan, zoom, screenToWorld/worldToScreen
- `InteractionManager` — pointer events on nodes
- `SpriteSheet.fromStrip()` — parse animation strip PNGs

**The hex grid battle scene already works** — see `src/pages/tests/Visual13.tsx`. It renders a hex grid with units, selection, movement. This is the starting point for the battle UI.

### Game Assets (`frontend/public/assets/`)
- **Terrain**: `terrain/01-18.png` — hex tile sprites
- **Units by faction**: `units/{blue,red,goblins,yellow,purple}/{archer,warrior,lancer,pawn,monk}_v1/` — idle, run, attack animation strips
- **Buildings**: `buildings/{blue,red,goblins,yellow,purple}/` — tower, castle, barracks, etc.
- **FX**: `fx/` — fire, explosion, dust, water splash
- **UI**: `ui/` — buttons, bars, ribbons, cursors, avatars
- **Fonts**: `fonts/PatrickHand.png` + `.json` (MSDF atlas)
- **Cards**: `cards/00-19.png` — card art PNGs

### 20 Registered Cards
```
UNITS (13):
00 Peasant      Castle  Common  ATK:5  DEF:3  HP:30  INIT:5  SPD:3  AMMO:0  MANA:1
01 Militiaman   Castle  Common  ATK:8  DEF:5  HP:40  INIT:5  SPD:3  AMMO:0  MANA:2
02 Archer       Castle  Rare    ATK:12 DEF:8  HP:50  INIT:7  SPD:3  AMMO:5  MANA:4
03 Sniper       Dungeon Epic    ATK:22 DEF:15 HP:75  INIT:6  SPD:2  AMMO:4  MANA:7
04 Spearman     Castle  Rare    ATK:14 DEF:10 HP:60  INIT:6  SPD:4  AMMO:0  MANA:5
05 Knight       Castle  Epic    ATK:20 DEF:18 HP:85  INIT:5  SPD:3  AMMO:0  MANA:7
06 Monk         Castle  Rare    ATK:10 DEF:9  HP:55  INIT:5  SPD:2  AMMO:0  MANA:5  MRES:10
07 Torchbearer  Inferno Common  ATK:7  DEF:4  HP:35  INIT:7  SPD:3  AMMO:0  MANA:2
08 Pyro-Goblin  Inferno Rare    ATK:13 DEF:8  HP:50  INIT:7  SPD:2  AMMO:4  MANA:4
09 Demolitionist Inferno Epic   ATK:8  DEF:5  HP:80  INIT:4  SPD:3  AMMO:0  MANA:6
17 Tower        Castle  Common  ATK:0  DEF:10 HP:70  INIT:0  SPD:0  AMMO:0  MANA:3  MRES:100
18 Barracks     Castle  Rare    ATK:0  DEF:15 HP:100 INIT:0  SPD:0  AMMO:0  MANA:5  MRES:100
19 Monastery    Castle  Legend  ATK:0  DEF:12 HP:90  INIT:0  SPD:0  AMMO:0  MANA:8  MRES:100

SPELLS (7):
10 Healing      Castle  Common  PWR:15 DUR:0 TARGET:SINGLE  MANA:3  SUCC:95%
11 Blast        Inferno Common  PWR:12 DUR:0 TARGET:SINGLE  MANA:3  SUCC:95%
12 Storm        Dungeon Rare    PWR:8  DUR:1 TARGET:SINGLE  MANA:5  SUCC:85%
13 Surge        Dungeon Rare    PWR:10 DUR:1 TARGET:SINGLE  MANA:5  SUCC:85%
14 Inferno      Inferno Epic    PWR:20 DUR:0 TARGET:AREA    MANA:8  SUCC:75%
15 Polymorph    Dungeon Epic    PWR:0  DUR:1 TARGET:SINGLE  MANA:7  SUCC:75%
16 Curse        Necro   Legend  PWR:0  DUR:1 TARGET:SINGLE  MANA:9  SUCC:65%

Spell scaling: "base + multiplier × effectiveSpellPower" (multiplier defined per spell in battle engine)
Duration scaling: baseDuration + floor(hero.spellPower × 0.2)
```

---

## What Needs Building (Phases 7-10 Combined)

### 1. Duel Lobby Frontend
- Page to create duels (set ETH bet)
- List open duels
- Accept a duel
- Cancel your own duel
- Reads from DuelManager contract (already deployed)
- Uses ArcanaPanel, ArcanaButton, ArcanaBar UI components

### 2. Battle Engine (Game Logic)
Pure TypeScript module in `src/game/`. No rendering — just state.

**Game state machine:**
- Hex grid (dimensions you decide — Visual13 test has a working hex layout to reference)
- Deck snapshot at match start (freeze card stats + hero stats)
- Starting hand: draw 4 cards
- Mana: start 5, +1/turn, cap = 12 × (1 + hero.knowledge × 0.1)
- Hand limit: 6, excess discarded

**Turn structure:**
- All units sorted by initiative (high → low)
- Each unit activates: move (1 AP per hex) → attack (ends activation) OR play card (skip this unit's action, max 1 card/turn)
- Zero units rule: free action before initiative starts
- Draw 1 card at turn end

**Combat (melee + ranged only, no abilities):**
- Melee (ammo=0): adjacent hex, full damage, retaliation once/turn
- Ranged (ammo>0): any hex, half damage on enemy half, half if blocked by adjacent melee, ammo decrements
- All formulas in GDD Section 9 (effectiveAttack, defense reduction, crit, armor pen, vitality, spell power, etc.)

**Spells:**
- Generic (no schools) — damage, heal, buff, debuff
- Success chance roll: failure = burned to graveyard, mana spent
- Success = resolves, returns to deck bottom (spell recycling)
- Target types: SINGLE, ALL_ENEMIES, ALL_ALLIES, AREA, HERO

**Hero barrier:**
- Hero HP 30, can't be targeted while units alive
- Barrier drops when last unit dies
- Hero death = loss

**Deterministic RNG:**
- Seed from matchId = hash(player1 + player2 + timestamp + nonce)
- All random events (crits, spell failure) use seeded RNG

**State serialization:**
- Every state transition must be serializable for signing
- Both players sign each state → final state submitted to DuelManager

### 3. Battle UI (WebGPU)
Build on existing engine (`src/engine/`). Reference `src/pages/tests/Visual13.tsx` for hex grid rendering.

- Hex grid board with terrain tiles
- Unit sprites on hexes (animated: idle, walk, attack, death)
- Click to select unit, click hex to move, click enemy to attack
- Initiative queue display
- Mana bar, hero HP bar, unit HP bars
- Hand at bottom (card objects, click to play)
- 45-second activation timer
- Spell visual effects (FX sprites)
- Turn structure flow

**InteractionManager note:** Currently uses vanilla DOM listeners on canvas. Should be refactored to accept events from React (the canvas is inside a React component).

### 4. State Channel + Multiplayer
- WebSocket signaling for matchmaking
- WebRTC data channel for game state exchange
- Both players sign each state transition
- Final signed state → DuelManager.settleDuel()
- Timeout = stamp damage (3→6→12→24), hero death = auto-loss
- Reconnection via timeout mechanic

---

## Key GDD Rules (v3.0 Simplified)

- **No unit abilities** — melee and ranged only
- **No spell schools** — all spells generic
- **No immunities** — no school or effect immunity
- **No status effects yet** — deferred to Phase 12
- **No tactical traits** — removed in v3.0
- **Traits are stat modifiers only**: Attack, Defense, Power, CriticalStrike, ArmorPenetration, DamageReduction, Vitality, Wisdom, SpellFocus, ArcaneMastery, ManaGrowth, LastStand, MomentumScaling
- **Spell recycling**: success → deck bottom, failure → graveyard burn
- **Buildings** (Tower/Barracks/Monastery): units with speed 0, can't move, 100% magic resistance

---

## How to Run

```bash
# Terminal 1: anvil
cd contracts && anvil

# Terminal 2: deploy (once per fresh anvil)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 forge script script/DeployPhase1.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Get proxy admin:
cast admin <GAME_CONFIG_PROXY> --rpc-url http://127.0.0.1:8545
# Deploy Phase 2:
PRIVATE_KEY=... GAME_CONFIG_PROXY=... CARD_NFT=... PROXY_ADMIN=... forge script script/DeployPhase2.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Deploy Phase 7:
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 forge script script/DeployPhase7.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Terminal 3: frontend
cd frontend && npm run sync-abi && npm run dev

# Player account (MetaMask import):
# Private key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
# Network: Localhost 8545, Chain ID 31337

# Contract tests:
cd contracts && forge test  # 113 tests
```

---

## Project Rules
- Never start a new phase without plan mode first
- Git commit after every completed logical unit
- No AI co-author lines in commits
- GDD.md is source of truth for game mechanics
- If something fails 3+ times, stop and explain
