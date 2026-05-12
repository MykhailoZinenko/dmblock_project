import { getCardImageUrl } from "../../lib/cardImage";

export type CardStats = {
  cardType: number;
  attack: number;
  hp: number;
  defense: number;
  initiative: number;
  manaCost: number;
  spellPower: number;
  duration: number;
  successChance: number;
  school: number;
};

const STAT_X = [15.87, 32.93, 50.0, 67.07, 84.13];

function unitStats(s: CardStats): number[] {
  return [s.attack, s.hp, s.defense, s.initiative, s.manaCost];
}

function spellStats(s: CardStats): number[] {
  return [s.spellPower, s.duration, s.successChance, s.manaCost, s.school];
}

export function CardImage({
  cardId,
  stats,
  alt,
  className,
  style,
}: {
  cardId: number;
  stats?: CardStats;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const values = stats ? (stats.cardType === 0 ? unitStats(stats) : spellStats(stats)) : null;

  return (
    <div className={`card-image-wrap ${className ?? ""}`} style={style}>
      <img
        src={getCardImageUrl(cardId)}
        alt={alt ?? `Card #${cardId}`}
        className="card-image-png"
        loading="lazy"
        draggable={false}
      />
      {values && (
        <div className="card-image-stats">
          {values.map((v, i) => (
            <span key={i} className="card-image-stat" style={{ left: `${STAT_X[i]}%` }}>
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
