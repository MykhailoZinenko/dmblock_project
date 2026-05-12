import { describe, it, expect } from 'vitest';
import { Ticker, PRIORITY } from '../Ticker.js';

describe('Ticker', () => {
  it('add() registers a callback that _tick() calls', () => {
    const ticker = new Ticker();
    let called = false;
    ticker.add(() => { called = true; });
    (ticker as any)._tick(16.67);
    expect(called).toBeTruthy();
  });

  it('remove() stops the callback from being called', () => {
    const ticker = new Ticker();
    let count = 0;
    const fn = () => { count++; };
    ticker.add(fn);
    ticker.remove(fn);
    (ticker as any)._tick(16.67);
    expect(count).toBe(0);
  });

  it('callbacks fire in ascending priority order', () => {
    const ticker = new Ticker();
    const order: string[] = [];
    ticker.add(() => order.push('render'), PRIORITY.RENDER);
    ticker.add(() => order.push('game'), PRIORITY.GAME);
    ticker.add(() => order.push('interaction'), PRIORITY.INTERACTION);
    (ticker as any)._tick(16.67);
    expect(order[0]).toBe('interaction');
    expect(order[1]).toBe('game');
    expect(order[2]).toBe('render');
  });

  it('deltaTime passed to callbacks is in seconds', () => {
    const ticker = new Ticker();
    let received: number | null = null;
    ticker.add((dt: number) => { received = dt; });
    (ticker as any)._tick(16.67);
    expect(Math.abs(received! - 0.01667)).toBeLessThanOrEqual(0.0001);
  });

  it('elapsedTime accumulates across multiple _tick calls', () => {
    const ticker = new Ticker();
    (ticker as any)._tick(16.67);
    (ticker as any)._tick(16.67);
    (ticker as any)._tick(16.67);
    expect(Math.abs(ticker.elapsedTime - 0.05001)).toBeLessThanOrEqual(0.001);
  });

  it('fps is computed correctly from ms elapsed', () => {
    const ticker = new Ticker();
    (ticker as any)._tick(16.67);
    expect(Math.abs(ticker.fps - 59.988)).toBeLessThanOrEqual(0.1);
  });

  it('fps is 0 when ms is 0', () => {
    const ticker = new Ticker();
    (ticker as any)._tick(0);
    expect(ticker.fps).toBe(0);
  });

  it('start() begins the loop and stop() ends it', () => {
    let rafCallback: ((time: number) => void) | null = null;
    let rafId = 1;
    (globalThis as any).requestAnimationFrame = (cb: (time: number) => void) => { rafCallback = cb; return rafId++; };
    (globalThis as any).cancelAnimationFrame = () => { rafCallback = null; };
    (globalThis as any).performance = { now: () => 0 };

    const ticker = new Ticker();
    ticker.start();
    expect(rafCallback).not.toBeNull();

    // Calling start again is a no-op
    ticker.start();

    ticker.stop();
    // stop when already stopped is a no-op
    ticker.stop();

    delete (globalThis as any).requestAnimationFrame;
    delete (globalThis as any).cancelAnimationFrame;
  });

  it('start loop calls _tick with correct ms', () => {
    let rafCallback: ((time: number) => void) | null = null;
    let rafId = 1;
    (globalThis as any).requestAnimationFrame = (cb: (time: number) => void) => { rafCallback = cb; return rafId++; };
    (globalThis as any).cancelAnimationFrame = () => {};
    (globalThis as any).performance = { now: () => 1000 };

    const ticker = new Ticker();
    let called = false;
    ticker.add(() => { called = true; });
    ticker.start();

    // Simulate a frame at t=1016.67
    if (rafCallback) rafCallback(1016.67);
    expect(called).toBe(true);
    expect(Math.abs(ticker.deltaTime - 0.01667)).toBeLessThanOrEqual(0.001);

    ticker.stop();
    delete (globalThis as any).requestAnimationFrame;
    delete (globalThis as any).cancelAnimationFrame;
  });
});
