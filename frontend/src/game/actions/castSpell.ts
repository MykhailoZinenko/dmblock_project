import type { GameState } from '../GameState';
import type { HexCoord, UnitInstance, ActiveEffect } from '../types';
import { CardType, SpellTargetType, DamageType, Faction } from '../types';
import { getCard, isBuilding } from '../cardRegistry';
import { hexDistance } from '../hexUtils';
import { applyDamage } from '../combat';
import { GRID_COLS, GRID_ROWS } from '../constants';
import type { SeededRNG } from '../rng';

const HEALING_CARD_ID = 10;

export interface CastResult {
  success: boolean;
  affectedUnits: {
    uid: number;
    damage?: number;
    healed?: number;
    statusApplied?: 'slow' | 'polymorph' | 'curse';
    died?: boolean;
  }[];
}

export function getSpellTargets(
  state: GameState,
  playerId: number,
  cardId: number,
): HexCoord[] {
  const card = getCard(cardId);
  if (card.cardType !== CardType.SPELL) return [];

  const targets: HexCoord[] = [];

  if (card.spellTargetType === SpellTargetType.SINGLE) {
    const isHeal = cardId === HEALING_CARD_ID;
    for (const unit of state.units) {
      if (!unit.alive) continue;
      if (isHeal && unit.playerId !== playerId) continue;
      if (!isHeal && unit.playerId === playerId) continue;
      targets.push({ col: unit.col, row: unit.row });
    }
  } else if (card.spellTargetType === SpellTargetType.AREA) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        targets.push({ col: c, row: r });
      }
    }
  }

  return targets;
}

export function canCast(
  state: GameState,
  playerId: number,
  cardId: number,
  targetHex: HexCoord | null,
): { valid: boolean; reason?: string } {
  const card = getCard(cardId);
  if (card.cardType !== CardType.SPELL) {
    return { valid: false, reason: 'Not a spell card' };
  }
  if (state.players[playerId].mana < card.manaCost) {
    return { valid: false, reason: 'Not enough mana' };
  }
  if (card.spellTargetType === SpellTargetType.SINGLE || card.spellTargetType === SpellTargetType.AREA) {
    if (!targetHex) return { valid: false, reason: 'No target selected' };
    const validTargets = getSpellTargets(state, playerId, cardId);
    const isValid = validTargets.some(h => h.col === targetHex.col && h.row === targetHex.row);
    if (!isValid) return { valid: false, reason: 'Invalid target hex' };
  }
  return { valid: true };
}

function applySpellDamage(
  state: GameState,
  target: UnitInstance,
  spellPower: number,
  card: ReturnType<typeof getCard>,
): { damage: number; died: boolean } {
  const targetCard = getCard(target.cardId);
  let damage = spellPower;

  const targetIsBuilding = isBuilding(targetCard);
  if (targetIsBuilding && card.faction === Faction.INFERNO) {
    // Inferno bypasses building MR (physical conversion)
  } else if (target.magicResistance > 0) {
    damage = Math.floor(damage * (1 - target.magicResistance / 100));
  }

  damage = Math.max(1, damage);
  const died = applyDamage(state, target.uid, damage);
  return { damage, died };
}

function applyStatus(
  unit: UnitInstance,
  type: ActiveEffect['type'],
  duration: number,
  cardId: number,
): void {
  const original = { attack: unit.attack, defense: unit.defense, speed: unit.speed };

  // +1 so the effect survives the rest of the current turn and lasts `duration` full turns
  const effect: ActiveEffect = { cardId, type, turnsRemaining: duration + 1, originalStats: original };
  unit.activeEffects.push(effect);

  if (type === 'slow') {
    unit.speed = Math.max(1, unit.speed - 1);
  } else if (type === 'polymorph') {
    unit.attack = 0;
    unit.defense = 0;
    unit.speed = 1;
    unit.polymorphed = true;
  } else if (type === 'curse') {
    unit.attack = Math.floor(unit.attack / 2);
    unit.defense = Math.floor(unit.defense / 2);
    unit.cursed = true;
  }
}

export function executeCast(
  state: GameState,
  playerId: number,
  cardId: number,
  targetHex: HexCoord | null,
): CastResult {
  const card = getCard(cardId);

  state.players[playerId].mana -= card.manaCost;

  if (!state.rng.rollPercent(card.successChance)) {
    return { success: false, affectedUnits: [] };
  }

  const affected: CastResult['affectedUnits'] = [];

  if (cardId === HEALING_CARD_ID && targetHex) {
    const target = state.units.find(u => u.alive && u.col === targetHex.col && u.row === targetHex.row);
    if (target) {
      const healed = Math.min(card.spellPower, target.maxHp - target.currentHp);
      target.currentHp = Math.min(target.maxHp, target.currentHp + card.spellPower);
      affected.push({ uid: target.uid, healed });
    }
  } else if (card.spellTargetType === SpellTargetType.SINGLE && targetHex) {
    const target = state.units.find(u => u.alive && u.col === targetHex.col && u.row === targetHex.row);
    if (target) {
      if (card.spellPower > 0) {
        const { damage, died } = applySpellDamage(state, target, card.spellPower, card);
        const entry: CastResult['affectedUnits'][0] = { uid: target.uid, damage, died };
        if (card.duration > 0 && !died) {
          const statusType = cardId === 15 ? 'polymorph' : cardId === 16 ? 'curse' : 'slow';
          applyStatus(target, statusType, card.duration, cardId);
          entry.statusApplied = statusType;
        }
        affected.push(entry);
      } else {
        const statusType = cardId === 15 ? 'polymorph' : 'curse';
        applyStatus(target, statusType, card.duration, cardId);
        affected.push({ uid: target.uid, statusApplied: statusType });
      }
    }
  } else if (card.spellTargetType === SpellTargetType.AREA && targetHex) {
    for (const unit of state.units) {
      if (!unit.alive || unit.playerId === playerId) continue;
      const dist = hexDistance(targetHex.col, targetHex.row, unit.col, unit.row);
      if (dist <= 1) {
        const { damage, died } = applySpellDamage(state, unit, card.spellPower, card);
        affected.push({ uid: unit.uid, damage, died });
      }
    }
  }

  return { success: true, affectedUnits: affected };
}

export function tickStatusEffects(state: GameState): number[] {
  const expiredUids: number[] = [];

  for (const unit of state.units) {
    if (!unit.alive || !unit.activeEffects?.length) continue;

    const remaining: ActiveEffect[] = [];
    for (const effect of unit.activeEffects) {
      effect.turnsRemaining--;
      if (effect.turnsRemaining <= 0) {
        if (effect.originalStats) {
          unit.attack = effect.originalStats.attack;
          unit.defense = effect.originalStats.defense;
          unit.speed = effect.originalStats.speed;
        }
        if (effect.type === 'polymorph') unit.polymorphed = false;
        if (effect.type === 'curse') unit.cursed = false;
        expiredUids.push(unit.uid);
      } else {
        remaining.push(effect);
      }
    }
    unit.activeEffects = remaining;
  }

  return expiredUids;
}
