import type { CSSProperties } from 'react';

const CARD_WIDTH = 160;
const SPRITE_AREA_HEIGHT = 120;
const MANA_BADGE_SIZE = 28;
const MANA_BADGE_BORDER = 1;

const RARITY_STYLES: Record<string, { border: string; shadow: string }> = {
  common: { border: 'var(--color-ink)', shadow: 'none' },
  rare: { border: 'var(--color-blue)', shadow: 'var(--shadow-glow-blue)' },
  epic: { border: 'var(--color-gold)', shadow: 'var(--shadow-glow-gold)' },
  legendary: { border: 'var(--color-hover)', shadow: '0 0 20px rgba(221, 179, 109, 0.6)' },
};

interface ArcanaCardProps {
  name?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  mana?: number;
  sprite?: string;
  attack?: number;
  defense?: number;
  hp?: number;
  className?: string;
  style?: CSSProperties;
}

export function ArcanaCard({
  name = '',
  rarity = 'common',
  mana = 0,
  sprite = '',
  attack,
  defense,
  hp,
  className,
  style,
}: ArcanaCardProps) {
  const rarityConfig = RARITY_STYLES[rarity] ?? RARITY_STYLES.common;

  const stats: { icon: string; value: number }[] = [];
  if (attack !== undefined) stats.push({ icon: '⚔', value: attack });
  if (defense !== undefined) stats.push({ icon: '🛡', value: defense });
  if (hp !== undefined) stats.push({ icon: '♥', value: hp });

  return (
    <div className={className} style={{ display: 'inline-block', width: `${CARD_WIDTH}px`, ...style }}>
      <div
        style={{
          position: 'relative',
          background: 'var(--color-parchment)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          borderWidth: 'var(--border-med)',
          borderStyle: 'solid',
          boxSizing: 'border-box',
          borderColor: rarityConfig.border,
          boxShadow: rarityConfig.shadow,
        }}
      >
        {/* Sprite area */}
        <div
          style={{
            position: 'relative',
            height: `${SPRITE_AREA_HEIGHT}px`,
            background: 'var(--color-parchment-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {sprite && (
            <img
              src={`/assets/${sprite}/idle_0.png`}
              alt=""
              style={{
                maxWidth: '80%',
                maxHeight: '100%',
                objectFit: 'contain',
                imageRendering: 'pixelated',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              top: 'var(--space-1, 4px)',
              right: 'var(--space-1, 4px)',
              width: `${MANA_BADGE_SIZE}px`,
              height: `${MANA_BADGE_SIZE}px`,
              borderRadius: '50%',
              background: 'var(--color-blue)',
              color: 'var(--color-text-dark)',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-sm)',
              border: `${MANA_BADGE_BORDER}px solid var(--color-ink)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              boxSizing: 'border-box',
              zIndex: 1,
            }}
          >
            {mana}
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              lineHeight: 1.1,
              margin: '0 0 var(--space-1, 4px) 0',
            }}
          >
            {name}
          </div>
          {stats.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
                opacity: 0.8,
                flexWrap: 'wrap',
              }}
            >
              {stats.map((s) => (
                <span
                  key={s.icon}
                  style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <span style={{ fontSize: '0.9em' }}>{s.icon}</span>
                  {s.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
