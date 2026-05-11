import { Node } from './Node.js';
import { Color } from '../utils/Color.js';

const DEFAULT_STYLE = {
  fontSize: 32,
  fill: 0xffffff,
  stroke: null,
  strokeWidth: 0,
  align: 'left',
  wordWrap: false,
  wordWrapWidth: 0,
  lineHeight: null,
};

export class Text extends Node {
  static _defaultFont = null;
  static _defaultFontTexture = null;

  static setFont(fontData, texture) {
    Text._defaultFont = fontData;
    Text._defaultFontTexture = texture;
  }

  constructor(text = '', style = {}, font = null, fontTexture = null) {
    super();
    this._text = text;
    this._style = { ...DEFAULT_STYLE, ...style };
    this._font = font || Text._defaultFont;
    this._fontTexture = fontTexture || Text._defaultFontTexture;
    this._dirty = true;
    this._vertices = null;
    this._indices = null;
    this._quadCount = 0;
    this._charMap = null;
    this._gpuBuffersDirty = false;
  }

  get text() { return this._text; }
  set text(value) {
    if (this._text !== value) {
      this._text = value;
      this._dirty = true;
      this._boundsDirty = true;
    }
  }

  get style() { return this._style; }
  set style(value) {
    this._style = { ...this._style, ...value };
    this._dirty = true;
    this._boundsDirty = true;
  }

  _getCharMap() {
    if (this._charMap) return this._charMap;
    const font = this._font || Text._defaultFont;
    if (!font) return null;
    this._charMap = new Map();
    for (const c of font.chars) {
      this._charMap.set(c.id, c);
    }
    return this._charMap;
  }

  _rebuild() {
    if (!this._dirty) return;
    this._dirty = false;
    this._gpuBuffersDirty = true;

    const font = this._font || Text._defaultFont;
    if (!font) return;

    const charMap = this._getCharMap();
    if (!charMap) return;

    const { fontSize, fill, stroke, strokeWidth, align, wordWrap, wordWrapWidth, lineHeight: customLineHeight } = this._style;
    const scale = fontSize / font.info.size;
    const lineHeight = (customLineHeight || font.common.lineHeight) * scale;
    const color = Color.from(fill);
    const hasStroke = stroke !== null && strokeWidth > 0;
    const strokeColor = hasStroke ? Color.from(stroke) : null;
    const scaleW = font.common.scaleW;
    const scaleH = font.common.scaleH;
    const wt = this.worldTransform;

    const lines = this._layoutLines(charMap, scale, wordWrap, wordWrapWidth, lineHeight);

    let totalGlyphs = 0;
    for (const line of lines) totalGlyphs += line.glyphs.length;

    if (totalGlyphs === 0) {
      this._vertices = null;
      this._indices = null;
      this._quadCount = 0;
      return;
    }

    const FLOATS_PER_QUAD = 4 * 8;
    const quadsNeeded = hasStroke ? totalGlyphs * 2 : totalGlyphs;
    const vertices = new Float32Array(quadsNeeded * FLOATS_PER_QUAD);
    const indices = new Uint16Array(quadsNeeded * 6);

    let maxLineWidth = 0;
    for (const line of lines) {
      if (line.width > maxLineWidth) maxLineWidth = line.width;
    }

    let qi = 0;

    const writeGlyphs = (cr, cg, cb, ca) => {
      for (const line of lines) {
        let offsetX = 0;
        if (align === 'center') offsetX = (maxLineWidth - line.width) * 0.5;
        else if (align === 'right') offsetX = maxLineWidth - line.width;

        for (const g of line.glyphs) {
          const x = g.x + offsetX;
          const y = g.y;
          const ch = g.char;

          const lx0 = x + ch.xoffset * scale;
          const ly0 = y + ch.yoffset * scale;
          const lx1 = lx0 + ch.width * scale;
          const ly1 = ly0 + ch.height * scale;

          const u0 = ch.x / scaleW;
          const v0 = ch.y / scaleH;
          const u1 = (ch.x + ch.width) / scaleW;
          const v1 = (ch.y + ch.height) / scaleH;

          const px0 = wt.a * lx0 + wt.c * ly0 + wt.tx;
          const py0 = wt.b * lx0 + wt.d * ly0 + wt.ty;
          const px1 = wt.a * lx1 + wt.c * ly0 + wt.tx;
          const py1 = wt.b * lx1 + wt.d * ly0 + wt.ty;
          const px2 = wt.a * lx1 + wt.c * ly1 + wt.tx;
          const py2 = wt.b * lx1 + wt.d * ly1 + wt.ty;
          const px3 = wt.a * lx0 + wt.c * ly1 + wt.tx;
          const py3 = wt.b * lx0 + wt.d * ly1 + wt.ty;

          const vi = qi * FLOATS_PER_QUAD;
          vertices[vi]      = px0; vertices[vi + 1]  = py0;
          vertices[vi + 2]  = u0;  vertices[vi + 3]  = v0;
          vertices[vi + 4]  = cr;  vertices[vi + 5]  = cg;
          vertices[vi + 6]  = cb;  vertices[vi + 7]  = ca;

          vertices[vi + 8]  = px1; vertices[vi + 9]  = py1;
          vertices[vi + 10] = u1;  vertices[vi + 11] = v0;
          vertices[vi + 12] = cr;  vertices[vi + 13] = cg;
          vertices[vi + 14] = cb;  vertices[vi + 15] = ca;

          vertices[vi + 16] = px2; vertices[vi + 17] = py2;
          vertices[vi + 18] = u1;  vertices[vi + 19] = v1;
          vertices[vi + 20] = cr;  vertices[vi + 21] = cg;
          vertices[vi + 22] = cb;  vertices[vi + 23] = ca;

          vertices[vi + 24] = px3; vertices[vi + 25] = py3;
          vertices[vi + 26] = u0;  vertices[vi + 27] = v1;
          vertices[vi + 28] = cr;  vertices[vi + 29] = cg;
          vertices[vi + 30] = cb;  vertices[vi + 31] = ca;

          const ii = qi * 6;
          const base = qi * 4;
          indices[ii]     = base;
          indices[ii + 1] = base + 1;
          indices[ii + 2] = base + 2;
          indices[ii + 3] = base;
          indices[ii + 4] = base + 2;
          indices[ii + 5] = base + 3;

          qi++;
        }
      }
    };

    // Stroke pass first (behind fill) — alpha > 1.0 signals stroke expansion to shader
    if (hasStroke) {
      writeGlyphs(strokeColor[0], strokeColor[1], strokeColor[2], 1.0 + strokeWidth);
    }
    // Fill pass
    writeGlyphs(color[0], color[1], color[2], color[3]);

    this._vertices = vertices.subarray(0, qi * FLOATS_PER_QUAD);
    this._indices = indices.subarray(0, qi * 6);
    this._quadCount = qi;
  }

