// frontend/src/game/BattleScene.ts

import { Engine } from '../engine/Engine';
import { Container } from '../engine/nodes/Container';
import { Graphics } from '../engine/nodes/Graphics';
import { Sprite } from '../engine/nodes/Sprite';
import { Text } from '../engine/nodes/Text';
import { AnimationController, getAttackDirection, type AttackDirection } from './AnimationController';
import { hex2px } from './hexUtils';
import { getCard, isBuilding } from './cardRegistry';
import { AnimatedSprite } from '../engine/nodes/AnimatedSprite';
import { SpriteSheet } from '../engine/textures/SpriteSheet';
import { arrowProjectile, spellFxConfigs, sheepSpriteConfig } from './spriteConfig';
import type { UnitInstance, HexCoord } from './types';
import {
  GRID_COLS, GRID_ROWS, HEX_SIZE,
  P1_DEPLOY_COLS, P2_DEPLOY_COLS,
  UNIT_MOVE_SPEED,
  HP_BAR_WIDTH, HP_BAR_HEIGHT, HP_BAR_Y_OFFSET,
} from './constants';

export interface AttackableTarget {
  unitUid: number;
  cells: HexCoord[];
  autoWalk: boolean;
}

interface UnitEntry {
  uid: number;
  anim: AnimationController;
  container: Container;
  hpBar: Graphics;
  label: Text;
  currentHp: number;
  maxHp: number;
}

export class BattleScene {
  private engine: Engine;
  private gridLayer: Container;
  private hlLayer: Container;
  private unitLayer: Container;
  private hlGfx: Graphics;
  private units: Map<number, UnitEntry> = new Map();

  constructor(engine: Engine) {
    this.engine = engine;

    this.gridLayer = new Container();
    this.gridLayer.zIndex = 0;
    this.hlLayer = new Container();
    this.hlLayer.zIndex = 5;
    this.unitLayer = new Container();
    this.unitLayer.zIndex = 10;

    engine.stage.addChild(this.gridLayer);
    engine.stage.addChild(this.hlLayer);
    engine.stage.addChild(this.unitLayer);

    this.hlGfx = new Graphics();
    this.hlLayer.addChild(this.hlGfx);
    this.hlGfx.visible = false;
  }

  // ── Grid ─────────────────────────────────────────────

