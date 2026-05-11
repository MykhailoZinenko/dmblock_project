export class Color {
  /**
   * Parse any supported color input into a normalized Float32Array([r, g, b, a])
   * where each component is in [0, 1].
   *
   * @param {number | string | number[]} input
   * @returns {Float32Array}
   */
  static from(input) {
    if (Array.isArray(input)) {
      const a = input.length >= 4 ? input[3] : 1;
      return new Float32Array([input[0], input[1], input[2], a]);
    }

    if (typeof input === 'string') {
      input = Color._parseHexString(input);
    }

    // Numeric hex: 0xRRGGBB
    const r = ((input >> 16) & 0xff) / 255;
    const g = ((input >> 8)  & 0xff) / 255;
    const b = ( input        & 0xff) / 255;
    return new Float32Array([r, g, b, 1]);
  }

  /**
   * @param {string} str
   * @returns {number}
   */
  static _parseHexString(str) {
    str = str.replace('#', '');
    if (str.length === 3) {
      str = str[0] + str[0] + str[1] + str[1] + str[2] + str[2];
    }
    return parseInt(str, 16);
  }
}
