import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "../contracts";

const ZERO = "0x0000000000000000000000000000000000000000";

export type DuelInfo = {
  duelId: number;
  player1: string;
  player2: string;
  player1Bet: bigint;
  player2Bet: bigint;
  lockedBet: bigint;
  createdAt: number;
  settledAt: number;
  status: number;
  winner: string;
};

export type PlayerStats = {
  elo: number;
  matchCount: number;
  isCalibrated: boolean;
  isFreed: boolean;
  seasonId: number;
};

export function useDuelLobby() {
  const { address, isConnected } = useAccount();
  const me = address?.toLowerCase() ?? "";

  const { data: duelCount } = useReadContract({
    ...CONTRACTS.duelManager,
    functionName: "duelCount",
    query: { refetchInterval: 10_000 },
  });

  const total = Number(duelCount ?? 0n);

  const ids = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < total; i++) out.push(i);
    return out;
  }, [total]);

  const { data: duelResults, refetch: refetchDuels } = useReadContracts({
    contracts: ids.map((id) => ({
      ...CONTRACTS.duelManager,
      functionName: "getDuel" as const,
      args: [BigInt(id)],
    })),
    query: { enabled: total > 0, refetchInterval: 10_000 },
  });

  const allDuels: DuelInfo[] = useMemo(() => {
    if (!duelResults) return [];
    return ids
      .map((id, i) => {
        const r = duelResults[i];
        if (r?.status !== "success") return null;
        const d = r.result as {
          player1: string; player2: string;
          player1Bet: bigint; player2Bet: bigint; lockedBet: bigint;
          createdAt: bigint; settledAt: bigint;
          status: number; winner: string;
        };
        if (d.player1 === ZERO) return null;
        return {
          duelId: id,
          player1: d.player1,
          player2: d.player2,
          player1Bet: d.player1Bet,
          player2Bet: d.player2Bet,
          lockedBet: d.lockedBet,
          createdAt: Number(d.createdAt),
          settledAt: Number(d.settledAt),
          status: Number(d.status),
          winner: d.winner,
        };
      })
      .filter((x): x is DuelInfo => x !== null);
  }, [ids, duelResults]);

  const otherOpenDuels = useMemo(
    () => allDuels.filter((d) => d.status === 0 && d.player1.toLowerCase() !== me),
    [allDuels, me],
  );
  const myOpenDuels = useMemo(
    () => allDuels.filter((d) => d.status === 0 && d.player1.toLowerCase() === me),
    [allDuels, me],
  );
  const myActiveDuels = useMemo(
    () => allDuels.filter((d) => d.status === 1 && (d.player1.toLowerCase() === me || d.player2.toLowerCase() === me)),
    [allDuels, me],
  );
  const myHistory = useMemo(
    () => allDuels.filter((d) => [2, 3, 4].includes(d.status) && (d.player1.toLowerCase() === me || d.player2.toLowerCase() === me)),
    [allDuels, me],
  );

  const { data: statsResults } = useReadContracts({
    contracts: address
      ? [
          { ...CONTRACTS.duelManager, functionName: "getElo" as const, args: [address] },
          { ...CONTRACTS.duelManager, functionName: "getMatchCount" as const, args: [address] },
          { ...CONTRACTS.duelManager, functionName: "isCalibrated" as const, args: [address] },
          { ...CONTRACTS.freedomRecord, functionName: "isFreed" as const, args: [address] },
          { ...CONTRACTS.duelManager, functionName: "seasonId" as const },
        ]
      : [],
    query: { enabled: isConnected && !!address },
  });

  const playerStats: PlayerStats | null = useMemo(() => {
    if (!statsResults) return null;
    const elo = statsResults[0]?.status === "success" ? Number(statsResults[0].result as bigint) : 1000;
    const matchCount = statsResults[1]?.status === "success" ? Number(statsResults[1].result as bigint) : 0;
    const isCalibrated = statsResults[2]?.status === "success" ? (statsResults[2].result as boolean) : false;
    const isFreed = statsResults[3]?.status === "success" ? (statsResults[3].result as boolean) : false;
    const seasonId = statsResults[4]?.status === "success" ? Number(statsResults[4].result) : 1;
    return { elo, matchCount, isCalibrated, isFreed, seasonId };
  }, [statsResults]);

  return {
    allDuels,
    otherOpenDuels,
    myOpenDuels,
    myActiveDuels,
    myHistory,
    playerStats,
    isLoading: total > 0 && !duelResults,
    refetch: refetchDuels,
  };
}
