import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "../contracts";

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

  const tokenIds: bigint[] = [];
  if (isConnected && address && total > 0) {
    for (let i = 0; i < total; i++) {
      tokenIds.push(BigInt(i));
    }
  }

  const { data: owners } = useReadContracts({
    contracts: tokenIds.map((id) => ({
      ...CONTRACTS.cardNFT,
      functionName: "ownerOf" as const,
      args: [id],
    })),
    query: { enabled: tokenIds.length > 0 },
  });

  const ownedTokenIds = tokenIds.filter((_, i) => {
    const result = owners?.[i];
    return result?.status === "success" && (result.result as string)?.toLowerCase() === address?.toLowerCase();
  });

  const { data: tokenURIs } = useReadContracts({
    contracts: ownedTokenIds.map((id) => ({
      ...CONTRACTS.cardNFT,
      functionName: "tokenURI" as const,
      args: [id],
    })),
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const cards = ownedTokenIds.map((tokenId, i) => {
    const uri = tokenURIs?.[i];
    let metadata: { name?: string; image?: string; attributes?: { trait_type: string; value: string | number }[] } | null = null;

    if (uri?.status === "success" && typeof uri.result === "string") {
      try {
        const json = atob(uri.result.replace("data:application/json;base64,", ""));
        metadata = JSON.parse(json);
      } catch { /* ignore parse errors */ }
    }

    return { tokenId, metadata };
  });

  return { cards, count, isLoading: !owners || (ownedTokenIds.length > 0 && !tokenURIs) };
}
