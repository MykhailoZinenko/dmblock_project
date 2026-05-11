import { Texture } from './Texture.js';

export class SpriteSheet {
  static fromStrip(texture: Texture, frameWidth: number, frameHeight?: number): Texture[] {
    frameHeight ??= texture.height;
    const count: number = Math.floor(texture.width / frameWidth);
    const frames: Texture[] = [];
    for (let i = 0; i < count; i++) {
      const frame = {
        x: texture.frame.x + i * frameWidth,
        y: texture.frame.y,
        width: frameWidth,
        height: frameHeight,
      };
      frames.push(new Texture(texture.baseTexture, frame));
    }
    return frames;
  }

  static fromGridRow(texture: Texture, frameWidth: number, frameHeight: number, row: number, colCount?: number): Texture[] {
    const cols: number = colCount || Math.floor(texture.width / frameWidth);
    const frames: Texture[] = [];
    for (let col = 0; col < cols; col++) {
      const frame = {
        x: texture.frame.x + col * frameWidth,
        y: texture.frame.y + row * frameHeight,
        width: frameWidth,
        height: frameHeight,
      };
      frames.push(new Texture(texture.baseTexture, frame));
    }
    return frames;
  }
}
