import { describe, it, assertEqual, assertApprox } from '../harness.js';
import { Matrix } from '../../src/engine/math/Matrix.js';

describe('Matrix', () => {
  it('starts as identity', () => {
    const m = new Matrix();
    assertEqual(m.a, 1); assertEqual(m.b, 0);
    assertEqual(m.c, 0); assertEqual(m.d, 1);
    assertEqual(m.tx, 0); assertEqual(m.ty, 0);
  });

  it('set() assigns all components', () => {
    const m = new Matrix().set(2, 3, 4, 5, 6, 7);
    assertEqual(m.a, 2); assertEqual(m.b, 3);
    assertEqual(m.c, 4); assertEqual(m.d, 5);
    assertEqual(m.tx, 6); assertEqual(m.ty, 7);
  });

  it('translate() shifts apply output', () => {
    const m = new Matrix().translate(10, 20);
    const p = m.apply({ x: 0, y: 0 });
    assertEqual(p.x, 10);
    assertEqual(p.y, 20);
  });

  it('scale() stretches apply output', () => {
    const m = new Matrix().scale(3, 4);
    const p = m.apply({ x: 2, y: 5 });
    assertEqual(p.x, 6);
    assertEqual(p.y, 20);
  });

  it('rotate(PI/2) maps (1,0) to approx (0,1)', () => {
    const m = new Matrix().rotate(Math.PI / 2);
    const p = m.apply({ x: 1, y: 0 });
    assertApprox(p.x, 0);
    assertApprox(p.y, 1);
  });

  it('apply() transforms a point', () => {
    const m = new Matrix().set(1, 0, 0, 1, 5, 10);
    const p = m.apply({ x: 3, y: 4 });
    assertEqual(p.x, 8);
    assertEqual(p.y, 14);
  });

  it('applyInverse() is the roundtrip of apply()', () => {
    const m = new Matrix().scale(2, 3).translate(7, -4);
    const original = { x: 13, y: -5 };
    const transformed = m.apply(original);
    const recovered = m.applyInverse(transformed);
    assertApprox(recovered.x, original.x);
    assertApprox(recovered.y, original.y);
  });

  it('multiply() combines two translations', () => {
    const a = new Matrix().translate(10, 0);
    const b = new Matrix().translate(0, 20);
    a.multiply(b);
    const p = a.apply({ x: 0, y: 0 });
    assertEqual(p.x, 10);
    assertEqual(p.y, 20);
  });

  it('invert() roundtrip restores identity effect', () => {
    const m = new Matrix().scale(2, 4).translate(3, 7);
    const original = { x: 5, y: -3 };
    const fwd = m.apply(original);
    m.invert();
    const back = m.apply(fwd);
    assertApprox(back.x, original.x);
    assertApprox(back.y, original.y);
  });

  it('clone() produces an independent copy', () => {
    const a = new Matrix().translate(5, 5);
    const b = a.clone();
    a.translate(100, 100);
    assertEqual(b.tx, 5);
    assertEqual(b.ty, 5);
  });

  it('copyFrom() mirrors source values', () => {
    const src = new Matrix().set(2, 3, 4, 5, 6, 7);
    const dst = new Matrix().copyFrom(src);
    assertEqual(dst.a, 2); assertEqual(dst.tx, 6);
  });

  it('identity() resets a modified matrix', () => {
    const m = new Matrix().scale(5, 5).translate(99, 99);
    m.identity();
    assertEqual(m.a, 1); assertEqual(m.tx, 0); assertEqual(m.ty, 0);
  });

  it('methods chain (return this)', () => {
    const m = new Matrix();
    const result = m.identity().scale(2, 2).translate(1, 1);
    assertEqual(result, m);
  });
});
