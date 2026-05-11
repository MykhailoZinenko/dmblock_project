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
    uint8 internal constant ARCANE_MASTERY = 9;

    // Faction magic traits (max level 5)
    uint8 internal constant CASTLE_MAGIC = 10;
    uint8 internal constant INFERNO_MAGIC = 11;
    uint8 internal constant NECROPOLIS_MAGIC = 12;
    uint8 internal constant DUNGEON_MAGIC = 13;

    // Passive traits (max level 5)
    uint8 internal constant MANA_GROWTH = 14;
    uint8 internal constant LAST_STAND = 15;
    uint8 internal constant MOMENTUM_SCALING = 16;

    uint8 internal constant TOTAL_TRAITS = 17;

    function maxTraitLevel(uint8 traitId) internal pure returns (uint8) {
        require(traitId < TOTAL_TRAITS, "Invalid trait ID");
        if (traitId <= VITALITY) return 10;           // Combat: 0-6
        if (traitId <= ARCANE_MASTERY) return 10;     // Magic: 7-9
        if (traitId <= DUNGEON_MAGIC) return 5;       // Faction magic: 10-13
        return 5;                                      // Passive: 14-16
    }
}
