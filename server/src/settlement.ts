const SETTLEMENT_TIMEOUT_MS = 120_000;

export interface SettlementState {
  duelId: number;
  winnerAddress: string;
  signatures: [string | null, string | null];
  arbiterTimeout: ReturnType<typeof setTimeout> | null;
}

const settlements = new Map<number, SettlementState>();

export function initSettlement(duelId: number, winnerAddress: string): SettlementState {
  const state: SettlementState = {
    duelId,
    winnerAddress,
    signatures: [null, null],
    arbiterTimeout: null,
  };
  settlements.set(duelId, state);
  return state;
}

export function submitSignature(
  duelId: number,
  seat: 0 | 1,
  signature: string,
): { complete: boolean; signatures: [string | null, string | null] } {
  const state = settlements.get(duelId);
  if (!state) throw new Error('No settlement in progress');
  state.signatures[seat] = signature;
  const complete = state.signatures[0] !== null && state.signatures[1] !== null;
  return { complete, signatures: state.signatures };
}

export function getSettlement(duelId: number): SettlementState | undefined {
  return settlements.get(duelId);
}

export function cleanupSettlement(duelId: number): void {
  const state = settlements.get(duelId);
  if (state?.arbiterTimeout) clearTimeout(state.arbiterTimeout);
  settlements.delete(duelId);
}

export function startArbiterTimeout(
  duelId: number,
  onArbiterSettle: (duelId: number, winnerAddress: string) => void,
): void {
  const state = settlements.get(duelId);
  if (!state) return;
  state.arbiterTimeout = setTimeout(() => {
    onArbiterSettle(duelId, state.winnerAddress);
  }, SETTLEMENT_TIMEOUT_MS);
}
