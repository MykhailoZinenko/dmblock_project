import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const SPRITE_WIDTH = 192;
const CAP_WIDTH = 24;
const MID_WIDTH = SPRITE_WIDTH - CAP_WIDTH * 2;

const RAISED_Y = 0;
const RAISED_H = 56;
const RAISED_FACE_PAD_BOT = 8;

const FLAT_Y = 4;
const FLAT_H = 52;
const FLAT_FACE_PAD_BOT = 4;

const VARIANT_IMAGES = {
  blue: {
    normal: '/assets/ui/buttons/button_blue_3slides.png',
    pressed: '/assets/ui/buttons/button_blue_3slides_pressed.png',
  },
  red: {
    normal: '/assets/ui/buttons/button_red_3slides.png',
    pressed: '/assets/ui/buttons/button_red_3slides_pressed.png',
  },
} as const;

const HOVER_IMAGE = '/assets/ui/buttons/button_hover_3slides.png';
const DISABLED_IMAGE = '/assets/ui/buttons/button_disable_3slides.png';

const SIZE_SCALES = { sm: 0.75, md: 1, lg: 1.25 } as const;

type ButtonVariant = keyof typeof VARIANT_IMAGES;
type ButtonSize = keyof typeof SIZE_SCALES;

interface ArcanaButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
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

function getSlices(img: HTMLImageElement, srcY: number, srcH: number): string[] {
  const key = `${img.src}:${srcY}:${srcH}`;
  if (sliceCache.has(key)) return sliceCache.get(key)!;

  const regions = [
    { x: 0, w: CAP_WIDTH },
    { x: CAP_WIDTH, w: MID_WIDTH },
    { x: SPRITE_WIDTH - CAP_WIDTH, w: CAP_WIDTH },
  ];

  const urls = regions.map(({ x, w }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = srcH;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, x, srcY, w, srcH, 0, 0, w, srcH);
    return c.toDataURL();
  });

  sliceCache.set(key, urls);
  return urls;
}

export function ArcanaButton({
  variant = 'blue',
  size = 'md',
  disabled = false,
  onClick,
  children,
  className,
  style,
}: ArcanaButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [sliceUrls, setSliceUrls] = useState<string[] | null>(null);

  const isFlat = pressed || disabled;

  const src = disabled
    ? DISABLED_IMAGE
    : pressed
      ? (VARIANT_IMAGES[variant] ?? VARIANT_IMAGES.blue).pressed
      : hovered
        ? HOVER_IMAGE
        : (VARIANT_IMAGES[variant] ?? VARIANT_IMAGES.blue).normal;

  const srcY = isFlat ? FLAT_Y : RAISED_Y;
  const srcH = isFlat ? FLAT_H : RAISED_H;
  const padBot = isFlat ? FLAT_FACE_PAD_BOT : RAISED_FACE_PAD_BOT;

  useEffect(() => {
    let cancelled = false;
    loadImage(src)
      .then((img) => {
        if (!cancelled) {
          setSliceUrls(getSlices(img, srcY, srcH));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [src, srcY, srcH]);

  const scale = SIZE_SCALES[size] ?? SIZE_SCALES.md;

  const onMouseEnter = useCallback(() => { setHovered(true); }, []);
  const onMouseLeave = useCallback(() => { setHovered(false); setPressed(false); }, []);
  const onMouseDown = useCallback(() => { setPressed(true); }, []);
  const onMouseUp = useCallback(() => { setPressed(false); }, []);

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${CAP_WIDTH}px 1fr ${CAP_WIDTH}px`,
    width: '100%',
    height: `${srcH}px`,
  };

  const cellBase: CSSProperties = {
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };

  const capLeft: CSSProperties = {
    ...cellBase,
    position: 'relative',
    zIndex: 1,
    marginRight: '-1px',
    backgroundImage: sliceUrls ? `url('${sliceUrls[0]}')` : undefined,
  };

  const mid: CSSProperties = {
    ...cellBase,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-body)',
    color: 'var(--color-text)',
    whiteSpace: 'nowrap',
    paddingBottom: `${padBot}px`,
    backgroundImage: sliceUrls ? `url('${sliceUrls[1]}')` : undefined,
  };

  const capRight: CSSProperties = {
    ...cellBase,
    position: 'relative',
    zIndex: 1,
    marginLeft: '-1px',
    backgroundImage: sliceUrls ? `url('${sliceUrls[2]}')` : undefined,
  };

  return (
    <div
      className={className}
      style={{
        display: 'inline-block',
        cursor: 'inherit',
        userSelect: 'none',
        pointerEvents: disabled ? 'none' : undefined,
        opacity: disabled ? 'var(--opacity-disabled)' as unknown as number : undefined,
        ...style,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={disabled ? undefined : onClick}
    >
      <div style={{ height: `${RAISED_H}px`, display: 'flex', alignItems: 'flex-end', zoom: scale === 1 ? undefined : scale }}>
        <div style={gridStyle}>
          <div style={capLeft} />
          <div style={mid}>{children}</div>
          <div style={capRight} />
        </div>
      </div>
    </div>
  );
}
