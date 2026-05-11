import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';

const ASSETS = {
  round: {
    blue: {
      normal: '/assets/ui/buttons/smallblueroundbutton_regular.png',
      pressed: '/assets/ui/buttons/smallblueroundbutton_pressed.png',
    },
    red: {
      normal: '/assets/ui/buttons/smallredroundbutton_regular.png',
      pressed: '/assets/ui/buttons/smallredroundbutton_pressed.png',
    },
  },
  square: {
    blue: {
      normal: '/assets/ui/buttons/smallbluesquarebutton_regular.png',
      pressed: '/assets/ui/buttons/smallbluesquarebutton_pressed.png',
    },
    red: {
      normal: '/assets/ui/buttons/smallredsquarebutton_regular.png',
      pressed: '/assets/ui/buttons/smallredsquarebutton_pressed.png',
    },
  },
} as const;

const BUTTON_SIZE_PX = 64;
const FACE_PAD_TOP = 0;
const FACE_PAD_BOT = 5;
const PRESSED_FACE_PAD_TOP = 4;
const PRESSED_FACE_PAD_BOT = 0;

type Shape = 'round' | 'square';
type IconVariant = 'blue' | 'red';

interface ArcanaIconButtonProps {
  shape?: Shape;
  variant?: IconVariant;
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ArcanaIconButton({
  shape = 'round',
  variant = 'blue',
  disabled = false,
  onClick,
  children,
  className,
  style,
}: ArcanaIconButtonProps) {
  const [pressed, setPressed] = useState(false);

  const shapeAssets = ASSETS[shape] ?? ASSETS.round;
  const variantAssets = shapeAssets[variant] ?? shapeAssets.blue;
  const src = pressed ? variantAssets.pressed : variantAssets.normal;
  const padTop = pressed ? PRESSED_FACE_PAD_TOP : FACE_PAD_TOP;
  const padBot = pressed ? PRESSED_FACE_PAD_BOT : FACE_PAD_BOT;

  const onMouseDown = useCallback(() => { if (!disabled) setPressed(true); }, [disabled]);
  const onMouseUp = useCallback(() => { if (!disabled) setPressed(false); }, [disabled]);
  const onMouseLeave = useCallback(() => { if (!disabled) setPressed(false); }, [disabled]);

  const btnStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundImage: `url('${src}')`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    paddingTop: `${padTop}px`,
    paddingBottom: `${padBot}px`,
  };

  return (
    <div
      className={className}
      style={{
        display: 'inline-block',
        width: `${BUTTON_SIZE_PX}px`,
        height: `${BUTTON_SIZE_PX}px`,
        cursor: 'inherit',
        userSelect: 'none',
        opacity: disabled ? 'var(--opacity-disabled, 0.4)' as unknown as number : undefined,
        pointerEvents: disabled ? 'none' : undefined,
        ...style,
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onClick={disabled ? undefined : onClick}
    >
      <div style={btnStyle}>{children}</div>
    </div>
  );
}
