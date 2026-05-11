import { Node } from './Node.js';
import { Color } from '../utils/Color.js';

interface GraphicsPath {
  points: number[];
  closed: boolean;
}

interface GraphicsBatch {
  fillColor: Float32Array;
  fillAlpha: number;
  lineWidth: number;
  lineColor: Float32Array | null;
  lineAlpha: number;
  paths: GraphicsPath[];
}

export class Graphics extends Node {
  public _batches: GraphicsBatch[];
  public _currentBatch: GraphicsBatch | null;
  public _currentPath: number[] | null;
  private _lineWidth: number;
  private _lineColor: Float32Array | null;
  private _lineAlpha: number;

  // Cached local-space triangulation (only recomputed on draw command changes)
  public _localVerts: Float32Array | null;
  public _localColors: Float32Array | null;
  public _localIndices: Uint16Array | null;
  public _triangulationDirty: boolean;

  // World-transformed GPU data (recomputed on transform change)
  public _builtVertices: Float32Array | null;
  public _builtIndices: Uint16Array | null;
  public _worldVertsDirty: boolean;

  public _gpuVertexBuffer: GPUBuffer | null;
  public _gpuIndexBuffer: GPUBuffer | null;
  public _gpuIndexCount: number;
  public _gpuBuffersDirty: boolean;

  constructor() {
    super();
    this._batches = [];
    this._currentBatch = null;
    this._currentPath = null;
    this._lineWidth = 0;
    this._lineColor = null;
    this._lineAlpha = 1;

    // Cached local-space triangulation (only recomputed on draw command changes)
    this._localVerts = null;
    this._localColors = null;
    this._localIndices = null;
    this._triangulationDirty = true;

    // World-transformed GPU data (recomputed on transform change)
    this._builtVertices = null;
    this._builtIndices = null;
    this._worldVertsDirty = true;

    this._gpuVertexBuffer = null;
    this._gpuIndexBuffer = null;
    this._gpuIndexCount = 0;
    this._gpuBuffersDirty = false;
  }

  beginFill(color: number | string | Float32Array, alpha: number = 1): this {
    this._currentBatch = {
      fillColor: Color.from(color),
      fillAlpha: alpha,
      lineWidth: 0,
      lineColor: null,
      lineAlpha: 1,
      paths: [],
    };
    this._currentPath = null;
    return this;
  }

  endFill(): this {
    this._finishPath();
    if (this._currentBatch && this._currentBatch.paths.length > 0) {
      this._currentBatch.lineWidth = this._lineWidth;
      this._currentBatch.lineColor = this._lineColor ? Float32Array.from(this._lineColor) : null;
      this._currentBatch.lineAlpha = this._lineAlpha;
      this._batches.push(this._currentBatch);
      this._triangulationDirty = true;
      this._worldVertsDirty = true;
      this._boundsDirty = true;
    }
    this._currentBatch = null;
    this._currentPath = null;
    return this;
  }

  lineStyle(width: number, color?: number | string | Float32Array, alpha: number = 1): this {
    this._lineWidth = width || 0;
    this._lineColor = color !== undefined ? Color.from(color) : null;
    this._lineAlpha = alpha;
    return this;
  }

  moveTo(x: number, y: number): this {
    this._finishPath();
    this._currentPath = [x, y];
    return this;
  }

  lineTo(x: number, y: number): this {
    if (!this._currentPath) {
      this._currentPath = [x, y];
    } else {
      this._currentPath.push(x, y);
    }
    return this;
  }

  closePath(): this {
    if (this._currentPath && this._currentPath.length >= 4 && this._currentBatch) {
      this._currentBatch.paths.push({ points: this._currentPath, closed: true });
    }
    this._currentPath = null;
    return this;
  }

