#!/usr/bin/env bash
# Redeploy all Arcana phases to an ALREADY RUNNING Anvil, then sync frontend addresses.
# Usage: bash scripts/redeploy-anvil.sh
# Optional: RPC_URL=http://127.0.0.1:8545  PRIVATE_KEY=0x...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
export PRIVATE_KEY

cd "$ROOT/contracts"

if ! cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "error: no RPC at $RPC_URL — start Anvil first." >&2
  exit 1
fi

log_extract() {
  local file="$1"
  local needle="$2"
  grep -F "$needle" "$file" | tail -1 | grep -oE '0x[0-9a-fA-F]{40}' | tail -1
}

forge_broadcast() {
  local label="$1"
  shift
  local out
  out="$(mktemp)"
  echo "==> $label" >&2
  forge script "$@" --rpc-url "$RPC_URL" --broadcast --private-key "$PRIVATE_KEY" 2>&1 | tee "$out" >&2
  echo "$out"
}

P1_OUT="$(forge_broadcast "DeployPhase1" script/DeployPhase1.s.sol:DeployPhase1)"
GAME_CONFIG="$(log_extract "$P1_OUT" "GameConfig proxy:")"
CARD_NFT="$(log_extract "$P1_OUT" "CardNFT:")"
rm -f "$P1_OUT"

if [[ -z "$GAME_CONFIG" || -z "$CARD_NFT" ]]; then
  echo "error: failed to parse Phase 1 (gameConfig / cardNFT)" >&2
  exit 1
fi

PROXY_ADMIN="$(cast admin "$GAME_CONFIG" --rpc-url "$RPC_URL")"

export GAME_CONFIG_PROXY="$GAME_CONFIG"
export CARD_NFT="$CARD_NFT"
export PROXY_ADMIN="$PROXY_ADMIN"
P2_OUT="$(forge_broadcast "DeployPhase2" script/DeployPhase2.s.sol:DeployPhase2)"
HERO_NFT="$(log_extract "$P2_OUT" "HeroNFT:")"
rm -f "$P2_OUT"

if [[ -z "$HERO_NFT" ]]; then
  echo "error: failed to parse Phase 2 (heroNFT)" >&2
  exit 1
fi

export GAME_CONFIG_PROXY="$GAME_CONFIG"
export CARD_NFT="$CARD_NFT"
P6_OUT="$(forge_broadcast "DeployPhase6" script/DeployPhase6.s.sol:DeployPhase6)"
PACK_OPENING="$(log_extract "$P6_OUT" "PackOpening proxy:")"
rm -f "$P6_OUT"

if [[ -z "$PACK_OPENING" ]]; then
  echo "error: failed to parse Phase 6 (packOpening)" >&2
  exit 1
fi

export CARD_NFT="$CARD_NFT"
export PACK_OPENING_PROXY="$PACK_OPENING"
P4_OUT="$(forge_broadcast "DeployPhase4" script/DeployPhase4.s.sol:DeployPhase4)"
MARKETPLACE="$(log_extract "$P4_OUT" "Marketplace:")"
rm -f "$P4_OUT"

if [[ -z "$MARKETPLACE" ]]; then
  echo "error: failed to parse Phase 4 (marketplace)" >&2
  exit 1
fi

P7_OUT="$(forge_broadcast "DeployPhase7" script/DeployPhase7.s.sol:DeployPhase7)"
DUEL_MANAGER="$(log_extract "$P7_OUT" "DuelManager proxy:")"
FREEDOM="$(log_extract "$P7_OUT" "FreedomRecord:")"
rm -f "$P7_OUT"

if [[ -z "$DUEL_MANAGER" || -z "$FREEDOM" ]]; then
  echo "error: failed to parse Phase 7 (duelManager / freedomRecord)" >&2
  exit 1
fi

ANVIL_TS="$ROOT/frontend/src/deployments/anvil.ts"
cat > "$ANVIL_TS" << EOF
/**
 * Auto-synced by scripts/redeploy-anvil.sh — Anvil at ${RPC_URL}
 * Re-run after restarting Anvil from a blank state.
 */
export const ARCANA_ANVIL_LOCAL = {
  gameConfig: "${GAME_CONFIG}",
  cardNFT: "${CARD_NFT}",
  heroNFT: "${HERO_NFT}",
  packOpening: "${PACK_OPENING}",
  marketplace: "${MARKETPLACE}",
  duelManager: "${DUEL_MANAGER}",
  freedomRecord: "${FREEDOM}",
} as const;
EOF

echo "VITE_CONTRACT_TARGET=anvil" > "$ROOT/frontend/.env.local"

echo "" >&2
echo "Synced $ANVIL_TS and frontend/.env.local" >&2
echo "gameConfig=$GAME_CONFIG cardNFT=$CARD_NFT heroNFT=$HERO_NFT" >&2
echo "packOpening=$PACK_OPENING marketplace=$MARKETPLACE" >&2
echo "duelManager=$DUEL_MANAGER freedomRecord=$FREEDOM" >&2
