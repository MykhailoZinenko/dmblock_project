import { describe, it, expect } from 'vitest';
import { Pool } from '../utils/Pool.js';

describe('Pool', () => {
  it('creates a new object when empty', () => {
    const pool = new Pool(() => ({ value: 0 }));
    const obj = pool.get();
    expect(obj !== undefined && obj !== null).toBeTruthy();
    expect(typeof obj === 'object').toBeTruthy();
  });

  it('reuses a released object', () => {
    const pool = new Pool(() => ({ value: 0 }));
    const obj = pool.get();
    pool.release(obj);
    const obj2 = pool.get();
    expect(obj === obj2).toBeTruthy();
  });

  it('tracks size correctly', () => {
    const pool = new Pool<Record<string, unknown>>(() => ({}));
    expect(pool.size).toBe(0);

    const a = pool.get();
    const b = pool.get();
    expect(pool.size).toBe(0);

    pool.release(a);
    expect(pool.size).toBe(1);

    pool.release(b);
    expect(pool.size).toBe(2);

    pool.get();
    expect(pool.size).toBe(1);
  });

  it('calls reset function on release', () => {
    let resetCalled = false;
    let resetObj: { value: number } | null = null;

    const pool = new Pool(
      () => ({ value: 42 }),
      (obj) => { resetCalled = true; resetObj = obj; obj.value = 0; }
    );

    const obj = pool.get();
    obj.value = 99;
    pool.release(obj);

    expect(resetCalled).toBeTruthy();
    expect(resetObj === obj).toBeTruthy();
    expect(obj.value).toBe(0);
  });

  it('works without a reset function', () => {
    const pool = new Pool(() => ({ x: 1 }));
    const obj = pool.get();
    pool.release(obj);
    expect(pool.size).toBe(1);
  });

  it('factory is called each time the pool is empty', () => {
    let count = 0;
    const pool = new Pool(() => ({ id: ++count }));

    const a = pool.get();
    const b = pool.get();
    expect(a.id !== b.id).toBeTruthy();
    expect(count).toBe(2);
  });
});
