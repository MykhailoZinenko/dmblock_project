# Arcana Arena — Session State

## Current Phase: Phase 1 COMPLETE ✓ → Phase 2 next

## Completed Phases

### Phase 0 ✓ — Project Scaffolding
- Foundry + OpenZeppelin, React + Vite + wagmi + viem
- HelloWorld contract, 4 tests, deploy script, ABI sync
- Anvil → MetaMask → frontend reads contract

### Phase 1 ✓ — CardNFT + GameConfig + On-chain SVG
- **Contracts** (35/35 tests pass):
  - `GameConfig.sol` — upgradeable, ERC-7201 storage, admin CRUD for cards, events on all changes
  - `CardNFT.sol` — ERC-721 + ERC-2981 (2.5%), dynamic tokenURI, batch mint, authorized minters
  - `SVGRenderer.sol` — embeds card PNG from IPFS, overlays stat numbers in inner circles
  - `CardTypes.sol` — shared enums (CardType, Faction, Rarity, SpellSchool) + structs (Ability, CardStats, CardData)
  - `IGameConfig.sol` — interface with events
- **IPFS**: peasant + imp PNGs pinned on Pinata (CIDs in CLAUDE.md)
- **SVG verified locally**: card art renders, stat numbers positioned correctly in inner circles
- **Deployed to Base Sepolia**: addresses in CLAUDE.md
- **Minted**: Peasant #0 and Imp #1 to deployer wallet
- **GDD updates**: status effects defined (Fear, Blind, Silence, Confusion, Roots), schoolType ruling, ammo→no-melee fix, unit size (2x2), tokenURI visibility

## What's Next — Phase 2: HeroNFT + Starter Deck
**Requires plan mode discussion first.** From ROADMAP.md:
- HeroNFT (ERC-721, faction/archetype creation)
- Batch-mint 20 starter CardNFTs on hero creation
- Level up: stat choice + deterministic trait options
- Testable: Create hero → 20 cards appear in wallet

## Git Log
```
8c2702b docs: Phase 1 complete — deployed to Base Sepolia
1d9bc2d fix: SVGRenderer uses card PNG as background with stat number overlays
194affc feat: Phase 1 deploy script and session state update
32a0410 test: Phase 1 test suite — 31 tests for GameConfig, CardNFT, integration
da5efcf feat: Phase 1 contracts — GameConfig, CardNFT, SVGRenderer
a7444d8 docs: update GDD with status effects, schoolType ruling, ammo fix, unit size, tokenURI visibility
104566f feat: initial project scaffolding (Phase 0)
```

## Dev Workflow
```bash
# Terminal 1: anvil (in contracts/)
# Terminal 2: deploy (see CLAUDE.md for commands)
# Terminal 3: cd frontend && npm run dev
# After contract changes: forge build && cd ../frontend && npm run sync-abi
```
