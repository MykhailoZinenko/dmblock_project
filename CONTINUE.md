# Arcana Arena — Session State

## Current Phase: 1 — COMPLETE ✓

## What's Done
- **Phase 0 complete**: Foundry + React/Vite toolchain verified end-to-end
- **GDD updated**: Status effects defined, schoolType ruling, ammo/melee fix, tokenURI base-stats-for-non-owners, unit size added
- **Phase 1 complete** (35/35 tests pass):
  - `CardTypes.sol` — shared enums + structs
  - `IGameConfig.sol` — interface with events
  - `GameConfig.sol` — upgradeable (ERC-7201 storage), admin card CRUD, all changes emit events
  - `SVGRenderer.sol` — card PNG background from IPFS + stat number overlays
  - `CardNFT.sol` — ERC-721 + ERC-2981 royalties, dynamic tokenURI, batch mint, authorized minters
  - `DeployPhase1.s.sol` — deploys GameConfig (proxy) + CardNFT, registers Peasant + Imp cards
  - IPFS: peasant + imp PNGs pinned on Pinata
  - Verified locally on Anvil: SVG renders correctly with stats in inner circles
  - Deployed to Base Sepolia (OpenSea testnet no longer available — verify via Basescan)

## Base Sepolia Deployment (Phase 1)
- GameConfig impl: `0x2bA36848798Ea085818A5aA2f5FEF9037f111af0`
- GameConfig proxy: `0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177`
- CardNFT: `0xD43f5617d8df0E3D02130DdAeb35e0192878c1De`
- Peasant #0 and Imp #1 minted to `0x81b8D225Be9a6164e6af0b60928814e19Aa2bE90`

## What's Next
- Phase 2: HeroNFT + Starter Deck (requires plan mode discussion first)

## Dev Workflow
```bash
# Terminal 1: anvil
# Terminal 2: PRIVATE_KEY=0xac09...ff80 forge script script/DeployPhase1.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Terminal 3: cd frontend && npm run dev
# After contract changes: forge build && cd ../frontend && npm run sync-abi
```

## Key Files
- `contracts/src/GameConfig.sol` — Card stats registry (upgradeable)
- `contracts/src/CardNFT.sol` — ERC-721 NFT with dynamic SVG tokenURI
- `contracts/src/libraries/CardTypes.sol` — Shared types
- `contracts/src/libraries/SVGRenderer.sol` — On-chain SVG renderer
- `contracts/src/interfaces/IGameConfig.sol` — GameConfig interface
- `contracts/script/DeployPhase1.s.sol` — Phase 1 deployment
- `contracts/test/` — Foundry tests (GameConfig, CardNFT, Integration)
- `frontend/src/wagmi.ts` — Chain/wallet config
- `frontend/scripts/sync-abi.mjs` — ABI sync (add new contract names to CONTRACTS array)
