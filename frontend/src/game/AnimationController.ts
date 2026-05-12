// frontend/src/game/AnimationController.ts

import { Container } from '../engine/nodes/Container';
import { AnimatedSprite } from '../engine/nodes/AnimatedSprite';
import { SpriteSheet } from '../engine/textures/SpriteSheet';
import type { Engine } from '../engine/Engine';
import type { Texture } from '../engine/textures/Texture';
import {
  unitSpriteConfigs,
  buildingSpriteConfigs,
  getAnimForState,
  getAttackAnim,
  sheepSpriteConfig,
  type AnimState,
  type AnimDefinition,
  type UnitSpriteConfig,
} from './spriteConfig';
import { getCard, isBuilding } from './cardRegistry';
import { hex2px } from './hexUtils';
import { HEX_SIZE, UNIT_TARGET_HEIGHT, BUILDING_1x1_TARGET_HEIGHT, BUILDING_2x2_TARGET_HEIGHT } from './constants';

export type AttackDirection = 'top' | 'topright' | 'side' | 'bottomright' | 'bottom';

export function getAttackDirection(
  fromCol: number, fromRow: number,
  toCol: number, toRow: number,
): AttackDirection {
  const from = hex2px(fromCol, fromRow);
  const to = hex2px(toCol, toRow);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // atan2 gives angle in radians; dy is inverted (screen y goes down)
  const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  if (angle > 60) return 'top';
  if (angle > 30) return 'topright';
  if (angle > -30) return 'side';
  if (angle > -60) return 'bottomright';
  return 'bottom';
}

export class AnimationController {
  private engine: Engine;
  private cardId: number;
  private playerId: number;
  private container: Container;
  private sprite: AnimatedSprite | null = null;
  private currentState: AnimState | null = null;
  private textureCache: Map<string, Texture[]> = new Map();
  private unitConfig: UnitSpriteConfig | undefined;
  private isBuildingUnit: boolean;
  private baseScale: number = 1;
  private flipX: boolean;

  constructor(engine: Engine, cardId: number, playerId: number) {
    this.engine = engine;
    this.cardId = cardId;
    this.playerId = playerId;
    this.container = new Container();
    this.flipX = playerId === 1;

    const card = getCard(cardId);
    this.isBuildingUnit = isBuilding(card);
    this.unitConfig = unitSpriteConfigs[cardId];
  }

  getContainer(): Container {
    return this.container;
  }

  async playIdle(): Promise<void> {
    if (this.isBuildingUnit) {
      await this.loadBuildingSprite();
      return;
    }
    const cfg = this.unitConfig;
    if (!cfg) return;
    const state = cfg.defaultState ?? 'idle';
    await this.switchAnim(state, true);
  }

  async playRun(): Promise<void> {
    if (this.isBuildingUnit) return;
    const cfg = this.unitConfig;
    if (!cfg) return;
    const anim = getAnimForState(cfg, 'run');
    if (anim) {
      await this.switchAnim('run', true);
    }
  }

  async playAttack(direction: AttackDirection, targetIsLeft: boolean): Promise<void> {
    if (this.isBuildingUnit) return;
    const cfg = this.unitConfig;
    if (!cfg) return;
    const anim = getAttackAnim(cfg, direction);
    if (!anim) return;
    await this.switchAnim(anim.state, false, targetIsLeft);
    await this.waitForComplete();
    await this.playIdle();
  }

  async playDeath(): Promise<void> {
    if (this.isBuildingUnit) {
      return;
    }
    const cfg = this.unitConfig;
    if (!cfg) return;

    const deathAnim = getAnimForState(cfg, 'death') ?? getAnimForState(cfg, 'exploding');
    if (deathAnim) {
      await this.switchAnim(deathAnim.state, false);
      await this.waitForComplete();
    }
  }

  async fadeTo(targetAlpha: number, durationSec: number): Promise<void> {
    const startAlpha = this.container.alpha;
    const delta = targetAlpha - startAlpha;
    if (Math.abs(delta) < 0.001) return;

    return new Promise<void>((resolve) => {
      let elapsed = 0;
      const tick = (dt: number) => {
        elapsed += dt;
        const t = Math.min(elapsed / durationSec, 1);
        this.container.alpha = startAlpha + delta * t;
        if (t >= 1) {
          this.engine.ticker.remove(tick);
          resolve();
        }
      };
      this.engine.ticker.add(tick);
    });
  }

