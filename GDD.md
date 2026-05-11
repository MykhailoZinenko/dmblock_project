# Arcana Arena
## Game Design Document v3.0 — Simplified Core

---

# 1. Vision & Lore

## 1.1 Concept
Arcana Arena is a tactical card-battle game built on Ethereum. Players are imprisoned heroes — once powerful mages, warlords, bandits, and lords — now forced to battle each other in a magically sealed arena for the entertainment of the Wises, a ruling class of arcane scholars who control the world from the shadows.

## 1.2 Lore
Each prisoner wears an **Arcana Stamp** — a remotely controlled magical seal around their neck. It suppresses their ability to cast magic freely and can be triggered to deal damage or execute the wearer instantly. On the arena floor, prisoners are chained to pillars at diagonal corners of the battlefield. The entire arena is enclosed by an unbreakable barrier erected by the Wises.

When a duel begins, the Wises partially disable the stamps — enough to allow summoning and spellcasting, but never enough to grant true freedom. Prisoners must fight or be damaged by the stamp for failing to act in time.

The promise of freedom drives every prisoner. Those who rise to the top of the leaderboard at season end are freed. Nobody knows what truly happens to the freed. Some say they join the Wises. Some say they simply vanish. One thing is certain: the season's greatest warrior is immortalized forever as a Legendary card.

## 1.3 Tone
Dark fantasy. Gritty. Medieval. Morally ambiguous. The players are not heroes by choice.

## 1.4 Setting
The arena is a stone floor with a hex-grid battlefield. Prisoners are chained at opposite edges. The barrier glows faintly above. Spectators — nobles, merchants, the Wises — watch from above.

---

# 2. Core Philosophy

## 2.1 Trust Principles
- **Asset preservation**: Player NFTs are never destroyed, modified, or affected by gameplay outcomes under any circumstance
- **Fairness**: All rules are enforced by smart contracts. No player or admin can manipulate an ongoing match
- **Transparency**: All balance changes announced on-chain minimum 2 weeks before going live
- **Skill over wealth**: A skilled player with common cards can outrank a wealthy player with legendary cards

## 2.2 Balance Policy (Covenant)
Game stats live in an upgradeable contract separate from NFT ownership. The following covenant governs all balance changes:

1. All changes announced minimum 2 weeks before going live
2. All changes permanently logged as on-chain events
3. Set rotation always considered before stat changes
4. At our discretion, goodwill pack rewards may be distributed to holders of significantly affected cards — never guaranteed, never automatic
5. NFT metadata and ownership rules are immutable forever

## 2.3 Economy Principles
- ETH betting is symmetric, capped to the smaller of the two bets
- Freedom (ELO) earning is skill-based — goes up on wins, down on losses
- No pay-to-win path to freedom
- Marketplace royalties fund ongoing development

---

# 3. World Structure

## 3.1 Factions
| Faction | Theme | Accent Color |
|---|---|---|
| Castle | Noble knights, paladins, defenders | Silver / Blue |
| Inferno | Demons, fire cultists, warlords | Red / Orange |
| Necropolis | Undead, necromancers, death priests | Black / Purple |
| Dungeon | Shadow mages, serpents, rogues | Teal / Dark Green |

Each faction has 6–8 unique units. Faction does not restrict card ownership or deck building — it defines hero origin and starting traits only.

## 3.2 Magic
Spells are generic — no spell school system. Spells are defined by their effect (damage, heal, buff, debuff) and stats (spell power, duration, target type, mana cost, success chance). Balance achieved through card design — not school or faction modifiers.

---

# 4. Hero System

## 4.1 Hero Creation
When a player connects their wallet for the first time they create a hero by choosing:
1. **Faction** — defines starting trait and hero identity
2. **Archetype** — defines starting primary stats

A small random variance (±1) is applied to non-primary stats at creation for uniqueness.

**Starter deck:**
- On hero creation, 20 common cards are automatically minted to the player's wallet in the same transaction
- Player pays gas for the full transaction (hero creation + starter minting)
- Starter cards are real NFTs — tradeable, sellable, usable in deck
- Starter set is fixed and identical for all new players
- Starter deck composition defined in GameConfig by admin before season start
- Lore: *"The Wises equip every new prisoner with basic weapons before their first fight. Entertainment requires at least a show."*

## 4.2 Archetypes
| Archetype | Attack | Defense | SpellPower | Knowledge |
|---|---|---|---|---|
| Warrior | 4 | 2 | 1 | 1 |
| Mage | 1 | 0 | 3 | 3 |
| Ranger | 2 | 2 | 2 | 2 |
| Sentinel | 0 | 4 | 2 | 2 |

