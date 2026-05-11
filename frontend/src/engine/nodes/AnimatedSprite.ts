import { Sprite } from './Sprite.js';
import type { Texture } from '../textures/Texture.js';
import type { Ticker, TickerCallback } from '../Ticker.js';

export class AnimatedSprite extends Sprite {
  static defaultTicker: Ticker | null = null;

  public frames: Texture[];
  public animationSpeed: number;
  public loop: boolean;
  public onFrameChange: ((frame: number) => void) | null;
  public onComplete: (() => void) | null;

  private _playing: boolean;
  private _currentFrame: number;
  private _elapsed: number;
  private _tickerUpdate: TickerCallback;

  constructor(frames: Texture[]) {
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
    this._tickerUpdate = (dt: number) => this.update(dt * 60);
  }

  get playing(): boolean { return this._playing; }

  get currentFrame(): number { return this._currentFrame; }
  set currentFrame(value: number) {
    const clamped: number = Math.max(0, Math.min(value, this.frames.length - 1));
    if (this._currentFrame === clamped) return;
    this._currentFrame = clamped;
    this.texture = this.frames[clamped];
    if (this.onFrameChange) this.onFrameChange(clamped);
  }

  play(): void {
    if (this._playing) return;
    this._playing = true;
    if (AnimatedSprite.defaultTicker) {
      AnimatedSprite.defaultTicker.add(this._tickerUpdate);
    }
  }

  stop(): void {
    if (!this._playing) return;
    this._playing = false;
    if (AnimatedSprite.defaultTicker) {
      AnimatedSprite.defaultTicker.remove(this._tickerUpdate);
    }
  }

  gotoAndPlay(frame: number): void {
    this._elapsed = 0;
    this.currentFrame = frame;
    this.play();
  }

  gotoAndStop(frame: number): void {
    this.stop();
    this._elapsed = 0;
    this.currentFrame = frame;
  }

  update(dt: number): void {
    if (!this._playing) return;

    this._elapsed += this.animationSpeed * dt;
    const total: number = this.frames.length;

    if (this.loop) {
      const next: number = Math.floor(this._elapsed) % total;
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
