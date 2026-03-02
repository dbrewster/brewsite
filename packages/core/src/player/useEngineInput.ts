// Extended engine input hook — replaces useEngineScroll when inputMap is provided.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { SceneNavInputMap } from '../input/types';
import { InputController } from '../input/InputController';
import { ActionInputController } from '../input/ActionInputController';
import type { SceneInputControllerSpec } from '../input/types';
import { useEngineScroll } from './useEngineScroll';
import type { SceneProgressMapper } from './SceneProgressMapper';
import type { ScrollSource } from './engineTypes';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export type UseEngineInputOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
  scrollSource?: ScrollSource;
  /** Number of scenes, used for keyboard step calculation. */
  sceneCount: number;
  /**
   * Resolved input mode from useSceneEngine policy.
   * Defaults to direct when scene controller exists, otherwise scroll.
   */
  inputMode?: 'scroll' | 'direct';
  /** Optional canvas element ref for direct-mode event attachment. */
  canvasRef?: RefObject<HTMLElement | null>;
  /** Input configuration. If omitted, behaves identically to useEngineScroll. */
  inputMap?: SceneNavInputMap;
  /**
   * Optional guard: if this returns true, wheel events for scene navigation
   * are suppressed. Wire to CameraWidget.isWheelClaimedByInteraction() to
   * prevent double-handling when camera-controls has wheel dolly active.
   */
  wheelGuard?: () => boolean;
  /** Optional scene-authored action controller spec (from <InputController> DSL). */
  inputControllerSpec?: SceneInputControllerSpec | null;
  /**
   * When provided, bypasses scroll-derived progress entirely. The engine reads
   * this value (clamped [0, 1]) directly on every Three.js frame without
   * touching scroll position.
   */
  controlledProgress?: number;
  /**
   * Called synchronously when the engine sets progress via `scrollToProgress`.
   * Wire to the same state setter that feeds `controlledProgress`.
   * Stable identity (e.g. a `useState` setter) is strongly recommended.
   */
  onControlledProgressChange?: (p: number) => void;
  /**
   * When true, enables built-in keyboard scene navigation in controlled mode.
   * Keyboard-only: no wheel/pointer listeners are attached in controlled mode.
   */
  enableKeyboardInControlledMode?: boolean;
  /**
   * Optional keyboard mapping override used only when controlled mode keyboard
   * support is enabled.
   */
  controlledInputMap?: SceneNavInputMap;
  /**
   * Optional progress mapper. Applied in scroll mode and direct mode (wheel/drag).
   * NOT applied in controlled-progress mode — the controlled-progress owner
   * provides semantic engine progress directly.
   */
  progressMapper?: SceneProgressMapper | null;
  /**
   * Default action targets used when authored action maps omit cameraId/canvasId.
   */
  idDefaults?: {
    cameraId: string;
    canvasId: string;
  };
  /**
   * Sticky wheel-lock idle timeout for action maps.
   */
  actionWheelLockIdleMs?: number;
  onCameraOrbit?: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraDolly?: (cameraId: string, delta: number, speed: number) => void;
  onCameraReset?: (cameraId: string) => void;
  onDiagramCanvasMove?: (canvasId: string, dx: number, dy: number, speed: number) => void;
  onDiagramCanvasRotate?: (canvasId: string, dx: number, dy: number, speed: number) => void;
  onDiagramCanvasReset?: (canvasId: string) => void;
  onDiagramCanvasFocus?: (
    canvasId: string,
    clientX: number,
    clientY: number,
    focusCenter?: [number, number] | [number, number, number],
  ) => void;
  /**
   * Called when a genuine user scroll event fires.
   */
  onUserScroll?: () => void;
};

export type UseEngineInputResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  /** Returns the pre-mapper raw progress [0..1]. Used by auto-advance. */
  getRawProgress(): number;
  /**
   * Advances progress to the given raw (pre-mapper) value.
   */
  scrollToRawProgress(raw: number): void;
  /**
   * Directly writes the given raw value into refs without calling scrollTo.
   */
  forceRawProgress(raw: number): void;
};