Archetype defines starting primary stats only — it does not constrain deck composition.

## 4.3 Hero Primary Stats
| Stat | Effect |
|---|---|
| Attack | Multiplier on unit damage output |
| Defense | Multiplier on damage reduction |
| SpellPower | Multiplier on spell effectiveness |
| Knowledge | Increases maximum mana cap |

## 4.4 Stat Formulas

**Effective unit attack:**
```
effectiveAttack = baseAttack × (1 + hero.attack × attackMultiplier)
attackMultiplier = 0.1 + (Attack trait level × 0.1)
```

**Effective defense:**
```
damageReduction = hero.defense × defenseMultiplier
defenseMultiplier = 0.1 + (Defense trait level × 0.1)
finalDamage = incomingDamage × (1 - damageReduction)
```

**Effective spell power:**
```
effectiveSpellPower = baseSpellPower × (1 + hero.spellPower × spellMultiplier)
spellMultiplier = 0.1 + (Power trait level × 0.1)
```

**Maximum mana:**
```
maxMana = 12 × (1 + hero.knowledge × 0.1)
```

## 4.5 Hero Progression
- **Max level**: 50
- **Per level up**:
  - Player chooses which primary stat receives +1
  - System presents 2 pseudo-random trait options
  - Player selects 1
- **Trait seed**: `hash(playerAddress + seasonId + heroLevel)` — deterministic, verifiable, same options every time for same player/season/level
- **Season reset**: Hero archived as NFT at season end, new hero created
- **Archived hero NFT**: Tradeable collectible. Final stats, peak ELO, season rank permanently on-chain

## 4.6 Hero HP
- **Base HP**: 30
- Hero cannot be attacked while any friendly unit is alive on the board
- When all units are dead the barrier drops and hero is exposed
- Ranged units attack hero directly from any distance once barrier is down
- Melee units must reach hero's off-grid position (adjacent to grid edge)
- Hero death = match loss

## 4.7 Starting Traits
Each faction × archetype combination grants one specific starting trait defined in GameConfig. Expandable per season.

---

# 5. Trait System

## 5.1 Structure
- Every level up presents 2 pseudo-randomly selected traits
- Player chooses 1
- Same trait can be selected multiple times — each selection increases its level
- All traits available to all archetypes — no pool restrictions

## 5.2 Combat Traits (max level 10)
| Trait | Effect | Scaling |
|---|---|---|
| Attack | Increases unit damage multiplier | +0.1 to attackMultiplier per level |
| Defense | Increases unit damage reduction multiplier | +0.1 to defenseMultiplier per level |
| Power | Increases spell effectiveness multiplier | +0.1 to spellMultiplier per level |
| Critical Strike | Chance for units to deal 1.5× damage | +3% crit chance per level, cap 30% |
| Armor Penetration | Ignores part of enemy physical defense | +5% penetration per level, cap 50% |
| Damage Reduction | Flat % reduction from all incoming damage | +3% per level, cap 30% |
| Vitality | Increases unit max HP | +5% HP bonus per level, cap 50% |

## 5.3 Magic Traits (max level 10)
| Trait | Effect | Scaling |
|---|---|---|
| Wisdom | Reduces spell failure chance | -2% failure per level, minimum 1% |
| Spell Focus | Increases spell power consistency | +2% effective spell power per level |
| Arcane Mastery | Boosts all spells | -1 mana cost per 2 levels, +5% dmg per level |

## 5.4 Passive Traits (max level 5)
| Trait | Effect | Scaling |
|---|---|---|
| Mana Growth | Increases mana gained per turn | +1 mana per 2 levels |
| Last Stand | Stat bonus when hero HP is low | +5% all unit stats per level when hero HP < 30% |
| Momentum Scaling | Bonus after kills | +2% attack per kill per level, resets each turn |

*Note: Tactical traits (hero abilities that consume unit activations) removed in v3.0 simplification. May be reintroduced in future versions.*

---

# 6. Card System

## 6.1 NFT vs Game Card Separation

**NFT (ownership layer — immutable):**
- Lives on Base Sepolia
- Represents ownership, trading rights, collection value
- Never modified, burned, or affected by gameplay
- Metadata: owner sees hero-modified stats via tokenURI; non-owners see base stats only
- This prevents marketplace confusion where buyers see seller's hero-modified stats

**Game Card (battle layer — temporary):**
- Snapshot copy created at match start from selected deck
- Stats computed from GameConfig at snapshot time with hero stats applied
- Used, consumed, sent to graveyard freely during match
- Match ends → all game cards discarded, NFTs completely untouched

**Deck copy rule:**
- Owning 1 NFT = permission to use 1 copy in deck
- To include 2 copies of a card, player must own 2 NFTs of that card
- Ownership verified at deck validation before match start

