import { describe, it, assert, assertEqual } from '../harness.js';
import { EventEmitter } from '../../engine/utils/EventEmitter.js';

describe('EventEmitter', () => {
  it('on + emit delivers data to listener', () => {
    const ee = new EventEmitter();
    let received: unknown = null;
    ee.on('test', (d: unknown) => { received = d; });
    ee.emit('test', 42);
    assertEqual(received, 42);
  });

  it('off removes a listener by reference', () => {
    const ee = new EventEmitter();
    let count = 0;
    const fn = () => { count++; };
    ee.on('x', fn);
    ee.off('x', fn);
    ee.emit('x');
    assertEqual(count, 0);
  });

  it('once fires exactly once', () => {
    const ee = new EventEmitter();
    let count = 0;
    ee.once('ping', () => { count++; });
    ee.emit('ping');
    ee.emit('ping');
    ee.emit('ping');
    assertEqual(count, 1);
  });

  it('multiple listeners fire in registration order', () => {
    const ee = new EventEmitter();
    const order: number[] = [];
    ee.on('ev', () => order.push(1));
    ee.on('ev', () => order.push(2));
    ee.on('ev', () => order.push(3));
    ee.emit('ev');
    assertEqual(order[0], 1);
    assertEqual(order[1], 2);
    assertEqual(order[2], 3);
  });

  it('emit on nonexistent event does not throw', () => {
    const ee = new EventEmitter();
    // Should not throw
    ee.emit('no-such-event', { anything: true });
    assert(true, 'no exception raised');
  });

  it('removeAllListeners(event) clears only that event', () => {
    const ee = new EventEmitter();
    let aCount = 0;
    let bCount = 0;
    ee.on('a', () => { aCount++; });
    ee.on('b', () => { bCount++; });
    ee.removeAllListeners('a');
    ee.emit('a');
    ee.emit('b');
    assertEqual(aCount, 0);
    assertEqual(bCount, 1);
  });

  it('removeAllListeners() with no args clears everything', () => {
    const ee = new EventEmitter();
    let count = 0;
    ee.on('x', () => { count++; });
    ee.on('y', () => { count++; });
    ee.removeAllListeners();
    ee.emit('x');
    ee.emit('y');
    assertEqual(count, 0);
  });

  it('independent events do not interfere', () => {
    const ee = new EventEmitter();
    let a = 0, b = 0;
    ee.on('a', () => { a++; });
    ee.on('b', () => { b++; });
    ee.emit('a');
    ee.emit('a');
    ee.emit('b');
    assertEqual(a, 2);
    assertEqual(b, 1);
  });

  it('mutating methods return this for chaining', () => {
    const ee = new EventEmitter();
    const fn = () => {};
    assert(ee.on('x', fn) === ee, 'on should return this');
    assert(ee.off('x', fn) === ee, 'off should return this');
    assert(ee.once('x', fn) === ee, 'once should return this');
    assert(ee.emit('x') === ee, 'emit should return this');
    assert(ee.removeAllListeners('x') === ee, 'removeAllListeners should return this');
  });

  it('listener that removes itself during emit does not affect siblings', () => {
    const ee = new EventEmitter();
    let bFired = false;
    const selfRemove = () => { ee.off('ev', selfRemove); };
    ee.on('ev', selfRemove);
    ee.on('ev', () => { bFired = true; });
    ee.emit('ev');
    assert(bFired, 'sibling listener should still fire');
  });
});
