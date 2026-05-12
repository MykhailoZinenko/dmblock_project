# Arcana Arena

Tactical card-battle NFT game on Base Sepolia. Full spec in `GDD.md`.

## Tech Stack
- **Contracts**: Solidity 0.8.28, Foundry (forge/cast/anvil), OpenZeppelin 5.6.1
- **Frontend**: React + Vite, wagmi + viem, Three.js
- **Chain**: Base Sepolia (testnet), Chain ID 84532
- **Upgradeable contracts**: OpenZeppelin Transparent Proxy, ERC-7201 namespaced storage
- **Compiler**: `via_ir = true` (required for SVG string concat stack depth)

## Project Structure
```
├── contracts/                  # Foundry project
│   ├── src/
│   │   ├── GameConfig.sol      # Upgradeable card stats + starter deck + starting traits
│   │   ├── CardNFT.sol         # ERC-721 + ERC-2981 royalties
│   │   ├── HeroNFT.sol         # ERC-721 hero creation + level-up + starter minting
│   │   ├── interfaces/
│   │   │   ├── IGameConfig.sol
│   │   │   └── IHeroNFT.sol
│   │   └── libraries/
│   │       ├── CardTypes.sol   # Shared enums + structs
│   │       ├── HeroTypes.sol   # Archetype enum, HeroData, trait constants
│   │       └── SVGRenderer.sol # Card PNG + stat number overlay
│   ├── test/                   # GameConfig, CardNFT, HeroNFT, Integration tests
│   ├── script/DeployPhase1.s.sol
│   ├── script/DeployPhase2.s.sol
│   └── .env                    # Private keys (gitignored)
├── frontend/                   # React + Vite app
│   └── public/assets/          # Static art at /assets/ (cards, UI, units, fonts)
├── GDD.md                      # Game Design Document v2.1 (source of truth)
├── ROADMAP.md                  # Development phases
├── CONTINUE.md                 # Current session state — READ THIS FIRST
└── CLAUDE.md                   # This file
```

## Rules
- **Never start a new roadmap phase without discussion and plan mode first** — present plan, get explicit user approval before writing any code
- Every completed logical unit of work must be: (1) implemented, (2) verified (compile/test), (3) **git committed immediately**. Never batch multiple units then commit retroactively
- Always update memory files after significant progress or decisions
- Before ending a session, update `CONTINUE.md` and `CLAUDE.md` so the next session has full context
- If something fails 3+ times, stop and explain the situation instead of retrying
- Follow the roadmap phases in order (see ROADMAP.md)
- GDD.md is the source of truth for game mechanics and formulas
- Never modify NFT ownership contracts after deployment (CardNFT, HeroNFT, Marketplace, FreedomRecord are immutable)
- Card art PNGs are generated externally — don't modify or regenerate them
- Card PNGs already contain the full card design (frame, name, art, stat icons). SVG only overlays stat numbers on top

## Contract Architecture
**Immutable**: CardNFT, HeroNFT, Marketplace, FreedomRecord
**Upgradeable**: GameConfig, DuelManager, PackOpening, SpellEngine

## Base Sepolia Deployment (Phase 1)
- GameConfig impl: `0x2bA36848798Ea085818A5aA2f5FEF9037f111af0`
- GameConfig proxy: `0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177`
- CardNFT: `0xD43f5617d8df0E3D02130DdAeb35e0192878c1De`
- Deployer/owner: `0x81b8D225Be9a6164e6af0b60928814e19Aa2bE90`

## IPFS (Pinata)
- Peasant: `bafybeifmoassowdqemal3ykfnuam5gmbb2ukg24d62puppgjpvwwzd3bsy`
- Imp: `bafybeihua6dmwo7utphh2odhgmq3yaw5jdrtfyb2pkqrf3jwetiw4g6tkm`
- Gateway: `https://gateway.pinata.cloud/ipfs/`

## Commands
```bash
# Contracts
cd contracts && forge build        # Compile (uses via_ir)
cd contracts && forge test         # Run tests (79 passing)
cd contracts && anvil              # Local testnet

# Deploy locally (Phase 1 then Phase 2)
PRIVATE_KEY=0xac09...ff80 forge script script/DeployPhase1.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Then get PROXY_ADMIN via: cast admin <GAME_CONFIG_PROXY> --rpc-url http://127.0.0.1:8545
PRIVATE_KEY=... GAME_CONFIG_PROXY=... CARD_NFT=... PROXY_ADMIN=... forge script script/DeployPhase2.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Deploy to Base Sepolia
source .env && PRIVATE_KEY=$BASE_SEPOLIA_PRIVATE_KEY forge script script/DeployPhase1.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast

# Frontend
cd frontend && npm run dev         # Dev server
```

## Key Design Decisions
- Single `CardData` struct for units and spells (unused fields stay zero)
- All cards (units AND spells) use identical PNG layout — same frame, same 5 stat icon positions. Icons mean different things per card type: unit shows attack/HP/defense/initiative/manaCost; spell shows spellPower/duration/successChance/manaCost (5th slot unused). SVGRenderer overlays the correct numbers.
- Spells have a faction field but it has no mechanical effect — purely cosmetic/collection flavor
- SVGRenderer is an internal library (inlined at compile, no separate deploy)
- tokenURI reads stats live from GameConfig — stats update automatically when admin changes them
- Owner sees hero-modified stats in tokenURI; non-owners see base stats only (hero system Phase 2)
- OpenSea testnet discontinued — verify NFTs via Basescan or thirdweb, or our own frontend (Phase 3)
- HeroNFT is immutable (not upgradeable) — starter deck + starting traits stored in GameConfig (upgradeable) so admin can change without redeploying
- Stat variance uses block.prevrandao — cosmetic ±1, not exploitable
- Trait options deterministic: `hash(owner, seasonId, level)` — same options every time for same hero at same level
- No AI co-author lines in git commits
- Spell recycling: success → back to deck bottom, failure → graveyard burn (GDD 6.4/6.11)
- Magic damage (units + spells) bypasses defense — raw attack/spellPower reduced only by MR
- Physical damage uses atk - def formula, MR ignored
- Ranged units can melee adjacent enemies with halved damage; also retaliate in melee with halved damage
- Spell duration = number of target unit activations (not global turns). Duration 1 cast before unit's turn expires at next turn start; cast after, expires turn after next
- Status effects expire at turn start BEFORE AP reset and queue rebuild
- AnimationController uses swappable config (`swapConfig`/`restoreConfig`) for polymorph — no special-cased sprite logic

## Battle System Architecture
- `frontend/src/game/` — pure TS game logic, deterministic, fully unit-tested (339 tests)
- `frontend/src/game/AnimationController.ts` — per-unit sprite animation state machine with swappable config
- `frontend/src/game/BattleScene.ts` — engine-side scene manager (sprites, HP bars, highlights, FX, movement, projectiles)
- `frontend/src/pages/Battle.tsx` — React HUD (Arcana UI components) + input→logic→scene bridge
- `frontend/src/engine/` — custom WebGPU engine (untouched)
- Turn flow: advanceTurn() → priority phase (free spawn if 0 units) → initiative phase (unit-by-unit activation)
- AP model: 1 AP per hex moved, 1 AP for attack, attack ends activation