  _layoutLines(charMap, scale, wordWrap, wordWrapWidth, lineHeight) {
    const lines = [];
    let curLine = { glyphs: [], width: 0 };
    let cursorX = 0;
    let cursorY = 0;
    let wordStart = 0;
    let wordStartX = 0;

    for (let i = 0; i < this._text.length; i++) {
      const code = this._text.charCodeAt(i);

      if (code === 10) {
        curLine.width = cursorX;
        lines.push(curLine);
        curLine = { glyphs: [], width: 0 };
        cursorX = 0;
        cursorY += lineHeight;
        wordStart = curLine.glyphs.length;
        wordStartX = 0;
        continue;
      }

      const ch = charMap.get(code);
      if (!ch) continue;

      if (code === 32) {
        wordStart = curLine.glyphs.length + 1;
        wordStartX = cursorX + ch.xadvance * scale;
      }

      if (wordWrap && wordWrapWidth > 0 && cursorX + ch.xadvance * scale > wordWrapWidth && code !== 32) {
        if (wordStart > 0 && wordStart < curLine.glyphs.length) {
          const overflow = curLine.glyphs.splice(wordStart);
          curLine.width = wordStartX;
          lines.push(curLine);
          curLine = { glyphs: [], width: 0 };
          cursorY += lineHeight;
          cursorX = 0;
          for (const g of overflow) {
            g.x = cursorX + (g.char.xoffset * scale - g.char.xoffset * scale) + (g.x - wordStartX + (wordStartX - wordStartX));
            cursorX = g.x + g.char.xadvance * scale - g.char.xoffset * scale;
          }
          // Relayout overflow glyphs
          const overflowChars = overflow.map(g => g.char);
          cursorX = 0;
          curLine.glyphs = [];
          for (const oc of overflowChars) {
            curLine.glyphs.push({ x: cursorX, y: cursorY, char: oc });
            cursorX += oc.xadvance * scale;
          }
          wordStart = 0;
          wordStartX = 0;
        } else {
          curLine.width = cursorX;
          lines.push(curLine);
          curLine = { glyphs: [], width: 0 };
          cursorX = 0;
          cursorY += lineHeight;
          wordStart = 0;
          wordStartX = 0;
        }
      }

      curLine.glyphs.push({ x: cursorX, y: cursorY, char: ch });
      cursorX += ch.xadvance * scale;
    }

    curLine.width = cursorX;
    lines.push(curLine);
    return lines;
  }

  _calculateBounds() {
    if (this._dirty) this._rebuild();
    if (!this._vertices || this._quadCount === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < this._quadCount * 4; i++) {
      const offset = i * 8;
      const px = this._vertices[offset];
      const py = this._vertices[offset + 1];
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }

    this._bounds.minX = minX;
    this._bounds.minY = minY;
    this._bounds.maxX = maxX;
    this._bounds.maxY = maxY;
  }

  updateTransform() {
    const wasDirty = this._worldDirty || this._localDirty;
    super.updateTransform();
    if (wasDirty && this._text.length > 0) {
      this._dirty = true;
    }
  }

  destroy() {
    if (this._gpuVertexBuffer) { this._gpuVertexBuffer.destroy(); this._gpuVertexBuffer = null; }
    if (this._gpuIndexBuffer) { this._gpuIndexBuffer.destroy(); this._gpuIndexBuffer = null; }
    super.destroy();
  }

  containsPoint(worldX, worldY) {
    const bounds = this.getBounds();
    return worldX >= bounds.minX && worldX <= bounds.maxX &&
           worldY >= bounds.minY && worldY <= bounds.maxY;
  }
}
