import { GameConfigAbi } from "./abi/GameConfig";
import { CardNFTAbi } from "./abi/CardNFT";
import { HeroNFTAbi } from "./abi/HeroNFT";
import { MarketplaceAbi } from "./abi/Marketplace";
import { PackOpeningAbi } from "./abi/PackOpening";
import { DuelManagerAbi } from "./abi/DuelManager";
import { FreedomRecordAbi } from "./abi/FreedomRecord";

export const ADDRESSES = {
  gameConfig: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  cardNFT: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  heroNFT: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
  marketplace: "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf",
  packOpening: "0x36C02dA8a0983159322a80FFE9F24b1acfF8B570",
  duelManager: "0x51a1ceb83b83f1985a81c295d1ff28afef186e02",
  freedomRecord: "0x36b58f5c1969b7b6591d752ea6f5486d069010ab",
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
