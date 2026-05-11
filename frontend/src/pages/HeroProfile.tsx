import { useState } from "react";
import { Link } from "react-router";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useHero } from "../hooks/useHero";
import { CONTRACTS, FACTIONS, ARCHETYPES, FACTION_COLORS, TRAIT_NAMES } from "../contracts";
import { ArcanaPanel, ArcanaButton, ArcanaRibbon, ArcanaBar } from "../ui/components/index";

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
        <ArcanaRibbon variant="red">No Hero</ArcanaRibbon>
        <p style={{ margin: "var(--space-4) 0", color: "var(--color-text-dim)" }}>You haven't created a hero yet.</p>
        <Link to="/create"><ArcanaButton variant="blue">Create Hero</ArcanaButton></Link>
      </div>
    );
  }

  if (isLoading || !hero) {
    return <div className="page"><p className="msg-info">Loading hero...</p></div>;
  }

  const canLevelUp = hero.level < 50;
  const dark = "var(--color-text-dark)";

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
      <ArcanaRibbon variant="blue">
        <span style={{ color: FACTION_COLORS[hero.faction] }}>{FACTIONS[hero.faction]}</span>
        {" "}
        {ARCHETYPES[hero.archetype]}
      </ArcanaRibbon>

      <ArcanaPanel variant="parchment" style={{ maxWidth: 440, marginTop: "var(--space-5)" }}>
        <div style={{ padding: "var(--space-4)", color: dark }}>
          <ArcanaBar value={hero.level} max={50} color="gold">Level {hero.level} / 50</ArcanaBar>

          <div style={{ marginTop: "var(--space-3)" }}>
            <div className="stat-row"><span style={{ color: "var(--color-slate)" }}>Attack</span><span style={{ fontWeight: 700 }}>{hero.attack}</span></div>
            <div className="stat-row"><span style={{ color: "var(--color-slate)" }}>Defense</span><span style={{ fontWeight: 700 }}>{hero.defense}</span></div>
            <div className="stat-row"><span style={{ color: "var(--color-slate)" }}>Spell Power</span><span style={{ fontWeight: 700 }}>{hero.spellPower}</span></div>
            <div className="stat-row"><span style={{ color: "var(--color-slate)" }}>Knowledge</span><span style={{ fontWeight: 700 }}>{hero.knowledge}</span></div>
          </div>

          {traits && traits[0].length > 0 && (
            <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-parchment-dark)", paddingTop: "var(--space-3)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>Traits</div>
              {traits[0].map((traitId: number, i: number) => (
                <div className="stat-row" key={traitId}>
                  <span style={{ color: "var(--color-slate)" }}>{TRAIT_NAMES[traitId] ?? `Trait ${traitId}`}</span>
                  <span style={{ fontWeight: 700 }}>Lv {traits[1][i]}</span>
                </div>
              ))}
            </div>
          )}

          {canLevelUp && traitOptions && (
            <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-parchment-dark)", paddingTop: "var(--space-3)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Level Up</div>

              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-slate)", marginBottom: "var(--space-2)" }}>Choose +1 stat:</div>
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
                {STAT_LABELS.map((label, i) => (
                  <ArcanaButton
                    key={i}
                    variant={selectedStat === i ? "blue" : "red"}
                    size="sm"
                    onClick={() => setSelectedStat(i)}
                  >
                    {label}
                  </ArcanaButton>
                ))}
              </div>

              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-slate)", marginBottom: "var(--space-2)" }}>Choose trait:</div>
              <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                {[traitOptions[0], traitOptions[1]].map((traitId) => (
                  <ArcanaButton
                    key={traitId}
                    variant={selectedTrait === traitId ? "blue" : "red"}
                    size="sm"
                    onClick={() => setSelectedTrait(traitId)}
                  >
                    {TRAIT_NAMES[traitId] ?? `Trait ${traitId}`}
                  </ArcanaButton>
                ))}
              </div>

              <ArcanaButton
                variant="blue"
                size="lg"
                onClick={handleLevelUp}
                disabled={selectedStat === null || selectedTrait === null || isPending || isConfirming}
              >
                {isPending ? "Confirm in wallet..." : isConfirming ? "Leveling up..." : "Level Up"}
              </ArcanaButton>

              {isSuccess && <p style={{ marginTop: "var(--space-2)", color: "#2e7d32" }}>Leveled up!</p>}
              {error && <p style={{ marginTop: "var(--space-2)", color: "var(--color-red-bright)" }}>{error.message.slice(0, 120)}</p>}
            </div>
          )}
        </div>
      </ArcanaPanel>
    </div>
  );
}
