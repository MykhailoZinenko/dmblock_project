// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum Archetype { WARRIOR, MAGE, RANGER, SENTINEL }

struct HeroData {
    uint8 faction;      // 0=Castle, 1=Inferno, 2=Necropolis, 3=Dungeon
    uint8 archetype;    // 0=Warrior, 1=Mage, 2=Ranger, 3=Sentinel
    uint8 attack;
    uint8 defense;
    uint8 spellPower;
    uint8 knowledge;
    uint8 level;        // 1-50
    uint32 seasonId;
    bool exists;
}

library TraitConstants {
    // Combat traits (max level 10)
    uint8 internal constant ATTACK = 0;
    uint8 internal constant DEFENSE = 1;
    uint8 internal constant POWER = 2;
    uint8 internal constant CRITICAL_STRIKE = 3;
    uint8 internal constant ARMOR_PENETRATION = 4;
    uint8 internal constant DAMAGE_REDUCTION = 5;
    uint8 internal constant VITALITY = 6;

    // Magic traits (max level 10)
    uint8 internal constant WISDOM = 7;
    uint8 internal constant SPELL_FOCUS = 8;

    // Magic school traits (max level 5)
    uint8 internal constant FIRE_MAGIC = 9;
    uint8 internal constant EARTH_MAGIC = 10;
    uint8 internal constant WATER_MAGIC = 11;
    uint8 internal constant AIR_MAGIC = 12;
    uint8 internal constant DARK_MAGIC = 13;
    uint8 internal constant LIGHT_MAGIC = 14;

    // Tactical traits (max level 5)
    uint8 internal constant INITIATIVE_BOOST = 15;
    uint8 internal constant INITIATIVE_SUPPRESSION = 16;
    uint8 internal constant MOVEMENT_BOOST = 17;
    uint8 internal constant FIRST_AID = 18;
    uint8 internal constant HAND_REVELATION = 19;
    uint8 internal constant TACTICS = 20;

    // Passive traits (max level 5)
    uint8 internal constant MANA_GROWTH = 21;
    uint8 internal constant LAST_STAND = 22;
    uint8 internal constant MOMENTUM_SCALING = 23;

    uint8 internal constant TOTAL_TRAITS = 24;

    function maxTraitLevel(uint8 traitId) internal pure returns (uint8) {
        require(traitId < TOTAL_TRAITS, "Invalid trait ID");
        if (traitId <= VITALITY) return 10;       // Combat traits: 0-6
        if (traitId <= SPELL_FOCUS) return 10;     // Wisdom, Spell Focus: 7-8
        if (traitId <= LIGHT_MAGIC) return 5;      // School magic: 9-14
        if (traitId <= TACTICS) return 5;           // Tactical: 15-20
        return 5;                                   // Passive: 21-23
    }
}
