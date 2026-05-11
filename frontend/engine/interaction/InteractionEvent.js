export const EVENT_PHASE = { NONE: 0, CAPTURING: 1, TARGET: 2, BUBBLING: 3 };

export class InteractionEvent {
  constructor(type, target, worldX, worldY, screenX, screenY, originalEvent, button) {
    this.type = type;
    this.target = target;
    this.currentTarget = null;
    this.worldX = worldX;
    this.worldY = worldY;
    this.screenX = screenX;
    this.screenY = screenY;
    this.originalEvent = originalEvent;
    this.button = button;
    this.stopped = false;
    this.stoppedImmediate = false;
    this.eventPhase = EVENT_PHASE.NONE;
  }

  stopPropagation() {
    this.stopped = true;
  }

  stopImmediatePropagation() {
    this.stopped = true;
    this.stoppedImmediate = true;
  }
}
