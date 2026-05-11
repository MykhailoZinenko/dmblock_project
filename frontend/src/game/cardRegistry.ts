import { CardType, Faction, Rarity, SpellTargetType, DamageType, AbilityTrigger } from './types';
import type { CardDefinition, AbilityDefinition } from './types';

function passive(id: string, name: string, description: string): AbilityDefinition {
  return { id, name, description, trigger: AbilityTrigger.PASSIVE, cooldown: 0 };
}

function active(id: string, name: string, description: string, cooldown: number): AbilityDefinition {
  return { id, name, description, trigger: AbilityTrigger.ACTIVE, cooldown };
}

export const cardRegistry: readonly CardDefinition[] = [
  // --- UNITS ---

  // 00: Peasant — Castle, Common, melee
  {
    id: 0, name: 'Peasant', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.COMMON,
    attack: 5, defense: 3, hp: 30, initiative: 5, speed: 3,
    ammo: 0, manaCost: 1, size: 1, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      passive('sheep_slayer', 'Sheep Slayer', '×2 damage to polymorphed units'),
      passive('unarmed', 'Unarmed', '20% chance to spawn without weapon, ×0.5 damage'),
    ],
    spriteKey: 'blue/pawn_v1',
    fxKey: '',
  },

  // 01: Militiaman — Castle, Common, melee
  {
    id: 1, name: 'Militiaman', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.COMMON,
    attack: 8, defense: 5, hp: 40, initiative: 5, speed: 3,
    ammo: 0, manaCost: 2, size: 1, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      passive('siege_expert', 'Siege Expert', '×2 damage to buildings'),
      active('craft_axe', 'Craft Axe', '×2 damage this turn', 2),
    ],
    spriteKey: 'blue/pawn',
    fxKey: '',
  },

  // 02: Archer — Castle, Rare, ranged
  {
    id: 2, name: 'Archer', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.RARE,
    attack: 12, defense: 8, hp: 50, initiative: 7, speed: 3,
    ammo: 5, manaCost: 4, size: 1, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      active('double_shot', 'Double Shot', 'Shoot twice this turn', 3),
      passive('tower_mount', 'Tower Mount', 'Can enter Tower (+1 move). Inside: immune to melee, ×1.5 ranged damage taken'),
    ],
    spriteKey: 'blue/archer_v1',
    fxKey: '',
  },

  // 03: Sniper — Dungeon, Epic, ranged
  {
    id: 3, name: 'Sniper', cardType: CardType.UNIT,
    faction: Faction.DUNGEON, rarity: Rarity.EPIC,
    attack: 22, defense: 15, hp: 75, initiative: 6, speed: 2,
    ammo: 4, manaCost: 7, size: 1, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      active('volley', 'Volley', 'AoE shot: target hex + surrounding ring', 4),
      passive('marksman', 'Marksman', 'No ranged distance penalty'),
      passive('tower_mount', 'Tower Mount', 'Can enter Tower (+1 move). Inside: immune to melee, ×1.5 ranged damage taken'),
    ],
    spriteKey: 'blue/archer',
    fxKey: '',
  },

  // 04: Spearman — Castle, Rare, melee
  {
    id: 4, name: 'Spearman', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.RARE,
    attack: 14, defense: 10, hp: 60, initiative: 6, speed: 4,
    ammo: 0, manaCost: 5, size: 1, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      passive('pierce', 'Pierce', 'Attack hits 2 cells in attack direction'),
      passive('charge', 'Charge', 'Bonus damage based on distance traveled to target'),
    ],
    spriteKey: 'blue/lancer',
    fxKey: '',
  },

  // 05: Knight — Castle, Epic, melee
  {
    id: 5, name: 'Knight', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.EPIC,
    attack: 20, defense: 18, hp: 85, initiative: 5, speed: 3,
    ammo: 0, manaCost: 7, size: 1, magicResistance: 0,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      active('divine_blessing', 'Divine Blessing', 'Power up (requires Barracks Divine Favour). Reverts if Barracks destroyed', 0),
      passive('shield_wall', 'Shield Wall', '+DEF to allied units in surrounding hexes'),
    ],
    spriteKey: 'blue/warrior',
    fxKey: '',
  },

  // 06: Monk — Castle, Rare, melee
  {
    id: 6, name: 'Monk', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.RARE,
    attack: 10, defense: 9, hp: 55, initiative: 5, speed: 2,
    ammo: 0, manaCost: 5, size: 1, magicResistance: 10,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      active('monk_heal', 'Heal', 'Cast heal at ×0.5 effectiveness, no Healing spell needed', 2),
      active('mana_orbs', 'Mana Orbs', 'Skip turn, DEF ×0.5 until round end, generate mana (cap 3)', 2),
    ],
    spriteKey: 'blue/monk_v1',
    fxKey: '',
  },

  // 07: Torchbearer — Inferno, Common, melee, magic damage
  {
    id: 7, name: 'Torchbearer', cardType: CardType.UNIT,
    faction: Faction.INFERNO, rarity: Rarity.COMMON,
    attack: 7, defense: 4, hp: 35, initiative: 7, speed: 3,
    ammo: 0, manaCost: 2, size: 1, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      active('firewall', 'Firewall', 'Ignite 3 cells in front. ×1.5 damage/turn + movement damage. Lasts 2 turns', 2),
      passive('arsonist', 'Arsonist', '×1.5 damage to buildings'),
      passive('burning_strike', 'Burning Strike', 'Attacks set target on fire for 1 turn (×0.5 base ATK as fire damage)'),
      passive('volatile', 'Volatile', '25% chance to set self on fire on attack'),
    ],
    spriteKey: 'goblins/torch',
    fxKey: '',
  },

  // 08: Pyro-Goblin — Inferno, Rare, ranged, magic damage
  {
    id: 8, name: 'Pyro-Goblin', cardType: CardType.UNIT,
    faction: Faction.INFERNO, rarity: Rarity.RARE,
    attack: 13, defense: 8, hp: 50, initiative: 7, speed: 2,
    ammo: 4, manaCost: 4, size: 1, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      passive('cascade', 'Cascade', 'Each throw cascades 3 cells behind target, ×0.5 damage'),
      passive('fire_resistant', 'Fire Resistant', '×0.5 fire spell and fire effect damage'),
    ],
    spriteKey: 'goblins/tnt',
    fxKey: '',
  },

  // 09: Demolitionist — Inferno, Epic, melee, magic damage
  {
    id: 9, name: 'Demolitionist', cardType: CardType.UNIT,
    faction: Faction.INFERNO, rarity: Rarity.EPIC,
    attack: 8, defense: 5, hp: 80, initiative: 4, speed: 3,
    ammo: 0, manaCost: 6, size: 1, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      passive('explosive', 'Explosive', 'Explode on death: 100 magic damage to all (allies too) in surrounding hexes'),
      active('detonate', 'Detonate', 'Trigger explosion at will (kills self)', 0),
      active('mine_mode', 'Mine Mode', 'Hide 3 turns, invisible. Proximity detonates. Returns after 3 turns (1 turn CD)', 1),
    ],
    spriteKey: 'goblins/barrel',
    fxKey: '',
  },

  // --- SPELLS ---

  // 10: Healing — Castle faction, single target heal
  {
    id: 10, name: 'Healing', cardType: CardType.SPELL,
    faction: Faction.CASTLE, rarity: Rarity.COMMON,
    attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
    ammo: 0, manaCost: 3, size: 0, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 15, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 95,
    powerMultiplier: 2.0,
    abilities: [],
    spriteKey: '',
    fxKey: 'blue/monk_v1/heal_effect',
  },

  // 11: Blast — Inferno faction, single target fire damage
  {
    id: 11, name: 'Blast', cardType: CardType.SPELL,
    faction: Faction.INFERNO, rarity: Rarity.COMMON,
    attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
    ammo: 0, manaCost: 3, size: 0, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 12, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 95,
    powerMultiplier: 2.5,
    abilities: [],
    spriteKey: '',
    fxKey: 'fx/explosion_01',
  },

  // 12: Storm — Dungeon faction, single target + BLIND
  {
    id: 12, name: 'Storm', cardType: CardType.SPELL,
    faction: Faction.DUNGEON, rarity: Rarity.RARE,
    attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
    ammo: 0, manaCost: 5, size: 0, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 8, duration: 1, spellTargetType: SpellTargetType.SINGLE, successChance: 85,
    powerMultiplier: 1.5,
    abilities: [],
    spriteKey: '',
    fxKey: 'fx/dust_01',
  },

  // 13: Surge — Necropolis faction, single target + SLOW
  {
    id: 13, name: 'Surge', cardType: CardType.SPELL,
    faction: Faction.NECROPOLIS, rarity: Rarity.RARE,
    attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
    ammo: 0, manaCost: 5, size: 0, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 10, duration: 1, spellTargetType: SpellTargetType.SINGLE, successChance: 85,
    powerMultiplier: 2.0,
    abilities: [],
    spriteKey: '',
    fxKey: 'fx/water_splash',
  },

  // 14: Inferno — Inferno faction, AREA fire damage
  {
    id: 14, name: 'Inferno', cardType: CardType.SPELL,
    faction: Faction.INFERNO, rarity: Rarity.EPIC,
    attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
    ammo: 0, manaCost: 8, size: 1, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 20, duration: 0, spellTargetType: SpellTargetType.AREA, successChance: 75,
    powerMultiplier: 3.0,
    abilities: [],
    spriteKey: '',
    fxKey: 'fx/fire_01',
  },

  // 15: Polymorph — Castle faction, single target transform
  {
    id: 15, name: 'Polymorph', cardType: CardType.SPELL,
    faction: Faction.CASTLE, rarity: Rarity.EPIC,
    attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
    ammo: 0, manaCost: 7, size: 0, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 0, duration: 1, spellTargetType: SpellTargetType.SINGLE, successChance: 75,
    powerMultiplier: 0,
    abilities: [],
    spriteKey: '',
    fxKey: 'terrain/sheep/happysheep_bouncing',
  },

  // 16: Curse — Necropolis faction, single target debuff
  {
    id: 16, name: 'Curse', cardType: CardType.SPELL,
    faction: Faction.NECROPOLIS, rarity: Rarity.LEGENDARY,
    attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
    ammo: 0, manaCost: 9, size: 0, magicResistance: 0,
    damageType: DamageType.MAGIC,
    spellPower: 0, duration: 1, spellTargetType: SpellTargetType.SINGLE, successChance: 65,
    powerMultiplier: 0,
    abilities: [],
    spriteKey: '',
    fxKey: 'blue/monk_v1/heal_effect',
  },

  // --- BUILDINGS (units with speed 0, 100% magic resistance) ---

  // 17: Tower — Castle, Common, 1×1
  {
    id: 17, name: 'Tower', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.COMMON,
    attack: 0, defense: 10, hp: 70, initiative: 0, speed: 0,
    ammo: 0, manaCost: 3, size: 1, magicResistance: 100,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      passive('garrison', 'Garrison', 'Ranged units can enter (+1 move). Inside: immune to melee, ×1.5 ranged damage taken'),
      active('vantage_point', 'Vantage Point', 'Garrisoned unit gets ×1.5 damage and no distance penalty next turn', 3),
    ],
    spriteKey: 'buildings/blue/tower',
    fxKey: '',
  },

  // 18: Barracks — Castle, Rare, 2×2
  {
    id: 18, name: 'Barracks', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.RARE,
    attack: 0, defense: 15, hp: 100, initiative: 0, speed: 0,
    ammo: 0, manaCost: 5, size: 2, magicResistance: 100,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      passive('divine_favour', 'Divine Favour', 'Grants Divine Favour aura, enabling Knight Divine Blessing'),
      active('fortify', 'Fortify', 'Increase DEF of allied units in surrounding hexes', 3),
    ],
    spriteKey: 'buildings/blue/barracks',
    fxKey: '',
  },

  // 19: Monastery — Castle, Legendary, 2×2
  {
    id: 19, name: 'Monastery', cardType: CardType.UNIT,
    faction: Faction.CASTLE, rarity: Rarity.LEGENDARY,
    attack: 0, defense: 12, hp: 90, initiative: 0, speed: 0,
    ammo: 0, manaCost: 8, size: 2, magicResistance: 100,
    damageType: DamageType.PHYSICAL,
    spellPower: 0, duration: 0, spellTargetType: SpellTargetType.SINGLE, successChance: 0,
    powerMultiplier: 0,
    abilities: [
      passive('sacred_ground', 'Sacred Ground', 'All healing ×1.25 while alive'),
      active('gods_rage', 'God\'s Rage', 'Sacrifice units (HP cap = monastery HP), destroy self, deal pooled damage to all enemies', 0),
    ],
    spriteKey: 'buildings/blue/monastery',
    fxKey: '',
  },
];

export function getCard(id: number): CardDefinition {
  const card = cardRegistry[id];
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}

export function isBuilding(card: CardDefinition): boolean {
  return card.cardType === CardType.UNIT && card.speed === 0;
}

export function isRanged(card: CardDefinition): boolean {
  return card.cardType === CardType.UNIT && card.ammo > 0;
}

export function isMelee(card: CardDefinition): boolean {
  return card.cardType === CardType.UNIT && card.ammo === 0 && card.speed > 0;
}

export function dealsMagicDamage(card: CardDefinition): boolean {
  return card.damageType === DamageType.MAGIC;
}

export function hasAbility(card: CardDefinition, abilityId: string): boolean {
  return card.abilities.some(a => a.id === abilityId);
}

export function getAbility(card: CardDefinition, abilityId: string): AbilityDefinition | undefined {
  return card.abilities.find(a => a.id === abilityId);
}
