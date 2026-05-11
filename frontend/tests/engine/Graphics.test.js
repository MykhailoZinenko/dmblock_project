import { describe, it, assert, assertEqual } from '../harness.js';
import { Node } from '../../src/engine/nodes/Node.js';
import { Graphics } from '../../src/engine/nodes/Graphics.js';

describe('Graphics', () => {
  it('is a Node', () => {
    const g = new Graphics();
    assert(g instanceof Node);
  });

  it('clear resets geometry', () => {
    const g = new Graphics();
    g.beginFill(0xff0000).drawRect(0, 0, 100, 100).endFill();
    assertEqual(g._batches.length, 1);
    g.clear();
    assertEqual(g._batches.length, 0);
    assertEqual(g._builtVertices, null);
  });

  it('drawRect creates a closed path with 4 vertices', () => {
    const g = new Graphics();
    g.beginFill(0xff0000).drawRect(0, 0, 50, 50).endFill();
    assertEqual(g._batches[0].paths[0].points.length, 8);
    assertEqual(g._batches[0].paths[0].closed, true);
  });

  it('drawCircle creates polygon vertices', () => {
    const g = new Graphics();
    g.beginFill(0x00ff00).drawCircle(0, 0, 50).endFill();
    assert(g._batches[0].paths[0].points.length > 12);
    assertEqual(g._batches[0].paths[0].closed, true);
  });

  it('drawRegularPolygon with 6 sides creates hexagon', () => {
    const g = new Graphics();
    g.beginFill(0x0000ff).drawRegularPolygon(0, 0, 50, 6).endFill();
    assertEqual(g._batches[0].paths[0].points.length, 12);
  });

  it('drawPolygon with flat array', () => {
    const g = new Graphics();
    g.beginFill(0xffff00).drawPolygon([0, 0, 100, 0, 50, 80]).endFill();
    assertEqual(g._batches[0].paths[0].points.length, 6);
  });

  it('multiple paths in one fill', () => {
    const g = new Graphics();
    g.beginFill(0xff0000);
    g.drawRect(0, 0, 50, 50);
    g.drawRect(100, 0, 50, 50);
    g.endFill();
    assertEqual(g._batches[0].paths.length, 2);
  });

  it('moveTo/lineTo creates an open path', () => {
    const g = new Graphics();
    g.beginFill(0xff0000);
    g.moveTo(0, 0).lineTo(100, 0).lineTo(50, 100);
    g.endFill();
    assertEqual(g._batches[0].paths.length, 1);
    assertEqual(g._batches[0].paths[0].points.length, 6);
    assertEqual(g._batches[0].paths[0].closed, false);
  });

  it('closePath makes moveTo/lineTo path closed', () => {
    const g = new Graphics();
    g.beginFill(0xff0000);
    g.moveTo(0, 0).lineTo(100, 0).lineTo(50, 100).closePath();
    g.endFill();
    assertEqual(g._batches[0].paths[0].closed, true);
  });

  it('drawRoundedRect creates more vertices than drawRect', () => {
    const g = new Graphics();
    g.beginFill(0xff0000).drawRoundedRect(0, 0, 100, 60, 10).endFill();
    assert(g._batches[0].paths[0].points.length > 8);
  });

  it('lineStyle stores line properties on batch', () => {
    const g = new Graphics();
    g.lineStyle(3, 0xff0000, 0.8);
    g.beginFill(0x00ff00).drawRect(0, 0, 50, 50).endFill();
    assertEqual(g._batches[0].lineWidth, 3);
    assert(g._batches[0].lineColor !== null);
  });

  it('chainable API', () => {
    const g = new Graphics();
    const result = g.beginFill(0xff0000).drawRect(0, 0, 10, 10).endFill();
    assertEqual(result, g);
  });

  it('containsPoint works for filled rect', () => {
    const g = new Graphics();
    g.beginFill(0xff0000).drawRect(0, 0, 100, 100).endFill();
    g.updateTransform();
    assert(g.containsPoint(50, 50));
    assert(!g.containsPoint(150, 150));
  });

  it('containsPoint works for concave polygon', () => {
    const g = new Graphics();
    g.beginFill(0xff0000);
    // L-shape
    g.drawPolygon([0, 0, 30, 0, 30, 60, 80, 60, 80, 90, 0, 90]);
    g.endFill();
    g.updateTransform();
    assert(g.containsPoint(15, 15));
    assert(g.containsPoint(50, 75));
    assert(!g.containsPoint(50, 30));
  });
});
