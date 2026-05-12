import { GameConfigAbi } from "./abi/GameConfig";
import { CardNFTAbi } from "./abi/CardNFT";
import { HeroNFTAbi } from "./abi/HeroNFT";
import { MarketplaceAbi } from "./abi/Marketplace";
import { PackOpeningAbi } from "./abi/PackOpening";
import { DuelManagerAbi } from "./abi/DuelManager";
import { FreedomRecordAbi } from "./abi/FreedomRecord";

/** Ethereum Sepolia (11155111) — Arcana Arena deploy */
export const ADDRESSES = {
  gameConfig: "0x42921B7DDEcF9a6e8731e89B8D417E70f5D340F6",
  cardNFT: "0xa4616f3f5b1fa4B8B895727c878C6Cf524e25afD",
  heroNFT: "0x2FB7FA959EbaB2B6786B244a09e99CF72B37f297",
  packOpening: "0xB85BDb1C55623923a59BD0BE19FC56f1C51056c6",
  marketplace: "0x3089d16F1E787FA1fAa1B88310618E713E889087",
  duelManager: "0x3e7DC4775031bD3CF9d2e97d99BD5F48Be54094B",
  freedomRecord: "0x3c18457a5d0e416e0a058D98Dc73250d1B76368A",
} as const;

export const CONTRACTS = {
  gameConfig: { address: ADDRESSES.gameConfig, abi: GameConfigAbi },
  cardNFT: { address: ADDRESSES.cardNFT, abi: CardNFTAbi },
  heroNFT: { address: ADDRESSES.heroNFT, abi: HeroNFTAbi },
  marketplace: { address: ADDRESSES.marketplace, abi: MarketplaceAbi },
  packOpening: { address: ADDRESSES.packOpening, abi: PackOpeningAbi },
  duelManager: { address: ADDRESSES.duelManager, abi: DuelManagerAbi },
  freedomRecord: { address: ADDRESSES.freedomRecord, abi: FreedomRecordAbi },
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
  10: "Castle Magic", 11: "Inferno Magic", 12: "Necropolis Magic", 13: "Dungeon Magic",
  14: "Mana Growth", 15: "Last Stand", 16: "Momentum Scaling",
};
