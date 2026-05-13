import { createPublicClient, http, parseAbi } from 'viem';
import { foundry, sepolia } from 'viem/chains';

const CARD_NFT_ABI = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenCardId(uint256 tokenId) view returns (uint256)',
]);

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const CARD_NFT_ADDRESS = process.env.CARD_NFT_ADDRESS || '';
const CHAIN_ID = Number(process.env.CHAIN_ID || 31337);

function getClient() {
  return createPublicClient({
    chain: CHAIN_ID === 11155111 ? sepolia : foundry,
    transport: http(RPC_URL),
  });
}

export async function verifyDeckOwnership(playerAddress: string, deckCardIds: number[]): Promise<{ valid: boolean; reason?: string }> {
  if (!CARD_NFT_ADDRESS) {
    console.warn('Deck verification skipped: CARD_NFT_ADDRESS not set');
    return { valid: true };
  }

  try {
    const client = getClient();
    const addr = CARD_NFT_ADDRESS as `0x${string}`;
    const player = playerAddress.toLowerCase();

    const totalSupply = await client.readContract({
      address: addr, abi: CARD_NFT_ABI, functionName: 'totalSupply',
    });

    const total = Number(totalSupply);
    const ownedCardCounts = new Map<number, number>();

    const ownerCalls = Array.from({ length: total }, (_, i) => ({
      address: addr, abi: CARD_NFT_ABI, functionName: 'ownerOf' as const, args: [BigInt(i)],
    }));

    const owners = await client.multicall({ contracts: ownerCalls });

    const ownedTokenIds: number[] = [];
    for (let i = 0; i < total; i++) {
      const r = owners[i];
      if (r.status === 'success' && (r.result as string).toLowerCase() === player) {
        ownedTokenIds.push(i);
      }
    }

    const cardIdCalls = ownedTokenIds.map(tid => ({
      address: addr, abi: CARD_NFT_ABI, functionName: 'tokenCardId' as const, args: [BigInt(tid)],
    }));

    const cardIds = await client.multicall({ contracts: cardIdCalls });

    for (let i = 0; i < cardIds.length; i++) {
      const r = cardIds[i];
      if (r.status === 'success') {
        const cid = Number(r.result as bigint);
        ownedCardCounts.set(cid, (ownedCardCounts.get(cid) ?? 0) + 1);
      }
    }

    const needed = new Map<number, number>();
    for (const cid of deckCardIds) {
      needed.set(cid, (needed.get(cid) ?? 0) + 1);
    }

    for (const [cid, count] of needed) {
      const owned = ownedCardCounts.get(cid) ?? 0;
      if (owned < count) {
        return { valid: false, reason: `Not enough copies of card ${cid} (need ${count}, own ${owned})` };
      }
    }

    return { valid: true };
  } catch (err) {
    console.error('Deck verification error:', (err as Error).message);
    return { valid: true };
  }
}
