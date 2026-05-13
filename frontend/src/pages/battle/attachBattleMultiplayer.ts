import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { ConnectionManager } from "../../multiplayer/ConnectionManager";
import { MatchManager } from "../../multiplayer/MatchManager";
import { listDecks } from "../../lib/deckStorage";
import { DECK_SIZE } from "../../lib/deckValidation";
import { HERO_HP } from "../../game/constants";
import type { GameController } from "../../game/GameController";
import type { BattleScene } from "../../game/BattleScene";
import type { GameAction } from "../../multiplayer/protocol";
import type { BattlePriorityState } from "./battleTypes";

export interface AttachBattleMultiplayerInput {
  duelId: number;
  address: string;
  connRef: MutableRefObject<ConnectionManager | null>;
  matchRef: MutableRefObject<MatchManager | null>;
  getCtrl: () => GameController | null;
  getScene: () => BattleScene | null;
  prioRef: MutableRefObject<BattlePriorityState>;
  phaseRef: MutableRefObject<BattleTurnPhase>;
  setPriority: Dispatch<SetStateAction<BattlePriorityState>>;
  syncUI: () => void;
  advanceTurn: () => void;
  resetTimer: () => void;
  handleWinCheck: () => boolean;
  checkBarrierChange: () => void;
  setMultiplayerStatus: (s: string) => void;
  onMatchGameOver: (winner: number) => void;
}

/**
 * Owns WebRTC + MatchManager wiring for `/battle?duel=…`.
 * Game rules and animations stay in `Battle.tsx`; this layer only connects,
 * exchanges decks, starts the shared `GameController`, and mirrors peer actions into the scene.
 */
export function attachBattleMultiplayer(p: AttachBattleMultiplayerInput): () => void {
  const conn = new ConnectionManager("ws://localhost:3001");
  p.connRef.current = conn;

  const match = new MatchManager(conn);
  p.matchRef.current = match;

  const onPaired = () => {
    p.setMultiplayerStatus("Connected to opponent. Exchanging decks...");
  };

  const onConnected = async () => {
    const deadline = Date.now() + 30_000;
    let ctrl: GameController | null = null;
    while (Date.now() < deadline) {
      ctrl = p.getCtrl();
      if (ctrl) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!ctrl) {
      p.setMultiplayerStatus("Game engine not ready — refresh the page.");
      return;
    }

    const decks = listDecks(p.address);
    const validDeck = decks.find((d) => d.slots.filter((s) => s !== null).length === DECK_SIZE);
    if (!validDeck) {
      p.setMultiplayerStatus("No valid deck found!");
      return;
    }

    const myDeckIds = validDeck.slots.filter((s): s is number => s !== null);

    await match.exchangeDecks(myDeckIds);
    match.startGame(p.duelId, ctrl);
    p.syncUI();

    match.on("opponent-action", (action: GameAction) => {
      const scene = p.getScene();
      const c = p.getCtrl();
      if (!scene || !c) {
        p.syncUI();
        return;
      }
      const state = c.getState();

      switch (action.type) {
        case "spawn": {
          const unit = state.units.find((u) => u.alive && u.col === action.col && u.row === action.row);
          if (!unit) break;
          scene.spawnUnit(unit);
          const prev = p.prioRef.current;
          const newSpawned = new Set(prev.spawnedThisTurn);
          newSpawned.add(unit.uid);
          if (action.priorityPhase) {
            const newPrio: BattlePriorityState = {
              ...prev,
              p0Used: action.playerId === 0 ? true : prev.p0Used,
              p1Used: action.playerId === 1 ? true : prev.p1Used,
              spawnedThisTurn: newSpawned,
              activatedThisTurn: prev.activatedThisTurn,
            };
            p.setPriority(newPrio);
            p.prioRef.current = newPrio;
          } else {
            const newPrio: BattlePriorityState = { ...prev, spawnedThisTurn: newSpawned };
            p.setPriority(newPrio);
            p.prioRef.current = newPrio;
          }
          scene.clearHighlights();
          p.advanceTurn();
          break;
        }
        case "pass": {
          if (action.priorityPhase && action.priorityPlayerId !== undefined) {
            const pid = action.priorityPlayerId;
            const prev = p.prioRef.current;
            const newPrio: BattlePriorityState = {
              ...prev,
              p0Used: pid === 0 ? true : prev.p0Used,
              p1Used: pid === 1 ? true : prev.p1Used,
            };
            p.setPriority(newPrio);
            p.prioRef.current = newPrio;
            scene.clearHighlights();
          } else if (action.releasedUnitUid !== undefined) {
            const prev = p.prioRef.current;
            const newA = new Set(prev.activatedThisTurn);
            newA.add(action.releasedUnitUid);
            const newPrio: BattlePriorityState = { ...prev, activatedThisTurn: newA };
            p.setPriority(newPrio);
            p.prioRef.current = newPrio;
            scene.clearHighlights();
            p.resetTimer();
          }
          p.advanceTurn();
          break;
        }
        case "move": {
          const path =
            action.path && action.path.length >= 2
              ? action.path.map((h) => ({ col: h.col, row: h.row }))
              : [];
          if (path.length >= 2) {
            scene.moveUnit(action.unitUid, path, () => {});
          }
          break;
        }
        case "attack": {
          const target = state.units.find((u) => u.uid === action.targetUid);
          const attacker = state.units.find((u) => u.uid === action.attackerUid);
          if (target) {
            scene.updateHpBar(target.uid, target.currentHp, target.maxHp);
            if (!target.alive) scene.playDeath(target.uid, () => {});
          }
          if (attacker) {
            scene.updateHpBar(attacker.uid, attacker.currentHp, attacker.maxHp);
            if (!attacker.alive) scene.playDeath(attacker.uid, () => {});
          }
          break;
        }
        case "attack-hero": {
          const pl = state.players[action.targetPlayerId];
          scene.updateHeroHp(action.targetPlayerId, pl.heroHp, HERO_HP);
          break;
        }
        case "cast": {
          for (const u of state.units) {
            if (u.alive) scene.updateHpBar(u.uid, u.currentHp, u.maxHp);
            else scene.playDeath(u.uid, () => {});
          }
          scene.updateHeroHp(0, state.players[0].heroHp, HERO_HP);
          scene.updateHeroHp(1, state.players[1].heroHp, HERO_HP);
          break;
        }
        default:
          break;
      }

      p.checkBarrierChange();
      p.syncUI();
      p.handleWinCheck();
    });

    match.on("game-over", (winner: number) => {
      p.onMatchGameOver(winner);
    });

    match.on("desync", (myHash: string, theirHash: string) => {
      console.error(`Desync detected! my=${myHash} theirs=${theirHash}`);
      p.setMultiplayerStatus("State desync detected!");
    });

    match.on("opponent-disconnected", () => {
      p.setMultiplayerStatus("Opponent disconnected!");
    });

    p.setMultiplayerStatus("Battle started!");
    setTimeout(() => p.setMultiplayerStatus(""), 2000);
  };

  conn.on("paired", onPaired);
  conn.on("connected", onConnected);
  p.setMultiplayerStatus("Waiting for opponent...");
  conn.join(p.duelId, p.address);

  return () => {
    p.matchRef.current?.destroy();
    p.connRef.current = null;
    p.matchRef.current = null;
  };
}
