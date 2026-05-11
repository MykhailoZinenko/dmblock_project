import { Link } from "react-router";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACTS, FACTIONS, ARCHETYPES, FACTION_COLORS } from "../contracts";
import { ArcanaPanel, ArcanaButton, ArcanaRibbon, ArcanaBar } from "../ui/components/index";

export default function Home() {
  const { address, isConnected } = useAccount();

  const { data: heroBalance } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected },
  });

  const hasHero = heroBalance !== undefined && heroBalance > 0n;

  const { data: heroData } = useReadContract({
    ...CONTRACTS.heroNFT,
    functionName: "getHero",
    args: [0n],
    query: { enabled: hasHero },
  });

  if (!isConnected) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "var(--space-8)" }}>
        <h1>Arcana Arena</h1>
        <p className="msg-info" style={{ marginBottom: "var(--space-4)" }}>Connect your wallet to enter the arena.</p>
      </div>
    );
  }

  if (!hasHero) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "var(--space-8)" }}>
        <ArcanaRibbon variant="red">Welcome, Prisoner</ArcanaRibbon>
        <p style={{ margin: "var(--space-5) 0", color: "var(--color-text-dim)" }}>
          You have no hero yet. Create one to receive your starter deck and enter the arena.
        </p>
        <Link to="/create"><ArcanaButton variant="blue" size="lg">Create Your Hero</ArcanaButton></Link>
      </div>
    );
  }

  const hero = heroData as { faction: number; archetype: number; attack: number; defense: number; spellPower: number; knowledge: number; level: number } | undefined;

  return (
    <div className="page">
      <ArcanaRibbon variant="blue">Welcome Back</ArcanaRibbon>
      {hero && (
        <ArcanaPanel variant="parchment" style={{ maxWidth: 380, marginTop: "var(--space-5)" }}>
          <div style={{ padding: "var(--space-4)", color: "var(--color-text-dark)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
              <span style={{ color: FACTION_COLORS[hero.faction], fontWeight: 600, fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>
                {FACTIONS[hero.faction]}
              </span>
              <span style={{ color: "var(--color-slate)" }}>{ARCHETYPES[hero.archetype]}</span>
            </div>

            <ArcanaBar value={hero.level} max={50} color="gold">Level {hero.level} / 50</ArcanaBar>

            <div style={{ marginTop: "var(--space-3)" }}>
              <div className="stat-row"><span style={{ color: "var(--color-slate)" }}>Attack</span><span style={{ fontWeight: 700 }}>{hero.attack}</span></div>
              <div className="stat-row"><span style={{ color: "var(--color-slate)" }}>Defense</span><span style={{ fontWeight: 700 }}>{hero.defense}</span></div>
              <div className="stat-row"><span style={{ color: "var(--color-slate)" }}>Spell Power</span><span style={{ fontWeight: 700 }}>{hero.spellPower}</span></div>
              <div className="stat-row"><span style={{ color: "var(--color-slate)" }}>Knowledge</span><span style={{ fontWeight: 700 }}>{hero.knowledge}</span></div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <Link to="/hero"><ArcanaButton variant="blue" size="sm">Hero Profile</ArcanaButton></Link>
              <Link to="/collection"><ArcanaButton variant="red" size="sm">Collection</ArcanaButton></Link>
            </div>
          </div>
        </ArcanaPanel>
      )}
    </div>
  );
}