## 6.2 Unit Card Stats
| Stat | Description |
|---|---|
| Attack | Base damage per attack |
| Defense | Base damage reduction |
| HP | Base hit points |
| Initiative | Turn order priority (higher = sooner) |
| Speed | Maximum action points per activation |
| Ammo | Ranged shots (0 = melee only) |
| Mana Cost | Mana required to deploy |
| Size | 1 = 1×1 cell, 2 = 2×2 cells |
| Magic Resistance | % flat reduction to all incoming spell damage |
| Rarity | Common / Rare / Epic / Legendary |
| Faction | Castle / Inferno / Necropolis / Dungeon |

*Note: School immunity, effect immunity, and unit abilities removed in v3.0 simplification. Fields remain in contract structs (zeroed) for future use.*

## 6.3 Spell Card Stats
| Stat | Description |
|---|---|
| Spell Power | Base effectiveness (damage / heal / scaling) |
| Duration | Turns the effect lasts (0 = instant) |
| Target Type | SINGLE / ALL_ENEMIES / ALL_ALLIES / AREA / HERO |
| Mana Cost | Mana required to cast |
| Success Chance | Base % chance to succeed (failure cap 5–10%) |

*Note: Spell school field removed in v3.0 — all spells are generic.*

## 6.4 Spell Failure
- Base failure chance: 5–10% cap for normal spells
- Stronger spells may have slightly higher base failure, still capped
- Wisdom trait reduces failure chance (minimum 1% always)
- On failure: spell burned (sent to graveyard permanently), mana spent, no effect, NFT unaffected
- On success: spell resolves, then returns to bottom of owner's deck for future redraw
- Lore: arcana stamp interferes with cast

## 6.5 Status Effects (deferred — implemented last)

Status effects are applied by spells. No immunity system — all units can be affected by all effects.

| Effect | Mechanic |
|---|---|
| SLOW | Reduces unit Speed by effect value |
| POISON | Deals damage at start of unit activation |
| BURN | Deals damage at start of unit activation |
| ROOTS | Unit cannot move; can still attack |
| BLIND | Unit completely skips activation |
| FREEZE | Unit skips activation + takes damage |

- Duration effects tick at start of affected unit's activation
- Casting same effect on same target replaces existing duration (not stacked)
- Unit death removes all active effects

*Note: Ability structs, school/effect immunities, spell restrictions, FEAR, CURSE, SILENCE, CONFUSION removed in v3.0 simplification. Contract structs retain these fields (zeroed) for future use.*

## 6.9 Base Stat Ranges by Rarity (rough estimates)
| Rarity | Attack | HP | Defense |
|---|---|---|---|
| Common | 5–10 | 30–50 | 3–8 |
| Rare | 10–18 | 50–70 | 8–15 |
| Epic | 18–28 | 70–90 | 15–22 |
| Legendary | 28–40 | 90–120 | 22–30 |

## 6.10 Card Set Size
- 4 factions × 6–8 units = 24–32 unit cards
- 8–12 generic spells (damage, heal, buff, debuff)
- Total base set: 32–44 cards

## 6.11 Graveyard
- Cards played from hand enter the board as active game cards (unit model appears on grid)
- When a unit dies its game card moves to the graveyard
- **Spell recycling**: on successful resolution, spell card returns to the bottom of the owner's deck (not graveyard)
- **Spell failure burn**: on failed resolution, spell card moves to graveyard permanently (burned for the match)
- This applies universally — all players, all archetypes — but Mages benefit most due to higher spell count, SpellPower, and Wisdom investment
- Graveyard is match-scoped only — no economic impact
- NFTs never affected by graveyard or burn mechanics

*Note: Resurrection spells and ability cooldowns removed in v3.0 simplification.*

## 6.12 Snapshot Immutability
- At match start a complete snapshot is taken: deck stats, hero stats, GameConfig values
- Snapshot is immutable for the entire match duration
- No external changes (GameConfig updates, hero level-ups) affect an ongoing match
- Match always resolves on the exact state it started with

---

# 7. Deck Building

## 7.1 Rules
- **Deck size**: exactly 20 cards
- **Copy limits by rarity**: Common 4, Rare 3, Epic 2, Legendary 1
- **Cross-faction**: allowed — no restrictions on card ownership or deck composition
- **No archetype or card-type composition rules** — any mix of units/spells is valid
- **NFT ownership**: 1 NFT = 1 deck copy. 2 copies requires owning 2 NFTs

