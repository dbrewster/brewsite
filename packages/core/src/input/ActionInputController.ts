import type {
  ActionInputHandler,
  InputActionMap,
  InputActionSpec,
  ModifierKey,
  MouseButton,
  SceneInputControllerSpec,
} from './types';

const modifiersMatch = (
  event: KeyboardEvent | WheelEvent | PointerEvent | MouseEvent,
  required?: ModifierKey[],
): boolean => {
  const pressed: ModifierKey[] = [];
  if (event.altKey) pressed.push('alt');
  if (event.ctrlKey) pressed.push('ctrl');
  if (event.metaKey) pressed.push('meta');
  if (event.shiftKey) pressed.push('shift');

  if (!required || required.length === 0) {
    return pressed.length === 0;
  }

  if (pressed.length !== required.length) return false;
  return required.every((mod) => pressed.includes(mod));
};

const buttonMatches = (eventButton: number, expected?: MouseButton): boolean => {
  const button = expected ?? 'left';
  const idx = button === 'left' ? 0 : button === 'middle' ? 1 : 2;
  return eventButton === idx;
};

// ActionInputHandler has moved to types.ts. Re-exported for backwards compatibility.
export type { ActionInputHandler } from './types';

/**
 * Detail payload included with every action-fired event.
 * Fields are optional and vary by action type.
 */
export type ActionFiredDetail = {
  cameraId?: string;
  canvasId?: string;
  layoutId?: string;
  direction?: 1 | -1;
  dx?: number;
  dy?: number;
  delta?: number;
  speed?: number;
};

/**
 * Callback invoked synchronously after every action dispatch.
 * Receives the action type, action id, and a detail payload.
 */
export type ActionFiredListener = (
  actionType: string,
  actionId: string,
  detail: ActionFiredDetail,
) => void;

type ActiveDrag = {
  action: InputActionSpec;
  map: Extract<InputActionMap, { kind: 'pointer' }>;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  lockedAxis: 'x' | 'y' | null;
};

type ActiveWheelLock = {
  actionId: string;
  modifierSignature: string;
  lockAxis: 'x' | 'y' | null;
  lastEventTs: number;
};

type TouchPoint = { x: number; y: number };

export type ActionInputControllerOptions = {
  idDefaults?: {
    cameraId: string;
    canvasId: string;
  };
  wheelLockIdleMs?: number;
  /**
   * Called when a wheel event is not claimed by any WheelMap in the current spec.
   * InputCoordinator passes its inertia accumulator here to implement the
   * priority waterfall: action maps win over scene scroll.
   */
  onUnclaimedWheel?: (event: WheelEvent) => void;
};

const LEGACY_CAMERA_ID = 'camera';
const DEFAULT_WHEEL_LOCK_IDLE_MS = 180;

/**
 * Set to true to enable detailed wheel/input event logging to the console.
 * Useful for diagnosing why scroll events are not reaching the expected handler.
 */
const DEBUG_INPUT = false;

export class ActionInputController {
  private activeDrag: ActiveDrag | null = null;
  private activeWheelLock: ActiveWheelLock | null = null;
  private touchPoints = new Map<number, TouchPoint>();
  private activePinchDistance: number | null = null;
  private target: HTMLElement | Window;
  private keyboardTarget: HTMLElement | Document | Window;
  private readonly getSpec: () => SceneInputControllerSpec | null;
  private readonly handler: ActionInputHandler;
  private readonly idDefaults?: ActionInputControllerOptions['idDefaults'];
  private readonly wheelLockIdleMs: number;
  private readonly onUnclaimedWheel: ((event: WheelEvent) => void) | null;
  private warnedLegacyCameraId = false;
  private readonly actionFiredListeners: ActionFiredListener[] = [];

  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onWheel: (e: WheelEvent) => void;
  private readonly onClick: (e: MouseEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor(
    target: HTMLElement | Window,
    getSpec: () => SceneInputControllerSpec | null,
    handler: ActionInputHandler,
    keyboardTarget?: HTMLElement | Document | Window,
    options?: ActionInputControllerOptions,
  ) {
    this.target = target;
    this.getSpec = getSpec;
    this.handler = handler;
    this.keyboardTarget = keyboardTarget ?? (target instanceof HTMLElement ? target : window);
    this.idDefaults = options?.idDefaults;
    this.wheelLockIdleMs = options?.wheelLockIdleMs ?? DEFAULT_WHEEL_LOCK_IDLE_MS;
    this.onUnclaimedWheel = options?.onUnclaimedWheel ?? null;
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onWheel = this.handleWheel.bind(this);
    this.onClick = this.handleClick.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);
  }

