import { describe, it, expect } from "vitest";
import { getCardImageUrl } from "../cardImage";

describe("getCardImageUrl", () => {
  it("pads single-digit cardId with leading zero", () => {
    expect(getCardImageUrl(0)).toBe("/assets/cards/00.png");
    expect(getCardImageUrl(1)).toBe("/assets/cards/01.png");
    expect(getCardImageUrl(9)).toBe("/assets/cards/09.png");
  });

  it("does not pad double-digit cardId", () => {
    expect(getCardImageUrl(10)).toBe("/assets/cards/10.png");
    expect(getCardImageUrl(19)).toBe("/assets/cards/19.png");
  });

  it("handles large cardId", () => {
    expect(getCardImageUrl(100)).toBe("/assets/cards/100.png");
  });
});
