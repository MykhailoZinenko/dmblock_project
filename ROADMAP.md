# Arcana Arena — Development Roadmap (GDD v3.0)

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

## Phase 1: CardNFT + GameConfig + On-chain SVG ✓ COMPLETE
- [x] CardNFT (ERC-721, dynamic tokenURI with on-chain SVG)
- [x] GameConfig (card stats, admin setters, change events, ERC-7201 storage)
- [x] Pin card PNGs to IPFS, embed in SVG overlay
- [x] ERC-2981 royalties on CardNFT (2.5%)
- [x] Deploy to Base Sepolia, mint Peasant #0 and Imp #1
- **Verified**: 35/35 tests, deployed to Base Sepolia, SVG renders correctly

## Phase 2: HeroNFT + Starter Deck ✓ COMPLETE
- [x] HeroNFT (ERC-721, faction + archetype selection, base stats with ±1 random variance)
- [x] Hero primary stats: Attack, Defense, SpellPower, Knowledge per archetype table
- [x] Batch-mint 20 starter CardNFTs on hero creation (placeholder: 10 Peasants + 10 Imps)
- [x] Level up: player chooses +1 to a primary stat
- [x] Deterministic trait options: `hash(address + seasonId + heroLevel)` → 2 traits presented, player picks 1
- [x] Starter deck composition configurable by admin in GameConfig
- [x] Deck validation rules deferred to Phase 5
- **Verified**: 79/79 tests, full flow on local anvil, ~1.06M gas for hero creation

## Phase 3: Frontend — Wallet, Collection, Hero ✓ COMPLETE
- [x] Home page with wallet connect (wagmi)
- [x] Hero creation flow (faction/archetype picker)
- [x] Collection page (renders on-chain SVGs)
- [x] Hero profile with level-up UI
- **Verified**: Full hero creation → collection view → level-up flow in browser

## Phase 4: Marketplace
- [ ] Marketplace contract (list/buy/cancel, atomic, ERC-2981 royalties)
- [ ] Frontend marketplace page (browse, list, buy)
- **Testable**: List card from wallet A, buy from wallet B

## Phase 5: Deck Builder
- [ ] Deck validation logic (shared JS module) — archetype composition rules enforced here
- [ ] Copy limits by rarity: Common 4, Rare 3, Epic 2, Legendary 1
- [ ] NFT ownership verification (1 NFT = 1 deck copy)
- [ ] Deck builder UI (drag/drop, real-time validation)
- [ ] Save/load decks off-chain (localStorage)
- **Testable**: Build valid 20-card deck, validation catches invalid decks

## Phase 6: Pack Opening + Chainlink VRF
- [ ] PackOpening contract with Chainlink VRF
- [ ] Pack tier definitions in GameConfig (pool already supports this from Phase 1)
- [ ] Drop probability from TWAP with base price fallback
- [ ] Frontend pack opening with animated card reveal
- **Testable**: Buy pack on Base Sepolia, cards minted after VRF callback

## Phase 7: DuelManager + ETH Betting
- [ ] DuelManager (create/accept duel, lock ETH, submit signed result, ELO)
- [ ] Symmetric bet locking: `lockedBet = min(A, B)`, excess refunded
- [ ] 5% protocol fee, 24-hour submission window, dispute resolution
- [ ] ELO: K-factor 32, 25-match calibration, floor 0, soft reset formula
- [ ] FreedomRecord (permanent freed wallet records per season)
- [ ] Duel lobby frontend
- **Testable**: Full duel financial flow — lock, settle, ELO update

## Phase 8: Battle Engine (pure JS)
- [ ] Game state machine: hex grid, movement, melee/ranged combat, spells, initiative turns
- [ ] All combat formulas from GDD Section 9
- [ ] Snapshot immutability — match state frozen from GameConfig at start (GDD 6.12)
- [ ] Deterministic RNG from match ID seed
- [ ] State serialization for signing
- [ ] No unit abilities — melee and ranged only (v3.0 simplification)
- **Testable**: Automated matches in Node.js, formula verification

## Phase 9: Battle UI
- [ ] 2D hex grid using existing WebGPU renderer (engine/ with animated sprites)
- [ ] Unit sprites: idle, walk, attack, death animations (assets already in assets/units/)
- [ ] Spell visual effects (assets/fx/)
- [ ] HUD: initiative queue, mana bar, hero HP, hand display
- **Testable**: Play full match against yourself

## Phase 10: State Channel + Multiplayer
- [ ] WebSocket signaling / WebRTC data channel
- [ ] State signing protocol (both players sign each transition)
- [ ] 24-hour final state submission window, dispute resolution
- [ ] Integration with DuelManager on-chain settlement
- **Testable**: Two browser tabs play a match, ETH settles on-chain

## Phase 11: Admin Panel (parallelizable with 8–10)
- [ ] Admin-gated frontend page
- [ ] Card creation workflow (IPFS upload → GameConfig registration)
- [ ] Pack/season management UI
- **Testable**: Admin creates new card type, appears in pack pool

## Phase 12: Polish + Content + Status Effects
- [ ] Full card roster (24–32 units, 8–12 generic spells) designed and registered
- [ ] Replace placeholder starter deck with curated all-commons set
- [ ] Status effects (SLOW, POISON, BURN, ROOTS, BLIND, FREEZE) — no immunity system
- [ ] Balance pass with automated match simulations
- [ ] Season leaderboard, ELO history chart, UI polish