  attach(): void {
    this.target.addEventListener('pointerdown', this.onPointerDown as EventListener);
    this.target.addEventListener('pointermove', this.onPointerMove as EventListener);
    this.target.addEventListener('pointerup', this.onPointerUp as EventListener);
    this.target.addEventListener('pointercancel', this.onPointerUp as EventListener);
    this.target.addEventListener('wheel', this.onWheel as EventListener, { passive: false });
    this.target.addEventListener('click', this.onClick as EventListener);
    this.keyboardTarget.addEventListener('keydown', this.onKeyDown as EventListener);
  }

  detach(): void {
    this.target.removeEventListener('pointerdown', this.onPointerDown as EventListener);
    this.target.removeEventListener('pointermove', this.onPointerMove as EventListener);
    this.target.removeEventListener('pointerup', this.onPointerUp as EventListener);
    this.target.removeEventListener('pointercancel', this.onPointerUp as EventListener);
    this.target.removeEventListener('wheel', this.onWheel as EventListener);
    this.target.removeEventListener('click', this.onClick as EventListener);
    this.keyboardTarget.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.activeDrag = null;
    this.activeWheelLock = null;
    this.touchPoints.clear();
    this.activePinchDistance = null;
    this.actionFiredListeners.length = 0;
  }

  /**
   * Subscribe to all dispatched actions.
   * The listener is called synchronously after every successful action dispatch.
   * Returns an unsubscribe function.
   */
  onActionFired(listener: ActionFiredListener): () => void {
    this.actionFiredListeners.push(listener);
    return () => {
      const idx = this.actionFiredListeners.indexOf(listener);
      if (idx >= 0) this.actionFiredListeners.splice(idx, 1);
    };
  }

  private fireActionEvent(
    actionType: string,
    actionId: string,
    detail: ActionFiredDetail,
  ): void {
    for (const listener of this.actionFiredListeners) {
      listener(actionType, actionId, detail);
    }
  }

  private actionSpeed(action: InputActionSpec): number {
    return action.speed ?? 1;
  }

  private actionStepScenes(action: InputActionSpec): number {
    return Math.max(1, Math.round(action.stepScenes ?? 1));
  }

  private actionStepSlides(action: InputActionSpec): number {
    return Math.max(1, Math.round(action.stepSlides ?? 1));
  }

  private dispatchCarousel(action: InputActionSpec, clientX?: number, clientY?: number): void {
    if (!action.layoutId) {
      console.warn(
        `[ActionInputController] Action "${action.id}" has type "${action.type}" but no layoutId. ` +
        `Add layoutId="<ViewLayout id>" to the <Action> to target a carousel.`,
      );
      return;
    }

    // Spatial gating: if we have pointer coordinates and the handler can
    // provide layout bounds, only dispatch when the pointer is within bounds.
    if (
      clientX !== undefined &&
      clientY !== undefined &&
      this.handler.getLayoutBounds
    ) {
      const bounds = this.handler.getLayoutBounds(action.layoutId);
      if (bounds) {
        const nvsPoint = this.clientToNvs(clientX, clientY);
        if (nvsPoint && !this.isInsideBounds(nvsPoint, bounds)) {
          return;
        }
      }
    }

    const direction: 1 | -1 = action.type === 'carousel.next' ? 1 : -1;
    this.handler.onCarouselStep(action.layoutId, direction, this.actionStepSlides(action));
    this.fireActionEvent(action.type, action.id, { layoutId: action.layoutId, direction });
  }