## 7.2 Deck Selection Flow
1. Player selects exactly 20 cards from owned NFT collection
2. Deck validated against composition rules (rejected if invalid)
3. Deck saved off-chain (no gas)
4. At match start: deck snapshot created with current GameConfig stats + hero stats applied
5. Match runs entirely on snapshot — no chain interaction until match end

---

# 8. Battle System

## 8.1 Grid
- **Type**: Hex grid (exact dimensions TBD — user provides renderer)
- **From each player's perspective they are always Player 1** — grid mirrors accordingly
- **Hero positions**: off-grid at opposite edges
- **Player halves**: grid split evenly between players
- **Deployment zones**: first 2 rows on each player's side

**Match ID:**
```
matchId = hash(player1Address + player2Address + blockTimestamp + nonce)
```
Seed for all in-game JS random events. Deterministic and agreed by both players at match start.

## 8.2 Starting Hand, Draw & Hand Limit
- **Starting hand**: 4 cards drawn at match start
- **Per turn draw**: 1 card at end of each turn
- **Maximum hand size**: 6 — if hand is full, drawn card is discarded
- **Hand is private**: opponent cannot see it

## 8.3 Mana
- **Starting mana**: 5
- **Per turn gain**: +1 base (modified by Mana Growth trait)
- **Maximum cap**: `12 × (1 + hero.knowledge × 0.1)`
- **Mana accumulates** up to cap — unspent mana carries over between turns
- **Shared pool**: same mana for deploying units and casting spells

## 8.3.1 Deployment Rules
- Units deployed only in valid deployment zone cells
- Cannot deploy in a cell occupied by any unit (friendly or enemy)
- Enemy units in your deployment zone do not block other valid cells
- Deployed unit acts on the following turn, not the turn it is deployed

## 8.4 Turn Structure
```
Turn begins
↓
All units on both sides sorted by initiative (high → low)
↓
Each unit activates in order.
Controlling player chooses ONE of:

  OPTION A — Unit Action:
    Spend action points (Speed value):
    - Move: 1 point per hex
    - Attack: consumes ALL remaining points (ends activation)
    Can move then attack, or just attack in place

  OPTION B — Card Action (max 1 per full turn):
    Play 1 card (deploy unit OR cast spell) — costs mana
    → This unit SKIPS its action this turn
↓
After all units activated:
  Draw 1 card (discard if hand full)
  Turn ends
```

**Zero units rule:**
If a player has 0 units on board at turn start, before initiative order begins they receive 1 free action:
- Play 1 card (deploy unit OR cast spell)

**Turn timer**: 45 seconds per unit activation. Failure to act triggers arcana stamp damage.

## 8.5 Movement & Action System
Each unit has a Speed value = total action points per activation:
- **Move**: 1 point per hex
- **Attack**: consumes ALL remaining points — always last action

Unit may move freely up to its speed, then attack. Once attack is used, activation ends. Units cannot pass through occupied hexes. When a unit dies, its hex becomes vacant immediately.

## 8.6 Combat

### Melee Units (Ammo = 0)
- Must be in adjacent hex to attack
- Always full effective damage regardless of grid position
- Can reach hero when adjacent to hero's off-grid position
- Retaliation: target retaliates once per turn by default

### Ranged Units (Ammo > 0)
- Can attack from any hex
- **Same half as target**: full damage
- **Enemy half target**: damage × 0.5
- **Blocked by adjacent enemy melee**: damage × 0.5
- Both conditions: damage × 0.25
- Ammo decrements per shot — at 0 ammo unit can no longer shoot (does NOT become melee)
- "Blocked" = enemy unit on adjacent hex
- Can attack hero directly once barrier down, any distance (while ammo > 0)

### Unit Size
- Size 1: occupies 1×1 cell (default for all common, rare, most epic)
- Size 2: occupies 2×2 cells (large legendary units — dragons, giants, golems)
- Position of size 2 unit = top-left cell of the 2×2 block
- Movement checks all occupied cells are free before moving
- Attack range measured from nearest cell of the block to target
- Deployment requires 2×2 free space in deployment zone
- Targeting a size 2 unit: any of its 4 cells can be targeted, damage applies to unit once

### Retaliation
- Attacked unit retaliates once per turn by default
- Disabled if: defender has ROOTS effect

### AOE
- By default all attacks and spells hit single target
- AOE defined per spell's target type:
  - `ALL_ENEMIES` — all enemy units
  - `ALL_ALLIES` — all friendly units
  - `AREA` — hexes around target hex

### Initiative Ties
Same initiative → higher Speed goes first. Same Speed → JS random roll (seeded from matchId). Deterministic and verifiable.

### Critical Strike
```
if random(0,100) < (critTraitLevel × 3): damage × 1.5
```

