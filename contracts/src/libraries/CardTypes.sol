// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum CardType { UNIT, SPELL }
enum Faction { CASTLE, INFERNO, NECROPOLIS, DUNGEON }
enum Rarity { COMMON, RARE, EPIC, LEGENDARY }
enum SpellSchool { NONE, FIRE, EARTH, WATER, AIR, DARK, LIGHT }

struct Ability {
    uint8 abilityType;  // 0=DAMAGE, 1=HEAL, 2=BUFF, 3=DEBUFF, 4=PASSIVE, 5=SUMMON
    uint8 triggerType;  // 0=ON_ATTACK, 1=ON_HIT, 2=ON_DEATH, 3=ON_TURN_START, 4=ACTIVE
    uint8 targetType;   // 0=SELF, 1=SINGLE_ENEMY, 2=SINGLE_ALLY, 3=ALL_ENEMIES, 4=ALL_ALLIES, 5=AREA
    int16 value;
    uint8 cooldown;
    string aoeShape;    // "NxM" or ""
    uint8 schoolType;   // 0=physical, 1=FIRE, 2=EARTH, 3=WATER, 4=AIR, 5=DARK, 6=LIGHT
}

struct CardStats {
    // Slot 1
    uint8 cardType;         // 0=unit, 1=spell
    uint8 faction;          // 0-3
    uint8 rarity;           // 0-3
    uint8 attack;
    uint8 defense;
    uint8 hp;
    uint8 initiative;
    uint8 speed;
    uint8 ammo;
    uint8 manaCost;
    uint8 size;             // 1 or 2
    uint8 magicResistance;  // 0-100
    uint8 schoolImmunity;   // bitmask: bit0=Fire..bit5=Light
    // Slot 2
    uint32 effectImmunity;  // bitmask: bit0=BLIND..bit9=CONFUSION
    uint8 spellPower;       // spell-only fields below
    uint8 duration;
    uint8 spellTargetType;  // 0=SINGLE,1=ALL_ENEMIES,2=ALL_ALLIES,3=AREA_NxM,4=HERO
    uint8 successChance;    // 0-100
    uint8 school;           // SpellSchool enum value
}

struct CardData {
    string name;
    CardStats stats;
    Ability[] abilities;
    string ipfsHash;
    bool exists;
}
