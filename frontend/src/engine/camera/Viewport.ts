export type ResizeCallback = (width: number, height: number) => void;

export class Viewport {
  public canvas: HTMLCanvasElement;
  private _onResize: ResizeCallback | null;
  private _resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, onResize?: ResizeCallback) {
    this.canvas = canvas;
    this._onResize = onResize ?? null;

    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(canvas);
    this._handleResize();
  }

  _handleResize(): void {
    const dpr: number = window.devicePixelRatio || 1;
    const rect: DOMRect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    if (this._onResize) this._onResize(this.canvas.width, this.canvas.height);
  }

  get width(): number { return this.canvas.width; }
  get height(): number { return this.canvas.height; }

  destroy(): void {
    this._resizeObserver.disconnect();
  }
}
