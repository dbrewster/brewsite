// ScrollRegionContext.tsx — Provided by ScrollStage, consumed by ScrollInput native-scroll modes.

import { createContext } from 'react';
import type { RefObject } from 'react';

/** Provided by ScrollStage so ScrollInput can compute progress from the stage container. */
export type ScrollRegionContextValue = {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly scrollHeightPx: number;
};

export const ScrollRegionContext = createContext<ScrollRegionContextValue | null>(null);
