# Full Stack Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the complete Arcana Arena stack — contracts on Base Sepolia, frontend on Vercel, signaling/arbiter server on Fly.io — so two players on different machines can play.

**Architecture:** Environment-based config switches between local (Anvil + localhost) and production (Base Sepolia + Vercel + Fly.io). Frontend reads contract addresses and signaling URL from Vite env vars. Server is a Docker container on Fly.io.

**Tech Stack:** Foundry (deploy), Vercel CLI (frontend), Fly.io CLI (server), Vite env vars.

**Assumes:** Phase 10 multiplayer is implemented and verified locally per the Phase 10 plan.

---

## Prerequisites

- GitHub repo: `https://github.com/MykhailoZinenko/dmblock_project.git`
- Deployer wallet: `0x81b8D225Be9a6164e6af0b60928814e19Aa2bE90`
- Deployer balance: ~0.01 ETH on Base Sepolia (**needs topping up — deploy costs ~0.05-0.1 ETH total**)
- Base Sepolia RPC: `https://sepolia.base.org`
- Phase 1 already deployed: GameConfig proxy `0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177`, CardNFT `0xD43f5617d8df0E3D02130DdAeb35e0192878c1De`

---

## Task 1: Get Base Sepolia ETH

The deployer has ~0.01 ETH. Deploying Phase 2 + 4 + 7 + setting arbiter costs roughly 0.05–0.1 ETH.

- [ ] **Step 1: Get testnet ETH from faucets**

Visit these faucets (pick any that work):

```
https://www.alchemy.com/faucets/base-sepolia
https://faucet.quicknode.com/base/sepolia
https://docs.base.org/docs/tools/network-faucets/
```

Request ETH to: `0x81b8D225Be9a6164e6af0b60928814e19Aa2bE90`

- [ ] **Step 2: Verify balance**

```bash
cast balance 0x81b8D225Be9a6164e6af0b60928814e19Aa2bE90 --rpc-url https://sepolia.base.org --ether
```

Expected: at least 0.05 ETH

---

## Task 2: Deploy contracts to Base Sepolia

Phase 1 (GameConfig + CardNFT) is already deployed. Deploy remaining phases.

- [ ] **Step 1: Deploy Phase 2 (HeroNFT)**

First get the ProxyAdmin address for GameConfig:

```bash
cd contracts
cast admin 0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177 --rpc-url https://sepolia.base.org
```

Save the output as `PROXY_ADMIN`. Then deploy:

```bash
source .env && \
PRIVATE_KEY=$BASE_SEPOLIA_PRIVATE_KEY \
GAME_CONFIG_PROXY=0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177 \
CARD_NFT=0xD43f5617d8df0E3D02130DdAeb35e0192878c1De \
PROXY_ADMIN=<PROXY_ADMIN_FROM_ABOVE> \
forge script script/DeployPhase2.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

Record output: **HeroNFT address**.

- [ ] **Step 2: Deploy Phase 4 (Marketplace)**

```bash
source .env && \
PRIVATE_KEY=$BASE_SEPOLIA_PRIVATE_KEY \
CARD_NFT=0xD43f5617d8df0E3D02130DdAeb35e0192878c1De \
forge script script/DeployPhase4.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

Record output: **Marketplace address**.

- [ ] **Step 3: Deploy Phase 7 (DuelManager + FreedomRecord)**

```bash
source .env && \
PRIVATE_KEY=$BASE_SEPOLIA_PRIVATE_KEY \
forge script script/DeployPhase7.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

Record output: **DuelManager proxy address**, **FreedomRecord address**.

- [ ] **Step 4: Verify contracts on Basescan**

If `--verify` flag didn't work (needs BASESCAN_API_KEY), verify manually:

```bash
# Get a free API key from https://basescan.org/myapikey
# Add to contracts/.env: BASESCAN_API_KEY=<your_key>

