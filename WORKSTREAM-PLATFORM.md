# Workstream: Platform & Economy
**Owner**: Teammate
**Phases**: 4, 5, 6, 11, 12

---

## Scope
Everything related to the card economy, deck management, pack system, admin tools, and content. From "player trades a card" to "admin creates a new card type."

---

## Phase 4: Marketplace

**New contract**: `Marketplace.sol` (immutable)
- List: owner sets fixed ETH price, listing stored on-chain
- Buy: buyer sends ETH, atomic transfer (NFT → buyer, ETH → seller minus royalty)
- Cancel: owner cancels listing, no fee
- ERC-2981 royalties enforced (2.5% on CardNFT)
- Reentrancy guards, checks-effects-interactions

**Frontend**: Marketplace page
- Browse all active listings
- List a card from your collection (set price)
- Buy a listed card
- Cancel your own listing

**No dependencies on game workstream.** Marketplace only interacts with CardNFT (transfer + royalty). Does not need DuelManager, battle engine, or ELO.

---

## Phase 5: Deck Builder

**Shared JS module**: deck validation logic
- Deck size: exactly 20 cards
- Copy limits by rarity: Common 4, Rare 3, Epic 2, Legendary 1
- Minimum units: 6 (all archetypes)
- Archetype composition: Warrior/Sentinel min 12 units, Mage min 12 spells, Ranger no restriction
- NFT ownership: 1 NFT = 1 deck copy (verify on-chain balances)

**Frontend**: Deck builder page
- View owned cards, drag/drop into deck slots
- Real-time validation (highlight violations)
- Save/load decks off-chain (localStorage)
- Multiple saved decks per player

**Interface with game workstream**: the game workstream reads a validated deck as `uint256[] cardIds` (array of 20 card IDs). That's the only handoff — you produce the array, they snapshot stats from GameConfig.

---

## Phase 6: Pack Opening + Chainlink VRF

**New contract**: `PackOpening.sol` (upgradeable)
- Player sends ETH for pack tier
- Contract requests Chainlink VRF randomness
- VRF callback mints cards to player wallet via CardNFT.batchMint
- Pack tiers: Common, Rare, Epic, Legendary (prices + card counts in GDD 10.1)
- Drop probability from TWAP with admin base price fallback

**Frontend**: Pack opening page
- Buy pack (select tier, pay ETH)
- Animated card reveal on mint events
- Show pulled cards with rarity highlights

**Requires**: Chainlink VRF subscription on Base Sepolia. CardNFT.setAuthorizedMinter for PackOpening contract.

---

## Phase 11: Admin Panel

**Frontend**: admin-gated page (check wallet === contract owner)

**Card Management**:
- Upload card illustration → IPFS (Pinata)
- Set card name, faction, rarity
- Set base stats (attack, defense, HP, initiative, speed, ammo, mana cost, size, magic resistance)
- Set spell parameters if spell card (spell power, duration, target type, success chance)
- Preview card SVG before publishing
- Call GameConfig.addCard / updateCardStats

**Pack Management**:
- Define card pool per pack tier
- Set prices and card counts
- Activate/deactivate tiers

**Season Management**:
- Start/end seasons
- View standings
- Trigger goodwill rewards

**No dependencies on game workstream.** Admin panel only writes to GameConfig (already deployed, upgradeable).

---

## Phase 12: Polish + Content + Status Effects

**Content**:
- Design full card roster: 24–32 units across 4 factions, 8–12 generic spells
- Create card art, upload to IPFS, register in GameConfig via Admin Panel
- Replace placeholder starter deck (10 Peasants + 10 Imps) with curated all-commons set

**Status effects** (simple, no immunity system):
- SLOW, POISON, BURN, ROOTS, BLIND, FREEZE
- Applied by spells, tick on unit activation, replace on reapply
- Coordinate with game workstream to integrate into battle engine

**Polish**:
- Season leaderboard page
- ELO history chart
- UI polish across all pages

---

## Interface Contract with Game Workstream

**You produce** (game workstream consumes):
- Validated deck: `uint256[]` of 20 cardIds — game reads stats from GameConfig at match start
- New cards in GameConfig — game reads them automatically via existing contract calls

**Game workstream produces** (you consume):
- `DuelManager` contract ABI — you can show match history, ELO on profile pages
- `matchResult` event data — you can display win/loss history

**Shared (read-only, already deployed)**:
- GameConfig proxy: `0x0165878A594ca255338adfa4d48449f69242Eb8F` (local anvil)
- CardNFT: `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` (local anvil)
- HeroNFT: `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0` (local anvil)

---

## Key Files
```
contracts/src/Marketplace.sol        # New — you create (immutable)
contracts/src/PackOpening.sol        # New — you create (upgradeable)
frontend/src/pages/Marketplace.tsx   # New
frontend/src/pages/DeckBuilder.tsx   # New
frontend/src/pages/PackOpening.tsx   # New
frontend/src/pages/AdminPanel.tsx    # New
frontend/src/lib/deckValidation.ts   # New — shared deck validation module
```

---

## Existing Code Reference
- `contracts/src/GameConfig.sol` — addCard, updateCardStats, getCard, getStarterDeck
- `contracts/src/CardNFT.sol` — mint, batchMint, setAuthorizedMinter, tokenURI
- `frontend/src/contracts.ts` — contract addresses, ABIs, constants
- `frontend/src/hooks/useOwnedCards.ts` — existing hook for reading owned cards
- `frontend/scripts/sync-abi.mjs` — add new contract names here after deployment
