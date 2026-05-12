import { useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { cardRegistry } from '../game/cardRegistry';
import { CardType, Faction, Rarity } from '../game/types';
import type { CardDefinition } from '../game/types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FACTION_COLORS: Record<Faction, string> = {
  [Faction.CASTLE]:    '#6888c8',
  [Faction.INFERNO]:   '#d45a3a',
  [Faction.NECROPOLIS]:'#8b5ec0',
  [Faction.DUNGEON]:   '#3a9e8f',
};

const FACTION_LABELS: Record<Faction, string> = {
  [Faction.CASTLE]:    'Castle',
  [Faction.INFERNO]:   'Inferno',
  [Faction.NECROPOLIS]:'Necropolis',
  [Faction.DUNGEON]:   'Dungeon',
};

const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.COMMON]:     '#8a8a8a',
  [Rarity.RARE]:       '#5b8dd9',
  [Rarity.EPIC]:       '#a855f7',
  [Rarity.LEGENDARY]:  '#ddb36d',
};

const RARITY_GLOWS: Record<Rarity, string> = {
  [Rarity.COMMON]:     'none',
  [Rarity.RARE]:       '0 0 8px rgba(91,141,217,0.4)',
  [Rarity.EPIC]:       '0 0 10px rgba(168,85,247,0.45)',
  [Rarity.LEGENDARY]:  '0 0 14px rgba(221,179,109,0.55)',
};

const CARD_W = 110;
const CARD_H = 140;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CardPickerProps {
  currentMana: number;
  onCardSelect: (cardId: number) => void;
  selectedCardId: number | null;
  onCancel: () => void;
  disabled: boolean;
}

/* ------------------------------------------------------------------ */
/*  Sub-component: single card thumbnail                               */
/* ------------------------------------------------------------------ */

