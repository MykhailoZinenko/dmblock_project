export const GRID_COLS = 15;
export const GRID_ROWS = 11;
export const HEX_SIZE = 48;

export const P1_DEPLOY_COLS = [0, 1];
export const P2_DEPLOY_COLS = [13, 14];

export const STARTING_MANA = 5;
export const MANA_PER_TURN = 1;
export const MANA_CAP = 12;

export const HERO_HP = 30;

export const ACTIVATION_TIMER_SECONDS = 45;

export const TIMEOUT_DAMAGE = [3, 6, 12, 24] as const;

export const CRIT_CHANCE_PERCENT = 10;
export const CRIT_MULTIPLIER = 1.5;

export const UNIT_MOVE_SPEED = 300; // pixels per second
export const AUTO_END_DELAY = 0.4; // seconds before auto-advancing after AP exhausted

// Sprite sizing — normalized heights relative to HEX_SIZE
export const UNIT_TARGET_HEIGHT = HEX_SIZE * 1.6;
export const BUILDING_1x1_TARGET_HEIGHT = HEX_SIZE * 2.0;
export const BUILDING_2x2_TARGET_HEIGHT = HEX_SIZE * 2.8;

// HP bar dimensions
export const HP_BAR_WIDTH = 36;
export const HP_BAR_HEIGHT = 4;
export const HP_BAR_Y_OFFSET = HEX_SIZE * 0.35;
