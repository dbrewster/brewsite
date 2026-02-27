// Normalizes DOM events → navigation actions via SceneNavInputMap.
// No React, no Three.js, no compile pipeline.

import type {
  SceneNavInputMap,
  InputNavigationHandler,
  ModifierKey,
  KeyCombo,
  WheelConfig,
  DragConfig,
  SwipeConfig,
  ClickConfig,
} from './types';

const DEFAULT_KEYS = {
  nextScene:  [{ key: 'ArrowRight' }, { key: 'ArrowDown' }] as KeyCombo[],
  prevScene:  [{ key: 'ArrowLeft' }, { key: 'ArrowUp' }] as KeyCombo[],
  nextFrame:  [{ key: '.' }] as KeyCombo[],
  prevFrame:  [{ key: ',' }] as KeyCombo[],
  home:       [{ key: 'Home' }] as KeyCombo[],
  end:        [{ key: 'End' }] as KeyCombo[],
};

const modifiersMatch = (
  event: KeyboardEvent | WheelEvent | PointerEvent | MouseEvent,
  required?: ModifierKey[],
): boolean => {
  if (!required || required.length === 0) {
    // Only fire if NO modifiers are held (avoids hijacking browser shortcuts)
    return !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
  }
  return (
    (!required.includes('alt') || event.altKey) &&
    (!required.includes('ctrl') || event.ctrlKey) &&
    (!required.includes('meta') || event.metaKey) &&
    (!required.includes('shift') || event.shiftKey)
  );
};

const keyMatches = (event: KeyboardEvent, combo: KeyCombo): boolean => {
  return event.key === combo.key && modifiersMatch(event, combo.modifiers);
};

export class InputController {
  private handler: InputNavigationHandler;
  private map: SceneNavInputMap;
  private target: HTMLElement | Window;
  private keyboardTarget: HTMLElement | Document | Window;
  /**
   * Optional guard checked only for wheel events.
   * When this returns true, wheel-based scene navigation is suppressed.
   * Does NOT affect keyboard, drag, swipe, or click navigation.
   * Typical use: suppress wheel nav when camera-controls claims the wheel for dolly.
   */
  private wheelGuard?: () => boolean;

  // Drag state
  private dragStart: { x: number; y: number; progress: number } | null = null;
  // Swipe state
  private touchStart: { x: number; y: number; t: number } | null = null;
  // Click-vs-drag discrimination: record pointer position at pointerdown so
  // handleMouseClick can suppress navigation when the pointer has moved too far.
  private clickOrigin: { x: number; y: number } | null = null;

  // Bound listeners (kept as references for cleanup)
  private onWheel: (e: WheelEvent) => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onTouchStart: (e: TouchEvent) => void;
  private onTouchEnd: (e: TouchEvent) => void;
  private onClick: (e: MouseEvent) => void;
  private onAuxClick: (e: MouseEvent) => void;
  private onContextMenu: (e: MouseEvent) => void;
  // Lightweight pointerdown tracker attached whenever click navigation is configured.
  // Distinct from onPointerDown (which handles drag navigation in direct mode).
  private onClickOriginDown: (e: PointerEvent) => void;

  constructor(
    target: HTMLElement | Window,
    map: SceneNavInputMap,
    handler: InputNavigationHandler,
    keyboardTarget?: HTMLElement | Document | Window,
    wheelGuard?: () => boolean,
  ) {
    this.target = target;
    this.map = map;
    this.handler = handler;
    this.keyboardTarget = keyboardTarget ?? (target instanceof HTMLElement ? target : document);
    this.wheelGuard = wheelGuard;

    // Build bound listeners
    this.onWheel = this.handleWheel.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onTouchStart = this.handleTouchStart.bind(this);
    this.onTouchEnd = this.handleTouchEnd.bind(this);
    this.onClick = this.handleClick.bind(this);
    this.onAuxClick = this.handleAuxClick.bind(this);
    this.onContextMenu = this.handleContextMenu.bind(this);
    this.onClickOriginDown = (e: PointerEvent) => {
      // Record the pointer position at press time for click-vs-drag discrimination.
      this.clickOrigin = { x: e.clientX, y: e.clientY };
    };
  }

