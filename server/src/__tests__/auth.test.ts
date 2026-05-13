import { describe, it, expect } from 'vitest';
import { generateNonce, deriveSessionKey, computeHmac, verifyHmac } from '../auth.js';

describe('auth', () => {
  describe('generateNonce', () => {
    it('produces a hex string starting with 0x', () => {
      const nonce = generateNonce();
      expect(nonce.startsWith('0x')).toBe(true);
      expect(nonce.length).toBe(66); // 0x + 64 hex chars = 32 bytes
    });

    it('produces unique nonces', () => {
      const a = generateNonce();
      const b = generateNonce();
      expect(a).not.toBe(b);
    });
  });

  describe('deriveSessionKey', () => {
    it('produces a 32-byte buffer from a hex signature', () => {
      const sig = '0x' + 'ab'.repeat(65);
      const key = deriveSessionKey(sig);
      expect(key.length).toBe(32);
      expect(Buffer.isBuffer(key)).toBe(true);
    });

    it('is deterministic for same input', () => {
      const sig = '0x' + 'cd'.repeat(65);
      const key1 = deriveSessionKey(sig);
      const key2 = deriveSessionKey(sig);
      expect(key1.equals(key2)).toBe(true);
    });

    it('produces different keys for different signatures', () => {
      const key1 = deriveSessionKey('0x' + 'aa'.repeat(65));
      const key2 = deriveSessionKey('0x' + 'bb'.repeat(65));
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('HMAC', () => {
    const sessionKey = deriveSessionKey('0x' + 'ff'.repeat(65));

    it('computeHmac produces a hex string', () => {
      const hmac = computeHmac(sessionKey, 1, { type: 'pass' });
      expect(typeof hmac).toBe('string');
      expect(hmac.length).toBe(64); // SHA-256 = 32 bytes = 64 hex
    });

    it('verifyHmac returns true for valid HMAC', () => {
      const hmac = computeHmac(sessionKey, 1, { type: 'pass' });
      expect(verifyHmac(sessionKey, 1, { type: 'pass' }, hmac)).toBe(true);
    });

    it('verifyHmac returns false for wrong HMAC', () => {
      expect(verifyHmac(sessionKey, 1, { type: 'pass' }, 'wrong')).toBe(false);
    });

    it('verifyHmac returns false for wrong seq', () => {
      const hmac = computeHmac(sessionKey, 1, { type: 'pass' });
      expect(verifyHmac(sessionKey, 2, { type: 'pass' }, hmac)).toBe(false);
    });

    it('verifyHmac returns false for wrong action', () => {
      const hmac = computeHmac(sessionKey, 1, { type: 'pass' });
      expect(verifyHmac(sessionKey, 1, { type: 'end-turn' }, hmac)).toBe(false);
    });

    it('verifyHmac returns false for wrong key', () => {
      const hmac = computeHmac(sessionKey, 1, { type: 'pass' });
      const otherKey = deriveSessionKey('0x' + '00'.repeat(65));
      expect(verifyHmac(otherKey, 1, { type: 'pass' }, hmac)).toBe(false);
    });

    it('is deterministic for same inputs', () => {
      const action = { type: 'move' as const, unitUid: 5, col: 3, row: 7 };
      const h1 = computeHmac(sessionKey, 42, action);
      const h2 = computeHmac(sessionKey, 42, action);
      expect(h1).toBe(h2);
    });
  });
});
