import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "../contracts";
import type { CardMeta } from "../lib/deckValidation";
import type { CardStats } from "../ui/components/CardImage";

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

  const { cardMeta, cardStatsMap } = useMemo(() => {
    const meta = new Map<number, CardMeta>();
    const stats = new Map<number, CardStats>();
    if (!cardDataResults) return { cardMeta: meta, cardStatsMap: stats };
    uniqueCardIds.forEach((cid, i) => {
      const r = cardDataResults[i];
      if (r?.status !== "success") return;
      const card = r.result as { name: string; stats: Record<string, bigint | number> };
      const s = card.stats;
      meta.set(cid, {
        name: card.name,
        cardType: Number(s.cardType),
        rarity: Number(s.rarity),
        faction: Number(s.faction),
      });
      stats.set(cid, {
        cardType: Number(s.cardType),
        attack: Number(s.attack),
        hp: Number(s.hp),
        defense: Number(s.defense),
        initiative: Number(s.initiative),
        manaCost: Number(s.manaCost),
        spellPower: Number(s.spellPower),
        duration: Number(s.duration),
        successChance: Number(s.successChance),
        school: Number(s.school),
      });
    });
    return { cardMeta: meta, cardStatsMap: stats };
  }, [uniqueCardIds, cardDataResults]);

  const isLoading =
    isConnected &&
    (totalSupply === undefined ||
      (allTokenIds.length > 0 && !owners) ||
      (ownedTokenIds.length > 0 && !tokenCardIds) ||
      (uniqueCardIds.length > 0 && !cardDataResults));

  return { ownedTokens, ownedCounts, cardMeta, cardStatsMap, uniqueCardIds, isLoading };
}
