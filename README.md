# Arcana Arena

**DMBLOCK • Assignment 2 — Decentralized Applications**

## Project Description

Arcana Arena is a tactical card-battle dApp on Base Sepolia. Players mint hero
and card NFTs, open randomized booster packs, trade cards on an in-game
marketplace, and duel opponents on a hex grid with units, spells, and status
effects. Card ownership, hero progression, pack drops, marketplace trades, and
duel outcomes are all settled on-chain — the frontend is a thin client over
the contracts plus a custom WebGPU renderer and a deterministic TypeScript
battle engine.

The goal is to demonstrate a full vertical slice of a Web3 game: NFT minting
with on-chain stat data, royalty-aware secondary trading, VRF-driven pack
randomness, and an upgradeable game-config layer that lets us patch balance
without redeploying ownership contracts.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                   │
│   wagmi/viem  •  custom WebGPU engine  •  TS battle logic   │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐         ┌──────────────┐
   │ CardNFT  │        │ HeroNFT  │         │ GameConfig   │
   │ (ERC721) │        │ (ERC721) │         │ (upgradeable)│
   └────┬─────┘        └────┬─────┘         └──────┬───────┘
        │                   │                      │
        │       reads stats / ability data         │
        ├───────────────────┼──────────────────────┤
        ▼                   ▼                      ▼
   ┌──────────────┐   ┌──────────────┐    ┌────────────────┐
   │ PackOpening  │   │ DuelManager  │    │  Marketplace   │
   │ (VRF, mints) │◄──┤ (game logic) │    │ (ERC2981 fees) │
   └──────┬───────┘   └──────────────┘    └────────┬───────┘
          │                                        │
          └────── recordTrade(cardId, price) ◄─────┘
                  (stats hook, only-marketplace)
```

**Contract layer**

- **GameConfig** *(upgradeable, Transparent Proxy)* — single source of truth
  for card definitions, abilities, starter decks, and starting traits. Admin
  edits balance here; all other contracts read live.
- **CardNFT** *(immutable, ERC-721 + ERC-2981)* — card token, `tokenURI`
  composes art from IPFS with live stats overlaid by `SVGRenderer`.
- **HeroNFT** *(immutable, ERC-721)* — hero ownership, level-ups, starter
  pack minting.
- **PackOpening** *(upgradeable)* — Chainlink VRF v2.5 consumer. Mints
  packs by tier; records mint counts and accepts trade telemetry from the
  marketplace.
- **Marketplace** *(immutable)* — escrow-based listings with royalty splits.
  On every successful buy it calls `PackOpening.recordTrade` so admin can see
  trade volumes / TWAP per card.
- **DuelManager** *(upgradeable)* — turn-based duel state, deck shuffle,
  initiative queue.
- **FreedomRecord** *(immutable)* — append-only on-chain match history.

**Frontend**

- React + Vite, wagmi v2 hooks (`useReadContracts`, `useWriteContract`,
  `useWaitForTransactionReceipt`), viem for ABI encoding.
- An admin panel that drives GameConfig & PackOpening (card CRUD, tier pool
  config, per-card pricing/TWAP) and surfaces live mint/trade stats.
- `frontend/src/game/` — pure-TS deterministic battle logic (turn flow,
  initiative queue, AP model, pathfinding, spell casting, status effects,
  combat resolution). Backed by 339 unit tests.
- `frontend/src/engine/` — custom WebGPU renderer; `BattleScene` and
  `AnimationController` handle sprites, HP bars, FX, and per-unit
  animation state.
- Duel Lobby page gated behind hero ownership + valid deck.

## Deployment Details

- **Network:** Base Sepolia (Chain ID `84532`)
- **Block explorer:** [sepolia.basescan.org](https://sepolia.basescan.org)

> Addresses below are placeholders — fill in once Base Sepolia deployment
> is finalized.

| Contract        | Address              | Explorer link        |
| --------------- | -------------------- | -------------------- |
| GameConfig      | `<TBD>`              | `<TBD>`              |
| CardNFT         | `<TBD>`              | `<TBD>`              |
| HeroNFT         | `<TBD>`              | `<TBD>`              |
| PackOpening     | `<TBD>`              | `<TBD>`              |
| Marketplace     | `<TBD>`              | `<TBD>`              |
| DuelManager     | `<TBD>`              | `<TBD>`              |
| FreedomRecord   | `<TBD>`              | `<TBD>`              |

Contracts will be verified on Basescan with the same compiler config used
locally (`solc 0.8.28`, `via_ir = true`, optimizer enabled).

## Setup Instructions

**Requirements:** Node 20+, Foundry, a funded Base Sepolia wallet for testing
writes.

```bash
# 1. Clone & install
git clone <repo-url> && cd dmblock_project

# 2. Contracts: build & test
cd contracts
forge install
forge build
forge test            # 145+ tests passing

# 3. Local devnet (separate terminal)
anvil

# 4. Deploy locally
PRIVATE_KEY=0xac0974... \
  forge script script/DeployPhase1.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Then DeployPhase2..6 in the same fashion (see CLAUDE.md for the full chain).

# 5. Frontend
cd ../frontend
npm install
npm run dev           # http://localhost:5173
```

To target Base Sepolia, set `BASE_SEPOLIA_PRIVATE_KEY` and
`BASE_SEPOLIA_RPC_URL` in `contracts/.env` and use `--rpc-url
$BASE_SEPOLIA_RPC_URL` in the deploy scripts. Frontend addresses live in
[frontend/src/contracts.ts](frontend/src/contracts.ts).

## Known Limitations

- **VRF on local dev** uses a mock coordinator — real Chainlink
  subscriptions must be funded before packs work on Base Sepolia.
- **TWAP** is a per-trade running mean, not time-weighted. Fine for the
  admin dashboard, not for in-contract pricing.
- **Battle simulation** is client-side; only the final duel outcome is
  settled on-chain. A multiplayer state-channel design (Phase 10) is drafted
  in [docs/](docs/) but not yet implemented.
- **No mobile layout** for the admin panel and battle view — desktop only.

## What I Learned

Mostly a lot of practical reps on composing dependent contracts:
threading addresses through deploy phases without circular dependencies,
keeping ownership contracts (CardNFT, Marketplace) immutable while still
being able to evolve game logic via upgradeable proxies, and gating
cross-contract hooks (`only-marketplace` on `recordTrade`) so trade
telemetry can't be spoofed. Also got comfortable with the wagmi/viem split
where viem decodes small Solidity uints (`uint16`/`uint64`) to JS `number`
but `uint256` to `bigint` — a footgun the first time you sum them.

## Conclusion

A working end-to-end NFT game slice: upgradeable game config, immutable
ownership, VRF-driven minting, royalty-aware marketplace with on-chain
telemetry, and a wagmi-driven admin panel. Plenty of polish left, but the
contract surface and frontend wiring are sound.

## AI Disclosure

- **Claude** (Anthropic) — assisted with contract scaffolding, frontend
  component implementations, and visual/styling work.
- **Codex** (OpenAI) — used as a commit helper for managing git (staging,
  commit messages, branch sync).

All architectural decisions, testing, and final code review were done by
the authors.
