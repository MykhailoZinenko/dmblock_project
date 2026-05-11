import { describe, it, assertEqual, assert } from '../harness.js';
import { ObservablePoint } from '../../engine/math/ObservablePoint.js';

describe('ObservablePoint', () => {
  it('initialises with provided x and y', () => {
    const p = new ObservablePoint(() => {}, null, 3, 7);
    assertEqual(p.x, 3);
    assertEqual(p.y, 7);
  });

  it('defaults x and y to 0', () => {
    const p = new ObservablePoint(() => {}, null);
    assertEqual(p.x, 0);
    assertEqual(p.y, 0);
  });

  it('calls callback when x changes', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 0, 0);
    p.x = 5;
    assertEqual(calls, 1);
  });

  it('calls callback when y changes', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 0, 0);
    p.y = 5;
    assertEqual(calls, 1);
  });

  it('does NOT call callback when x is set to same value', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 5, 0);
    p.x = 5;
    assertEqual(calls, 0);
  });

  it('does NOT call callback when y is set to same value', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 0, 5);
    p.y = 5;
    assertEqual(calls, 0);
  });

  it('set() calls callback once when both change', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 0, 0);
    p.set(3, 4);
    assertEqual(calls, 1);
    assertEqual(p.x, 3);
    assertEqual(p.y, 4);
  });

  it('set() does not call callback when values are unchanged', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 3, 4);
    p.set(3, 4);
    assertEqual(calls, 0);
  });

  it('set() calls callback once even when only one value changes', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 3, 4);
    p.set(3, 99);
    assertEqual(calls, 1);
  });

  it('binds callback to the provided scope', () => {
    const scope = { tag: 'owner' };
    let captured: unknown = null;
    const p = new ObservablePoint(function (this: unknown) { captured = this; }, scope, 0, 0);
    p.x = 1;
    assertEqual(captured, scope);
  });

  it('copyFrom() triggers callback when values differ', () => {
    let calls = 0;
    const src = new ObservablePoint(() => {}, null, 10, 20);
    const dst = new ObservablePoint(() => calls++, null, 0, 0);
    dst.copyFrom(src);
    assertEqual(dst.x, 10);
    assertEqual(dst.y, 20);
    assert(calls > 0);
  });

  it('clone() creates independent instance with same values', () => {
    const original = new ObservablePoint(() => {}, null, 5, 9);
    let cloneCalls = 0;
    const copy = original.clone(() => cloneCalls++, null);
    assertEqual(copy.x, 5);
    assertEqual(copy.y, 9);
    copy.x = 99;
    assertEqual(original.x, 5);
    assertEqual(cloneCalls, 1);
  });
});
