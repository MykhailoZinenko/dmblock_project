// --- Core ---
export { GameController } from './GameController.js';
export type { GameEvent } from './GameController.js';
export { createGameState } from './GameState.js';
export type { GameState } from './GameState.js';
export { SeededRNG } from './rng.js';
export { hashState, canonicalize, canonicalizeDeep } from './stateHash.js';
export { buildInitiativeQueue } from './initiative.js';

// --- Hex / pathfinding ---
export {
  hex2px, px2hex, isValidCell, hexDistance, hexNeighbors, hexRing,
  hexesInRadius, hexDirection, offsetToCube,
} from './hexUtils.js';
export { findPath, findReachable, coordKey } from './pathfinding.js';

// --- Combat ---
export { calculateDamage, applyDamage } from './combat.js';
export type { DamageResult } from './combat.js';

// --- Card registry ---
export {
  cardRegistry, getCard, isBuilding, isRanged, isMelee, dealsMagicDamage,
  hasAbility, getAbility,
} from './cardRegistry.js';

// --- Actions ---
export { canSpawn, executeSpawn } from './actions/spawnUnit.js';
export type { SpawnResult } from './actions/spawnUnit.js';
export { canMove, executeMove, getOccupiedSet, getReachableHexes } from './actions/moveUnit.js';
export { canAttack, executeAttack, getAttackTargets, getAutoWalkHex, getAutoWalkTargets } from './actions/attackUnit.js';
export type { AttackTarget, AttackResult } from './actions/attackUnit.js';
export {
  executeHeroAttack, checkWinCondition, applyTimeoutDamage,
  canAttackHero, isBarrierUp, HERO_HEX, HERO_ADJACENT,
} from './actions/heroActions.js';
export type { HeroAttackResult, TimeoutResult } from './actions/heroActions.js';
export {
  canCast, executeCast, getSpellTargets, tickStatusEffects, tickUnitEffects,
} from './actions/castSpell.js';
export type { CastResult } from './actions/castSpell.js';

// --- Constants ---
export {
  GRID_COLS, GRID_ROWS, HEX_SIZE,
  P1_DEPLOY_COLS, P2_DEPLOY_COLS,
  STARTING_MANA, MANA_PER_TURN, MANA_CAP,
  HERO_HP,
  ACTIVATION_TIMER_SECONDS, TIMEOUT_DAMAGE,
  CRIT_CHANCE_PERCENT, CRIT_MULTIPLIER,
  UNIT_MOVE_SPEED, AUTO_END_DELAY,
  UNIT_TARGET_HEIGHT, BUILDING_1x1_TARGET_HEIGHT, BUILDING_2x2_TARGET_HEIGHT,
  HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_Y_OFFSET,
} from './constants.js';

// --- Types (re-export everything) ---
export {
  CardType, Faction, Rarity, SpellTargetType, DamageType, AbilityTrigger,
} from './types.js';
export type {
  AbilityDefinition, CardDefinition, HexCoord, UnitInstance,
  PlayerState, BoardCell, TerrainEffect, ActiveEffect, GamePhase,
} from './types.js';
