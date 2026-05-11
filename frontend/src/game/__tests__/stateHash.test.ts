import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalizeDeep, hashState } from '../stateHash';

describe('canonicalize', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('sorts top-level keys alphabetically', () => {
    const result = canonicalize({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('handles string values', () => {
    const result = canonicalize({ name: 'hello' });
    expect(result).toBe('{"name":"hello"}');
  });

  it('handles number values', () => {
    const result = canonicalize({ val: 42 });
    expect(result).toBe('{"val":42}');
  });

  it('handles boolean values', () => {
    const result = canonicalize({ flag: true, other: false });
    expect(result).toBe('{"flag":true,"other":false}');
  });

  it('handles null values', () => {
    const result = canonicalize({ key: null });
    expect(result).toBe('{"key":null}');
  });

  it('does NOT deeply sort nested object keys (shallow only)', () => {
    const result = canonicalize({ b: { z: 1, a: 2 }, a: 1 });
    // top-level sorted: a before b, but nested object NOT sorted
    expect(result).toBe('{"a":1,"b":{"z":1,"a":2}}');
  });

  it('handles empty object', () => {
    expect(canonicalize({})).toBe('{}');
  });

  it('handles arrays as values (preserved as-is)', () => {
    const result = canonicalize({ items: [3, 1, 2] });
    expect(result).toBe('{"items":[3,1,2]}');
  });

  it('handles non-object inputs by returning JSON.stringify', () => {
    expect(canonicalize('hello')).toBe('"hello"');
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(null)).toBe('null');
  });

  it('handles arrays at the top level', () => {
    expect(canonicalize([1, 2, 3])).toBe('[1,2,3]');
  });

  it('strips undefined values (like JSON.stringify)', () => {
    const result = canonicalize({ a: 1, b: undefined });
    expect(result).toBe('{"a":1}');
  });
});

describe('canonicalizeDeep', () => {
  it('recursively sorts keys at every nesting level', () => {
    const obj = { b: { z: 1, a: 2 }, a: { y: 3, x: 4 } };
    const result = canonicalizeDeep(obj);
    expect(result).toBe('{"a":{"x":4,"y":3},"b":{"a":2,"z":1}}');
  });

  it('handles deeply nested objects (3+ levels)', () => {
    const obj = { c: { b: { z: 1, a: 2 }, a: 0 }, a: 1 };
    const result = canonicalizeDeep(obj);
    expect(result).toBe('{"a":1,"c":{"a":0,"b":{"a":2,"z":1}}}');
  });

  it('preserves array element order', () => {
    const obj = { items: [3, 1, 2] };
    expect(canonicalizeDeep(obj)).toBe('{"items":[3,1,2]}');
  });

  it('sorts keys within objects inside arrays', () => {
    const obj = { list: [{ z: 1, a: 2 }, { b: 3, a: 4 }] };
    const result = canonicalizeDeep(obj);
    expect(result).toBe('{"list":[{"a":2,"z":1},{"a":4,"b":3}]}');
  });

  it('handles empty objects', () => {
    expect(canonicalizeDeep({})).toBe('{}');
  });

  it('handles empty arrays', () => {
    expect(canonicalizeDeep({ items: [] })).toBe('{"items":[]}');
  });

  it('handles mixed arrays (objects and primitives)', () => {
    const obj = { data: [1, { b: 2, a: 1 }, 'hello', null] };
    const result = canonicalizeDeep(obj);
    expect(result).toBe('{"data":[1,{"a":1,"b":2},"hello",null]}');
  });

  it('handles nested arrays', () => {
    const obj = { grid: [[1, 2], [3, 4]] };
    expect(canonicalizeDeep(obj)).toBe('{"grid":[[1,2],[3,4]]}');
  });

  it('handles null values in nested structures', () => {
    const obj = { a: { b: null } };
    expect(canonicalizeDeep(obj)).toBe('{"a":{"b":null}}');
  });

  it('handles non-object inputs', () => {
    expect(canonicalizeDeep('hello')).toBe('"hello"');
    expect(canonicalizeDeep(42)).toBe('42');
    expect(canonicalizeDeep(true)).toBe('true');
    expect(canonicalizeDeep(null)).toBe('null');
  });

  it('handles top-level arrays', () => {
    expect(canonicalizeDeep([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it('strips undefined values at all levels', () => {
    const obj = { a: { c: undefined, b: 1 }, d: undefined };
    const result = canonicalizeDeep(obj);
    expect(result).toBe('{"a":{"b":1}}');
  });

  it('produces identical output regardless of key insertion order at all levels', () => {
    const a = { outer: { z: { c: 1, a: 2 }, a: 0 }, inner: 1 };
    const b = { inner: 1, outer: { a: 0, z: { a: 2, c: 1 } } };
    expect(canonicalizeDeep(a)).toBe(canonicalizeDeep(b));
  });

  it('handles very large objects', () => {
    const big: Record<string, number> = {};
    for (let i = 999; i >= 0; i--) {
      big[`key${i.toString().padStart(4, '0')}`] = i;
    }
    const result = canonicalizeDeep(big);
    const parsed = JSON.parse(result);
    const keys = Object.keys(parsed);
    // Keys should be sorted
    expect(keys).toEqual([...keys].sort());
  });
});

describe('hashState', () => {
  it('returns an 8-character hex string', () => {
    const hash = hashState({ a: 1 });
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is idempotent (same input = same hash)', () => {
    const obj = { a: 1, b: 'hello', c: [1, 2, 3] };
    expect(hashState(obj)).toBe(hashState(obj));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashState({ a: 1 })).not.toBe(hashState({ a: 2 }));
  });

  it('key order does not affect hash (shallow)', () => {
    expect(hashState({ a: 1, b: 2 })).toBe(hashState({ b: 2, a: 1 }));
  });

  it('deeply nested key order does not affect hash', () => {
    const a = { outer: { z: 1, a: 2 }, x: { c: 3, b: 4 } };
    const b = { x: { b: 4, c: 3 }, outer: { a: 2, z: 1 } };
    expect(hashState(a)).toBe(hashState(b));
  });

  it('handles empty object', () => {
    const hash = hashState({});
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles empty array', () => {
    const hash = hashState([]);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles null', () => {
    const hash = hashState(null);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles numeric values', () => {
    const hash = hashState(42);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles boolean values', () => {
    const hash = hashState(true);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(hashState(true)).not.toBe(hashState(false));
  });

  it('handles nested arrays', () => {
    const hash = hashState({ grid: [[1, 2], [3, 4]] });
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles null values in objects', () => {
    const hash = hashState({ a: null, b: null });
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles undefined by stripping it', () => {
    // {a:1, b:undefined} should hash same as {a:1}
    expect(hashState({ a: 1, b: undefined })).toBe(hashState({ a: 1 }));
  });

  it('handles very large objects deterministically', () => {
    const big: Record<string, number> = {};
    for (let i = 999; i >= 0; i--) {
      big[`key${i.toString().padStart(4, '0')}`] = i;
    }
    const bigReverse: Record<string, number> = {};
    for (let i = 0; i <= 999; i++) {
      bigReverse[`key${i.toString().padStart(4, '0')}`] = i;
    }
    expect(hashState(big)).toBe(hashState(bigReverse));
  });

  it('produces different hashes for string vs number', () => {
    expect(hashState({ a: '1' })).not.toBe(hashState({ a: 1 }));
  });
});
