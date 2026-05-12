import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "../contracts";

export type OwnedCard = {
  tokenId: bigint;
  cardId: number;
  name: string;
  rarity: number;
  faction: number;
  cardType: number;
  attack: number;
  hp: number;
  defense: number;
  initiative: number;
  manaCost: number;
  spellPower: number;
  duration: number;
  successChance: number;
  school: number;
};

export function useOwnedCards() {
  const { address, isConnected } = useAccount();

  const { data: balance } = useReadContract({
    ...CONTRACTS.cardNFT,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected },
  });

  const { data: totalSupply } = useReadContract({
    ...CONTRACTS.cardNFT,
    functionName: "totalSupply",
    query: { enabled: isConnected },
  });

  const count = Number(balance ?? 0n);
  const total = Number(totalSupply ?? 0n);

  const tokenIds: bigint[] = useMemo(() => {
    if (!isConnected || !address || total <= 0) return [];
    const out: bigint[] = [];
    for (let i = 0; i < total; i++) out.push(BigInt(i));
    return out;
  }, [isConnected, address, total]);

  const { data: owners } = useReadContracts({
    contracts: tokenIds.map((id) => ({
      ...CONTRACTS.cardNFT,
      functionName: "ownerOf" as const,
      args: [id],
    })),
    query: { enabled: tokenIds.length > 0 },
  });

  const ownedTokenIds = useMemo(() => {
    if (!address || !owners) return [] as bigint[];
    return tokenIds.filter((_, i) => {
      const r = owners[i];
      return r?.status === "success" && (r.result as string)?.toLowerCase() === address.toLowerCase();
    });
  }, [tokenIds, owners, address]);

  const { data: tokenCardIds } = useReadContracts({
    contracts: ownedTokenIds.map((id) => ({
      ...CONTRACTS.cardNFT,
      functionName: "tokenCardId" as const,
      args: [id],
    })),
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const uniqueCardIds = useMemo(() => {
    if (!tokenCardIds) return [] as number[];
    const set = new Set<number>();
    for (const r of tokenCardIds) {
      if (r?.status === "success") set.add(Number(r.result as bigint));
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [tokenCardIds]);

  const { data: cardDataResults } = useReadContracts({
    contracts: uniqueCardIds.map((cid) => ({
      ...CONTRACTS.gameConfig,
      functionName: "getCard" as const,
      args: [BigInt(cid)],
    })),
    query: { enabled: uniqueCardIds.length > 0 },
  });

  type CardMeta = Omit<OwnedCard, "tokenId" | "cardId">;

  const cardMetaMap = useMemo(() => {
    const m = new Map<number, CardMeta>();
    if (!cardDataResults) return m;
    uniqueCardIds.forEach((cid, i) => {
      const r = cardDataResults[i];
      if (r?.status !== "success") return;
      const card = r.result as { name: string; stats: Record<string, bigint | number> };
      const s = card.stats;
      m.set(cid, {
        name: card.name,
        cardType: Number(s.cardType),
        rarity: Number(s.rarity),
        faction: Number(s.faction),
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
    return m;
  }, [uniqueCardIds, cardDataResults]);

  const EMPTY_STATS: CardMeta = { name: "", cardType: 0, rarity: 0, faction: 0, attack: 0, hp: 0, defense: 0, initiative: 0, manaCost: 0, spellPower: 0, duration: 0, successChance: 0, school: 0 };

  const cards: OwnedCard[] = useMemo(() => {
    if (!tokenCardIds) return [];
    return ownedTokenIds.map((tokenId, i) => {
      const r = tokenCardIds[i];
      const cardId = r?.status === "success" ? Number(r.result as bigint) : -1;
      const meta = cardMetaMap.get(cardId) ?? { ...EMPTY_STATS, name: `Card #${tokenId}` };
      return { tokenId, cardId, ...meta };
    }).filter((c) => c.cardId >= 0);
  }, [ownedTokenIds, tokenCardIds, cardMetaMap]);

  const isLoading = isConnected && (
    totalSupply === undefined ||
    (tokenIds.length > 0 && !owners) ||
    (ownedTokenIds.length > 0 && !tokenCardIds) ||
    (uniqueCardIds.length > 0 && !cardDataResults)
  );

  return { cards, count, isLoading };
}
