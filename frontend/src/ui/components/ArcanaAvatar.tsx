import type { CSSProperties } from 'react';

const SIZE_PX = { sm: 32, md: 48, lg: 64 } as const;

type AvatarSize = keyof typeof SIZE_PX;

interface ArcanaAvatarProps {
  index?: number;
  size?: AvatarSize;
  className?: string;
  style?: CSSProperties;
}

export function ArcanaAvatar({
  index = 1,
  size = 'md',
  className,
  style,
}: ArcanaAvatarProps) {
  const clampedIndex = Math.max(1, Math.min(25, Number.isFinite(index) ? index : 1));
  const padded = String(clampedIndex).padStart(2, '0');
  const px = SIZE_PX[size] ?? SIZE_PX.md;

  return (
    <div className={className} style={{ display: 'inline-block', ...style }}>
      <div
        style={{
          borderRadius: '50%',
          border: 'var(--border-med) solid var(--color-gold)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          width: `${px}px`,
          height: `${px}px`,
        }}
      >
        <img
          src={`/assets/ui/human_avatars/avatars_${padded}.png`}
          alt="avatar"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    </div>
  );
}
