// InputCoordinator.tsx — Unified input coordinator.
// Single DOM attachment point with an explicit priority waterfall.
// Replaces ActionInput, InertiaScrollSource, and KeyboardInput.

import { useCallback, useContext, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ActionInputExtensionContext } from './ActionInputExtensionContext';
import { ScrollNavigatorContext } from './ScrollNavigatorContext';
import { ScrollRegionContext } from './ScrollRegionContext';
import { ScrollDriverContext } from './ScrollDriverContext';
import { ActionInputController } from '../input/ActionInputController';
import type { ActionInputHandler } from '../input/ActionInputController';
import type { SceneInputControllerSpec } from '../input/types';
import { resolveLayout } from '../layout/regionLayout';
import type { ViewLayoutState, ViewState } from '../compiler/viewTypes';
import type { CarouselLayoutConfig, ViewLayoutConfig } from '../layout/regionTypes';
import { computeInertiaStep } from './scrollInertia';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';
import type { IScrollSource } from './scrollSourceTypes';
import { clamp01 } from '../math';

export interface InputCoordinatorProps {
  /**
   * Inertia scroll sensitivity. Higher = faster scene scroll per wheel tick.
   * Only applies when inside a ScrollStage. Default: 0.01.
   */
  inertiaSensitivity?: number;

  /**
   * Inertia decay factor per frame (0..1). Higher = more momentum.
   * Only applies when inside a ScrollStage. Default: 0.85.
   */
  inertiaDecay?: number;

  /**
   * DOM element that receives pointer/wheel events.
   * Defaults to the ScrollStage container if available, otherwise engine.canvasRef.
   */
  target?: HTMLElement | null;

  /**
   * DOM element or document that receives keyboard events.
   * Defaults to document.
   */
  keyboardTarget?: HTMLElement | Document | Window | null;

