import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

const SPRITE_PATH = '/assets/ui/swords/swords.png';

const SPRITE_ROW_HEIGHT = 128;
const HILT_SRC = { x: 0, w: 128 };
const MID_SRC = { x: 192, w: 64 };
const CAP_SRC = { x: 320, w: 128 };

const HOST_HEIGHT = 48;
const SCALE = HOST_HEIGHT / SPRITE_ROW_HEIGHT;
const HILT_DISPLAY_W = HILT_SRC.w * SCALE;
const CAP_DISPLAY_W = CAP_SRC.w * SCALE;

const COLOR_ROWS: Record<string, number> = {
  blue: 0,
  red: 1,
  yellow: 2,
  purple: 3,
  grey: 4,
};

const INACTIVE_ROW = COLOR_ROWS.grey;

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

function getRowSlices(img: HTMLImageElement, rowIndex: number): string[] {
  const key = `${img.src}:${rowIndex}`;
  if (sliceCache.has(key)) return sliceCache.get(key)!;

  const sy = rowIndex * SPRITE_ROW_HEIGHT;
  const regions = [HILT_SRC, MID_SRC, CAP_SRC];

  const urls = regions.map(({ x, w }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = SPRITE_ROW_HEIGHT;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, x, sy, w, SPRITE_ROW_HEIGHT, 0, 0, w, SPRITE_ROW_HEIGHT);
    return c.toDataURL();
  });

  sliceCache.set(key, urls);
  return urls;
}

/* ---- ArcanaTab ---- */

interface ArcanaTabProps {
  name: string;
  color?: string;
  active?: boolean;
  children?: ReactNode;
  onClick?: () => void;
}

export function ArcanaTab({
  color = 'blue',
  active = false,
  children,
  onClick,
}: ArcanaTabProps) {
  const [spriteImg, setSpriteImg] = useState<HTMLImageElement | null>(null);
  const [sliceUrls, setSliceUrls] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImage(SPRITE_PATH)
      .then((img) => {
        if (!cancelled) setSpriteImg(img);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!spriteImg) return;
    const activeRow = COLOR_ROWS[color] ?? COLOR_ROWS.blue;
    const row = active ? activeRow : INACTIVE_ROW;
    setSliceUrls(getRowSlices(spriteImg, row));
  }, [spriteImg, color, active]);

  const cellBase: CSSProperties = {
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };

  return (
    <div
      style={{ display: 'flex', alignItems: 'stretch', cursor: 'inherit', userSelect: 'none' }}
      onClick={onClick}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${HILT_DISPLAY_W}px 1fr ${CAP_DISPLAY_W}px`,
          height: `${HOST_HEIGHT}px`,
          width: '100%',
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-md)',
            color: 'var(--color-text-dark)',
            whiteSpace: 'nowrap',
            backgroundImage: sliceUrls ? `url('${sliceUrls[1]}')` : undefined,
          }}
        >
          {children}
        </div>
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
    </div>
  );
}

/* ---- ArcanaTabs ---- */

interface ArcanaTabChild {
  name: string;
  color?: string;
  children?: ReactNode;
}

interface ArcanaTabsProps {
  active?: string;
  onTabChange?: (tab: string, index: number) => void;
  tabs: ArcanaTabChild[];
  className?: string;
  style?: CSSProperties;
}

export function ArcanaTabs({
  active: activeProp,
  onTabChange,
  tabs,
  className,
  style,
}: ArcanaTabsProps) {
  const [activeInternal, setActiveInternal] = useState<string>(
    activeProp ?? tabs[0]?.name ?? '',
  );

  const active = activeProp ?? activeInternal;

  useEffect(() => {
    if (activeProp !== undefined) {
      setActiveInternal(activeProp);
    }
  }, [activeProp]);

  const handleClick = useCallback(
    (tabName: string, index: number) => {
      if (tabName === active) return;
      setActiveInternal(tabName);
      onTabChange?.(tabName, index);
    },
    [active, onTabChange],
  );

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        alignItems: 'stretch',
        ...style,
      }}
    >
      {tabs.map((tab, index) => (
        <ArcanaTab
          key={tab.name}
          name={tab.name}
          color={tab.color}
          active={tab.name === active}
          onClick={() => handleClick(tab.name, index)}
        >
          {tab.children}
        </ArcanaTab>
      ))}
    </div>
  );
}
