import { describe, it, assertEqual, assertApprox } from '../harness.js';
import { Camera } from '../../engine/camera/Camera.js';

describe('Camera', () => {
  it('defaults to position 0,0 zoom 1', () => {
    const cam = new Camera();
    assertEqual(cam.position.x, 0);
    assertEqual(cam.position.y, 0);
    assertEqual(cam.zoom, 1);
    assertEqual(cam.rotation, 0);
  });

  it('getViewMatrix translates by negative position', () => {
    const cam = new Camera();
    cam.position.set(100, 200);
    const m = cam.getViewMatrix();
    const p = m.apply({ x: 100, y: 200 });
    assertApprox(p.x, 0);
    assertApprox(p.y, 0);
  });

  it('zoom scales the view', () => {
    const cam = new Camera();
    cam.zoom = 2;
    const m = cam.getViewMatrix();
    const p = m.apply({ x: 10, y: 10 });
    assertApprox(p.x, 20);
    assertApprox(p.y, 20);
  });

  it('getProjectionMatrix maps centered view space to NDC', () => {
    const cam = new Camera();
    const m = cam.getProjectionMatrix(800, 600);
    // View space origin (camera center) maps to NDC origin
    const center = m.apply({ x: 0, y: 0 });
    assertApprox(center.x, 0);
    assertApprox(center.y, 0);
    // Half-width right, half-height down maps to NDC (1, -1)
    const edge = m.apply({ x: 400, y: 300 });
    assertApprox(edge.x, 1);
    assertApprox(edge.y, -1);
  });

  it('screenToWorld converts screen center to camera position', () => {
    const cam = new Camera();
    cam.position.set(100, 100);
    cam.zoom = 2;
    cam.updateMatrix(800, 600);
    const w = cam.screenToWorld(400, 300);
    assertApprox(w.x, 100);
    assertApprox(w.y, 100);
  });

  it('worldToScreen converts camera position to screen center', () => {
    const cam = new Camera();
    cam.position.set(100, 100);
    cam.zoom = 2;
    cam.updateMatrix(800, 600);
    const s = cam.worldToScreen(100, 100);
    assertApprox(s.x, 400);
    assertApprox(s.y, 300);
  });

  it('screenToWorld and worldToScreen are inverses', () => {
    const cam = new Camera();
    cam.position.set(250, 150);
    cam.zoom = 1.5;
    cam.updateMatrix(1920, 1080);
    const world = cam.screenToWorld(500, 300);
    const screen = cam.worldToScreen(world.x, world.y);
    assertApprox(screen.x, 500);
    assertApprox(screen.y, 300);
  });

  it('dirty flag set when position changes', () => {
    const cam = new Camera();
    cam.updateMatrix(800, 600);
    cam.dirty = false;
    cam.position.x = 50;
    assertEqual(cam.dirty, true);
  });

  it('dirty flag set when zoom changes', () => {
    const cam = new Camera();
    cam.updateMatrix(800, 600);
    cam.dirty = false;
    cam.zoom = 2;
    assertEqual(cam.dirty, true);
  });
});