## 8.7 Card Actions
- Maximum **1 card action per full turn** — once used, no more cards this turn
- Triggered during any unit's activation window
- Playing a card costs that unit its activation
- **Deploy unit**: pay mana, place in valid zone, unit acts next turn
- **Cast spell**: pay mana, resolve spell, goes to graveyard

## 8.8 Hero Barrier & Targeting
- Hero cannot be targeted while any friendly unit is alive
- Barrier drops when last friendly unit dies
- Ranged units attack hero from any position once barrier down
- Melee units must move adjacent to hero's off-grid position
- Hero cannot attack — acts only through card actions

## 8.9 Win Condition & Draw
- Hero HP reaches 0 = defeat
- Last hero standing wins

**Simultaneous death resolution:**
1. Higher current HP → wins
2. Equal HP → lower accumulated stamp damage → wins
3. Equal stamp damage → **DRAW**: both ETH bets returned, no ELO change

## 8.10 Turn Timer & Timeout
- **Per activation timer**: 45 seconds
- Failure to act → arcana stamp deals damage to hero:
  - Timeout 1 → 3 damage
  - Timeout 2 → 6 damage
  - Timeout 3 → 12 damage
  - Timeout 4+ → 24 damage (capped)
- Hero dies from stamp damage → opponent wins automatically
- Disconnection handled entirely by timeout mechanic — no special state needed
- If player reconnects before hero dies → match resumes normally

---

# 9. Combat Formulas

```
// Effective Attack
effectiveAttack = baseAttack × (1 + hero.attack × attackMultiplier)
attackMultiplier = 0.1 + (Attack trait level × 0.1)

// Effective Defense
damageReduction = hero.defense × defenseMultiplier
defenseMultiplier = 0.1 + (Defense trait level × 0.1)
finalDamage = rawDamage × (1 - damageReduction)

// Magic Resistance (spell damage only)
finalSpellDamage = rawSpellDamage × (1 - unit.magicResistance / 100)

// Armor Penetration (physical only, does NOT affect magic resistance)
effectiveDefense = targetDefense × (1 - armorPenTraitLevel × 0.05)

// Effective Spell Power
effectiveSpellPower = baseSpellPower × (1 + hero.spellPower × spellMultiplier)
spellMultiplier = 0.1 + (Power trait level × 0.1)

// Spell Duration (for duration-based spells, baseDuration stored in contract)
effectiveDuration = baseDuration + floor(hero.spellPower × 0.2)

// Spell Damage/Heal (scaling notation: "base + multiplier×")
effectiveSpellValue = baseSpellPower + floor(effectiveSpellPower × spellScalingMultiplier)
// e.g. Healing "15 + 2.0×": 15 + floor(effectiveSpellPower × 2.0)

// Arcane Mastery (all spells)
adjustedManaCost = max(1, baseManaCost - floor(arcaneMasteryLevel / 2))
adjustedSpellDmg = baseSpellDmg × (1 + arcaneMasteryLevel × 0.05)

// Mana Cap
maxMana = 12 × (1 + hero.knowledge × 0.1)

// Critical Strike
if random(0,100) < (critTraitLevel × 3): damage × 1.5

// Ranged Damage Modifiers
if targetOnEnemyHalf: damage × 0.5
if attackerBlocked:   damage × 0.5
// both conditions: damage × 0.25

// Vitality
effectiveHP = baseHP × (1 + vitalityTraitLevel × 0.05)

// Spell Failure
failRoll = random(0, 100)
failChance = baseFailChance - (Wisdom trait level × 2%)
failChance = max(1%, failChance)
if failRoll < failChance: spell burned to graveyard, mana spent, no effect

// ELO Floor
ELO minimum = 0, cannot go negative

// ELO Soft Reset (season end)
newELO = currentELO + (1000 - currentELO) × 0.5
```

---

# 10. Pack System

## 10.1 Pack Tiers
| Tier | Price | Cards | Guarantee |
|---|---|---|---|
| Common Pack | 0.001–0.003 ETH | 3–5 | Mostly commons |
| Rare Pack | 0.005–0.01 ETH | 5 | 1 Rare or higher |
| Epic Pack | 0.015–0.03 ETH | 5–7 | 1 Epic or higher |
| Legendary Pack | 0.05–0.1 ETH | 7 | 1 Legendary |

## 10.2 Drop Rate System
- Admin defines card pool per pack tier in GameConfig
- Base card prices defined per card by admin
- Drop probabilities computed from TWAP (7-day time weighted average) of marketplace activity
- Cards without sufficient trade history (< 10 unique trades) use admin base price as fallback
- Known limitation: TWAP manipulation via wash trading is possible — documented, economically costly