  async swapToSheep(): Promise<void> {
    const anim = getAnimForState(sheepSpriteConfig, 'idle');
    if (!anim) return;

    const cacheKey = 'sheep_idle';
    let frames = this.textureCache.get(cacheKey);
    if (!frames) {
      const tex = await this.engine.textures.load('sheep_idle', `${sheepSpriteConfig.basePath}/${anim.file}`);
      frames = SpriteSheet.fromStrip(tex, anim.frameWidth);
      this.textureCache.set(cacheKey, frames);
    }

    if (this.sprite) {
      this.sprite.stop();
      this.container.removeChild(this.sprite);
    }

    const spr = new AnimatedSprite(frames);
    spr.anchor.set(0.5, 0.75);
    const s = UNIT_TARGET_HEIGHT / anim.frameHeight;
    spr.scale.set(s, s);
    spr.animationSpeed = 0.12;
    spr.loop = true;
    spr.gotoAndPlay(0);
    this.sprite = spr;
    this.container.addChild(spr);
  }

  async restoreFromSheep(): Promise<void> {
    await this.playIdle();
  }

  destroy(): void {
    if (this.sprite) {
      this.sprite.stop();
    }
    this.container.parent?.removeChild(this.container);
    this.textureCache.clear();
  }

  // ── Private ──────────────────────────────────────────

  private async loadBuildingSprite(): Promise<void> {
    if (this.sprite) return;
    const cfg = buildingSpriteConfigs[this.cardId];
    if (!cfg) return;

    const tex = await this.engine.textures.load(`bld_${this.cardId}`, cfg.file);
    const spr = new AnimatedSprite([tex]);
    spr.anchor.set(0.5, 0.85);
    const card = getCard(this.cardId);
    const targetH = card.size >= 2 ? BUILDING_2x2_TARGET_HEIGHT : BUILDING_1x1_TARGET_HEIGHT;
    const s = targetH / Math.max(cfg.width, cfg.height);
    spr.scale.set(s, s);
    this.sprite = spr;
    this.container.addChild(spr);
  }

  private async switchAnim(state: AnimState, loop: boolean, forceFlipLeft?: boolean): Promise<void> {
    const cfg = this.unitConfig;
    if (!cfg) return;

    const anim = getAnimForState(cfg, state);
    if (!anim) return;

    const cacheKey = `${this.cardId}_${state}`;
    let frames = this.textureCache.get(cacheKey);

    if (!frames) {
      const texKey = `u${this.cardId}_${state}`;
      const tex = await this.engine.textures.load(texKey, `${cfg.basePath}/${anim.file}`);
      frames = anim.source === 'grid'
        ? SpriteSheet.fromGridRow(tex, anim.frameWidth, anim.frameHeight, anim.row! - 1, anim.frameCount)
        : SpriteSheet.fromStrip(tex, anim.frameWidth);
      this.textureCache.set(cacheKey, frames);
    }

    if (this.sprite) {
      this.sprite.stop();
      this.container.removeChild(this.sprite);
    }

    const spr = new AnimatedSprite(frames);
    spr.anchor.set(0.5, 0.75);
    const s = UNIT_TARGET_HEIGHT / anim.frameHeight;
    this.baseScale = s;

    // For attacks: flip based on target direction, not player side
    // For idle/run: flip based on player side (P2 faces left)
    let shouldFlip: boolean;
    if (forceFlipLeft !== undefined) {
      shouldFlip = forceFlipLeft;
    } else {
      shouldFlip = this.flipX && (anim.flipForLeft !== false);
    }
    spr.scale.set(shouldFlip ? -s : s, s);

    spr.animationSpeed = 0.12;
    spr.loop = loop;
    spr.gotoAndPlay(0);

    this.sprite = spr;
    this.currentState = state;
    this.container.addChild(spr);
  }

  private waitForComplete(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.sprite || this.sprite.loop) {
        resolve();
        return;
      }
      this.sprite.onComplete = () => {
        if (this.sprite) this.sprite.onComplete = null;
        resolve();
      };
    });
  }
}
