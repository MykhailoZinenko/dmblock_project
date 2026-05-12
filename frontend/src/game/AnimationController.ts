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
  type AnimState,
  type UnitSpriteConfig,
} from './spriteConfig';
import { getCard, isBuilding } from './cardRegistry';
import { hex2px } from './hexUtils';
import { UNIT_TARGET_HEIGHT, BUILDING_1x1_TARGET_HEIGHT, BUILDING_2x2_TARGET_HEIGHT } from './constants';

export type AttackDirection = 'top' | 'topright' | 'side' | 'bottomright' | 'bottom';

export class AnimationController {
  private engine: Engine;
  private cardId: number;
  private container: Container;
  private sprite: AnimatedSprite | null = null;
  private textureCache: Map<string, Texture[]> = new Map();
  private originalConfig: UnitSpriteConfig | undefined;
  private activeConfig: UnitSpriteConfig | undefined;
  private isBuildingUnit: boolean;
  private flipX: boolean;

  constructor(engine: Engine, cardId: number, playerId: number) {
    this.engine = engine;
    this.cardId = cardId;
    this.container = new Container();
    this.flipX = playerId === 1;

    const card = getCard(cardId);
    this.isBuildingUnit = isBuilding(card);
    this.originalConfig = unitSpriteConfigs[cardId];
    this.activeConfig = this.originalConfig;
  }

  getContainer(): Container {
    return this.container;
  }

  swapConfig(cfg: UnitSpriteConfig): void {
    this.activeConfig = cfg;
  }

  restoreConfig(): void {
    this.activeConfig = this.originalConfig;
  }

  async playIdle(): Promise<void> {
    if (this.isBuildingUnit) {
      await this.loadBuildingSprite();
      return;
    }
    const cfg = this.activeConfig;
    if (!cfg) return;
    const state = cfg.defaultState ?? 'idle';
    await this.switchAnim(cfg, state, true);
  }

  async playRun(): Promise<void> {
    if (this.isBuildingUnit) return;
    const cfg = this.activeConfig;
    if (!cfg) return;
    const anim = getAnimForState(cfg, 'run');
    if (anim) {
      await this.switchAnim(cfg, 'run', true);
    }
  }

  async playAttack(direction: AttackDirection, targetIsLeft: boolean): Promise<void> {
    if (this.isBuildingUnit) return;
    const cfg = this.activeConfig;
    if (!cfg) return;
    const anim = getAttackAnim(cfg, direction);
    if (!anim) return;
    await this.switchAnim(cfg, anim.state, false, targetIsLeft);
    await this.waitForComplete();
    await this.playIdle();
  }

  async playDeath(): Promise<void> {
    if (this.isBuildingUnit) return;
    const cfg = this.activeConfig;
    if (!cfg) return;
    const deathAnim = getAnimForState(cfg, 'death') ?? getAnimForState(cfg, 'exploding');
    if (deathAnim) {
      await this.switchAnim(cfg, deathAnim.state, false);
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

  private async switchAnim(cfg: UnitSpriteConfig, state: AnimState, loop: boolean, forceFlipLeft?: boolean): Promise<void> {
    const anim = getAnimForState(cfg, state);
    if (!anim) return;

    const cacheKey = `${cfg.cardId}_${state}`;
    let frames = this.textureCache.get(cacheKey);

    if (!frames) {
      const texKey = `u${cfg.cardId}_${state}`;
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
