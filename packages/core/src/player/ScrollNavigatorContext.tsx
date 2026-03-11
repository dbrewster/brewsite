// ScrollNavigatorContext.tsx — Provided by ScrollStage or legacy ScrollInput, consumed by useGoToScene.

import { createContext } from 'react';

/**
 * Provided by ScrollStage's active scroll driver or legacy ScrollInput adapters.
 * Consumed by useGoToScene() to perform scroll-position sync on programmatic navigation.
 */
export type ScrollNavigatorContextValue = {
  readonly scrollTo: (rawProgress: number) => void;
};

export const ScrollNavigatorContext = createContext<ScrollNavigatorContextValue | null>(null);
