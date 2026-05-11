import { GameConfigAbi } from "./abi/GameConfig";
import { CardNFTAbi } from "./abi/CardNFT";
import { HeroNFTAbi } from "./abi/HeroNFT";

export const ADDRESSES = {
  gameConfig: "0x998abeb3E57409262aE5b751f60747921B33613E",
  cardNFT: "0x70e0bA845a1A0F2DA3359C97E0285013525FFC49",
  heroNFT: "0x9d4454B023096f34B160D6B654540c56A1F81688",
} as const;

export const CONTRACTS = {
  gameConfig: { address: ADDRESSES.gameConfig, abi: GameConfigAbi },
  cardNFT: { address: ADDRESSES.cardNFT, abi: CardNFTAbi },
  heroNFT: { address: ADDRESSES.heroNFT, abi: HeroNFTAbi },
} as const;

export const FACTIONS = ["Castle", "Inferno", "Necropolis", "Dungeon"] as const;
export const ARCHETYPES = ["Warrior", "Mage", "Ranger", "Sentinel"] as const;

export const FACTION_COLORS: Record<number, string> = {
  0: "#6888c8",
  1: "#d45a3a",
  2: "#8b5ec0",
  3: "#3a9e8f",
};

export const ARCHETYPE_BASE_STATS: Record<number, { attack: number; defense: number; spellPower: number; knowledge: number }> = {
  0: { attack: 4, defense: 2, spellPower: 1, knowledge: 1 },
  1: { attack: 1, defense: 0, spellPower: 3, knowledge: 3 },
  2: { attack: 2, defense: 2, spellPower: 2, knowledge: 2 },
  3: { attack: 0, defense: 4, spellPower: 2, knowledge: 2 },
};

export const TRAIT_NAMES: Record<number, string> = {
  0: "Attack", 1: "Defense", 2: "Power", 3: "Critical Strike",
  4: "Armor Penetration", 5: "Damage Reduction", 6: "Vitality",
  7: "Wisdom", 8: "Spell Focus", 9: "Arcane Mastery",
  10: "Mana Growth", 11: "Last Stand", 12: "Momentum Scaling",
};
