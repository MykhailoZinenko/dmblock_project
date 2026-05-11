# Arcana Arena — Session State

## Current Phase: Phase 6 COMPLETE locally ✓ (Base Sepolia deploy still pending)

### Phase 6 ✓ — Pack Opening + Chainlink VRF (local)
- **PackOpening.sol** (upgradeable, 7/7 tests pass): tier configs, weighted pulls by price, guaranteed-rarity gating on first slot, admin base price + TWAP, withdraw, VRF config setter.
- **DeployPhase6.s.sol**: env-driven; deploys MockVrfCoordinator when `VRF_COORDINATOR` is unset (local mode), or wires to a real coordinator on Base Sepolia.
- **Deployed locally** (anvil 31337):
  - PackOpening proxy: `0x4EE6eCAD1c2Dae9f525404De8555724e3c35d07B`
  - PackOpening impl: `0x172076E0166D1F9Cc711C77Adf8488051744980C`
  - MockVrfCoordinator: `0xf4B146FbA71F41E0592668ffbF264F1D186b2Ca8`
- **Frontend wired** in `frontend/src/contracts.ts`. PackOpening page auto-fulfills the mock on chain 31337 so the local UX doesn't hang, and the reveal now shows full card art / name / rarity from `CardNFT.tokenURI`.
- **TWAP updater** at `frontend/scripts/update-twap.mjs` (run via `npm run update-twap`): joins Marketplace `Sold` events from the last 7 days with `CardNFT.tokenCardId`, pushes per-card averages + counts via `setCardPrice`. Contract still uses admin base price until trade count ≥ 10.

### Still pending for Phase 6
- **Base Sepolia deploy** — needs a real Chainlink VRF v2.5 subscription. Once you have one, run:
  ```bash
  source .env && PRIVATE_KEY=$BASE_SEPOLIA_PRIVATE_KEY \
    GAME_CONFIG_PROXY=0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177 \
    CARD_NFT=0xD43f5617d8df0E3D02130DdAeb35e0192878c1De \
    VRF_COORDINATOR=0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE \
    VRF_KEY_HASH=0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71 \
    VRF_SUBSCRIPTION_ID=<sub id> \
    forge script script/DeployPhase6.s.sol --tc DeployPhase6 --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
  ```
  Then add the deployed proxy as a consumer on vrf.chain.link and fund the subscription. Verify the coordinator + keyHash against current Chainlink docs before shipping.
- **TWAP keeper** — `update-twap.mjs` currently runs one-shot. For Base Sepolia, schedule it (cron / a serverless worker) every few minutes.
- **Card reveal animation** — current UI is static (image + name + rarity). No timed flip / rarity-glow effect yet.

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