  attach(): void {
    const mode = this.map.mode ?? 'scroll';

    // Wheel: active in both modes
    if (this.map.wheel !== false) {
      this.target.addEventListener('wheel', this.onWheel as EventListener, { passive: false });
    }

    // Keyboard: always active when configured
    if (this.map.keys !== false) {
      this.keyboardTarget.addEventListener('keydown', this.onKeyDown as EventListener);
    }

    // Drag and touch: only in direct mode
    if (mode === 'direct') {
      if (this.map.drag !== false) {
        this.target.addEventListener('pointerdown', this.onPointerDown as EventListener);
        this.target.addEventListener('pointermove', this.onPointerMove as EventListener);
        this.target.addEventListener('pointerup', this.onPointerUp as EventListener);
        this.target.addEventListener('pointercancel', this.onPointerUp as EventListener);
      }
      if (this.map.swipe !== false) {
        this.target.addEventListener('touchstart', this.onTouchStart as EventListener, { passive: true });
        this.target.addEventListener('touchend', this.onTouchEnd as EventListener, { passive: true });
      }
      if (this.map.click !== false) {
        // Track pointer origin for click-vs-drag discrimination (see handleMouseClick).
        this.target.addEventListener('pointerdown', this.onClickOriginDown as EventListener);
        this.target.addEventListener('click', this.onClick as EventListener);
        this.target.addEventListener('auxclick', this.onAuxClick as EventListener);
        this.target.addEventListener('contextmenu', this.onContextMenu as EventListener);
      }
    }
  }

  detach(): void {
    this.target.removeEventListener('wheel', this.onWheel as EventListener);
    this.keyboardTarget.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('pointerdown', this.onPointerDown as EventListener);
    this.target.removeEventListener('pointerdown', this.onClickOriginDown as EventListener);
    this.target.removeEventListener('pointermove', this.onPointerMove as EventListener);
    this.target.removeEventListener('pointerup', this.onPointerUp as EventListener);
    this.target.removeEventListener('pointercancel', this.onPointerUp as EventListener);
    this.target.removeEventListener('touchstart', this.onTouchStart as EventListener);
    this.target.removeEventListener('touchend', this.onTouchEnd as EventListener);
    this.target.removeEventListener('click', this.onClick as EventListener);
    this.target.removeEventListener('auxclick', this.onAuxClick as EventListener);
    this.target.removeEventListener('contextmenu', this.onContextMenu as EventListener);
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  private handleWheel(e: WheelEvent): void {
    const cfg = this.map.wheel;
    if (cfg === false) return;
    const wheelCfg = typeof cfg === 'object' ? cfg : {} as WheelConfig;
    if (!modifiersMatch(e, wheelCfg.modifiers)) return;
    // Suppress wheel-based scene navigation when another system (e.g. camera-controls)
    // owns the wheel. Only applies to wheel events — keyboard/drag/swipe are unaffected.
    if (this.wheelGuard?.()) return;

    const mode = this.map.mode ?? 'scroll';
    if (mode === 'scroll') {
      // In scroll mode, let the browser handle scrolling naturally.
      // The useEngineScroll hook reads window.scrollY.
      return;
    }

    // Direct mode: convert wheel delta to progress delta
    e.preventDefault();
    const sceneCount = this.handler.getSceneCount();
    const sensitivity = wheelCfg.sensitivity ?? 1 / Math.max(1, sceneCount - 1);
    // deltaY is in pixels (100 = typical one wheel tick)
    const normalized = e.deltaY / 100;
    const delta = normalized * sensitivity;
    this.handler.onScroll(delta);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const cfg = this.map.keys;
    if (cfg === false) return;
    const keys = typeof cfg === 'object' ? cfg : {};

    const sceneCount = this.handler.getSceneCount();

    const check = (combos: KeyCombo[], action: () => void) => {
      if (combos.some((c) => keyMatches(e, c))) {
        e.preventDefault();
        action();
      }
    };

    const nextSceneCombos = keys.nextScene !== null
      ? (keys.nextScene ? [keys.nextScene] : DEFAULT_KEYS.nextScene)
      : [];
    const prevSceneCombos = keys.prevScene !== null
      ? (keys.prevScene ? [keys.prevScene] : DEFAULT_KEYS.prevScene)
      : [];
    const nextFrameCombos = keys.nextFrame !== null
      ? (keys.nextFrame ? [keys.nextFrame] : DEFAULT_KEYS.nextFrame)
      : [];
    const prevFrameCombos = keys.prevFrame !== null
      ? (keys.prevFrame ? [keys.prevFrame] : DEFAULT_KEYS.prevFrame)
      : [];
    const homeCombos = keys.home !== null
      ? (keys.home ? [keys.home] : DEFAULT_KEYS.home)
      : [];
    const endCombos = keys.end !== null
      ? (keys.end ? [keys.end] : DEFAULT_KEYS.end)
      : [];

    const step = sceneCount > 1 ? 1 / (sceneCount - 1) : 1;

    check(nextSceneCombos, () => this.handler.onScroll(step));
    check(prevSceneCombos, () => this.handler.onScroll(-step));
    check(nextFrameCombos, () => this.handler.onScroll(step / 10));
    check(prevFrameCombos, () => this.handler.onScroll(-step / 10));
    check(homeCombos, () => this.handler.onJumpToScene(0));
    check(endCombos, () => this.handler.onJumpToScene(sceneCount - 1));

  }

  private handlePointerDown(e: PointerEvent): void {
    const cfg = this.map.drag as DragConfig | undefined;
    if (!cfg) return;
    const button = cfg.button ?? 'left';
    const buttonIndex = button === 'left' ? 0 : button === 'middle' ? 1 : 2;
    if (e.button !== buttonIndex) return;
    if (!modifiersMatch(e, cfg.modifiers)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.dragStart = { x: e.clientX, y: e.clientY, progress: this.handler.getProgress() };
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.dragStart) return;
    const cfg = this.map.drag as DragConfig | undefined;
    const pixelsPerScene = cfg?.pixelsPerScene ?? 200;
    const axis = cfg?.axis ?? 'y';
    const delta = axis === 'y'
      ? e.clientY - this.dragStart.y
      : e.clientX - this.dragStart.x;
    const sceneCount = this.handler.getSceneCount();
    const step = sceneCount > 1 ? 1 / (sceneCount - 1) : 1;
    const progressDelta = (delta / pixelsPerScene) * step;
    // Drag downward/rightward = backward (previous scene)
    const newProgress = Math.min(1, Math.max(0, this.dragStart.progress + progressDelta));
    this.handler.onScroll(newProgress - this.handler.getProgress());
  }

  private handlePointerUp(_e: PointerEvent): void {
    this.dragStart = null;
  }

  private handleTouchStart(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!touch) return;
    this.touchStart = { x: touch.clientX, y: touch.clientY, t: performance.now() };
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.touchStart) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const cfg = this.map.swipe as SwipeConfig | undefined;
    const direction = cfg?.direction ?? 'vertical';
    const velocityThreshold = cfg?.velocityThreshold ?? 0.3;

