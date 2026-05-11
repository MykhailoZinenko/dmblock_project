import { InteractionEvent, EVENT_PHASE } from './InteractionEvent.js';
import { Pool } from '../utils/Pool.js';
import type { Camera } from '../camera/Camera.js';

export interface InteractiveNode {
  visible: boolean;
  interactive: boolean;
  cursor: string | null;
  parent: InteractiveNode | null;
  children: InteractiveNode[];
  containsPoint(worldX: number, worldY: number): boolean;
  emit(event: string, data?: unknown): unknown;
}

interface WorldCoords {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
}

const eventPool: Pool<InteractionEvent> = new Pool(
  () => new InteractionEvent('', null, 0, 0, 0, 0, null, 0),
  (e: InteractionEvent) => { e.stopped = false; e.stoppedImmediate = false; e.eventPhase = EVENT_PHASE.NONE; },
);

export class InteractionManager {
  private _canvas: HTMLCanvasElement;
  private _stage: InteractiveNode;
  private _camera: Camera;
  private _hovered: InteractiveNode | null;
  private _pressedTarget: InteractiveNode | null;
  private _boundListeners: boolean;

  private _onPointerDown: (e: PointerEvent) => void;
  private _onPointerUp: (e: PointerEvent) => void;
  private _onPointerMove: (e: PointerEvent) => void;
  private _onWheel: (e: WheelEvent) => void;
  private _onPointerLeave: (e: PointerEvent) => void;

  constructor(canvas: HTMLCanvasElement, stage: InteractiveNode, camera: Camera, autoBindDOM = true) {
    this._canvas = canvas;
    this._stage = stage;
    this._camera = camera;
    this._hovered = null;
    this._pressedTarget = null;
    this._boundListeners = false;

    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onPointerLeave = this._handlePointerLeave.bind(this);

    if (autoBindDOM) {
      this.bindDOM();
    }
  }

