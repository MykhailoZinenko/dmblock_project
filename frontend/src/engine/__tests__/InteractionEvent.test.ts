import { describe, it, expect } from 'vitest';
import { InteractionEvent, EVENT_PHASE } from '../interaction/InteractionEvent.js';

describe('InteractionEvent', () => {
  it('stores type, target and coords', () => {
    const target = { name: 'sprite' } as any;
    const ev = new InteractionEvent('pointerdown', target, 10, 20, 100, 200, null, 0);
    expect(ev.type).toBe('pointerdown');
    expect(ev.target).toBe(target);
    expect(ev.worldX).toBe(10);
    expect(ev.worldY).toBe(20);
    expect(ev.screenX).toBe(100);
    expect(ev.screenY).toBe(200);
    expect(ev.button).toBe(0);
    expect(ev.eventPhase).toBe(EVENT_PHASE.NONE);
  });

  it('stopPropagation sets stopped', () => {
    const ev = new InteractionEvent('pointermove', null, 0, 0, 0, 0, null, 0);
    expect(ev.stopped).toBeFalsy();
    ev.stopPropagation();
    expect(ev.stopped).toBeTruthy();
    expect(ev.stoppedImmediate).toBeFalsy();
  });

  it('stopImmediatePropagation sets both flags', () => {
    const ev = new InteractionEvent('pointerup', null, 0, 0, 0, 0, null, 0);
    ev.stopImmediatePropagation();
    expect(ev.stopped).toBeTruthy();
    expect(ev.stoppedImmediate).toBeTruthy();
  });
});
