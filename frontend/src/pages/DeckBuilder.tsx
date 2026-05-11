import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useAccount } from "wagmi";
import { useHero } from "../hooks/useHero";
import { useDeckBuilderData } from "../hooks/useDeckBuilderData";
import { ARCHETYPES, FACTIONS, FACTION_COLORS } from "../contracts";
import {
  DECK_SIZE,
  RARITY_NAME,
  validateDeck,
  type CardMeta,
} from "../lib/deckValidation";
import {
  emptySlots,
  listDecks,
  saveDeck,
  deleteDeck,
  type SavedDeck,
} from "../lib/deckStorage";
import { ArcanaButton, ArcanaRibbon } from "../ui/components/index";

type DragPayload =
  | { source: "pool"; cardId: number }
  | { source: "slot"; cardId: number; slotIdx: number };

const RARITY_COLOR: Record<number, string> = {
  0: "#9aa0a6", // common - gray
  1: "#4d8bd8", // rare - blue
  2: "#9c5edc", // epic - purple
  3: "#e0a93a", // legendary - gold
};

export default function DeckBuilder() {
  const { address, isConnected } = useAccount();
  const { hero, hasHero } = useHero();
  const { ownedCounts, cardMeta, cardImages, uniqueCardIds, isLoading } = useDeckBuilderData();

  const [slots, setSlots] = useState<(number | null)[]>(() => emptySlots());
  const [deckName, setDeckName] = useState("Main");
  const [decksVersion, setDecksVersion] = useState(0);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const savedDecks: SavedDeck[] = useMemo(
    () => (address ? listDecks(address) : []),
    // decksVersion is bumped on save/delete to force a fresh read from localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, decksVersion],
  );

  const validation = useMemo(() => {
    return validateDeck(slots, cardMeta, ownedCounts);
  }, [slots, cardMeta, ownedCounts]);

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect your wallet to build a deck.</p></div>;
  }
  if (!hasHero) {
    return (
      <div className="page page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Deck Builder</div>
            <h1 className="page-title">Build Your First Deck</h1>
            <p className="page-copy">You need a hero before building a deck.</p>
          </div>
        </div>
        <Link to="/create"><ArcanaButton variant="blue">Create Hero</ArcanaButton></Link>
      </div>
    );
  }
  if (isLoading) {
    return <div className="page page-shell"><h1 className="page-title">Deck Builder</h1><p className="msg-info">Loading cards...</p></div>;
  }

  const archetype = hero?.archetype ?? 0;

  function flashStatus(msg: string) {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg((s) => (s === msg ? "" : s)), 1500);
  }

  function addToFirstEmpty(cardId: number) {
    const idx = slots.findIndex((s) => s === null);
    if (idx === -1) {
      flashStatus("Deck is full (20/20)");
      return;
    }
    placeAt(idx, cardId);
  }

  function placeAt(slotIdx: number, cardId: number) {
    const next = slots.slice();
    next[slotIdx] = cardId;
    setSlots(next);
  }

  function removeAt(slotIdx: number) {
    const next = slots.slice();
    next[slotIdx] = null;
    setSlots(next);
  }

  function swap(a: number, b: number) {
    if (a === b) return;
    const next = slots.slice();
    [next[a], next[b]] = [next[b], next[a]];
    setSlots(next);
  }

  function onPoolDragStart(e: React.DragEvent, cardId: number) {
    e.dataTransfer.setData("application/json", JSON.stringify({ source: "pool", cardId } satisfies DragPayload));
    e.dataTransfer.effectAllowed = "copy";
  }
  function onSlotDragStart(e: React.DragEvent, slotIdx: number) {
    const cardId = slots[slotIdx];
    if (cardId === null) return;
    e.dataTransfer.setData("application/json", JSON.stringify({ source: "slot", cardId, slotIdx } satisfies DragPayload));
    e.dataTransfer.effectAllowed = "move";
  }
  function onSlotDragOver(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    setDragOverSlot(slotIdx);
  }
  function onSlotDragLeave() {
    setDragOverSlot(null);
  }
  function onSlotDrop(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    setDragOverSlot(null);
    let payload: DragPayload | null = null;
    try { payload = JSON.parse(e.dataTransfer.getData("application/json")) as DragPayload; } catch { return; }
    if (!payload) return;
    if (payload.source === "pool") placeAt(slotIdx, payload.cardId);
    else swap(payload.slotIdx, slotIdx);
  }
  function onPoolDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onPoolDrop(e: React.DragEvent) {
    e.preventDefault();
    let payload: DragPayload | null = null;
    try { payload = JSON.parse(e.dataTransfer.getData("application/json")) as DragPayload; } catch { return; }
    if (!payload) return;
    if (payload.source === "slot") removeAt(payload.slotIdx);
  }

  function onSave() {
    if (!address) return;
    if (!deckName.trim()) {
      flashStatus("Name required");
      return;
    }
    saveDeck(address, { name: deckName.trim(), slots, updatedAt: Date.now() });
    setDecksVersion((v) => v + 1);
    flashStatus(`Saved "${deckName.trim()}"`);
  }

  function onLoad(name: string) {
    const found = savedDecks.find((d) => d.name === name);
    if (!found) return;
    setDeckName(found.name);
    setSlots(found.slots.slice());
    flashStatus(`Loaded "${name}"`);
  }

  function onDelete(name: string) {
    if (!address) return;
    if (!window.confirm(`Delete deck "${name}"?`)) return;
    deleteDeck(address, name);
    setDecksVersion((v) => v + 1);
    flashStatus(`Deleted "${name}"`);
  }

  function onClear() {
    if (!window.confirm("Clear all 20 slots?")) return;
    setSlots(emptySlots());
  }

  return (
    <div className="page page-shell deck-builder">
      <div className="db-header">
        <div>
          <div className="page-kicker">20 Card Loadout</div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Deck Builder</h1>
        </div>
        <div className="db-hero-tag">
          <span>{FACTIONS[hero!.faction]}</span> <span>·</span> <span>{ARCHETYPES[archetype]}</span> <span>·</span> <span>Lv {hero!.level}</span>
        </div>
        <ArcanaRibbon variant={validation.ok ? "blue" : "red"}>{validation.filled} / {DECK_SIZE}</ArcanaRibbon>
      </div>

      <div className="db-toolbar">
        <input
          className="db-name-input"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          placeholder="Deck name"
        />
        <ArcanaButton variant="blue" size="sm" onClick={onSave}>Save</ArcanaButton>
        <button className="btn-outline" onClick={onClear}>Clear</button>
        {savedDecks.length > 0 && (
          <select
            className="db-load"
            value=""
            onChange={(e) => { if (e.target.value) onLoad(e.target.value); }}
          >
            <option value="">Load…</option>
            {savedDecks.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        )}
        {statusMsg && <span className="msg-info">{statusMsg}</span>}
        <span style={{ marginLeft: "auto", color: validation.ok ? "#78c679" : "var(--color-text-dim)" }}>
          {validation.filled} / {DECK_SIZE} {validation.ok && "· valid"}
        </span>
      </div>

      <div className="db-layout">
        <div className="db-left">
          <div
            className="db-slots"
            onDragOver={onPoolDragOver}
            onDrop={(e) => { e.preventDefault(); /* drops on grid container itself do nothing */ }}
          >
            {slots.map((cid, i) => (
              <DeckSlot
                key={i}
                idx={i}
                cardId={cid}
                meta={cid !== null ? cardMeta.get(cid) : undefined}
                image={cid !== null ? cardImages.get(cid) : undefined}
                isDragOver={dragOverSlot === i}
                onClick={() => cid !== null && removeAt(i)}
                onDragStart={(e) => onSlotDragStart(e, i)}
                onDragOver={(e) => onSlotDragOver(e, i)}
                onDragLeave={onSlotDragLeave}
                onDrop={(e) => onSlotDrop(e, i)}
              />
            ))}
          </div>
          <div className="db-rules">
            <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>Validation</h3>
            {validation.rules.map((r) => (
              <div key={r.code} className={`db-rule ${r.ok ? "ok" : "bad"}`}>
                <span className="db-rule-mark">{r.ok ? "✓" : "✗"}</span>
                <span className="db-rule-label">{r.label}</span>
                {r.detail && <span className="db-rule-detail">{r.detail}</span>}
              </div>
            ))}
            {savedDecks.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>Saved decks</h3>
                {savedDecks.map((d) => (
                  <div key={d.name} className="db-saved-row">
                    <span>{d.name}</span>
                    <span className="msg-info">{new Date(d.updatedAt).toLocaleDateString()}</span>
                    <button className="btn-outline" onClick={() => onLoad(d.name)}>Load</button>
                    <button className="btn-outline" onClick={() => onDelete(d.name)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="db-right" onDragOver={onPoolDragOver} onDrop={onPoolDrop}>
          <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
            Your cards <span className="msg-info">· drag onto slot, or click to add</span>
          </h3>
          {uniqueCardIds.length === 0 ? (
            <p className="msg-info">You don't own any cards yet.</p>
          ) : (
            <div className="db-pool">
              {uniqueCardIds.map((cid) => {
                const meta = cardMeta.get(cid);
                const owned = ownedCounts.get(cid) ?? 0;
                const inDeck = validation.perCardIdUsed.get(cid) ?? 0;
                const cap = validation.perCardIdCap.get(cid) ?? 0;
                const remaining = Math.max(0, cap - inDeck);
                const disabled = remaining <= 0;
                return (
                  <PoolCard
                    key={cid}
                    cardId={cid}
                    meta={meta}
                    image={cardImages.get(cid)}
                    owned={owned}
                    inDeck={inDeck}
                    cap={cap}
                    disabled={disabled}
                    onDragStart={(e) => onPoolDragStart(e, cid)}
                    onClick={() => !disabled && addToFirstEmpty(cid)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeckSlot(props: {
  idx: number;
  cardId: number | null;
  meta: CardMeta | undefined;
  image: string | undefined;
  isDragOver: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const { cardId, meta, image, isDragOver } = props;
  const filled = cardId !== null;
  const factionColor = meta ? FACTION_COLORS[meta.faction] : "transparent";
  return (
    <div
      className={`db-slot ${filled ? "filled" : "empty"} ${isDragOver ? "over" : ""}`}
      style={filled ? { borderColor: factionColor } : undefined}
      draggable={filled}
      onClick={props.onClick}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      title={filled ? `${meta?.name ?? `#${cardId}`} — click to remove` : "Empty slot"}
    >
      {filled && image ? (
        <object data={image} type="image/svg+xml" className="db-slot-img">
          <span>{meta?.name}</span>
        </object>
      ) : filled ? (
        <span className="db-slot-name">{meta?.name ?? `#${cardId}`}</span>
      ) : (
        <span className="db-slot-idx">{props.idx + 1}</span>
      )}
      {filled && meta && (
        <span className="db-slot-rarity" style={{ background: RARITY_COLOR[meta.rarity] }} title={RARITY_NAME[meta.rarity]} />
      )}
    </div>
  );
}

function PoolCard(props: {
  cardId: number;
  meta: CardMeta | undefined;
  image: string | undefined;
  owned: number;
  inDeck: number;
  cap: number;
  disabled: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  const { meta, image, owned, inDeck, cap, disabled } = props;
  const factionColor = meta ? FACTION_COLORS[meta.faction] : "transparent";
  return (
    <div
      className={`db-pool-card ${disabled ? "disabled" : ""}`}
      style={{ borderColor: factionColor }}
      draggable={!disabled}
      onDragStart={props.onDragStart}
      onClick={props.onClick}
      title={disabled ? "All copies already in deck" : "Drag to slot or click to add"}
    >
      {image ? (
        <object data={image} type="image/svg+xml" className="db-pool-img">
          <span>{meta?.name}</span>
        </object>
      ) : (
        <span className="db-pool-name">{meta?.name ?? `#${props.cardId}`}</span>
      )}
      <div className="db-pool-meta">
        <span className="db-pool-name">{meta?.name ?? `#${props.cardId}`}</span>
        <span className="db-pool-count">{inDeck} / {cap} · {owned} owned</span>
      </div>
      {meta && (
        <span className="db-pool-rarity" style={{ background: RARITY_COLOR[meta.rarity] }} title={RARITY_NAME[meta.rarity]} />
      )}
    </div>
  );
}
