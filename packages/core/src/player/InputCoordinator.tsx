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
import type { ActionInputHandler } from '../input/types';
import type { SceneInputControllerSpec } from '../input/types';
import { PRIMARY_CAROUSEL_SENTINEL } from '../input/defaultInputSpec';
import { resolveInputTargets } from '../input/scopeResolver';
import { resolveLayout } from '../layout/regionLayout';
import type { ViewLayoutState, ViewState } from '../compiler/viewTypes';
import type { CarouselLayoutConfig, ViewLayoutConfig } from '../layout/regionTypes';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';
import type { IScrollSource } from './scrollSourceTypes';
import { clamp01 } from '../math';
import {
  createInertiaState,
  feedDelta,
  tickClamped,
  tickUnclamped,
  type InertiaAccumulatorState,
  type InertiaAccumulatorConfig,
} from '../input/inertiaAccumulator';
import {
  createAxisArbiterState,
  arbiterFeed,
  arbiterIdleCheck,
  DEFAULT_AXIS_ARBITER_CONFIG,
  type AxisArbiterState,
  type AxisArbiterConfig,
} from '../input/axisArbiter';
import { computeCarouselStep } from '../input/carouselStepper';

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

/** Threshold in carousel fractional steps before firing onCarouselStep. */
const X_INERTIA_CAROUSEL_THRESHOLD = 0.8;

/** X-axis inertia config: sensitivity (pixels to fractional steps) and decay. */
const X_INERTIA_CONFIG: InertiaAccumulatorConfig = {
  sensitivity: 0.002,
  decay: 0.68,
};

