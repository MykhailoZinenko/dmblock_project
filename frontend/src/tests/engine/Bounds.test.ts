import { describe, it, assertEqual, assert } from '../harness.js';
import { Bounds } from '../../engine/math/Bounds.js';

describe('Bounds', () => {
  it('starts empty (min Infinity, max -Infinity)', () => {
    const b = new Bounds();
    assertEqual(b.minX,  Infinity);
    assertEqual(b.minY,  Infinity);
    assertEqual(b.maxX, -Infinity);
    assertEqual(b.maxY, -Infinity);
  });

  it('addPoint() expands bounds to contain the point', () => {
    const b = new Bounds();
    b.addPoint(3, 7);
    assertEqual(b.minX, 3); assertEqual(b.maxX, 3);
    assertEqual(b.minY, 7); assertEqual(b.maxY, 7);
  });

  it('addPoint() expands with multiple points', () => {
    const b = new Bounds();
    b.addPoint(-5, 2).addPoint(10, -3);
    assertEqual(b.minX, -5); assertEqual(b.maxX, 10);
    assertEqual(b.minY, -3); assertEqual(b.maxY, 2);
  });

  it('addBounds() unions two bounds', () => {
    const a = new Bounds();
    a.addPoint(0, 0).addPoint(10, 10);
    const b2 = new Bounds();
    b2.addPoint(5, -5).addPoint(20, 20);
    a.addBounds(b2);
    assertEqual(a.minX, 0);  assertEqual(a.maxX, 20);
    assertEqual(a.minY, -5); assertEqual(a.maxY, 20);
  });

  it('addQuad() expands to cover all 4 vertices', () => {
    const b = new Bounds();
    b.addQuad([0, 0, 100, 0, 100, 80, 0, 80]);
    assertEqual(b.minX, 0);   assertEqual(b.maxX, 100);
    assertEqual(b.minY, 0);   assertEqual(b.maxY, 80);
  });

  it('addQuad() works with non-axis-aligned vertices', () => {
    const b = new Bounds();
    b.addQuad([-3, 5, 7, -2, 4, 10, -1, 1]);
    assertEqual(b.minX, -3); assertEqual(b.maxX, 7);
    assertEqual(b.minY, -2); assertEqual(b.maxY, 10);
  });

  it('contains() returns true for interior point', () => {
    const b = new Bounds();
    b.addPoint(0, 0).addPoint(10, 10);
    assert(b.contains(5, 5));
  });

  it('contains() returns true on boundary', () => {
    const b = new Bounds();
    b.addPoint(0, 0).addPoint(10, 10);
    assert(b.contains(0, 0));
    assert(b.contains(10, 10));
  });

  it('contains() returns false for exterior point', () => {
    const b = new Bounds();
    b.addPoint(0, 0).addPoint(10, 10);
    assert(!b.contains(11, 5));
    assert(!b.contains(5, -1));
  });

  it('intersects() returns true for overlapping bounds', () => {
    const a = new Bounds();
    a.addPoint(0, 0).addPoint(10, 10);
    const b2 = new Bounds();
    b2.addPoint(5, 5).addPoint(20, 20);
    assert(a.intersects(b2));
  });

  it('intersects() returns false for non-overlapping bounds', () => {
    const a = new Bounds();
    a.addPoint(0, 0).addPoint(5, 5);
    const b2 = new Bounds();
    b2.addPoint(10, 10).addPoint(20, 20);
    assert(!a.intersects(b2));
  });

  it('getRectangle() returns correct x, y, width, height', () => {
    const b = new Bounds();
    b.addPoint(2, 3).addPoint(12, 11);
    const r = b.getRectangle();
    assertEqual(r.x, 2);
    assertEqual(r.y, 3);
    assertEqual(r.width, 10);
    assertEqual(r.height, 8);
  });

  it('clear() resets to empty state', () => {
    const b = new Bounds();
    b.addPoint(5, 5).addPoint(10, 10);
    b.clear();
    assertEqual(b.minX,  Infinity);
    assertEqual(b.maxX, -Infinity);
  });
});
