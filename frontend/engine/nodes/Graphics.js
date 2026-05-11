import { Node } from './Node.js';
import { Color } from '../utils/Color.js';

export class Graphics extends Node {
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

  beginFill(color, alpha = 1) {
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

  endFill() {
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

  lineStyle(width, color, alpha = 1) {
    this._lineWidth = width || 0;
    this._lineColor = color !== undefined ? Color.from(color) : null;
    this._lineAlpha = alpha;
    return this;
  }

  moveTo(x, y) {
    this._finishPath();
    this._currentPath = [x, y];
    return this;
  }

  lineTo(x, y) {
    if (!this._currentPath) {
      this._currentPath = [x, y];
    } else {
      this._currentPath.push(x, y);
    }
    return this;
  }

  closePath() {
    if (this._currentPath && this._currentPath.length >= 4 && this._currentBatch) {
      this._currentBatch.paths.push({ points: this._currentPath, closed: true });
    }
    this._currentPath = null;
    return this;
  }

  drawRect(x, y, w, h) {
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

  drawRoundedRect(x, y, w, h, radius) {
    this._finishPath();
    if (!this._currentBatch) return this;
    const r = Math.min(radius, w / 2, h / 2);
    const segs = Math.max(4, Math.ceil(r * 0.5));
    const points = [];

    for (let i = 0; i <= segs; i++) {
      const a = Math.PI * 1.5 + (i / segs) * (Math.PI / 2);
      points.push(x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r);
    }
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * (Math.PI / 2);
      points.push(x + w - r + Math.cos(a) * r, y + h - r + Math.sin(a) * r);
    }
    for (let i = 0; i <= segs; i++) {
      const a = Math.PI / 2 + (i / segs) * (Math.PI / 2);
      points.push(x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r);
    }
    for (let i = 0; i <= segs; i++) {
      const a = Math.PI + (i / segs) * (Math.PI / 2);
      points.push(x + r + Math.cos(a) * r, y + r + Math.sin(a) * r);
    }

    this._currentBatch.paths.push({ points, closed: true });
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  drawCircle(cx, cy, radius) {
    return this.drawEllipse(cx, cy, radius, radius);
  }

  drawEllipse(cx, cy, rx, ry) {
    this._finishPath();
    if (!this._currentBatch) return this;
    const segments = Math.max(32, Math.ceil(Math.max(rx, ry) * 2));
    const step = (Math.PI * 2) / segments;
    const points = [];
    for (let i = 0; i < segments; i++) {
      const angle = step * i;
      points.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
    this._currentBatch.paths.push({ points, closed: true });
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  drawPolygon(points) {
    this._finishPath();
    if (this._currentBatch) {
      this._currentBatch.paths.push({ points: points.slice(), closed: true });
    }
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  drawRegularPolygon(cx, cy, radius, sides) {
    this._finishPath();
    if (!this._currentBatch) return this;
    const step = (Math.PI * 2) / sides;
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = -Math.PI / 2 + step * i;
      points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    this._currentBatch.paths.push({ points, closed: true });
    this._triangulationDirty = true;
    this._worldVertsDirty = true;
    this._boundsDirty = true;
    return this;
  }

  clear() {
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

  destroy() {
    this._destroyGpuBuffers();
    this.removeFromParent();
  }

  removeFromParent() {
    this._destroyGpuBuffers();
    super.removeFromParent();
  }

  _destroyGpuBuffers() {
    if (this._gpuVertexBuffer) { this._gpuVertexBuffer.destroy(); this._gpuVertexBuffer = null; }
    if (this._gpuIndexBuffer) { this._gpuIndexBuffer.destroy(); this._gpuIndexBuffer = null; }
    this._gpuIndexCount = 0;
  }

  updateTransform() {
    const wasDirty = this._worldDirty || this._localDirty;
    super.updateTransform();
    if (wasDirty && this._localVerts) {
      this._worldVertsDirty = true;
    }
  }

  _finishPath() {
    if (this._currentPath && this._currentPath.length >= 4 && this._currentBatch) {
      this._currentBatch.paths.push({ points: this._currentPath, closed: false });
    }
    this._currentPath = null;
  }

  // Phase 1: triangulate in local space. Only runs when draw commands change.
  _triangulate() {
    if (!this._triangulationDirty) return;
    this._triangulationDirty = false;

    const localVerts = [];
    const localColors = [];
    const allIndices = [];
    let baseVertex = 0;

    // Fill geometry
    for (const batch of this._batches) {
      const fr = batch.fillColor[0];
      const fg = batch.fillColor[1];
      const fb = batch.fillColor[2];
      const fa = batch.fillAlpha;

      if (fa < 0.001) continue;

      for (const { points } of batch.paths) {
        const count = points.length / 2;
        if (count < 3) continue;

        for (let i = 0; i < count; i++) {
          localVerts.push(points[i * 2], points[i * 2 + 1]);
          localColors.push(fr, fg, fb, fa);
        }

        // Use fan triangulation for convex shapes (rects, regular polygons)
        // Fall back to ear clipping for concave shapes
        const triIndices = isConvex(points) ? fanTriangulate(count) : earClip(points);
        for (const idx of triIndices) {
          allIndices.push(baseVertex + idx);
        }
        baseVertex += count;
      }
    }

    // Line geometry with miter joins
    for (const batch of this._batches) {
      if (!batch.lineWidth || batch.lineWidth <= 0 || !batch.lineColor) continue;

      const lr = batch.lineColor[0];
      const lg = batch.lineColor[1];
      const lb = batch.lineColor[2];
      const la = batch.lineAlpha;
      const halfW = batch.lineWidth / 2;
      const miterLimit = 3;

      for (const { points, closed } of batch.paths) {
        const count = points.length / 2;
        if (count < 2) continue;

        const offsets = computeMiterOffsets(points, count, closed, halfW, miterLimit);

        const totalSegments = closed ? count : count - 1;
        for (let s = 0; s < totalSegments; s++) {
          const i0 = s;
          const i1 = (s + 1) % count;

          const x0 = points[i0 * 2], y0 = points[i0 * 2 + 1];
          const x1 = points[i1 * 2], y1 = points[i1 * 2 + 1];
          const m0x = offsets[i0 * 2], m0y = offsets[i0 * 2 + 1];
          const m1x = offsets[i1 * 2], m1y = offsets[i1 * 2 + 1];

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

          const vi = baseVertex;
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
  _buildGeometry() {
    this._triangulate();

    if (!this._worldVertsDirty) return;
    this._worldVertsDirty = false;
    this._gpuBuffersDirty = true;

    const localVerts = this._localVerts;
    const localColors = this._localColors;
    if (!localVerts || localVerts.length === 0) {
      this._builtVertices = null;
      this._builtIndices = this._localIndices;
      return;
    }

    const vertCount = localVerts.length / 2;
    const worldVerts = new Float32Array(vertCount * 6);
    const wt = this.worldTransform;
    const wa = this.worldAlpha;

    for (let i = 0; i < vertCount; i++) {
      const lx = localVerts[i * 2];
      const ly = localVerts[i * 2 + 1];
      const ci = i * 4;
      const oi = i * 6;

      worldVerts[oi]     = wt.a * lx + wt.c * ly + wt.tx;
      worldVerts[oi + 1] = wt.b * lx + wt.d * ly + wt.ty;
      worldVerts[oi + 2] = localColors[ci];
      worldVerts[oi + 3] = localColors[ci + 1];
      worldVerts[oi + 4] = localColors[ci + 2];
      worldVerts[oi + 5] = localColors[ci + 3] * wa;
    }

    this._builtVertices = worldVerts;
    this._builtIndices = this._localIndices;
  }

  _calculateBounds() {
    const wt = this.worldTransform;
    for (const batch of this._batches) {
      for (const { points } of batch.paths) {
        for (let i = 0; i < points.length; i += 2) {
          const lx = points[i];
          const ly = points[i + 1];
          this._bounds.addPoint(
            wt.a * lx + wt.c * ly + wt.tx,
            wt.b * lx + wt.d * ly + wt.ty,
          );
        }
      }
    }
  }

  containsPoint(worldX, worldY) {
    const local = this.worldTransform.applyInverse({ x: worldX, y: worldY });
    const lx = local.x;
    const ly = local.y;

    this._triangulate();
    if (!this._localIndices || this._localIndices.length === 0) return false;

    // Use cached local-space triangulation for hit testing
    for (let t = 0; t < this._localIndices.length; t += 3) {
      const i0 = this._localIndices[t] * 2;
      const i1 = this._localIndices[t + 1] * 2;
      const i2 = this._localIndices[t + 2] * 2;

      if (i0 + 1 >= this._localVerts.length) continue;
      if (i1 + 1 >= this._localVerts.length) continue;
      if (i2 + 1 >= this._localVerts.length) continue;

      if (pointInTriangle(
        lx, ly,
        this._localVerts[i0], this._localVerts[i0 + 1],
        this._localVerts[i1], this._localVerts[i1 + 1],
        this._localVerts[i2], this._localVerts[i2 + 1],
      )) return true;
    }
    return false;
  }
}

function pointInTriangle(px, py, x0, y0, x1, y1, x2, y2) {
  const d1 = (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1);
  const d2 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d3 = (px - x0) * (y2 - y0) - (x2 - x0) * (py - y0);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function isConvex(flatVerts) {
  const n = flatVerts.length / 2;
  if (n <= 3) return true;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k = (i + 2) % n;
    const cross = (flatVerts[j * 2] - flatVerts[i * 2]) * (flatVerts[k * 2 + 1] - flatVerts[j * 2 + 1])
                - (flatVerts[j * 2 + 1] - flatVerts[i * 2 + 1]) * (flatVerts[k * 2] - flatVerts[j * 2]);
    if (cross !== 0) {
      if (sign === 0) sign = cross > 0 ? 1 : -1;
      else if ((cross > 0 ? 1 : -1) !== sign) return false;
    }
  }
  return true;
}

function fanTriangulate(count) {
  const indices = [];
  for (let i = 1; i < count - 1; i++) {
    indices.push(0, i, i + 1);
  }
  return indices;
}

function computeMiterOffsets(points, count, closed, halfW, miterLimit) {
  const offsets = [];
  for (let i = 0; i < count; i++) {
    let mx, my;
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < count - 1;
    const pi = (i - 1 + count) % count;
    const ni = (i + 1) % count;

    if (hasPrev && hasNext) {
      const prevX = points[pi * 2], prevY = points[pi * 2 + 1];
      const curX = points[i * 2], curY = points[i * 2 + 1];
      const nextX = points[ni * 2], nextY = points[ni * 2 + 1];

      const d1x = curX - prevX, d1y = curY - prevY;
      const d2x = nextX - curX, d2y = nextY - curY;
      const l1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
      const l2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1;

      const n1x = -d1y / l1, n1y = d1x / l1;
      const n2x = -d2y / l2, n2y = d2x / l2;

      mx = n1x + n2x;
      my = n1y + n2y;
      const mLen = Math.sqrt(mx * mx + my * my);

      if (mLen > 0.0001) {
        const dot = mx * n1x + my * n1y;
        const miterScale = halfW / (dot / mLen);
        const clamped = Math.min(Math.abs(miterScale), halfW * miterLimit);
        const sign = miterScale < 0 ? -1 : 1;
        mx = (mx / mLen) * clamped * sign;
        my = (my / mLen) * clamped * sign;
      } else {
        mx = n1x * halfW;
        my = n1y * halfW;
      }
    } else if (hasNext) {
      const curX = points[i * 2], curY = points[i * 2 + 1];
      const nextX = points[ni * 2], nextY = points[ni * 2 + 1];
      const dx = nextX - curX, dy = nextY - curY;
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      mx = -dy / l * halfW;
      my = dx / l * halfW;
    } else {
      const prevX = points[pi * 2], prevY = points[pi * 2 + 1];
      const curX = points[i * 2], curY = points[i * 2 + 1];
      const dx = curX - prevX, dy = curY - prevY;
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      mx = -dy / l * halfW;
      my = dx / l * halfW;
    }

    offsets.push(mx, my);
  }
  return offsets;
}

function earClip(flatVerts) {
  const n = flatVerts.length / 2;
  if (n < 3) return [];
  if (n === 3) return [0, 1, 2];

  const indices = [];
  const remaining = [];
  for (let i = 0; i < n; i++) remaining.push(i);

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += flatVerts[i * 2] * flatVerts[j * 2 + 1];
    area -= flatVerts[j * 2] * flatVerts[i * 2 + 1];
  }
  if (area < 0) remaining.reverse();

  let failCount = 0;
  let i = 0;

  while (remaining.length > 3) {
    if (failCount >= remaining.length) break;

    const len = remaining.length;
    const prevIdx = remaining[((i - 1) % len + len) % len];
    const currIdx = remaining[i % len];
    const nextIdx = remaining[(i + 1) % len];

    const ax = flatVerts[prevIdx * 2], ay = flatVerts[prevIdx * 2 + 1];
    const bx = flatVerts[currIdx * 2], by = flatVerts[currIdx * 2 + 1];
    const cx = flatVerts[nextIdx * 2], cy = flatVerts[nextIdx * 2 + 1];

    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

    if (cross > 0) {
      let ear = true;
      for (let j = 0; j < remaining.length; j++) {
        const idx = remaining[j];
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
