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
  if (!required || required.length === 0) {
    return !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
  }
  return (
    (!required.includes('alt') || event.altKey) &&
    (!required.includes('ctrl') || event.ctrlKey) &&
    (!required.includes('meta') || event.metaKey) &&
    (!required.includes('shift') || event.shiftKey)
  );
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
  x: number;
  y: number;
};

export class ActionInputController {
  private activeDrag: ActiveDrag | null = null;
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
  }

  private actionSpeed(action: InputActionSpec): number {
    return action.speed ?? 1;
  }

  private actionStepScenes(action: InputActionSpec): number {
    return Math.max(1, Math.round(action.stepScenes ?? 1));
  }

  private pointerDelta(mapAxis: 'x' | 'y' | 'xy' | undefined, dx: number, dy: number): number {
    if (mapAxis === 'x') return dx;
    if (mapAxis === 'y') return dy;
    return Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  }

  private resolveSpec(): SceneInputControllerSpec | null {
    return this.getSpec();
  }

  private dispatchDrag(action: InputActionSpec, mapAxis: 'x' | 'y' | 'xy' | undefined, dx: number, dy: number): void {
    const speed = this.actionSpeed(action);
    const cameraId = action.cameraId ?? 'camera';
    const canvasId = action.canvasId ?? 'llm-canvas';

    switch (action.type) {
      case 'camera.orbit':
        this.handler.onCameraOrbit(cameraId, dx, dy, speed);
        return;
      case 'camera.dolly':
        this.handler.onCameraDolly(cameraId, this.pointerDelta(mapAxis, dx, dy), speed);
        return;
      case 'canvas.pan':
      case 'diagram-canvas.move':
        this.handler.onDiagramCanvasMove(canvasId, dx, dy, speed);
        return;
      case 'diagram-canvas.rotate':
        this.handler.onDiagramCanvasRotate(canvasId, dx, dy, speed);
        return;
      default:
        return;
    }
  }

  private dispatchWheel(action: InputActionSpec, mapAxis: 'x' | 'y' | 'xy' | undefined, e: WheelEvent): void {
    const speed = this.actionSpeed(action);
    const cameraId = action.cameraId ?? 'camera';
    const canvasId = action.canvasId ?? 'llm-canvas';
    const dx = e.deltaX;
    const dy = e.deltaY;
    const mainDelta = this.pointerDelta(mapAxis, dx, dy);

    switch (action.type) {
      case 'camera.orbit':
        this.handler.onCameraOrbit(cameraId, dx, dy, speed * 0.4);
        return;
      case 'camera.dolly':
        this.handler.onCameraDolly(cameraId, mainDelta, speed);
        return;
      case 'camera.reset':
        this.handler.onCameraReset(cameraId);
        return;
      case 'canvas.pan':
      case 'diagram-canvas.move':
        this.handler.onDiagramCanvasMove(canvasId, dx, dy, speed);
        return;
      case 'diagram-canvas.rotate':
        this.handler.onDiagramCanvasRotate(canvasId, dx, dy, speed);
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

    this.activeDrag = { action: best.action, map: best.map, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can fail in non-browser test environments.
    }
    e.preventDefault();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.activeDrag || e.pointerId !== this.activeDrag.pointerId) return;
    const dx = e.clientX - this.activeDrag.x;
    const dy = e.clientY - this.activeDrag.y;
    this.activeDrag.x = e.clientX;
    this.activeDrag.y = e.clientY;
    this.dispatchDrag(this.activeDrag.action, this.activeDrag.map.axis, dx, dy);
    e.preventDefault();
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.activeDrag || e.pointerId !== this.activeDrag.pointerId) return;
    this.activeDrag = null;
  }

  private handleWheel(e: WheelEvent): void {
    const spec = this.resolveSpec();
    if (!spec) return;

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
    this.dispatchWheel(best.action, best.map.axis, e);
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
