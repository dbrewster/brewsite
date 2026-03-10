// ScrollRegionContext.tsx — Provided by ScrollStage, consumed by ScrollInput source='window'.

import { createContext } from 'react';
import type { RefObject } from 'react';

/** Provided by ScrollStage so ScrollInput source='window' can compute scroll progress. */
export type ScrollRegionContextValue = {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly scrollHeightPx: number;
};

export const ScrollRegionContext = createContext<ScrollRegionContextValue | null>(null);
