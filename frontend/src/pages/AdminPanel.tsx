import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { CONTRACTS, FACTIONS } from "../contracts";
import { ArcanaButton, ArcanaPanel, ArcanaRibbon } from "../ui/components/index";

type TierConfigTuple = readonly [bigint, number, number, boolean];

function isTierTuple(value: unknown): value is TierConfigTuple {
  return Array.isArray(value) && value.length === 4;
}

type CardChainStats = {
  cardType: number; faction: number; rarity: number;
  attack: number; defense: number; hp: number;
  initiative: number; speed: number; ammo: number;
  manaCost: number; size: number; magicResistance: number;
  spellPower: number; duration: number; spellTargetType: number;
  successChance: number; school: number;
};

type CardChainData = {
  name: string;
  ipfsHash: string;
  exists: boolean;
  stats: CardChainStats;
};

function isCardChainData(value: unknown): value is CardChainData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === "string" && typeof v.ipfsHash === "string" && v.exists === true && !!v.stats;
}

const RARITIES = ["Common", "Rare", "Epic", "Legendary"] as const;
const CARD_TYPES = ["Unit", "Spell"] as const;
const SPELL_TARGETS = ["Single", "All Enemies", "All Allies", "Area", "Hero"] as const;
const SCHOOLS = ["None", "Fire", "Earth", "Water", "Air", "Dark", "Light"] as const;
const TIERS = ["Common", "Rare", "Epic", "Legendary"] as const;

type CardForm = {
  cardId: string;
  name: string;
  cardType: string;
  faction: string;
  rarity: string;
  attack: string;
  defense: string;
  hp: string;
  initiative: string;
  speed: string;
  ammo: string;
  manaCost: string;
  size: string;
  magicResistance: string;
  spellPower: string;
  duration: string;
  spellTargetType: string;
  successChance: string;
  school: string;
  ipfsHash: string;
  illustrationUrl: string;
};

type PackForm = {
  tier: string;
  priceEth: string;
  cardCount: string;
  guaranteedRarity: string;
  enabled: boolean;
  pool: string;
  priceCardId: string;
  basePriceEth: string;
  twapPriceEth: string;
  uniqueTrades: string;
};

const DEFAULT_CARD: CardForm = {
  cardId: "",
  name: "",
  cardType: "0",
  faction: "0",
  rarity: "0",
  attack: "1",
  defense: "1",
  hp: "10",
  initiative: "1",
  speed: "1",
  ammo: "0",
  manaCost: "0",
  size: "1",
  magicResistance: "0",
  spellPower: "0",
  duration: "0",
  spellTargetType: "0",
  successChance: "100",
  school: "0",
  ipfsHash: "",
  illustrationUrl: "",
};

const DEFAULT_PACK: PackForm = {
  tier: "0",
  priceEth: "0.002",
  cardCount: "4",
  guaranteedRarity: "0",
  enabled: true,
  pool: "",
  priceCardId: "0",
  basePriceEth: "0.001",
  twapPriceEth: "0",
  uniqueTrades: "0",
};

function toU8(value: string): number {
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(255, parsed)) : 0;
}

function toU16(value: string): number {
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(65_535, parsed)) : 0;
}

function parseIds(value: string): bigint[] {
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => BigInt(part));
}

function makeStats(form: CardForm) {
  return {
    cardType: toU8(form.cardType),
    faction: toU8(form.faction),
    rarity: toU8(form.rarity),
    attack: toU8(form.attack),
    defense: toU8(form.defense),
    hp: toU8(form.hp),
    initiative: toU8(form.initiative),
    speed: toU8(form.speed),
    ammo: toU8(form.ammo),
    manaCost: toU8(form.manaCost),
    size: toU8(form.size),
    magicResistance: toU8(form.magicResistance),
    schoolImmunity: 0,
    effectImmunity: 0,
    spellPower: toU8(form.spellPower),
    duration: toU8(form.duration),
    spellTargetType: toU8(form.spellTargetType),
    successChance: toU8(form.successChance),
    school: toU8(form.school),
  };
}

