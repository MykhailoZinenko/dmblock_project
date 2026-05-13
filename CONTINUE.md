# Arcana Arena — Session State

**Last updated:** 2026-05-13

## Current State: Authoritative Match Server — Deployed

### What was done this session
- Extracted pure game logic into `packages/game-core` (npm workspace)
- Rewrote server as authoritative match server (MatchRuntime per duel)
- EIP-712 session auth + per-action HMAC signing
- Server handles ALL turn flow (priority phase, auto-pass on 0 AP, compound move+attack, spell ends activation)
- Client is pure renderer — sends intents, receives state snapshots + animation events
- Per-seat state serialization (opponent hand/deck/RNG hidden)
- On-chain settlement via `arbiterSettle` after game-over
- On-chain XP granting via `addXp` after each match
- On-chain deck ownership verification (multicall totalSupply/ownerOf/tokenCardId)
- ELO system (K=32, server-side, persisted to file, served via HTTP API)
- Post-match results overlay (XP gained, ELO change, turn count)
- Level-up UI with XP threshold check
- Reconnect support (re-auth → match-started with current state)
- Hotseat moved to Visual Test 14 (`/tests/visual/14`)
- Deployed: Vercel (frontend) + Fly.io (server) + Sepolia (contracts)

### Deployment
- **Frontend:** https://dmblock-project-frontend.vercel.app/
- **Server:** https://arcana-arena-server.fly.dev/
- **Chain:** Ethereum Sepolia (11155111)
- **Contracts:** see `frontend/src/deployments/sepolia.ts`
- **Arbiter + XP granter:** `0x81b8D225Be9a6164e6af0b60928814e19Aa2bE90`

### Known issues / not implemented
- Hero stats (attack/defense/spellPower/knowledge) not applied to battle formulas
- 13 trait effects not implemented
- On-chain randomness (VRF) — seed is deterministic from duelId
- Dual-sig settlement unused (only arbiterSettle)
- ELO not on-chain (server-side only, HeroData struct lacks the field)
- Spell recycling (success → deck bottom, failure → graveyard)
- Initiative determinism bug (same-initiative units always same order after first roll)
- Animation sequencing has timing issues (move+attack overlap)
- Game-end is overlay, not dedicated results page
- Freedom Record not wired to server ELO
- Match count may not increment via arbiterSettle

### Server env vars (Fly.io)
```
PORT=3001
CHAIN_ID=11155111
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
DUEL_MANAGER_ADDRESS=0x3e7DC4775031bD3CF9d2e97d99BD5F48Be54094B
HERO_NFT_ADDRESS=0x2FB7FA959EbaB2B6786B244a09e99CF72B37f297
CARD_NFT_ADDRESS=0xa4616f3f5b1fa4B8B895727c878C6Cf524e25afD
ARBITER_PRIVATE_KEY=(fly secret)
```

### Frontend env vars (Vercel)
```
VITE_CONTRACT_TARGET=sepolia
VITE_CHAIN_ID=11155111
VITE_SERVER_URL=wss://arcana-arena-server.fly.dev
```
