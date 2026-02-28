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
    wheelGuard,
    inputControllerSpec,
    onCameraOrbit,
    onCameraDolly,
    onCameraReset,
    onDiagramCanvasMove,
    onDiagramCanvasRotate,
    onDiagramCanvasReset,
    onDiagramCanvasFocus,
  } = options;

  const mode = inputMap?.mode ?? 'scroll';

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

    if (!inputMap || mode === 'scroll') {
      // Always register keyboard navigation unless it has been explicitly disabled
      // via inputMap.keys === false. When inputMap is undefined (not provided at all),
      // we still want the default arrow/home/end keybindings to work.
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

      // In scroll mode: keyboard only. Wheel is handled by the browser + useEngineScroll.
      const scrollModeMap: SceneNavInputMap = {
        mode: 'scroll',
        wheel: false,
        drag: false,
        swipe: false,
        keys: inputMap?.keys, // undefined → InputController uses DEFAULT_KEYS for all actions
      };

      const ctrl = new InputController(window, scrollModeMap, handler);
      ctrl.attach();
      return () => ctrl.detach();
    }

    // Direct mode: attach to the scroll region (preferred), then canvas, then window.
    // Keyboard events attach to window so they fire regardless of focus target.
    const attachTarget = scrollRegionRef.current ?? canvasRef?.current ?? window;
    const keyboardTarget = window;

    const handler = {
      onScroll: (delta: number) => {
        // NOTE: wheelGuard is checked inside InputController.handleWheel, NOT here.
        // Checking it here would incorrectly block keyboard/drag/swipe navigation.
        const next = clamp01(directProgressRef.current + delta);
        setDirectProgressBoth(next);
      },
      onJumpToScene: (index: number) => {
        const progress = sceneCount > 1 ? index / (sceneCount - 1) : 0;
        setDirectProgressBoth(progress);
      },
      getProgress: getDirectProgress,
      getSceneCount: () => sceneCount,
    };

    // wheelGuard is passed as the 5th arg so it only suppresses wheel events,
    // leaving keyboard, drag, swipe, and click navigation fully operational.
    const ctrl = new InputController(attachTarget, inputMap, handler, keyboardTarget, wheelGuard);
    ctrl.attach();
    return () => ctrl.detach();
  }, [
    // Stable references only — no object literals that change every render
    inputMap, mode, sceneCount, canvasRef, canvasRef?.current, scrollRegionRef,
    scrollToProgressStable, getGlobalProgressStable,
    setDirectProgressBoth, getDirectProgress, wheelGuard,
    hasSceneController, sceneControllerScope,
    onCameraOrbit, onCameraDolly, onCameraReset, onDiagramCanvasMove, onDiagramCanvasRotate,
    onDiagramCanvasReset,
    onDiagramCanvasFocus,
  ]);

  // ─── Return appropriate interface ─────────────────────────────────────
  if (hasSceneController || mode === 'direct') {
    return {
      progress: directProgress,
      scrollToProgress: setDirectProgressBoth,
      getGlobalProgress: getDirectProgress,
    };
  }

  return scrollResult;
};
