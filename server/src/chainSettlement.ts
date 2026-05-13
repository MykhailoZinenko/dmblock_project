import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const DUEL_MANAGER_ABI = parseAbi([
  'function arbiterSettle(uint256 duelId, address winner) external',
  'function duels(uint256) view returns (address player1, address player2, uint256 lockedBet, uint8 status, uint256 createdAt, uint256 settledAt, address winner)',
]);

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const DUEL_MANAGER_ADDRESS = process.env.DUEL_MANAGER_ADDRESS || '';
const ARBITER_PRIVATE_KEY = process.env.ARBITER_PRIVATE_KEY || '';

export async function settleOnChain(duelId: number, winnerAddress: string): Promise<string> {
  if (!DUEL_MANAGER_ADDRESS || !ARBITER_PRIVATE_KEY) {
    console.warn('Chain settlement skipped: DUEL_MANAGER_ADDRESS or ARBITER_PRIVATE_KEY not set');
    return '';
  }

  try {
    const account = privateKeyToAccount(ARBITER_PRIVATE_KEY as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: foundry,
      transport: http(RPC_URL),
    });

    const hash = await client.writeContract({
      address: DUEL_MANAGER_ADDRESS as `0x${string}`,
      abi: DUEL_MANAGER_ABI,
      functionName: 'arbiterSettle',
      args: [BigInt(duelId), winnerAddress as `0x${string}`],
    });

    console.log(`Duel ${duelId} settled on-chain. TX: ${hash}`);
    return hash;
  } catch (err) {
    console.error(`Chain settlement failed for duel ${duelId}:`, (err as Error).message);
    return '';
  }
}

export async function addXpOnChain(heroNftAddress: string, heroId: number, amount: number): Promise<string> {
  const HERO_NFT_ABI = parseAbi([
    'function addXp(uint256 heroId, uint32 amount) external',
  ]);

  if (!ARBITER_PRIVATE_KEY) return '';

  try {
    const account = privateKeyToAccount(ARBITER_PRIVATE_KEY as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: foundry,
      transport: http(RPC_URL),
    });

    const hash = await client.writeContract({
      address: heroNftAddress as `0x${string}`,
      abi: HERO_NFT_ABI,
      functionName: 'addXp',
      args: [BigInt(heroId), amount],
    });

    return hash;
  } catch (err) {
    console.error(`XP grant failed for hero ${heroId}:`, (err as Error).message);
    return '';
  }
}
