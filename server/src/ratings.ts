import { readFileSync, writeFileSync } from 'fs';
import type { DuelResults } from './protocol.js';

const K_FACTOR = 32;
const STARTING_ELO = 1000;
const XP_WIN = 50;
const XP_LOSS = 20;
const XP_DRAW = 30;
const ELO_FILE = 'elo-data.json';

let elos: Record<string, number> = {};
try { elos = JSON.parse(readFileSync(ELO_FILE, 'utf-8')); } catch { /* fresh start */ }

function persist(): void {
  try { writeFileSync(ELO_FILE, JSON.stringify(elos, null, 2)); } catch { /* ignore */ }
}

export function getElo(address: string): number {
  return elos[address.toLowerCase()] ?? STARTING_ELO;
}

function setElo(address: string, elo: number): void {
  elos[address.toLowerCase()] = Math.max(0, Math.round(elo));
  persist();
}

export function calculateResults(
  winnerAddress: string,
  loserAddress: string,
  isDraw: boolean,
  turnCount: number,
): DuelResults {
  const eloW = getElo(winnerAddress);
  const eloL = getElo(loserAddress);

  const expectedW = 1 / (1 + Math.pow(10, (eloL - eloW) / 400));
  const expectedL = 1 - expectedW;

  let scoreW: number, scoreL: number;
  let xpW: number, xpL: number;

  if (isDraw) {
    scoreW = 0.5;
    scoreL = 0.5;
    xpW = XP_DRAW;
    xpL = XP_DRAW;
  } else {
    scoreW = 1;
    scoreL = 0;
    xpW = XP_WIN;
    xpL = XP_LOSS;
  }

  const eloChangeW = Math.round(K_FACTOR * (scoreW - expectedW));
  const eloChangeL = Math.round(K_FACTOR * (scoreL - expectedL));
  const newEloW = Math.max(0, eloW + eloChangeW);
  const newEloL = Math.max(0, eloL + eloChangeL);

  setElo(winnerAddress, newEloW);
  setElo(loserAddress, newEloL);

  return {
    winnerAddress,
    loserAddress,
    xpGainWinner: xpW,
    xpGainLoser: xpL,
    eloChangeWinner: eloChangeW,
    eloChangeLoser: eloChangeL,
    newEloWinner: newEloW,
    newEloLoser: newEloL,
    turnCount,
  };
}
