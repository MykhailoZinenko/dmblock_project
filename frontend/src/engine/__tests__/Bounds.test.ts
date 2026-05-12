import { describe, it, expect } from 'vitest';
import { Bounds } from '../math/Bounds.js';

describe('Bounds', () => {
  it('starts empty (min Infinity, max -Infinity)', () => {
    const b = new Bounds();
    expect(b.minX).toBe(Infinity);
    expect(b.minY).toBe(Infinity);
    expect(b.maxX).toBe(-Infinity);
    expect(b.maxY).toBe(-Infinity);
  });

  it('addPoint() expands bounds to contain the point', () => {
    const b = new Bounds();
    b.addPoint(3, 7);
    expect(b.minX).toBe(3); expect(b.maxX).toBe(3);
    expect(b.minY).toBe(7); expect(b.maxY).toBe(7);
  });

  it('addPoint() expands with multiple points', () => {
    const b = new Bounds();
    b.addPoint(-5, 2).addPoint(10, -3);
    expect(b.minX).toBe(-5); expect(b.maxX).toBe(10);
    expect(b.minY).toBe(-3); expect(b.maxY).toBe(2);
  });

  it('addBounds() unions two bounds', () => {
    const a = new Bounds();
    a.addPoint(0, 0).addPoint(10, 10);
    const b2 = new Bounds();
    b2.addPoint(5, -5).addPoint(20, 20);
    a.addBounds(b2);
    expect(a.minX).toBe(0);  expect(a.maxX).toBe(20);
    expect(a.minY).toBe(-5); expect(a.maxY).toBe(20);
  });

  it('addQuad() expands to cover all 4 vertices', () => {
    const b = new Bounds();
    b.addQuad([0, 0, 100, 0, 100, 80, 0, 80]);
    expect(b.minX).toBe(0);   expect(b.maxX).toBe(100);
    expect(b.minY).toBe(0);   expect(b.maxY).toBe(80);
  });

  it('addQuad() works with non-axis-aligned vertices', () => {
    const b = new Bounds();
    b.addQuad([-3, 5, 7, -2, 4, 10, -1, 1]);
    expect(b.minX).toBe(-3); expect(b.maxX).toBe(7);
    expect(b.minY).toBe(-2); expect(b.maxY).toBe(10);
  });

  it('contains() returns true for interior point', () => {
    const b = new Bounds();
    b.addPoint(0, 0).addPoint(10, 10);
    expect(b.contains(5, 5)).toBeTruthy();
  });

  it('contains() returns true on boundary', () => {
    const b = new Bounds();
    b.addPoint(0, 0).addPoint(10, 10);
    expect(b.contains(0, 0)).toBeTruthy();
    expect(b.contains(10, 10)).toBeTruthy();
  });

  it('contains() returns false for exterior point', () => {
    const b = new Bounds();
    b.addPoint(0, 0).addPoint(10, 10);
    expect(b.contains(11, 5)).toBeFalsy();
    expect(b.contains(5, -1)).toBeFalsy();
  });

  it('intersects() returns true for overlapping bounds', () => {
    const a = new Bounds();
    a.addPoint(0, 0).addPoint(10, 10);
    const b2 = new Bounds();
    b2.addPoint(5, 5).addPoint(20, 20);
    expect(a.intersects(b2)).toBeTruthy();
  });

  it('intersects() returns false for non-overlapping bounds', () => {
    const a = new Bounds();
    a.addPoint(0, 0).addPoint(5, 5);
    const b2 = new Bounds();
    b2.addPoint(10, 10).addPoint(20, 20);
    expect(a.intersects(b2)).toBeFalsy();
  });

  it('getRectangle() returns correct x, y, width, height', () => {
    const b = new Bounds();
    b.addPoint(2, 3).addPoint(12, 11);
    const r = b.getRectangle();
    expect(r.x).toBe(2);
    expect(r.y).toBe(3);
    expect(r.width).toBe(10);
    expect(r.height).toBe(8);
  });

  it('clear() resets to empty state', () => {
    const b = new Bounds();
    b.addPoint(5, 5).addPoint(10, 10);
    b.clear();
    expect(b.minX).toBe(Infinity);
    expect(b.maxX).toBe(-Infinity);
  });
});
