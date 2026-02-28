import { useEffect, useMemo, useState } from 'react';
import type { DiagramFocusRegionState } from './focusRegion';
import { DIAGRAM_FOCUS_REGION_EVENT, getDiagramFocusRegion } from './focusRegion';

export interface UseDiagramFocusRegionOptions {
  readonly canvasId?: string;
}

const selectFocus = (
  focus: DiagramFocusRegionState | null,
  options: UseDiagramFocusRegionOptions | undefined,
): DiagramFocusRegionState | null => {
  if (!focus) return null;
  if (!options?.canvasId) return focus;
  return focus.canvasId === options.canvasId ? focus : null;
};

export const useDiagramFocusRegion = (
  options?: UseDiagramFocusRegionOptions,
): DiagramFocusRegionState | null => {
  const optionsKey = options?.canvasId ?? '';
  const stableOptions = useMemo(() => options, [optionsKey]);
  const [focusRegion, setFocusRegion] = useState<DiagramFocusRegionState | null>(
    () => selectFocus(getDiagramFocusRegion(), stableOptions),
  );

  useEffect(() => {
    setFocusRegion(selectFocus(getDiagramFocusRegion(), stableOptions));
    if (typeof window === 'undefined') return;

    const onFocusRegion = (event: Event): void => {
      const custom = event as CustomEvent<DiagramFocusRegionState | null>;
      setFocusRegion(selectFocus(custom.detail ?? null, stableOptions));
    };

    window.addEventListener(DIAGRAM_FOCUS_REGION_EVENT, onFocusRegion as EventListener);
    return () => window.removeEventListener(DIAGRAM_FOCUS_REGION_EVENT, onFocusRegion as EventListener);
  }, [stableOptions]);

  return focusRegion;
};
