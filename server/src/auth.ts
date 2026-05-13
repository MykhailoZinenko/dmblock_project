import { createHmac, createHash, randomBytes } from 'crypto';
import { verifyTypedData } from 'viem';
import { canonicalizeAction, type GameAction } from './protocol.js';

const SESSION_DOMAIN = {
  name: 'Arcana Arena' as const,
  chainId: 84532,
};

const SESSION_TYPES = {
  Session: [
    { name: 'duelId', type: 'uint256' },
    { name: 'player', type: 'address' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'expiresAt', type: 'uint256' },
  ],
} as const;

export function generateNonce(): string {
  return '0x' + randomBytes(32).toString('hex');
}

export async function verifySession(
  address: string,
  duelId: number,
  nonce: string,
  expiresAt: number,
  signature: `0x${string}`,
): Promise<boolean> {
  try {
    const valid = await verifyTypedData({
      address: address as `0x${string}`,
      domain: SESSION_DOMAIN,
      types: SESSION_TYPES,
      primaryType: 'Session',
      message: {
        duelId: BigInt(duelId),
        player: address as `0x${string}`,
        nonce: nonce as `0x${string}`,
        expiresAt: BigInt(expiresAt),
      },
      signature,
    });
    return valid;
  } catch {
    return false;
  }
}

export function deriveSessionKey(signature: string): Buffer {
  const sigBytes = Buffer.from(
    signature.startsWith('0x') ? signature.slice(2) : signature,
    'hex',
  );
  return createHash('sha256').update(sigBytes).digest();
}

export function computeHmac(sessionKey: Buffer, seq: number, action: GameAction): string {
  const canonical = canonicalizeAction(seq, action);
  return createHmac('sha256', sessionKey).update(canonical).digest('hex');
}

export function verifyHmac(sessionKey: Buffer, seq: number, action: GameAction, hmac: string): boolean {
  const expected = computeHmac(sessionKey, seq, action);
  return expected === hmac;
}

export { SESSION_DOMAIN, SESSION_TYPES };
