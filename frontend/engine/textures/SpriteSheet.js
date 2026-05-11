import { Texture } from './Texture.js';

export class SpriteSheet {
  static fromStrip(texture, frameWidth, frameHeight) {
    frameHeight ??= texture.height;
    const count = Math.floor(texture.width / frameWidth);
    const frames = [];
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

  static fromGridRow(texture, frameWidth, frameHeight, row, colCount) {
    const cols = colCount || Math.floor(texture.width / frameWidth);
    const frames = [];
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
