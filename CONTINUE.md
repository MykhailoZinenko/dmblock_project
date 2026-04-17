# Arcana Arena — Session State

## Current Phase: Phase 2 COMPLETE ✓ → Phase 3 next

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
- **Deployed to Base Sepolia**: addresses in CLAUDE.md
- **Minted**: Peasant #0 and Imp #1 to deployer wallet

### Phase 2 ✓ — HeroNFT + Starter Deck
- **Contracts** (79/79 tests pass):
  - `HeroTypes.sol` — Archetype enum, HeroData struct, 24 trait constants with max levels
  - `IHeroNFT.sol` — interface for hero creation, level-up, trait views
  - `HeroNFT.sol` — ERC-721 immutable, hero creation (faction + archetype), ±1 stat variance via prevrandao, batch-mints 20 starter cards, deterministic level-up (stat +1 choice, 2 pseudo-random trait options via hash seed)
  - `GameConfig.sol` — added starter deck config + starting traits (faction × archetype → traitId)
  - `DeployPhase2.s.sol` — upgrades GameConfig proxy, deploys HeroNFT, configures starter deck + 16 starting traits
- **Verified locally on anvil**: hero creation → 20 cards minted → level up works, ~1.06M gas
- **Not deployed to Base Sepolia yet** — will batch-deploy multiple phases later
- **GDD updates**: spell recycling mechanic (success → deck bottom, failure → graveyard burn)

## What's Next — Phase 3: Frontend — Wallet, Collection, Hero
**Requires plan mode discussion first.** From ROADMAP.md:
- Home page with wallet connect (wagmi)
- Hero creation flow (faction/archetype picker)
- Collection page (renders on-chain SVGs)
- Hero profile with level-up UI

## Git Log
```
271ebef feat: Phase 2 deploy script + integration tests
0a352a5 feat: HeroNFT contract — hero creation, starter deck mint, level-up system
bdd11c9 feat: IHeroNFT interface — hero creation, level-up, trait views
675cbeb feat: GameConfig starter deck + starting trait config with tests
a3f8b7d feat: HeroTypes library — Archetype enum, HeroData struct, trait constants
60f209f docs: update CLAUDE.md and CONTINUE.md for session handoff
8c2702b docs: Phase 1 complete — deployed to Base Sepolia
```

## Dev Workflow
```bash
# Terminal 1: anvil (in contracts/)
# Terminal 2: deploy Phase 1 then Phase 2 (see CLAUDE.md)
# Terminal 3: cd frontend && npm run dev
# After contract changes: forge build && cd ../frontend && npm run sync-abi
```