# Then verify each contract:
forge verify-contract <HERO_NFT_ADDRESS> src/HeroNFT.sol:HeroNFT \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address)" 0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177 0xD43f5617d8df0E3D02130DdAeb35e0192878c1De)
```

- [ ] **Step 5: Record all addresses**

Create or update a record with all Base Sepolia addresses:

```
GameConfig proxy:  0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177  (Phase 1)
CardNFT:           0xD43f5617d8df0E3D02130DdAeb35e0192878c1De  (Phase 1)
HeroNFT:           <from step 1>
Marketplace:       <from step 2>
DuelManager proxy: <from step 3>
FreedomRecord:     <from step 3>
```

- [ ] **Step 6: Commit address record**

Update `CLAUDE.md` with the new addresses under the Base Sepolia section.

```bash
git add CLAUDE.md
git commit -m "docs: add Phase 2/4/7 Base Sepolia deployment addresses"
```

---

## Task 3: Generate arbiter wallet for signaling server

The signaling/arbiter server needs its own wallet to sign dispute resolutions.

- [ ] **Step 1: Generate a new private key**

```bash
cast wallet new
```

Save the output:
- **Address:** (this is the arbiter address)
- **Private key:** (this goes into Fly.io secrets — NEVER commit)

- [ ] **Step 2: Fund the arbiter wallet**

The arbiter only needs enough ETH to call `arbiterSettle()` (~0.001 ETH per call). Send a small amount:

```bash
source contracts/.env && \
cast send <ARBITER_ADDRESS> --value 0.005ether \
  --private-key $BASE_SEPOLIA_PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

- [ ] **Step 3: Register arbiter on DuelManager**

```bash
source contracts/.env && \
cast send <DUEL_MANAGER_PROXY> "setArbiter(address)" <ARBITER_ADDRESS> \
  --private-key $BASE_SEPOLIA_PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

Verify:

```bash
cast call <DUEL_MANAGER_PROXY> "arbiter()(address)" --rpc-url https://sepolia.base.org
```

Expected: the arbiter address you just set.

---

## Task 4: Environment-based config for frontend

Make `contracts.ts` read addresses from Vite env vars so the same code works locally and on Base Sepolia.

**Files:**
- Create: `frontend/.env.local` (local dev, gitignored)
- Create: `frontend/.env.production` (Base Sepolia, committed)
- Modify: `frontend/src/contracts.ts`

- [ ] **Step 1: Create .env.local for local dev**

Create `frontend/.env.local`:

```env
VITE_CHAIN=foundry
VITE_GAMECONFIG=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
VITE_CARDNFT=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
VITE_HERONFT=0x4A679253410272dd5232B3Ff7cF5dbB88f295319
VITE_MARKETPLACE=0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf
VITE_PACKOPENING=0x0000000000000000000000000000000000000000
VITE_DUELMANAGER=0xe1708FA6bb2844D5384613ef0846F9Bc1e8eC55E
VITE_FREEDOMRECORD=0x0aec7c174554AF8aEc3680BB58431F6618311510
VITE_SIGNALING_URL=ws://localhost:3001
```

Note: `.env.local` is auto-gitignored by Vite. These addresses change per Anvil restart — update after each redeploy.

- [ ] **Step 2: Create .env.production for Base Sepolia**

Create `frontend/.env.production`:

```env
VITE_CHAIN=baseSepolia
VITE_GAMECONFIG=0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177
VITE_CARDNFT=0xD43f5617d8df0E3D02130DdAeb35e0192878c1De
VITE_HERONFT=<HERO_NFT_ADDRESS>
VITE_MARKETPLACE=<MARKETPLACE_ADDRESS>
VITE_PACKOPENING=0x0000000000000000000000000000000000000000
VITE_DUELMANAGER=<DUEL_MANAGER_PROXY_ADDRESS>
VITE_FREEDOMRECORD=<FREEDOM_RECORD_ADDRESS>
VITE_SIGNALING_URL=wss://<YOUR_FLY_APP>.fly.dev
```

Fill in real addresses from Task 2 and the Fly.io URL from Task 6.

- [ ] **Step 3: Update contracts.ts to read env vars**

Replace the hardcoded ADDRESSES in `frontend/src/contracts.ts`:

```typescript
const e = import.meta.env;

export const ADDRESSES = {
  gameConfig: e.VITE_GAMECONFIG as `0x${string}`,
  cardNFT: e.VITE_CARDNFT as `0x${string}`,
  heroNFT: e.VITE_HERONFT as `0x${string}`,
  marketplace: e.VITE_MARKETPLACE as `0x${string}`,
  packOpening: e.VITE_PACKOPENING as `0x${string}`,
  duelManager: e.VITE_DUELMANAGER as `0x${string}`,
  freedomRecord: e.VITE_FREEDOMRECORD as `0x${string}`,
} as const;

