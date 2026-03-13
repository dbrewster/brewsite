// StageScrollSources.tsx — CustomScrollSource and ElementScrollSource components.
// InertiaScrollSource has been removed; use InputCoordinator instead.

import { useContext, useEffect, useMemo, type RefObject } from 'react';
import { ScrollDriverContext } from './ScrollDriverContext';
import type { IScrollSource } from './scrollSourceTypes';
import { clamp01 } from '../math';

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

