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
      <div className="page page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">On-chain card battler</div>
            <h1 className="page-title">Arcana Arena</h1>
            <p className="page-copy">Connect your wallet to manage heroes, build decks, browse the market, and enter the arena.</p>
          </div>
          <ArcanaRibbon variant="blue">Wallet Required</ArcanaRibbon>
        </div>
        <div className="surface-grid">
          {["Create a Hero", "Collect Cards", "Build Decks"].map((label) => (
            <div className="soft-panel" key={label}>
              <h2>{label}</h2>
              <p className="msg-info">Available after wallet connection.</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasHero) {
    return (
      <div className="page page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">New Account</div>
            <h1 className="page-title">Choose Your Hero</h1>
            <p className="page-copy">Create a hero to receive your starter deck and unlock the rest of Arcana Arena.</p>
          </div>
          <ArcanaRibbon variant="red">No Hero</ArcanaRibbon>
        </div>
        <Link to="/create"><ArcanaButton variant="blue" size="lg">Create Your Hero</ArcanaButton></Link>
      </div>
    );
  }

  const hero = heroData as { faction: number; archetype: number; attack: number; defense: number; spellPower: number; knowledge: number; level: number } | undefined;

  return (
    <div className="page page-shell">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Command Center</div>
          <h1 className="page-title">Welcome Back</h1>
          <p className="page-copy">Review your hero, tune your collection, and prepare decks for your next match.</p>
        </div>
        <ArcanaRibbon variant="blue">Ready</ArcanaRibbon>
      </div>
      {hero && (
        <ArcanaPanel variant="parchment" style={{ maxWidth: 520 }}>
          <div style={{ padding: "var(--space-4)", color: "var(--color-text-dark)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
              <span style={{ color: FACTION_COLORS[hero.faction], fontWeight: 600, fontFamily: "var(--font-display)", fontSize: "var(--text-lg)" }}>
                {FACTIONS[hero.faction]}
              </span>
              <span style={{ color: "var(--color-slate)" }}>{ARCHETYPES[hero.archetype]}</span>
            </div>

            <ArcanaBar value={hero.level} max={50} color="gold">Level {hero.level} / 50</ArcanaBar>

            <div className="stat-grid" style={{ marginTop: "var(--space-3)" }}>
              <div className="stat-tile"><span>Attack</span><strong>{hero.attack}</strong></div>
              <div className="stat-tile"><span>Defense</span><strong>{hero.defense}</strong></div>
              <div className="stat-tile"><span>Spell Power</span><strong>{hero.spellPower}</strong></div>
              <div className="stat-tile"><span>Knowledge</span><strong>{hero.knowledge}</strong></div>
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
