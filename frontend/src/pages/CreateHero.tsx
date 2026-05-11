import { useState } from "react";
import { useNavigate } from "react-router";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, FACTIONS, ARCHETYPES, FACTION_COLORS, ARCHETYPE_BASE_STATS } from "../contracts";
import { ArcanaPanel, ArcanaButton, ArcanaRibbon } from "../ui/components/index";

const FACTION_DESCRIPTIONS: Record<number, string> = {
  0: "Noble knights and defenders",
  1: "Demons and fire cultists",
  2: "Undead and necromancers",
  3: "Shadow mages and rogues",
};

const ARCHETYPE_DESCRIPTIONS: Record<number, string> = {
  0: "High attack, min 12 units",
  1: "High spell power, min 12 spells",
  2: "Balanced, flexible deck",
  3: "High defense, min 12 units",
};

export default function CreateHero() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const [faction, setFaction] = useState<number | null>(null);
  const [archetype, setArchetype] = useState<number | null>(null);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) {
    setTimeout(() => navigate("/hero"), 1500);
  }

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect your wallet first.</p></div>;
  }

  const handleCreate = () => {
    if (faction === null || archetype === null) return;
    writeContract({
      ...CONTRACTS.heroNFT,
      functionName: "createHero",
      args: [faction, archetype],
    });
  };

  return (
    <div className="page page-shell">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Hero Foundry</div>
          <h1 className="page-title">Create Your Hero</h1>
          <p className="page-copy">Pick a faction and archetype. Your choice sets the opening stat profile for your account.</p>
        </div>
        <ArcanaRibbon variant="yellow">New Hero</ArcanaRibbon>
      </div>

      <section>
      <div className="section-title"><h2>Choose Faction</h2></div>
      <div className="choice-grid">
        {FACTIONS.map((name, i) => (
          <ArcanaPanel
            key={i}
            variant={faction === i ? "carved" : "slate"}
            className="choice-card"
            style={{
              cursor: "pointer",
              outline: faction === i ? `2px solid ${FACTION_COLORS[i]}` : "none",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div className="choice-card-content" style={{ textAlign: "center" }} onClick={() => setFaction(i)}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: FACTION_COLORS[i] }}>{name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-dim)", marginTop: "var(--space-1)" }}>{FACTION_DESCRIPTIONS[i]}</div>
            </div>
          </ArcanaPanel>
        ))}
      </div>
      </section>

      <section>
      <div className="section-title"><h2>Choose Archetype</h2></div>
      <div className="choice-grid">
        {ARCHETYPES.map((name, i) => (
          <ArcanaPanel
            key={i}
            variant={archetype === i ? "carved" : "slate"}
            className="choice-card"
            style={{
              cursor: "pointer",
              outline: archetype === i ? "2px solid var(--color-gold)" : "none",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div className="choice-card-content" onClick={() => setArchetype(i)}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-parchment)", textAlign: "center" }}>{name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-dim)", textAlign: "center", marginBottom: "var(--space-2)" }}>{ARCHETYPE_DESCRIPTIONS[i]}</div>
              {Object.entries(ARCHETYPE_BASE_STATS[i]).map(([key, val]) => (
                <div className="stat-row" key={key}>
                  <span className="stat-label">{key}</span>
                  <span className="stat-value">{val}</span>
                </div>
              ))}
            </div>
          </ArcanaPanel>
        ))}
      </div>
      </section>

      <div>
        <ArcanaButton
          variant="blue"
          size="lg"
          onClick={handleCreate}
          disabled={faction === null || archetype === null || isPending || isConfirming}
        >
          {isPending ? "Confirm in wallet..." : isConfirming ? "Creating hero..." : "Create Hero"}
        </ArcanaButton>
      </div>

      {isSuccess && <p className="msg-success" style={{ marginTop: "var(--space-3)" }}>Hero created! Redirecting...</p>}
      {error && <p className="msg-error" style={{ marginTop: "var(--space-3)" }}>{error.message.slice(0, 120)}</p>}
    </div>
  );
}
