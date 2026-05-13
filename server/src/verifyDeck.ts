import { createPublicClient, http, parseAbi } from 'viem';
import { foundry, sepolia } from 'viem/chains';

const CARD_NFT_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function cardIdOf(uint256 tokenId) view returns (uint256)',
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
    const balance = await client.readContract({
      address: CARD_NFT_ADDRESS as `0x${string}`,
      abi: CARD_NFT_ABI,
      functionName: 'balanceOf',
      args: [playerAddress as `0x${string}`],
    });

    const ownedCardIds = new Map<number, number>();
    for (let i = 0; i < Number(balance); i++) {
      const tokenId = await client.readContract({
        address: CARD_NFT_ADDRESS as `0x${string}`,
        abi: CARD_NFT_ABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [playerAddress as `0x${string}`, BigInt(i)],
      });
      const cardId = await client.readContract({
        address: CARD_NFT_ADDRESS as `0x${string}`,
        abi: CARD_NFT_ABI,
        functionName: 'cardIdOf',
        args: [tokenId],
      });
      const cid = Number(cardId);
      ownedCardIds.set(cid, (ownedCardIds.get(cid) ?? 0) + 1);
    }

    const needed = new Map<number, number>();
    for (const cid of deckCardIds) {
      needed.set(cid, (needed.get(cid) ?? 0) + 1);
    }

    for (const [cid, count] of needed) {
      const owned = ownedCardIds.get(cid) ?? 0;
      if (owned < count) {
        return { valid: false, reason: `You don't own enough copies of card ${cid} (need ${count}, have ${owned})` };
      }
    }

    return { valid: true };
  } catch (err) {
    console.error('Deck verification failed:', (err as Error).message);
    return { valid: true };
  }
}
