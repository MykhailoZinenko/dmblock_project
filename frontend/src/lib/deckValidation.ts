export const DECK_SIZE = 20;
export const MIN_UNITS_TOTAL = 6;
export const ARCHETYPE_UNIT_MIN = 12;
export const ARCHETYPE_SPELL_MIN = 12;

export const RARITY_CAP: Record<number, number> = {
  0: 4, // Common
  1: 3, // Rare
  2: 2, // Epic
  3: 1, // Legendary
};

export const RARITY_NAME: Record<number, string> = {
  0: "Common",
  1: "Rare",
  2: "Epic",
  3: "Legendary",
};

export const ARCHETYPE_NAME: Record<number, string> = {
  0: "Warrior",
  1: "Mage",
  2: "Ranger",
  3: "Sentinel",
};

export type CardMeta = {
  cardType: number; // 0=unit, 1=spell
  rarity: number;   // 0..3
  faction: number;  // 0..3
  name: string;
};

export type RuleResult = {
  code: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type ValidationResult = {
  ok: boolean;
  filled: number;
  unitCount: number;
  spellCount: number;
  rules: RuleResult[];
  perCardIdCap: Map<number, number>; // effective cap (min of rarityCap, owned)
  perCardIdUsed: Map<number, number>;
};

export function effectiveCap(cardId: number, cardMeta: Map<number, CardMeta>, ownedCounts: Map<number, number>): number {
  const meta = cardMeta.get(cardId);
  const owned = ownedCounts.get(cardId) ?? 0;
  if (!meta) return 0;
  const rarityCap = RARITY_CAP[meta.rarity] ?? 0;
  return Math.min(rarityCap, owned);
}

export function validateDeck(
  slots: (number | null)[],
  cardMeta: Map<number, CardMeta>,
  ownedCounts: Map<number, number>,
  heroArchetype: number,
): ValidationResult {
  const used = new Map<number, number>();
  let filled = 0;
  let unitCount = 0;
  let spellCount = 0;

  for (const cid of slots) {
    if (cid === null || cid === undefined) continue;
    filled++;
    used.set(cid, (used.get(cid) ?? 0) + 1);
    const meta = cardMeta.get(cid);
    if (!meta) continue;
    if (meta.cardType === 0) unitCount++;
    else spellCount++;
  }

  const rules: RuleResult[] = [];

  rules.push({
    code: "DECK_SIZE",
    label: `Deck has exactly ${DECK_SIZE} cards`,
    ok: filled === DECK_SIZE,
    detail: `${filled} / ${DECK_SIZE}`,
  });

  const ownershipViolations: string[] = [];
  const rarityViolations: string[] = [];
  for (const [cid, count] of used) {
    const meta = cardMeta.get(cid);
    const owned = ownedCounts.get(cid) ?? 0;
    if (count > owned) {
      ownershipViolations.push(`${meta?.name ?? `#${cid}`}: ${count} in deck, ${owned} owned`);
    }
    if (meta) {
      const cap = RARITY_CAP[meta.rarity] ?? 0;
      if (count > cap) {
        rarityViolations.push(`${meta.name}: ${count} > ${cap} (${RARITY_NAME[meta.rarity]})`);
      }
    }
  }
  rules.push({
    code: "RARITY_CAPS",
    label: "Rarity copy caps (C4/R3/E2/L1)",
    ok: rarityViolations.length === 0,
    detail: rarityViolations.join("; ") || undefined,
  });
  rules.push({
    code: "OWNERSHIP",
    label: "Only owned NFTs (1 NFT = 1 deck slot)",
    ok: ownershipViolations.length === 0,
    detail: ownershipViolations.join("; ") || undefined,
  });

  rules.push({
    code: "MIN_UNITS",
    label: `At least ${MIN_UNITS_TOTAL} units total`,
    ok: unitCount >= MIN_UNITS_TOTAL,
    detail: `${unitCount} units`,
  });

  if (heroArchetype === 0 || heroArchetype === 3) {
    rules.push({
      code: "ARCHETYPE_UNITS",
      label: `${ARCHETYPE_NAME[heroArchetype]}: ≥${ARCHETYPE_UNIT_MIN} units`,
      ok: unitCount >= ARCHETYPE_UNIT_MIN,
      detail: `${unitCount} units`,
    });
  } else if (heroArchetype === 1) {
    rules.push({
      code: "ARCHETYPE_SPELLS",
      label: `Mage: ≥${ARCHETYPE_SPELL_MIN} spells`,
      ok: spellCount >= ARCHETYPE_SPELL_MIN,
      detail: `${spellCount} spells`,
    });
  }

  const perCardIdCap = new Map<number, number>();
  for (const cid of cardMeta.keys()) {
    perCardIdCap.set(cid, effectiveCap(cid, cardMeta, ownedCounts));
  }

  return {
    ok: rules.every((r) => r.ok),
    filled,
    unitCount,
    spellCount,
    rules,
    perCardIdCap,
    perCardIdUsed: used,
  };
}