  drawRect(x: number, y: number, w: number, h: number): this {
    this._finishPath();
    if (this._currentBatch) {
      this._currentBatch.paths.push({
        points: [x, y, x + w, y, x + w, y + h, x, y + h],
        closed: true,
      });
    }
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  drawRoundedRect(x: number, y: number, w: number, h: number, radius: number): this {
    this._finishPath();
    if (!this._currentBatch) return this;
    const r: number = Math.min(radius, w / 2, h / 2);
    const segs: number = Math.max(4, Math.ceil(r * 0.5));
    const points: number[] = [];

    for (let i = 0; i <= segs; i++) {
      const a: number = Math.PI * 1.5 + (i / segs) * (Math.PI / 2);
      points.push(x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r);
    }
    for (let i = 0; i <= segs; i++) {
      const a: number = (i / segs) * (Math.PI / 2);
      points.push(x + w - r + Math.cos(a) * r, y + h - r + Math.sin(a) * r);
    }
    for (let i = 0; i <= segs; i++) {
      const a: number = Math.PI / 2 + (i / segs) * (Math.PI / 2);
      points.push(x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r);
    }
    for (let i = 0; i <= segs; i++) {
      const a: number = Math.PI + (i / segs) * (Math.PI / 2);
      points.push(x + r + Math.cos(a) * r, y + r + Math.sin(a) * r);
    }

    this._currentBatch.paths.push({ points, closed: true });
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  drawCircle(cx: number, cy: number, radius: number): this {
    return this.drawEllipse(cx, cy, radius, radius);
  }

  drawEllipse(cx: number, cy: number, rx: number, ry: number): this {
    this._finishPath();
    if (!this._currentBatch) return this;
    const segments: number = Math.max(32, Math.ceil(Math.max(rx, ry) * 2));
    const step: number = (Math.PI * 2) / segments;
    const points: number[] = [];
    for (let i = 0; i < segments; i++) {
      const angle: number = step * i;
      points.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
    this._currentBatch.paths.push({ points, closed: true });
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  drawPolygon(points: number[]): this {
    this._finishPath();
    if (this._currentBatch) {
      this._currentBatch.paths.push({ points: points.slice(), closed: true });
    }
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  drawRegularPolygon(cx: number, cy: number, radius: number, sides: number): this {
    this._finishPath();
    if (!this._currentBatch) return this;
    const step: number = (Math.PI * 2) / sides;
    const points: number[] = [];
    for (let i = 0; i < sides; i++) {
      const angle: number = -Math.PI / 2 + step * i;
      points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    this._currentBatch.paths.push({ points, closed: true });
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  clear(): this {
    this._batches = [];
    this._currentBatch = null;
    this._currentPath = null;
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._localVerts = null;
    this._localColors = null;
    this._localIndices = null;
    this._builtVertices = null;
    this._builtIndices = null;
    this._boundsDirty = true;
    this._destroyGpuBuffers();
    return this;
  }

  destroy(): void {
    this._destroyGpuBuffers();
    this.removeFromParent();
  }

  removeFromParent(): void {
    this._destroyGpuBuffers();
    super.removeFromParent();
  }

  _destroyGpuBuffers(): void {
    if (this._gpuVertexBuffer) { this._gpuVertexBuffer.destroy(); this._gpuVertexBuffer = null; }
    if (this._gpuIndexBuffer) { this._gpuIndexBuffer.destroy(); this._gpuIndexBuffer = null; }
    this._gpuIndexCount = 0;
  }

  updateTransform(): void {
    const wasDirty: boolean = this._worldDirty || this._localDirty;
    super.updateTransform();
    if (wasDirty && this._localVerts) {
      this._worldVertsDirty = true;
    }
  }

  _finishPath(): void {
    if (this._currentPath && this._currentPath.length >= 4 && this._currentBatch) {
      this._currentBatch.paths.push({ points: this._currentPath, closed: false });
    }
    this._currentPath = null;
  }

  // Phase 1: triangulate in local space. Only runs when draw commands change.
  _triangulate(): void {
    if (!this._triangulationDirty) return;
    this._triangulationDirty = false;

    const localVerts: number[] = [];
    const localColors: number[] = [];
    const allIndices: number[] = [];
    let baseVertex: number = 0;

    // Fill geometry
    for (const batch of this._batches) {
      const fr: number = batch.fillColor[0];
      const fg: number = batch.fillColor[1];
      const fb: number = batch.fillColor[2];
      const fa: number = batch.fillAlpha;

      if (fa < 0.001) continue;

      for (const { points } of batch.paths) {
        const count: number = points.length / 2;
        if (count < 3) continue;

        for (let i = 0; i < count; i++) {
          localVerts.push(points[i * 2], points[i * 2 + 1]);
          localColors.push(fr, fg, fb, fa);
        }

        // Use fan triangulation for convex shapes (rects, regular polygons)
        // Fall back to ear clipping for concave shapes
        const triIndices: number[] = isConvex(points) ? fanTriangulate(count) : earClip(points);
        for (const idx of triIndices) {
          allIndices.push(baseVertex + idx);
        }
        baseVertex += count;
      }
    }

    // Line geometry with miter joins
    for (const batch of this._batches) {
      if (!batch.lineWidth || batch.lineWidth <= 0 || !batch.lineColor) continue;

      const lr: number = batch.lineColor[0];
      const lg: number = batch.lineColor[1];
      const lb: number = batch.lineColor[2];
      const la: number = batch.lineAlpha;
      const halfW: number = batch.lineWidth / 2;
      const miterLimit: number = 3;

      for (const { points, closed } of batch.paths) {
        const count: number = points.length / 2;
        if (count < 2) continue;

        const offsets: number[] = computeMiterOffsets(points, count, closed, halfW, miterLimit);

        const totalSegments: number = closed ? count : count - 1;
        for (let s = 0; s < totalSegments; s++) {
          const i0: number = s;
          const i1: number = (s + 1) % count;

          const x0: number = points[i0 * 2], y0: number = points[i0 * 2 + 1];
          const x1: number = points[i1 * 2], y1: number = points[i1 * 2 + 1];
          const m0x: number = offsets[i0 * 2], m0y: number = offsets[i0 * 2 + 1];
          const m1x: number = offsets[i1 * 2], m1y: number = offsets[i1 * 2 + 1];

          localVerts.push(
            x0 + m0x, y0 + m0y,
            x0 - m0x, y0 - m0y,
            x1 - m1x, y1 - m1y,
            x1 + m1x, y1 + m1y,
          );
          localColors.push(
            lr, lg, lb, la,
            lr, lg, lb, la,
            lr, lg, lb, la,
            lr, lg, lb, la,
          );

          const vi: number = baseVertex;
          allIndices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          baseVertex += 4;
        }
      }
    }

    this._localVerts = new Float32Array(localVerts);
    this._localColors = new Float32Array(localColors);
    this._localIndices = new Uint16Array(allIndices);
    this._worldVertsDirty = true;
  }

  // Phase 2: apply world transform to cached local vertices. Runs when transform changes.
  _buildGeometry(): void {
    this._triangulate();

    if (!this._worldVertsDirty) return;
    this._worldVertsDirty = false;
    this._gpuBuffersDirty = true;

    const localVerts: Float32Array | null = this._localVerts;
    const localColors: Float32Array | null = this._localColors;
    if (!localVerts || localVerts.length === 0) {
      this._builtVertices = null;
      this._builtIndices = this._localIndices;
      return;
    }

    const vertCount: number = localVerts.length / 2;
    const worldVerts: Float32Array = new Float32Array(vertCount * 6);
    const wt = this.worldTransform;
    const wa: number = this.worldAlpha;

    for (let i = 0; i < vertCount; i++) {
      const lx: number = localVerts[i * 2];
      const ly: number = localVerts[i * 2 + 1];
      const ci: number = i * 4;
      const oi: number = i * 6;

      worldVerts[oi]     = wt.a * lx + wt.c * ly + wt.tx;
      worldVerts[oi + 1] = wt.b * lx + wt.d * ly + wt.ty;
      worldVerts[oi + 2] = localColors![ci];
      worldVerts[oi + 3] = localColors![ci + 1];
      worldVerts[oi + 4] = localColors![ci + 2];
      worldVerts[oi + 5] = localColors![ci + 3] * wa;
    }

    this._builtVertices = worldVerts;
    this._builtIndices = this._localIndices;
  }

  _calculateBounds(): void {
    const wt = this.worldTransform;
    for (const batch of this._batches) {
      for (const { points } of batch.paths) {
        for (let i = 0; i < points.length; i += 2) {
          const lx: number = points[i];
          const ly: number = points[i + 1];
          this._bounds.addPoint(
            wt.a * lx + wt.c * ly + wt.tx,
            wt.b * lx + wt.d * ly + wt.ty,
          );
        }
      }
    }
  }

  containsPoint(worldX: number, worldY: number): boolean {
    const local = this.worldTransform.applyInverse({ x: worldX, y: worldY });
    const lx: number = local.x;
    const ly: number = local.y;

    this._triangulate();
    if (!this._localIndices || this._localIndices.length === 0) return false;

    // Use cached local-space triangulation for hit testing
    for (let t = 0; t < this._localIndices.length; t += 3) {
      const i0: number = this._localIndices[t] * 2;
      const i1: number = this._localIndices[t + 1] * 2;
      const i2: number = this._localIndices[t + 2] * 2;

      if (i0 + 1 >= this._localVerts!.length) continue;
      if (i1 + 1 >= this._localVerts!.length) continue;
      if (i2 + 1 >= this._localVerts!.length) continue;

      if (pointInTriangle(
        lx, ly,
        this._localVerts![i0], this._localVerts![i0 + 1],
        this._localVerts![i1], this._localVerts![i1 + 1],
        this._localVerts![i2], this._localVerts![i2 + 1],
      )) return true;
    }
    return false;
  }
}

function pointInTriangle(
  px: number, py: number,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
): boolean {
  const d1: number = (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1);
  const d2: number = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d3: number = (px - x0) * (y2 - y0) - (x2 - x0) * (py - y0);
  const hasNeg: boolean = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos: boolean = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function isConvex(flatVerts: number[]): boolean {
  const n: number = flatVerts.length / 2;
  if (n <= 3) return true;
  let sign: number = 0;
  for (let i = 0; i < n; i++) {
    const j: number = (i + 1) % n;
    const k: number = (i + 2) % n;
    const cross: number = (flatVerts[j * 2] - flatVerts[i * 2]) * (flatVerts[k * 2 + 1] - flatVerts[j * 2 + 1])
                - (flatVerts[j * 2 + 1] - flatVerts[i * 2 + 1]) * (flatVerts[k * 2] - flatVerts[j * 2]);
    if (cross !== 0) {
      if (sign === 0) sign = cross > 0 ? 1 : -1;
      else if ((cross > 0 ? 1 : -1) !== sign) return false;
    }
  }
  return true;
}

function fanTriangulate(count: number): number[] {
  const indices: number[] = [];
  for (let i = 1; i < count - 1; i++) {
    indices.push(0, i, i + 1);
  }
  return indices;
}

function computeMiterOffsets(
  points: number[],
  count: number,
  closed: boolean,
  halfW: number,
  miterLimit: number,
): number[] {
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    let mx: number, my: number;
    const hasPrev: boolean = closed || i > 0;
    const hasNext: boolean = closed || i < count - 1;
    const pi: number = (i - 1 + count) % count;
    const ni: number = (i + 1) % count;

    if (hasPrev && hasNext) {
      const prevX: number = points[pi * 2], prevY: number = points[pi * 2 + 1];
      const curX: number = points[i * 2], curY: number = points[i * 2 + 1];
      const nextX: number = points[ni * 2], nextY: number = points[ni * 2 + 1];

      const d1x: number = curX - prevX, d1y: number = curY - prevY;
      const d2x: number = nextX - curX, d2y: number = nextY - curY;
      const l1: number = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
      const l2: number = Math.sqrt(d2x * d2x + d2y * d2y) || 1;

      const n1x: number = -d1y / l1, n1y: number = d1x / l1;
      const n2x: number = -d2y / l2, n2y: number = d2x / l2;

      mx = n1x + n2x;
      my = n1y + n2y;
      const mLen: number = Math.sqrt(mx * mx + my * my);

      if (mLen > 0.0001) {
        const dot: number = mx * n1x + my * n1y;
        const miterScale: number = halfW / (dot / mLen);
        const clamped: number = Math.min(Math.abs(miterScale), halfW * miterLimit);
        const sign: number = miterScale < 0 ? -1 : 1;
        mx = (mx / mLen) * clamped * sign;
        my = (my / mLen) * clamped * sign;
      } else {
        mx = n1x * halfW;
        my = n1y * halfW;
      }
    } else if (hasNext) {
      const curX: number = points[i * 2], curY: number = points[i * 2 + 1];
      const nextX: number = points[ni * 2], nextY: number = points[ni * 2 + 1];
      const dx: number = nextX - curX, dy: number = nextY - curY;
      const l: number = Math.sqrt(dx * dx + dy * dy) || 1;
      mx = -dy / l * halfW;
      my = dx / l * halfW;
    } else {
      const prevX: number = points[pi * 2], prevY: number = points[pi * 2 + 1];
      const curX: number = points[i * 2], curY: number = points[i * 2 + 1];
      const dx: number = curX - prevX, dy: number = curY - prevY;
      const l: number = Math.sqrt(dx * dx + dy * dy) || 1;
      mx = -dy / l * halfW;
      my = dx / l * halfW;
    }

    offsets.push(mx, my);
  }
  return offsets;
}

function earClip(flatVerts: number[]): number[] {
  const n: number = flatVerts.length / 2;
  if (n < 3) return [];
  if (n === 3) return [0, 1, 2];

  const indices: number[] = [];
  const remaining: number[] = [];
  for (let i = 0; i < n; i++) remaining.push(i);

  let area: number = 0;
  for (let i = 0; i < n; i++) {
    const j: number = (i + 1) % n;
    area += flatVerts[i * 2] * flatVerts[j * 2 + 1];
    area -= flatVerts[j * 2] * flatVerts[i * 2 + 1];
  }
  if (area < 0) remaining.reverse();

  let failCount: number = 0;
  let i: number = 0;

  while (remaining.length > 3) {
    if (failCount >= remaining.length) break;

    const len: number = remaining.length;
    const prevIdx: number = remaining[((i - 1) % len + len) % len];
    const currIdx: number = remaining[i % len];
    const nextIdx: number = remaining[(i + 1) % len];

    const ax: number = flatVerts[prevIdx * 2], ay: number = flatVerts[prevIdx * 2 + 1];
    const bx: number = flatVerts[currIdx * 2], by: number = flatVerts[currIdx * 2 + 1];
    const cx: number = flatVerts[nextIdx * 2], cy: number = flatVerts[nextIdx * 2 + 1];

    const cross: number = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

    if (cross > 0) {
      let ear: boolean = true;
      for (let j = 0; j < remaining.length; j++) {
        const idx: number = remaining[j];
        if (idx === prevIdx || idx === currIdx || idx === nextIdx) continue;
        if (pointInTriangle(
          flatVerts[idx * 2], flatVerts[idx * 2 + 1],
          ax, ay, bx, by, cx, cy,
        )) {
          ear = false;
          break;
        }
      }

      if (ear) {
        indices.push(prevIdx, currIdx, nextIdx);
        remaining.splice(i % len, 1);
        failCount = 0;
        if (i >= remaining.length) i = 0;
        continue;
      }
    }

    failCount++;
    i = (i + 1) % remaining.length;
  }

  if (remaining.length === 3) {
    indices.push(remaining[0], remaining[1], remaining[2]);
  }

  return indices;
}
