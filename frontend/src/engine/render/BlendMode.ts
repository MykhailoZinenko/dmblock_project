export const BLEND_MODES = {
  NORMAL: 0,
  ADDITIVE: 1,
  MULTIPLY: 2,
} as const;

export type BlendMode = (typeof BLEND_MODES)[keyof typeof BLEND_MODES];

export const BLEND_STATES: Record<BlendMode, GPUBlendState> = {
  [BLEND_MODES.NORMAL]: {
    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  },
  [BLEND_MODES.ADDITIVE]: {
    color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
  },
  [BLEND_MODES.MULTIPLY]: {
    color: { srcFactor: 'dst', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  },
};
