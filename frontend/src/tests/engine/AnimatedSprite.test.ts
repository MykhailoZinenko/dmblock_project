import { describe, it, assert, assertEqual } from '../harness.js';
import { Sprite } from '../../engine/nodes/Sprite.js';
import { AnimatedSprite } from '../../engine/nodes/AnimatedSprite.js';
import { Texture } from '../../engine/textures/Texture.js';
import { BaseTexture } from '../../engine/textures/BaseTexture.js';

function makeFrames(n: number, w: number = 32, h: number = 32): Texture[] {
  return Array.from({ length: n }, () =>
    new Texture(new BaseTexture(null, null, w, h))
  );
}

describe('AnimatedSprite', () => {
  it('is a Sprite', () => {
    const a = new AnimatedSprite(makeFrames(4));
    assert(a instanceof Sprite);
  });

  it('starts at frame 0 and is not playing', () => {
    const a = new AnimatedSprite(makeFrames(4));
    assertEqual(a.currentFrame, 0);
    assertEqual(a.playing, false);
  });

  it('play() sets playing to true', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    assertEqual(a.playing, true);
  });

  it('stop() sets playing to false', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    a.stop();
    assertEqual(a.playing, false);
  });

  it('gotoAndStop sets frame without playing', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.gotoAndStop(2);
    assertEqual(a.currentFrame, 2);
    assertEqual(a.playing, false);
  });

  it('gotoAndPlay sets frame and starts playing', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.gotoAndPlay(2);
    assertEqual(a.currentFrame, 2);
    assertEqual(a.playing, true);
  });

  it('update advances frames based on animationSpeed', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    a.update(1);
    assertEqual(a.currentFrame, 1);
    a.update(1);
    assertEqual(a.currentFrame, 2);
  });

  it('loops back to frame 0 when loop is true', () => {
    const frames = makeFrames(4);
    const a = new AnimatedSprite(frames);
    a.loop = true;
    a.play();
    a.update(1);
    a.update(1);
    a.update(1);
    a.update(1);
    assertEqual(a.currentFrame, 0);
  });

  it('stops at last frame when loop is false', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.loop = false;
    a.play();
    a.update(1);
    a.update(1);
    a.update(1);
    assertEqual(a.currentFrame, 3);
    assertEqual(a.playing, false);
  });

  it('fires onComplete when non-loop animation finishes', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.loop = false;
    let completed = false;
    a.onComplete = () => { completed = true; };
    a.play();
    a.update(1);
    a.update(1);
    a.update(1);
    assert(completed);
  });

  it('fires onFrameChange when frame changes', () => {
    const a = new AnimatedSprite(makeFrames(4));
    const changed: number[] = [];
    a.onFrameChange = (idx: number) => changed.push(idx);
    a.play();
    a.update(1);
    a.update(1);
    assertEqual(changed[0], 1);
    assertEqual(changed[1], 2);
  });

  it('fractional animationSpeed advances at half rate', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.animationSpeed = 0.5;
    a.play();
    a.update(1);
    assertEqual(a.currentFrame, 0);
    a.update(1);
    assertEqual(a.currentFrame, 1);
  });
});
