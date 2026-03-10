// ScrollInput.tsx — Drives engine progress from a scroll source (inertia, window, element, or IScrollSource).

import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactElement, RefObject } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ScrollRegionContext } from './ScrollRegionContext';
import { ScrollNavigatorContext } from './ScrollNavigatorContext';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import { computeInertiaStep } from './scrollInertia';
import type { ScrollSourceProp, IScrollSource } from './scrollSourceTypes';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';
import type { SceneNavInputMap } from '../input/types';

/**
 * Props for ScrollInput.
 * Drives engine progress from a scroll source.
 */
export interface ScrollInputProps {
  /**
   * The scroll source. Default: 'inertia'.
   * - 'window': reads window.scrollY. Must be paired with ScrollStage.
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

  // ── Window/element scroll source mode ────────────────────────────────────────
  useEffect(() => {
    const isWindow = source === 'window';
    const isElement = typeof source === 'object' && 'elementRef' in source;
    if (!isWindow && !isElement) return;

    if (!scrollRegion) {
      console.error(
        '[BrewSite] <ScrollInput source="window"> must be used inside <ScrollStage>.',
      );
      return;
    }

    const computeProgress = (): number => {
      const el = scrollRegion.containerRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const scrollTop = isWindow
        ? (window.scrollY || window.pageYOffset || 0)
        : ((source as { elementRef: RefObject<HTMLElement | null> }).elementRef.current?.scrollTop ?? 0);
      const viewportHeight = isWindow ? window.innerHeight : 1;
      const regionTop = scrollTop + rect.top;
      const maxScroll = Math.max(1, scrollRegion.scrollHeightPx - viewportHeight);
      return Math.max(0, Math.min(1, (scrollTop - regionTop) / maxScroll));
    };

    const update = () => {
      if (isPausedRef.current) return;
      const raw = computeProgress();
      engine.setRawProgress(raw);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [source, scrollRegion, engine]);

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
      if (!region) return;
      const rect = region.getBoundingClientRect();
      const scrollTop = window.scrollY || 0;
      const regionTop = scrollTop + rect.top;
      const maxScroll = Math.max(1, (scrollRegion?.scrollHeightPx ?? 0) - window.innerHeight);
      window.scrollTo({ top: regionTop + rawProgress * maxScroll, behavior: 'smooth' });
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
