import { InteractionEvent, EVENT_PHASE } from './InteractionEvent.js';
import { Pool } from '../utils/Pool.js';

const eventPool = new Pool(
  () => new InteractionEvent('', null, 0, 0, 0, 0, null, 0),
  (e) => { e.stopped = false; e.stoppedImmediate = false; e.eventPhase = EVENT_PHASE.NONE; },
);

export class InteractionManager {
  constructor(canvas, stage, camera) {
    this._canvas = canvas;
    this._stage = stage;
    this._camera = camera;
    this._hovered = null;
    this._pressedTarget = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);

    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerleave', this._onPointerLeave);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  _createEvent(type, target, worldX, worldY, screenX, screenY, domEvent, button) {
    const e = eventPool.get();
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

  _getWorldCoords(domEvent) {
    const rect = this._canvas.getBoundingClientRect();
    const cssX = domEvent.clientX - rect.left;
    const cssY = domEvent.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const screenX = cssX * dpr;
    const screenY = cssY * dpr;
    const world = this._camera.screenToWorld(screenX, screenY);
    return { screenX: cssX, screenY: cssY, worldX: world.x, worldY: world.y };
  }

  _hitTest(node, worldX, worldY) {
    if (!node.visible) return null;

    for (let i = node.children.length - 1; i >= 0; i--) {
      const hit = this._hitTest(node.children[i], worldX, worldY);
      if (hit) return hit;
    }

    if (node.interactive && node.containsPoint(worldX, worldY)) {
      return node;
    }

    return null;
  }

  _propagate(event, target) {
    const path = [];
    let node = target.parent;
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

  _onPointerDown(domEvent) {
    const coords = this._getWorldCoords(domEvent);
    const target = this._hitTest(this._stage, coords.worldX, coords.worldY);
    this._pressedTarget = target;
    if (!target) return;

    const event = this._createEvent(
      'pointerdown', target, coords.worldX, coords.worldY,
      coords.screenX, coords.screenY, domEvent, domEvent.button
    );
    this._propagate(event, target);
  }

  _onPointerUp(domEvent) {
    const coords = this._getWorldCoords(domEvent);
    const target = this._hitTest(this._stage, coords.worldX, coords.worldY);

    if (target) {
      const event = this._createEvent(
        'pointerup', target, coords.worldX, coords.worldY,
        coords.screenX, coords.screenY, domEvent, domEvent.button
      );
      this._propagate(event, target);

      if (target === this._pressedTarget) {
        const tapEvent = this._createEvent(
          'pointertap', target, coords.worldX, coords.worldY,
          coords.screenX, coords.screenY, domEvent, domEvent.button
        );
        this._propagate(tapEvent, target);
      }
    }

    this._pressedTarget = null;
  }

  _onPointerMove(domEvent) {
    const coords = this._getWorldCoords(domEvent);
    const target = this._hitTest(this._stage, coords.worldX, coords.worldY);

    if (this._hovered !== target) {
      if (this._hovered) {
        const outEvent = this._createEvent(
          'pointerout', this._hovered, coords.worldX, coords.worldY,
          coords.screenX, coords.screenY, domEvent, domEvent.button
        );
        outEvent.eventPhase = EVENT_PHASE.TARGET;
        outEvent.currentTarget = this._hovered;
        this._hovered.emit('pointerout', outEvent);
      }
      if (target) {
        const overEvent = this._createEvent(
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
      const moveEvent = this._createEvent(
        'pointermove', target, coords.worldX, coords.worldY,
        coords.screenX, coords.screenY, domEvent, domEvent.button
      );
      this._propagate(moveEvent, target);
    }
  }

  _onWheel(domEvent) {
    domEvent.preventDefault();
    const coords = this._getWorldCoords(domEvent);
    const target = this._hitTest(this._stage, coords.worldX, coords.worldY) || this._stage;

    const event = this._createEvent(
      'wheel', target, coords.worldX, coords.worldY,
      coords.screenX, coords.screenY, domEvent, domEvent.button
    );
    event.deltaY = domEvent.deltaY;
    this._propagate(event, target);
  }

  _onPointerLeave(domEvent) {
    if (this._hovered) {
      const coords = this._getWorldCoords(domEvent);
      const outEvent = this._createEvent(
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

  destroy() {
    this._canvas.removeEventListener('pointerdown', this._onPointerDown);
    this._canvas.removeEventListener('pointerup', this._onPointerUp);
    this._canvas.removeEventListener('pointermove', this._onPointerMove);
    this._canvas.removeEventListener('pointerleave', this._onPointerLeave);
    this._canvas.removeEventListener('wheel', this._onWheel);
  }
}