## 10.3 Pack Opening Flow
1. Player sends ETH to PackOpening contract
2. Contract requests Chainlink VRF randomness
3. VRF callback triggers card minting
4. Cards minted as NFTs directly to player wallet
5. Frontend listens for mint events → triggers pack opening animation

## 10.4 Admin Pack Controls
- Admin defines which cards drop per pack tier
- Admin rotates cards in/out of active pool
- Admin sets/updates pack prices
- Admin cannot modify existing minted NFTs or player balances
- All changes logged as on-chain events

---

# 11. Marketplace

## 11.1 Listing
- Any NFT owner can list for a fixed ETH price
- Listings stored on-chain
- Owner cancels at any time, no fee

## 11.2 Buying
- Buyer sends ETH = listing price
- Contract atomically: transfers ETH to seller minus royalty, transfers NFT to buyer, pays royalty
- Fully atomic — completes entirely or reverts

## 11.3 Royalties
- Rate: 2.5–3% on every secondary sale
- ERC-2981 standard
- Applied automatically, cannot be bypassed in official marketplace

## 11.4 Security
- Atomic execution — no partial fills
- Reentrancy guards on all ETH transfers
- Checks-Effects-Interactions pattern enforced

---

# 12. Duel System

## 12.1 Duel Creation & Bet Locking
1. Player A creates duel, sends ETH bet (minimum 0.001 ETH), sets minimum acceptable opponent bet
2. Player B accepts, sends ETH bet
3. `lockedBet = min(playerA.bet, playerB.bet)`
4. Excess ETH refunded immediately
5. Match begins

```
lockedBet = min(playerA.bet, playerB.bet)
totalPot = lockedBet × 2
fee = totalPot × 5%
winnerPayout = totalPot - fee
```

Fee goes to protocol treasury.

## 12.2 Why Betting Is Fair
- Players only bet on themselves — no third-party betting
- Match fixing requires deliberately losing your own ETH — no incentive
- Minimum bet prevents dust spam
- Capping to smaller bet prevents wealth intimidation

## 12.3 State Channel Architecture
- All game moves happen off-chain
- Both players sign each game state update
- Final signed state submitted to contract by either player
- Contract verifies both signatures and declared outcome
- Contract pays winner, updates ELO, records match

## 12.4 Dispute Resolution

**Opponent timeout:**
- Opponent fails to act within 45 seconds → stamp damages their hero
- Stamp damage escalates: 3 → 6 → 12 → 24 (capped)
- Hero dies → submitting player wins automatically
- Disconnection handled by timeout — no special state needed

**Final state submission window:**
- Both players have 24-hour window after match ends to submit final signed state
- Either player can submit — contract accepts first valid submission with both signatures
- If winner goes offline: loser cannot submit falsified state (requires both signatures)
- If neither submits within 24 hours: both bets refunded, no ELO change
- Invalid/single-signed state → rejected, ignored

**Invalid final state:**
- Contract verifies both signatures
- Invalid state → rejected, no funds moved
- Known limitation: full game state validation on-chain is complex — frontend enforces rules, contract enforces signatures and settlement

## 12.5 Hero Season Archiving
- Season end timestamp stored on-chain at season start
- Archiving triggered automatically when timestamp reached
- Permissionless trigger — callable by anyone after timestamp
- Season winner's hero minted as Legendary NFT automatically
- All ELO soft-reset on same trigger

## 12.6 Match Flow
```
1. Both players lock ETH in contract
2. Deck snapshots created, hero stats applied
3. Game plays out off-chain via state channel
4. Both players sign final state
5. Either player submits final signed state within 24h
6. Contract verifies signatures
7. ETH distributed: winner receives pot minus 5% fee
8. ELO updated on-chain for both players
9. Match record permanently stored on-chain
```

---

# 13. Matchmaking & Queue System

## 13.1 Queue Types

**Ranked Queue:**
- ELO bracket card restrictions enforced
- ELO affected on win/loss
- Freedom (season leaderboard) progress counts
- Minimum bet 0.001 ETH required

**Unranked Queue:**
- No card restrictions — all rarities allowed
- ELO unaffected
- No season leaderboard progress
- Optional bet, no minimum
- Practice and flex mode

## 13.2 ELO Bracket Card Restrictions (Ranked Only)
| ELO Range | Allowed Cards |
|---|---|
| 0–1200 | Common + Rare only |
| 1200–1600 | Common + Rare + Epic |
| 1600+ | All cards including Legendary |

- Bracket promotion triggers immediately after match ELO calculation
- Bracket is sticky — once reached cannot be demoted
- Deck validated against bracket restrictions before match starts
- Invalid deck → player prompted to adjust before entering queue

---

# 14. ELO & Season System

