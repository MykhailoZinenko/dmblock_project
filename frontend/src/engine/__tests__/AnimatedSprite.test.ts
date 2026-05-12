import { describe, it, expect } from 'vitest';
import { Sprite } from '../nodes/Sprite.js';
import { AnimatedSprite } from '../nodes/AnimatedSprite.js';
import { Texture } from '../textures/Texture.js';
import { BaseTexture } from '../textures/BaseTexture.js';

function makeFrames(n: number, w: number = 32, h: number = 32): Texture[] {
  return Array.from({ length: n }, () =>
    new Texture(new BaseTexture(null, null, w, h))
  );
}

describe('AnimatedSprite', () => {
  it('is a Sprite', () => {
    const a = new AnimatedSprite(makeFrames(4));
    expect(a instanceof Sprite).toBeTruthy();
  });

  it('starts at frame 0 and is not playing', () => {
    const a = new AnimatedSprite(makeFrames(4));
    expect(a.currentFrame).toBe(0);
    expect(a.playing).toBe(false);
  });

  it('play() sets playing to true', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    expect(a.playing).toBe(true);
  });

  it('stop() sets playing to false', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    a.stop();
    expect(a.playing).toBe(false);
  });

  it('gotoAndStop sets frame without playing', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.gotoAndStop(2);
    expect(a.currentFrame).toBe(2);
    expect(a.playing).toBe(false);
  });

  it('gotoAndPlay sets frame and starts playing', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.gotoAndPlay(2);
    expect(a.currentFrame).toBe(2);
    expect(a.playing).toBe(true);
  });

  it('update advances frames based on animationSpeed', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    a.update(1);
    expect(a.currentFrame).toBe(1);
    a.update(1);
    expect(a.currentFrame).toBe(2);
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
    expect(a.currentFrame).toBe(0);
  });

  it('stops at last frame when loop is false', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.loop = false;
    a.play();
    a.update(1);
    a.update(1);
    a.update(1);
    expect(a.currentFrame).toBe(3);
    expect(a.playing).toBe(false);
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
    expect(completed).toBeTruthy();
  });

  it('fires onFrameChange when frame changes', () => {
    const a = new AnimatedSprite(makeFrames(4));
    const changed: number[] = [];
    a.onFrameChange = (idx: number) => changed.push(idx);
    a.play();
    a.update(1);
    a.update(1);
    expect(changed[0]).toBe(1);
    expect(changed[1]).toBe(2);
  });

  it('fractional animationSpeed advances at half rate', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.animationSpeed = 0.5;
    a.play();
    a.update(1);
    expect(a.currentFrame).toBe(0);
    a.update(1);
    expect(a.currentFrame).toBe(1);
  });

  it('update does nothing when not playing', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.update(1);
    expect(a.currentFrame).toBe(0);
  });

  it('onComplete is null by default and does not crash', () => {
    const a = new AnimatedSprite(makeFrames(2));
    a.loop = false;
    a.play();
    a.update(1); // reaches last frame
    expect(a.currentFrame).toBe(1);
    expect(a.playing).toBe(false);
  });

  it('onFrameChange is null by default and does not crash', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    a.update(1);
    expect(a.currentFrame).toBe(1);
  });

  it('play/stop register/unregister with defaultTicker when set', () => {
    const added: Function[] = [];
    const removed: Function[] = [];
    const fakeTicker = {
      add: (fn: Function) => { added.push(fn); return fakeTicker; },
      remove: (fn: Function) => { removed.push(fn); return fakeTicker; },
    };
    (AnimatedSprite as any).defaultTicker = fakeTicker;

    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    expect(added.length).toBe(1);
    a.stop();
    expect(removed.length).toBe(1);

    (AnimatedSprite as any).defaultTicker = null;
  });

  it('non-loop finish unregisters from defaultTicker', () => {
    const removed: Function[] = [];
    const fakeTicker = {
      add: () => fakeTicker,
      remove: (fn: Function) => { removed.push(fn); return fakeTicker; },
    };
    (AnimatedSprite as any).defaultTicker = fakeTicker;

    const a = new AnimatedSprite(makeFrames(2));
    a.loop = false;
    a.play();
    a.update(1); // reaches last frame
    expect(removed.length).toBe(1);
    expect(a.playing).toBe(false);

    (AnimatedSprite as any).defaultTicker = null;
  });

  it('play when already playing is a no-op', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.play();
    a.play(); // no-op
    expect(a.playing).toBe(true);
  });

  it('stop when already stopped is a no-op', () => {
    const a = new AnimatedSprite(makeFrames(4));
    a.stop(); // no-op
    expect(a.playing).toBe(false);
  });
});
