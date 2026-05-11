import { describe, it, assert, assertEqual } from '../harness.js';
import { Pool } from '../../engine/utils/Pool.js';

describe('Pool', () => {
  it('creates a new object when empty', () => {
    const pool = new Pool(() => ({ value: 0 }));
    const obj = pool.get();
    assert(obj !== undefined && obj !== null, 'expected a new object');
    assert(typeof obj === 'object', 'expected an object');
  });

  it('reuses a released object', () => {
    const pool = new Pool(() => ({ value: 0 }));
    const obj = pool.get();
    pool.release(obj);
    const obj2 = pool.get();
    assert(obj === obj2, 'expected the same object reference');
  });

  it('tracks size correctly', () => {
    const pool = new Pool<Record<string, unknown>>(() => ({}));
    assertEqual(pool.size, 0);

    const a = pool.get();
    const b = pool.get();
    assertEqual(pool.size, 0);

    pool.release(a);
    assertEqual(pool.size, 1);

    pool.release(b);
    assertEqual(pool.size, 2);

    pool.get();
    assertEqual(pool.size, 1);
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

    assert(resetCalled, 'expected reset to be called');
    assert(resetObj === obj, 'expected reset to receive the released object');
    assertEqual(obj.value, 0, 'expected reset to zero the value');
  });

  it('works without a reset function', () => {
    const pool = new Pool(() => ({ x: 1 }));
    const obj = pool.get();
    pool.release(obj);
    assertEqual(pool.size, 1);
  });

  it('factory is called each time the pool is empty', () => {
    let count = 0;
    const pool = new Pool(() => ({ id: ++count }));

    const a = pool.get();
    const b = pool.get();
    assert(a.id !== b.id, 'factory should produce distinct objects');
    assertEqual(count, 2);
  });
});
