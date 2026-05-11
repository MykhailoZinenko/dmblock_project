import { Node } from './Node.js';
import { Color } from '../utils/Color.js';
import type { Texture } from '../textures/Texture.js';

interface FontChar {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
}

interface FontData {
  info: { size: number };
  common: { lineHeight: number; scaleW: number; scaleH: number };
  chars: FontChar[];
}

interface TextStyle {
  fontSize: number;
  fill: number | string | Float32Array;
  stroke: number | string | Float32Array | null;
  strokeWidth: number;
  align: 'left' | 'center' | 'right';
  wordWrap: boolean;
  wordWrapWidth: number;
  lineHeight: number | null;
}

interface LayoutGlyph {
  x: number;
  y: number;
  char: FontChar;
}

interface LayoutLine {
  glyphs: LayoutGlyph[];
  width: number;
}

const DEFAULT_STYLE: TextStyle = {
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
  static _defaultFont: FontData | null = null;
  static _defaultFontTexture: Texture | null = null;

  static setFont(fontData: FontData, texture: Texture): void {
    Text._defaultFont = fontData;
    Text._defaultFontTexture = texture;
  }

  public _text: string;
  public _style: TextStyle;
  public _font: FontData | null;
  public _fontTexture: Texture | null;
  public _dirty: boolean;
  public _vertices: Float32Array | null;
  public _indices: Uint16Array | null;
  public _quadCount: number;
  public _gpuBuffersDirty: boolean;

  public _gpuVertexBuffer: GPUBuffer | null;
  public _gpuIndexBuffer: GPUBuffer | null;
  public _gpuIndexCount: number;

  private _charMap: Map<number, FontChar> | null;

  constructor(
    text: string = '',
    style: Partial<TextStyle> = {},
    font: FontData | null = null,
    fontTexture: Texture | null = null,
  ) {
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
    this._gpuVertexBuffer = null;
    this._gpuIndexBuffer = null;
    this._gpuIndexCount = 0;
  }

  get text(): string { return this._text; }
  set text(value: string) {
    if (this._text !== value) {
      this._text = value;
      this._dirty = true;
      this._boundsDirty = true;
    }
  }

  get style(): TextStyle { return this._style; }
  set style(value: Partial<TextStyle>) {
    this._style = { ...this._style, ...value };
    this._dirty = true;
    this._boundsDirty = true;
  }

  _getCharMap(): Map<number, FontChar> | null {
    if (this._charMap) return this._charMap;
    const font: FontData | null = this._font || Text._defaultFont;
    if (!font) return null;
    this._charMap = new Map();
    for (const c of font.chars) {
      this._charMap.set(c.id, c);
    }
    return this._charMap;
  }

  _rebuild(): void {
    if (!this._dirty) return;
    this._dirty = false;
    this._gpuBuffersDirty = true;

    const font: FontData | null = this._font || Text._defaultFont;
    if (!font) return;

    const charMap: Map<number, FontChar> | null = this._getCharMap();
    if (!charMap) return;

    const { fontSize, fill, stroke, strokeWidth, align, wordWrap, wordWrapWidth, lineHeight: customLineHeight } = this._style;
    const scale: number = fontSize / font.info.size;
    const lineHeight: number = (customLineHeight || font.common.lineHeight) * scale;
    const color: Float32Array = Color.from(fill);
    const hasStroke: boolean = stroke !== null && strokeWidth > 0;
    const strokeColor: Float32Array | null = hasStroke ? Color.from(stroke!) : null;
    const scaleW: number = font.common.scaleW;
    const scaleH: number = font.common.scaleH;
    const wt = this.worldTransform;

    const lines: LayoutLine[] = this._layoutLines(charMap, scale, wordWrap, wordWrapWidth, lineHeight);

    let totalGlyphs: number = 0;
    for (const line of lines) totalGlyphs += line.glyphs.length;

    if (totalGlyphs === 0) {
      this._vertices = null;
      this._indices = null;
      this._quadCount = 0;
      return;
    }

    const FLOATS_PER_QUAD: number = 4 * 8;
    const quadsNeeded: number = hasStroke ? totalGlyphs * 2 : totalGlyphs;
    const vertices: Float32Array = new Float32Array(quadsNeeded * FLOATS_PER_QUAD);
    const indices: Uint16Array = new Uint16Array(quadsNeeded * 6);

    let maxLineWidth: number = 0;
    for (const line of lines) {
      if (line.width > maxLineWidth) maxLineWidth = line.width;
    }

    let qi: number = 0;

    const writeGlyphs = (cr: number, cg: number, cb: number, ca: number): void => {
      for (const line of lines) {
        let offsetX: number = 0;
        if (align === 'center') offsetX = (maxLineWidth - line.width) * 0.5;
        else if (align === 'right') offsetX = maxLineWidth - line.width;

        for (const g of line.glyphs) {
          const x: number = g.x + offsetX;
          const y: number = g.y;
          const ch: FontChar = g.char;

          const lx0: number = x + ch.xoffset * scale;
          const ly0: number = y + ch.yoffset * scale;
          const lx1: number = lx0 + ch.width * scale;
          const ly1: number = ly0 + ch.height * scale;

          const u0: number = ch.x / scaleW;
          const v0: number = ch.y / scaleH;
          const u1: number = (ch.x + ch.width) / scaleW;
          const v1: number = (ch.y + ch.height) / scaleH;

          const px0: number = wt.a * lx0 + wt.c * ly0 + wt.tx;
          const py0: number = wt.b * lx0 + wt.d * ly0 + wt.ty;
          const px1: number = wt.a * lx1 + wt.c * ly0 + wt.tx;
          const py1: number = wt.b * lx1 + wt.d * ly0 + wt.ty;
          const px2: number = wt.a * lx1 + wt.c * ly1 + wt.tx;
          const py2: number = wt.b * lx1 + wt.d * ly1 + wt.ty;
          const px3: number = wt.a * lx0 + wt.c * ly1 + wt.tx;
          const py3: number = wt.b * lx0 + wt.d * ly1 + wt.ty;

          const vi: number = qi * FLOATS_PER_QUAD;
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

          const ii: number = qi * 6;
          const base: number = qi * 4;
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
      writeGlyphs(strokeColor![0], strokeColor![1], strokeColor![2], 1.0 + strokeWidth);
    }
    // Fill pass
    writeGlyphs(color[0], color[1], color[2], color[3]);

    this._vertices = vertices.subarray(0, qi * FLOATS_PER_QUAD);
    this._indices = indices.subarray(0, qi * 6);
    this._quadCount = qi;
  }

  _layoutLines(
    charMap: Map<number, FontChar>,
    scale: number,
    wordWrap: boolean,
    wordWrapWidth: number,
    lineHeight: number,
  ): LayoutLine[] {
    const lines: LayoutLine[] = [];
    let curLine: LayoutLine = { glyphs: [], width: 0 };
    let cursorX: number = 0;
    let cursorY: number = 0;
    let wordStart: number = 0;
    let wordStartX: number = 0;

    for (let i = 0; i < this._text.length; i++) {
      const code: number = this._text.charCodeAt(i);

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

      const ch: FontChar | undefined = charMap.get(code);
      if (!ch) continue;

      if (code === 32) {
        wordStart = curLine.glyphs.length + 1;
        wordStartX = cursorX + ch.xadvance * scale;
      }

      if (wordWrap && wordWrapWidth > 0 && cursorX + ch.xadvance * scale > wordWrapWidth && code !== 32) {
        if (wordStart > 0 && wordStart < curLine.glyphs.length) {
          const overflow: LayoutGlyph[] = curLine.glyphs.splice(wordStart);
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
          const overflowChars: FontChar[] = overflow.map((g: LayoutGlyph) => g.char);
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

  _calculateBounds(): void {
    if (this._dirty) this._rebuild();
    if (!this._vertices || this._quadCount === 0) return;

    let minX: number = Infinity, minY: number = Infinity, maxX: number = -Infinity, maxY: number = -Infinity;
    for (let i = 0; i < this._quadCount * 4; i++) {
      const offset: number = i * 8;
      const px: number = this._vertices[offset];
      const py: number = this._vertices[offset + 1];
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

  updateTransform(): void {
    const wasDirty: boolean = this._worldDirty || this._localDirty;
    super.updateTransform();
    if (wasDirty && this._text.length > 0) {
      this._dirty = true;
    }
  }

  destroy(): void {
    if (this._gpuVertexBuffer) { this._gpuVertexBuffer.destroy(); this._gpuVertexBuffer = null; }
    if (this._gpuIndexBuffer) { this._gpuIndexBuffer.destroy(); this._gpuIndexBuffer = null; }
    super.destroy();
  }

  containsPoint(worldX: number, worldY: number): boolean {
    const bounds = this.getBounds();
    return worldX >= bounds.minX && worldX <= bounds.maxX &&
           worldY >= bounds.minY && worldY <= bounds.maxY;
  }
}
