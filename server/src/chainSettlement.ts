import { createWalletClient, http, parseAbi, defineChain } from 'viem';
import { foundry, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const DUEL_MANAGER_ABI = parseAbi([
  'function arbiterSettle(uint256 duelId, address winner) external',
]);

const HERO_NFT_ABI = parseAbi([
  'function addXp(uint256 heroId, uint32 amount) external',
]);

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const DUEL_MANAGER_ADDRESS = process.env.DUEL_MANAGER_ADDRESS || '';
const ARBITER_PRIVATE_KEY = process.env.ARBITER_PRIVATE_KEY || '';
const CHAIN_ID = Number(process.env.CHAIN_ID || 31337);

function getChain() {
  if (CHAIN_ID === 11155111) return sepolia;
  return foundry;
}

function getClient() {
  if (!ARBITER_PRIVATE_KEY) return null;
  const account = privateKeyToAccount(ARBITER_PRIVATE_KEY as `0x${string}`);
  return createWalletClient({
    account,
    chain: getChain(),
    transport: http(RPC_URL),
  });
}

export async function settleOnChain(duelId: number, winnerAddress: string): Promise<string> {
  if (!DUEL_MANAGER_ADDRESS) {
    console.warn('Chain settlement skipped: DUEL_MANAGER_ADDRESS not set');
    return '';
  }
  const client = getClient();
  if (!client) {
    console.warn('Chain settlement skipped: ARBITER_PRIVATE_KEY not set');
    return '';
  }

  try {
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
  const client = getClient();
  if (!client) return '';

  try {
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
