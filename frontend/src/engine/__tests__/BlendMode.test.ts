import { describe, it, expect } from 'vitest';
import { BLEND_MODES, BLEND_STATES } from '../render/BlendMode.js';

describe('BlendMode', () => {
  it('defines NORMAL, ADDITIVE, MULTIPLY constants', () => {
    expect(BLEND_MODES.NORMAL).toBe(0);
    expect(BLEND_MODES.ADDITIVE).toBe(1);
    expect(BLEND_MODES.MULTIPLY).toBe(2);
  });

  it('BLEND_STATES has entries for all modes', () => {
    expect(BLEND_STATES[BLEND_MODES.NORMAL] !== undefined).toBeTruthy();
    expect(BLEND_STATES[BLEND_MODES.ADDITIVE] !== undefined).toBeTruthy();
    expect(BLEND_STATES[BLEND_MODES.MULTIPLY] !== undefined).toBeTruthy();
  });

  it('NORMAL blend uses src-alpha / one-minus-src-alpha', () => {
    const s = BLEND_STATES[BLEND_MODES.NORMAL];
    expect(s.color.srcFactor).toBe('src-alpha');
    expect(s.color.dstFactor).toBe('one-minus-src-alpha');
  });

  it('ADDITIVE blend uses src-alpha / one', () => {
    const s = BLEND_STATES[BLEND_MODES.ADDITIVE];
    expect(s.color.srcFactor).toBe('src-alpha');
    expect(s.color.dstFactor).toBe('one');
  });

  it('MULTIPLY blend uses dst / one-minus-src-alpha', () => {
    const s = BLEND_STATES[BLEND_MODES.MULTIPLY];
    expect(s.color.srcFactor).toBe('dst');
    expect(s.color.dstFactor).toBe('one-minus-src-alpha');
  });
});
