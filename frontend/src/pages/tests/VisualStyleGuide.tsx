import "../../styles/tokens.css";
import "../../styles/main.css";
import {
  ArcanaPanel,
  ArcanaButton,
  ArcanaIconButton,
  ArcanaRibbon,
  ArcanaTabs,
  ArcanaAvatar,
  ArcanaCard,
  ArcanaBar,
} from "../../ui/components/index";
import { useState } from "react";

export default function VisualStyleGuide() {
  const [activeTab, setActiveTab] = useState("heroes");
  const [barValue, setBarValue] = useState(65);

  const swatchStyle = (bg: string): React.CSSProperties => ({
    width: 80, height: 60, borderRadius: "var(--radius-sm)",
    border: "var(--border-thin) solid var(--color-surface)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    padding: "var(--space-1)", fontSize: "var(--text-xs)", color: "var(--color-text-dim)",
    background: bg,
  });

  const section: React.CSSProperties = { marginBottom: 48 };
  const heading: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", marginBottom: 16, color: "var(--color-gold)" };
  const row: React.CSSProperties = { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 16 };

  return (
    <div style={{ padding: 40, maxWidth: 1000, margin: "0 auto", height: "100vh", overflowY: "auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", marginBottom: 32, color: "var(--color-gold)" }}>
        Arcana Arena — Style Guide
      </h1>

      {/* Colors */}
      <div style={section}>
        <h2 style={heading}>Colors</h2>
        <div style={row}>
          <div style={swatchStyle("var(--color-ink)")}>ink</div>
          <div style={swatchStyle("var(--color-bg)")}>bg</div>
          <div style={swatchStyle("var(--color-surface)")}>surface</div>
          <div style={swatchStyle("var(--color-parchment)")}>parchment</div>
          <div style={swatchStyle("var(--color-gold)")}>gold</div>
          <div style={swatchStyle("var(--color-blue)")}>blue</div>
          <div style={swatchStyle("var(--color-red)")}>red</div>
          <div style={swatchStyle("var(--color-wood)")}>wood</div>
        </div>
      </div>

      {/* Panels */}
      <div style={section}>
        <h2 style={heading}>Panels</h2>
        <div style={row}>
          {(["parchment", "slate", "wood", "carved", "scroll"] as const).map((v) => (
            <div key={v} style={{ width: 180 }}>
              <ArcanaPanel variant={v}>
                <div style={{ padding: 16, textAlign: "center" }}>{v}</div>
              </ArcanaPanel>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div style={section}>
        <h2 style={heading}>Buttons</h2>
        <div style={row}>
          <ArcanaButton variant="blue" size="sm">Small Blue</ArcanaButton>
          <ArcanaButton variant="blue" size="md">Medium Blue</ArcanaButton>
          <ArcanaButton variant="blue" size="lg">Large Blue</ArcanaButton>
        </div>
        <div style={row}>
          <ArcanaButton variant="red" size="sm">Small Red</ArcanaButton>
          <ArcanaButton variant="red" size="md">Medium Red</ArcanaButton>
          <ArcanaButton variant="red" size="lg">Large Red</ArcanaButton>
        </div>
        <div style={row}>
          <ArcanaButton disabled>Disabled</ArcanaButton>
        </div>
      </div>

      {/* Icon Buttons */}
      <div style={section}>
        <h2 style={heading}>Icon Buttons</h2>
        <div style={row}>
          <ArcanaIconButton shape="round" variant="blue">⚔</ArcanaIconButton>
          <ArcanaIconButton shape="round" variant="red">🛡</ArcanaIconButton>
          <ArcanaIconButton shape="square" variant="blue">⚡</ArcanaIconButton>
          <ArcanaIconButton shape="square" variant="red">🔥</ArcanaIconButton>
          <ArcanaIconButton disabled>✕</ArcanaIconButton>
        </div>
      </div>

      {/* Ribbons */}
      <div style={section}>
        <h2 style={heading}>Ribbons</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
          <ArcanaRibbon variant="blue">Blue Ribbon</ArcanaRibbon>
          <ArcanaRibbon variant="red">Red Ribbon</ArcanaRibbon>
          <ArcanaRibbon variant="yellow">Yellow Ribbon</ArcanaRibbon>
        </div>
      </div>

      {/* Tabs */}
      <div style={section}>
        <h2 style={heading}>Tabs</h2>
        <ArcanaTabs
          tabs={[
            { name: "heroes", children: "Heroes", color: "blue" },
            { name: "cards", children: "Cards", color: "red" },
            { name: "decks", children: "Decks", color: "yellow" },
          ]}
          active={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
        />
        <div style={{ marginTop: 12, color: "var(--color-text-dim)" }}>Active: {activeTab}</div>
      </div>

      {/* Avatars */}
      <div style={section}>
        <h2 style={heading}>Avatars</h2>
        <div style={row}>
          {[1, 5, 10, 15, 20, 25].map((i) => (
            <ArcanaAvatar key={i} index={i} size="lg" />
          ))}
        </div>
        <div style={row}>
          {[1, 5, 10].map((i) => (
            <ArcanaAvatar key={i} index={i} size="sm" />
          ))}
        </div>
      </div>

      {/* Cards */}
      <div style={section}>
        <h2 style={heading}>Cards</h2>
        <div style={row}>
          <ArcanaCard name="Peasant" rarity="common" mana={1} attack={5} defense={3} hp={30} />
          <ArcanaCard name="Archer" rarity="rare" mana={4} attack={12} defense={8} hp={50} />
          <ArcanaCard name="Knight" rarity="epic" mana={7} attack={20} defense={18} hp={85} />
          <ArcanaCard name="Monastery" rarity="legendary" mana={8} defense={12} hp={90} />
        </div>
      </div>

      {/* Bars */}
      <div style={section}>
        <h2 style={heading}>Bars</h2>
        <div style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
          <ArcanaBar value={barValue} max={100} color="red">{barValue}/100 HP</ArcanaBar>
          <ArcanaBar value={45} max={100} color="blue">45/100 Mana</ArcanaBar>
          <ArcanaBar value={75} max={100} color="gold">75/100 XP</ArcanaBar>
          <div style={row}>
            <ArcanaButton size="sm" onClick={() => setBarValue(Math.max(0, barValue - 10))}>-10</ArcanaButton>
            <ArcanaButton size="sm" onClick={() => setBarValue(Math.min(100, barValue + 10))}>+10</ArcanaButton>
          </div>
        </div>
      </div>
    </div>
  );
}
