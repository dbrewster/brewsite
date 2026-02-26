// Extended engine input hook — replaces useEngineScroll when inputMap is provided.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { SceneNavInputMap } from '../input/types';
import { InputController } from '../input/InputController';
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

  // ─── InputController attachment ───────────────────────────────────────
  useEffect(() => {
    if (!inputMap || mode === 'scroll') {
      if (!inputMap || inputMap.keys === false) return;

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
      // The wheelGuard is applied at the InputController level via shouldHandleWheel.
      const scrollModeMap: SceneNavInputMap = {
        mode: 'scroll',
        wheel: false,
        drag: false,
        swipe: false,
        keys: inputMap.keys,
      };

      const ctrl = new InputController(window, scrollModeMap, handler);
      ctrl.attach();
      return () => ctrl.detach();
    }

    // Direct mode: attach to canvas (preferred) or window
    // Keyboard events attach to the scrollRegionRef element (which has tabIndex=-1).
    // See EngineInputRegion for why tabIndex is needed.
    const attachTarget = canvasRef?.current ?? window;

    const handler = {
      onScroll: (delta: number) => {
        // Respect wheelGuard: if camera-controls claims the wheel, do not advance scene
        if (wheelGuard?.()) return;
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

    const ctrl = new InputController(attachTarget, inputMap, handler);
    ctrl.attach();
    return () => ctrl.detach();
  }, [
    // Stable references only — no object literals that change every render
    inputMap, mode, sceneCount, canvasRef,
    scrollToProgressStable, getGlobalProgressStable,
    setDirectProgressBoth, getDirectProgress, wheelGuard,
  ]);

  // ─── Return appropriate interface ─────────────────────────────────────
  if (mode === 'direct') {
    return {
      progress: directProgress,
      scrollToProgress: setDirectProgressBoth,
      getGlobalProgress: getDirectProgress,
    };
  }

  return scrollResult;
};
