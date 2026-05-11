import { describe, it, assert, assertEqual, assertApprox } from '../harness.js';
import { Ticker, PRIORITY } from '../../src/engine/Ticker.js';

describe('Ticker', () => {
  it('add() registers a callback that _tick() calls', () => {
    const ticker = new Ticker();
    let called = false;
    ticker.add(() => { called = true; });
    ticker._tick(16.67);
    assert(called, 'callback should have been called');
  });

  it('remove() stops the callback from being called', () => {
    const ticker = new Ticker();
    let count = 0;
    const fn = () => { count++; };
    ticker.add(fn);
    ticker.remove(fn);
    ticker._tick(16.67);
    assertEqual(count, 0);
  });

  it('callbacks fire in ascending priority order', () => {
    const ticker = new Ticker();
    const order = [];
    ticker.add(() => order.push('render'), PRIORITY.RENDER);
    ticker.add(() => order.push('game'), PRIORITY.GAME);
    ticker.add(() => order.push('interaction'), PRIORITY.INTERACTION);
    ticker._tick(16.67);
    assertEqual(order[0], 'interaction');
    assertEqual(order[1], 'game');
    assertEqual(order[2], 'render');
  });

  it('deltaTime passed to callbacks is in seconds', () => {
    const ticker = new Ticker();
    let received = null;
    ticker.add((dt) => { received = dt; });
    ticker._tick(16.67);
    assertApprox(received, 0.01667, 0.0001, 'deltaTime should be ~0.01667s');
  });

  it('elapsedTime accumulates across multiple _tick calls', () => {
    const ticker = new Ticker();
    ticker._tick(16.67);
    ticker._tick(16.67);
    ticker._tick(16.67);
    assertApprox(ticker.elapsedTime, 0.05001, 0.001, 'elapsedTime should accumulate');
  });

  it('fps is computed correctly from ms elapsed', () => {
    const ticker = new Ticker();
    ticker._tick(16.67);
    assertApprox(ticker.fps, 59.988, 0.1, 'fps should be ~60 for 16.67ms');
  });
});
