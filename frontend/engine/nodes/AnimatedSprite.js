import { Sprite } from './Sprite.js';

export class AnimatedSprite extends Sprite {
  constructor(frames) {
    super(frames[0]);
    this.frames = frames;
    this.animationSpeed = 1;
    this.loop = true;
    this._playing = false;
    this.onFrameChange = null;
    this.onComplete = null;
    this._currentFrame = 0;
    this._elapsed = 0;
    // dt is in seconds; normalize to ~1.0 per frame at 60fps so animationSpeed=1 means 1 frame per tick
    this._tickerUpdate = (dt) => this.update(dt * 60);
  }

  get playing() { return this._playing; }

  get currentFrame() { return this._currentFrame; }
  set currentFrame(value) {
    const clamped = Math.max(0, Math.min(value, this.frames.length - 1));
    if (this._currentFrame === clamped) return;
    this._currentFrame = clamped;
    this.texture = this.frames[clamped];
    if (this.onFrameChange) this.onFrameChange(clamped);
  }

  play() {
    if (this._playing) return;
    this._playing = true;
    if (AnimatedSprite.defaultTicker) {
      AnimatedSprite.defaultTicker.add(this._tickerUpdate);
    }
  }

  stop() {
    if (!this._playing) return;
    this._playing = false;
    if (AnimatedSprite.defaultTicker) {
      AnimatedSprite.defaultTicker.remove(this._tickerUpdate);
    }
  }

  gotoAndPlay(frame) {
    this._elapsed = 0;
    this.currentFrame = frame;
    this.play();
  }

  gotoAndStop(frame) {
    this.stop();
    this._elapsed = 0;
    this.currentFrame = frame;
  }

  update(dt) {
    if (!this._playing) return;

    this._elapsed += this.animationSpeed * dt;
    const total = this.frames.length;

    if (this.loop) {
      const next = Math.floor(this._elapsed) % total;
      this.currentFrame = (next + total) % total;
    } else {
      if (this._elapsed >= total - 1) {
        this._playing = false;
        if (AnimatedSprite.defaultTicker) {
          AnimatedSprite.defaultTicker.remove(this._tickerUpdate);
        }
        this.currentFrame = total - 1;
        if (this.onComplete) this.onComplete();
      } else {
        this.currentFrame = Math.floor(this._elapsed);
      }
    }
  }
}

AnimatedSprite.defaultTicker = null;
