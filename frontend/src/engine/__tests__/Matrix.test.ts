import { describe, it, expect } from 'vitest';
import { Matrix } from '../math/Matrix.js';

describe('Matrix', () => {
  it('starts as identity', () => {
    const m = new Matrix();
    expect(m.a).toBe(1); expect(m.b).toBe(0);
    expect(m.c).toBe(0); expect(m.d).toBe(1);
    expect(m.tx).toBe(0); expect(m.ty).toBe(0);
  });

  it('set() assigns all components', () => {
    const m = new Matrix().set(2, 3, 4, 5, 6, 7);
    expect(m.a).toBe(2); expect(m.b).toBe(3);
    expect(m.c).toBe(4); expect(m.d).toBe(5);
    expect(m.tx).toBe(6); expect(m.ty).toBe(7);
  });

  it('translate() shifts apply output', () => {
    const m = new Matrix().translate(10, 20);
    const p = m.apply({ x: 0, y: 0 });
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
  });

  it('scale() stretches apply output', () => {
    const m = new Matrix().scale(3, 4);
    const p = m.apply({ x: 2, y: 5 });
    expect(p.x).toBe(6);
    expect(p.y).toBe(20);
  });

  it('rotate(PI/2) maps (1,0) to approx (0,1)', () => {
    const m = new Matrix().rotate(Math.PI / 2);
    const p = m.apply({ x: 1, y: 0 });
    expect(Math.abs(p.x - 0)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(p.y - 1)).toBeLessThanOrEqual(0.0001);
  });

  it('apply() transforms a point', () => {
    const m = new Matrix().set(1, 0, 0, 1, 5, 10);
    const p = m.apply({ x: 3, y: 4 });
    expect(p.x).toBe(8);
    expect(p.y).toBe(14);
  });

  it('applyInverse() is the roundtrip of apply()', () => {
    const m = new Matrix().scale(2, 3).translate(7, -4);
    const original = { x: 13, y: -5 };
    const transformed = m.apply(original);
    const recovered = m.applyInverse(transformed);
    expect(Math.abs(recovered.x - original.x)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(recovered.y - original.y)).toBeLessThanOrEqual(0.0001);
  });

  it('multiply() combines two translations', () => {
    const a = new Matrix().translate(10, 0);
    const b = new Matrix().translate(0, 20);
    a.multiply(b);
    const p = a.apply({ x: 0, y: 0 });
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
  });

  it('invert() roundtrip restores identity effect', () => {
    const m = new Matrix().scale(2, 4).translate(3, 7);
    const original = { x: 5, y: -3 };
    const fwd = m.apply(original);
    m.invert();
    const back = m.apply(fwd);
    expect(Math.abs(back.x - original.x)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(back.y - original.y)).toBeLessThanOrEqual(0.0001);
  });

  it('clone() produces an independent copy', () => {
    const a = new Matrix().translate(5, 5);
    const b = a.clone();
    a.translate(100, 100);
    expect(b.tx).toBe(5);
    expect(b.ty).toBe(5);
  });

  it('copyFrom() mirrors source values', () => {
    const src = new Matrix().set(2, 3, 4, 5, 6, 7);
    const dst = new Matrix().copyFrom(src);
    expect(dst.a).toBe(2); expect(dst.tx).toBe(6);
  });

  it('identity() resets a modified matrix', () => {
    const m = new Matrix().scale(5, 5).translate(99, 99);
    m.identity();
    expect(m.a).toBe(1); expect(m.tx).toBe(0); expect(m.ty).toBe(0);
  });

  it('methods chain (return this)', () => {
    const m = new Matrix();
    const result = m.identity().scale(2, 2).translate(1, 1);
    expect(result).toBe(m);
  });
});
