import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { CONTRACTS } from "../contracts";
import { useHero } from "../hooks/useHero";
import { useDuelLobby, type DuelInfo } from "../hooks/useDuelLobby";
import { listDecks } from "../lib/deckStorage";
import { DECK_SIZE } from "../lib/deckValidation";
import { ArcanaButton, ArcanaPanel, ArcanaRibbon } from "../ui/components/index";

const ZERO = "0x0000000000000000000000000000000000000000";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function DuelLobby() {
  const { address, isConnected } = useAccount();
  const { hasHero, isLoading: heroLoading } = useHero();
  const {
    otherOpenDuels, myOpenDuels, myActiveDuels, myHistory,
    playerStats, refetch,
  } = useDuelLobby();

  const hasValidDeck = useMemo(() => {
    if (!address) return false;
    const decks = listDecks(address);
    return decks.some((d) => d.slots.filter((s) => s !== null).length === DECK_SIZE);
  }, [address]);

  const [betEth, setBetEth] = useState("");
  const navigate = useNavigate();
  const [lastAcceptedDuelId, setLastAcceptedDuelId] = useState<number | null>(null);

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: minBet } = useReadContract({
    ...CONTRACTS.duelManager,
    functionName: "minimumBet",
  });

  if (isSuccess) {
    setTimeout(() => {
      refetch();
      reset();
      setBetEth("");
      if (lastAcceptedDuelId !== null) {
        navigate(`/battle?duel=${lastAcceptedDuelId}`);
        setLastAcceptedDuelId(null);
      }
    }, 1000);
  }

  if (!isConnected) {
    return (
      <div className="page page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Ranked Wagering</div>
            <h1 className="page-title">Duel Lobby</h1>
            <p className="page-copy">Connect your wallet to create or accept duels.</p>
          </div>
          <ArcanaRibbon variant="blue">Wallet Required</ArcanaRibbon>
        </div>
      </div>
    );
  }

  if (!heroLoading && !hasHero) {
    return (
      <div className="page page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Ranked Wagering</div>
            <h1 className="page-title">Duel Lobby</h1>
            <p className="page-copy">You need a hero before you can enter the arena.</p>
          </div>
          <ArcanaRibbon variant="red">No Hero</ArcanaRibbon>
        </div>
        <Link to="/create"><ArcanaButton variant="blue" size="lg">Create Your Hero</ArcanaButton></Link>
      </div>
    );
  }

  if (hasHero && !hasValidDeck) {
    return (
      <div className="page page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Ranked Wagering</div>
            <h1 className="page-title">Duel Lobby</h1>
            <p className="page-copy">You need a valid 20-card deck before you can duel. Build one in the Deck Builder.</p>
          </div>
          <ArcanaRibbon variant="red">No Deck</ArcanaRibbon>
        </div>
        <Link to="/decks"><ArcanaButton variant="blue" size="lg">Build a Deck</ArcanaButton></Link>
      </div>
    );
  }

  const txInProgress = isPending || isConfirming;

  const handleCreateDuel = () => {
    if (!betEth) return;
    let value: bigint;
    try { value = parseEther(betEth); } catch { return; }
    if (value === 0n) return;
    writeContract({
      ...CONTRACTS.duelManager,
      functionName: "createDuel",
      value,
    });
  };

  const handleAccept = (duelId: number, bet: bigint) => {
    setLastAcceptedDuelId(duelId);
    writeContract({
      ...CONTRACTS.duelManager,
      functionName: "acceptDuel",
      args: [BigInt(duelId)],
      value: bet,
    });
  };

  const handleCancel = (duelId: number) => {
    writeContract({
      ...CONTRACTS.duelManager,
      functionName: "cancelDuel",
      args: [BigInt(duelId)],
    });
  };

  const handleClaimExpired = (duelId: number) => {
    writeContract({
      ...CONTRACTS.duelManager,
      functionName: "claimExpired",
      args: [BigInt(duelId)],
    });
  };

  const handleEnterBattle = (duelId: number) => {
    navigate(`/battle?duel=${duelId}`);
  };

  return (
    <div className="page page-shell">
      <div className="page-hero">
        <div>
          <div className="page-kicker">Ranked Wagering</div>
          <h1 className="page-title">Duel Lobby</h1>
          <p className="page-copy">
            Stake ETH, challenge opponents, climb the ELO ladder toward freedom.
          </p>
        </div>
        <ArcanaRibbon variant="yellow">{otherOpenDuels.length} Open Challenges</ArcanaRibbon>
      </div>

      {txInProgress && (
        <p className="msg-info">
          {isPending ? "Confirm in wallet…" : "Confirming transaction…"}
        </p>
      )}
      {isSuccess && !txInProgress && <p className="msg-success">Transaction confirmed.</p>}
      {error && <p className="msg-error">{error.message.slice(0, 160)}</p>}

      {/* Player Stats */}
      <section className="soft-panel">
        <div className="section-title">
          <h2>Your Stats</h2>
          <span className="msg-info">Season {playerStats?.seasonId ?? "—"}</span>
        </div>
        <div className="duel-stats-row">
          <div className="duel-stat">
            <span className="duel-stat-label">ELO Rating</span>
            <span className="duel-stat-value">
              {playerStats?.isCalibrated ? playerStats.elo : `${playerStats?.elo ?? 1000}*`}
            </span>
          </div>
          <div className="duel-stat">
            <span className="duel-stat-label">Matches</span>
            <span className="duel-stat-value">{playerStats?.matchCount ?? 0} / 25</span>
          </div>
          <div className="duel-stat">
            <span className="duel-stat-label">Status</span>
            <span className="duel-stat-value">
              {playerStats?.isFreed ? "Freed" : playerStats?.isCalibrated ? "Ranked" : "Calibrating"}
            </span>
          </div>
        </div>
        {!playerStats?.isCalibrated && (
          <p className="msg-info" style={{ marginTop: "var(--space-2)" }}>
            * ELO is hidden until 25 calibration matches are completed.
          </p>
        )}
      </section>

      {/* Create Duel */}
      <section className="soft-panel">
        <div className="section-title"><h2>Create Duel</h2></div>
        <div className="market-form">
          <label className="field-label">
            Bet Amount (ETH) — minimum {minBet ? formatEther(minBet as bigint) : "…"} ETH
          </label>
          <input
            className="text-input"
            type="text"
            inputMode="decimal"
            value={betEth}
            onChange={(e) => setBetEth(e.target.value)}
            placeholder="0.01"
          />
          <ArcanaButton variant="blue" size="lg" onClick={handleCreateDuel} disabled={!betEth || txInProgress}>
            Create Duel
          </ArcanaButton>
        </div>
      </section>

      {/* Open Challenges */}
      <section>
        <div className="section-title">
          <h2>Open Challenges</h2>
          <span className="msg-info">{otherOpenDuels.length} available</span>
        </div>
        {otherOpenDuels.length === 0 ? (
          <div className="soft-panel"><p className="msg-info">No open duels from other players.</p></div>
        ) : (
          <div className="surface-grid">
            {otherOpenDuels.map((d) => (
              <DuelCard key={d.duelId} duel={d} action="accept"
                onAction={() => handleAccept(d.duelId, d.player1Bet)} disabled={txInProgress} />
            ))}
          </div>
        )}
      </section>

      {/* My Open Duels */}
      {myOpenDuels.length > 0 && (
        <section>
          <div className="section-title">
            <h2>My Open Duels</h2>
            <span className="msg-info">{myOpenDuels.length} pending</span>
          </div>
          <div className="surface-grid">
            {myOpenDuels.map((d) => (
              <DuelCard key={d.duelId} duel={d} action="cancel"
                onAction={() => handleCancel(d.duelId)} disabled={txInProgress} />
            ))}
          </div>
        </section>
      )}

      {/* Active Duels */}
      {myActiveDuels.length > 0 && (
        <section>
          <div className="section-title">
            <h2>Active Duels</h2>
            <span className="msg-info">{myActiveDuels.length} in progress</span>
          </div>
          <div className="surface-grid">
            {myActiveDuels.map((d) => (
              <DuelCard key={d.duelId} duel={d} action="battle"
                onAction={() => handleEnterBattle(d.duelId)} disabled={txInProgress} />
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {myHistory.length > 0 && (
        <section>
          <div className="section-title">
            <h2>Duel History</h2>
            <span className="msg-info">{myHistory.length} past duels</span>
          </div>
          <div className="surface-grid">
            {myHistory.map((d) => (
              <DuelCard key={d.duelId} duel={d} action="none" disabled={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DuelCard({
  duel, action, onAction, disabled,
}: {
  duel: DuelInfo;
  action: "accept" | "cancel" | "claim" | "battle" | "none";
  onAction?: () => void;
  disabled: boolean;
}) {
  const statusLabels = ["Open", "Active", "Settled", "Cancelled", "Expired"];
  const statusColors = ["blue", "yellow", "blue", "red", "red"] as const;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = duel.createdAt + 86400;
  const isExpired = duel.status === 1 && now > expiresAt;

  return (
    <ArcanaPanel variant="slate" className="duel-card">
      <div className="duel-card-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "var(--color-parchment)" }}>Duel #{duel.duelId}</strong>
          <ArcanaRibbon variant={statusColors[duel.status]}>{statusLabels[duel.status]}</ArcanaRibbon>
        </div>
        <div className="stat-row">
          <span className="stat-label">Challenger</span>
          <span className="stat-value">{shortAddr(duel.player1)}</span>
        </div>
        {duel.player2 !== ZERO && (
          <div className="stat-row">
            <span className="stat-label">Opponent</span>
            <span className="stat-value">{shortAddr(duel.player2)}</span>
          </div>
        )}
        <div className="stat-row">
          <span className="stat-label">Bet</span>
          <span className="stat-value">
            {formatEther(duel.status >= 1 ? duel.lockedBet : duel.player1Bet)} ETH
          </span>
        </div>
        {duel.status === 1 && (
          <div className="stat-row">
            <span className="stat-label">{isExpired ? "Status" : "Expires in"}</span>
            <span className="stat-value">{isExpired ? "Claimable" : formatTimeLeft(expiresAt - now)}</span>
          </div>
        )}
        {duel.winner !== ZERO && (
          <div className="stat-row">
            <span className="stat-label">Winner</span>
            <span className="stat-value" style={{ color: "var(--color-gold)" }}>{shortAddr(duel.winner)}</span>
          </div>
        )}
        {action !== "none" && onAction && (
          <ArcanaButton
            variant={action === "cancel" ? "red" : action === "battle" ? "gold" : "blue"}
            size="sm"
            onClick={onAction}
            disabled={disabled || (action === "claim" && !isExpired)}
          >
            {action === "battle" ? "Enter Battle" :
             action === "accept" ? `Accept (${formatEther(duel.player1Bet)} ETH)` :
             action === "cancel" ? "Cancel Duel" :
             "Claim Expired"}
          </ArcanaButton>
        )}
      </div>
    </ArcanaPanel>
  );
}
