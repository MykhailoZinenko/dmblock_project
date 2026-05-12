import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { CONTRACTS, ADDRESSES } from "../contracts";
import { useOwnedCards } from "../hooks/useOwnedCards";
import { CardImage, type CardStats } from "../ui/components/CardImage";
import { ArcanaButton, ArcanaPanel, ArcanaRibbon } from "../ui/components/index";

const ZERO = "0x0000000000000000000000000000000000000000";

type Listing = {
  tokenId: bigint;
  cardId: number;
  seller: string;
  priceWei: bigint;
  name: string;
  stats?: CardStats;
};

function useAllListings() {
  const { data: totalSupply } = useReadContract({
    ...CONTRACTS.cardNFT,
    functionName: "totalSupply",
  });
  const total = Number(totalSupply ?? 0n);
  const ids: bigint[] = useMemo(() => {
    const out: bigint[] = [];
    for (let i = 0; i < total; i++) out.push(BigInt(i));
    return out;
  }, [total]);

  const { data: listings, refetch } = useReadContracts({
    contracts: ids.map((id) => ({
      ...CONTRACTS.marketplace,
      functionName: "getListing" as const,
      args: [id],
    })),
    query: { enabled: total > 0 },
  });

  const active = useMemo(() => {
    return ids
      .map((id, i) => {
        const r = listings?.[i];
        if (r?.status !== "success") return null;
        const l = r.result as { seller: string; priceWei: bigint };
        if (l.seller.toLowerCase() === ZERO) return null;
        return { tokenId: id, seller: l.seller, priceWei: l.priceWei };
      })
      .filter((x): x is { tokenId: bigint; seller: string; priceWei: bigint } => x !== null);
  }, [ids, listings]);

  const { data: tokenCardIds } = useReadContracts({
    contracts: active.map((l) => ({
      ...CONTRACTS.cardNFT,
      functionName: "tokenCardId" as const,
      args: [l.tokenId],
    })),
    query: { enabled: active.length > 0 },
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

  const items: Listing[] = useMemo(() => {
    if (!tokenCardIds || !cardDataResults) return [];
    const dataMap = new Map<number, { name: string; stats: CardStats }>();
    uniqueCardIds.forEach((cid, i) => {
      const r = cardDataResults[i];
      if (r?.status !== "success") return;
      const card = r.result as { name: string; stats: Record<string, bigint | number> };
      const s = card.stats;
      dataMap.set(cid, {
        name: card.name,
        stats: {
          cardType: Number(s.cardType), attack: Number(s.attack), hp: Number(s.hp),
          defense: Number(s.defense), initiative: Number(s.initiative), manaCost: Number(s.manaCost),
          spellPower: Number(s.spellPower), duration: Number(s.duration),
          successChance: Number(s.successChance), school: Number(s.school),
        },
      });
    });
    return active.map((l, i) => {
      const r = tokenCardIds[i];
      const cardId = r?.status === "success" ? Number(r.result as bigint) : -1;
      const data = dataMap.get(cardId);
      return { ...l, cardId, name: data?.name ?? `Card #${l.tokenId}`, stats: data?.stats };
    });
  }, [active, tokenCardIds, cardDataResults, uniqueCardIds]);

  return { items, refetch };
}

export default function Marketplace() {
  const { address, isConnected } = useAccount();
  const { items: listings, refetch: refetchListings } = useAllListings();
  const { cards: ownedCards } = useOwnedCards();

  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [priceEth, setPriceEth] = useState("");

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: isApprovedForAll, refetch: refetchApproval } = useReadContract({
    ...CONTRACTS.cardNFT,
    functionName: "isApprovedForAll",
    args: address ? [address, ADDRESSES.marketplace] : undefined,
    query: { enabled: isConnected && !!address },
  });

  if (isSuccess) {
    setTimeout(() => {
      refetchListings();
      refetchApproval();
      setSelectedTokenId(null);
      setPriceEth("");
      reset();
    }, 1000);
  }

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect your wallet to use the marketplace.</p></div>;
  }

  const me = address?.toLowerCase() ?? "";
  const myListings = listings.filter((l) => l.seller.toLowerCase() === me);
  const otherListings = listings.filter((l) => l.seller.toLowerCase() !== me);

  const listedIds = new Set(listings.map((l) => l.tokenId.toString()));
  const unlistedOwned = ownedCards.filter((c) => !listedIds.has(c.tokenId.toString()));

  const txInProgress = isPending || isConfirming;

  const handleApproveAll = () => {
    writeContract({
      ...CONTRACTS.cardNFT,
      functionName: "setApprovalForAll",
      args: [ADDRESSES.marketplace, true],
    });
  };

  const handleList = () => {
    if (selectedTokenId === null || !priceEth) return;
    let priceWei: bigint;
    try { priceWei = parseEther(priceEth); } catch { return; }
    if (priceWei === 0n) return;
    writeContract({
      ...CONTRACTS.marketplace,
      functionName: "list",
      args: [selectedTokenId, priceWei],
    });
  };

  const handleBuy = (tokenId: bigint, priceWei: bigint) => {
    writeContract({
      ...CONTRACTS.marketplace,
      functionName: "buy",
      args: [tokenId],
      value: priceWei,
    });
  };

  const handleCancel = (tokenId: bigint) => {
    writeContract({
      ...CONTRACTS.marketplace,
      functionName: "cancel",
      args: [tokenId],
    });
  };

  return (
    <div className="page page-shell">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Escrow Trading</div>
          <h1 className="page-title">Marketplace</h1>
          <p className="page-copy">
            Browse active listings, buy cards from other players, or list spare cards from your collection.
          </p>
        </div>
        <ArcanaRibbon variant="yellow">{listings.length} Active Listings</ArcanaRibbon>
      </div>

      {txInProgress && (
        <p className="msg-info">
          {isPending ? "Confirm in wallet..." : "Confirming transaction..."}
        </p>
      )}
      {isSuccess && !txInProgress && (
        <p className="msg-success">Transaction confirmed.</p>
      )}
      {error && (
        <p className="msg-error">{error.message.slice(0, 160)}</p>
      )}

      <section>
        <div className="section-title">
          <h2>Listings</h2>
          <span className="msg-info">{otherListings.length} available</span>
        </div>
        {otherListings.length === 0 ? (
          <div className="soft-panel"><p className="msg-info">No active listings.</p></div>
        ) : (
          <div className="card-grid">
            {otherListings.map((l) => (
              <ListingCard
                key={l.tokenId.toString()}
                listing={l}
                actionLabel={`Buy ${formatEther(l.priceWei)} ETH`}
                onAction={() => handleBuy(l.tokenId, l.priceWei)}
                disabled={txInProgress}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-title">
          <h2>My Listings</h2>
          <span className="msg-info">{myListings.length} listed</span>
        </div>
        {myListings.length === 0 ? (
          <div className="soft-panel"><p className="msg-info">You have no active listings.</p></div>
        ) : (
          <div className="card-grid">
            {myListings.map((l) => (
              <ListingCard
                key={l.tokenId.toString()}
                listing={l}
                actionLabel={`Cancel (${formatEther(l.priceWei)} ETH)`}
                onAction={() => handleCancel(l.tokenId)}
                disabled={txInProgress}
              />
            ))}
          </div>
        )}
      </section>

      <section className="soft-panel">
        <div className="section-title">
          <h2>List a Card</h2>
          <span className="msg-info">{unlistedOwned.length} unlisted owned</span>
        </div>
      {!isApprovedForAll ? (
        <div className="market-form">
          <p className="msg-info">
            Approve the marketplace once. Listing transfers the card into escrow until sold or cancelled,
            so it can't be used in a deck while listed.
          </p>
          <ArcanaButton variant="blue" onClick={handleApproveAll} disabled={txInProgress}>
            {txInProgress ? "Working..." : "Approve Marketplace"}
          </ArcanaButton>
        </div>
      ) : unlistedOwned.length === 0 ? (
        <p className="msg-info">No unlisted cards in your collection.</p>
      ) : (
        <div className="market-form">
          <label className="field-label">Select card</label>
          <div className="pill-row">
            {unlistedOwned.map((c) => (
              <button
                key={c.tokenId.toString()}
                className={`btn-outline ${selectedTokenId === c.tokenId ? "selected" : ""}`}
                onClick={() => setSelectedTokenId(c.tokenId)}
              >
                #{c.tokenId.toString()} {c.name}
              </button>
            ))}
          </div>
          <label className="field-label">Price (ETH)</label>
          <input
            className="text-input"
            type="text"
            inputMode="decimal"
            value={priceEth}
            onChange={(e) => setPriceEth(e.target.value)}
            placeholder="0.01"
          />
          <ArcanaButton
            variant="blue"
            size="lg"
            onClick={handleList}
            disabled={selectedTokenId === null || !priceEth || txInProgress}
          >
            List Card
          </ArcanaButton>
        </div>
      )}
      </section>
    </div>
  );
}

function ListingCard({
  listing,
  actionLabel,
  onAction,
  disabled,
}: {
  listing: Listing;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
}) {
  return (
    <ArcanaPanel variant="slate" className="listing-card">
      <div className="listing-card-body">
        <CardImage
          cardId={listing.cardId}
          stats={listing.stats}
          alt={listing.name}
          className="card-media"
        />
        <strong>{listing.name}</strong>
        <ArcanaButton variant="blue" size="sm" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </ArcanaButton>
      </div>
    </ArcanaPanel>
  );
}
