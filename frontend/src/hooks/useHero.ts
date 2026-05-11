import { useAccount, useReadContract } from "wagmi";
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

  const { data: heroData, refetch: refetchHero } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "getHero",
    args: [0n],
    query: { enabled: hasHero },
  });

  const { data: traitsData, refetch: refetchTraits } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "getHeroTraits",
    args: [0n],
    query: { enabled: hasHero },
  });

  const { data: traitOptions, refetch: refetchOptions } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "getLevelUpTraitOptions",
    args: [0n],
    query: { enabled: hasHero },
  });

  const hero = heroData as { faction: number; archetype: number; attack: number; defense: number; spellPower: number; knowledge: number; level: number; seasonId: number } | undefined;

  const traits = traitsData as [number[], number[]] | undefined;
  const options = traitOptions as [number, number] | undefined;

  const refetchAll = () => {
    refetchHero();
    refetchTraits();
    refetchOptions();
  };

  return { hero, hasHero, traits, traitOptions: options, refetchAll, isLoading: hasHero && !heroData };
}
