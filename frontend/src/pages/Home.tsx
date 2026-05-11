import { Link } from "react-router";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACTS, FACTIONS, ARCHETYPES, FACTION_COLORS } from "../contracts";

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
      <div className="page">
        <h1>Arcana Arena</h1>
        <p className="msg-info">Connect your wallet to begin.</p>
      </div>
    );
  }

  if (!hasHero) {
    return (
      <div className="page">
        <h1>Welcome, Prisoner</h1>
        <p style={{ marginBottom: "1rem" }}>You have no hero yet. Create one to receive your starter deck and enter the arena.</p>
        <Link to="/create"><button className="btn-large">Create Your Hero</button></Link>
      </div>
    );
  }

  const hero = heroData as { faction: number; archetype: number; attack: number; defense: number; spellPower: number; knowledge: number; level: number } | undefined;

  return (
    <div className="page">
      <h1>Welcome Back</h1>
      {hero && (
        <div className="card" style={{ maxWidth: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ color: FACTION_COLORS[hero.faction], fontWeight: 600 }}>{FACTIONS[hero.faction]}</span>
            <span className="msg-info">{ARCHETYPES[hero.archetype]}</span>
          </div>
          <div className="stat-row"><span className="stat-label">Level</span><span className="stat-value">{hero.level}</span></div>
          <div className="stat-row"><span className="stat-label">Attack</span><span className="stat-value">{hero.attack}</span></div>
          <div className="stat-row"><span className="stat-label">Defense</span><span className="stat-value">{hero.defense}</span></div>
          <div className="stat-row"><span className="stat-label">Spell Power</span><span className="stat-value">{hero.spellPower}</span></div>
          <div className="stat-row"><span className="stat-label">Knowledge</span><span className="stat-value">{hero.knowledge}</span></div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <Link to="/hero"><button>Hero Profile</button></Link>
            <Link to="/collection"><button className="btn-outline">Collection</button></Link>
          </div>
        </div>
      )}
    </div>
  );
}
