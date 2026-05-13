import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "../contracts";

export function useHero() {
  const { address, isConnected } = useAccount();

  const { data: balance } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected },
  });

  const hasHero = balance !== undefined && balance > 0n;

  const { data: totalSupply } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "totalSupply",
    query: { enabled: hasHero },
  });

  const total = Number(totalSupply ?? 0n);
  const allHeroIds = useMemo(() => {
    const out: bigint[] = [];
    for (let i = 0; i < total; i++) out.push(BigInt(i));
    return out;
  }, [total]);

  const { data: owners } = useReadContracts({
    contracts: allHeroIds.map((id) => ({
      ...CONTRACTS.heroNFT,
      functionName: "ownerOf" as const,
      args: [id],
    })),
    query: { enabled: allHeroIds.length > 0 && hasHero },
  });

  // HeroNFT is non-enumerable — scan totalSupply for the first tokenId owned by the connected wallet
  const heroId: bigint | undefined = useMemo(() => {
    if (!address || !owners) return undefined;
    for (let i = 0; i < allHeroIds.length; i++) {
      const r = owners[i];
      if (r?.status === "success" && (r.result as string)?.toLowerCase() === address.toLowerCase()) {
        return allHeroIds[i];
      }
    }
    return undefined;
  }, [allHeroIds, owners, address]);

  const enabled = hasHero && heroId !== undefined;

  const { data: heroData, refetch: refetchHero } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "getHero",
    args: heroId !== undefined ? [heroId] : undefined,
    query: { enabled },
  });

  const { data: traitsData, refetch: refetchTraits } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "getHeroTraits",
    args: heroId !== undefined ? [heroId] : undefined,
    query: { enabled },
  });

  const { data: traitOptions, refetch: refetchOptions } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "getLevelUpTraitOptions",
    args: heroId !== undefined ? [heroId] : undefined,
    query: { enabled },
  });

  const hero = heroData as { faction: number; archetype: number; attack: number; defense: number; spellPower: number; knowledge: number; level: number; xp: number; seasonId: number } | undefined;

  const traits = traitsData as [number[], number[]] | undefined;
  const options = traitOptions as [number, number] | undefined;

  const refetchAll = () => {
    refetchHero();
    refetchTraits();
    refetchOptions();
  };

  const isLoading =
    isConnected &&
    (balance === undefined ||
      (hasHero &&
        (totalSupply === undefined ||
          (allHeroIds.length > 0 && !owners) ||
          (heroId !== undefined && !heroData))));

  return { hero, heroId, hasHero, traits, traitOptions: options, refetchAll, isLoading };
}