## 14.1 ELO as Freedom Metric
ELO = one number serving both purposes:
- Competitive matchmaking ranking
- Season leaderboard position
- Goes up on wins, down on losses
- ELO floor: 0 (cannot go negative)
- Top player by ELO at season end wins

## 14.2 ELO Calculation
- Starting ELO: 1000
- Hidden during calibration (first 25 matches)
- After 25 matches: ELO visible and counts toward leaderboard
- Standard ELO formula, K-factor 32
- Bracket promotion triggers immediately after post-match ELO calculation
- ELO history permanently immutable on-chain

**ELO soft reset at season end:**
```
newELO = currentELO + (1000 - currentELO) × 0.5
Example: 1800 → 1800 + (1000 - 1800) × 0.5 = 1400
```

## 14.3 Season Structure
- **Season length**: 90 days
- Top player by ELO at season end wins
- Season winner:
  - Hero archived as Legendary NFT
  - Added to next season's pack pool — drops like any other Legendary
  - Wallet permanently marked "Freed" on-chain
- All ELO soft-reset automatically via on-chain timestamp trigger
- New hero creation required for new season
- Archived hero NFT is tradeable

---

# 15. Admin System

## 15.1 Admin Powers

**Admin CAN:**
- Add new card types to GameConfig
- Modify existing card stats (subject to covenant)
- Rotate cards in/out of pack pools
- Set/update pack prices and contents
- Set season start/end timestamps
- Distribute goodwill pack rewards at discretion
- Upgrade game logic contracts
- Set ELO K-factor and fee percentage
- Define starter deck composition

**Admin CANNOT:**
- Modify NFT ownership records
- Transfer player ETH
- Modify player ELO retroactively
- Change royalty recipient after deployment
- Upgrade NFT ownership contracts
- Access locked duel funds

## 15.2 Admin Panel
Protected page accessible only by admin wallet:

**Card Management:**
- Upload base card illustration (uploads to IPFS)
- Set card name, faction, rarity, school
- Set base stats (attack, defense, HP, initiative, speed, ammo, mana cost)
- Set magic resistance
- Set spell parameters if spell card
- Preview card before publishing
- Publish card (makes droppable)
- Unpublish / rotate out of packs

**Pack Management:**
- Create pack tiers
- Define card pool per tier
- Set prices and card count ranges
- Activate / deactivate tiers

**Season Management:**
- Start / end seasons
- View season standings
- Trigger goodwill reward distributions

**Analytics:**
- Platform volume
- Active players
- Most traded cards
- ELO distribution

## 15.3 Transparency
- All GameConfig changes emit on-chain events with timestamp
- Permanent change history visible on block explorer
- Players can subscribe to events to monitor all balance changes

---

# 16. Security

## 16.1 Smart Contract Security
- Checks-Effects-Interactions on all ETH transfers
- ReentrancyGuard on all payable functions
- Access control modifiers on all admin functions
- Solidity 0.8+ integer overflow protection
- No block.timestamp or block.hash for randomness
- Chainlink VRF for all on-chain randomness
- In-game randomness: JS random seeded from matchId — deterministic, same for both players

## 16.2 Known Limitations & Documented Vulnerabilities

**TWAP Oracle Manipulation:**
- Wash trading can manipulate drop probabilities
- Mitigation: minimum 10 unique trades before TWAP activates, base price fallback
- Residual risk: documented

**VRF Front-Running:**
- Chainlink VRF commitment scheme prevents outcome prediction before reveal
- Residual risk: negligible, documented

**State Channel Game Logic:**
- Contract only verifies signatures and settlement — cannot verify every game move
- Frontend enforces game rules, contract enforces financial outcome
- Collusion produces no financial gain (players only bet on themselves)
- Residual risk: documented

**Sybil ELO Farming:**
- 25-match calibration period before ELO counts
- New accounts start at 1000 — farming them gives negligible gains
- Residual risk: documented

**Admin Key Compromise:**
- Multisig wallet for admin strongly recommended
- Timelock on contract upgrades strongly recommended
- Residual risk: documented

## 16.3 Asset Preservation Guarantees (Immutable by Contract)
- NFT ownership transfers always atomic
- Locked duel ETH flows only to winner or timeout claimant
- Royalty percentage fixed at deployment
- ELO history append-only and immutable
- Match results permanently recorded
- No mechanism exists to burn, modify, or confiscate player NFTs

---

# 17. Frontend

