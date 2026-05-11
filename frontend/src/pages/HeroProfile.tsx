import { useState } from "react";
import { Link } from "react-router";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useHero } from "../hooks/useHero";
import { CONTRACTS, FACTIONS, ARCHETYPES, FACTION_COLORS, TRAIT_NAMES } from "../contracts";

const STAT_LABELS = ["Attack", "Defense", "Spell Power", "Knowledge"];

export default function HeroProfile() {
  const { isConnected } = useAccount();
  const { hero, hasHero, traits, traitOptions, refetchAll, isLoading } = useHero();
  const [selectedStat, setSelectedStat] = useState<number | null>(null);
  const [selectedTrait, setSelectedTrait] = useState<number | null>(null);

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) {
    setTimeout(() => {
      refetchAll();
      setSelectedStat(null);
      setSelectedTrait(null);
      reset();
    }, 1000);
  }

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect your wallet.</p></div>;
  }

  if (!hasHero) {
    return (
      <div className="page">
        <h1>No Hero</h1>
        <p style={{ marginBottom: "1rem" }}>You haven't created a hero yet.</p>
        <Link to="/create"><button>Create Hero</button></Link>
      </div>
    );
  }

  if (isLoading || !hero) {
    return <div className="page"><p className="msg-info">Loading hero...</p></div>;
  }

  const canLevelUp = hero.level < 50;

  const handleLevelUp = () => {
    if (selectedStat === null || selectedTrait === null) return;
    writeContract({
      ...CONTRACTS.heroNFT,
      functionName: "levelUp",
      args: [0n, selectedStat, selectedTrait],
    });
  };

  return (
    <div className="page">
      <h1>
        <span style={{ color: FACTION_COLORS[hero.faction] }}>{FACTIONS[hero.faction]}</span>
        {" "}
        {ARCHETYPES[hero.archetype]}
      </h1>

      <div className="card" style={{ maxWidth: 360, marginBottom: "1.5rem" }}>
        <div className="stat-row"><span className="stat-label">Level</span><span className="stat-value">{hero.level} / 50</span></div>
        <div className="stat-row"><span className="stat-label">Attack</span><span className="stat-value">{hero.attack}</span></div>
        <div className="stat-row"><span className="stat-label">Defense</span><span className="stat-value">{hero.defense}</span></div>
        <div className="stat-row"><span className="stat-label">Spell Power</span><span className="stat-value">{hero.spellPower}</span></div>
        <div className="stat-row"><span className="stat-label">Knowledge</span><span className="stat-value">{hero.knowledge}</span></div>
      </div>

      {traits && traits[0].length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Traits</h2>
          <div className="card" style={{ maxWidth: 360, marginBottom: "1.5rem" }}>
            {traits[0].map((traitId: number, i: number) => (
              <div className="stat-row" key={traitId}>
                <span className="stat-label">{TRAIT_NAMES[traitId] ?? `Trait ${traitId}`}</span>
                <span className="stat-value">Lv {traits[1][i]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {canLevelUp && traitOptions && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Level Up</h2>
          <div className="card" style={{ maxWidth: 400 }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Choose +1 stat:</p>
            <div className="btn-group" style={{ marginBottom: "1rem" }}>
              {STAT_LABELS.map((label, i) => (
                <button
                  key={i}
                  className={`btn-outline ${selectedStat === i ? "selected" : ""}`}
                  onClick={() => setSelectedStat(i)}
                >
                  {label}
                </button>
              ))}
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Choose trait:</p>
            <div className="btn-group" style={{ marginBottom: "1rem" }}>
              {[traitOptions[0], traitOptions[1]].map((traitId) => (
                <button
                  key={traitId}
                  className={`btn-outline ${selectedTrait === traitId ? "selected" : ""}`}
                  onClick={() => setSelectedTrait(traitId)}
                >
                  {TRAIT_NAMES[traitId] ?? `Trait ${traitId}`}
                </button>
              ))}
            </div>

            <button
              className="btn-large"
              onClick={handleLevelUp}
              disabled={selectedStat === null || selectedTrait === null || isPending || isConfirming}
            >
              {isPending ? "Confirm in wallet..." : isConfirming ? "Leveling up..." : "Level Up"}
            </button>

            {isSuccess && <p className="msg-success" style={{ marginTop: "0.5rem" }}>Leveled up!</p>}
            {error && <p className="msg-error" style={{ marginTop: "0.5rem" }}>{error.message.slice(0, 120)}</p>}
          </div>
        </>
      )}
    </div>
  );
}
