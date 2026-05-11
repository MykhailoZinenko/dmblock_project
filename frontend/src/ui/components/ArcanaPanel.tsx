import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const VARIANTS = {
  parchment: {
    src: '/assets/ui/papers/regularpaper.png',
    color: 'var(--color-text-dark)',
    rows: [{ y: 20, h: 44 }, { y: 128, h: 64 }, { y: 256, h: 45 }],
    cols: [{ x: 12, w: 52 }, { x: 128, w: 64 }, { x: 256, w: 52 }],
    inset: [12, 12, 12, 12],
  },
  slate: {
    src: '/assets/ui/papers/specialpaper.png',
    color: 'var(--color-text)',
    rows: [{ y: 20, h: 44 }, { y: 128, h: 64 }, { y: 256, h: 43 }],
    cols: [{ x: 9, w: 55 }, { x: 128, w: 64 }, { x: 256, w: 55 }],
    inset: [12, 12, 12, 12],
  },
  wood: {
    src: '/assets/ui/wood_table/woodtable.png',
    color: 'var(--color-text)',
    rows: [{ y: 43, h: 85 }, { y: 192, h: 64 }, { y: 320, h: 103 }],
    cols: [{ x: 44, w: 84 }, { x: 192, w: 64 }, { x: 320, w: 84 }],
    inset: [26, 23, 38, 23],
  },
  carved: {
    src: '/assets/ui/banners/carved_9slides.png',
    color: 'var(--color-text-dark)',
    rows: [{ y: 0, h: 64 }, { y: 64, h: 64 }, { y: 128, h: 64 }],
    cols: [{ x: 0, w: 64 }, { x: 64, w: 64 }, { x: 128, w: 64 }],
    inset: [12, 12, 7, 12],
  },
  scroll: {
    src: '/assets/ui/banners/banner.png',
    color: 'var(--color-text-dark)',
    rows: [{ y: 60, h: 68 }, { y: 192, h: 64 }, { y: 320, h: 111 }],
    cols: [{ x: 28, w: 100 }, { x: 192, w: 64 }, { x: 320, w: 84 }],
    inset: [6, 22, 44, 43],
  },
} as const;

type Variant = keyof typeof VARIANTS;

interface ArcanaPanelProps {
  variant?: Variant;
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

function getNineSlices(
  img: HTMLImageElement,
  rows: readonly { y: number; h: number }[],
  cols: readonly { x: number; w: number }[],
): string[] {
  const key = img.src;
  if (sliceCache.has(key)) return sliceCache.get(key)!;

  const urls: string[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const sx = cols[c].x;
      const sy = rows[r].y;
      const sw = cols[c].w;
      const sh = rows[r].h;
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      urls.push(canvas.toDataURL());
    }
  }

  sliceCache.set(key, urls);
  return urls;
}

const CORNER_INDICES = new Set([0, 2, 6, 8]);
const EDGE_H_INDICES = new Set([1, 7]);
const EDGE_V_INDICES = new Set([3, 5]);

export function ArcanaPanel({
  variant = 'parchment',
  children,
  className,
  style,
}: ArcanaPanelProps) {
  const config = VARIANTS[variant] ?? VARIANTS.parchment;
  const [sliceUrls, setSliceUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadImage(config.src)
      .then((img) => {
        if (!cancelled) {
          setSliceUrls(getNineSlices(img, config.rows, config.cols));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [config]);

  const { rows, cols, inset } = config;
  const topH = rows[0].h;
  const botH = rows[2].h;
  const leftW = cols[0].w;
  const rightW = cols[2].w;

  const rootRef = useRef<HTMLDivElement>(null);

  const gridStyle: CSSProperties = {
    display: 'grid',
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    gridTemplateColumns: `${leftW}px 1fr ${rightW}px`,
    gridTemplateRows: `${topH}px 1fr ${botH}px`,
  };

  const contentStyle: CSSProperties = {
    position: 'relative',
    zIndex: 1,
    fontFamily: 'var(--font-body)',
    color: config.color,
    padding: `${inset[0]}px ${inset[1]}px ${inset[2]}px ${inset[3]}px`,
  };

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        display: 'block',
        position: 'relative',
        minWidth: `${leftW + rightW}px`,
        minHeight: `${topH + botH}px`,
        ...style,
      }}
    >
      <div style={gridStyle}>
        {Array.from({ length: 9 }, (_, i) => {
          const cellStyle: CSSProperties = {
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            backgroundImage: sliceUrls[i] ? `url('${sliceUrls[i]}')` : undefined,
          };

          if (CORNER_INDICES.has(i)) {
            cellStyle.position = 'relative';
            cellStyle.zIndex = 1;
          }
          if (EDGE_H_INDICES.has(i)) {
            cellStyle.marginLeft = '-1px';
            cellStyle.marginRight = '-1px';
          }
          if (EDGE_V_INDICES.has(i)) {
            cellStyle.marginTop = '-1px';
            cellStyle.marginBottom = '-1px';
          }
          if (i === 4) {
            cellStyle.margin = '-1px';
          }

          return <div key={i} style={cellStyle} />;
        })}
      </div>
      <div style={contentStyle}>{children}</div>
    </div>
  );
}
