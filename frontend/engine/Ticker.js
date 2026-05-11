export const PRIORITY = {
  INTERACTION: 0,
  GAME: 50,
  SCENE_UPDATE: 100,
  RENDER: 200,
};

export class Ticker {
  constructor() {
    this.deltaTime = 0;
    this.elapsedTime = 0;
    this.fps = 0;

    this._callbacks = [];
    this._rafId = null;
    this._lastTime = 0;
  }

  add(fn, priority = PRIORITY.GAME) {
    this._callbacks.push({ fn, priority });
    this._callbacks.sort((a, b) => a.priority - b.priority);
    return this;
  }

  remove(fn) {
    this._callbacks = this._callbacks.filter(entry => entry.fn !== fn);
    return this;
  }

  start() {
    if (this._rafId !== null) return;
    this._lastTime = performance.now();
    const loop = (now) => {
      const ms = now - this._lastTime;
      this._tick(ms);
      this._lastTime = now;
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick(ms) {
    this.deltaTime = ms / 1000;
    this.elapsedTime += this.deltaTime;
    this.fps = ms > 0 ? 1000 / ms : 0;
    for (const entry of this._callbacks) {
      entry.fn(this.deltaTime);
    }
  }
}