  createGrid(): void {
    const grid = new Graphics();
    this.gridLayer.addChild(grid);
    const p1Set = new Set(P1_DEPLOY_COLS);
    const p2Set = new Set(P2_DEPLOY_COLS);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const p = hex2px(c, r);
        if (p1Set.has(c)) {
          grid.lineStyle(2, 0x3366cc);
          grid.beginFill(0x2244aa, 0.2);
        } else if (p2Set.has(c)) {
          grid.lineStyle(2, 0xcc3344);
          grid.beginFill(0xaa2244, 0.2);
        } else {
          grid.lineStyle(2, 0x3a5a3a);
          grid.beginFill(0x2a4a2a, 0.3);
        }
        grid.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
        grid.endFill();
      }
    }
  }

  // ── Units ────────────────────────────────────────────

  async spawnUnit(unit: UnitInstance): Promise<void> {
    const pos = hex2px(unit.col, unit.row);
    const anim = new AnimationController(this.engine, unit.cardId, unit.playerId);
    const container = anim.getContainer();
    container.position.set(pos.x, pos.y);

    // HP bar
    const hpBar = new Graphics();
    this.drawHpBar(hpBar, unit.currentHp, unit.maxHp);
    hpBar.position.set(0, HP_BAR_Y_OFFSET);
    container.addChild(hpBar);

    // Name label
    const card = getCard(unit.cardId);
    const lbl = new Text(card.name, {
      fontSize: 14,
      fill: unit.playerId === 0 ? 0x6699ff : 0xff6666,
    });
    lbl.position.set(-20, -HEX_SIZE * 0.9);
    container.addChild(lbl);

    this.unitLayer.addChild(container);
    await anim.playIdle();

    this.units.set(unit.uid, {
      uid: unit.uid,
      anim,
      container,
      hpBar,
      label: lbl,
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
    });
  }

  moveUnit(uid: number, path: HexCoord[], onDone: () => void): void {
    const entry = this.units.get(uid);
    if (!entry || path.length < 2) {
      onDone();
      return;
    }

    const waypoints = path.map(h => hex2px(h.col, h.row));

    const cumDist: number[] = [0];
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i - 1].x;
      const dy = waypoints[i].y - waypoints[i - 1].y;
      cumDist.push(cumDist[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    const totalDist = cumDist[cumDist.length - 1];

    entry.anim.playRun();

    let traveled = 0;
    const tick = (dt: number) => {
      traveled += UNIT_MOVE_SPEED * dt;
      if (traveled >= totalDist) {
        const final = waypoints[waypoints.length - 1];
        entry.container.position.set(final.x, final.y);
        this.engine.ticker.remove(tick);
        entry.anim.playIdle();
        onDone();
        return;
      }

      let seg = 0;
      for (let i = 1; i < cumDist.length; i++) {
        if (cumDist[i] >= traveled) {
          seg = i - 1;
          break;
        }
      }
      const segStart = cumDist[seg];
      const segEnd = cumDist[seg + 1];
      const t = (traveled - segStart) / (segEnd - segStart);
      const x = waypoints[seg].x + (waypoints[seg + 1].x - waypoints[seg].x) * t;
      const y = waypoints[seg].y + (waypoints[seg + 1].y - waypoints[seg].y) * t;
      entry.container.position.set(x, y);
    };

    this.engine.ticker.add(tick);
  }

  async playAttack(uid: number, targetHex: HexCoord, onDone: () => void): Promise<void> {
    const entry = this.units.get(uid);
    if (!entry) {
      onDone();
      return;
    }

    const unitPos = entry.container.position;
    const targetPos = hex2px(targetHex.col, targetHex.row);
    const dx = targetPos.x - unitPos.x;
    const dy = targetPos.y - unitPos.y;
    const targetIsLeft = dx < 0;

    // Use abs(dx) so left/right are symmetric — direction is always
    // computed as if attacking rightward, then flip handles left
    const angle = Math.atan2(-dy, Math.abs(dx)) * (180 / Math.PI);

    let direction: AttackDirection;
    if (angle > 60) direction = 'top';
    else if (angle > 30) direction = 'topright';
    else if (angle > -30) direction = 'side';
    else if (angle > -60) direction = 'bottomright';
    else direction = 'bottom';

    await entry.anim.playAttack(direction, targetIsLeft);
    onDone();
  }

  async playDeath(uid: number, onDone: () => void): Promise<void> {
    const entry = this.units.get(uid);
    if (!entry) {
      onDone();
      return;
    }

    await entry.anim.playDeath();
    await entry.anim.fadeTo(0, 0.5);
    this.removeUnit(uid);
    onDone();
  }

  removeUnit(uid: number): void {
    const entry = this.units.get(uid);
    if (!entry) return;
    entry.anim.destroy();
    this.units.delete(uid);
  }

  updateHpBar(uid: number, currentHp: number, maxHp: number): void {
    const entry = this.units.get(uid);
    if (!entry) return;
    entry.currentHp = currentHp;
    entry.maxHp = maxHp;
    this.drawHpBar(entry.hpBar, currentHp, maxHp);
  }

  // ── Highlights ───────────────────────────────────────

  clearHighlights(): void {
    this.hlGfx.clear();
    this.hlGfx.visible = false;
  }

  showDeployHighlights(validHexes: HexCoord[]): void {
    this.hlGfx.clear();
    for (const h of validHexes) {
      const p = hex2px(h.col, h.row);
      this.hlGfx.lineStyle(2, 0xf1c40f);
      this.hlGfx.beginFill(0xf1c40f, 0.15);
      this.hlGfx.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
      this.hlGfx.endFill();
    }
    this.hlGfx.visible = true;
  }

  showMoveHighlights(
    unitHex: HexCoord,
    reachable: HexCoord[],
    attackable: AttackableTarget[],
  ): void {
    this.hlGfx.clear();

    const up = hex2px(unitHex.col, unitHex.row);
    this.hlGfx.lineStyle(3, 0xf1c40f);
    this.hlGfx.beginFill(0xf1c40f, 0.2);
    this.hlGfx.drawRegularPolygon(up.x, up.y, HEX_SIZE - 2, 6);
    this.hlGfx.endFill();

    for (const h of reachable) {
      const p = hex2px(h.col, h.row);
      this.hlGfx.lineStyle(2, 0x2ecc71);
      this.hlGfx.beginFill(0x2ecc71, 0.15);
      this.hlGfx.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
      this.hlGfx.endFill();
    }

    for (const target of attackable) {
      const color = target.autoWalk ? 0xe67e22 : 0xe74c3c;
      const alpha = 0.2;
      for (const cell of target.cells) {
        const p = hex2px(cell.col, cell.row);
        this.hlGfx.lineStyle(2, color);
        this.hlGfx.beginFill(color, alpha);
        this.hlGfx.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
        this.hlGfx.endFill();
      }
    }

    this.hlGfx.visible = true;
  }

  // ── Damage Numbers ───────────────────────────────────

  showDamageNumber(hex: HexCoord, damage: number, isCrit: boolean): void {
    const pos = hex2px(hex.col, hex.row);
    const txt = new Text(`${isCrit ? 'CRIT ' : ''}${damage}`, {
      fontSize: isCrit ? 26 : 22,
      fill: isCrit ? 0xff4444 : 0xffffff,
    });
    txt.position.set(pos.x - 15, pos.y - HEX_SIZE * 1.2);
    this.unitLayer.addChild(txt);

    let t = 0;
    const fn = (dt: number) => {
      t += dt;
      txt.position.y -= 40 * dt;
      txt.alpha = Math.max(0, 1 - t);
      if (t > 1) {
        this.engine.ticker.remove(fn);
        this.unitLayer.removeChild(txt);
      }
    };
    this.engine.ticker.add(fn);
  }

  // ── Projectile ───────────────────────────────────────

  async animateProjectile(
    fromHex: HexCoord,
    toHex: HexCoord,
    onDone: () => void,
  ): Promise<void> {
    const from = hex2px(fromHex.col, fromHex.row);
    const to = hex2px(toHex.col, toHex.row);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const tex = await this.engine.textures.load('arrow_proj', arrowProjectile.file);
    const proj = new Sprite(tex);
    proj.anchor.set(0.5, 0.5);
    const s = 24 / arrowProjectile.width;
    proj.scale.set(s, s);
    proj.rotation = angle;
    proj.position.set(from.x, from.y);
    this.unitLayer.addChild(proj);

    const speed = 400;
    let traveled = 0;

    const tick = (dt: number) => {
      traveled += speed * dt;
      const t = Math.min(traveled / dist, 1);
      proj.position.set(from.x + dx * t, from.y + dy * t);
      if (t >= 1) {
        this.engine.ticker.remove(tick);
        this.unitLayer.removeChild(proj);
        onDone();
      }
    };
    this.engine.ticker.add(tick);
  }

  // ── Spell FX ─────────────────────────────────────────

  async playSpellFx(cardId: number, targetHex: HexCoord, onDone: () => void): Promise<void> {
    const fxCfg = spellFxConfigs[cardId];
    if (!fxCfg) { onDone(); return; }

    const pos = hex2px(targetHex.col, targetHex.row);
    const tex = await this.engine.textures.load(`spell_fx_${cardId}`, fxCfg.file);
    const frames = SpriteSheet.fromStrip(tex, fxCfg.frameWidth);
    const spr = new AnimatedSprite(frames);
    spr.anchor.set(0.5, 0.75);
    const s = (HEX_SIZE * 2) / fxCfg.frameHeight;
    spr.scale.set(s, s);
    spr.position.set(pos.x, pos.y);
    spr.animationSpeed = 0.15;
    spr.loop = false;
    this.unitLayer.addChild(spr);
    spr.gotoAndPlay(0);
    spr.onComplete = () => {
      this.unitLayer.removeChild(spr);
      onDone();
    };
  }

  showHealNumber(hex: HexCoord, amount: number): void {
    const pos = hex2px(hex.col, hex.row);
    const txt = new Text(`+${amount}`, { fontSize: 22, fill: 0x2ecc71 });
    txt.position.set(pos.x - 15, pos.y - HEX_SIZE * 1.2);
    this.unitLayer.addChild(txt);
    let t = 0;
    const fn = (dt: number) => {
      t += dt;
      txt.position.y -= 40 * dt;
      txt.alpha = Math.max(0, 1 - t);
      if (t > 1) {
        this.engine.ticker.remove(fn);
        this.unitLayer.removeChild(txt);
      }
    };
    this.engine.ticker.add(fn);
  }

  showStatusText(hex: HexCoord, text: string): void {
    const pos = hex2px(hex.col, hex.row);
    const txt = new Text(text, { fontSize: 18, fill: 0x9b59b6 });
    txt.position.set(pos.x - 30, pos.y - HEX_SIZE * 1.5);
    this.unitLayer.addChild(txt);
    let t = 0;
    const fn = (dt: number) => {
      t += dt;
      txt.position.y -= 30 * dt;
      txt.alpha = Math.max(0, 1 - t * 0.7);
      if (t > 1.4) {
        this.engine.ticker.remove(fn);
        this.unitLayer.removeChild(txt);
      }
    };
    this.engine.ticker.add(fn);
  }

  showFizzle(hex: HexCoord): void {
    const pos = hex2px(hex.col, hex.row);
    const txt = new Text('FIZZLE!', { fontSize: 24, fill: 0xf1c40f });
    txt.position.set(pos.x - 30, pos.y - HEX_SIZE * 1.2);
    this.unitLayer.addChild(txt);
    let t = 0;
    const fn = (dt: number) => {
      t += dt;
      txt.position.y -= 30 * dt;
      txt.alpha = Math.max(0, 1 - t * 0.8);
      if (t > 1.2) {
        this.engine.ticker.remove(fn);
        this.unitLayer.removeChild(txt);
      }
    };
    this.engine.ticker.add(fn);
  }

  showSpellHighlights(validHexes: HexCoord[], highlightType: 'enemy' | 'ally' | 'area'): void {
    this.hlGfx.clear();
    const color = highlightType === 'ally' ? 0x2ecc71
      : highlightType === 'area' ? 0xe67e22
      : 0x9b59b6;
    for (const h of validHexes) {
      const p = hex2px(h.col, h.row);
      this.hlGfx.lineStyle(2, color);
      this.hlGfx.beginFill(color, 0.15);
      this.hlGfx.drawRegularPolygon(p.x, p.y, HEX_SIZE - 2, 6);
      this.hlGfx.endFill();
    }
    this.hlGfx.visible = true;
  }

  // ── Polymorph Visuals ────────────────────────────────

  async preloadSheep(): Promise<void> {
    const anim = sheepSpriteConfig.anims.find(a => a.state === 'idle');
    if (anim) {
      await this.engine.textures.load('sheep_idle', `${sheepSpriteConfig.basePath}/${anim.file}`);
    }
  }

  swapToSheep(uid: number): void {
    const entry = this.units.get(uid);
    if (!entry) return;
    entry.anim.swapToSheep();
  }

  restoreFromSheep(uid: number): void {
    const entry = this.units.get(uid);
    if (!entry) return;
    entry.anim.restoreFromSheep();
  }

  // ── Cleanup ──────────────────────────────────────────

  destroy(): void {
    for (const entry of this.units.values()) {
      entry.anim.destroy();
    }
    this.units.clear();
    this.engine.stage.removeChild(this.gridLayer);
    this.engine.stage.removeChild(this.hlLayer);
    this.engine.stage.removeChild(this.unitLayer);
  }

  // ── Private ──────────────────────────────────────────

  private drawHpBar(gfx: Graphics, currentHp: number, maxHp: number): void {
    gfx.clear();
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const w = HP_BAR_WIDTH;
    const h = HP_BAR_HEIGHT;
    const x = -w / 2;

    // Dark border
    gfx.lineStyle(1, 0x111111);
    gfx.beginFill(0x1a1a1a, 0.8);
    gfx.drawRect(x - 1, -1, w + 2, h + 2);
    gfx.endFill();

    // Fill
    let color = 0x2ecc71;
    if (ratio <= 0.25) color = 0xe74c3c;
    else if (ratio <= 0.5) color = 0xf1c40f;

    const fillW = w * ratio;
    if (fillW > 0) {
      gfx.lineStyle(0);
      gfx.beginFill(color, 1);
      gfx.drawRect(x, 0, fillW, h);
      gfx.endFill();
    }
  }
}
