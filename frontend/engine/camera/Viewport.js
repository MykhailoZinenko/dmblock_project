export class Viewport {
  constructor(canvas, onResize) {
    this.canvas = canvas;
    this._onResize = onResize;

    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(canvas);
    this._handleResize();
  }

  _handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    if (this._onResize) this._onResize(this.canvas.width, this.canvas.height);
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }

  destroy() {
    this._resizeObserver.disconnect();
  }
}