  /**
   * Pause engine rendering when the stage falls below the visibility threshold.
   * Uses IntersectionObserver on the scroll container or canvas.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}

/**
 * InputCoordinator — null-rendering React component that replaces ActionInput,
 * InertiaScrollSource, and KeyboardInput with a single unified input handler.
 *
 * Implements a priority waterfall for wheel events:
 * 1. Scrollable overlay content → yield to native DOM
 * 2. ctrl+wheel with pinch maps → dispatch pinch action
 * 3. WheelMap match → dispatch action (scene scroll does NOT also fire)
 * 4. Scroll driver registered → accumulate for inertia
 * 5. Nothing matched → browser default
 */
export function InputCoordinator(props: InputCoordinatorProps): ReactElement | null {
  const engine = useSceneEngineContext();
  const pluginExtension = useContext(ActionInputExtensionContext);
  const scrollNavigator = useContext(ScrollNavigatorContext);
  const scrollRegion = useContext(ScrollRegionContext);
  const scrollDriver = useContext(ScrollDriverContext);

  // Keep refs that are always current so effect closures read the latest values
  // without needing them in the dependency array.
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const scrollNavigatorRef = useRef(scrollNavigator);
  scrollNavigatorRef.current = scrollNavigator;

  // ── Inertia state ─────────────────────────────────────────────────────────
  const velocityRef = useRef(0);
  const pendingWheelDeltaRef = useRef(0);
  const subscribersRef = useRef(new Set<(rawProgress: number) => void>());
  const rawProgressRef = useRef(0);
  const rafRef = useRef<number>(0);

  // ── Refs for per-frame prop reads (avoids RAF loop re-registration) ────────
  const inertiaSensitivityRef = useRef(props.inertiaSensitivity ?? 0.01);
  inertiaSensitivityRef.current = props.inertiaSensitivity ?? 0.01;
  const inertiaDecayRef = useRef(props.inertiaDecay ?? 0.85);
  inertiaDecayRef.current = props.inertiaDecay ?? 0.85;

  // ── emitProgress helper ────────────────────────────────────────────────────
  const emitProgress = useCallback((rawProgress: number): void => {
    rawProgressRef.current = clamp01(rawProgress);
    // Also sync the ScrollStage container's scrollTop so the native scroll
    // position reflects the programmatic position (needed for snapshots).
    const container = scrollRegion?.containerRef.current;
    if (container && scrollRegion) {
      const maxScroll = Math.max(0, scrollRegion.scrollHeightPx - container.clientHeight);
      container.scrollTop = rawProgressRef.current * maxScroll;
    }
    subscribersRef.current.forEach((cb) => cb(rawProgressRef.current));
  }, [scrollRegion]);

  // ── IScrollSource (registered only when inside ScrollStage) ──────────────
  const scrollSource = useMemo<IScrollSource>(() => ({
    subscribe(onProgress: (rawProgress: number) => void): () => void {
      subscribersRef.current.add(onProgress);
      onProgress(rawProgressRef.current);
      return () => subscribersRef.current.delete(onProgress);
    },
    scrollTo(rawProgress: number): void {
      // Reset momentum so stale velocity doesn't fight the new position.
      velocityRef.current = 0;
      pendingWheelDeltaRef.current = 0;
      emitProgress(rawProgress);
    },
  }), [emitProgress]);

  // Register/unregister the scroll source with the ScrollStage driver.
  useEffect(() => {
    if (!scrollDriver) return;
    scrollDriver.setSource(scrollSource);
    return () => scrollDriver.setSource(null);
  }, [scrollDriver, scrollSource]);

  // ── RAF inertia loop ──────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const sensitivity = inertiaSensitivityRef.current / 1000.0;
      const decay = inertiaDecayRef.current;
      const result = computeInertiaStep(
        velocityRef.current,
        pendingWheelDeltaRef.current,
        sensitivity,
        decay,
        rawProgressRef.current,
      );

      pendingWheelDeltaRef.current = 0;
      velocityRef.current = result.velocity;

      if (result.progress !== rawProgressRef.current) {
        emitProgress(result.progress);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [emitProgress]); // sensitivity/decay read from refs per frame

  // ── Sync container scrollTop when scrollRegion changes ───────────────────
  useEffect(() => {
    const container = scrollRegion?.containerRef.current;
    if (!container || !scrollRegion) return;
    const maxScroll = Math.max(0, scrollRegion.scrollHeightPx - container.clientHeight);
    container.scrollTop = rawProgressRef.current * maxScroll;
  }, [scrollRegion]);

  // ── ActionInputController ─────────────────────────────────────────────────
  useEffect(() => {
    // Resolve target: use provided target, fall back to scrollRegion container,
    // then fall back to the engine's canvas ref.
    const targetEl = props.target ?? scrollRegion?.containerRef.current ?? engineRef.current.canvasRef.current;
    if (!targetEl) return;

    // Stable closure that reads the current tick's input spec.
    const getSpec = (): SceneInputControllerSpec | null => {
      const tick = engineRef.current.frameState.tick;
      if (!tick) return null;
      return (tick.state.widgets['__input_controller'] as SceneInputControllerSpec) ?? null;
    };

    const handler: ActionInputHandler = {
      getSceneCount: () => engineRef.current.sceneCount,

      onSceneStep: (direction, stepScenes) => {
        const count = engineRef.current.sceneCount;
        if (count <= 1) return;
        const delta = direction * (stepScenes / (count - 1));
        const newProgress = Math.max(0, Math.min(1, engineRef.current.progress + delta));
        // When a scroll source is present, route through ScrollNavigatorContext so
        // the scroll source's internal state stays in sync.
        const navigator = scrollNavigatorRef.current;
        if (navigator) {
          const rawProgress = engineRef.current.progressMapper
            ? engineRef.current.progressMapper.inverse(newProgress)
            : newProgress;
          navigator.scrollTo(rawProgress);
        } else {
          engineRef.current.advanceProgress(delta);
        }
      },

      onCameraOrbit: (cameraId, dx, dy, speed) => {
        engineRef.current.applyCameraOrbit(cameraId, dx, dy, speed);
      },

      onCameraDolly: (cameraId, delta, speed) => {
        engineRef.current.applyCameraDolly(cameraId, delta, speed);
      },

      onCameraReset: (cameraId) => {
        engineRef.current.applyCameraReset(cameraId);
      },

      onCarouselStep: (layoutId, direction, stepSlides) => {
        // 1. Read the compiled ViewLayoutState for this layout.
        const tick = engineRef.current.frameState.tick;
        if (!tick) return;

        const layoutState = tick.state.widgets[layoutId] as ViewLayoutState | undefined;
        if (!layoutState || layoutState.kind !== 'carousel') {
          console.warn(
            `[InputCoordinator] onCarouselStep: ViewLayout "${layoutId}" not found or not a carousel.`,
          );
          return;
        }
        if (!layoutState.layoutConfig || !layoutState.childSizeHints) {
          console.warn(
            `[InputCoordinator] onCarouselStep: ViewLayout "${layoutId}" missing layoutConfig or childSizeHints. ` +
            `Ensure the scene was compiled with carousel scrubbing support.`,
          );
          return;
        }

        const childCount = layoutState.viewIds.length;
        if (childCount === 0) return;

        const config = layoutState.layoutConfig as CarouselLayoutConfig;
        const loop = config.loop ?? false;

        // 2. Read current activeIndex from VariableStore (falls back to compiled value).
        const variableStore = engineRef.current.variableStore;
        const storedIndex = variableStore.get('carousel', `${layoutId}.activeIndex`);
        const currentIndex = typeof storedIndex === 'number'
          ? storedIndex
          : Math.max(0, Math.min(childCount - 1, config.activeIndex));

        // 3. Compute new index.
        const rawNext = currentIndex + direction * stepSlides;
        let newIndex: number;
        if (loop) {
          newIndex = ((rawNext % childCount) + childCount) % childCount;
        } else {
          newIndex = Math.max(0, Math.min(childCount - 1, rawNext));
        }

        // 4. No-op if index didn't change (e.g., clamped at boundary).
        if (newIndex === currentIndex) return;

        // 5. Write new index to VariableStore.
        variableStore.set('carousel', `${layoutId}.activeIndex`, newIndex);

        // 6. Recompute layout with updated activeIndex.
        const updatedConfig: ViewLayoutConfig = { ...config, activeIndex: newIndex };
        const layoutResults = resolveLayout(
          updatedConfig,
          layoutState.bounds,
          layoutState.childSizeHints,
        );

        // 7. Build patches: ViewLayoutState override + each child ViewState override.
        const patches: Record<string, unknown> = {};

        const patchedLayoutState: ViewLayoutState = {
          ...layoutState,
          layoutConfig: updatedConfig,
        };
        patches[layoutId] = patchedLayoutState;

        for (let i = 0; i < layoutState.viewIds.length; i++) {
          const viewId = layoutState.viewIds[i]!;
          const result = layoutResults[i];
          if (!result) continue;

          const existingViewState = tick.state.widgets[viewId] as ViewState | undefined;
          if (!existingViewState) continue;

          // Recompute contentBounds from new bounds + existing padding.
          const [pt, pr, pb, pl] = existingViewState.padding;
          const newContentBounds = {
            x: result.bounds.x + pl * result.bounds.w,
            y: result.bounds.y + pt * result.bounds.h,
            w: result.bounds.w * (1 - pl - pr),
            h: result.bounds.h * (1 - pt - pb),
          };

          const patchedViewState: ViewState = {
            ...existingViewState,
            bounds: result.bounds,
            contentBounds: newContentBounds,
            layer: result.layer,
            scale: result.scale,
            z: result.z,
            opacity: result.opacity,
          };
          patches[viewId] = patchedViewState;
        }

        // 8. Apply patches.
        engineRef.current.patchWidgetStates(patches);
      },

      onUnknownAction: pluginExtension ?? undefined,
    };

    // Keyboard defaults to document for broadest compatibility.
    const keyboardTarget = props.keyboardTarget ?? document;

    // onUnclaimedWheel connects waterfall step 4 to the inertia accumulator.
    // Only wire it when we have a scroll driver (i.e., inside a ScrollStage).
    const onUnclaimedWheel = scrollDriver
      ? (e: WheelEvent) => {
          pendingWheelDeltaRef.current += e.deltaY;
          e.preventDefault();
        }
      : undefined;

    const controller = new ActionInputController(
      targetEl,
      getSpec,
      handler,
      keyboardTarget,
      {
        idDefaults: {
          cameraId: engineRef.current.primaryCameraId,
          canvasId: engineRef.current.primaryCanvasActionTargetId,
        },
        onUnclaimedWheel,
      },
    );
    controller.attach();

    // When inside a ScrollStage, add a capture-phase keydown guard on the container
    // so arrow keys don't trigger native scroll before our document-level handler runs.
    const scrollContainer = scrollRegion?.containerRef.current ?? null;
    const removeScrollGuard = scrollContainer && !props.keyboardTarget
      ? (() => {
          const guard = (e: KeyboardEvent) => {
            const spec = getSpec();
            if (!spec) return;
            for (const action of spec.actions) {
              for (const map of action.maps) {
                if (map.kind === 'key' && map.key === e.key) {
                  e.preventDefault();
                  return;
                }
              }
            }
          };
          scrollContainer.addEventListener('keydown', guard, { capture: true });
          return () => scrollContainer.removeEventListener('keydown', guard, { capture: true });
        })()
      : null;

    return () => {
      controller.detach();
      removeScrollGuard?.();
    };
  }, [props.target, props.keyboardTarget, pluginExtension, scrollRegion, scrollDriver]); // engine intentionally NOT in deps — use engineRef instead

  // ── Clear widget state patches when the scene track changes ───────────────
  const sceneTrack = engine.sceneTrack;
  const sceneTrackInitializedRef = useRef(false);
  useEffect(() => {
    if (!sceneTrackInitializedRef.current) {
      sceneTrackInitializedRef.current = true;
      return;
    }
    engineRef.current.patchWidgetStates({});
  }, [sceneTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── pauseWhenHidden ────────────────────────────────────────────────────────
  // Observe the scroll container (or canvas as fallback) for visibility gating.
  const pauseContainerRef = useRef<HTMLElement | null>(null);
  pauseContainerRef.current = scrollRegion?.containerRef.current ?? engine.canvasRef.current;

  const onPauseChange = useCallback((_paused: boolean): void => {
    // pause behavior is advisory — engine does not currently expose setPaused().
    // This hook remains for future integration.
  }, []);

  usePauseWhenHidden(
    pauseContainerRef as React.RefObject<HTMLElement | null>,
    props.pauseWhenHidden,
    onPauseChange,
  );

  return null; // No DOM output — pure side-effect component.
}