export const SIGNALING_URL = e.VITE_SIGNALING_URL ?? "ws://localhost:3001";
```

- [ ] **Step 4: Update wagmi.ts to use env chain**

Modify `frontend/src/wagmi.ts` so it picks the right chain:

```typescript
import { http, createConfig } from "wagmi";
import { baseSepolia, foundry } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const chain = import.meta.env.VITE_CHAIN === "baseSepolia" ? baseSepolia : foundry;
const rpcUrl = chain.id === foundry.id
  ? "http://127.0.0.1:8545"
  : "https://sepolia.base.org";

export const config = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: {
    [chain.id]: http(rpcUrl),
  },
});
```

- [ ] **Step 5: Update ConnectionManager to use SIGNALING_URL**

In `frontend/src/multiplayer/ConnectionManager.ts` (or wherever it's instantiated in Battle.tsx), import and use:

```typescript
import { SIGNALING_URL } from "../contracts";
// ...
const conn = new ConnectionManager(SIGNALING_URL);
```

- [ ] **Step 6: Add Vite env type declarations**

Create `frontend/src/vite-env.d.ts` (or append to existing):

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN: string;
  readonly VITE_GAMECONFIG: string;
  readonly VITE_CARDNFT: string;
  readonly VITE_HERONFT: string;
  readonly VITE_MARKETPLACE: string;
  readonly VITE_PACKOPENING: string;
  readonly VITE_DUELMANAGER: string;
  readonly VITE_FREEDOMRECORD: string;
  readonly VITE_SIGNALING_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 7: Verify local dev still works**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`, connect wallet on Foundry chain, verify pages load.

- [ ] **Step 8: Verify production build works**

```bash
cd frontend && npm run build
```

Expected: `dist/` folder created with no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/.env.production frontend/src/contracts.ts frontend/src/wagmi.ts frontend/src/vite-env.d.ts
git commit -m "feat: environment-based config for local/Base Sepolia deployment"
```

---

## Task 5: Deploy signaling server to Fly.io

**Files:**
- Create: `server/Dockerfile`
- Create: `server/.dockerignore`
- Create: `server/fly.toml`

- [ ] **Step 1: Install Fly.io CLI**

```bash
brew install flyctl
```

- [ ] **Step 2: Login to Fly.io**

```bash
fly auth login
```

This opens a browser. Sign up or log in (free tier, no credit card needed for initial allowance).

- [ ] **Step 3: Create Dockerfile**

Create `server/Dockerfile`:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY . .
EXPOSE 3001
ENV PORT=3001
CMD ["npx", "tsx", "src/index.ts"]
```

Create `server/.dockerignore`:

```
node_modules
dist
*.md
```

- [ ] **Step 4: Create fly.toml**

Create `server/fly.toml`:

```toml
app = "arcana-arena-signaling"
primary_region = "iad"

[build]

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[services]]
  protocol = "tcp"
  internal_port = 3001

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port = 80
    handlers = ["http"]

[env]
  PORT = "3001"
```

- [ ] **Step 5: Launch the app on Fly.io**

```bash
cd server
fly launch --name arcana-arena-signaling --region iad --no-deploy
```

If it asks to overwrite fly.toml, say no (keep ours).

- [ ] **Step 6: Set arbiter private key as secret**

```bash
fly secrets set ARBITER_PRIVATE_KEY=<THE_KEY_FROM_TASK_3_STEP_1> --app arcana-arena-signaling
```

This is stored encrypted — never visible in logs or config.

- [ ] **Step 7: Deploy**

```bash
cd server
fly deploy
```

Expected output includes the URL: `https://arcana-arena-signaling.fly.dev`

- [ ] **Step 8: Verify server is running**

```bash
# Test WebSocket connection
npx wscat -c wss://arcana-arena-signaling.fly.dev
> {"type":"join","duelId":999,"address":"0xtest"}
```

