/**
 * Canonical state serialization and hashing for deterministic state verification.
 *
 * Both players in a match must independently hash game state and get identical
 * results. This requires canonical (deterministic) JSON serialization — object
 * keys are always sorted alphabetically regardless of insertion order.
 *
 * The hash is used for state channel verification in multiplayer.
 */

/**
 * Shallow canonical JSON serialization.
 * Sorts only top-level object keys alphabetically.
 * Non-object inputs are serialized via JSON.stringify.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj === undefined ? null : obj);
  }

  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return JSON.stringify(obj);
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const parts: string[] = [];

  for (const key of sortedKeys) {
    const value = record[key];
    if (value === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${JSON.stringify(value)}`);
  }

  return `{${parts.join(',')}}`;
}

/**
 * Deep canonical JSON serialization.
 * Recursively sorts all object keys at every nesting level.
 * Arrays preserve element order but objects within arrays have sorted keys.
 */
export function canonicalizeDeep(obj: unknown): string {
  return JSON.stringify(deepSort(obj));
}

/**
 * Recursively sorts object keys. Returns a new structure with sorted keys
 * at every level. Arrays are preserved in order, but objects within arrays
 * are also sorted.
 */
function deepSort(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj === undefined ? undefined : null;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSort);
  }

  const record = obj as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(record).sort();

  for (const key of keys) {
    const value = record[key];
    if (value === undefined) continue;
    sorted[key] = deepSort(value);
  }

  return sorted;
}

/**
 * Hash game state using canonical deep serialization + FNV-1a 32-bit.
 * Returns an 8-character lowercase hex string.
 *
 * FNV-1a 32-bit:
 *   hash = 0x811c9dc5 (offset basis)
 *   for each byte: hash ^= byte; hash = Math.imul(hash, 0x01000193)
 *   return (hash >>> 0).toString(16).padStart(8, '0')
 */
export function hashState(obj: unknown): string {
  const canonical = canonicalizeDeep(obj);
  return fnv1a32(canonical);
}

/**
 * FNV-1a 32-bit hash of a string.
 * Operates on UTF-8 encoded bytes.
 */
function fnv1a32(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis

  // Encode string as UTF-8 bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
