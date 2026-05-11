import { GameConfigAbi } from "./abi/GameConfig";
import { CardNFTAbi } from "./abi/CardNFT";
import { HeroNFTAbi } from "./abi/HeroNFT";
import { MarketplaceAbi } from "./abi/Marketplace";
import { PackOpeningAbi } from "./abi/PackOpening";
import { DuelManagerAbi } from "./abi/DuelManager";
import { FreedomRecordAbi } from "./abi/FreedomRecord";

export const ADDRESSES = {
  gameConfig: "0x4631BCAbD6dF18D94796344963cB60d44a4136b6",
  cardNFT: "0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D",
  heroNFT: "0x3155755b79aA083bd953911C92705B7aA82a18F9",
  marketplace: "0xab16A69A5a8c12C732e0DEFF4BE56A70bb64c926",
  packOpening: "0x19cEcCd6942ad38562Ee10bAfd44776ceB67e923",
  duelManager: "0xCA8c8688914e0F7096c920146cd0Ad85cD7Ae8b9",
  freedomRecord: "0xB0f05d25e41FbC2b52013099ED9616f1206Ae21B",
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
