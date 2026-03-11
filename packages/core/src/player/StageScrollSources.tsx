import { useContext, useEffect, useMemo, useRef, type RefObject } from 'react';
import { computeInertiaStep } from './scrollInertia';
import { ScrollDriverContext } from './ScrollDriverContext';
import { ScrollRegionContext } from './ScrollRegionContext';
import type { IScrollSource } from './scrollSourceTypes';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

type RegisterableScrollSourceProps = {
  source: IScrollSource;
};

function useRegisterScrollSource(source: IScrollSource): void {
  const driver = useContext(ScrollDriverContext);

  useEffect(() => {
    if (!driver) {
      console.error('[BrewSite] Scroll source components must be used inside <ScrollStage>.');
      return;
    }
    driver.setSource(source);
    return () => driver.setSource(null);
  }, [driver, source]);
}

export function CustomScrollSource({ source }: RegisterableScrollSourceProps): null {
  useRegisterScrollSource(source);
  return null;
}

export interface ElementScrollSourceProps {
  elementRef: RefObject<HTMLElement | null>;
}

export function ElementScrollSource({ elementRef }: ElementScrollSourceProps): null {
  const source = useMemo<IScrollSource>(() => ({
    subscribe(onProgress: (rawProgress: number) => void): () => void {
      const element = elementRef.current;
      if (!element) return () => {};

      const emit = () => {
        const maxScroll = Math.max(1, element.scrollHeight - element.clientHeight);
        onProgress(clamp01(element.scrollTop / maxScroll));
      };

      emit();
      element.addEventListener('scroll', emit, { passive: true });
      return () => element.removeEventListener('scroll', emit);
    },
    scrollTo(rawProgress: number): void {
      const element = elementRef.current;
      if (!element) return;
      const maxScroll = Math.max(1, element.scrollHeight - element.clientHeight);
      element.scrollTo({ top: clamp01(rawProgress) * maxScroll, behavior: 'smooth' });
    },
  }), [elementRef]);

  useRegisterScrollSource(source);
  return null;
}

export interface InertiaScrollSourceProps {
  inertiaDecay?: number;
  inertiaSensitivity?: number;
}

export function InertiaScrollSource(props: InertiaScrollSourceProps): null {
  const scrollRegion = useContext(ScrollRegionContext);
  const subscribersRef = useRef(new Set<(rawProgress: number) => void>());
  const rawProgressRef = useRef(0);
  const velocityRef = useRef(0);
  const pendingWheelDeltaRef = useRef(0);
  const rafRef = useRef<number>(0);

  const syncContainer = (rawProgress: number): void => {
    const container = scrollRegion?.containerRef.current;
    if (!container) return;
    const maxScroll = Math.max(0, (scrollRegion?.scrollHeightPx ?? 0) - container.clientHeight);
    container.scrollTop = clamp01(rawProgress) * maxScroll;
  };

  const emit = (rawProgress: number): void => {
    rawProgressRef.current = clamp01(rawProgress);
    syncContainer(rawProgressRef.current);
    subscribersRef.current.forEach((listener) => listener(rawProgressRef.current));
  };

  const source = useMemo<IScrollSource>(() => ({
    subscribe(onProgress: (rawProgress: number) => void): () => void {
      subscribersRef.current.add(onProgress);
      onProgress(rawProgressRef.current);
      return () => subscribersRef.current.delete(onProgress);
    },
    scrollTo(rawProgress: number): void {
      emit(rawProgress);
    },
  // emit closes over refs only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useRegisterScrollSource(source);

  useEffect(() => {
    const container = scrollRegion?.containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      pendingWheelDeltaRef.current += event.deltaY;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [scrollRegion]);

  useEffect(() => {
    const tick = () => {
      const sensitivity = (props.inertiaSensitivity ?? 0.3) / 1000.0;
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
        emit(result.progress);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // props are scalar inputs read per effect setup
  }, [props.inertiaDecay, props.inertiaSensitivity]);

  useEffect(() => {
    syncContainer(rawProgressRef.current);
  }, [scrollRegion]);

  return null;
}
