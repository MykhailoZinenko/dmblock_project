import { describe, it, assert, assertApprox } from '../harness.js';
import { Color } from '../../engine/utils/Color.js';

describe('Color', () => {
  it('parses 0xFF0000 to red', () => {
    const c = Color.from(0xFF0000);
    assertApprox(c[0], 1, 0.001);
    assertApprox(c[1], 0, 0.001);
    assertApprox(c[2], 0, 0.001);
    assertApprox(c[3], 1, 0.001);
  });

  it('parses 0x00FF00 to green', () => {
    const c = Color.from(0x00FF00);
    assertApprox(c[0], 0, 0.001);
    assertApprox(c[1], 1, 0.001);
    assertApprox(c[2], 0, 0.001);
    assertApprox(c[3], 1, 0.001);
  });

  it('parses hex string #ff0000', () => {
    const c = Color.from('#ff0000');
    assertApprox(c[0], 1, 0.001);
    assertApprox(c[1], 0, 0.001);
    assertApprox(c[2], 0, 0.001);
    assertApprox(c[3], 1, 0.001);
  });

  it('parses shorthand hex string #f00', () => {
    const c = Color.from('#f00');
    assertApprox(c[0], 1, 0.001);
    assertApprox(c[1], 0, 0.001);
    assertApprox(c[2], 0, 0.001);
    assertApprox(c[3], 1, 0.001);
  });

  it('passes through a 4-element float array', () => {
    const c = Color.from([0.5, 0.25, 0.75, 0.5]);
    assertApprox(c[0], 0.5,  0.001);
    assertApprox(c[1], 0.25, 0.001);
    assertApprox(c[2], 0.75, 0.001);
    assertApprox(c[3], 0.5,  0.001);
  });

  it('defaults alpha to 1 for a 3-element float array', () => {
    const c = Color.from([0.1, 0.2, 0.3]);
    assertApprox(c[3], 1, 0.001);
  });

  it('parses 0xFFFFFF to white', () => {
    const c = Color.from(0xFFFFFF);
    assertApprox(c[0], 1, 0.001);
    assertApprox(c[1], 1, 0.001);
    assertApprox(c[2], 1, 0.001);
    assertApprox(c[3], 1, 0.001);
  });

  it('parses 0x000000 to black', () => {
    const c = Color.from(0x000000);
    assertApprox(c[0], 0, 0.001);
    assertApprox(c[1], 0, 0.001);
    assertApprox(c[2], 0, 0.001);
    assertApprox(c[3], 1, 0.001);
  });

  it('returns a Float32Array', () => {
    const c = Color.from(0xFF0000);
    assert(c instanceof Float32Array, 'expected Float32Array');
  });
});
