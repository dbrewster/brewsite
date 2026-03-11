// ScrollInput.tsx — Drives engine progress from a scroll source (inertia, window, element, or IScrollSource).

import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactElement, RefObject } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ScrollRegionContext } from './ScrollRegionContext';
import { ScrollNavigatorContext } from './ScrollNavigatorContext';
import { ScrollDriverContext } from './ScrollDriverContext';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import { computeInertiaStep } from './scrollInertia';
import type { ScrollSourceProp, IScrollSource } from './scrollSourceTypes';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';
import type { SceneNavInputMap } from '../input/types';

/**
 * Props for ScrollInput.
 * Drives engine progress from a scroll source.
 * Prefer ScrollStage's built-in native scroll path and child scroll-source
 * components for new code; this remains as a legacy input adapter.
 */
export interface ScrollInputProps {
  /**
   * The scroll source. Default: 'inertia'.
   * - 'window': reads native DOM scrolling. Uses the nearest ScrollStage
   *   container when present; otherwise falls back to window.scrollY.
   * - { elementRef }: reads element.scrollTop. Must be paired with ScrollStage.
   * - 'inertia': spring-decay integrator on wheel events. No ScrollStage needed.
   * - IScrollSource: custom implementation.
   */
  source?: ScrollSourceProp;

  // ── Inertia options (apply only when source='inertia') ───────────────────────

  /**
   * Spring decay factor per frame at ~60fps. Range: [0.5, 0.99].
   * Lower = faster stop. Default: 0.88 (≈400ms glide-to-stop at 60fps).
   */
  inertiaDecay?: number;

  /**
   * Wheel delta multiplier for the spring integrator.
   * Lower = less sensitive (good for high-DPI trackpads). Default: 0.0003.
   */
  inertiaSensitivity?: number;

  /** Key bindings for page-up/page-down scene step navigation. Optional. */
  inputMap?: SceneNavInputMap;

  /**
   * Pause scroll input (and zero inertia velocity) when the nearest positioned
   * ancestor falls below this IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}

/** Runtime check: is source a custom IScrollSource? */
function isIScrollSource(source: ScrollSourceProp): source is IScrollSource {
  return (
    typeof source === 'object' &&
    !('elementRef' in source) &&
    typeof (source as IScrollSource).subscribe === 'function'
  );
}

/**
 * ScrollInput drives engine progress from a scroll source.
 * Renders a zero-size anchor div in inertia mode; otherwise a context provider only.
 */
export function ScrollInput(props: ScrollInputProps): ReactElement {
  const source = props.source ?? 'inertia';
  const engine = useSceneEngineContext();
  const scrollRegion = useContext(ScrollRegionContext);
  const stageDriver = useContext(ScrollDriverContext);

  const velocityRef = useRef(0);
  const pendingWheelDeltaRef = useRef(0);
  const rawProgressRef = useRef(0);
  const isPausedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const containerDivRef = useRef<HTMLDivElement | null>(null);

  // ── Pause-when-hidden ────────────────────────────────────────────────────────
  const onPauseChange = useCallback((paused: boolean) => {
    isPausedRef.current = paused;
    if (paused) {
      velocityRef.current = 0;
      pendingWheelDeltaRef.current = 0;
    }
  }, []);

  usePauseWhenHidden(containerDivRef, props.pauseWhenHidden, onPauseChange);

  // ── Inertia mode: wheel event accumulator ────────────────────────────────────
  useEffect(() => {
    if (source !== 'inertia') return;
    const handler = (e: WheelEvent) => {
      if (isPausedRef.current) return;
      pendingWheelDeltaRef.current += e.deltaY;
    };
    window.addEventListener('wheel', handler, { passive: true });
    return () => window.removeEventListener('wheel', handler);
  }, [source]);

  // ── Inertia mode: RAF spring integrator ─────────────────────────────────────
  useEffect(() => {
    if (source !== 'inertia') return;
    const tick = () => {
      if (!isPausedRef.current) {
        const sensitivity = props.inertiaSensitivity ?? 0.0003;
        const decay = props.inertiaDecay ?? 0.88;
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
          rawProgressRef.current = result.progress;
          engine.setProgress(rawProgressRef.current);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [source, engine]); // engine is stable; props decay/sensitivity read via closure on each tick

  // ── Native DOM scroll source mode ────────────────────────────────────────────
  useEffect(() => {
    const isWindow = source === 'window';
    const isElement = typeof source === 'object' && 'elementRef' in source;
    if (!isWindow && !isElement) return;
    if (stageDriver && isWindow) return;

    const computeProgress = (): number => {
      const stageContainer = scrollRegion?.containerRef.current;
      if (stageContainer) {
        const maxScroll = Math.max(1, scrollRegion.scrollHeightPx - stageContainer.clientHeight);
        return Math.max(0, Math.min(1, stageContainer.scrollTop / maxScroll));
      }

      if (isElement) {
        const element = (source as { elementRef: RefObject<HTMLElement | null> }).elementRef.current;
        if (!element) return 0;
        const maxScroll = Math.max(1, element.scrollHeight - element.clientHeight);
        return Math.max(0, Math.min(1, element.scrollTop / maxScroll));
      }

      const root = document.scrollingElement ?? document.documentElement;
      const scrollTop = window.scrollY || window.pageYOffset || root.scrollTop || 0;
      const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(1, scrollTop / maxScroll));
    };

    const update = () => {
      if (isPausedRef.current) return;
      const raw = computeProgress();
      engine.setRawProgress(raw);
    };

    const stageContainer = scrollRegion?.containerRef.current;
    const elementSource = isElement
      ? (source as { elementRef: RefObject<HTMLElement | null> }).elementRef.current
      : null;
    const nativeTarget = stageContainer ?? elementSource ?? window;

    update();
    nativeTarget.addEventListener('scroll', update as EventListener, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      nativeTarget.removeEventListener('scroll', update as EventListener);
      window.removeEventListener('resize', update);
    };
  }, [source, scrollRegion, engine, stageDriver]);

  // ── IScrollSource custom mode ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isIScrollSource(source)) return;
    const unsubscribe = source.subscribe((rawProgress) => {
      if (!isPausedRef.current) engine.setRawProgress(rawProgress);
    });
    return unsubscribe;
  }, [source, engine]);

  // ── ScrollNavigatorContext: provided when source='window' ────────────────────
  const scrollNavigatorValue = useMemo(() => ({
    scrollTo: (rawProgress: number) => {
      const region = scrollRegion?.containerRef.current;
      if (region) {
        const maxScroll = Math.max(1, (scrollRegion?.scrollHeightPx ?? 0) - region.clientHeight);
        region.scrollTo({ top: rawProgress * maxScroll, behavior: 'smooth' });
        return;
      }
      const root = document.scrollingElement ?? document.documentElement;
      const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      window.scrollTo({ top: rawProgress * maxScroll, behavior: 'smooth' });
    },
  }), [scrollRegion]);

  const anchorDiv = (
    <div ref={containerDivRef} style={{ position: 'absolute', width: 0, height: 0 }} />
  );

  if (source === 'inertia') {
    return anchorDiv;
  }

  return (
    <ScrollNavigatorContext.Provider value={scrollNavigatorValue}>
      {anchorDiv}
    </ScrollNavigatorContext.Provider>
  );
}