Expected: connection opens, no immediate error. (Won't get `paired` since no second client.)

- [ ] **Step 9: Update .env.production with server URL**

Edit `frontend/.env.production`:

```env
VITE_SIGNALING_URL=wss://arcana-arena-signaling.fly.dev
```

- [ ] **Step 10: Commit**

```bash
git add server/Dockerfile server/.dockerignore server/fly.toml frontend/.env.production
git commit -m "feat: Fly.io deployment config for signaling server"
```

---

## Task 6: Deploy frontend to Vercel

- [ ] **Step 1: Install Vercel CLI**

```bash
npm i -g vercel
```

- [ ] **Step 2: Login to Vercel**

```bash
vercel login
```

Sign up or log in with GitHub.

- [ ] **Step 3: Link project**

```bash
cd frontend
vercel link
```

When prompted:
- Set up and deploy? **Y**
- Which scope? (your account)
- Link to existing project? **N** (create new)
- Project name: **arcana-arena**
- Framework: **Vite**
- Root directory: `.` (since you're already in `frontend/`)

- [ ] **Step 4: Set environment variables on Vercel**

```bash
vercel env add VITE_CHAIN production
# Enter: baseSepolia

vercel env add VITE_GAMECONFIG production
# Enter: 0x38341C8B98e7A0e036fD27C4829Aa147CeAe9177

vercel env add VITE_CARDNFT production
# Enter: 0xD43f5617d8df0E3D02130DdAeb35e0192878c1De

vercel env add VITE_HERONFT production
# Enter: <HERO_NFT_ADDRESS>

vercel env add VITE_MARKETPLACE production
# Enter: <MARKETPLACE_ADDRESS>

vercel env add VITE_PACKOPENING production
# Enter: 0x0000000000000000000000000000000000000000

vercel env add VITE_DUELMANAGER production
# Enter: <DUEL_MANAGER_PROXY>

vercel env add VITE_FREEDOMRECORD production
# Enter: <FREEDOM_RECORD_ADDRESS>

vercel env add VITE_SIGNALING_URL production
# Enter: wss://arcana-arena-signaling.fly.dev
```

- [ ] **Step 5: Deploy**

```bash
cd frontend
vercel --prod
```

Expected output: a URL like `https://arcana-arena-XXXX.vercel.app`

- [ ] **Step 6: Verify in browser**

1. Open the Vercel URL
2. Connect MetaMask on Base Sepolia network
3. Verify Home page loads, nav works
4. If you have a hero on Base Sepolia, verify collection shows cards
5. Navigate to `/duels` — should show "No Hero" or the lobby if hero exists

- [ ] **Step 7: Set up auto-deploy from GitHub (optional)**

Vercel auto-detects pushes to `main` if linked to GitHub. To configure:

1. Go to `https://vercel.com/dashboard`
2. Select the project
3. Settings → Git → Connect to `MykhailoZinenko/dmblock_project`
4. Set root directory to `frontend`
5. Set build command to `npm run build`
6. Set output directory to `dist`

Now every `git push origin main` auto-deploys.

- [ ] **Step 8: Commit vercel config if generated**

```bash
git add frontend/.vercel/project.json 2>/dev/null
git commit -m "feat: Vercel deployment config" 2>/dev/null || echo "nothing to commit"
```

---

## Task 7: End-to-end testnet verification

- [ ] **Step 1: Create hero on Base Sepolia**

1. Open the Vercel URL in Browser 1
2. Connect wallet (Account with Base Sepolia ETH)
3. Create a hero (faction + archetype)
4. Verify hero appears on Home page

- [ ] **Step 2: Build a deck**

1. Navigate to `/decks`
2. Build a valid 20-card deck from starter cards
3. Save it

- [ ] **Step 3: Create a duel**

1. Navigate to `/duels`
2. Create a duel with 0.001 ETH bet
3. Verify it appears in "My Open Duels"

- [ ] **Step 4: Accept from second account**

1. Open the Vercel URL in Browser 2 (different MetaMask account with Base Sepolia ETH)
2. Create hero + build deck
3. Navigate to `/duels`
4. See the open duel in "Open Challenges"
5. Accept it

- [ ] **Step 5: Enter battle**

1. Both browsers navigate to `/battle?duel=<duelId>`
2. Verify WebRTC connects via Fly.io signaling server
3. Both see "Battle started!"
4. Play a few moves — verify state syncs

- [ ] **Step 6: Settle on-chain**

1. When one hero dies, verify both see result
2. Winner submits settlement transaction
3. Verify ETH payout on Basescan

---

## Quick Reference: All URLs

| Service | URL |
|---------|-----|
| Frontend | `https://arcana-arena-XXXX.vercel.app` |
| Signaling Server | `wss://arcana-arena-signaling.fly.dev` |
| Base Sepolia RPC | `https://sepolia.base.org` |
| Basescan | `https://sepolia.basescan.org` |
| Deployer | `0x81b8D225Be9a6164e6af0b60928814e19Aa2bE90` |

## Redeployment Cheat Sheet

```bash
# Redeploy server after code changes:
cd server && fly deploy

# Redeploy frontend after code changes:
cd frontend && vercel --prod

# Or just push to main (if Vercel GitHub auto-deploy is set up):
git push origin main
```
