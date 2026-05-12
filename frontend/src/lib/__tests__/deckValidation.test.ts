import { describe, it, expect } from "vitest";
import {
  DECK_SIZE,
  RARITY_CAP,
  effectiveCap,
  validateDeck,
  type CardMeta,
} from "../deckValidation";

function makeMeta(overrides: Partial<CardMeta> = {}): CardMeta {
  return { cardType: 0, rarity: 0, faction: 0, name: "Test", ...overrides };
}

describe("effectiveCap", () => {
  it("returns min of rarity cap and owned count", () => {
    const meta = new Map<number, CardMeta>([[1, makeMeta({ rarity: 0 })]]);
    // Common cap = 4, owned = 2 → 2
    expect(effectiveCap(1, meta, new Map([[1, 2]]))).toBe(2);
    // Common cap = 4, owned = 10 → 4
    expect(effectiveCap(1, meta, new Map([[1, 10]]))).toBe(4);
  });

  it("returns 0 for unknown cardId", () => {
    const meta = new Map<number, CardMeta>();
    expect(effectiveCap(99, meta, new Map([[99, 5]]))).toBe(0);
  });

  it("returns 0 when owned is 0", () => {
    const meta = new Map<number, CardMeta>([[1, makeMeta({ rarity: 0 })]]);
    expect(effectiveCap(1, meta, new Map([[1, 0]]))).toBe(0);
  });

  it("respects rarity caps for each rarity", () => {
    const meta = new Map<number, CardMeta>([
      [1, makeMeta({ rarity: 0 })], // Common → 4
      [2, makeMeta({ rarity: 1 })], // Rare → 3
      [3, makeMeta({ rarity: 2 })], // Epic → 2
      [4, makeMeta({ rarity: 3 })], // Legendary → 1
    ]);
    const owned = new Map([[1, 10], [2, 10], [3, 10], [4, 10]]);
    expect(effectiveCap(1, meta, owned)).toBe(RARITY_CAP[0]);
    expect(effectiveCap(2, meta, owned)).toBe(RARITY_CAP[1]);
    expect(effectiveCap(3, meta, owned)).toBe(RARITY_CAP[2]);
    expect(effectiveCap(4, meta, owned)).toBe(RARITY_CAP[3]);
  });
});

describe("validateDeck", () => {
  // Helper: build a valid 20-card deck using common cards (cap 4 each), 5 distinct cards x4
  function validDeckFixture() {
    const meta = new Map<number, CardMeta>();
    const owned = new Map<number, number>();
    const slots: (number | null)[] = [];
    for (let i = 0; i < 5; i++) {
      meta.set(i, makeMeta({ rarity: 0, name: `Card${i}` }));
      owned.set(i, 4);
      for (let j = 0; j < 4; j++) slots.push(i);
    }
    return { meta, owned, slots };
  }

  it("valid 20-card deck passes all rules", () => {
    const { meta, owned, slots } = validDeckFixture();
    const result = validateDeck(slots, meta, owned);
    expect(result.ok).toBe(true);
    expect(result.filled).toBe(DECK_SIZE);
    expect(result.rules.every((r) => r.ok)).toBe(true);
  });

  it("underfilled deck fails DECK_SIZE", () => {
    const { meta, owned } = validDeckFixture();
    const slots = Array(10).fill(0); // only 10 cards
    const result = validateDeck(slots, meta, owned);
    expect(result.ok).toBe(false);
    const sizeRule = result.rules.find((r) => r.code === "DECK_SIZE");
    expect(sizeRule?.ok).toBe(false);
  });

  it("over-rarity fails RARITY_CAPS", () => {
    const meta = new Map<number, CardMeta>([
      [0, makeMeta({ rarity: 3, name: "Legend" })], // Legendary cap = 1
    ]);
    const owned = new Map([[0, 20]]);
    const slots: (number | null)[] = Array(DECK_SIZE).fill(0); // 20 copies of legendary
    const result = validateDeck(slots, meta, owned);
    expect(result.ok).toBe(false);
    const rarityRule = result.rules.find((r) => r.code === "RARITY_CAPS");
    expect(rarityRule?.ok).toBe(false);
  });

  it("over-owned fails OWNERSHIP", () => {
    const meta = new Map<number, CardMeta>([
      [0, makeMeta({ rarity: 0, name: "Common" })],
    ]);
    const owned = new Map([[0, 2]]); // only own 2
    const slots: (number | null)[] = Array(DECK_SIZE).fill(0); // use 20
    const result = validateDeck(slots, meta, owned);
    expect(result.ok).toBe(false);
    const ownershipRule = result.rules.find((r) => r.code === "OWNERSHIP");
    expect(ownershipRule?.ok).toBe(false);
  });

  it("empty/null slots are not counted as filled", () => {
    const meta = new Map<number, CardMeta>();
    const owned = new Map<number, number>();
    const slots: (number | null)[] = Array(DECK_SIZE).fill(null);
    const result = validateDeck(slots, meta, owned);
    expect(result.filled).toBe(0);
    const sizeRule = result.rules.find((r) => r.code === "DECK_SIZE");
    expect(sizeRule?.ok).toBe(false);
  });

  it("counts units and spells separately", () => {
    const meta = new Map<number, CardMeta>([
      [0, makeMeta({ cardType: 0, rarity: 0, name: "Unit" })],
      [1, makeMeta({ cardType: 1, rarity: 0, name: "Spell" })],
    ]);
    const owned = new Map([[0, 4], [1, 4]]);
    // 4 units + 4 spells = 8 filled (not 20, but we can still check counts)
    const slots: (number | null)[] = [
      ...Array(4).fill(0),
      ...Array(4).fill(1),
      ...Array(12).fill(null),
    ];
    const result = validateDeck(slots, meta, owned);
    expect(result.unitCount).toBe(4);
    expect(result.spellCount).toBe(4);
  });

  it("mixed pass/fail — rarity ok but ownership violated", () => {
    const meta = new Map<number, CardMeta>([
      [0, makeMeta({ rarity: 0, name: "Common" })],
    ]);
    const owned = new Map([[0, 3]]); // own 3 but rarity cap is 4
    // Use 4 copies — within rarity cap but exceeds ownership
    const slots: (number | null)[] = [
      ...Array(4).fill(0),
      ...Array(16).fill(null),
    ];
    const result = validateDeck(slots, meta, owned);
    const rarityRule = result.rules.find((r) => r.code === "RARITY_CAPS");
    const ownershipRule = result.rules.find((r) => r.code === "OWNERSHIP");
    expect(rarityRule?.ok).toBe(true);
    expect(ownershipRule?.ok).toBe(false);
  });

  it("populates perCardIdCap and perCardIdUsed", () => {
    const { meta, owned, slots } = validDeckFixture();
    const result = validateDeck(slots, meta, owned);
    // 5 card ids, each cap = min(4, 4) = 4
    for (let i = 0; i < 5; i++) {
      expect(result.perCardIdCap.get(i)).toBe(4);
      expect(result.perCardIdUsed.get(i)).toBe(4);
    }
  });
});
