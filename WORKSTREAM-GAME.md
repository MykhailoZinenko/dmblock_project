# Workstream: Core Game & Multiplayer
**Owner**: You (Mykhailo)
**Phases**: 7, 8, 9, 10

---

## Scope
Everything related to the battle system, duels, ELO, and multiplayer. From "two players lock ETH" to "winner gets paid."

---

## Phase 7: DuelManager + ETH Betting (Contract)

**New contract**: `DuelManager.sol` (upgradeable)
- Create duel: lock ETH, set min opponent bet
- Accept duel: lock ETH, `lockedBet = min(A, B)`, refund excess
- Submit signed result: verify both signatures, pay winner minus 5% fee
- ELO: K-factor 32, 25-match calibration, floor 0, soft reset
- 24-hour submission window, both-bets-refund if no submission

**New contract**: `FreedomRecord.sol` (immutable)
- Permanent on-chain freed wallet records per season

**Frontend**: Duel lobby page
- Create/accept duels, set bet amount, view open duels

**No dependencies on teammate's work.** DuelManager only needs: player addresses, ETH, signed match results. Does not interact with Marketplace, PackOpening, or DeckBuilder contracts.

---

## Phase 8: Battle Engine (Pure JS)

**Location**: `frontend/engine/` (existing WebGPU renderer) + new `frontend/game/` directory

**Game state machine**:
- Hex grid (dimensions TBD — you define based on renderer)
- Unit placement, movement (speed-based action points)
- Melee combat (adjacent hex), ranged combat (ammo, half-damage rules)
- Spell casting (generic spells — damage, heal, buff, debuff)
- Initiative-based turn order
- Mana system (start 5, +1/turn, cap formula)
- Hand management (draw 4, +1/turn, max 6)
- Spell recycling: success → deck bottom, failure → graveyard burn
- Hero barrier + HP (30 base)
- Win condition: hero HP → 0

**Combat formulas**: all from GDD Section 9
- effectiveAttack, defense reduction, spell power, armor pen, crit, ranged modifiers, vitality

**No abilities, no status effects** (v3.0 simplified). Melee + ranged + generic spells only.

**Snapshot immutability**: freeze deck + hero stats at match start

**Deterministic RNG**: seeded from matchId = `hash(player1 + player2 + timestamp + nonce)`

**State serialization**: every state transition serializable for signing

**Does NOT depend on**: Marketplace, PackOpening, DeckBuilder, Admin Panel

**DOES depend on**: GameConfig card stats (read-only at match start), HeroNFT hero stats (read-only at match start). Both already deployed and working.

---

## Phase 9: Battle UI

**Uses existing**: `frontend/engine/` WebGPU renderer
- Hex grid rendering (terrain tiles in `assets/01-18.png`)
- Unit sprites (`assets/units/{color}/{unit}_v1/`) — idle, run, attack animations
- AnimatedSprite, Camera (pan/zoom), Interaction (click/hover), Graphics (hex highlights)
- Text (MSDF), ParticleContainer (FX from `assets/fx/`)

**Build**:
- Hex grid board with unit placement
- Click-to-select, click-to-move, click-to-attack
- Initiative queue display
- Mana bar, hero HP bar, unit HP bars
- Hand display at bottom (card objects)
- 45-second activation timer
- Turn structure flow (initiative order → unit activation → card action)

**Asset paths**: currently `../../assets/` from tests — will need adjustment when integrated into main app routing.

---

## Phase 10: State Channel + Multiplayer

- WebSocket signaling / WebRTC data channel
- State signing protocol (both players sign each transition)
- Integration with DuelManager on-chain settlement
- Reconnection via timeout mechanic (stamp damage)

---

## Interface Contract with Teammate

**You produce** (teammate consumes):
- `DuelManager` contract address + ABI — teammate's frontend can read match history for profile pages
- Battle engine's `matchResult` format — teammate doesn't need to understand internals, just the signed result struct

**Teammate produces** (you consume):
- Valid deck of 20 cards (array of cardIds) from DeckBuilder — you snapshot stats at match start
- Nothing else. You read GameConfig + HeroNFT directly.

**Shared (read-only, already deployed)**:
- GameConfig (card stats)
- CardNFT (ownership verification)
- HeroNFT (hero stats, trait levels)

---

## Key Files
```
contracts/src/DuelManager.sol        # New — you create
contracts/src/FreedomRecord.sol      # New — you create
frontend/game/                       # New — battle engine state machine
frontend/engine/                     # Existing — WebGPU renderer (you integrate)
assets/units/                        # Existing — unit sprites
assets/fx/                           # Existing — visual effects
assets/01-18.png                     # Existing — terrain tiles
```
