# Arcana Arena — Session State

## Current Phase: 1 — CardNFT + GameConfig + On-chain SVG

## What's Done
- **Phase 0 complete**: Foundry + React/Vite toolchain verified end-to-end
  - Foundry project with OpenZeppelin (contracts + upgradeable)
  - HelloWorld contract, 4 passing tests, deploy script
  - React + Vite + wagmi + viem frontend
  - ABI sync script (forge build → typed TS)
  - Anvil deploy → MetaMask → frontend reads contract greeting

## What's Next (Phase 1)
- CardNFT contract (ERC-721, dynamic tokenURI with on-chain SVG)
- GameConfig contract (card stats, admin setters, change events)
- Pin peasant.png and imp.png to IPFS
- SVG tokenURI: embed IPFS card image + overlay dynamic stat text
- ERC-2981 royalties on CardNFT
- Test: mint cards, view on OpenSea testnet with dynamic stats

## Dev Workflow
```bash
# Terminal 1: anvil
# Terminal 2: PRIVATE_KEY=0xac09...ff80 forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Terminal 3: cd frontend && npm run dev
# After contract changes: forge build && cd ../frontend && npm run sync-abi
```

## Key Files
- `contracts/src/` — Solidity contracts
- `contracts/test/` — Foundry tests
- `contracts/script/Deploy.s.sol` — Deployment script
- `frontend/src/wagmi.ts` — Chain/wallet config
- `frontend/scripts/sync-abi.mjs` — ABI sync (add new contract names to CONTRACTS array)
