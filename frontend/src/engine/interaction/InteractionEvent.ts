export const EVENT_PHASE = { NONE: 0, CAPTURING: 1, TARGET: 2, BUBBLING: 3 } as const;

export type EventPhase = typeof EVENT_PHASE[keyof typeof EVENT_PHASE];

/** Minimal node shape for event targets — avoids circular dependency with Node.ts. */
export interface EventTarget {
  emit(event: string, data?: unknown): unknown;
}

export class InteractionEvent {
  public type: string;
  public target: EventTarget | null;
  public currentTarget: EventTarget | null;
  public worldX: number;
  public worldY: number;
  public screenX: number;
  public screenY: number;
  public originalEvent: Event | null;
  public button: number;
  public stopped: boolean;
  public stoppedImmediate: boolean;
  public eventPhase: EventPhase;
  public deltaY?: number;

  constructor(
    type: string,
    target: EventTarget | null,
    worldX: number,
    worldY: number,
    screenX: number,
    screenY: number,
    originalEvent: Event | null,
    button: number,
  ) {
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

  stopPropagation(): void {
    this.stopped = true;
  }

  stopImmediatePropagation(): void {
    this.stopped = true;
    this.stoppedImmediate = true;
  }
}
