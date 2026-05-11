import { Link } from "react-router";
import { useAccount } from "wagmi";
import { useOwnedCards } from "../hooks/useOwnedCards";
import { ArcanaPanel, ArcanaButton, ArcanaRibbon } from "../ui/components/index";

export default function Collection() {
  const { isConnected } = useAccount();
  const { cards, count, isLoading } = useOwnedCards();

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect your wallet to view your collection.</p></div>;
  }

  if (isLoading) {
    return <div className="page"><ArcanaRibbon variant="blue">Collection</ArcanaRibbon><p className="msg-info" style={{ marginTop: "var(--space-4)" }}>Loading cards...</p></div>;
  }

  if (count === 0) {
    return (
      <div className="page">
        <ArcanaRibbon variant="blue">Collection</ArcanaRibbon>
        <p className="msg-info" style={{ marginTop: "var(--space-4)" }}>You don't own any cards yet.</p>
        <Link to="/create"><ArcanaButton variant="blue" size="md" style={{ marginTop: "var(--space-3)" }}>Create a Hero</ArcanaButton></Link>
      </div>
    );
  }

  return (
    <div className="page">
      <ArcanaRibbon variant="blue">Collection — {count} cards</ArcanaRibbon>
      <div className="card-grid" style={{ marginTop: "var(--space-5)" }}>
        {cards.map(({ tokenId, metadata }) => (
          <ArcanaPanel key={tokenId.toString()} variant="slate" style={{ overflow: "hidden" }}>
            <div style={{ padding: "var(--space-2)", textAlign: "center" }}>
              {metadata?.image ? (
                <object
                  data={metadata.image}
                  type="image/svg+xml"
                  style={{ width: "100%", borderRadius: "var(--radius-sm)", minHeight: 200 }}
                >
                  <p className="msg-info">Card image</p>
                </object>
              ) : (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-dim)" }}>
                  No image
                </div>
              )}
              <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--color-parchment)" }}>
                {metadata?.name ?? `Card #${tokenId}`}
              </p>
            </div>
          </ArcanaPanel>
        ))}
      </div>
    </div>
  );
}
