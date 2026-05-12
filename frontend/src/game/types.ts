export enum CardType {
  UNIT = 0,
  SPELL = 1,
}

export enum Faction {
  CASTLE = 0,
  INFERNO = 1,
  NECROPOLIS = 2,
  DUNGEON = 3,
}

export enum Rarity {
  COMMON = 0,
  RARE = 1,
  EPIC = 2,
  LEGENDARY = 3,
}

export enum SpellTargetType {
  SINGLE = 0,
  ALL_ENEMIES = 1,
  ALL_ALLIES = 2,
  AREA = 3,
  HERO = 4,
}

export enum DamageType {
  PHYSICAL = 0,
  MAGIC = 1,
}

export enum AbilityTrigger {
  PASSIVE = 0,
  ACTIVE = 1,
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  trigger: AbilityTrigger;
  cooldown: number;
}

export interface CardDefinition {
  id: number;
  name: string;
  cardType: CardType;
  faction: Faction;
  rarity: Rarity;
  attack: number;
  defense: number;
  hp: number;
  initiative: number;
  speed: number;
  ammo: number;
  manaCost: number;
  size: number;
  magicResistance: number;
  damageType: DamageType;
  spellPower: number;
  duration: number;
  spellTargetType: SpellTargetType;
  successChance: number;
  powerMultiplier: number;
  abilities: readonly AbilityDefinition[];
  spriteKey: string;
  fxKey: string;
}

export interface HexCoord {
  col: number;
  row: number;
}

export interface UnitInstance {
  uid: number;
  cardId: number;
  playerId: number;
  col: number;
  row: number;
  currentHp: number;
  maxHp: number;
  attack: number;
  defense: number;
  initiative: number;
  speed: number;
  ammo: number;
  magicResistance: number;
  damageType: DamageType;
  remainingAp: number;
  retaliatedThisTurn: boolean;
  alive: boolean;
  cooldowns: Record<string, number>;
  garrisonedIn: number | null;
  polymorphed: boolean;
  cursed: boolean;
  activeEffects: ActiveEffect[];
  occupiedCells: readonly HexCoord[];
}

export interface PlayerState {
  id: number;
  mana: number;
  heroHp: number;
  timeoutCount: number;
}

export interface BoardCell {
  col: number;
  row: number;
  unitUid: number | null;
  terrainEffect: TerrainEffect | null;
}

export interface TerrainEffect {
  type: 'firewall';
  ownerId: number;
  damage: number;
  turnsRemaining: number;
}

export interface ActiveEffect {
  cardId: number;
  type: 'slow' | 'polymorph' | 'curse';
  activationsLeft: number;
  originalStats?: { attack: number; defense: number; speed: number };
}

export type GamePhase =
  | 'INITIALIZING'
  | 'ACTIVATION'
  | 'TURN_END'
  | 'GAME_OVER';
