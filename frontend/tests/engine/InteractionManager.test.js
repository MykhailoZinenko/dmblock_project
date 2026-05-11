import { describe, it, assert, assertEqual } from '../harness.js';
import { InteractionManager } from '../../src/engine/interaction/InteractionManager.js';
import { Node } from '../../src/engine/nodes/Node.js';
import { Sprite } from '../../src/engine/nodes/Sprite.js';
import { Camera } from '../../src/engine/camera/Camera.js';
import { Container } from '../../src/engine/nodes/Container.js';
import { BaseTexture } from '../../src/engine/textures/BaseTexture.js';
import { Texture } from '../../src/engine/textures/Texture.js';

function makeSprite(x, y, w, h) {
  const tex = new Texture(new BaseTexture(null, null, w, h));
  const s = new Sprite(tex);
  s.position.set(x, y);
  s.interactive = true;
  return s;
}

describe('InteractionManager', () => {
  it('_hitTest finds topmost interactive node', () => {
    const canvas = document.createElement('canvas');
    const camera = new Camera();
    camera.updateMatrix(800, 600);
    const stage = new Container();

    const s1 = makeSprite(0, 0, 100, 100);
    const s2 = makeSprite(50, 50, 100, 100);
    stage.addChild(s1);
    stage.addChild(s2);
    stage.updateTransform();

    const im = new InteractionManager(canvas, stage, camera);
    const hit = im._hitTest(stage, 75, 75);
    assert(hit === s2);
    im.destroy();
  });

  it('_hitTest returns null when nothing is hit', () => {
    const canvas = document.createElement('canvas');
    const camera = new Camera();
    camera.updateMatrix(800, 600);
    const stage = new Container();

    const s1 = makeSprite(0, 0, 100, 100);
    stage.addChild(s1);
    stage.updateTransform();

    const im = new InteractionManager(canvas, stage, camera);
    const hit = im._hitTest(stage, 200, 200);
    assertEqual(hit, null);
    im.destroy();
  });

  it('_hitTest skips non-interactive nodes', () => {
    const canvas = document.createElement('canvas');
    const camera = new Camera();
    camera.updateMatrix(800, 600);
    const stage = new Container();

    const s1 = makeSprite(0, 0, 100, 100);
    s1.interactive = false;
    stage.addChild(s1);
    stage.updateTransform();

    const im = new InteractionManager(canvas, stage, camera);
    const hit = im._hitTest(stage, 50, 50);
    assertEqual(hit, null);
    im.destroy();
  });

  it('_hitTest skips invisible nodes', () => {
    const canvas = document.createElement('canvas');
    const camera = new Camera();
    camera.updateMatrix(800, 600);
    const stage = new Container();

    const s1 = makeSprite(0, 0, 100, 100);
    s1.visible = false;
    stage.addChild(s1);
    stage.updateTransform();

    const im = new InteractionManager(canvas, stage, camera);
    const hit = im._hitTest(stage, 50, 50);
    assertEqual(hit, null);
    im.destroy();
  });

  it('_hitTest traverses children in reverse order', () => {
    const canvas = document.createElement('canvas');
    const camera = new Camera();
    camera.updateMatrix(800, 600);
    const stage = new Container();

    const s1 = makeSprite(0, 0, 200, 200);
    const s2 = makeSprite(0, 0, 200, 200);
    stage.addChild(s1);
    stage.addChild(s2);
    stage.updateTransform();

    const im = new InteractionManager(canvas, stage, camera);
    const hit = im._hitTest(stage, 50, 50);
    assert(hit === s2);
    im.destroy();
  });

  it('_propagate fires capture, target, bubble phases', () => {
    const canvas = document.createElement('canvas');
    const camera = new Camera();
    camera.updateMatrix(800, 600);
    const stage = new Container();
    const child = new Container();
    const leaf = makeSprite(0, 0, 100, 100);
    stage.addChild(child);
    child.addChild(leaf);
    stage.updateTransform();

    const im = new InteractionManager(canvas, stage, camera);
    const phases = [];
    stage.on('pointertap', (e) => phases.push({ node: 'stage', phase: e.eventPhase }));
    child.on('pointertap', (e) => phases.push({ node: 'child', phase: e.eventPhase }));
    leaf.on('pointertap', (e) => phases.push({ node: 'leaf', phase: e.eventPhase }));

    const event = im._createEvent('pointertap', leaf, 50, 50, 50, 50, {}, 0);
    im._propagate(event, leaf);

    assertEqual(phases[0].node, 'stage');
    assertEqual(phases[0].phase, 1);
    assertEqual(phases[1].node, 'child');
    assertEqual(phases[1].phase, 1);
    assertEqual(phases[2].node, 'leaf');
    assertEqual(phases[2].phase, 2);
    assertEqual(phases[3].node, 'child');
    assertEqual(phases[3].phase, 3);
    assertEqual(phases[4].node, 'stage');
    assertEqual(phases[4].phase, 3);

    im.destroy();
  });

  it('stopPropagation halts bubble phase', () => {
    const canvas = document.createElement('canvas');
    const camera = new Camera();
    camera.updateMatrix(800, 600);
    const stage = new Container();
    const leaf = makeSprite(0, 0, 100, 100);
    stage.addChild(leaf);
    stage.updateTransform();

    const im = new InteractionManager(canvas, stage, camera);
    let stageBubbled = false;
    leaf.on('pointertap', (e) => e.stopPropagation());
    stage.on('pointertap', (e) => {
      if (e.eventPhase === 3) stageBubbled = true;
    });

    const event = im._createEvent('pointertap', leaf, 50, 50, 50, 50, {}, 0);
    im._propagate(event, leaf);

    assertEqual(stageBubbled, false);
    im.destroy();
  });

  it('destroy removes event listeners', () => {
    const canvas = document.createElement('canvas');
    const camera = new Camera();
    const stage = new Container();
    const im = new InteractionManager(canvas, stage, camera);
    im.destroy();
  });
});
