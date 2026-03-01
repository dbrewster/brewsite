// Extended engine input hook — replaces useEngineScroll when inputMap is provided.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { SceneNavInputMap } from '../input/types';
import { InputController } from '../input/InputController';
import { ActionInputController } from '../input/ActionInputController';
import type { SceneInputControllerSpec } from '../input/types';
import { useEngineScroll } from './useEngineScroll';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export type UseEngineInputOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
  /** Number of scenes, used for keyboard step calculation. */
  sceneCount: number;
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
   * touching `window.scrollY` or `window.scrollTo`.
   *
   * Pair with `onControlledProgressChange` so that `engine.scrollToProgress()`
   * propagates back to the owner's state setter, keeping UI controls in sync.
   */
  controlledProgress?: number;
  /**
   * Called synchronously when the engine sets progress via `scrollToProgress`.
   * Wire to the same state setter that feeds `controlledProgress`.
   * Stable identity (e.g. a `useState` setter) is strongly recommended.
   */
  onControlledProgressChange?: (p: number) => void;
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
};

export type UseEngineInputResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
};

export const useEngineInput = (options: UseEngineInputOptions): UseEngineInputResult => {
  const {
    scrollRegionRef,
    scrollRegionHeightPx,
    sceneCount,
    canvasRef,
    inputMap,
    inputControllerSpec,
    onCameraOrbit,
    onCameraDolly,
    onCameraReset,
    onDiagramCanvasMove,
    onDiagramCanvasRotate,
    onDiagramCanvasReset,
    onDiagramCanvasFocus,
  } = options;

  // ─── Scroll mode: delegate to useEngineScroll ─────────────────────────
  const scrollResult = useEngineScroll({ scrollRegionRef, scrollRegionHeightPx });

  // Extract stable function references to avoid tearing down InputController
  // on every render. scrollResult object reference changes each render, but
  // the functions it returns are stable useCallback instances.
  const scrollToProgressStable = scrollResult.scrollToProgress;
  const getGlobalProgressStable = scrollResult.getGlobalProgress;

  // ─── Direct mode: self-managed progress ref ───────────────────────────
  const [directProgress, setDirectProgress] = useState(0);
  const directProgressRef = useRef(0);

  // ─── Controlled mode: owner provides progress via prop ────────────────
  // Mutable ref so getGlobalProgress() always returns the latest prop value
  // without a stale closure. Updated synchronously on every render.
  const controlledProgressRef = useRef<number>(options.controlledProgress ?? 0);
  if (options.controlledProgress !== undefined) {
    controlledProgressRef.current = options.controlledProgress;
  }
  // Stable ref to the callback so scrollToControlledProgress never rebuilds.
  const onControlledProgressChangeRef = useRef(options.onControlledProgressChange);
  onControlledProgressChangeRef.current = options.onControlledProgressChange;

  const getControlledProgress = useCallback(() => controlledProgressRef.current, []);

  const scrollToControlledProgress = useCallback((next: number) => {
    const clamped = clamp01(next);
    // Update the ref synchronously so the Three.js loop sees it immediately,
    // before the owner's state setter has triggered a re-render.
    controlledProgressRef.current = clamped;
    // Notify the owner to update controlledProgress prop (completes the loop).
    // The resulting re-render propagates the new value back as options.controlledProgress,
    // which is what engine.progress and state.progress report to UI components.
    onControlledProgressChangeRef.current?.(clamped);
  }, []);

  const setDirectProgressBoth = useCallback((next: number) => {
    const clamped = clamp01(next);
    directProgressRef.current = clamped;
    setDirectProgress(clamped);
  }, []);

  const getDirectProgress = useCallback(() => directProgressRef.current, []);
  const specRef = useRef<SceneInputControllerSpec | null>(inputControllerSpec ?? null);
  specRef.current = inputControllerSpec ?? null;
  const hasSceneController = inputControllerSpec !== null && inputControllerSpec !== undefined;
  const sceneControllerScope = inputControllerSpec?.scope ?? 'canvas';

  // ─── InputController attachment ───────────────────────────────────────
  useEffect(() => {
    // Controlled mode: the owner drives progress externally. Keyboard shortcuts
    // are not attached because they would call window.scrollTo via the legacy
    // scroll handler. The owner can wire its own keyboard handling if needed.
    if (options.controlledProgress !== undefined) return;

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
      );
      ctrl.attach();
      return () => ctrl.detach();
    }

    // Legacy fallback when no scene InputController is authored:
    // preserve scroll-driven scene transitions and optional keyboard shortcuts.
    // Wheel remains native browser scroll in this mode.
    if (inputMap?.keys === false) return;

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

    const ctrl = new InputController(window, scrollModeMap, handler);
    ctrl.attach();
    return () => ctrl.detach();
  }, [
    // Stable references only — no object literals that change every render
    inputMap, sceneCount, canvasRef, canvasRef?.current, scrollRegionRef,
    scrollToProgressStable, getGlobalProgressStable,
    setDirectProgressBoth, getDirectProgress,
    hasSceneController, sceneControllerScope,
    onCameraOrbit, onCameraDolly, onCameraReset, onDiagramCanvasMove, onDiagramCanvasRotate,
    onDiagramCanvasReset,
    onDiagramCanvasFocus,
  ]);

  // ─── Return appropriate interface ─────────────────────────────────────

  // Controlled mode: progress is entirely owned by the parent via prop.
  // No window.scrollY reads, no window.scrollTo calls.
  if (options.controlledProgress !== undefined) {
    return {
      progress: options.controlledProgress,
      scrollToProgress: scrollToControlledProgress,
      getGlobalProgress: getControlledProgress,
    };
  }

  if (hasSceneController) {
    return {
      progress: directProgress,
      scrollToProgress: setDirectProgressBoth,
      getGlobalProgress: getDirectProgress,
    };
  }

  return scrollResult;
};
