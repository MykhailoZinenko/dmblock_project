import { describe, it, expect } from 'vitest';
import {
  cardRegistry,
  getCard,
  isBuilding,
  isRanged,
  isMelee,
  dealsMagicDamage,
  hasAbility,
  getAbility,
} from '../cardRegistry';
import { CardType, Faction, Rarity, DamageType, SpellTargetType } from '../types';

describe('cardRegistry', () => {
  it('contains exactly 20 cards', () => {
    expect(cardRegistry).toHaveLength(20);
  });

  it('has sequential ids from 0 to 19', () => {
    cardRegistry.forEach((card, i) => {
      expect(card.id).toBe(i);
    });
  });

  it('has 13 units and 7 spells', () => {
    const units = cardRegistry.filter(c => c.cardType === CardType.UNIT);
    const spells = cardRegistry.filter(c => c.cardType === CardType.SPELL);
    expect(units).toHaveLength(13);
    expect(spells).toHaveLength(7);
  });

  it('all cards have non-empty names', () => {
    cardRegistry.forEach(card => {
      expect(card.name.length).toBeGreaterThan(0);
    });
  });

  it('all units have positive HP', () => {
    cardRegistry
      .filter(c => c.cardType === CardType.UNIT)
      .forEach(card => {
        expect(card.hp).toBeGreaterThan(0);
      });
  });

  it('all spells have successChance > 0', () => {
    cardRegistry
      .filter(c => c.cardType === CardType.SPELL)
      .forEach(card => {
        expect(card.successChance).toBeGreaterThan(0);
      });
  });

  it('all spells have manaCost > 0', () => {
    cardRegistry
      .filter(c => c.cardType === CardType.SPELL)
      .forEach(card => {
        expect(card.manaCost).toBeGreaterThan(0);
      });
  });

  it('buildings have speed 0 and 100% magic resistance', () => {
    const buildings = cardRegistry.filter(c => c.cardType === CardType.UNIT && c.speed === 0);
    expect(buildings.length).toBe(3);
    buildings.forEach(b => {
      expect(b.magicResistance).toBe(100);
    });
  });

  it('Barracks and Monastery have size 2', () => {
    expect(getCard(18).size).toBe(2);
    expect(getCard(19).size).toBe(2);
  });

  it('Tower has size 1', () => {
    expect(getCard(17).size).toBe(1);
  });

  it('Inferno spell has size 1 for AoE radius', () => {
    const inferno = getCard(14);
    expect(inferno.spellTargetType).toBe(SpellTargetType.AREA);
    expect(inferno.size).toBe(1);
  });

  it('all Inferno faction units deal magic damage', () => {
    cardRegistry
      .filter(c => c.cardType === CardType.UNIT && c.faction === Faction.INFERNO)
      .forEach(card => {
        expect(card.damageType).toBe(DamageType.MAGIC);
      });
  });

  it('Castle faction units deal physical damage', () => {
    cardRegistry
      .filter(c => c.cardType === CardType.UNIT && c.faction === Faction.CASTLE)
      .forEach(card => {
        expect(card.damageType).toBe(DamageType.PHYSICAL);
      });
  });

  it('spells have powerMultiplier defined', () => {
    const damageSpells = cardRegistry.filter(
      c => c.cardType === CardType.SPELL && c.spellPower > 0,
    );
    damageSpells.forEach(spell => {
      expect(spell.powerMultiplier).toBeGreaterThan(0);
    });
  });
});

describe('getCard', () => {
  it('returns correct card by id', () => {
    const peasant = getCard(0);
    expect(peasant.name).toBe('Peasant');
    expect(peasant.attack).toBe(5);
    expect(peasant.defense).toBe(3);
    expect(peasant.hp).toBe(30);
  });

  it('returns correct card for last id', () => {
    const monastery = getCard(19);
    expect(monastery.name).toBe('Monastery');
  });

  it('throws for invalid id', () => {
    expect(() => getCard(20)).toThrow('Unknown card id: 20');
    expect(() => getCard(-1)).toThrow('Unknown card id: -1');
  });
});

describe('isBuilding', () => {
  it('returns true for Tower, Barracks, Monastery', () => {
    expect(isBuilding(getCard(17))).toBe(true);
    expect(isBuilding(getCard(18))).toBe(true);
    expect(isBuilding(getCard(19))).toBe(true);
  });

  it('returns false for regular units', () => {
    expect(isBuilding(getCard(0))).toBe(false);
    expect(isBuilding(getCard(5))).toBe(false);
  });

  it('returns false for spells', () => {
    expect(isBuilding(getCard(10))).toBe(false);
  });
});

describe('isRanged', () => {
  it('returns true for Archer (ammo 5)', () => {
    expect(isRanged(getCard(2))).toBe(true);
  });

  it('returns true for Sniper (ammo 4)', () => {
    expect(isRanged(getCard(3))).toBe(true);
  });

  it('returns true for Pyro-Goblin (ammo 4)', () => {
    expect(isRanged(getCard(8))).toBe(true);
  });

  it('returns false for melee units', () => {
    expect(isRanged(getCard(0))).toBe(false);
    expect(isRanged(getCard(5))).toBe(false);
  });

  it('returns false for spells', () => {
    expect(isRanged(getCard(10))).toBe(false);
  });
});

describe('isMelee', () => {
  it('returns true for Peasant', () => {
    expect(isMelee(getCard(0))).toBe(true);
  });

  it('returns true for Knight', () => {
    expect(isMelee(getCard(5))).toBe(true);
  });

  it('returns false for ranged units', () => {
    expect(isMelee(getCard(2))).toBe(false);
  });

  it('returns false for buildings (speed 0)', () => {
    expect(isMelee(getCard(17))).toBe(false);
  });

  it('returns false for spells', () => {
    expect(isMelee(getCard(10))).toBe(false);
  });
});

describe('dealsMagicDamage', () => {
  it('returns true for Torchbearer', () => {
    expect(dealsMagicDamage(getCard(7))).toBe(true);
  });

  it('returns true for Pyro-Goblin', () => {
    expect(dealsMagicDamage(getCard(8))).toBe(true);
  });

  it('returns true for Demolitionist', () => {
    expect(dealsMagicDamage(getCard(9))).toBe(true);
  });

  it('returns false for Castle units', () => {
    expect(dealsMagicDamage(getCard(0))).toBe(false);
    expect(dealsMagicDamage(getCard(5))).toBe(false);
  });
});

describe('hasAbility', () => {
  it('returns true for Peasant sheep_slayer', () => {
    expect(hasAbility(getCard(0), 'sheep_slayer')).toBe(true);
  });

  it('returns true for Knight shield_wall', () => {
    expect(hasAbility(getCard(5), 'shield_wall')).toBe(true);
  });

  it('returns false for non-existent ability', () => {
    expect(hasAbility(getCard(0), 'nonexistent')).toBe(false);
  });

  it('returns false for spells (no abilities)', () => {
    expect(hasAbility(getCard(10), 'anything')).toBe(false);
  });
});

describe('getAbility', () => {
  it('returns ability definition for existing ability', () => {
    const ability = getAbility(getCard(1), 'craft_axe');
    expect(ability).toBeDefined();
    expect(ability!.name).toBe('Craft Axe');
    expect(ability!.cooldown).toBe(2);
  });

  it('returns undefined for non-existent ability', () => {
    expect(getAbility(getCard(0), 'nonexistent')).toBeUndefined();
  });

  it('returns correct cooldown for double_shot', () => {
    const ability = getAbility(getCard(2), 'double_shot');
    expect(ability).toBeDefined();
    expect(ability!.cooldown).toBe(3);
  });
});
