export type AnimState =
  | 'idle'
  | 'idle_unarmed'
  | 'run'
  | 'run_unarmed'
  | 'attack_side'
  | 'attack_top'
  | 'attack_bottom'
  | 'attack_topright'
  | 'attack_bottomright'
  | 'shoot'
  | 'heal'
  | 'heal_effect'
  | 'guard'
  | 'interact'
  | 'hide'
  | 'unhide'
  | 'exploding'
  | 'death'
  | 'bounce';

export type SpriteSourceType = 'strip' | 'grid' | 'static';

export interface AnimDefinition {
  state: AnimState;
  source: SpriteSourceType;
  file: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  row?: number;
  loop: boolean;
  flipForLeft?: boolean;
}

export interface UnitSpriteConfig {
  cardId: number;
  basePath: string;
  anims: AnimDefinition[];
  defaultState: AnimState;
  attackFallback?: AnimState;
}

export interface BuildingSpriteConfig {
  cardId: number;
  file: string;
  width: number;
  height: number;
  destroyedFile: string;
}

export interface FxConfig {
  id: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  loop: boolean;
}

// ─── UNIT SPRITE CONFIGS ─────────────────────────────────────────────

export const unitSpriteConfigs: Record<number, UnitSpriteConfig> = {
  // 0: Peasant — separate strip files, 192×192 frames
  0: {
    cardId: 0,
    basePath: 'assets/units/blue/pawn_v1',
    defaultState: 'idle',
    anims: [
      { state: 'idle',         source: 'strip', file: 'pawn_idle_axe.png',     frameWidth: 192, frameHeight: 192, frameCount: 8, loop: true },
      { state: 'idle_unarmed', source: 'strip', file: 'pawn_idle.png',         frameWidth: 192, frameHeight: 192, frameCount: 8, loop: true },
      { state: 'run',          source: 'strip', file: 'pawn_run_axe.png',      frameWidth: 192, frameHeight: 192, frameCount: 6, loop: true },
      { state: 'run_unarmed',  source: 'strip', file: 'pawn_run.png',          frameWidth: 192, frameHeight: 192, frameCount: 6, loop: true },
      { state: 'interact',     source: 'strip', file: 'pawn_interact_axe.png', frameWidth: 192, frameHeight: 192, frameCount: 6, loop: false },
    ],
    attackFallback: 'interact',
  },

  // 1: Militiaman — grid sprite, 192×192 frames, 6 cols
  1: {
    cardId: 1,
    basePath: 'assets/units/blue/pawn',
    defaultState: 'idle',
    anims: [
      { state: 'idle',         source: 'grid', file: 'pawn.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 1, loop: true },
      { state: 'run',          source: 'grid', file: 'pawn.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 2, loop: true },
      { state: 'attack_side',  source: 'grid', file: 'pawn.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 3, loop: false, flipForLeft: true },
    ],
  },

  // 2: Archer — separate strip files, 192×192 frames
  2: {
    cardId: 2,
    basePath: 'assets/units/blue/archer_v1',
    defaultState: 'idle',
    anims: [
      { state: 'idle',  source: 'strip', file: 'archer_idle.png',  frameWidth: 192, frameHeight: 192, frameCount: 6, loop: true },
      { state: 'run',   source: 'strip', file: 'archer_run.png',   frameWidth: 192, frameHeight: 192, frameCount: 4, loop: true },
      { state: 'shoot', source: 'strip', file: 'archer_shoot.png', frameWidth: 192, frameHeight: 192, frameCount: 8, loop: false },
    ],
  },

  // 3: Sniper — grid sprite, 192×192 frames, 8 cols
  3: {
    cardId: 3,
    basePath: 'assets/units/blue/archer',
    defaultState: 'idle',
    anims: [
      { state: 'idle',              source: 'grid', file: 'archer.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 1, loop: true },
      { state: 'run',               source: 'grid', file: 'archer.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 2, loop: true },
      { state: 'attack_top',        source: 'grid', file: 'archer.png', frameWidth: 192, frameHeight: 192, frameCount: 8, row: 3, loop: false },
      { state: 'attack_topright',   source: 'grid', file: 'archer.png', frameWidth: 192, frameHeight: 192, frameCount: 8, row: 4, loop: false, flipForLeft: true },
      { state: 'attack_side',       source: 'grid', file: 'archer.png', frameWidth: 192, frameHeight: 192, frameCount: 8, row: 5, loop: false, flipForLeft: true },
      { state: 'attack_bottomright',source: 'grid', file: 'archer.png', frameWidth: 192, frameHeight: 192, frameCount: 8, row: 6, loop: false, flipForLeft: true },
      { state: 'attack_bottom',     source: 'grid', file: 'archer.png', frameWidth: 192, frameHeight: 192, frameCount: 8, row: 7, loop: false },
    ],
  },

  // 4: Spearman — separate strip files, 320×320 frames
  4: {
    cardId: 4,
    basePath: 'assets/units/blue/lancer',
    defaultState: 'idle',
    anims: [
      { state: 'idle',              source: 'strip', file: 'lancer_idle.png',             frameWidth: 320, frameHeight: 320, frameCount: 12, loop: true },
      { state: 'run',               source: 'strip', file: 'lancer_run.png',              frameWidth: 320, frameHeight: 320, frameCount: 6,  loop: true },
      { state: 'attack_side',       source: 'strip', file: 'lancer_right_attack.png',     frameWidth: 320, frameHeight: 320, frameCount: 3,  loop: false, flipForLeft: true },
      { state: 'attack_top',        source: 'strip', file: 'lancer_up_attack.png',        frameWidth: 320, frameHeight: 320, frameCount: 3,  loop: false },
      { state: 'attack_bottom',     source: 'strip', file: 'lancer_down_attack.png',      frameWidth: 320, frameHeight: 320, frameCount: 3,  loop: false },
      { state: 'attack_topright',   source: 'strip', file: 'lancer_upright_attack.png',   frameWidth: 320, frameHeight: 320, frameCount: 3,  loop: false, flipForLeft: true },
      { state: 'attack_bottomright',source: 'strip', file: 'lancer_downright_attack.png', frameWidth: 320, frameHeight: 320, frameCount: 3,  loop: false, flipForLeft: true },
      { state: 'guard',             source: 'strip', file: 'lancer_right_defence.png',    frameWidth: 320, frameHeight: 320, frameCount: 6,  loop: false, flipForLeft: true },
    ],
  },

  // 5: Knight — grid sprite, 192×192 frames, 6 cols
  5: {
    cardId: 5,
    basePath: 'assets/units/blue/warrior',
    defaultState: 'idle',
    anims: [
      { state: 'idle',         source: 'grid', file: 'warrior.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 1, loop: true },
      { state: 'run',          source: 'grid', file: 'warrior.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 2, loop: true },
      { state: 'attack_side',  source: 'grid', file: 'warrior.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 3, loop: false, flipForLeft: true },
      { state: 'attack_bottom',source: 'grid', file: 'warrior.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 4, loop: false },
      // row 5: bottom attack v2 (alternate)
      { state: 'attack_top',   source: 'grid', file: 'warrior.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 6, loop: false },
      // row 7: top attack v2 (alternate)
    ],
  },

  // 6: Monk — separate strip files, 192×192 frames
  6: {
    cardId: 6,
    basePath: 'assets/units/blue/monk_v1',
    defaultState: 'idle',
    anims: [
      { state: 'idle',        source: 'strip', file: 'idle.png',        frameWidth: 192, frameHeight: 192, frameCount: 6,  loop: true },
      { state: 'run',         source: 'strip', file: 'run.png',         frameWidth: 192, frameHeight: 192, frameCount: 4,  loop: true },
      { state: 'heal',        source: 'strip', file: 'heal.png',        frameWidth: 192, frameHeight: 192, frameCount: 11, loop: false },
      { state: 'heal_effect', source: 'strip', file: 'heal_effect.png', frameWidth: 192, frameHeight: 192, frameCount: 11, loop: false },
    ],
    attackFallback: 'heal',
  },

  // 7: Torchbearer — grid sprite, 192×192 frames, 7 cols max
  7: {
    cardId: 7,
    basePath: 'assets/units/goblins/torch',
    defaultState: 'idle',
    anims: [
      { state: 'idle',          source: 'grid', file: 'torch_blue.png', frameWidth: 192, frameHeight: 192, frameCount: 7, row: 1, loop: true },
      { state: 'run',           source: 'grid', file: 'torch_blue.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 2, loop: true },
      { state: 'attack_side',   source: 'grid', file: 'torch_blue.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 3, loop: false, flipForLeft: true },
      { state: 'attack_bottom', source: 'grid', file: 'torch_blue.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 4, loop: false },
      { state: 'attack_top',    source: 'grid', file: 'torch_blue.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 5, loop: false },
    ],
  },

  // 8: Pyro-Goblin — grid sprite, 192×192 frames
  8: {
    cardId: 8,
    basePath: 'assets/units/goblins/tnt',
    defaultState: 'idle',
    anims: [
      { state: 'idle',  source: 'grid', file: 'tnt_blue.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 1, loop: true },
      { state: 'run',   source: 'grid', file: 'tnt_blue.png', frameWidth: 192, frameHeight: 192, frameCount: 6, row: 2, loop: true },
      { state: 'shoot', source: 'grid', file: 'tnt_blue.png', frameWidth: 192, frameHeight: 192, frameCount: 7, row: 3, loop: false },
    ],
  },

  // 9: Demolitionist — grid sprite, 128×128 frames
  9: {
    cardId: 9,
    basePath: 'assets/units/goblins/barrel',
    defaultState: 'idle',
    anims: [
      { state: 'idle',      source: 'grid', file: 'barrel_blue.png', frameWidth: 128, frameHeight: 128, frameCount: 1, row: 3, loop: true },
      { state: 'idle_unarmed', source: 'grid', file: 'barrel_blue.png', frameWidth: 128, frameHeight: 128, frameCount: 1, row: 1, loop: true }, // bomb static
      { state: 'hide',      source: 'grid', file: 'barrel_blue.png', frameWidth: 128, frameHeight: 128, frameCount: 6, row: 4, loop: false },
      { state: 'unhide',    source: 'grid', file: 'barrel_blue.png', frameWidth: 128, frameHeight: 128, frameCount: 6, row: 2, loop: false },
      { state: 'run',       source: 'grid', file: 'barrel_blue.png', frameWidth: 128, frameHeight: 128, frameCount: 3, row: 5, loop: true },
      { state: 'exploding', source: 'grid', file: 'barrel_blue.png', frameWidth: 128, frameHeight: 128, frameCount: 3, row: 6, loop: false },
    ],
  },
};

// Knight upgraded via Divine Blessing (warrior_v1) — separate strip files, 192×192
export const knightUpgradedConfig: UnitSpriteConfig = {
  cardId: 5,
  basePath: 'assets/units/blue/warrior_v1',
  defaultState: 'idle',
  anims: [
    { state: 'idle',        source: 'strip', file: 'warrior_idle.png',    frameWidth: 192, frameHeight: 192, frameCount: 8, loop: true },
    { state: 'run',         source: 'strip', file: 'warrior_run.png',     frameWidth: 192, frameHeight: 192, frameCount: 6, loop: true },
    { state: 'guard',       source: 'strip', file: 'warrior_guard.png',   frameWidth: 192, frameHeight: 192, frameCount: 6, loop: false },
    { state: 'attack_side', source: 'strip', file: 'warrior_attack1.png', frameWidth: 192, frameHeight: 192, frameCount: 4, loop: false, flipForLeft: true },
    // warrior_attack2.png is alternate side attack (4 frames)
  ],
};

// Arrow projectile (shared by Archer + Sniper)
export const arrowProjectile = {
  file: 'assets/units/blue/archer_v1/arrow.png',
  width: 64,
  height: 64,
};

// ─── BUILDING SPRITE CONFIGS ─────────────────────────────────────────

export const buildingSpriteConfigs: Record<number, BuildingSpriteConfig> = {
  17: {
    cardId: 17,
    file: 'assets/buildings/blue/tower/tower.png',
    width: 128,
    height: 256,
    destroyedFile: 'assets/buildings/blue/tower/tower_destroyed.png',
  },
  18: {
    cardId: 18,
    file: 'assets/buildings/blue/barracks/barracks.png',
    width: 192,
    height: 256,
    destroyedFile: 'assets/buildings/blue/destroyed/destroyed.png',
  },
  19: {
    cardId: 19,
    file: 'assets/buildings/blue/monastery/monastery.png',
    width: 192,
    height: 320,
    destroyedFile: 'assets/buildings/blue/destroyed/destroyed.png',
  },
};

// ─── SPELL FX CONFIGS ────────────────────────────────────────────────

export const spellFxConfigs: Record<number, FxConfig> = {
  // 10: Healing — monk heal_effect
  10: { id: 'healing', file: 'assets/units/blue/monk_v1/heal_effect.png', frameWidth: 192, frameHeight: 192, frameCount: 11, loop: false },
  // 11: Blast — explosion
  11: { id: 'blast', file: 'assets/fx/explosion_01.png', frameWidth: 192, frameHeight: 192, frameCount: 8, loop: false },
  // 12: Storm — dust
  12: { id: 'storm', file: 'assets/fx/dust_01.png', frameWidth: 64, frameHeight: 64, frameCount: 8, loop: false },
  // 13: Surge — water splash
  13: { id: 'surge', file: 'assets/fx/water_splash.png', frameWidth: 192, frameHeight: 192, frameCount: 9, loop: false },
  // 14: Inferno — fire
  14: { id: 'inferno', file: 'assets/fx/fire/fire.png', frameWidth: 128, frameHeight: 128, frameCount: 7, loop: false },
  // 15: Polymorph — sheep bounce (cast effect)
  15: { id: 'polymorph', file: 'assets/terrain/sheep/happysheep_bouncing.png', frameWidth: 128, frameHeight: 128, frameCount: 6, loop: false },
  // 16: Curse — curse_effect (recolored heal, user will provide)
  16: { id: 'curse', file: 'assets/units/blue/monk_v1/heal_effect.png', frameWidth: 192, frameHeight: 192, frameCount: 11, loop: false },
};

// Demolitionist explosion FX (not used for spells)
export const demolitionistExplosionFx: FxConfig = {
  id: 'demo_explosion', file: 'assets/fx/explosion_02.png', frameWidth: 192, frameHeight: 192, frameCount: 10, loop: false,
};

// Demolitionist decoy dust FX
export const decoyDustFx: FxConfig = {
  id: 'decoy_dust', file: 'assets/fx/dust_02.png', frameWidth: 64, frameHeight: 64, frameCount: 10, loop: false,
};

// Firewall terrain FX
export const firewallFx: FxConfig = {
  id: 'firewall', file: 'assets/fx/fire_01.png', frameWidth: 64, frameHeight: 64, frameCount: 8, loop: true,
};

// ─── POLYMORPH SHEEP SPRITE ──────────────────────────────────────────

export const sheepSpriteConfig: UnitSpriteConfig = {
  cardId: -1,
  basePath: 'assets/terrain/sheep',
  defaultState: 'idle',
  anims: [
    { state: 'idle',   source: 'strip', file: 'happysheep_idle.png',     frameWidth: 128, frameHeight: 128, frameCount: 8, loop: true },
    { state: 'bounce', source: 'strip', file: 'happysheep_bouncing.png', frameWidth: 128, frameHeight: 128, frameCount: 6, loop: true },
  ],
};

// ─── HELPERS ─────────────────────────────────────────────────────────

export function getUnitSpriteConfig(cardId: number): UnitSpriteConfig | undefined {
  return unitSpriteConfigs[cardId];
}

export function getBuildingSpriteConfig(cardId: number): BuildingSpriteConfig | undefined {
  return buildingSpriteConfigs[cardId];
}

export function getSpellFx(cardId: number): FxConfig | undefined {
  return spellFxConfigs[cardId];
}

export function getAnimForState(config: UnitSpriteConfig, state: AnimState): AnimDefinition | undefined {
  return config.anims.find(a => a.state === state);
}

export function getAttackAnim(config: UnitSpriteConfig, direction: 'side' | 'top' | 'bottom' | 'topright' | 'bottomright'): AnimDefinition | undefined {
  const state = `attack_${direction}` as AnimState;
  return config.anims.find(a => a.state === state)
    ?? config.anims.find(a => a.state === 'attack_side')
    ?? (config.attackFallback ? config.anims.find(a => a.state === config.attackFallback) : undefined);
}
