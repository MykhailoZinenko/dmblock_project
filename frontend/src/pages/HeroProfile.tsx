import { useState } from "react";
import { Link } from "react-router";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useHero } from "../hooks/useHero";
import { CONTRACTS, FACTIONS, ARCHETYPES, FACTION_COLORS, TRAIT_NAMES } from "../contracts";
import { ArcanaPanel, ArcanaButton, ArcanaRibbon, ArcanaBar } from "../ui/components/index";

const STAT_LABELS = ["Attack", "Defense", "Spell Power", "Knowledge"];

export default function HeroProfile() {
  const { isConnected } = useAccount();
  const { hero, heroId, hasHero, traits, traitOptions, refetchAll, isLoading } = useHero();
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

  const xpNeeded = hero.level * 100;
  const canLevelUp = hero.level < 50 && hero.xp >= xpNeeded;
  const dark = "var(--color-text-dark)";

  const handleLevelUp = () => {
    if (selectedStat === null || selectedTrait === null || heroId === undefined) return;
    writeContract({
      ...CONTRACTS.heroNFT,
      functionName: "levelUp",
      args: [heroId, selectedStat, selectedTrait],
    });
  };

  return (
    <div className="page page-shell">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Hero Profile</div>
          <h1 className="page-title">
            <span style={{ color: FACTION_COLORS[hero.faction] }}>{FACTIONS[hero.faction]}</span>
            {" "}
            {ARCHETYPES[hero.archetype]}
          </h1>
          <p className="page-copy">Spend level-ups, track traits, and inspect your hero's battle stats.</p>
        </div>
        <ArcanaRibbon variant="blue">Level {hero.level}</ArcanaRibbon>
      </div>

      <ArcanaPanel variant="parchment" style={{ maxWidth: 620 }}>
        <div style={{ padding: "var(--space-4)", color: dark }}>
          <ArcanaBar value={hero.level} max={50} color="blue">Level {hero.level} / 50</ArcanaBar>
          <div style={{ marginTop: "var(--space-2)" }}>
            <ArcanaBar value={hero.xp} max={xpNeeded || 100} color={canLevelUp ? 'green' as any : 'blue'}>
              XP: {hero.xp} / {xpNeeded} {canLevelUp && '— Ready to level up!'}
            </ArcanaBar>
          </div>

          <div className="stat-grid" style={{ marginTop: "var(--space-3)" }}>
            <div className="stat-tile"><span>Attack</span><strong>{hero.attack}</strong></div>
            <div className="stat-tile"><span>Defense</span><strong>{hero.defense}</strong></div>
            <div className="stat-tile"><span>Spell Power</span><strong>{hero.spellPower}</strong></div>
            <div className="stat-tile"><span>Knowledge</span><strong>{hero.knowledge}</strong></div>
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
