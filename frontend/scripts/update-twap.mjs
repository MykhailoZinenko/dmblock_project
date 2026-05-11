#!/usr/bin/env node
/**
 * Reads Marketplace `Sold` events from the last 7 days, computes a per-cardId
 * average sale price + trade count, and writes them back to PackOpening via
 * setCardPrice. PackOpening uses TWAP only when uniqueTrades >= 10 (otherwise
 * falls back to the admin base price), so this script is safe to run even
 * when activity is sparse.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node frontend/scripts/update-twap.mjs
 *
 * Optional env:
 *   RPC_URL              default http://127.0.0.1:8545
 *   MARKETPLACE          marketplace address
 *   PACK_OPENING         pack-opening proxy address
 *   CARD_NFT             card-nft address
 *   WINDOW_SECONDS       default 604800 (7 days)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MARKETPLACE = process.env.MARKETPLACE ?? "0x202CCe504e04bEd6fC0521238dDf04Bc9E8E15aB";
const PACK_OPENING = process.env.PACK_OPENING ?? "0x4EE6eCAD1c2Dae9f525404De8555724e3c35d07B";
const CARD_NFT = process.env.CARD_NFT ?? "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E";
const WINDOW_SECONDS = BigInt(process.env.WINDOW_SECONDS ?? 7 * 24 * 60 * 60);

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY env var is required (must be PackOpening owner).");
  process.exit(1);
}

const soldEvent = parseAbiItem(
  "event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint96 priceWei, address royaltyReceiver, uint256 royaltyAmount)"
);

const cardNftAbi = parseAbi(["function tokenCardId(uint256) view returns (uint256)"]);
const packAbi = parseAbi([
  "function adminBasePriceWei(uint256) view returns (uint96)",
  "function setCardPrice(uint256 cardId, uint96 basePriceWei, uint96 currentTwapPriceWei, uint16 tradeCount) external",
]);

const publicClient = createPublicClient({ transport: http(RPC_URL) });
const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, transport: http(RPC_URL) });

async function main() {
  const latestBlock = await publicClient.getBlock();
  const cutoff = latestBlock.timestamp - WINDOW_SECONDS;
  console.log(`Window: last ${WINDOW_SECONDS} seconds (since block timestamp ${cutoff})`);

  // Pull every Sold event from genesis — fine for testnet/anvil. For mainnet
  // scale this would need block-range chunking + a persisted cursor.
  const logs = await publicClient.getLogs({
    address: MARKETPLACE,
    event: soldEvent,
    fromBlock: 0n,
    toBlock: "latest",
  });
  console.log(`Found ${logs.length} total Sold events`);

  // Join each event with its block timestamp + cardId, filter to the window.
  const recent = [];
  const blockCache = new Map();
  for (const log of logs) {
    let ts = blockCache.get(log.blockNumber);
    if (ts === undefined) {
      const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
      ts = block.timestamp;
      blockCache.set(log.blockNumber, ts);
    }
    if (ts < cutoff) continue;

    const cardId = await publicClient.readContract({
      address: CARD_NFT,
      abi: cardNftAbi,
      functionName: "tokenCardId",
      args: [log.args.tokenId],
    });
    recent.push({ cardId, priceWei: log.args.priceWei });
  }
  console.log(`${recent.length} events fall inside the window`);

  // Aggregate per cardId: arithmetic mean of prices + trade count.
  const aggregates = new Map();
  for (const sale of recent) {
    const key = sale.cardId.toString();
    const acc = aggregates.get(key) ?? { sum: 0n, count: 0, cardId: sale.cardId };
    acc.sum += sale.priceWei;
    acc.count += 1;
    aggregates.set(key, acc);
  }

  if (aggregates.size === 0) {
    console.log("No trades in window — nothing to update.");
    return;
  }

  for (const { cardId, sum, count } of aggregates.values()) {
    const twap = sum / BigInt(count);
    const basePrice = await publicClient.readContract({
      address: PACK_OPENING,
      abi: packAbi,
      functionName: "adminBasePriceWei",
      args: [cardId],
    });

    if (basePrice === 0n) {
      console.log(`Skip card ${cardId}: no admin base price set`);
      continue;
    }

    console.log(
      `Card ${cardId}: ${count} trades, twap=${twap} wei, basePrice=${basePrice} wei` +
        (count >= 10 ? " (TWAP will be used)" : " (count < 10, base price used)")
    );

    const hash = await walletClient.writeContract({
      address: PACK_OPENING,
      abi: packAbi,
      functionName: "setCardPrice",
      args: [cardId, basePrice, twap, Math.min(count, 65535)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  -> setCardPrice tx ${hash}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
