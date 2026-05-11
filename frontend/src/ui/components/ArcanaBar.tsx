import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const FRAME_SRC = '/assets/ui/bars/bigbar_base.png';
const FILL_SRC = '/assets/ui/bars/bigbar_fill.png';

const ART_Y = 9;
const ART_HEIGHT = 51;

const LEFT_SRC = { x: 40, w: 24 };
const MID_SRC = { x: 128, w: 64 };
const RIGHT_SRC = { x: 256, w: 24 };

const FILL_INSET_TOP = 12;
const FILL_INSET_BOT = 15;
const FILL_INSET_LEFT = 24;
const FILL_INSET_RIGHT = 24;

const COLOR_FILTERS: Record<string, string> = {
  red: 'none',
  blue: 'hue-rotate(200deg) saturate(1.2)',
  gold: 'hue-rotate(40deg) saturate(0.8) brightness(1.2)',
};

type BarColor = 'red' | 'blue' | 'gold';

interface ArcanaBarProps {
  value?: number;
  max?: number;
  color?: BarColor;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) return imageCache.get(src)!;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

const sliceCache = new Map<string, string[]>();

function getSlices(img: HTMLImageElement): string[] {
  if (sliceCache.has(img.src)) return sliceCache.get(img.src)!;

  const regions = [LEFT_SRC, MID_SRC, RIGHT_SRC];

  const urls = regions.map(({ x, w }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = ART_HEIGHT;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, x, ART_Y, w, ART_HEIGHT, 0, 0, w, ART_HEIGHT);
    return c.toDataURL();
  });

  sliceCache.set(img.src, urls);
  return urls;
}

export function ArcanaBar({
  value = 0,
  max = 100,
  color = 'red',
  children,
  className,
  style,
}: ArcanaBarProps) {
  const [sliceUrls, setSliceUrls] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImage(FRAME_SRC)
      .then((img) => {
        if (!cancelled) {
          setSliceUrls(getSlices(img));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  const cellBase: CSSProperties = {
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };

  return (
    <div
      className={className}
      style={{
        display: 'block',
        position: 'relative',
        height: `${ART_HEIGHT}px`,
        ...style,
      }}
    >
      {/* Fill track */}
      <div
        style={{
          position: 'absolute',
          top: `${FILL_INSET_TOP}px`,
          bottom: `${FILL_INSET_BOT}px`,
          left: `${FILL_INSET_LEFT}px`,
          right: `${FILL_INSET_RIGHT}px`,
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundImage: `url('${FILL_SRC}')`,
            backgroundSize: 'auto 100%',
            backgroundRepeat: 'repeat-x',
            imageRendering: 'pixelated',
            transition: 'width var(--duration-normal) var(--ease-out)',
            filter: COLOR_FILTERS[color] ?? COLOR_FILTERS.red,
          }}
        />
      </div>

      {/* Frame grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${LEFT_SRC.w}px 1fr ${RIGHT_SRC.w}px`,
          height: `${ART_HEIGHT}px`,
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            ...cellBase,
            position: 'relative',
            zIndex: 1,
            marginRight: '-1px',
            backgroundImage: sliceUrls ? `url('${sliceUrls[0]}')` : undefined,
          }}
        />
        <div
          style={{
            ...cellBase,
            backgroundImage: sliceUrls ? `url('${sliceUrls[1]}')` : undefined,
          }}
        />
        <div
          style={{
            ...cellBase,
            position: 'relative',
            zIndex: 1,
            marginLeft: '-1px',
            backgroundImage: sliceUrls ? `url('${sliceUrls[2]}')` : undefined,
          }}
        />
      </div>

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3,
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text)',
          textShadow: '1px 1px 2px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