export const useEngineInput = (options: UseEngineInputOptions): UseEngineInputResult => {
  const {
    scrollRegionRef,
    scrollRegionHeightPx,
    scrollSource,
    sceneCount,
    canvasRef,
    inputMap,
    inputControllerSpec,
    progressMapper,
    onCameraOrbit,
    onCameraDolly,
    onCameraReset,
    onDiagramCanvasMove,
    onDiagramCanvasRotate,
    onDiagramCanvasReset,
    onDiagramCanvasFocus,
  } = options;

  // ─── Scroll mode: delegate to useEngineScroll ─────────────────────────
  const scrollResult = useEngineScroll({
    scrollRegionRef,
    scrollRegionHeightPx,
    scrollSource,
    progressMapper,
    onUserScroll: options.onUserScroll,
  });

  // Stable function references from useEngineScroll.
  const scrollToProgressStable = scrollResult.scrollToProgress;
  const getGlobalProgressStable = scrollResult.getGlobalProgress;

  // ─── Direct mode: self-managed progress ref ───────────────────────────
  const [directProgress, setDirectProgress] = useState(0);
  const directProgressRef = useRef(0);

  // ─── Controlled mode: owner provides progress via prop ────────────────
  const controlledProgressRef = useRef<number>(options.controlledProgress ?? 0);
  if (options.controlledProgress !== undefined) {
    controlledProgressRef.current = options.controlledProgress;
  }
  const onControlledProgressChangeRef = useRef(options.onControlledProgressChange);
  onControlledProgressChangeRef.current = options.onControlledProgressChange;

  const getControlledProgress = useCallback(() => controlledProgressRef.current, []);

  const scrollToControlledProgress = useCallback((next: number) => {
    const clamped = clamp01(next);
    controlledProgressRef.current = clamped;
    onControlledProgressChangeRef.current?.(clamped);
  }, []);

  const setDirectProgressBoth = useCallback((next: number) => {
    const clamped = clamp01(next);
    directProgressRef.current = clamped;
    setDirectProgress(clamped);
  }, []);

  const specRef = useRef<SceneInputControllerSpec | null>(inputControllerSpec ?? null);
  specRef.current = inputControllerSpec ?? null;
  const hasSceneController = inputControllerSpec !== null && inputControllerSpec !== undefined;
  const sceneControllerScope = inputControllerSpec?.scope ?? 'canvas';
  const resolvedInputMode = options.inputMode ?? (hasSceneController ? 'direct' : 'scroll');

  // ─── InputController attachment ───────────────────────────────────────
  useEffect(() => {
    if (options.controlledProgress !== undefined) {
      if (!options.enableKeyboardInControlledMode) return undefined;
      const controlledKeys = options.controlledInputMap?.keys ?? inputMap?.keys;
      if (controlledKeys === false) return undefined;

      const ctrl = new InputController(
        window,
        {
          mode: 'scroll',
          wheel: false,
          drag: false,
          swipe: false,
          click: false,
          keys: controlledKeys,
        },
        {
          onScroll: (delta) => {
            scrollToControlledProgress(clamp01(getControlledProgress() + delta));
          },
          onJumpToScene: (index) => {
            const progress = sceneCount > 1 ? index / (sceneCount - 1) : 0;
            scrollToControlledProgress(progress);
          },
          getProgress: getControlledProgress,
          getSceneCount: () => sceneCount,
        },
      );
      ctrl.attach();
      return () => ctrl.detach();
    }

    if (hasSceneController) {
      const attachTarget = (sceneControllerScope === 'window')
        ? window
        : (canvasRef?.current ?? scrollRegionRef.current ?? window);
      const keyboardTarget = window;

      const ctrl = new ActionInputController(
        attachTarget,
        () => specRef.current,
        {
          getSceneCount: () => sceneCount,
          onSceneStep: (direction, stepScenes) => {
            const step = sceneCount > 1 ? stepScenes / (sceneCount - 1) : 1;
            if (resolvedInputMode === 'scroll') {
              const next = clamp01(getGlobalProgressStable() + direction * step);
              scrollToProgressStable(next);
              return;
            }
            setDirectProgressBoth(clamp01(directProgressRef.current + direction * step));
          },
          onCameraOrbit: (cameraId, dx, dy, speed) => {
            onCameraOrbit?.(cameraId, dx, dy, speed);
          },
          onCameraDolly: (cameraId, delta, speed) => {
            onCameraDolly?.(cameraId, delta, speed);
          },
          onCameraReset: (cameraId) => {
            onCameraReset?.(cameraId);
          },
          onDiagramCanvasMove: (canvasId, dx, dy, speed) => {
            onDiagramCanvasMove?.(canvasId, dx, dy, speed);
          },
          onDiagramCanvasRotate: (canvasId, dx, dy, speed) => {
            onDiagramCanvasRotate?.(canvasId, dx, dy, speed);
          },
          onDiagramCanvasReset: (canvasId) => {
            onDiagramCanvasReset?.(canvasId);
          },
          onDiagramCanvasFocus: (canvasId, clientX, clientY, focusCenter) => {
            onDiagramCanvasFocus?.(canvasId, clientX, clientY, focusCenter);
          },
        },
        keyboardTarget,
        {
          idDefaults: options.idDefaults,
          wheelLockIdleMs: options.actionWheelLockIdleMs,
        },
      );
      ctrl.attach();
      return () => ctrl.detach();
    }

    // Legacy fallback when no scene InputController is authored.
    if (inputMap?.keys === false) return undefined;

    const handler = {
      onScroll: (delta: number) => {
        const next = clamp01(getGlobalProgressStable() + delta);
        scrollToProgressStable(next);
      },
      onJumpToScene: (index: number) => {
        const progress = sceneCount > 1 ? index / (sceneCount - 1) : 0;
        scrollToProgressStable(progress);
      },
      getProgress: getGlobalProgressStable,
      getSceneCount: () => sceneCount,
    };

    const scrollModeMap: SceneNavInputMap = {
      mode: 'scroll',
      wheel: false,
      drag: false,
      swipe: false,
      keys: inputMap?.keys,
    };

    const ctrl = new InputController(window, scrollModeMap, handler, undefined, options.wheelGuard);
    ctrl.attach();
    return () => ctrl.detach();
  }, [
    inputMap,
    sceneCount,
    canvasRef,
    canvasRef?.current,
    scrollRegionRef,
    scrollToProgressStable,
    getGlobalProgressStable,
    setDirectProgressBoth,
    hasSceneController,
    sceneControllerScope,
    resolvedInputMode,
    onCameraOrbit,
    onCameraDolly,
    onCameraReset,
    onDiagramCanvasMove,
    onDiagramCanvasRotate,
    onDiagramCanvasReset,
    onDiagramCanvasFocus,
    options.controlledProgress,
    options.enableKeyboardInControlledMode,
    options.controlledInputMap,
    options.idDefaults,
    options.actionWheelLockIdleMs,
    options.wheelGuard,
    getControlledProgress,
    scrollToControlledProgress,
  ]);

  if (options.controlledProgress !== undefined) {
    return {
      progress: options.controlledProgress,
      scrollToProgress: scrollToControlledProgress,
      getGlobalProgress: getControlledProgress,
      getRawProgress: getControlledProgress,
      scrollToRawProgress: scrollToControlledProgress,
      forceRawProgress: scrollToControlledProgress,
    };
  }

  if (hasSceneController && resolvedInputMode === 'direct') {
    const mappedDirectProgress = progressMapper
      ? progressMapper.remap(directProgress)
      : directProgress;

    const scrollToDirectMapped = (target: number) => {
      const raw = progressMapper ? progressMapper.inverse(clamp01(target)) : clamp01(target);
      setDirectProgressBoth(raw);
    };

    const getDirectMapped = () => {
      const raw = directProgressRef.current;
      return progressMapper ? progressMapper.remap(raw) : raw;
    };

    const getDirectRaw = () => directProgressRef.current;
    const scrollToDirectRaw = (raw: number) => setDirectProgressBoth(clamp01(raw));

    return {
      progress: mappedDirectProgress,
      scrollToProgress: scrollToDirectMapped,
      getGlobalProgress: getDirectMapped,
      getRawProgress: getDirectRaw,
      scrollToRawProgress: scrollToDirectRaw,
      forceRawProgress: scrollToDirectRaw,
    };
  }

  return scrollResult;
};