  /**
   * Converts client (pixel) coordinates to Normalized Viewport Space [0,1].
   * Returns null if the target is not an HTMLElement (e.g., Window).
   */
  private clientToNvs(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!(this.target instanceof HTMLElement)) return null;
    const rect = this.target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  /** Returns true if the NVS point is inside the given NVS bounds rect. */
  private isInsideBounds(
    point: { x: number; y: number },
    bounds: { x: number; y: number; w: number; h: number },
  ): boolean {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.w &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.h
    );
  }

  private nowMs(): number {
    return Date.now();
  }

  private eventModifierSignature(
    event: KeyboardEvent | WheelEvent | PointerEvent | MouseEvent,
    options?: { ignoreCtrl?: boolean },
  ): string {
    const mods: string[] = [];
    if (event.altKey) mods.push('alt');
    if (event.ctrlKey && !options?.ignoreCtrl) mods.push('ctrl');
    if (event.metaKey) mods.push('meta');
    if (event.shiftKey) mods.push('shift');
    return mods.join('+');
  }

  private modifiersMatchForPinchWheel(e: WheelEvent, required?: ModifierKey[]): boolean {
    const ignoreSyntheticCtrl = e.ctrlKey && !e.altKey && !e.metaKey && !(required?.includes('ctrl') ?? false);
    const pressed: ModifierKey[] = [];
    if (e.altKey) pressed.push('alt');
    if (e.ctrlKey && !ignoreSyntheticCtrl) pressed.push('ctrl');
    if (e.metaKey) pressed.push('meta');
    if (e.shiftKey) pressed.push('shift');
    if (!required || required.length === 0) return pressed.length === 0;
    if (pressed.length !== required.length) return false;
    return required.every((mod) => pressed.includes(mod));
  }

  private pointerDelta(mapAxis: 'x' | 'y' | 'xy' | undefined, dx: number, dy: number): number {
    if (mapAxis === 'x') return dx;
    if (mapAxis === 'y') return dy;
    return Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  }

  private applyAxisToDelta(
    mapAxis: 'x' | 'y' | 'xy' | undefined,
    lockAxis: 'x' | 'y' | null,
    dx: number,
    dy: number,
  ): { dx: number; dy: number } {
    let outDx = dx;
    let outDy = dy;

    if (mapAxis === 'x') outDy = 0;
    if (mapAxis === 'y') outDx = 0;

    if (lockAxis === 'x') outDy = 0;
    if (lockAxis === 'y') outDx = 0;

    return { dx: outDx, dy: outDy };
  }

  private resolveStickyLockAxis(state: ActiveDrag, e: PointerEvent): 'x' | 'y' | null {
    if (state.map.lockAxis !== 'sticky') return null;
    if (state.map.axis === 'x' || state.map.axis === 'y') return state.map.axis;
    const threshold = Math.max(0, state.map.lockThreshold ?? 2);
    const totalDx = e.clientX - state.startX;
    const totalDy = e.clientY - state.startY;
    if (Math.abs(totalDx) < threshold && Math.abs(totalDy) < threshold) return null;
    return Math.abs(totalDx) >= Math.abs(totalDy) ? 'x' : 'y';
  }

  private resolveWheelLockAxis(
    lockAxis: 'sticky' | 'free' | undefined,
    mapAxis: 'x' | 'y' | 'xy' | undefined,
    dx: number,
    dy: number,
  ): 'x' | 'y' | null {
    if (mapAxis === 'x' || mapAxis === 'y') return mapAxis;
    if (lockAxis !== 'sticky') return null;
    return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  }

  private resolveSpec(): SceneInputControllerSpec | null {
    return this.getSpec();
  }

  private getTwoTouchPoints(): [TouchPoint, TouchPoint] | null {
    if (this.touchPoints.size < 2) return null;
    const values = Array.from(this.touchPoints.values());
    if (values.length < 2) return null;
    return [values[0], values[1]];
  }

  private touchDistance(): number | null {
    const pair = this.getTwoTouchPoints();
    if (!pair) return null;
    const [a, b] = pair;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private resolveCameraId(action: InputActionSpec): string {
    if (action.cameraId) return action.cameraId;
    if (this.idDefaults?.cameraId) return this.idDefaults.cameraId;
    if (!this.warnedLegacyCameraId) {
      this.warnedLegacyCameraId = true;
      console.warn(
        '[ActionInputController] cameraId defaulted to "camera". ' +
        'Set `primaryCameraId` in engine options or author `cameraId` explicitly.',
      );
    }
    return LEGACY_CAMERA_ID;
  }

  private dispatchPinch(action: InputActionSpec, pinchDelta: number): void {
    const speed = this.actionSpeed(action);
    const cameraId = this.resolveCameraId(action);
    switch (action.type) {
      case 'camera.zoom':
        this.handler.onCameraZoom(cameraId, pinchDelta, speed);
        this.fireActionEvent(action.type, action.id, { cameraId, delta: pinchDelta, speed });
        return;
      default:
        return;
    }
  }

  private findBestPinchMatch(
    spec: SceneInputControllerSpec,
    e: PointerEvent | WheelEvent,
    direction: 'in' | 'out',
    options?: { wheelPinch?: boolean },
  ):
    | { action: InputActionSpec; map: Extract<InputActionMap, { kind: 'pinch' }>; modifierCount: number; order: number }
    | null {
    let best:
      | { action: InputActionSpec; map: Extract<InputActionMap, { kind: 'pinch' }>; modifierCount: number; order: number }
      | null = null;
    let order = 0;

    for (const action of spec.actions) {
      for (const map of action.maps) {
        order += 1;
        if (map.kind !== 'pinch') continue;
        if (options?.wheelPinch) {
          if (!this.modifiersMatchForPinchWheel(e as WheelEvent, map.modifiers)) continue;
        } else if (!modifiersMatch(e as PointerEvent, map.modifiers)) {
          continue;
        }
        const mapDirection = map.direction ?? 'both';
        if (mapDirection !== 'both' && mapDirection !== direction) continue;
        const modifierCount = map.modifiers?.length ?? 0;
        if (!best || modifierCount > best.modifierCount || (modifierCount === best.modifierCount && order < best.order)) {
          best = { action, map, modifierCount, order };
        }
      }
    }
    return best;
  }

  private hasAnyPinchMatch(spec: SceneInputControllerSpec, e: WheelEvent): boolean {
    for (const action of spec.actions) {
      for (const map of action.maps) {
        if (map.kind !== 'pinch') continue;
        if (!this.modifiersMatchForPinchWheel(e, map.modifiers)) continue;
        return true;
      }
    }
    return false;
  }

  private dispatchDrag(
    action: InputActionSpec,
    mapAxis: 'x' | 'y' | 'xy' | undefined,
    lockAxis: 'x' | 'y' | null,
    dx: number,
    dy: number,
    e: PointerEvent,
  ): void {
    const speed = this.actionSpeed(action);
    const filtered = this.applyAxisToDelta(mapAxis, lockAxis, dx, dy);

    switch (action.type) {
      case 'camera.orbit': {
        const cameraId = this.resolveCameraId(action);
        this.handler.onCameraOrbit(cameraId, filtered.dx, filtered.dy, speed);
        this.fireActionEvent(action.type, action.id, { cameraId, dx: filtered.dx, dy: filtered.dy, speed });
        return;
      }
      case 'camera.zoom': {
        const cameraId = this.resolveCameraId(action);
        const delta = this.pointerDelta(mapAxis, filtered.dx, filtered.dy);
        this.handler.onCameraZoom(cameraId, delta, speed);
        this.fireActionEvent(action.type, action.id, { cameraId, delta, speed });
        return;
      }
      case 'camera.pan': {
        const cameraId = this.resolveCameraId(action);
        this.handler.onCameraPan(cameraId, filtered.dx, filtered.dy, speed);
        this.fireActionEvent(action.type, action.id, { cameraId, dx: filtered.dx, dy: filtered.dy, speed });
        return;
      }
      default:
        this.handler.onUnknownAction?.(action.type, action.canvasId, e, {
          speed: action.speed,
          dx: filtered.dx,
          dy: filtered.dy,
        });
        return;
    }
  }

  private dispatchWheel(
    action: InputActionSpec,
    mapAxis: 'x' | 'y' | 'xy' | undefined,
    lockAxis: 'x' | 'y' | null,
    e: WheelEvent,
  ): void {
    const speed = this.actionSpeed(action);
    const rawDx = e.deltaX;
    // Keep wheel Y aligned with drag-style "positive is upward" interaction semantics.
    const rawDy = -e.deltaY;
    const filtered = this.applyAxisToDelta(mapAxis, lockAxis, rawDx, rawDy);
    const mainDelta = this.pointerDelta(mapAxis, filtered.dx, filtered.dy);

    switch (action.type) {
      case 'camera.orbit': {
        const cameraId = this.resolveCameraId(action);
        this.handler.onCameraOrbit(cameraId, filtered.dx, filtered.dy, speed * 0.4);
        this.fireActionEvent(action.type, action.id, { cameraId, dx: filtered.dx, dy: filtered.dy, speed: speed * 0.4 });
        return;
      }
      case 'camera.zoom': {
        const cameraId = this.resolveCameraId(action);
        this.handler.onCameraZoom(cameraId, mainDelta, speed);
        this.fireActionEvent(action.type, action.id, { cameraId, delta: mainDelta, speed });
        return;
      }
      case 'camera.pan': {
        const cameraId = this.resolveCameraId(action);
        this.handler.onCameraPan(cameraId, filtered.dx, filtered.dy, speed);
        this.fireActionEvent(action.type, action.id, { cameraId, dx: filtered.dx, dy: filtered.dy, speed });
        return;
      }
      case 'camera.reset': {
        const cameraId = this.resolveCameraId(action);
        this.handler.onCameraReset(cameraId);
        this.fireActionEvent(action.type, action.id, { cameraId });
        return;
      }
      case 'scene.next':
        this.handler.onSceneStep(1, this.actionStepScenes(action));
        this.fireActionEvent(action.type, action.id, { direction: 1 });
        return;
      case 'scene.prev':
        this.handler.onSceneStep(-1, this.actionStepScenes(action));
        this.fireActionEvent(action.type, action.id, { direction: -1 });
        return;
      case 'carousel.next':
      case 'carousel.prev':
        this.dispatchCarousel(action, e.clientX, e.clientY);
        return;
      default:
        this.handler.onUnknownAction?.(action.type, action.canvasId, e, {
          speed: action.speed,
          dx: filtered.dx,
          dy: filtered.dy,
        });
        return;
    }
  }

  private dispatchKey(action: InputActionSpec, e: KeyboardEvent): void {
    switch (action.type) {
      case 'camera.reset': {
        const cameraId = this.resolveCameraId(action);
        this.handler.onCameraReset(cameraId);
        this.fireActionEvent(action.type, action.id, { cameraId });
        return;
      }
      case 'scene.next':
        this.handler.onSceneStep(1, this.actionStepScenes(action));
        this.fireActionEvent(action.type, action.id, { direction: 1 });
        return;
      case 'scene.prev':
        this.handler.onSceneStep(-1, this.actionStepScenes(action));
        this.fireActionEvent(action.type, action.id, { direction: -1 });
        return;
      case 'carousel.next':
      case 'carousel.prev':
        this.dispatchCarousel(action);
        return;
      default:
        this.handler.onUnknownAction?.(action.type, action.canvasId, e, {
          speed: action.speed,
        });
        return;
    }
  }

  private dispatchClick(action: InputActionSpec, e: MouseEvent): void {
    switch (action.type) {
      case 'scene.next':
        this.handler.onSceneStep(1, this.actionStepScenes(action));
        this.fireActionEvent(action.type, action.id, { direction: 1 });
        return;
      case 'scene.prev':
        this.handler.onSceneStep(-1, this.actionStepScenes(action));
        this.fireActionEvent(action.type, action.id, { direction: -1 });
        return;
      case 'carousel.next':
      case 'carousel.prev':
        this.dispatchCarousel(action, e.clientX, e.clientY);
        return;
      default:
        this.handler.onUnknownAction?.(action.type, action.canvasId, e, {
          speed: action.speed,
          focusCenter: action.focusCenter,
        });
        return;
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    const spec = this.resolveSpec();
    if (!spec) return;
    if (e.pointerType === 'touch') {
      this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touchPoints.size >= 2) {
        const distance = this.touchDistance();
        if (distance !== null) this.activePinchDistance = distance;
      }
      return;
    }

    // Yield to interactive overlay elements (passthroughPointerEvents case).
    // If an interactive element exists at this position, do not start a drag —
    // let the click reach the overlay element via forwardClickToOverlayElement.
    if (this.hasInteractiveOverlayElement(e.clientX, e.clientY, e.target as Element | null)) return;

    let best:
      | { action: InputActionSpec; map: Extract<InputActionMap, { kind: 'pointer' }>; modifierCount: number; order: number }
      | null = null;
    let order = 0;
    for (const action of spec.actions) {
      for (const map of action.maps) {
        order += 1;
        if (map.kind !== 'pointer' || map.event !== 'drag') continue;
        if (!buttonMatches(e.button, map.button)) continue;
        if (!modifiersMatch(e, map.modifiers)) continue;
        const modifierCount = map.modifiers?.length ?? 0;
        if (!best || modifierCount > best.modifierCount || (modifierCount === best.modifierCount && order < best.order)) {
          best = { action, map, modifierCount, order };
        }
      }
    }
    if (!best) return;

    this.activeDrag = {
      action: best.action,
      map: best.map,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      lockedAxis: null,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can fail in non-browser test environments.
    }
    e.preventDefault();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      if (this.touchPoints.has(e.pointerId)) {
        this.touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      const spec = this.resolveSpec();
      if (!spec || this.touchPoints.size < 2) return;
      const nextDistance = this.touchDistance();
      if (nextDistance === null) return;
      if (this.activePinchDistance === null) {
        this.activePinchDistance = nextDistance;
        return;
      }
      const delta = nextDistance - this.activePinchDistance;
      if (delta === 0) return;
      const direction = delta > 0 ? 'out' : 'in';
      const match = this.findBestPinchMatch(spec, e, direction);
      if (!match) {
        this.activePinchDistance = nextDistance;
        return;
      }
      const threshold = Math.max(0, match.map.threshold ?? 1);
      if (Math.abs(delta) < threshold) return;
      this.dispatchPinch(match.action, delta);
      this.activePinchDistance = nextDistance;
      e.preventDefault();
      return;
    }

    if (!this.activeDrag || e.pointerId !== this.activeDrag.pointerId) return;
    const dx = e.clientX - this.activeDrag.x;
    const dy = e.clientY - this.activeDrag.y;
    if (this.activeDrag.lockedAxis === null) {
      this.activeDrag.lockedAxis = this.resolveStickyLockAxis(this.activeDrag, e);
    }
    this.activeDrag.x = e.clientX;
    this.activeDrag.y = e.clientY;
    this.dispatchDrag(this.activeDrag.action, this.activeDrag.map.axis, this.activeDrag.lockedAxis, dx, dy, e);
    e.preventDefault();
  }

  private handlePointerUp(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.touchPoints.delete(e.pointerId);
      if (this.touchPoints.size < 2) this.activePinchDistance = null;
      return;
    }
    if (!this.activeDrag || e.pointerId !== this.activeDrag.pointerId) return;
    this.activeDrag = null;
  }

  /**
   * Returns the first interactive overlay element at (x, y) that lives inside
   * a `pointer-events: none` container, or `null` if none exists.
   *
   * An element is considered interactive if it has `cursor: pointer`,
   * `role="button"`, is a `<button>` or `<a>`, or has explicit
   * `style.pointerEvents = 'auto'`.
   *
   * @param eventTarget  The browser's native hit-test target for this event.
   *                     Skipped during the search to avoid forwarding to the
   *                     element that already received the event.
   */
  private findInteractiveOverlayElement(
    x: number,
    y: number,
    eventTarget: Element | null,
  ): HTMLElement | null {
    if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') return null;
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
      if (!(el instanceof HTMLElement)) continue;
      // Skip the element the browser already targeted.
      if (el === eventTarget) continue;
      // Check for interactive signals.
      const isInteractive =
        el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        el.getAttribute('role') === 'button' ||
        el.style.pointerEvents === 'auto' ||
        el.style.cursor === 'pointer';
      if (!isInteractive) continue;
      // Walk ancestors to confirm this element is inside a pointer-events:none
      // overlay (the passthroughPointerEvents case). Without this guard we
      // might forward to a random absolutely-positioned element.
      let parent = el.parentElement;
      while (parent) {
        const pe = parent.style.pointerEvents || getComputedStyle(parent).pointerEvents;
        if (pe === 'none') return el;
        parent = parent.parentElement;
      }
    }
    return null;
  }

  /**
   * Returns `true` if an interactive overlay element exists at the given
   * coordinates.  Used by `handlePointerDown` to avoid starting a drag when
   * the user is clicking on an overlay button.
   */
  private hasInteractiveOverlayElement(
    x: number,
    y: number,
    eventTarget: Element | null,
  ): boolean {
    return this.findInteractiveOverlayElement(x, y, eventTarget) !== null;
  }

  /**
   * Checks whether there is an interactive overlay element at the click
   * coordinates and, if so, dispatches a synthetic click to it.
   *
   * With `pointer-events: none` on the overlay host (passthroughPointerEvents),
   * the browser delivers pointer/click events to the canvas below, so overlay
   * elements with `pointer-events: auto` never receive them natively. This
   * method bridges the gap by using `elementsFromPoint` to discover those
   * elements and forwarding the click.
   *
   * Returns `true` if a click was forwarded (caller should bail out).
   */
  private forwardClickToOverlayElement(e: MouseEvent): boolean {
    const el = this.findInteractiveOverlayElement(e.clientX, e.clientY, e.target as Element | null);
    if (!el) return false;
    el.click();
    return true;
  }

  private isOverScrollableContent(e: WheelEvent): boolean {
    const container = this.target instanceof HTMLElement ? this.target : null;
    let el = e.target as HTMLElement | null;
    while (el && el !== container) {
      // Vertical scroll check (cheap property read first)
      if (el.scrollHeight > el.clientHeight) {
        const style = getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          const atTop = el.scrollTop <= 0 && e.deltaY < 0;
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
          if (!atTop && !atBottom) return true;
        }
      }
      // Horizontal scroll check
      if (el.scrollWidth > el.clientWidth) {
        const style = getComputedStyle(el);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
          const atLeft = el.scrollLeft <= 0 && e.deltaX < 0;
          const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaX > 0;
          if (!atLeft && !atRight) return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  }

  private handleWheel(e: WheelEvent): void {
    if (DEBUG_INPUT) {
      console.log(`[AIC:wheel] dX=${e.deltaX.toFixed(1)} dY=${e.deltaY.toFixed(1)} ctrl=${e.ctrlKey} meta=${e.metaKey} shift=${e.shiftKey} target=${(e.target as HTMLElement)?.tagName}`);
    }

    // [Waterfall step 1] Yield to scrollable overlay content.
    if (this.isOverScrollableContent(e)) {
      if (DEBUG_INPUT) console.log('[AIC:wheel] → YIELDED to scrollable overlay content');
      return; // no preventDefault
    }

    const spec = this.resolveSpec();
    if (!spec) {
      if (DEBUG_INPUT) console.log('[AIC:wheel] → NO SPEC, calling onUnclaimedWheel:', !!this.onUnclaimedWheel);
      // No spec; fall through to unclaimed handler (scene scroll).
      this.onUnclaimedWheel?.(e);
      return;
    }

    // Desktop trackpad pinch commonly arrives as ctrl+wheel (no touch pointer events).
    if (e.ctrlKey) {
      const hasPinchMapping = this.hasAnyPinchMatch(spec, e);
      if (!hasPinchMapping) {
        // No pinch DSL mapping is configured for this modifier combo, so
        // preserve legacy ctrl+wheel behavior by falling through to wheel maps.
      } else {
        // Pinch signal is exclusive when pinch mappings are present: always
        // consume so browser zoom / wheel mappings do not also run.
        e.preventDefault();
        // Negate deltaY: browser pinch-to-zoom-in (spread fingers) sends negative
        // deltaY on macOS trackpads. We want positive = spread = zoom in, matching
        // the touch pinch convention where positive delta = increasing finger distance.
        const pinchDelta = -e.deltaY;
        if (pinchDelta !== 0) {
          const direction = pinchDelta > 0 ? 'out' : 'in';
          const pinchMatch = this.findBestPinchMatch(spec, e, direction, { wheelPinch: true });
          if (pinchMatch) {
            const threshold = Math.max(0, pinchMatch.map.threshold ?? 1);
            if (Math.abs(pinchDelta) >= threshold) {
              this.dispatchPinch(pinchMatch.action, pinchDelta);
            }
          }
        }
        return;
      }
    }

    let best:
      | { action: InputActionSpec; map: Extract<InputActionMap, { kind: 'wheel' }>; modifierCount: number; order: number }
      | null = null;
    let order = 0;
    for (const action of spec.actions) {
      for (const map of action.maps) {
        order += 1;
        if (map.kind !== 'wheel') continue;
        if (!modifiersMatch(e, map.modifiers)) continue;
        const modifierCount = map.modifiers?.length ?? 0;
        if (!best || modifierCount > best.modifierCount || (modifierCount === best.modifierCount && order < best.order)) {
          best = { action, map, modifierCount, order };
        }
      }
    }
    if (!best) {
      // [Waterfall step 4] No action claimed it — fall through to scroll.
      if (DEBUG_INPUT) console.log('[AIC:wheel] → NO WheelMap match, calling onUnclaimedWheel:', !!this.onUnclaimedWheel);
      this.onUnclaimedWheel?.(e);
      return;
    }
    if (DEBUG_INPUT) console.log(`[AIC:wheel] → CLAIMED by action "${best.action.id}" (type=${best.action.type})`);
    e.preventDefault();
    const currentTs = this.nowMs();
    const modifierSignature = this.eventModifierSignature(e);
    const shouldStick = best.map.lockAxis === 'sticky';
    const rawDx = e.deltaX;
    const rawDy = e.deltaY;
    let lockAxis: 'x' | 'y' | null = null;

    if (shouldStick) {
      const prevWheelLock = this.activeWheelLock;
      const reuse =
        prevWheelLock &&
        prevWheelLock.actionId === best.action.id &&
        prevWheelLock.modifierSignature === modifierSignature &&
        currentTs - prevWheelLock.lastEventTs <= this.wheelLockIdleMs;
      if (reuse) {
        lockAxis = prevWheelLock.lockAxis;
      } else {
        lockAxis = this.resolveWheelLockAxis(best.map.lockAxis, best.map.axis, rawDx, rawDy);
      }
      this.activeWheelLock = {
        actionId: best.action.id,
        modifierSignature,
        lockAxis,
        lastEventTs: currentTs,
      };
    } else {
      this.activeWheelLock = null;
      lockAxis = this.resolveWheelLockAxis(best.map.lockAxis, best.map.axis, rawDx, rawDy);
    }

    this.dispatchWheel(best.action, best.map.axis, lockAxis, e);
  }

  private handleClick(e: MouseEvent): void {
    // Priority: if an interactive overlay element exists at this position,
    // forward the click to it and let the AIC skip its own processing.
    // This handles the passthroughPointerEvents case where the browser delivers
    // the click to the canvas instead of the overlay element.
    if (this.forwardClickToOverlayElement(e)) return;

    const spec = this.resolveSpec();
    if (!spec) return;

    let best:
      | { action: InputActionSpec; map: Extract<InputActionMap, { kind: 'pointer' }>; modifierCount: number; order: number }
      | null = null;
    let order = 0;
    for (const action of spec.actions) {
      for (const map of action.maps) {
        order += 1;
        if (map.kind !== 'pointer' || map.event !== 'click') continue;
        if (!buttonMatches(e.button, map.button)) continue;
        if (!modifiersMatch(e, map.modifiers)) continue;
        const modifierCount = map.modifiers?.length ?? 0;
        if (!best || modifierCount > best.modifierCount || (modifierCount === best.modifierCount && order < best.order)) {
          best = { action, map, modifierCount, order };
        }
      }
    }
    if (!best) return;
    e.preventDefault();
    this.dispatchClick(best.action, e);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const spec = this.resolveSpec();
    if (!spec) return;

    const matches: Array<{ action: InputActionSpec; map: Extract<InputActionMap, { kind: 'key' }>; modifierCount: number; order: number }> = [];
    let order = 0;
    for (const action of spec.actions) {
      for (const map of action.maps) {
        order += 1;
        if (map.kind !== 'key') continue;
        if (map.key !== e.key) continue;
        if (!modifiersMatch(e, map.modifiers)) continue;
        const modifierCount = map.modifiers?.length ?? 0;
        matches.push({ action, map, modifierCount, order });
      }
    }
    if (matches.length === 0) return;
    const maxModifierCount = matches.reduce((max, item) => Math.max(max, item.modifierCount), 0);
    const selected = matches
      .filter((item) => item.modifierCount === maxModifierCount)
      .sort((a, b) => a.order - b.order);
    e.preventDefault();
    selected.forEach((item) => this.dispatchKey(item.action, e));
  }
}
