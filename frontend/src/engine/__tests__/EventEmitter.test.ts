import { describe, it, expect } from 'vitest';
import { EventEmitter } from '../utils/EventEmitter.js';

describe('EventEmitter', () => {
  it('on + emit delivers data to listener', () => {
    const ee = new EventEmitter();
    let received: unknown = null;
    ee.on('test', (d: unknown) => { received = d; });
    ee.emit('test', 42);
    expect(received).toBe(42);
  });

  it('off removes a listener by reference', () => {
    const ee = new EventEmitter();
    let count = 0;
    const fn = () => { count++; };
    ee.on('x', fn);
    ee.off('x', fn);
    ee.emit('x');
    expect(count).toBe(0);
  });

  it('once fires exactly once', () => {
    const ee = new EventEmitter();
    let count = 0;
    ee.once('ping', () => { count++; });
    ee.emit('ping');
    ee.emit('ping');
    ee.emit('ping');
    expect(count).toBe(1);
  });

  it('multiple listeners fire in registration order', () => {
    const ee = new EventEmitter();
    const order: number[] = [];
    ee.on('ev', () => order.push(1));
    ee.on('ev', () => order.push(2));
    ee.on('ev', () => order.push(3));
    ee.emit('ev');
    expect(order[0]).toBe(1);
    expect(order[1]).toBe(2);
    expect(order[2]).toBe(3);
  });

  it('emit on nonexistent event does not throw', () => {
    const ee = new EventEmitter();
    ee.emit('no-such-event', { anything: true });
    expect(true).toBeTruthy();
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
    expect(aCount).toBe(0);
    expect(bCount).toBe(1);
  });

  it('removeAllListeners() with no args clears everything', () => {
    const ee = new EventEmitter();
    let count = 0;
    ee.on('x', () => { count++; });
    ee.on('y', () => { count++; });
    ee.removeAllListeners();
    ee.emit('x');
    ee.emit('y');
    expect(count).toBe(0);
  });

  it('independent events do not interfere', () => {
    const ee = new EventEmitter();
    let a = 0, b = 0;
    ee.on('a', () => { a++; });
    ee.on('b', () => { b++; });
    ee.emit('a');
    ee.emit('a');
    ee.emit('b');
    expect(a).toBe(2);
    expect(b).toBe(1);
  });

  it('mutating methods return this for chaining', () => {
    const ee = new EventEmitter();
    const fn = () => {};
    expect(ee.on('x', fn) === ee).toBeTruthy();
    expect(ee.off('x', fn) === ee).toBeTruthy();
    expect(ee.once('x', fn) === ee).toBeTruthy();
    expect(ee.emit('x') === ee).toBeTruthy();
    expect(ee.removeAllListeners('x') === ee).toBeTruthy();
  });

  it('listener that removes itself during emit does not affect siblings', () => {
    const ee = new EventEmitter();
    let bFired = false;
    const selfRemove = () => { ee.off('ev', selfRemove); };
    ee.on('ev', selfRemove);
    ee.on('ev', () => { bFired = true; });
    ee.emit('ev');
    expect(bFired).toBeTruthy();
  });

  it('off by original fn removes once wrapper', () => {
    const ee = new EventEmitter();
    let count = 0;
    const fn = () => { count++; };
    ee.once('x', fn);
    ee.off('x', fn);
    ee.emit('x');
    expect(count).toBe(0);
  });

  it('off on nonexistent event does not throw', () => {
    const ee = new EventEmitter();
    ee.off('no-event', () => {});
    expect(true).toBeTruthy();
  });

  it('off with non-matching fn does nothing', () => {
    const ee = new EventEmitter();
    let count = 0;
    const fn = () => { count++; };
    ee.on('x', fn);
    ee.off('x', () => {}); // different fn
    ee.emit('x');
    expect(count).toBe(1);
  });

  it('emit stops propagation when stoppedImmediate is set', () => {
    const ee = new EventEmitter();
    const order: number[] = [];
    ee.on('ev', (d: any) => { order.push(1); d.stoppedImmediate = true; });
    ee.on('ev', () => { order.push(2); });
    ee.emit('ev', { stoppedImmediate: false });
    expect(order).toEqual([1]);
  });
});
