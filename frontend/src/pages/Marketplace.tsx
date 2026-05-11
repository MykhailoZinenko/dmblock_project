import { useState } from "react";
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
import { ArcanaButton, ArcanaPanel, ArcanaRibbon } from "../ui/components/index";

const ZERO = "0x0000000000000000000000000000000000000000";

type Listing = {
  tokenId: bigint;
  seller: string;
  priceWei: bigint;
  metadata: { name?: string; image?: string } | null;
};

function useAllListings() {
  const { data: totalSupply } = useReadContract({
    ...CONTRACTS.cardNFT,
    functionName: "totalSupply",
  });
  const total = Number(totalSupply ?? 0n);
  const ids: bigint[] = [];
  for (let i = 0; i < total; i++) ids.push(BigInt(i));

  const { data: listings, refetch } = useReadContracts({
    contracts: ids.map((id) => ({
      ...CONTRACTS.marketplace,
      functionName: "getListing" as const,
      args: [id],
    })),
    query: { enabled: total > 0 },
  });

  const active = ids
    .map((id, i) => {
      const r = listings?.[i];
      if (r?.status !== "success") return null;
      const l = r.result as { seller: string; priceWei: bigint };
      if (l.seller.toLowerCase() === ZERO) return null;
      return { tokenId: id, seller: l.seller, priceWei: l.priceWei };
    })
    .filter((x): x is { tokenId: bigint; seller: string; priceWei: bigint } => x !== null);

  const { data: tokenURIs } = useReadContracts({
    contracts: active.map((l) => ({
      ...CONTRACTS.cardNFT,
      functionName: "tokenURI" as const,
      args: [l.tokenId],
    })),
    query: { enabled: active.length > 0 },
  });

  const items: Listing[] = active.map((l, i) => {
    const uri = tokenURIs?.[i];
    let metadata: { name?: string; image?: string } | null = null;
    if (uri?.status === "success" && typeof uri.result === "string") {
      try {
        metadata = JSON.parse(atob(uri.result.replace("data:application/json;base64,", "")));
      } catch { /* ignore */ }
    }
    return { ...l, metadata };
  });

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
                #{c.tokenId.toString()} {c.metadata?.name ?? ""}
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
        {listing.metadata?.image ? (
          <object data={listing.metadata.image} type="image/svg+xml" className="card-media">
            <p className="msg-info">Card image</p>
          </object>
        ) : (
          <div className="card-media" style={{ display: "grid", placeItems: "center" }}>
            <span className="msg-info">No image</span>
          </div>
        )}
        <strong>{listing.metadata?.name ?? `Card #${listing.tokenId.toString()}`}</strong>
        <ArcanaButton variant="blue" size="sm" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </ArcanaButton>
      </div>
    </ArcanaPanel>
  );
}
