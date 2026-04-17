# Arcana Arena — Development Roadmap

## Critical Path: 0 → 1 → 2 → 3 → 7 → 8 → 9 → 10
## Semi-independent: Phases 4, 5, 6
## Parallelizable: Phase 11 alongside 8–10

---

## Phase 0: Project Scaffolding ✓ COMPLETE
- [x] Foundry project (forge init), OpenZeppelin dependencies
- [x] React + Vite frontend, wagmi + viem setup
- [x] Anvil local testnet config
- [x] Deploy hello-world contract to verify toolchain
- **Verified**: `forge test` passes (4/4), frontend connects wallet and reads contract

## Phase 1: CardNFT + GameConfig + On-chain SVG
- [ ] CardNFT (ERC-721, dynamic tokenURI with on-chain SVG)
- [ ] GameConfig (card stats, admin setters, change events)
- [ ] Pin card PNGs to IPFS, embed in SVG overlay
- [ ] ERC-2981 royalties on CardNFT
- **Testable**: Mint cards, view on OpenSea testnet with dynamic stats

## Phase 2: HeroNFT + Starter Deck
- [ ] HeroNFT (ERC-721, faction/archetype creation)
- [ ] Batch-mint 20 starter CardNFTs on hero creation
- [ ] Level up: stat choice + deterministic trait options
- **Testable**: Create hero → 20 cards appear in wallet

## Phase 3: Frontend — Wallet, Collection, Hero
- [ ] Home page with wallet connect (wagmi)
- [ ] Hero creation flow (faction/archetype picker)
- [ ] Collection page (renders on-chain SVGs)
- [ ] Hero profile with level-up UI
- **Testable**: Full hero creation → collection view flow in browser

## Phase 4: Marketplace
- [ ] Marketplace contract (list/buy/cancel, atomic, ERC-2981 royalties)
- [ ] Frontend marketplace page (browse, list, buy)
- **Testable**: List card from wallet A, buy from wallet B

## Phase 5: Deck Builder
- [ ] Deck validation logic (shared JS module)
- [ ] Deck builder UI (drag/drop, real-time validation)
- [ ] Save/load decks off-chain (localStorage)
- **Testable**: Build valid 20-card deck, validation catches invalid decks

## Phase 6: Pack Opening + Chainlink VRF
- [ ] PackOpening contract with Chainlink VRF
- [ ] Pack tier definitions in GameConfig
- [ ] Frontend pack opening with animated card reveal
- **Testable**: Buy pack on Base Sepolia, cards minted after VRF callback

## Phase 7: DuelManager + ETH Betting
- [ ] DuelManager (create/accept duel, lock ETH, submit signed result, ELO)
- [ ] FreedomRecord (permanent freed wallet records)
- [ ] Duel lobby frontend
- **Testable**: Full duel financial flow — lock, settle, ELO update

## Phase 8: Battle Engine (pure JS/TS)
- [ ] Game state machine: grid, movement, combat, spells, initiative turns
- [ ] All combat formulas from GDD Section 9
- [ ] Deterministic RNG from match ID seed
- [ ] State serialization for signing
- **Testable**: Automated matches in Node.js, formula verification

## Phase 9: Battle UI
- [ ] 9a: 2D playable grid prototype (fast iteration, bug catching)
- [ ] 9b: Three.js 3D isometric board with .glb models + animations
- **Testable**: Play full match against yourself

## Phase 10: State Channel + Multiplayer
- [ ] WebSocket signaling / WebRTC data channel
- [ ] State signing protocol (both players sign each transition)
- [ ] Integration with DuelManager on-chain settlement
- **Testable**: Two browser tabs play a match, ETH settles on-chain

## Phase 11: Admin Panel (parallelizable with 8–10)
- [ ] Admin-gated frontend page
- [ ] Card creation workflow (IPFS upload → GameConfig registration)
- [ ] Pack/season management UI
- **Testable**: Admin creates new card type, appears in pack pool

## Phase 12: Polish + Content
- [ ] SpellEngine contract/registry
- [ ] Create minimum viable card set via Admin Panel
- [ ] Balance pass with automated match simulations
- [ ] Season leaderboard, ELO history chart, UI polish
