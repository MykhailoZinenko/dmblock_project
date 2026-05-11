import { describe, it, assertEqual, assert } from '../harness.js';
import { BLEND_MODES, BLEND_STATES } from '../../src/engine/render/BlendMode.js';

describe('BlendMode', () => {
  it('defines NORMAL, ADDITIVE, MULTIPLY constants', () => {
    assertEqual(BLEND_MODES.NORMAL, 0);
    assertEqual(BLEND_MODES.ADDITIVE, 1);
    assertEqual(BLEND_MODES.MULTIPLY, 2);
  });

  it('BLEND_STATES has entries for all modes', () => {
    assert(BLEND_STATES[BLEND_MODES.NORMAL] !== undefined);
    assert(BLEND_STATES[BLEND_MODES.ADDITIVE] !== undefined);
    assert(BLEND_STATES[BLEND_MODES.MULTIPLY] !== undefined);
  });

  it('NORMAL blend uses src-alpha / one-minus-src-alpha', () => {
    const s = BLEND_STATES[BLEND_MODES.NORMAL];
    assertEqual(s.color.srcFactor, 'src-alpha');
    assertEqual(s.color.dstFactor, 'one-minus-src-alpha');
  });

  it('ADDITIVE blend uses src-alpha / one', () => {
    const s = BLEND_STATES[BLEND_MODES.ADDITIVE];
    assertEqual(s.color.srcFactor, 'src-alpha');
    assertEqual(s.color.dstFactor, 'one');
  });

  it('MULTIPLY blend uses dst / one-minus-src-alpha', () => {
    const s = BLEND_STATES[BLEND_MODES.MULTIPLY];
    assertEqual(s.color.srcFactor, 'dst');
    assertEqual(s.color.dstFactor, 'one-minus-src-alpha');
  });
});
