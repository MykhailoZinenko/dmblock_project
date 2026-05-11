import { describe, it, assert, assertEqual } from '../harness.js';
import { Text } from '../../engine/nodes/Text.js';
import { Node } from '../../engine/nodes/Node.js';

interface FontChar {
  id: number;
  char: string;
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
  common: { lineHeight: number; base: number; scaleW: number; scaleH: number };
  chars: FontChar[];
}

const mockFont: FontData = {
  info: { size: 48 },
  common: { lineHeight: 57, base: 45, scaleW: 256, scaleH: 256 },
  chars: [
    { id: 72, char: 'H', x: 0, y: 0, width: 30, height: 40, xoffset: 2, yoffset: 5, xadvance: 28 },
    { id: 101, char: 'e', x: 30, y: 0, width: 25, height: 30, xoffset: 1, yoffset: 15, xadvance: 22 },
    { id: 108, char: 'l', x: 55, y: 0, width: 12, height: 40, xoffset: 2, yoffset: 5, xadvance: 12 },
    { id: 111, char: 'o', x: 67, y: 0, width: 25, height: 30, xoffset: 1, yoffset: 15, xadvance: 24 },
    { id: 32, char: ' ', x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 12 },
    { id: 87, char: 'W', x: 92, y: 0, width: 35, height: 40, xoffset: 0, yoffset: 5, xadvance: 32 },
  ],
};

const mockTexture = { baseTexture: { gpuTexture: null, gpuSampler: null, width: 256, height: 256 } } as never;

describe('Text', () => {
  it('is a Node', () => {
    const t = new Text('Hello');
    assert(t instanceof Node);
  });

  it('stores text and style', () => {
    const t = new Text('Hello', { fontSize: 24, fill: 0xff0000 });
    assertEqual(t.text, 'Hello');
    assertEqual(t.style.fontSize, 24);
    assertEqual(t.style.fill, 0xff0000);
  });

  it('text setter marks dirty', () => {
    const t = new Text('Hello');
    t._dirty = false;
    t.text = 'World';
    assertEqual(t._dirty, true);
    assertEqual(t.text, 'World');
  });

  it('text setter does not mark dirty if unchanged', () => {
    const t = new Text('Hello');
    t._dirty = false;
    t.text = 'Hello';
    assertEqual(t._dirty, false);
  });

  it('style setter merges and marks dirty', () => {
    const t = new Text('Hello', { fontSize: 24 });
    t._dirty = false;
    t.style = { fill: 0x00ff00 };
    assertEqual(t._dirty, true);
    assertEqual(t.style.fontSize, 24);
    assertEqual(t.style.fill, 0x00ff00);
  });

  it('default style has expected properties', () => {
    const t = new Text('Hello');
    assertEqual(t.style.fontSize, 32);
    assertEqual(t.style.fill, 0xffffff);
    assertEqual(t.style.align, 'left');
    assertEqual(t.style.wordWrap, false);
    assertEqual(t.style.stroke, null);
    assertEqual(t.style.strokeWidth, 0);
  });

  it('setFont stores font data as default', () => {
    Text.setFont(mockFont as never, mockTexture);
    assertEqual(Text._defaultFont, mockFont as never);
    assertEqual(Text._defaultFontTexture, mockTexture);
  });

  it('_rebuild generates vertices for text', () => {
    Text.setFont(mockFont as never, mockTexture);
    const t = new Text('Hello');
    t.updateTransform();
    t._rebuild();
    assert(t._vertices !== null);
    assert(t._vertices!.length > 0);
    assert(t._quadCount === 5);
  });

  it('_rebuild generates quads for all characters including spaces', () => {
    Text.setFont(mockFont as never, mockTexture);
    const t = new Text('He lo');
    t.updateTransform();
    t._rebuild();
    // Space has a char entry so it gets a quad (zero-size but still counted)
    assertEqual(t._quadCount, 5);
  });

  it('_rebuild with stroke doubles quad count', () => {
    Text.setFont(mockFont as never, mockTexture);
    const t = new Text('Hello', { stroke: 0x000000, strokeWidth: 3 });
    t.updateTransform();
    t._rebuild();
    assertEqual(t._quadCount, 10);
  });

  it('per-instance font overrides default', () => {
    const customFont = { ...mockFont, info: { size: 24 } };
    const t = new Text('Hello', {}, customFont as never, mockTexture);
    assertEqual(t._font, customFont as never);
  });

  it('containsPoint works after rebuild', () => {
    Text.setFont(mockFont as never, mockTexture);
    const t = new Text('Hello', { fontSize: 48 });
    t.updateTransform();
    t._rebuild();
    const b = t.getBounds();
    assert(b.maxX > b.minX);
    assert(b.maxY > b.minY);
  });
});