/** Axis arbiter config: uses defaults (6px cumulative threshold, 200ms idle reset). */
const ARBITER_CONFIG: AxisArbiterConfig = DEFAULT_AXIS_ARBITER_CONFIG;

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

  // ── Inertia state (Y-axis: scroll navigation) ──────────────────────────────
  const yInertiaRef = useRef<InertiaAccumulatorState>(createInertiaState());
  const subscribersRef = useRef(new Set<(rawProgress: number) => void>());
  const rafRef = useRef<number>(0);

  // ── Inertia state (X-axis: carousel navigation) ────────────────────────────
  const xInertiaRef = useRef<InertiaAccumulatorState>(createInertiaState());

  // ── Axis arbitration state ─────────────────────────────────────────────────
  const arbiterRef = useRef<AxisArbiterState>(createAxisArbiterState());

  /**
   * Carousel step callback set by the ActionInputController effect.
   * Used by the X-inertia RAF loop to fire carousel steps without duplicating
   * the full carousel logic. Signature matches handleCarouselStep: (layoutId, direction, stepSlides).
   */
  const carouselStepFnRef = useRef<((layoutId: string, direction: 1 | -1, stepSlides: number) => void) | null>(null);

  // ── Refs for per-frame prop reads (avoids RAF loop re-registration) ────────
  const inertiaSensitivityRef = useRef(props.inertiaSensitivity ?? 0.01);
  inertiaSensitivityRef.current = props.inertiaSensitivity ?? 0.01;
  const inertiaDecayRef = useRef(props.inertiaDecay ?? 0.85);
  inertiaDecayRef.current = props.inertiaDecay ?? 0.85;

  // ── emitProgress helper ────────────────────────────────────────────────────
  const emitProgress = useCallback((rawProgress: number): void => {
    yInertiaRef.current.progress = clamp01(rawProgress);
    // Also sync the ScrollStage container's scrollTop so the native scroll
    // position reflects the programmatic position (needed for snapshots).
    const container = scrollRegion?.containerRef.current;
    if (container && scrollRegion) {
      const maxScroll = Math.max(0, scrollRegion.scrollHeightPx - container.clientHeight);
      container.scrollTop = yInertiaRef.current.progress * maxScroll;
    }
    subscribersRef.current.forEach((cb) => cb(yInertiaRef.current.progress));
  }, [scrollRegion]);

  // ── IScrollSource (registered only when inside ScrollStage) ──────────────
  const scrollSource = useMemo<IScrollSource>(() => ({
    subscribe(onProgress: (rawProgress: number) => void): () => void {
      subscribersRef.current.add(onProgress);
      onProgress(yInertiaRef.current.progress);
      return () => subscribersRef.current.delete(onProgress);
    },
    scrollTo(rawProgress: number): void {
      // Reset momentum so stale velocity doesn't fight the new position.
      yInertiaRef.current.velocity = 0;
      yInertiaRef.current.pendingDelta = 0;
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
      // ── Y-axis inertia (scroll navigation) ──
      const yConfig: InertiaAccumulatorConfig = {
        sensitivity: inertiaSensitivityRef.current,
        decay: inertiaDecayRef.current,
      };
      const yChanged = tickClamped(yInertiaRef.current, yConfig);

      if (yChanged) {
        emitProgress(yInertiaRef.current.progress);
      }

      // ── X-axis inertia (carousel navigation) ──
      const xState = xInertiaRef.current;
      if (xState.pendingDelta !== 0 || Math.abs(xState.velocity) > 0.001) {
        tickUnclamped(xState, X_INERTIA_CONFIG);

        if (carouselStepFnRef.current) {
          // Check if accumulator has crossed the threshold in either direction.
          const acc = xState.progress;
          if (acc >= X_INERTIA_CAROUSEL_THRESHOLD) {
            const steps = Math.floor(acc / X_INERTIA_CAROUSEL_THRESHOLD);
            xState.progress -= steps * X_INERTIA_CAROUSEL_THRESHOLD;
            carouselStepFnRef.current(PRIMARY_CAROUSEL_SENTINEL, 1, steps);
          } else if (acc <= -X_INERTIA_CAROUSEL_THRESHOLD) {
            const steps = Math.floor(-acc / X_INERTIA_CAROUSEL_THRESHOLD);
            xState.progress += steps * X_INERTIA_CAROUSEL_THRESHOLD;
            carouselStepFnRef.current(PRIMARY_CAROUSEL_SENTINEL, -1, steps);
          }
        }
      }

      // ── Axis lock reset after idle ──
      arbiterIdleCheck(arbiterRef.current, performance.now(), ARBITER_CONFIG);

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
    container.scrollTop = yInertiaRef.current.progress * maxScroll;
  }, [scrollRegion]);

  // ── ActionInputController ─────────────────────────────────────────────────
  useEffect(() => {
    // Resolve targets via scope resolution.
    // Explicit props override scope resolution for backward compatibility.
    // Limitation: scope is read once at effect creation time. If the spec's scope
    // changes between scenes, the controller does not reattach. This is acceptable
    // because scope changes between scenes are rare; a future iteration can add
    // scope-change detection.
    const canvasEl = engineRef.current.canvasRef.current;
    const scrollContainerEl = scrollRegion?.containerRef.current ?? null;

    let targetEl: HTMLElement | Window | null;
    let resolvedKeyboardTarget: HTMLElement | Document | Window | null;

    if (props.target || props.keyboardTarget) {
      // Explicit props take precedence over scope resolution.
      targetEl = props.target ?? scrollContainerEl ?? canvasEl;
      resolvedKeyboardTarget = props.keyboardTarget ?? document;
    } else {
      // Read scope from the current spec (or default to 'canvas').
      const initialSpec = (() => {
        const tick = engineRef.current.frameState.tick;
        if (!tick) return null;
        return (tick.state.widgets['__input_controller'] as SceneInputControllerSpec) ?? null;
      })();
      const currentScope = initialSpec?.scope ?? 'canvas';
      const resolved = resolveInputTargets(currentScope, scrollContainerEl ?? canvasEl, scrollContainerEl);
      targetEl = resolved.pointerTarget;
      resolvedKeyboardTarget = resolved.keyboardTarget;
    }

    if (!targetEl) return;

    // Stable closure that reads the current tick's input spec.
    const getSpec = (): SceneInputControllerSpec | null => {
      const tick = engineRef.current.frameState.tick;
      if (!tick) return null;
      return (tick.state.widgets['__input_controller'] as SceneInputControllerSpec) ?? null;
    };

    // Helper: resolve '__primary_carousel__' sentinel to the current scene's primaryCarouselId.
    const resolvePrimaryCarouselId = (): string | null => {
      const tick = engineRef.current.frameState.tick;
      if (!tick) return null;
      const primaryId = (tick.state as { primaryCarouselId?: string }).primaryCarouselId;
      return primaryId ?? null;
    };

    // Shared carousel step logic — used by both handler.onCarouselStep and X-inertia RAF loop.
    const handleCarouselStep = (layoutId: string, direction: 1 | -1, stepSlides: number): void => {
      if (DEBUG_SCROLL) console.log(`[IC:carouselStep] ENTER layoutId="${layoutId}" direction=${direction} steps=${stepSlides}`);
      // Resolve sentinel layoutId.
      const resolvedLayoutId = layoutId === PRIMARY_CAROUSEL_SENTINEL
        ? resolvePrimaryCarouselId()
        : layoutId;
      if (!resolvedLayoutId) {
        console.warn(`[IC:carouselStep] ❌ sentinel resolution failed — no primaryCarouselId on current scene. layoutId="${layoutId}"`);
        return;
      }
      if (DEBUG_SCROLL) console.log(`[IC:carouselStep] resolved layoutId="${resolvedLayoutId}"`);

      // 1. Read the compiled ViewLayoutState for this layout.
      const tick = engineRef.current.frameState.tick;
      if (!tick) {
        console.warn('[IC:carouselStep] ❌ no tick!');
        return;
      }

      const layoutState = tick.state.widgets[resolvedLayoutId] as ViewLayoutState | undefined;
      if (!layoutState || layoutState.kind !== 'carousel') {
        console.warn(
          `[IC:carouselStep] ViewLayout "${resolvedLayoutId}" not found or not a carousel. ` +
          `Available widgets: ${Object.keys(tick.state.widgets).join(', ')}`,
        );
        return;
      }
      if (!layoutState.layoutConfig || !layoutState.childSizeHints) {
        console.warn(
          `[IC:carouselStep] ViewLayout "${resolvedLayoutId}" missing layoutConfig or childSizeHints. ` +
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
      const storedIndex = variableStore.get('carousel', `${resolvedLayoutId}.activeIndex`);
      const currentIndex = typeof storedIndex === 'number'
        ? storedIndex
        : Math.max(0, Math.min(childCount - 1, config.activeIndex));

      // 3. Compute new index using the extracted pure function.
      const newIndex = computeCarouselStep({
        currentIndex,
        direction,
        step: stepSlides,
        childCount,
        loop,
      });

      // 4. No-op if index didn't change (clamped at boundary or empty).
      if (newIndex === null) {
        if (DEBUG_SCROLL) console.log(`[IC:carouselStep] no-op: clamped at ${currentIndex}. loop=${loop} childCount=${childCount}`);
        return;
      }

      if (DEBUG_SCROLL) console.log(`[IC:carouselStep] ✅ ${currentIndex} → ${newIndex} (${childCount} children, loop=${loop})`);

      // 5. Write new index and child count to VariableStore.
      variableStore.set('carousel', `${resolvedLayoutId}.activeIndex`, newIndex);
      variableStore.set('carousel', `${resolvedLayoutId}.childCount`, childCount);

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
      patches[resolvedLayoutId] = patchedLayoutState;

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

      // 7b. Patch the CarouselScrubber tray (if one exists for this layout).
      // The tray widget ID follows the convention established by viewLayoutHandler.
      const trayWidgetId = `${resolvedLayoutId}__tray`;
      const existingTrayState = tick.state.widgets[trayWidgetId] as
        | { activeIndex: number; [key: string]: unknown }
        | undefined;
      if (existingTrayState && typeof existingTrayState.activeIndex === 'number') {
        patches[trayWidgetId] = { ...existingTrayState, activeIndex: newIndex };
      }

      // 8. Apply patches.
      if (DEBUG_SCROLL) {
        console.log(`[IC:carouselStep] patching ${Object.keys(patches).length} widgets:`, Object.keys(patches));
      }
      engineRef.current.patchWidgetStates(patches);
    };

    // Expose handleCarouselStep to the X-inertia RAF loop via ref.
    carouselStepFnRef.current = handleCarouselStep;

    const handler: ActionInputHandler = {
      getSceneCount: () => engineRef.current.sceneCount,

      onSceneStep: (direction, stepScenes) => {
        const count = engineRef.current.sceneCount;
        if (count <= 1) return;
        const delta = direction * (stepScenes / (count - 1));
        const newProgress = Math.max(0, Math.min(1, engineRef.current.progress + delta));
        // When a scroll source is present, route through ScrollNavigatorContext so
        // the scroll source's internal state stays in sync — no transition animation.
        const navigator = scrollNavigatorRef.current;
        if (navigator) {
          const rawProgress = engineRef.current.progressMapper
            ? engineRef.current.progressMapper.inverse(newProgress)
            : newProgress;
          navigator.scrollTo(rawProgress);
        } else {
          // Keyboard/button navigation: use transition animation when available.
          const eng = engineRef.current;
          if ('beginTransition' in eng && typeof eng.beginTransition === 'function') {
            eng.beginTransition(newProgress);
          } else {
            eng.advanceProgress(delta);
          }
        }
      },

      onCameraOrbit: (cameraId, dx, dy, speed) => {
        engineRef.current.applyCameraOrbit(cameraId, dx, dy, speed);
      },

      onCameraZoom: (cameraId, delta, speed) => {
        engineRef.current.applyCameraZoom(cameraId, delta, speed);
      },

      onCameraPan: (cameraId, dx, dy, speed) => {
        engineRef.current.applyCameraPan(cameraId, dx, dy, speed);
      },

      onCameraReset: (cameraId) => {
        engineRef.current.applyCameraReset(cameraId);
      },

      onCarouselStep: (layoutId, direction, stepSlides) => {
        handleCarouselStep(layoutId, direction, stepSlides);
      },

      onUnknownAction: pluginExtension ?? undefined,
    };

    // Cleanup: unregister carousel step callback when effect tears down.
    const cleanupCarouselFn = () => { carouselStepFnRef.current = null; };

    // Use resolved keyboard target (scope-aware or from explicit prop).
    const keyboardTarget = resolvedKeyboardTarget ?? document;

    // onUnclaimedWheel connects waterfall step 4 to the inertia accumulators.
    // Implements sticky axis arbitration via the extracted axisArbiter module.
    // Only wire it when we have a scroll driver (i.e., inside a ScrollStage).
    const DEBUG_SCROLL = false; // Set true to debug scroll/carousel pipeline
    const onUnclaimedWheel = scrollDriver
      ? (e: WheelEvent) => {
          const now = performance.now();
          const absDx = Math.abs(e.deltaX);
          const absDy = Math.abs(e.deltaY);

          // Feed into axis arbiter to determine or update axis lock.
          const lock = arbiterFeed(arbiterRef.current, absDx, absDy, now, ARBITER_CONFIG);

          if (DEBUG_SCROLL) {
            console.log(`[IC:unclaimed] dX=${e.deltaX.toFixed(1)} dY=${e.deltaY.toFixed(1)} lock=${lock} accDx=${arbiterRef.current.accumulatedDx.toFixed(1)} accDy=${arbiterRef.current.accumulatedDy.toFixed(1)} xVel=${xInertiaRef.current.velocity.toFixed(4)} xProg=${xInertiaRef.current.progress.toFixed(3)}`);
          }

          if (lock === 'x') {
            // Horizontal: accumulate for X-inertia (carousel).
            feedDelta(xInertiaRef.current, e.deltaX);
            if (DEBUG_SCROLL) {
              console.log(`[IC:unclaimed] → fed X delta ${e.deltaX.toFixed(1)}, pending=${xInertiaRef.current.pendingDelta.toFixed(1)}`);
            }
          } else if (lock === 'y' || lock === 'none') {
            // Vertical (or undecided): accumulate for Y-inertia (scroll).
            // If transition is active, interrupt it on user scroll.
            if ((engineRef.current as { interruptTransition?: () => void }).interruptTransition) {
              (engineRef.current as { interruptTransition: () => void }).interruptTransition();
            }
            feedDelta(yInertiaRef.current, e.deltaY);
          }

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

    // ── Touch scroll handling (iOS / mobile) ────────────────────────────────
    // On touch devices, wheel events never fire. Single-finger touch feeds the
    // same inertia accumulators that onUnclaimedWheel uses on desktop.
    // Multi-finger gestures are left to AIC for pinch handling.
    // Only wired when a scroll driver is present (inside a ScrollStage).
    let touchCleanup: (() => void) | null = null;
    // Touch events only apply to HTMLElement targets (not Window).
    const touchTarget = targetEl instanceof HTMLElement ? targetEl : null;
    if (scrollDriver && touchTarget) {
      /** Scale factor for touch deltas. Touch produces smaller per-event deltas
       *  than wheel (continuous vs bursty), so we scale up to match feel. */
      const TOUCH_SENSITIVITY_SCALE = 3.5;
      /** Minimum px of movement before committing to an axis. */
      const TOUCH_AXIS_LOCK_THRESHOLD = 8;

      let activeTouchId: number | null = null;
      let touchPrevX = 0;
      let touchPrevY = 0;
      let touchAxisLock: 'none' | 'x' | 'y' = 'none';

      /** Check if the touch target is inside a natively-scrollable overlay element. */
      const isTouchOverScrollable = (e: TouchEvent): boolean => {
        const container = touchTarget;
        let el = e.target as HTMLElement | null;
        while (el && el !== container) {
          if (el.scrollHeight > el.clientHeight) {
            const style = getComputedStyle(el);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') return true;
          }
          if (el.scrollWidth > el.clientWidth) {
            const style = getComputedStyle(el);
            if (style.overflowX === 'auto' || style.overflowX === 'scroll') return true;
          }
          el = el.parentElement;
        }
        return false;
      };

      const onTouchStart = (e: TouchEvent): void => {
        // Only handle single-finger; multi-finger is pinch (AIC handles it).
        if (e.touches.length !== 1 || isTouchOverScrollable(e)) {
          activeTouchId = null;
          return;
        }
        const t = e.touches[0]!;
        activeTouchId = t.identifier;
        touchPrevX = t.clientX;
        touchPrevY = t.clientY;
        touchAxisLock = 'none';
      };

      const onTouchMove = (e: TouchEvent): void => {
        if (activeTouchId === null) return;
        // If a second finger appeared, stop scrolling (pinch takes over).
        if (e.touches.length !== 1) {
          activeTouchId = null;
          return;
        }
        const t = Array.from(e.touches).find((touch) => touch.identifier === activeTouchId);
        if (!t) return;

        const dx = t.clientX - touchPrevX;
        const dy = t.clientY - touchPrevY;
        touchPrevX = t.clientX;
        touchPrevY = t.clientY;

        // Axis lock — commit once movement exceeds threshold.
        if (touchAxisLock === 'none') {
          if (Math.abs(dx) >= TOUCH_AXIS_LOCK_THRESHOLD || Math.abs(dy) >= TOUCH_AXIS_LOCK_THRESHOLD) {
            touchAxisLock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
          }
        }

        // Prevent native scroll / rubber-band as soon as a touch is tracked.
        // InputCoordinator IS the scroll source — native scroll is disabled.
        e.preventDefault();

        if (touchAxisLock === 'x') {
          // Horizontal: carousel. Finger-left = positive deltaX for carousel.next.
          feedDelta(xInertiaRef.current, -dx * TOUCH_SENSITIVITY_SCALE);
        } else if (touchAxisLock === 'y') {
          // Vertical: scene scroll. Finger-up = positive delta for scroll-down.
          // Interrupt any active programmatic transition.
          if ((engineRef.current as { interruptTransition?: () => void }).interruptTransition) {
            (engineRef.current as { interruptTransition: () => void }).interruptTransition();
          }
          feedDelta(yInertiaRef.current, -dy * TOUCH_SENSITIVITY_SCALE);
        }

        // Keep the axis-lock idle timer alive during touch.
        arbiterRef.current.lastEventTimestamp = performance.now();
      };

      const onTouchEnd = (e: TouchEvent): void => {
        if (e.touches.length === 0) {
          activeTouchId = null;
          touchAxisLock = 'none';
        }
      };

      touchTarget.addEventListener('touchstart', onTouchStart, { passive: true });
      touchTarget.addEventListener('touchmove', onTouchMove, { passive: false });
      touchTarget.addEventListener('touchend', onTouchEnd, { passive: true });
      touchTarget.addEventListener('touchcancel', onTouchEnd, { passive: true });

      touchCleanup = () => {
        touchTarget.removeEventListener('touchstart', onTouchStart);
        touchTarget.removeEventListener('touchmove', onTouchMove);
        touchTarget.removeEventListener('touchend', onTouchEnd);
        touchTarget.removeEventListener('touchcancel', onTouchEnd);
      };
    }

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
      touchCleanup?.();
      removeScrollGuard?.();
      cleanupCarouselFn();
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
