# Arcana Arena — Session State

## Current Phase: 1 — CardNFT + GameConfig + On-chain SVG

## What's Done
- **Phase 0 complete**: Foundry + React/Vite toolchain verified end-to-end
  - Foundry project with OpenZeppelin (contracts + upgradeable)
  - HelloWorld contract, 4 passing tests, deploy script
  - React + Vite + wagmi + viem frontend
  - ABI sync script (forge build → typed TS)
  - Anvil deploy → MetaMask → frontend reads contract greeting
- **GDD updated**: Status effects defined, schoolType ruling, ammo/melee fix, tokenURI base-stats-for-non-owners, unit size added
- **Phase 1 contracts complete** (35/35 tests pass):
  - `CardTypes.sol` — shared enums + structs (CardType, Faction, Rarity, Ability, CardStats, CardData)
  - `IGameConfig.sol` — interface with events
  - `GameConfig.sol` — upgradeable (ERC-7201 storage), admin card CRUD, all changes emit events
  - `SVGRenderer.sol` — on-chain SVG generation (faction colors, rarity borders, stat boxes, IPFS image embed)
  - `CardNFT.sol` — ERC-721 + ERC-2981 royalties, dynamic tokenURI, batch mint, authorized minters
  - `DeployPhase1.s.sol` — deploys GameConfig (proxy) + CardNFT, registers Peasant + Imp cards

## What's Next
- Pin peasant.png and imp.png to IPFS
- Deploy to Anvil, verify tokenURI SVG renders in browser
- Deploy to Base Sepolia, view on OpenSea testnet
- Begin Phase 2 planning (HeroNFT + Starter Deck)

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
