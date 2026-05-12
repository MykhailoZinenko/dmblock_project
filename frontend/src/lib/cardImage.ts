export function getCardImageUrl(cardId: number): string {
  return `/assets/cards/${String(cardId).padStart(2, "0")}.png`;
}
