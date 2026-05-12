import { describe, it, expect, beforeEach } from "vitest";
import { listDecks, saveDeck, deleteDeck, emptySlots } from "../deckStorage";
import { DECK_SIZE } from "../deckValidation";

// Mock localStorage with a simple Map-based implementation
const store = new Map<string, string>();
const localStorageMock: Storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (i: number) => [...store.keys()][i] ?? null,
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

const ADDR = "0xABCD1234";

beforeEach(() => {
  store.clear();
});

describe("listDecks", () => {
  it("returns [] when no data", () => {
    expect(listDecks(ADDR)).toEqual([]);
  });

  it("returns [] on parse error", () => {
    store.set(`aa.decks.${ADDR.toLowerCase()}`, "NOT_JSON{{{");
    expect(listDecks(ADDR)).toEqual([]);
  });

  it("returns [] when stored value is not an array", () => {
    store.set(`aa.decks.${ADDR.toLowerCase()}`, JSON.stringify({ not: "array" }));
    expect(listDecks(ADDR)).toEqual([]);
  });
});

describe("saveDeck", () => {
  it("saves and retrieves a deck", () => {
    const deck = { name: "Deck1", slots: [1, 2, 3], updatedAt: 0 };
    saveDeck(ADDR, deck);
    const decks = listDecks(ADDR);
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe("Deck1");
  });

  it("updates existing deck with same name", () => {
    saveDeck(ADDR, { name: "Deck1", slots: [1], updatedAt: 0 });
    saveDeck(ADDR, { name: "Deck1", slots: [2], updatedAt: 0 });
    const decks = listDecks(ADDR);
    expect(decks).toHaveLength(1);
    expect(decks[0].slots[0]).toBe(2);
  });

  it("adds new deck without removing existing", () => {
    saveDeck(ADDR, { name: "Deck1", slots: [1], updatedAt: 0 });
    saveDeck(ADDR, { name: "Deck2", slots: [2], updatedAt: 0 });
    const decks = listDecks(ADDR);
    expect(decks).toHaveLength(2);
  });

  it("pads short slots to DECK_SIZE", () => {
    saveDeck(ADDR, { name: "Short", slots: [1, 2], updatedAt: 0 });
    const decks = listDecks(ADDR);
    expect(decks[0].slots).toHaveLength(DECK_SIZE);
    expect(decks[0].slots[0]).toBe(1);
    expect(decks[0].slots[2]).toBeNull();
  });
});

describe("deleteDeck", () => {
  it("removes deck by name", () => {
    saveDeck(ADDR, { name: "Deck1", slots: [], updatedAt: 0 });
    saveDeck(ADDR, { name: "Deck2", slots: [], updatedAt: 0 });
    deleteDeck(ADDR, "Deck1");
    const decks = listDecks(ADDR);
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe("Deck2");
  });

  it("is a no-op when name does not exist", () => {
    saveDeck(ADDR, { name: "Deck1", slots: [], updatedAt: 0 });
    deleteDeck(ADDR, "NonExistent");
    expect(listDecks(ADDR)).toHaveLength(1);
  });
});

describe("emptySlots", () => {
  it("returns array of DECK_SIZE nulls", () => {
    const slots = emptySlots();
    expect(slots).toHaveLength(DECK_SIZE);
    expect(slots.every((s) => s === null)).toBe(true);
  });
});
