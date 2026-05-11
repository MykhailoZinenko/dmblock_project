import { DECK_SIZE } from "./deckValidation";

export type SavedDeck = {
  name: string;
  slots: (number | null)[];
  updatedAt: number;
};

function key(address: string): string {
  return `aa.decks.${address.toLowerCase()}`;
}

export function listDecks(address: string): SavedDeck[] {
  try {
    const raw = localStorage.getItem(key(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDeck[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeck(address: string, deck: SavedDeck): SavedDeck[] {
  const decks = listDecks(address);
  const slots = padSlots(deck.slots);
  const next = { ...deck, slots, updatedAt: Date.now() };
  const idx = decks.findIndex((d) => d.name === deck.name);
  if (idx >= 0) decks[idx] = next;
  else decks.push(next);
  localStorage.setItem(key(address), JSON.stringify(decks));
  return decks;
}

export function deleteDeck(address: string, name: string): SavedDeck[] {
  const decks = listDecks(address).filter((d) => d.name !== name);
  localStorage.setItem(key(address), JSON.stringify(decks));
  return decks;
}

export function emptySlots(): (number | null)[] {
  return new Array(DECK_SIZE).fill(null);
}

function padSlots(slots: (number | null)[]): (number | null)[] {
  const out = slots.slice(0, DECK_SIZE);
  while (out.length < DECK_SIZE) out.push(null);
  return out;
}
