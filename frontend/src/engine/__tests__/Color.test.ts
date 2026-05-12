import { describe, it, expect } from 'vitest';
import { Color } from '../utils/Color.js';

describe('Color', () => {
  it('parses 0xFF0000 to red', () => {
    const c = Color.from(0xFF0000);
    expect(Math.abs(c[0] - 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[1] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[2] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[3] - 1)).toBeLessThanOrEqual(0.001);
  });

  it('parses 0x00FF00 to green', () => {
    const c = Color.from(0x00FF00);
    expect(Math.abs(c[0] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[1] - 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[2] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[3] - 1)).toBeLessThanOrEqual(0.001);
  });

  it('parses hex string #ff0000', () => {
    const c = Color.from('#ff0000');
    expect(Math.abs(c[0] - 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[1] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[2] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[3] - 1)).toBeLessThanOrEqual(0.001);
  });

  it('parses shorthand hex string #f00', () => {
    const c = Color.from('#f00');
    expect(Math.abs(c[0] - 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[1] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[2] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[3] - 1)).toBeLessThanOrEqual(0.001);
  });

  it('passes through a 4-element float array', () => {
    const c = Color.from([0.5, 0.25, 0.75, 0.5]);
    expect(Math.abs(c[0] - 0.5)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[1] - 0.25)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[2] - 0.75)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[3] - 0.5)).toBeLessThanOrEqual(0.001);
  });

  it('defaults alpha to 1 for a 3-element float array', () => {
    const c = Color.from([0.1, 0.2, 0.3]);
    expect(Math.abs(c[3] - 1)).toBeLessThanOrEqual(0.001);
  });

  it('parses 0xFFFFFF to white', () => {
    const c = Color.from(0xFFFFFF);
    expect(Math.abs(c[0] - 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[1] - 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[2] - 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[3] - 1)).toBeLessThanOrEqual(0.001);
  });

  it('parses 0x000000 to black', () => {
    const c = Color.from(0x000000);
    expect(Math.abs(c[0] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[1] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[2] - 0)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(c[3] - 1)).toBeLessThanOrEqual(0.001);
  });

  it('returns a Float32Array', () => {
    const c = Color.from(0xFF0000);
    expect(c instanceof Float32Array).toBeTruthy();
  });
});
