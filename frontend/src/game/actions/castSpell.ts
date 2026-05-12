import type { GameState } from '../GameState';
import type { HexCoord, UnitInstance, ActiveEffect } from '../types';
import { CardType, SpellTargetType, DamageType, Faction } from '../types';
import { getCard, isBuilding } from '../cardRegistry';
import { hexDistance } from '../hexUtils';
import { applyDamage } from '../combat';
import { GRID_COLS, GRID_ROWS } from '../constants';
import { HERO_HEX, HERO_ADJACENT, isBarrierUp } from './heroActions';
import type { SeededRNG } from '../rng';

const HEALING_CARD_ID = 10;
const STATUS_ONLY_IDS = new Set([15, 16]); // Polymorph, Curse

export interface CastResult {
  success: boolean;
  affectedUnits: {
    uid: number;
    damage?: number;
    healed?: number;
    statusApplied?: 'slow' | 'polymorph' | 'curse';
    died?: boolean;
  }[];
  heroDamage?: {
    playerId: number;
    damage: number;
    heroDied: boolean;
  };
}

export function getSpellTargets(
  state: GameState,
  playerId: number,
  cardId: number,
): HexCoord[] {
  const card = getCard(cardId);
  if (card.cardType !== CardType.SPELL) return [];

  const targets: HexCoord[] = [];

  const isDamageSpell = card.spellPower > 0 && !STATUS_ONLY_IDS.has(cardId);

  if (card.spellTargetType === SpellTargetType.SINGLE) {
    const isHeal = cardId === HEALING_CARD_ID;
    for (const unit of state.units) {
      if (!unit.alive) continue;
      if (isHeal && unit.playerId !== playerId) continue;
      if (!isHeal && unit.playerId === playerId) continue;
      targets.push({ col: unit.col, row: unit.row });
    }
    // Exposed enemy hero is a valid target for damage spells
    if (isDamageSpell && !isHeal) {
      const enemyPid = playerId === 0 ? 1 : 0;
      if (!isBarrierUp(state, enemyPid)) {
        const hh = HERO_HEX[enemyPid];
        targets.push({ col: hh.col, row: hh.row });
      }
    }
  } else if (card.spellTargetType === SpellTargetType.AREA) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        targets.push({ col: c, row: r });
      }
    }
    // Include hero hex for AoE if barrier down
    if (isDamageSpell) {
      const enemyPid = playerId === 0 ? 1 : 0;
      if (!isBarrierUp(state, enemyPid)) {
        const hh = HERO_HEX[enemyPid];
        targets.push({ col: hh.col, row: hh.row });
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

  const effect: ActiveEffect = { cardId, type, activationsLeft: duration, originalStats: original };
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

  // Cap remaining AP to new speed so effects apply immediately this turn
  if (unit.remainingAp > unit.speed) {
    unit.remainingAp = unit.speed;
  }
}

function checkHeroSpellHit(
  state: GameState,
  casterId: number,
  targetHex: HexCoord,
  spellPower: number,
): CastResult['heroDamage'] | null {
  const enemyPid = casterId === 0 ? 1 : 0;
  const hh = HERO_HEX[enemyPid];
  if (targetHex.col !== hh.col || targetHex.row !== hh.row) return null;
  if (isBarrierUp(state, enemyPid)) return null;

  const damage = Math.max(1, spellPower);
  state.players[enemyPid].heroHp -= damage;
  const heroDied = state.players[enemyPid].heroHp <= 0;
  if (heroDied) state.players[enemyPid].heroHp = 0;
  return { playerId: enemyPid, damage, heroDied };
}

export function executeCast(
  state: GameState,
  playerId: number,
  cardId: number,
  targetHex: HexCoord | null,
): CastResult {
  const card = getCard(cardId);

  state.players[playerId].mana -= card.manaCost;

  const hand = state.players[playerId].hand;
  const hi = hand.indexOf(cardId);
  if (hi !== -1) hand.splice(hi, 1);

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
    // Check if targeting hero hex
    const heroHit = checkHeroSpellHit(state, playerId, targetHex, card.spellPower);
    if (heroHit) {
      return { success: true, affectedUnits: affected, heroDamage: heroHit };
    }

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
    let heroDamageResult: CastResult['heroDamage'];
    for (const unit of state.units) {
      if (!unit.alive || unit.playerId === playerId) continue;
      const dist = hexDistance(targetHex.col, targetHex.row, unit.col, unit.row);
      if (dist <= 1) {
        const { damage, died } = applySpellDamage(state, unit, card.spellPower, card);
        affected.push({ uid: unit.uid, damage, died });
      }
    }
    // AoE can hit exposed hero if hero hex or adjacent hex is in range
    const enemyPid = playerId === 0 ? 1 : 0;
    if (!isBarrierUp(state, enemyPid)) {
      const hh = HERO_HEX[enemyPid];
      const dist = hexDistance(targetHex.col, targetHex.row, hh.col, hh.row);
      if (dist <= 1) {
        const damage = Math.max(1, card.spellPower);
        state.players[enemyPid].heroHp -= damage;
        const heroDied = state.players[enemyPid].heroHp <= 0;
        if (heroDied) state.players[enemyPid].heroHp = 0;
        heroDamageResult = { playerId: enemyPid, damage, heroDied };
      }
    }
    return { success: true, affectedUnits: affected, heroDamage: heroDamageResult };
  }

  return { success: true, affectedUnits: affected };
}

/**
 * Called when a unit finishes its activation.
 * Decrements activationsLeft for all effects on that unit.
 */
export function tickUnitEffects(unit: UnitInstance): void {
  if (!unit.activeEffects?.length) return;
  for (const effect of unit.activeEffects) {
    effect.activationsLeft--;
  }
}

/**
 * Called at turn start. Removes expired effects (activationsLeft <= 0),
 * restores original stats. Returns UIDs of units whose effects expired.
 */
export function tickStatusEffects(state: GameState): number[] {
  const expiredUids: number[] = [];

  for (const unit of state.units) {
    if (!unit.alive || !unit.activeEffects?.length) continue;

    const remaining: ActiveEffect[] = [];
    for (const effect of unit.activeEffects) {
      if (effect.activationsLeft <= 0) {
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
