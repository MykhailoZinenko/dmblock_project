# Arcana Arena

Tactical card-battle NFT game on Base Sepolia. Full spec in `GDD.md`.

## Tech Stack
- **Contracts**: Solidity 0.8+, Foundry (forge/cast/anvil), OpenZeppelin
- **Frontend**: React + Vite, wagmi + viem, Three.js
- **Chain**: Base Sepolia (testnet)
- **Upgradeable contracts**: OpenZeppelin Transparent Proxy

## Project Structure
```
zadanie2/
├── contracts/          # Foundry project
├── frontend/           # React + Vite app
├── assets/
│   ├── cards/          # Baked card PNG art (no stat numbers)
│   ├── models/         # 3D unit models (.glb)
│   └── card_back.png   # Card back face
├── GDD.md              # Game Design Document v2.1
├── ROADMAP.md          # Development phases
├── CONTINUE.md         # Current session state
└── CLAUDE.md           # This file
```

## Rules
- **Never start a new roadmap phase without discussion and plan mode first** — present plan, get explicit user approval before writing any code
- Every completed logical unit of work must be: (1) logged in `CONTINUE.md`, (2) memory updated if needed, (3) **git committed**
- Always update memory files after significant progress or decisions
- Follow the roadmap phases in order (see ROADMAP.md)
- GDD.md is the source of truth for game mechanics and formulas
- Never modify NFT ownership contracts after deployment (CardNFT, HeroNFT, Marketplace, FreedomRecord are immutable)
- Card art PNGs are generated externally — don't modify or regenerate them

## Contract Architecture
**Immutable**: CardNFT, HeroNFT, Marketplace, FreedomRecord
**Upgradeable**: GameConfig, DuelManager, PackOpening, SpellEngine

## Commands
```bash
# Contracts
cd contracts && forge build        # Compile
cd contracts && forge test         # Run tests
cd contracts && anvil              # Local testnet

# Frontend
cd frontend && npm run dev         # Dev server
```
