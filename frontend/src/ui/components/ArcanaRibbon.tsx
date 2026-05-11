import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const SPRITE_WIDTH = 192;
const ART_HEIGHT = 53;
const CAP_WIDTH = 64;
const MID_WIDTH = SPRITE_WIDTH - CAP_WIDTH * 2;
const FACE_PAD_BOT = 7;

const VARIANT_IMAGES = {
  blue: '/assets/ui/ribbons/ribbon_blue_3slides.png',
  red: '/assets/ui/ribbons/ribbon_red_3slides.png',
  yellow: '/assets/ui/ribbons/ribbon_yellow_3slides.png',
} as const;

type RibbonVariant = keyof typeof VARIANT_IMAGES;

interface ArcanaRibbonProps {
  variant?: RibbonVariant;
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

  const regions = [
    { x: 0, w: CAP_WIDTH },
    { x: CAP_WIDTH, w: MID_WIDTH },
    { x: SPRITE_WIDTH - CAP_WIDTH, w: CAP_WIDTH },
  ];

  const urls = regions.map(({ x, w }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = ART_HEIGHT;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, x, 0, w, ART_HEIGHT, 0, 0, w, ART_HEIGHT);
    return c.toDataURL();
  });

  sliceCache.set(img.src, urls);
  return urls;
}

export function ArcanaRibbon({
  variant = 'blue',
  children,
  className,
  style,
}: ArcanaRibbonProps) {
  const [sliceUrls, setSliceUrls] = useState<string[] | null>(null);

  const src = VARIANT_IMAGES[variant] ?? VARIANT_IMAGES.blue;

  useEffect(() => {
    let cancelled = false;
    loadImage(src)
      .then((img) => {
        if (!cancelled) {
          setSliceUrls(getSlices(img));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [src]);

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
    paddingBottom: `${FACE_PAD_BOT}px`,
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--text-xl)',
    color: 'var(--color-text)',
    textAlign: 'center',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.4)',
    whiteSpace: 'nowrap',
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
      style={{ display: 'block', ...style }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${CAP_WIDTH}px 1fr ${CAP_WIDTH}px`,
          height: `${ART_HEIGHT}px`,
        }}
      >
        <div style={capLeft} />
        <div style={mid}>{children}</div>
        <div style={capRight} />
      </div>
    </div>
  );
}
