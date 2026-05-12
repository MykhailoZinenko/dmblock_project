import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { ADDRESSES, CONTRACTS } from "../contracts";
import { CardImage, type CardStats } from "../ui/components/CardImage";
import { ArcanaButton, ArcanaPanel, ArcanaRibbon } from "../ui/components/index";

const ZERO = "0x0000000000000000000000000000000000000000";
const LOCAL_CHAIN_ID = 31337;

const MOCK_VRF_ABI = [
  {
    type: "function",
    name: "fulfill",
    inputs: [
      { name: "consumer", type: "address" },
      { name: "requestId", type: "uint256" },
      { name: "randomWord", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

type Tier = {
  id: number;
  label: string;
  price: bigint;
  count: number;
  guarantee: string;
  variant: "blue" | "red";
};

const TIERS: Tier[] = [
  { id: 0, label: "Common", price: parseEther("0.002"), count: 4, guarantee: "Mostly commons", variant: "blue" },
  { id: 1, label: "Rare", price: parseEther("0.0075"), count: 5, guarantee: "1 Rare or higher", variant: "blue" },
  { id: 2, label: "Epic", price: parseEther("0.02"), count: 6, guarantee: "1 Epic or higher", variant: "red" },
  { id: 3, label: "Legendary", price: parseEther("0.075"), count: 7, guarantee: "1 Legendary", variant: "red" },
];

type Pull = {
  requestId: bigint;
  tier: number;
  firstTokenId: bigint;
  cardIds: bigint[];
};

const RARITY_NAMES = ["Common", "Rare", "Epic", "Legendary"] as const;
const FACTION_NAMES = ["Castle", "Inferno", "Necropolis", "Dungeon"] as const;

export default function PackOpening() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [selectedTier, setSelectedTier] = useState(TIERS[0]);
  const [lastRequestId, setLastRequestId] = useState<bigint | null>(null);
  const [pull, setPull] = useState<Pull | null>(null);
  const [fulfillFiredFor, setFulfillFiredFor] = useState<bigint | null>(null);

  const configured = ADDRESSES.packOpening.toLowerCase() !== ZERO;
  const isLocalDev = chainId === LOCAL_CHAIN_ID;

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { writeContract: fulfillVrf } = useWriteContract();

  const { data: vrfCoordinator } = useReadContract({
    ...CONTRACTS.packOpening,
    functionName: "vrfCoordinator",
    query: { enabled: configured && isLocalDev },
  });

  useWatchContractEvent({
    ...CONTRACTS.packOpening,
    eventName: "PackRequested",
    enabled: configured && isConnected,
    onLogs(logs) {
      const mine = logs.find((log) => log.args.player?.toLowerCase() === address?.toLowerCase());
      if (mine?.args.requestId !== undefined) {
        setLastRequestId(mine.args.requestId);
        setPull(null);
      }
    },
  });

  useWatchContractEvent({
    ...CONTRACTS.packOpening,
    eventName: "PackOpened",
    enabled: configured && isConnected,
    onLogs(logs) {
      const mine = logs.find((log) => log.args.player?.toLowerCase() === address?.toLowerCase());
      if (
        !mine ||
        mine.args.requestId === undefined ||
        mine.args.tier === undefined ||
        mine.args.firstTokenId === undefined ||
        !mine.args.cardIds
      ) return;
      setPull({
        requestId: mine.args.requestId,
        tier: Number(mine.args.tier),
        firstTokenId: mine.args.firstTokenId,
        cardIds: [...mine.args.cardIds],
      });
      setLastRequestId(null);
      setFulfillFiredFor(null);
      reset();
    },
  });

  // Dev-only: auto-fulfill the mock VRF coordinator so the local flow doesn't hang.
  useEffect(() => {
    if (!isLocalDev || !lastRequestId || pull || !vrfCoordinator) return;
    if (fulfillFiredFor === lastRequestId) return;
    setFulfillFiredFor(lastRequestId);
    fulfillVrf({
      address: vrfCoordinator as `0x${string}`,
      abi: MOCK_VRF_ABI,
      functionName: "fulfill",
      args: [ADDRESSES.packOpening as `0x${string}`, lastRequestId, BigInt(Date.now())],
    });
  }, [isLocalDev, lastRequestId, pull, vrfCoordinator, fulfillFiredFor, fulfillVrf]);

  const uniquePullCardIds = useMemo(() => {
    if (!pull) return [] as number[];
    return Array.from(new Set(pull.cardIds.map(Number))).sort((a, b) => a - b);
  }, [pull]);

  const { data: pullCardData } = useReadContracts({
    contracts: uniquePullCardIds.map((cid) => ({
      ...CONTRACTS.gameConfig,
      functionName: "getCard" as const,
      args: [BigInt(cid)],
    })),
    query: { enabled: uniquePullCardIds.length > 0 },
  });

  const revealed = useMemo(() => {
    if (!pull) return [];
    const metaMap = new Map<number, { name: string; rarity: number; faction: number; stats: CardStats }>();
    if (pullCardData) {
      uniquePullCardIds.forEach((cid, i) => {
        const r = pullCardData[i];
        if (r?.status !== "success") return;
        const card = r.result as { name: string; stats: Record<string, bigint | number> };
        const s = card.stats;
        metaMap.set(cid, {
          name: card.name,
          rarity: Number(s.rarity),
          faction: Number(s.faction),
          stats: {
            cardType: Number(s.cardType), attack: Number(s.attack), hp: Number(s.hp),
            defense: Number(s.defense), initiative: Number(s.initiative), manaCost: Number(s.manaCost),
            spellPower: Number(s.spellPower), duration: Number(s.duration),
            successChance: Number(s.successChance), school: Number(s.school),
          },
        });
      });
    }
    return pull.cardIds.map((cardId, i) => {
      const cid = Number(cardId);
      const meta = metaMap.get(cid);
      return {
        tokenId: pull.firstTokenId + BigInt(i),
        cardId: cid,
        name: meta?.name ?? `Card #${cid}`,
        rarity: meta ? RARITY_NAMES[meta.rarity] : undefined,
        faction: meta ? FACTION_NAMES[meta.faction] : undefined,
        stats: meta?.stats,
      };
    });
  }, [pull, pullCardData, uniquePullCardIds]);

  const selectedIndex = useMemo(
    () => TIERS.findIndex((tier) => tier.id === selectedTier.id),
    [selectedTier.id],
  );

  if (!isConnected) {
    return <div className="page"><p className="msg-info">Connect your wallet to open packs.</p></div>;
  }

  const txInProgress = isPending || isConfirming;
  const waitingForVrf = !!lastRequestId && !pull;

  const buyPack = () => {
    if (!configured) return;
    writeContract({
      ...CONTRACTS.packOpening,
      functionName: "buyPack",
      args: [selectedTier.id],
      value: selectedTier.price,
    });
  };

  return (
    <div className="page page-shell">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Chainlink VRF</div>
          <h1 className="page-title">Open Packs</h1>
          <p className="page-copy">
            Choose a tier, submit the pack price, and reveal the cards after the VRF callback mints them.
          </p>
        </div>
        <ArcanaRibbon variant="yellow">{selectedTier.count} Cards</ArcanaRibbon>
      </div>

      {!configured && (
        <p className="msg-error">PackOpening address is not configured yet. Deploy the contract and update contracts.ts.</p>
      )}
      {txInProgress && <p className="msg-info">{isPending ? "Confirm in wallet..." : "Confirming pack purchase..."}</p>}
      {isSuccess && waitingForVrf && (
        <p className="msg-info">
          VRF request #{lastRequestId.toString()} is pending
          {isLocalDev ? " — auto-fulfilling on local chain..." : ". The reveal appears after fulfillment."}
        </p>
      )}
      {error && <p className="msg-error">{error.message.slice(0, 160)}</p>}

      <section>
        <div className="section-title">
          <h2>Choose Tier</h2>
          <span className="msg-info">{formatEther(selectedTier.price)} ETH</span>
        </div>
        <div className="card-grid">
          {TIERS.map((tier) => (
            <ArcanaPanel key={tier.id} variant={tier.id === selectedTier.id ? "carved" : "slate"}>
              <button
                className="btn-plain"
                onClick={() => setSelectedTier(tier)}
                style={{ width: "100%", textAlign: "left", padding: "var(--space-3)" }}
              >
                <span className="page-kicker">{tier.count} cards</span>
                <strong style={{ display: "block", marginTop: 6, color: "var(--color-parchment)" }}>
                  {tier.label} Pack
                </strong>
                <span className="msg-info" style={{ display: "block", marginTop: 8 }}>
                  {tier.guarantee}
                </span>
                <span className="msg-info" style={{ display: "block", marginTop: 8 }}>
                  {formatEther(tier.price)} ETH
                </span>
              </button>
            </ArcanaPanel>
          ))}
        </div>
      </section>

      <section className="soft-panel">
        <div className="section-title">
          <h2>Purchase</h2>
          <span className="msg-info">{TIERS[selectedIndex]?.label ?? "Common"}</span>
        </div>
        <ArcanaButton
          variant={selectedTier.variant}
          onClick={buyPack}
          disabled={!configured || txInProgress || waitingForVrf}
        >
          {waitingForVrf ? "Waiting for VRF" : `Buy for ${formatEther(selectedTier.price)} ETH`}
        </ArcanaButton>
      </section>

      <section>
        <div className="section-title">
          <h2>Reveal</h2>
          <span className="msg-info">{pull ? `Request #${pull.requestId.toString()}` : "No opened pack yet"}</span>
        </div>
        {pull && revealed.length > 0 ? (
          <div className="card-grid">
            {revealed.map((card, index) => (
              <ArcanaPanel
                key={`${pull.requestId}-${index}`}
                variant={index === 0 && pull.tier > 0 ? "carved" : "slate"}
              >
                <div style={{ padding: "var(--space-3)", textAlign: "center" }}>
                  <CardImage
                    cardId={card.cardId}
                    stats={card.stats}
                    alt={card.name}
                    style={{ borderRadius: 4, marginBottom: 8 }}
                  />
                  <strong style={{ color: "var(--color-parchment)", fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", display: "block" }}>
                    {card.name}
                  </strong>
                  <span className="msg-info" style={{ display: "block", marginTop: 4 }}>
                    Token #{card.tokenId.toString()}
                    {card.faction ? ` · ${card.faction}` : ""}
                    {card.rarity ? ` · ${card.rarity}` : ""}
                  </span>
                  {index === 0 && pull.tier > 0 && (
                    <p className="msg-success" style={{ marginTop: 8 }}>Guaranteed slot</p>
                  )}
                </div>
              </ArcanaPanel>
            ))}
          </div>
        ) : (
          <div className="soft-panel"><p className="msg-info">Opened cards will appear here after the mint event.</p></div>
        )}
      </section>
    </div>
  );
}