## 17.1 Pages
| Page | Description |
|---|---|
| Home | Connect wallet, hero overview, season standings, ELO rank |
| Collection | View owned NFTs, filter by faction/rarity/type |
| Deck Builder | Build, validate, save decks from collection |
| Pack Opening | Buy and open packs with animated card reveal |
| Marketplace | Browse listings, list cards, buy cards |
| Duel Lobby | Create or accept duels, set bet, view open duels |
| Battle | 2D hex grid with animated sprites (WebGPU renderer) |
| Hero Profile | Stats, traits, ELO history, season progress, archived heroes |
| Admin Panel | Card/pack/season management (admin wallet only) |

## 17.2 Battle UI Requirements
- 2D hex grid with WebGPU renderer (imported from external project)
- Animated 2D sprites: idle, walk, attack, death
- Spell visual effects
- Initiative order queue displayed
- Mana bar, hero HP bar, unit HP bars above units
- Hand at bottom, opponent hand count shown (face down)
- 45-second activation timer with visual urgency
- Graveyard count displayed
- Transaction status overlay (pending / confirmed / failed)

## 17.3 Wallet Integration
- MetaMask and WalletConnect via wagmi connectors
- All transactions show pending / confirmed / failed states
- Gas estimation before user confirms
- Network validation — warning if not on Base Sepolia
- Wallet disconnect handling mid-session

---

# 18. Technical Stack

## 18.1 Blockchain
- **Network**: Base Sepolia (testnet)
- **Language**: Solidity 0.8+
- **Framework**: Foundry (forge, cast, anvil, chisel)
- **Testing**: Foundry Solidity tests + fuzz/invariant tests
- **Local development**: Anvil local testnet
- **Deployment**: Forge scripts
- **Verification**: Basescan
- **Randomness**: Chainlink VRF

## 18.2 Frontend
- **Framework**: React + Vite
- **Blockchain interaction**: wagmi
- **Low level Ethereum**: viem (used internally by wagmi)
- **Battle rendering**: WebGPU (2D hex grid, animated sprites — imported renderer)
- **Wallet support**: MetaMask, WalletConnect via wagmi connectors

## 18.3 Development Workflow
```
1. Write contract in Solidity
2. Write Foundry tests → forge test
3. Deploy to Anvil local → test in frontend
4. Iterate
5. Deploy to Base Sepolia → forge script
6. Verify on Basescan
7. Update README with contract addresses
```

## 18.4 Contract Architecture

**Immutable — never upgraded:**
- `CardNFT` — ERC-721 ownership, dynamic tokenURI, starter deck minting
- `HeroNFT` — ERC-721 hero ownership and season archiving
- `Marketplace` — listings, atomic trades, ERC-2981 royalties
- `FreedomRecord` — permanent on-chain record of freed wallets per season

**Upgradeable — game logic (OpenZeppelin Transparent Proxy):**
- `GameConfig` — card stats, abilities, pack pools, balance values
- `DuelManager` — match creation, state channel settlement, ELO
- `PackOpening` — Chainlink VRF, minting logic
- `SpellEngine` — spell resolution, effect application (deferred)

## 18.5 Randomness Sources
| Event | Source |
|---|---|
| Pack opening | Chainlink VRF |
| Trait options at level up | hash(address + seasonId + heroLevel) |
| In-game crits / spell failure | JS random seeded from matchId |
| Match ID | hash(player1Address + player2Address + blockTimestamp + nonce) |

---

# 19. Pre-Launch Checklist

**Game Design:**
- [ ] All faction × archetype starting trait assignments defined
- [ ] Full card roster (24–32 units, 8–12 spells) with balanced stats
- [ ] Starter deck composition defined in GameConfig
- [ ] Hex grid dimensions finalized
- [ ] N-game calibration count confirmed (proposed: 25)

**Smart Contracts:**
- [ ] All contracts deployed and verified on Base Sepolia
- [ ] Admin multisig wallet configured
- [ ] Timelock on upgrade functions implemented
- [ ] Chainlink VRF subscription funded
- [ ] Smart contract audit completed (strongly recommended)
- [ ] All deployment addresses in README

**Assets:**
- [ ] All card art generated and uploaded to IPFS
- [ ] All 2D unit sprites with animations (idle, walk, attack, death)
- [ ] Spell visual effects implemented
- [ ] Admin panel card creation workflow tested

**Frontend:**
- [ ] State channel stress tested
- [ ] All transaction states handled
- [ ] Network mismatch handling implemented
- [ ] Wallet disconnect mid-match handled

---

*Arcana Arena GDD v3.0 — Simplified Core*
*v3.0 changes: removed spell schools, unit abilities, immunities, tactical traits. Simplified to melee/ranged combat on hex grid with stat-modifier traits. Status effects deferred. Battle UI changed from 3D isometric to 2D hex with WebGPU renderer and animated sprites.*
*Balance changes announced on-chain. Asset preservation guaranteed by immutable contracts.*