    const dx = touch.clientX - this.touchStart.x;
    const dy = touch.clientY - this.touchStart.y;
    const dt = performance.now() - this.touchStart.t;
    this.touchStart = null;

    const vx = Math.abs(dx / dt);
    const vy = Math.abs(dy / dt);
    const sceneCount = this.handler.getSceneCount();
    const step = sceneCount > 1 ? 1 / (sceneCount - 1) : 1;

    if (direction === 'vertical' || direction === 'both') {
      if (vy > velocityThreshold && Math.abs(dy) > Math.abs(dx)) {
        this.handler.onScroll(dy > 0 ? -step : step);
      }
    }
    if (direction === 'horizontal' || direction === 'both') {
      if (vx > velocityThreshold && Math.abs(dx) > Math.abs(dy)) {
        this.handler.onScroll(dx > 0 ? -step : step);
      }
    }
  }

  // ─── Click navigation ───────────────────────────────────────────────────

  private normalizeClickConfigs(): ClickConfig[] {
    const cfg = this.map.click;
    if (!cfg) return [];
    return Array.isArray(cfg) ? cfg : [cfg];
  }

  private handleClick(e: MouseEvent): void {
    this.handleMouseClick(e, 'click');
  }

  private handleAuxClick(e: MouseEvent): void {
    this.handleMouseClick(e, 'auxclick');
  }

  private handleContextMenu(e: MouseEvent): void {
    this.handleMouseClick(e, 'contextmenu');
  }

  private handleMouseClick(e: MouseEvent, source: 'click' | 'auxclick' | 'contextmenu'): void {
    const configs = this.normalizeClickConfigs();
    if (configs.length === 0) return;

    const button = e.button;
    for (const cfg of configs) {
      const desired = cfg.button ?? 'left';
      const desiredButton = desired === 'left' ? 0 : desired === 'middle' ? 1 : 2;
      if (button !== desiredButton) continue;
      if (!modifiersMatch(e, cfg.modifiers)) continue;

      // Suppress navigation if the pointer has moved further than the drag threshold
      // since pointerdown. This lets camera-controls orbit/pan run without triggering
      // scene navigation on mouse release.
      if (this.clickOrigin !== null) {
        const dx = e.clientX - this.clickOrigin.x;
        const dy = e.clientY - this.clickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const threshold = cfg.dragThreshold ?? 8;
        if (dist > threshold) continue;
      }

      // Right click is delivered as contextmenu in most browsers; prevent default to avoid menu.
      if (source === 'contextmenu') {
        e.preventDefault();
      }

      const sceneCount = this.handler.getSceneCount();
      if (sceneCount <= 1) return;
      const stepScenes = cfg.stepScenes ?? 1;
      const step = stepScenes / (sceneCount - 1);
      const delta = cfg.action === 'nextScene' ? step : -step;
      this.handler.onScroll(delta);
      return;
    }
  }
}
