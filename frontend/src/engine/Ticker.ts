export const PRIORITY = {
  INTERACTION: 0,
  GAME: 50,
  SCENE_UPDATE: 100,
  RENDER: 200,
} as const;

export type TickerPriority = (typeof PRIORITY)[keyof typeof PRIORITY];

export type TickerCallback = (deltaTime: number) => void;

interface TickerEntry {
  fn: TickerCallback;
  priority: TickerPriority | number;
}

export class Ticker {
  public deltaTime: number;
  public elapsedTime: number;
  public fps: number;

  private _callbacks: TickerEntry[];
  private _rafId: number | null;
  private _lastTime: number;

  constructor() {
    this.deltaTime = 0;
    this.elapsedTime = 0;
    this.fps = 0;

    this._callbacks = [];
    this._rafId = null;
    this._lastTime = 0;
  }

  add(fn: TickerCallback, priority: number = PRIORITY.GAME): this {
    this._callbacks.push({ fn, priority });
    this._callbacks.sort((a: TickerEntry, b: TickerEntry) => a.priority - b.priority);
    return this;
  }

  remove(fn: TickerCallback): this {
    this._callbacks = this._callbacks.filter((entry: TickerEntry) => entry.fn !== fn);
    return this;
  }

  start(): void {
    if (this._rafId !== null) return;
    this._lastTime = performance.now();
    const loop = (now: number): void => {
      const ms: number = now - this._lastTime;
      this._tick(ms);
      this._lastTime = now;
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _tick(ms: number): void {
    this.deltaTime = ms / 1000;
    this.elapsedTime += this.deltaTime;
    this.fps = ms > 0 ? 1000 / ms : 0;
    for (const entry of this._callbacks) {
      entry.fn(this.deltaTime);
    }
  }
}
