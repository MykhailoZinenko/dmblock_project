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
    <div className="page">
      <h1>Marketplace</h1>

      {txInProgress && (
        <p className="msg-info" style={{ marginTop: "0.5rem" }}>
          {isPending ? "Confirm in wallet..." : "Confirming transaction..."}
        </p>
      )}
      {isSuccess && !txInProgress && (
        <p className="msg-success" style={{ marginTop: "0.5rem" }}>Transaction confirmed.</p>
      )}
      {error && (
        <p className="msg-error" style={{ marginTop: "0.5rem" }}>{error.message.slice(0, 160)}</p>
      )}

      <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem", marginBottom: "0.75rem" }}>
        Listings <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>({otherListings.length})</span>
      </h2>
      {otherListings.length === 0 ? (
        <p className="msg-info">No active listings.</p>
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

      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem", marginBottom: "0.75rem" }}>
        My Listings <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>({myListings.length})</span>
      </h2>
      {myListings.length === 0 ? (
        <p className="msg-info">You have no active listings.</p>
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

      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem", marginBottom: "0.75rem" }}>List a Card</h2>
      {!isApprovedForAll ? (
        <div className="card" style={{ maxWidth: 480 }}>
          <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
            Approve the marketplace once to enable listings for any card you own.
          </p>
          <button onClick={handleApproveAll} disabled={txInProgress}>
            {txInProgress ? "Working..." : "Approve Marketplace"}
          </button>
        </div>
      ) : unlistedOwned.length === 0 ? (
        <p className="msg-info">No unlisted cards in your collection.</p>
      ) : (
        <div className="card" style={{ maxWidth: 480 }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Select card</p>
          <div className="btn-group" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
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
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Price (ETH)</p>
          <input
            type="text"
            inputMode="decimal"
            value={priceEth}
            onChange={(e) => setPriceEth(e.target.value)}
            placeholder="0.01"
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "0.75rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text)",
              fontSize: "0.95rem",
            }}
          />
          <button
            className="btn-large"
            onClick={handleList}
            disabled={selectedTokenId === null || !priceEth || txInProgress}
          >
            List Card
          </button>
        </div>
      )}
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
    <div className="card" style={{ padding: "0.5rem", textAlign: "center" }}>
      {listing.metadata?.image ? (
        <object
          data={listing.metadata.image}
          type="image/svg+xml"
          style={{ width: "100%", borderRadius: 4, minHeight: 200 }}
        >
          <p style={{ color: "var(--text-muted)" }}>Card image</p>
        </object>
      ) : (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
          No image
        </div>
      )}
      <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
        {listing.metadata?.name ?? `Card #${listing.tokenId.toString()}`}
      </p>
      <button onClick={onAction} disabled={disabled} style={{ marginTop: "0.5rem", width: "100%" }}>
        {actionLabel}
      </button>
    </div>
  );
}
