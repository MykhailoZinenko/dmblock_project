import { useAccount } from "wagmi";
import { useOwnedCards } from "../hooks/useOwnedCards";

export default function Collection() {
  const { isConnected } = useAccount();
  const { cards, count, isLoading } = useOwnedCards();

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect your wallet to view your collection.</p></div>;
  }

  if (isLoading) {
    return <div className="page"><h1>Collection</h1><p className="msg-info">Loading cards...</p></div>;
  }

  if (count === 0) {
    return <div className="page"><h1>Collection</h1><p className="msg-info">You don't own any cards yet. Create a hero to receive your starter deck.</p></div>;
  }

  return (
    <div className="page">
      <h1>Collection <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>({count} cards)</span></h1>
      <div className="card-grid">
        {cards.map(({ tokenId, metadata }) => (
          <div key={tokenId.toString()} className="card" style={{ padding: "0.5rem", textAlign: "center" }}>
            {metadata?.image ? (
              <img
                src={metadata.image}
                alt={metadata.name ?? `Card #${tokenId}`}
                style={{ width: "100%", borderRadius: 4 }}
              />
            ) : (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                No image
              </div>
            )}
            <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
              {metadata?.name ?? `Card #${tokenId}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
