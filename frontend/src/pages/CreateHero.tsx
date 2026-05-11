import { useState } from "react";
import { useNavigate } from "react-router";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS, FACTIONS, ARCHETYPES, FACTION_COLORS, ARCHETYPE_BASE_STATS } from "../contracts";

export default function CreateHero() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const [faction, setFaction] = useState<number | null>(null);
  const [archetype, setArchetype] = useState<number | null>(null);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

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
    <div className="page">
      <h1>Create Your Hero</h1>

      <h2 style={{ fontSize: "1rem", margin: "1.5rem 0 0.75rem", color: "var(--text-muted)" }}>Choose Faction</h2>
      <div className="btn-group">
        {FACTIONS.map((name, i) => (
          <button
            key={i}
            className={`btn-outline btn-large ${faction === i ? "selected" : ""}`}
            style={faction === i ? { borderColor: FACTION_COLORS[i], background: FACTION_COLORS[i] } : {}}
            onClick={() => setFaction(i)}
          >
            {name}
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: "1rem", margin: "1.5rem 0 0.75rem", color: "var(--text-muted)" }}>Choose Archetype</h2>
      <div className="btn-group" style={{ marginBottom: "1rem" }}>
        {ARCHETYPES.map((name, i) => (
          <button
            key={i}
            className={`btn-outline btn-large ${archetype === i ? "selected" : ""}`}
            onClick={() => setArchetype(i)}
          >
            {name}
          </button>
        ))}
      </div>

      {archetype !== null && (
        <div className="card" style={{ maxWidth: 280, marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Base Stats</p>
          {Object.entries(ARCHETYPE_BASE_STATS[archetype]).map(([key, val]) => (
            <div className="stat-row" key={key}>
              <span className="stat-label">{key}</span>
              <span className="stat-value">{val}</span>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn-large"
        onClick={handleCreate}
        disabled={faction === null || archetype === null || isPending || isConfirming}
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Creating hero..." : "Create Hero"}
      </button>

      {isSuccess && <p className="msg-success" style={{ marginTop: "0.75rem" }}>Hero created! Redirecting...</p>}
      {error && <p className="msg-error" style={{ marginTop: "0.75rem" }}>{error.message.slice(0, 120)}</p>}
    </div>
  );
}