function svgPreview(form: CardForm): string {
  const faction = FACTIONS[Number(form.faction)] ?? "Neutral";
  const rarity = RARITIES[Number(form.rarity)] ?? "Common";
  const title = form.name || "New Card";
  const art = form.illustrationUrl;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#263449"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="480" height="640" rx="18" fill="#10131f"/>
  <rect x="18" y="18" width="444" height="604" rx="12" fill="url(#bg)" stroke="#d6ad62" stroke-width="4"/>
  <rect x="42" y="72" width="396" height="330" rx="8" fill="#1f2937" stroke="#efe1c6" stroke-opacity=".28"/>
  ${art ? `<image href="${art}" x="42" y="72" width="396" height="330" preserveAspectRatio="xMidYMid slice"/>` : ""}
  <text x="48" y="54" fill="#f2d27f" font-family="serif" font-size="30" font-weight="700">${escapeXml(title)}</text>
  <text x="48" y="438" fill="#8cc3c4" font-family="sans-serif" font-size="20">${faction} - ${rarity}</text>
  <text x="48" y="488" fill="#efe1c6" font-family="sans-serif" font-size="22">ATK ${form.attack}  DEF ${form.defense}  HP ${form.hp}</text>
  <text x="48" y="526" fill="#efe1c6" font-family="sans-serif" font-size="18">INI ${form.initiative}  SPD ${form.speed}  MANA ${form.manaCost}</text>
  <text x="48" y="572" fill="#d7c8a8" font-family="sans-serif" font-size="16">${CARD_TYPES[Number(form.cardType)] ?? "Unit"}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function AdminPanel() {
  const { address, isConnected } = useAccount();
  const [cardForm, setCardForm] = useState<CardForm>(DEFAULT_CARD);
  const [packForm, setPackForm] = useState<PackForm>(DEFAULT_PACK);
  const [localImageUrl, setLocalImageUrl] = useState("");

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: gameOwner } = useReadContract({
    ...CONTRACTS.gameConfig,
    functionName: "owner",
  });
  const { data: packOwner } = useReadContract({
    ...CONTRACTS.packOpening,
    functionName: "owner",
  });
  const { data: cardCount, refetch: refetchCardCount } = useReadContract({
    ...CONTRACTS.gameConfig,
    functionName: "getCardCount",
  });

  const tierReads = useReadContracts({
    contracts: TIERS.flatMap((_, tier) => [
      {
        ...CONTRACTS.packOpening,
        functionName: "tierConfigs" as const,
        args: [tier],
      },
      {
        ...CONTRACTS.packOpening,
        functionName: "getTierPool" as const,
        args: [tier],
      },
    ]),
  });

  const tierSummaries = useMemo(() => {
    return TIERS.map((label, tier) => {
      const config = tierReads.data?.[tier * 2];
      const pool = tierReads.data?.[tier * 2 + 1];
      const cfg = config?.status === "success" && isTierTuple(config.result) ? config.result : undefined;
      const ids = pool?.status === "success" && Array.isArray(pool.result) ? pool.result : [];
      return { label, tier, cfg, ids };
    });
  }, [tierReads.data]);

  // Live card lookup for the Card ID field — lets admin edit existing cards instead of typing blind.
  const cardIdBig = useMemo(() => {
    const trimmed = cardForm.cardId.trim();
    if (!trimmed) return null;
    try { return BigInt(trimmed); } catch { return null; }
  }, [cardForm.cardId]);

  const { data: loadedCard, refetch: refetchLoadedCard } = useReadContract({
    ...CONTRACTS.gameConfig,
    functionName: "getCard",
    args: cardIdBig !== null ? [cardIdBig] : undefined,
    query: { enabled: cardIdBig !== null && cardIdBig >= 0n },
  });

  // Per-card live stats (drops + trades + price history). Auto-refreshes so a fresh
  // pack open or a settled trade shows up without reloading the page.
  const cardStatsReads = useReadContracts({
    contracts: cardIdBig !== null && cardIdBig >= 0n
      ? [
          { ...CONTRACTS.packOpening, functionName: "mintedCount" as const,         args: [cardIdBig] },
          { ...CONTRACTS.packOpening, functionName: "uniqueTrades" as const,        args: [cardIdBig] },
          { ...CONTRACTS.packOpening, functionName: "lastTradePriceWei" as const,   args: [cardIdBig] },
          { ...CONTRACTS.packOpening, functionName: "totalTradeVolumeWei" as const, args: [cardIdBig] },
          { ...CONTRACTS.packOpening, functionName: "twapPriceWei" as const,        args: [cardIdBig] },
          { ...CONTRACTS.packOpening, functionName: "adminBasePriceWei" as const,   args: [cardIdBig] },
          { ...CONTRACTS.packOpening, functionName: "effectivePriceWei" as const,   args: [cardIdBig] },
        ]
      : [],
    query: { enabled: cardIdBig !== null && cardIdBig >= 0n, refetchInterval: 6000 },
  });

  const cardStats = useMemo(() => {
    const rows = cardStatsReads.data;
    if (!rows || rows.length < 7) return null;
    const num = (i: number) => {
      const r = rows[i];
      if (r?.status !== "success") return 0n;
      const v = r.result as unknown;
      return typeof v === "bigint" ? v : BigInt((v as number | string | boolean) ?? 0);
    };
    const minted   = num(0);
    const trades   = num(1);
    const lastWei  = num(2);
    const volWei   = num(3);
    const twapWei  = num(4);
    const baseWei  = num(5);
    const effWei   = num(6);
    const avgWei   = trades > 0n ? volWei / trades : 0n;
    return { minted, trades, lastWei, volWei, twapWei, baseWei, effWei, avgWei };
  }, [cardStatsReads.data]);

  // ---- All-cards stats table ----
  const cardCountNum = typeof cardCount === "bigint" ? Number(cardCount) : 0;
  const cardIds = useMemo(() => Array.from({ length: cardCountNum }, (_, i) => BigInt(i)), [cardCountNum]);

  const allStatsReads = useReadContracts({
    contracts: cardIds.flatMap((id) => [
      { ...CONTRACTS.gameConfig,  functionName: "getCard" as const,             args: [id] },
      { ...CONTRACTS.packOpening, functionName: "mintedCount" as const,         args: [id] },
      { ...CONTRACTS.packOpening, functionName: "uniqueTrades" as const,        args: [id] },
      { ...CONTRACTS.packOpening, functionName: "lastTradePriceWei" as const,   args: [id] },
      { ...CONTRACTS.packOpening, functionName: "totalTradeVolumeWei" as const, args: [id] },
      { ...CONTRACTS.packOpening, functionName: "effectivePriceWei" as const,   args: [id] },
    ]),
    query: { enabled: cardCountNum > 0, refetchInterval: 8000 },
  });

  const allCardsStats = useMemo(() => {
    const data = allStatsReads.data;
    if (!data) return [];
    return cardIds.map((id, idx) => {
      const base = idx * 6;
      const cardRow = data[base];
      const card = isCardChainData(cardRow?.result) ? (cardRow!.result as CardChainData) : null;
      const num = (i: number) => {
        const r = data[base + i];
        if (r?.status !== "success") return 0n;
        const v = r.result as unknown;
        return typeof v === "bigint" ? v : BigInt((v as number | string | boolean) ?? 0);
      };
      const minted   = num(1);
      const trades   = num(2);
      const lastWei  = num(3);
      const volWei   = num(4);
      const effWei   = num(5);
      const avgWei   = trades > 0n ? volWei / trades : 0n;
      return {
        id: Number(id),
        name: card?.name ?? "(unknown)",
        rarity: card ? RARITIES[card.stats.rarity] ?? "?" : "?",
        minted, trades, lastWei, volWei, effWei, avgWei,
      };
    });
  }, [allStatsReads.data, cardIds]);

  const totals = useMemo(() => {
    let minted = 0n, trades = 0n, volume = 0n;
    for (const r of allCardsStats) {
      minted += r.minted;
      trades += r.trades;
      volume += r.volWei;
    }
    return { minted, trades, volume };
  }, [allCardsStats]);

  const previewSrc = useMemo(
    () => svgPreview({ ...cardForm, illustrationUrl: localImageUrl || cardForm.illustrationUrl }),
    [cardForm, localImageUrl],
  );

  const isGameOwner = !!address && typeof gameOwner === "string" && gameOwner.toLowerCase() === address.toLowerCase();
  const isPackOwner = !!address && typeof packOwner === "string" && packOwner.toLowerCase() === address.toLowerCase();
  const isAdmin = isGameOwner || isPackOwner;
  const txInProgress = isPending || isConfirming;

  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => {
      refetchCardCount();
      tierReads.refetch();
      refetchLoadedCard();
      cardStatsReads.refetch();
      allStatsReads.refetch();
      reset();
    }, 900);
    return () => clearTimeout(timer);
  }, [isSuccess, refetchCardCount, reset, tierReads, refetchLoadedCard, cardStatsReads, allStatsReads]);

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect the owner wallet to open admin tools.</p></div>;
  }

  if (!isAdmin) {
    return (
      <div className="page page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Owner Gate</div>
            <h1 className="page-title">Admin Panel</h1>
            <p className="page-copy">This wallet is not the GameConfig or PackOpening owner.</p>
          </div>
        </div>
        <div className="soft-panel">
          <p className="msg-info">GameConfig owner: {typeof gameOwner === "string" ? gameOwner : "Loading..."}</p>
          <p className="msg-info">PackOpening owner: {typeof packOwner === "string" ? packOwner : "Loading..."}</p>
        </div>
      </div>
    );
  }

  const publishCard = () => {
    if (!cardForm.name.trim() || !isGameOwner) return;
    writeContract({
      ...CONTRACTS.gameConfig,
      functionName: "addCard",
      args: [cardForm.name.trim(), makeStats(cardForm), [], cardForm.ipfsHash.trim()],
    });
  };

  const updateCardStats = () => {
    if (!cardForm.cardId || !isGameOwner) return;
    writeContract({
      ...CONTRACTS.gameConfig,
      functionName: "updateCardStats",
      args: [BigInt(cardForm.cardId), makeStats(cardForm)],
    });
  };

  const updateCardIpfs = () => {
    if (!cardForm.cardId || !cardForm.ipfsHash.trim() || !isGameOwner) return;
    writeContract({
      ...CONTRACTS.gameConfig,
      functionName: "updateCardIpfsHash",
      args: [BigInt(cardForm.cardId), cardForm.ipfsHash.trim()],
    });
  };

  const setTierConfig = () => {
    if (!isPackOwner) return;
    writeContract({
      ...CONTRACTS.packOpening,
      functionName: "setTierConfig",
      args: [
        toU8(packForm.tier),
        parseEther(packForm.priceEth || "0"),
        toU16(packForm.cardCount),
        toU8(packForm.guaranteedRarity),
        packForm.enabled,
      ],
    });
  };

  const setTierPool = () => {
    if (!isPackOwner || !packForm.pool.trim()) return;
    writeContract({
      ...CONTRACTS.packOpening,
      functionName: "setTierPool",
      args: [toU8(packForm.tier), parseIds(packForm.pool)],
    });
  };

  const setCardPrice = () => {
    if (!isPackOwner || !packForm.priceCardId) return;
    writeContract({
      ...CONTRACTS.packOpening,
      functionName: "setCardPrice",
      args: [
        BigInt(packForm.priceCardId),
        parseEther(packForm.basePriceEth || "0"),
        parseEther(packForm.twapPriceEth || "0"),
        toU16(packForm.uniqueTrades),
      ],
    });
  };

  const loadTierToForm = (tier: number) => {
    const summary = tierSummaries[tier];
    if (!summary?.cfg) return;
    const [priceWei, cardCount, guaranteedRarity, enabled] = summary.cfg;
    setPackForm((prev) => ({
      ...prev,
      tier: String(tier),
      priceEth: formatEther(priceWei),
      cardCount: String(cardCount),
      guaranteedRarity: String(guaranteedRarity),
      enabled,
      pool: summary.ids.map((id) => id.toString()).join(", "),
    }));
  };

  const loadCardToForm = () => {
    if (!isCardChainData(loadedCard)) return;
    const s = loadedCard.stats;
    setCardForm((prev) => ({
      ...prev,
      name: loadedCard.name,
      ipfsHash: loadedCard.ipfsHash,
      cardType: String(s.cardType),
      faction: String(s.faction),
      rarity: String(s.rarity),
      attack: String(s.attack),
      defense: String(s.defense),
      hp: String(s.hp),
      initiative: String(s.initiative),
      speed: String(s.speed),
      ammo: String(s.ammo),
      manaCost: String(s.manaCost),
      size: String(s.size),
      magicResistance: String(s.magicResistance),
      spellPower: String(s.spellPower),
      duration: String(s.duration),
      spellTargetType: String(s.spellTargetType),
      successChance: String(s.successChance),
      school: String(s.school),
    }));
  };

  const resetCardForm = () => {
    setCardForm(DEFAULT_CARD);
    if (localImageUrl) URL.revokeObjectURL(localImageUrl);
    setLocalImageUrl("");
  };

  return (
    <div className="page page-shell">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Owner Console</div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-copy">Manage GameConfig cards and PackOpening tiers from the connected owner wallet.</p>
        </div>
        <ArcanaRibbon variant="yellow">{cardCount?.toString() ?? "0"} Cards</ArcanaRibbon>
      </div>

      {txInProgress && <p className="msg-info">{isPending ? "Confirm in wallet..." : "Confirming transaction..."}</p>}
      {isSuccess && !txInProgress && <p className="msg-success">Transaction confirmed.</p>}
      {error && <p className="msg-error">{error.message.slice(0, 180)}</p>}

      <details className="admin-help" open>
        <summary>How to use this panel</summary>
        <ol className="admin-help-list">
          <li><strong>Edit a card:</strong> enter its Card ID, click <em>Load Card</em>, change stats, then click <em>Update Stats</em> (or <em>Update IPFS</em> for art only).</li>
          <li><strong>Add a new card:</strong> leave Card ID empty, fill all fields, click <em>Publish Card</em>. The new ID will be the current card count.</li>
          <li><strong>Edit a pack tier:</strong> click one of the four tier cards below to load its current config + pool into the form, change values, then save. The Pack Opening page reads tiers live from chain — refresh after saving.</li>
          <li><strong>Card prices for pack weights:</strong> rarer cards should have higher base ETH so they drop less often. TWAP fields are read by the contract once unique trades ≥ 10; until then base price drives weights.</li>
        </ol>
        <p className="msg-info" style={{ marginTop: "var(--space-2)" }}>
          You are signed in as <strong>{address}</strong>. GameConfig owner = {isGameOwner ? "yes" : "no"}, PackOpening owner = {isPackOwner ? "yes" : "no"}.
        </p>
      </details>

      <section className="soft-panel">
        <div className="section-title">
          <h2>Card Stats Log</h2>
          <span className="msg-info">refreshes every 8s</span>
        </div>
        <p className="msg-info admin-section-help">
          Live per-card stats. <strong>Dropped</strong> = times this card came out of a pack
          (counted on-chain in <code>rawFulfillRandomWords</code>). <strong>Trades</strong> = settled
          marketplace buys (counted on-chain by <code>Marketplace.buy → PackOpening.recordTrade</code>).
          <strong> Effective</strong> is the price the weight formula currently uses (Base before
          ≥10 trades, TWAP after).
        </p>
        <div className="admin-totals">
          <span><strong>{totals.minted.toString()}</strong> total drops</span>
          <span><strong>{totals.trades.toString()}</strong> total trades</span>
          <span><strong>{formatEther(totals.volume)}</strong> ETH volume</span>
          <span>{cardCountNum} cards tracked</span>
        </div>
        <div className="admin-stats-table-wrap">
          <table className="admin-stats-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Rarity</th>
                <th>Dropped</th>
                <th>Trades</th>
                <th>Last sale</th>
                <th>Avg sale</th>
                <th>Volume</th>
                <th>Effective</th>
              </tr>
            </thead>
            <tbody>
              {allCardsStats.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--color-text-dim)" }}>Loading…</td></tr>
              )}
              {allCardsStats.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{r.rarity}</td>
                  <td>{r.minted.toString()}</td>
                  <td>{r.trades.toString()}</td>
                  <td>{r.lastWei > 0n ? `${formatEther(r.lastWei)} ETH` : "—"}</td>
                  <td>{r.avgWei  > 0n ? `${formatEther(r.avgWei)} ETH`  : "—"}</td>
                  <td>{r.volWei  > 0n ? `${formatEther(r.volWei)} ETH`  : "—"}</td>
                  <td>{r.effWei  > 0n ? `${formatEther(r.effWei)} ETH`  : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-layout">
        <div className="soft-panel">
          <div className="section-title">
            <h2>Card Management</h2>
            <span className="msg-info">{isGameOwner ? "Write access" : "Read only"}</span>
          </div>

          <p className="msg-info admin-section-help">
            <strong>New card:</strong> leave Card ID empty, fill the form, click Publish.{" "}
            <strong>Edit:</strong> type the Card ID, click Load Card, change fields, click Update.
          </p>
          <div className="admin-form">
            <div className="admin-id-row">
              <Field label="Card ID">
                <input className="text-input" value={cardForm.cardId} onChange={(e) => setCardForm({ ...cardForm, cardId: e.target.value })} placeholder="Only for updates" />
              </Field>
              <ArcanaButton
                variant="blue"
                size="sm"
                onClick={loadCardToForm}
                disabled={!isCardChainData(loadedCard)}
              >
                Load Card
              </ArcanaButton>
              <ArcanaButton variant="red" size="sm" onClick={resetCardForm}>
                Reset
              </ArcanaButton>
            </div>

            {cardIdBig !== null && cardStats && (
              <div className="admin-card-stats">
                <div className="admin-subsection-head" style={{ marginBottom: "var(--space-2)" }}>
                  <h3>Live Stats — Card #{cardIdBig.toString()}</h3>
                  <span className="msg-info">refreshes every 6s</span>
                </div>
                <div className="admin-stat-grid">
                  <StatTile label="Pack drops"   value={cardStats.minted.toString()} hint="times minted in packs" />
                  <StatTile label="Trades"       value={cardStats.trades.toString()} hint={`TWAP active at ≥10 (${cardStats.trades >= 10n ? "active" : "inactive"})`} />
                  <StatTile label="Last sale"    value={cardStats.lastWei > 0n ? `${formatEther(cardStats.lastWei)} ETH` : "—"} hint="most recent marketplace sale" />
                  <StatTile label="Avg sale"     value={cardStats.avgWei > 0n ? `${formatEther(cardStats.avgWei)} ETH` : "—"} hint="volume ÷ trades" />
                  <StatTile label="TWAP"         value={cardStats.twapWei > 0n ? `${formatEther(cardStats.twapWei)} ETH` : "—"} hint="running mean of recorded trades" />
                  <StatTile label="Base price"   value={cardStats.baseWei > 0n ? `${formatEther(cardStats.baseWei)} ETH` : "—"} hint="admin-set fallback" />
                  <StatTile label="Effective"    value={cardStats.effWei > 0n ? `${formatEther(cardStats.effWei)} ETH` : "—"} hint="what the weight formula uses" highlight />
                  <StatTile label="Volume"       value={cardStats.volWei > 0n ? `${formatEther(cardStats.volWei)} ETH` : "—"} hint="cumulative ETH traded" />
                </div>
              </div>
            )}

            <Field label="Name">
              <input className="text-input" value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} placeholder="Archer Captain" />
            </Field>
            <Field label="Illustration URL">
              <input className="text-input" value={cardForm.illustrationUrl} onChange={(e) => setCardForm({ ...cardForm, illustrationUrl: e.target.value })} placeholder="ipfs://... or https://..." />
            </Field>
            <Field label="Local Preview">
              <input
                className="text-input"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (localImageUrl) URL.revokeObjectURL(localImageUrl);
                  setLocalImageUrl(URL.createObjectURL(file));
                }}
              />
            </Field>
            <Field label="IPFS Hash">
              <input className="text-input" value={cardForm.ipfsHash} onChange={(e) => setCardForm({ ...cardForm, ipfsHash: e.target.value })} placeholder="bafy..." />
            </Field>

            <div className="admin-inline">
              <Select label="Type" value={cardForm.cardType} options={CARD_TYPES} onChange={(cardType) => setCardForm({ ...cardForm, cardType })} />
              <Select label="Faction" value={cardForm.faction} options={FACTIONS} onChange={(faction) => setCardForm({ ...cardForm, faction })} />
              <Select label="Rarity" value={cardForm.rarity} options={RARITIES} onChange={(rarity) => setCardForm({ ...cardForm, rarity })} />
            </div>

            <NumberGrid
              values={cardForm}
              keys={["attack", "defense", "hp", "initiative", "speed", "ammo", "manaCost", "size", "magicResistance"]}
              onChange={(key, value) => setCardForm({ ...cardForm, [key]: value })}
            />

            <div className="admin-inline">
              <Select label="Target" value={cardForm.spellTargetType} options={SPELL_TARGETS} onChange={(spellTargetType) => setCardForm({ ...cardForm, spellTargetType })} />
              <Select label="School" value={cardForm.school} options={SCHOOLS} onChange={(school) => setCardForm({ ...cardForm, school })} />
            </div>
            <NumberGrid
              values={cardForm}
              keys={["spellPower", "duration", "successChance"]}
              onChange={(key, value) => setCardForm({ ...cardForm, [key]: value })}
            />

            <div className="pill-row">
              <ArcanaButton variant="blue" onClick={publishCard} disabled={!isGameOwner || txInProgress || !cardForm.name.trim()}>
                Publish Card
              </ArcanaButton>
              <ArcanaButton variant="blue" onClick={updateCardStats} disabled={!isGameOwner || txInProgress || !cardForm.cardId}>
                Update Stats
              </ArcanaButton>
              <ArcanaButton variant="red" onClick={updateCardIpfs} disabled={!isGameOwner || txInProgress || !cardForm.cardId || !cardForm.ipfsHash.trim()}>
                Update IPFS
              </ArcanaButton>
            </div>
          </div>
        </div>

        <ArcanaPanel variant="slate">
          <div className="admin-preview">
            <img src={previewSrc} alt="Card preview" className="admin-card-preview" />
          </div>
        </ArcanaPanel>
      </section>

      <section className="soft-panel">
        <div className="section-title">
          <h2>Pack Management</h2>
          <span className="msg-info">{isPackOwner ? "Write access" : "Read only"}</span>
        </div>
        <p className="msg-info admin-section-help">
          Click any tier card to load its on-chain config + pool into the form below.
          The Pack Opening page reads these live — players see updates after a refresh.
        </p>
        <div className="admin-pack-grid">
          {tierSummaries.map((tier) => {
            const selected = Number(packForm.tier) === tier.tier;
            return (
              <ArcanaPanel key={tier.label} variant={selected ? "carved" : "slate"}>
                <button
                  type="button"
                  className="btn-plain admin-summary-card"
                  onClick={() => loadTierToForm(tier.tier)}
                  disabled={!tier.cfg}
                  title="Load this tier into the form"
                >
                  <strong>{tier.label}</strong>
                  <span>{tier.cfg ? `${formatEther(tier.cfg[0])} ETH` : "..."}</span>
                  <span>{tier.cfg ? `${tier.cfg[1]} cards` : "..."}</span>
                  <span>{tier.ids.length} pool cards</span>
                  <span>{tier.cfg?.[3] ? "Active" : "Inactive"}</span>
                </button>
              </ArcanaPanel>
            );
          })}
        </div>

        <div className="admin-form admin-pack-form">
          <div className="admin-inline">
            <Select label="Tier" value={packForm.tier} options={TIERS} onChange={(tier) => setPackForm({ ...packForm, tier })} />
          </div>

          <div className="admin-subsection">
            <div className="admin-subsection-head">
              <h3>1. Tier Config</h3>
              <span className="msg-info">setTierConfig</span>
            </div>
            <p className="msg-info admin-section-help">
              The four basics of a pack tier. <strong>Price</strong> is what players pay,
              <strong> Card Count</strong> is how many cards drop, <strong>Guaranteed</strong> is
              the minimum rarity one of those cards is forced to be, and <strong>Active</strong>
              toggles whether players can buy this tier (uncheck to disable without losing the config).
            </p>
            <div className="admin-inline">
              <Field label="Price ETH">
                <input className="text-input" value={packForm.priceEth} onChange={(e) => setPackForm({ ...packForm, priceEth: e.target.value })} />
              </Field>
              <Field label="Card Count">
                <input className="text-input" type="number" min="1" value={packForm.cardCount} onChange={(e) => setPackForm({ ...packForm, cardCount: e.target.value })} />
              </Field>
              <Select label="Guaranteed" value={packForm.guaranteedRarity} options={RARITIES} onChange={(guaranteedRarity) => setPackForm({ ...packForm, guaranteedRarity })} />
            </div>
            <label className="admin-check">
              <input type="checkbox" checked={packForm.enabled} onChange={(e) => setPackForm({ ...packForm, enabled: e.target.checked })} />
              <span>Active tier</span>
            </label>
            <ArcanaButton variant="blue" onClick={setTierConfig} disabled={!isPackOwner || txInProgress}>
              Save Tier Config
            </ArcanaButton>
          </div>

          <div className="admin-subsection">
            <div className="admin-subsection-head">
              <h3>2. Tier Pool</h3>
              <span className="msg-info">setTierPool</span>
            </div>
            <p className="msg-info admin-section-help">
              Comma-separated card IDs that are <em>eligible to drop</em> from this tier.
              Saving <strong>replaces the whole pool</strong> — include every card you want
              droppable. Each card here also needs a price in <em>Card Pricing</em> below or
              the weighting math will revert.
            </p>
            <Field label="Tier Pool">
              <input className="text-input" value={packForm.pool} onChange={(e) => setPackForm({ ...packForm, pool: e.target.value })} placeholder="0, 1, 2, 3" />
            </Field>
            <ArcanaButton variant="blue" onClick={setTierPool} disabled={!isPackOwner || txInProgress || !packForm.pool.trim()}>
              Save Tier Pool
            </ArcanaButton>
          </div>

          <div className="admin-subsection">
            <div className="admin-subsection-head">
              <h3>3. Card Pricing</h3>
              <span className="msg-info">setCardPrice</span>
            </div>
            <p className="msg-info admin-section-help">
              Per-card pricing that drives drop weight inside a tier — weight is
              <code> 1e24 / price</code>, so <strong>higher price → rarer drop</strong>.
              Set <strong>Base ETH</strong> for every card in any pool. The contract auto-switches
              to <strong>TWAP ETH</strong> once a card has ≥ 10 unique marketplace trades; on a
              fresh deploy leave TWAP and Trades at <code>0</code>.
            </p>
            <div className="admin-inline">
              <Field label="Card ID">
                <input className="text-input" value={packForm.priceCardId} onChange={(e) => setPackForm({ ...packForm, priceCardId: e.target.value })} />
              </Field>
              <Field label="Base ETH">
                <input className="text-input" value={packForm.basePriceEth} onChange={(e) => setPackForm({ ...packForm, basePriceEth: e.target.value })} />
              </Field>
              <Field label="TWAP ETH">
                <input className="text-input" value={packForm.twapPriceEth} onChange={(e) => setPackForm({ ...packForm, twapPriceEth: e.target.value })} />
              </Field>
              <Field label="Trades">
                <input className="text-input" type="number" min="0" value={packForm.uniqueTrades} onChange={(e) => setPackForm({ ...packForm, uniqueTrades: e.target.value })} />
              </Field>
            </div>
            <ArcanaButton variant="red" onClick={setCardPrice} disabled={!isPackOwner || txInProgress || !packForm.priceCardId}>
              Save Card Price
            </ArcanaButton>
          </div>
        </div>
      </section>

      <section className="soft-panel">
        <div className="section-title">
          <h2>Season Management</h2>
          <span className="msg-info">Contract pending</span>
        </div>
        <p className="msg-info">No season manager ABI or contract address is available in this repo yet.</p>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function StatTile({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={`admin-stat-tile${highlight ? " admin-stat-tile--highlight" : ""}`}>
      <span className="admin-stat-label">{label}</span>
      <strong className="admin-stat-value">{value}</strong>
      {hint && <span className="admin-stat-hint">{hint}</span>}
    </div>
  );
}

function Select<T extends readonly string[]>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: T;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select className="text-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option, index) => (
          <option key={option} value={index.toString()}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

function NumberGrid({
  values,
  keys,
  onChange,
}: {
  values: CardForm;
  keys: (keyof CardForm)[];
  onChange: (key: keyof CardForm, value: string) => void;
}) {
  return (
    <div className="admin-number-grid">
      {keys.map((key) => (
        <Field key={key} label={labelize(key)}>
          <input
            className="text-input"
            type="number"
            min="0"
            max="255"
            value={values[key]}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </Field>
      ))}
    </div>
  );
}

function labelize(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
