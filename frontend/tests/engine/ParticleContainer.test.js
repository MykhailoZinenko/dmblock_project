import { describe, it, assert, assertEqual } from '../harness.js';
import { ParticleContainer } from '../../src/engine/nodes/ParticleContainer.js';
import { Node } from '../../src/engine/nodes/Node.js';
import { Texture } from '../../src/engine/textures/Texture.js';
import { BaseTexture } from '../../src/engine/textures/BaseTexture.js';
import { BLEND_MODES } from '../../src/engine/render/BlendMode.js';

function makeTex(w = 64, h = 64) {
  return new Texture(new BaseTexture(null, null, w, h));
}

function makeParticle(x = 0, y = 0) {
  return { x, y, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, tint: 0xFFFFFF, texture: makeTex() };
}

describe('ParticleContainer', () => {
  it('is a Node', () => {
    const pc = new ParticleContainer();
    assert(pc instanceof Node);
  });

  it('starts empty', () => {
    const pc = new ParticleContainer();
    assertEqual(pc._particles.length, 0);
  });

  it('addParticle stores particle', () => {
    const pc = new ParticleContainer();
    const p = makeParticle(10, 20);
    pc.addParticle(p);
    assertEqual(pc._particles.length, 1);
    assertEqual(pc._particles[0].x, 10);
  });

  it('addParticle sets baseTexture from first particle', () => {
    const pc = new ParticleContainer();
    const p = makeParticle();
    pc.addParticle(p);
    assertEqual(pc._baseTexture, p.texture.baseTexture);
  });

  it('removeParticle removes particle', () => {
    const pc = new ParticleContainer();
    const p = makeParticle();
    pc.addParticle(p);
    pc.removeParticle(p);
    assertEqual(pc._particles.length, 0);
  });

  it('default blendMode is NORMAL', () => {
    const pc = new ParticleContainer();
    assertEqual(pc.blendMode, BLEND_MODES.NORMAL);
  });

  it('_rebuild generates instance data', () => {
    const pc = new ParticleContainer();
    const tex = makeTex();
    pc.addParticle({ x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, tint: 0xFFFFFF, texture: tex });
    pc.addParticle({ x: 30, y: 40, scaleX: 2, scaleY: 2, rotation: 0, alpha: 0.5, tint: 0xFF0000, texture: tex });
    pc._rebuild();
    assert(pc._instanceData !== null);
    assertEqual(pc._instanceData[0], 10);
    assertEqual(pc._instanceData[1], 20);
  });

  it('_rebuild produces 14 floats per particle', () => {
    const pc = new ParticleContainer();
    const tex = makeTex();
    for (let i = 0; i < 5; i++) {
      pc.addParticle({ x: i, y: i, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, tint: 0xFFFFFF, texture: tex });
    }
    pc._rebuild();
    assertEqual(pc._instanceData.length, 5 * 14);
  });

  it('_rebuild handles rotation (sin/cos)', () => {
    const pc = new ParticleContainer();
    const p = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 2, alpha: 1, tint: 0xFFFFFF, texture: makeTex() };
    pc.addParticle(p);
    pc._rebuild();
    const sinR = pc._instanceData[4];
    const cosR = pc._instanceData[5];
    assert(Math.abs(sinR - 1) < 0.001);
    assert(Math.abs(cosR) < 0.001);
  });

  it('_rebuild with empty particles produces null', () => {
    const pc = new ParticleContainer();
    pc._rebuild();
    assertEqual(pc._instanceData, null);
  });

  it('destroy cleans up', () => {
    const pc = new ParticleContainer();
    pc.addParticle(makeParticle());
    pc.destroy();
    assertEqual(pc._particles.length, 0);
  });
});
