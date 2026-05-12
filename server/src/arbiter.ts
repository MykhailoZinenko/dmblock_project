import type { GameAction } from "./protocol.js";

type MatchState = {
  duelId: number;
  player1: string; // ETH address
  player2: string;
  actions: GameAction[];
  winner: string | null; // null = ongoing, "0x0" = draw, address = winner
};

const matches = new Map<number, MatchState>();

export function initMatch(duelId: number, player1: string, player2: string): void {
  matches.set(duelId, {
    duelId,
    player1,
    player2,
    actions: [],
    winner: null,
  });
}

export function recordAction(duelId: number, action: GameAction): void {
  const match = matches.get(duelId);
  if (!match) return;
  match.actions.push(action);
}

export function reportGameOver(duelId: number, winnerAddress: string): void {
  const match = matches.get(duelId);
  if (!match) return;
  match.winner = winnerAddress;
}

export function getMatch(duelId: number): MatchState | undefined {
  return matches.get(duelId);
}

export function determineWinnerOnDisconnect(duelId: number, disconnectedAddress: string): string | null {
  const match = matches.get(duelId);
  if (!match) return null;
  if (match.winner) return match.winner;
  // The remaining player wins
  return disconnectedAddress === match.player1 ? match.player2 : match.player1;
}

export function cleanupMatch(duelId: number): void {
  matches.delete(duelId);
}
