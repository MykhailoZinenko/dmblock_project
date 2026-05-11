export type ColorInput = number | string | number[];

export class Color {
  /**
   * Parse any supported color input into a normalized Float32Array([r, g, b, a])
   * where each component is in [0, 1].
   */
  static from(input: ColorInput): Float32Array {
    if (Array.isArray(input)) {
      const a: number = input.length >= 4 ? input[3] : 1;
      return new Float32Array([input[0], input[1], input[2], a]);
    }

    if (typeof input === 'string') {
      input = Color._parseHexString(input);
    }

    // Numeric hex: 0xRRGGBB
    const r: number = ((input >> 16) & 0xff) / 255;
    const g: number = ((input >> 8)  & 0xff) / 255;
    const b: number = ( input        & 0xff) / 255;
    return new Float32Array([r, g, b, 1]);
  }

  static _parseHexString(str: string): number {
    str = str.replace('#', '');
    if (str.length === 3) {
      str = str[0] + str[0] + str[1] + str[1] + str[2] + str[2];
    }
    return parseInt(str, 16);
  }
}
