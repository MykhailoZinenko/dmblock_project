import { describe, it, expect } from 'vitest';
import { ObservablePoint } from '../math/ObservablePoint.js';

describe('ObservablePoint', () => {
  it('initialises with provided x and y', () => {
    const p = new ObservablePoint(() => {}, null, 3, 7);
    expect(p.x).toBe(3);
    expect(p.y).toBe(7);
  });

  it('defaults x and y to 0', () => {
    const p = new ObservablePoint(() => {}, null);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('calls callback when x changes', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 0, 0);
    p.x = 5;
    expect(calls).toBe(1);
  });

  it('calls callback when y changes', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 0, 0);
    p.y = 5;
    expect(calls).toBe(1);
  });

  it('does NOT call callback when x is set to same value', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 5, 0);
    p.x = 5;
    expect(calls).toBe(0);
  });

  it('does NOT call callback when y is set to same value', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 0, 5);
    p.y = 5;
    expect(calls).toBe(0);
  });

  it('set() calls callback once when both change', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 0, 0);
    p.set(3, 4);
    expect(calls).toBe(1);
    expect(p.x).toBe(3);
    expect(p.y).toBe(4);
  });

  it('set() does not call callback when values are unchanged', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 3, 4);
    p.set(3, 4);
    expect(calls).toBe(0);
  });

  it('set() calls callback once even when only one value changes', () => {
    let calls = 0;
    const p = new ObservablePoint(() => calls++, null, 3, 4);
    p.set(3, 99);
    expect(calls).toBe(1);
  });

  it('binds callback to the provided scope', () => {
    const scope = { tag: 'owner' };
    let captured: unknown = null;
    const p = new ObservablePoint(function (this: unknown) { captured = this; }, scope, 0, 0);
    p.x = 1;
    expect(captured).toBe(scope);
  });

  it('copyFrom() triggers callback when values differ', () => {
    let calls = 0;
    const src = new ObservablePoint(() => {}, null, 10, 20);
    const dst = new ObservablePoint(() => calls++, null, 0, 0);
    dst.copyFrom(src);
    expect(dst.x).toBe(10);
    expect(dst.y).toBe(20);
    expect(calls > 0).toBeTruthy();
  });

  it('clone() creates independent instance with same values', () => {
    const original = new ObservablePoint(() => {}, null, 5, 9);
    let cloneCalls = 0;
    const copy = original.clone(() => cloneCalls++, null);
    expect(copy.x).toBe(5);
    expect(copy.y).toBe(9);
    copy.x = 99;
    expect(original.x).toBe(5);
    expect(cloneCalls).toBe(1);
  });
});
