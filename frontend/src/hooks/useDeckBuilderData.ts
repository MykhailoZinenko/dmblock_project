import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "../contracts";
import type { CardMeta } from "../lib/deckValidation";

export type OwnedTokenInfo = {
  tokenId: bigint;
  cardId: number;
};

export function useDeckBuilderData() {
  const { address, isConnected } = useAccount();

  const { data: totalSupply } = useReadContract({
    ...CONTRACTS.cardNFT,
    functionName: "totalSupply",
    query: { enabled: isConnected },
  });

  const total = Number(totalSupply ?? 0n);

  const allTokenIds: bigint[] = useMemo(() => {
    const out: bigint[] = [];
    for (let i = 0; i < total; i++) out.push(BigInt(i));
    return out;
  }, [total]);

  const { data: owners } = useReadContracts({
    contracts: allTokenIds.map((id) => ({
      ...CONTRACTS.cardNFT,
      functionName: "ownerOf" as const,
      args: [id],
    })),
    query: { enabled: allTokenIds.length > 0 },
  });

  const ownedTokenIds = useMemo(() => {
    if (!address || !owners) return [] as bigint[];
    return allTokenIds.filter((_, i) => {
      const r = owners[i];
      return r?.status === "success" && (r.result as string)?.toLowerCase() === address.toLowerCase();
    });
  }, [allTokenIds, owners, address]);

  const { data: tokenCardIds } = useReadContracts({
    contracts: ownedTokenIds.map((id) => ({
      ...CONTRACTS.cardNFT,
      functionName: "tokenCardId" as const,
      args: [id],
    })),
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const ownedTokens: OwnedTokenInfo[] = useMemo(() => {
    if (!tokenCardIds) return [];
    return ownedTokenIds.map((tokenId, i) => {
      const r = tokenCardIds[i];
      const cid = r?.status === "success" ? Number(r.result as bigint) : -1;
      return { tokenId, cardId: cid };
    }).filter((t) => t.cardId >= 0);
  }, [ownedTokenIds, tokenCardIds]);

  const ownedCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of ownedTokens) m.set(t.cardId, (m.get(t.cardId) ?? 0) + 1);
    return m;
  }, [ownedTokens]);

  const uniqueCardIds = useMemo(() => Array.from(ownedCounts.keys()).sort((a, b) => a - b), [ownedCounts]);

  const { data: cardDataResults } = useReadContracts({
    contracts: uniqueCardIds.map((cid) => ({
      ...CONTRACTS.gameConfig,
      functionName: "getCard" as const,
      args: [BigInt(cid)],
    })),
    query: { enabled: uniqueCardIds.length > 0 },
  });

  const cardMeta = useMemo(() => {
    const m = new Map<number, CardMeta>();
    if (!cardDataResults) return m;
    uniqueCardIds.forEach((cid, i) => {
      const r = cardDataResults[i];
      if (r?.status !== "success") return;
      const card = r.result as { name: string; stats: { cardType: number; rarity: number; faction: number } };
      m.set(cid, {
        name: card.name,
        cardType: Number(card.stats.cardType),
        rarity: Number(card.stats.rarity),
        faction: Number(card.stats.faction),
      });
    });
    return m;
  }, [uniqueCardIds, cardDataResults]);

  // One representative tokenId per cardId, to fetch a single SVG per unique card
  const representativeTokenIds = useMemo(() => {
    const seen = new Map<number, bigint>();
    for (const t of ownedTokens) if (!seen.has(t.cardId)) seen.set(t.cardId, t.tokenId);
    return uniqueCardIds.map((cid) => seen.get(cid)!).filter((id) => id !== undefined);
  }, [ownedTokens, uniqueCardIds]);

  const { data: tokenURIs } = useReadContracts({
    contracts: representativeTokenIds.map((id) => ({
      ...CONTRACTS.cardNFT,
      functionName: "tokenURI" as const,
      args: [id],
    })),
    query: { enabled: representativeTokenIds.length > 0 },
  });

  const cardImages = useMemo(() => {
    const m = new Map<number, string>();
    if (!tokenURIs) return m;
    uniqueCardIds.forEach((cid, i) => {
      const r = tokenURIs[i];
      if (r?.status !== "success" || typeof r.result !== "string") return;
      try {
        const json = atob(r.result.replace("data:application/json;base64,", ""));
        const parsed = JSON.parse(json) as { image?: string };
        if (parsed.image) m.set(cid, parsed.image);
      } catch { /* ignore */ }
    });
    return m;
  }, [uniqueCardIds, tokenURIs]);

  const isLoading =
    isConnected &&
    (totalSupply === undefined ||
      (allTokenIds.length > 0 && !owners) ||
      (ownedTokenIds.length > 0 && !tokenCardIds) ||
      (uniqueCardIds.length > 0 && !cardDataResults));

  return { ownedTokens, ownedCounts, cardMeta, cardImages, uniqueCardIds, isLoading };
}