  bindDOM(): void {
    if (this._boundListeners) return;
    this._boundListeners = true;
    this._canvas.addEventListener('pointerdown', this._onPointerDown);
    this._canvas.addEventListener('pointerup', this._onPointerUp);
    this._canvas.addEventListener('pointermove', this._onPointerMove);
    this._canvas.addEventListener('pointerleave', this._onPointerLeave);
    this._canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  unbindDOM(): void {
    if (!this._boundListeners) return;
    this._boundListeners = false;
    this._canvas.removeEventListener('pointerdown', this._onPointerDown);
    this._canvas.removeEventListener('pointerup', this._onPointerUp);
    this._canvas.removeEventListener('pointermove', this._onPointerMove);
    this._canvas.removeEventListener('pointerleave', this._onPointerLeave);
    this._canvas.removeEventListener('wheel', this._onWheel);
  }

  feedPointerDown(e: PointerEvent): void { this._handlePointerDown(e); }
  feedPointerUp(e: PointerEvent): void { this._handlePointerUp(e); }
  feedPointerMove(e: PointerEvent): void { this._handlePointerMove(e); }
  feedPointerLeave(e: PointerEvent): void { this._handlePointerLeave(e); }
  feedWheel(e: WheelEvent): void { this._handleWheel(e); }

  private _createEvent(
    type: string,
    target: InteractiveNode | null,
    worldX: number,
    worldY: number,
    screenX: number,
    screenY: number,
    domEvent: Event,
    button: number,
  ): InteractionEvent {
    const e: InteractionEvent = eventPool.get();
    e.type = type;
    e.target = target;
    e.currentTarget = null;
    e.worldX = worldX;
    e.worldY = worldY;
    e.screenX = screenX;
    e.screenY = screenY;
    e.originalEvent = domEvent;
    e.button = button;
    return e;
  }

  private _getWorldCoords(domEvent: PointerEvent | WheelEvent): WorldCoords {
    const rect: DOMRect = this._canvas.getBoundingClientRect();
    const cssX: number = domEvent.clientX - rect.left;
    const cssY: number = domEvent.clientY - rect.top;
    const dpr: number = window.devicePixelRatio || 1;
    const screenX: number = cssX * dpr;
    const screenY: number = cssY * dpr;
    const world = this._camera.screenToWorld(screenX, screenY);
    return { screenX: cssX, screenY: cssY, worldX: world.x, worldY: world.y };
  }

  _hitTest(node: InteractiveNode, worldX: number, worldY: number): InteractiveNode | null {
    if (!node.visible) return null;

    for (let i = node.children.length - 1; i >= 0; i--) {
      const hit: InteractiveNode | null = this._hitTest(node.children[i], worldX, worldY);
      if (hit) return hit;
    }

    if (node.interactive && node.containsPoint(worldX, worldY)) {
      return node;
    }

    return null;
  }

  _propagate(event: InteractionEvent, target: InteractiveNode): void {
    const path: InteractiveNode[] = [];
    let node: InteractiveNode | null = target.parent;
    while (node) {
      path.push(node);
      node = node.parent;
    }
    path.reverse();

    event.eventPhase = EVENT_PHASE.CAPTURING;
    for (const ancestor of path) {
      if (event.stopped) return;
      event.currentTarget = ancestor;
      ancestor.emit(event.type, event);
    }

    if (event.stopped) return;
    event.eventPhase = EVENT_PHASE.TARGET;
    event.currentTarget = target;
    target.emit(event.type, event);

    if (event.stopped) return;
    event.eventPhase = EVENT_PHASE.BUBBLING;
    for (let i = path.length - 1; i >= 0; i--) {
      if (event.stopped) return;
      event.currentTarget = path[i];
      path[i].emit(event.type, event);
    }
  }

  _createEvent_public(
    type: string,
    target: InteractiveNode | null,
    worldX: number, worldY: number,
    screenX: number, screenY: number,
    domEvent: Event, button: number,
  ): InteractionEvent {
    return this._createEvent(type, target, worldX, worldY, screenX, screenY, domEvent, button);
  }

  private _handlePointerDown(domEvent: PointerEvent): void {
    const coords: WorldCoords = this._getWorldCoords(domEvent);
    const target: InteractiveNode | null = this._hitTest(this._stage, coords.worldX, coords.worldY);
    this._pressedTarget = target;
    if (!target) return;

    const event: InteractionEvent = this._createEvent(
      'pointerdown', target, coords.worldX, coords.worldY,
      coords.screenX, coords.screenY, domEvent, domEvent.button
    );
    this._propagate(event, target);
  }

  private _handlePointerUp(domEvent: PointerEvent): void {
    const coords: WorldCoords = this._getWorldCoords(domEvent);
    const target: InteractiveNode | null = this._hitTest(this._stage, coords.worldX, coords.worldY);

    if (target) {
      const event: InteractionEvent = this._createEvent(
        'pointerup', target, coords.worldX, coords.worldY,
        coords.screenX, coords.screenY, domEvent, domEvent.button
      );
      this._propagate(event, target);

      if (target === this._pressedTarget) {
        const tapEvent: InteractionEvent = this._createEvent(
          'pointertap', target, coords.worldX, coords.worldY,
          coords.screenX, coords.screenY, domEvent, domEvent.button
        );
        this._propagate(tapEvent, target);
      }
    }

    this._pressedTarget = null;
  }

  private _handlePointerMove(domEvent: PointerEvent): void {
    const coords: WorldCoords = this._getWorldCoords(domEvent);
    const target: InteractiveNode | null = this._hitTest(this._stage, coords.worldX, coords.worldY);

    if (this._hovered !== target) {
      if (this._hovered) {
        const outEvent: InteractionEvent = this._createEvent(
          'pointerout', this._hovered, coords.worldX, coords.worldY,
          coords.screenX, coords.screenY, domEvent, domEvent.button
        );
        outEvent.eventPhase = EVENT_PHASE.TARGET;
        outEvent.currentTarget = this._hovered;
        this._hovered.emit('pointerout', outEvent);
      }
      if (target) {
        const overEvent: InteractionEvent = this._createEvent(
          'pointerover', target, coords.worldX, coords.worldY,
          coords.screenX, coords.screenY, domEvent, domEvent.button
        );
        overEvent.eventPhase = EVENT_PHASE.TARGET;
        overEvent.currentTarget = target;
        target.emit('pointerover', overEvent);
      }
      this._hovered = target;
      this._canvas.style.cursor = (target && target.cursor) ? target.cursor : '';
    }

    if (target) {
      const moveEvent: InteractionEvent = this._createEvent(
        'pointermove', target, coords.worldX, coords.worldY,
        coords.screenX, coords.screenY, domEvent, domEvent.button
      );
      this._propagate(moveEvent, target);
    }
  }

  private _handleWheel(domEvent: WheelEvent): void {
    domEvent.preventDefault();
    const coords: WorldCoords = this._getWorldCoords(domEvent);
    const target: InteractiveNode = this._hitTest(this._stage, coords.worldX, coords.worldY) || this._stage;

    const event: InteractionEvent = this._createEvent(
      'wheel', target, coords.worldX, coords.worldY,
      coords.screenX, coords.screenY, domEvent, domEvent.button
    );
    event.deltaY = domEvent.deltaY;
    this._propagate(event, target);
  }

  private _handlePointerLeave(domEvent: PointerEvent): void {
    if (this._hovered) {
      const coords: WorldCoords = this._getWorldCoords(domEvent);
      const outEvent: InteractionEvent = this._createEvent(
        'pointerout', this._hovered, coords.worldX, coords.worldY,
        coords.screenX, coords.screenY, domEvent, 0
      );
      outEvent.eventPhase = EVENT_PHASE.TARGET;
      outEvent.currentTarget = this._hovered;
      this._hovered.emit('pointerout', outEvent);
      this._hovered = null;
      this._canvas.style.cursor = '';
    }
  }

  destroy(): void {
    this.unbindDOM();
  }
}