function CardThumb({
  card,
  affordable,
  selected,
  disabled,
  index,
  total,
  onClick,
}: {
  card: CardDefinition;
  affordable: boolean;
  selected: boolean;
  disabled: boolean;
  index: number;
  total: number;
  onClick: () => void;
}) {
  const interactable = affordable && !disabled;
  const factionColor = FACTION_COLORS[card.faction];
  const rarityColor = RARITY_COLORS[card.rarity];
  const rarityGlow = RARITY_GLOWS[card.rarity];
  const isSpell = card.cardType === CardType.SPELL;

  // Fan tilt: cards splay outward from center
  const center = (total - 1) / 2;
  const offset = index - center;
  const tiltDeg = offset * 1.2;
  const yShift = Math.abs(offset) * 2;

  const wrapper: CSSProperties = {
    position: 'relative',
    width: `${CARD_W}px`,
    height: `${CARD_H}px`,
    flexShrink: 0,
    marginLeft: index === 0 ? 0 : '-12px',
    transform: `rotate(${tiltDeg}deg) translateY(${yShift}px)`,
    transition: 'transform var(--duration-normal, 200ms) var(--ease-out, ease-out), box-shadow var(--duration-normal, 200ms)',
    cursor: interactable ? 'pointer' : 'default',
    opacity: disabled ? 0.5 : affordable ? 1 : 0.45,
    filter: affordable || disabled ? 'none' : 'grayscale(0.7)',
    zIndex: selected ? 10 : 1,
  };

  const cardBody: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: 'var(--radius-md, 8px)',
    border: `2px solid ${selected ? '#fff' : rarityColor}`,
    boxShadow: selected
      ? `0 0 16px rgba(255,255,255,0.6), ${rarityGlow}`
      : rarityGlow,
    background: `linear-gradient(170deg, #1e2230 0%, #161a26 100%)`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'var(--font-display, "Patrick Hand", cursive)',
    position: 'relative',
    boxSizing: 'border-box',
  };

  // Faction color strip at top
  const factionStrip: CSSProperties = {
    height: '3px',
    background: factionColor,
    flexShrink: 0,
  };

  // Mana badge
  const manaBadge: CSSProperties = {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'rgba(100,160,255,0.25)',
    border: '1px solid rgba(140,195,196,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    color: '#8CC3C4',
    lineHeight: 1,
  };

  // Type badge
  const typeBadge: CSSProperties = {
    position: 'absolute',
    top: '6px',
    left: '6px',
    fontSize: '9px',
    letterSpacing: '0.5px',
    fontWeight: 700,
    color: isSpell ? '#c9a0ff' : '#b0c8b0',
    background: isSpell ? 'rgba(168,85,247,0.15)' : 'rgba(100,160,100,0.15)',
    border: `1px solid ${isSpell ? 'rgba(168,85,247,0.3)' : 'rgba(100,160,100,0.3)'}`,
    borderRadius: '3px',
    padding: '1px 4px',
    textTransform: 'uppercase',
  };

  // Name area
  const nameArea: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '28px 6px 4px',
    gap: '2px',
  };

  const nameText: CSSProperties = {
    fontSize: '14px',
    color: 'var(--color-text, #E1D4BD)',
    textAlign: 'center',
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  };

  // Faction label
  const factionLabel: CSSProperties = {
    fontSize: '10px',
    color: factionColor,
    opacity: 0.8,
    textAlign: 'center',
  };

  // Stats row at bottom
  const statsRow: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    padding: '4px 6px 6px',
    fontSize: '11px',
    color: 'var(--color-text-dim, #9B9FA9)',
    flexWrap: 'wrap',
  };

  const statPill: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1px',
  };

  // Build stats depending on card type
  let stats: { icon: string; val: number | string }[] = [];
  if (isSpell) {
    if (card.spellPower > 0)   stats.push({ icon: '✦', val: card.spellPower });
    if (card.duration > 0)     stats.push({ icon: '⏱', val: card.duration });
    if (card.successChance > 0) stats.push({ icon: '%', val: card.successChance });
  } else {
    stats.push({ icon: '⚔', val: card.attack });
    stats.push({ icon: '♥', val: card.hp });
    stats.push({ icon: '🛡', val: card.defense });
  }

  return (
    <div
      style={wrapper}
      onClick={interactable ? onClick : undefined}
      onMouseEnter={(e) => {
        if (!interactable) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = `rotate(0deg) translateY(-18px) scale(1.12)`;
        el.style.zIndex = '20';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = `rotate(${tiltDeg}deg) translateY(${yShift}px)`;
        el.style.zIndex = selected ? '10' : '1';
      }}
    >
      <div style={cardBody}>
        <div style={factionStrip} />
        <div style={manaBadge}>
          <span style={{ marginRight: '1px', fontSize: '10px' }}>⬡</span>
          {card.manaCost}
        </div>
        <div style={typeBadge}>{isSpell ? 'SPELL' : 'UNIT'}</div>
        <div style={nameArea}>
          <div style={nameText}>{card.name}</div>
          <div style={factionLabel}>{FACTION_LABELS[card.faction]}</div>
        </div>
        {stats.length > 0 && (
          <div style={statsRow}>
            {stats.map((s, i) => (
              <span key={i} style={statPill}>
                <span style={{ fontSize: '10px' }}>{s.icon}</span>
                {s.val}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Divider between units and spells                                   */
/* ------------------------------------------------------------------ */

function SectionDivider() {
  return (
    <div
      style={{
        width: '2px',
        alignSelf: 'stretch',
        margin: '8px 14px',
        background: 'linear-gradient(180deg, transparent, rgba(221,179,109,0.4), transparent)',
        flexShrink: 0,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CardPicker({
  currentMana,
  onCardSelect,
  selectedCardId,
  onCancel,
  disabled,
}: CardPickerProps) {
  // ESC to cancel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCardId !== null) {
        onCancel();
      }
    },
    [selectedCardId, onCancel],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Split cards into units and spells
  const units = cardRegistry.filter((c) => c.cardType === CardType.UNIT);
  const spells = cardRegistry.filter((c) => c.cardType === CardType.SPELL);

  // Outer container — fixed at bottom, horizontal scroll
  const container: CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: disabled ? 'none' : 'auto',
  };

  // Backdrop gradient
  const backdrop: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    background: 'linear-gradient(0deg, rgba(10,10,18,0.92) 0%, rgba(10,10,18,0.6) 70%, transparent 100%)',
    pointerEvents: 'none',
  };

  // Inner scrollable row
  const scrollRow: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    overflowX: 'auto',
    overflowY: 'visible',
    padding: '24px 24px 14px',
    maxWidth: '100vw',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(221,179,109,0.3) transparent',
  };

  // Cancel button
  const cancelBtn: CSSProperties = {
    position: 'absolute',
    top: '6px',
    right: '18px',
    background: 'rgba(187,97,100,0.2)',
    border: '1px solid rgba(187,97,100,0.5)',
    borderRadius: 'var(--radius-sm, 4px)',
    color: '#BB6164',
    fontFamily: 'var(--font-display, "Patrick Hand", cursive)',
    fontSize: '12px',
    padding: '3px 12px',
    cursor: 'pointer',
    display: selectedCardId !== null ? 'block' : 'none',
    zIndex: 2,
  };

  // Mana display
  const manaDisplay: CSSProperties = {
    position: 'absolute',
    top: '6px',
    left: '18px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: 'var(--font-display, "Patrick Hand", cursive)',
    fontSize: '14px',
    color: '#8CC3C4',
    zIndex: 2,
  };

  return (
    <div style={container}>
      <div style={backdrop} />

      <div style={manaDisplay}>
        <span style={{ fontSize: '16px' }}>⬡</span>
        <span>{currentMana} Mana</span>
      </div>

      <button
        style={cancelBtn}
        onClick={onCancel}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(187,97,100,0.35)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(187,97,100,0.2)';
        }}
      >
        Cancel (ESC)
      </button>

      <div style={scrollRow}>
        {/* Units */}
        {units.map((card, i) => (
          <CardThumb
            key={card.id}
            card={card}
            affordable={card.manaCost <= currentMana}
            selected={selectedCardId === card.id}
            disabled={disabled}
            index={i}
            total={units.length}
            onClick={() => onCardSelect(card.id)}
          />
        ))}

        <SectionDivider />

        {/* Spells */}
        {spells.map((card, i) => (
          <CardThumb
            key={card.id}
            card={card}
            affordable={card.manaCost <= currentMana}
            selected={selectedCardId === card.id}
            disabled={disabled}
            index={i}
            total={spells.length}
            onClick={() => onCardSelect(card.id)}
          />
        ))}
      </div>
    </div>
  );
}
