import { Link } from "react-router";
import { useAccount } from "wagmi";
import { useOwnedCards } from "../hooks/useOwnedCards";
import { CardImage } from "../ui/components/CardImage";
import { ArcanaPanel, ArcanaButton, ArcanaRibbon } from "../ui/components/index";

export default function Collection() {
  const { isConnected } = useAccount();
  const { cards, count, isLoading } = useOwnedCards();

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect your wallet to view your collection.</p></div>;
  }

  if (isLoading) {
    return <div className="page page-shell"><ArcanaRibbon variant="blue">Collection</ArcanaRibbon><p className="msg-info">Loading cards...</p></div>;
  }

  if (count === 0) {
    return (
      <div className="page page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Card Vault</div>
            <h1 className="page-title">Collection</h1>
            <p className="page-copy">Cards you own will appear here after hero creation or marketplace purchases.</p>
          </div>
          <ArcanaRibbon variant="blue">0 Cards</ArcanaRibbon>
        </div>
        <p className="msg-info">You don't own any cards yet.</p>
        <Link to="/create"><ArcanaButton variant="blue" size="md" style={{ marginTop: "var(--space-3)" }}>Create a Hero</ArcanaButton></Link>
      </div>
    );
  }

  return (
    <div className="page page-shell">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Card Vault</div>
          <h1 className="page-title">Collection</h1>
          <p className="page-copy">Inspect owned cards and pick the pieces that belong in your next deck.</p>
        </div>
        <ArcanaRibbon variant="blue">{count} Cards</ArcanaRibbon>
      </div>
      <div className="card-grid">
        {cards.map((card) => (
          <ArcanaPanel key={card.tokenId.toString()} variant="slate" style={{ overflow: "hidden" }}>
            <div style={{ padding: "var(--space-2)", textAlign: "center" }}>
              <CardImage
                cardId={card.cardId}
                stats={card}
                alt={card.name}
                style={{ borderRadius: "var(--radius-sm)" }}
              />
              <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--color-parchment)" }}>
                {card.name}
              </p>
            </div>
          </ArcanaPanel>
        ))}
      </div>
    </div>
  );
}
