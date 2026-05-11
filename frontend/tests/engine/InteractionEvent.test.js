import { describe, it, assert, assertEqual } from '../harness.js';
import { InteractionEvent, EVENT_PHASE } from '../../src/engine/interaction/InteractionEvent.js';

describe('InteractionEvent', () => {
  it('stores type, target and coords', () => {
    const target = { name: 'sprite' };
    const ev = new InteractionEvent('pointerdown', target, 10, 20, 100, 200, null, 0);
    assertEqual(ev.type, 'pointerdown');
    assertEqual(ev.target, target);
    assertEqual(ev.worldX, 10);
    assertEqual(ev.worldY, 20);
    assertEqual(ev.screenX, 100);
    assertEqual(ev.screenY, 200);
    assertEqual(ev.button, 0);
    assertEqual(ev.eventPhase, EVENT_PHASE.NONE);
  });

  it('stopPropagation sets stopped', () => {
    const ev = new InteractionEvent('pointermove', null, 0, 0, 0, 0, null, 0);
    assert(!ev.stopped);
    ev.stopPropagation();
    assert(ev.stopped);
    assert(!ev.stoppedImmediate);
  });

  it('stopImmediatePropagation sets both flags', () => {
    const ev = new InteractionEvent('pointerup', null, 0, 0, 0, 0, null, 0);
    ev.stopImmediatePropagation();
    assert(ev.stopped);
    assert(ev.stoppedImmediate);
  });
});
