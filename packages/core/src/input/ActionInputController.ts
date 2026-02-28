import type {
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

export type ActionInputHandler = {
  getSceneCount: () => number;
  onSceneStep: (direction: 1 | -1, stepScenes: number) => void;
  onCameraOrbit: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraDolly: (cameraId: string, delta: number, speed: number) => void;
  onCameraReset: (cameraId: string) => void;
  onDiagramCanvasMove: (canvasId: string, dx: number, dy: number, speed: number) => void;
  onDiagramCanvasRotate: (canvasId: string, dx: number, dy: number, speed: number) => void;
  onDiagramCanvasReset: (canvasId: string) => void;
  onDiagramCanvasFocus: (
    canvasId: string,
    clientX: number,
    clientY: number,
    focusCenter?: [number, number] | [number, number, number],
  ) => void;
};

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

const WHEEL_LOCK_IDLE_MS = 180;

export class ActionInputController {
  private activeDrag: ActiveDrag | null = null;
  private activeWheelLock: ActiveWheelLock | null = null;
  private touchPoints = new Map<number, TouchPoint>();
  private activePinchDistance: number | null = null;
  private target: HTMLElement | Window;
  private keyboardTarget: HTMLElement | Document | Window;
  private readonly getSpec: () => SceneInputControllerSpec | null;
  private readonly handler: ActionInputHandler;

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
  ) {
    this.target = target;
    this.getSpec = getSpec;
    this.handler = handler;
    this.keyboardTarget = keyboardTarget ?? (target instanceof HTMLElement ? target : window);
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
  }

  private actionSpeed(action: InputActionSpec): number {
    return action.speed ?? 1;
  }

  private actionStepScenes(action: InputActionSpec): number {
    return Math.max(1, Math.round(action.stepScenes ?? 1));
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

  private dispatchPinch(action: InputActionSpec, pinchDelta: number): void {
    const speed = this.actionSpeed(action);
    const cameraId = action.cameraId ?? 'camera';
    switch (action.type) {
      case 'camera.dolly':
        this.handler.onCameraDolly(cameraId, pinchDelta, speed);
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
  ): void {
    const speed = this.actionSpeed(action);
    const cameraId = action.cameraId ?? 'camera';
    const canvasId = action.canvasId ?? 'llm-canvas';
    const filtered = this.applyAxisToDelta(mapAxis, lockAxis, dx, dy);

    switch (action.type) {
      case 'camera.orbit':
        this.handler.onCameraOrbit(cameraId, filtered.dx, filtered.dy, speed);
        return;
      case 'camera.dolly':
        this.handler.onCameraDolly(cameraId, this.pointerDelta(mapAxis, filtered.dx, filtered.dy), speed);
        return;
      case 'canvas.pan':
      case 'diagram-canvas.move':
        this.handler.onDiagramCanvasMove(canvasId, filtered.dx, filtered.dy, speed);
        return;
      case 'diagram-canvas.rotate':
        this.handler.onDiagramCanvasRotate(canvasId, filtered.dx, filtered.dy, speed);
        return;
      default:
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
    const cameraId = action.cameraId ?? 'camera';
    const canvasId = action.canvasId ?? 'llm-canvas';
    const rawDx = e.deltaX;
    // Keep wheel Y aligned with drag-style "positive is upward" interaction semantics.
    const rawDy = -e.deltaY;
    const filtered = this.applyAxisToDelta(mapAxis, lockAxis, rawDx, rawDy);
    const mainDelta = this.pointerDelta(mapAxis, filtered.dx, filtered.dy);

    switch (action.type) {
      case 'camera.orbit':
        this.handler.onCameraOrbit(cameraId, filtered.dx, filtered.dy, speed * 0.4);
        return;
      case 'camera.dolly':
        this.handler.onCameraDolly(cameraId, mainDelta, speed);
        return;
      case 'camera.reset':
        this.handler.onCameraReset(cameraId);
        return;
      case 'canvas.pan':
      case 'diagram-canvas.move':
        this.handler.onDiagramCanvasMove(canvasId, filtered.dx, filtered.dy, speed);
        return;
      case 'diagram-canvas.rotate':
        this.handler.onDiagramCanvasRotate(canvasId, filtered.dx, filtered.dy, speed);
        return;
      case 'diagram-canvas.reset':
        this.handler.onDiagramCanvasReset(canvasId);
        return;
      case 'scene.next':
        this.handler.onSceneStep(1, this.actionStepScenes(action));
        return;
      case 'scene.prev':
        this.handler.onSceneStep(-1, this.actionStepScenes(action));
        return;
      default:
        return;
    }
  }

  private dispatchKey(action: InputActionSpec): void {
    const cameraId = action.cameraId ?? 'camera';
    const canvasId = action.canvasId ?? 'llm-canvas';
    switch (action.type) {
      case 'camera.reset':
        this.handler.onCameraReset(cameraId);
        return;
      case 'diagram-canvas.reset':
        this.handler.onDiagramCanvasReset(canvasId);
        return;
      case 'scene.next':
        this.handler.onSceneStep(1, this.actionStepScenes(action));
        return;
      case 'scene.prev':
        this.handler.onSceneStep(-1, this.actionStepScenes(action));
        return;
      default:
        return;
    }
  }

  private dispatchClick(action: InputActionSpec, e: MouseEvent): void {
    const canvasId = action.canvasId ?? 'llm-canvas';
    switch (action.type) {
      case 'diagram-canvas.focus':
        this.handler.onDiagramCanvasFocus(canvasId, e.clientX, e.clientY, action.focusCenter);
        return;
      case 'scene.next':
        this.handler.onSceneStep(1, this.actionStepScenes(action));
        return;
      case 'scene.prev':
        this.handler.onSceneStep(-1, this.actionStepScenes(action));
        return;
      default:
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
    this.dispatchDrag(this.activeDrag.action, this.activeDrag.map.axis, this.activeDrag.lockedAxis, dx, dy);
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

  private handleWheel(e: WheelEvent): void {
    const spec = this.resolveSpec();
    if (!spec) return;

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
        const pinchDelta = e.deltaY;
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
    if (!best) return;
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
        currentTs - prevWheelLock.lastEventTs <= WHEEL_LOCK_IDLE_MS;
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
    selected.forEach((item) => this.dispatchKey(item.action));
  }
}
