// ScrollNavigatorContext.tsx — Provided by ScrollInput source='window', consumed by useGoToScene.

import { createContext } from 'react';

/**
 * Provided by ScrollInput when source='window' or source={elementRef}.
 * Consumed by useGoToScene() to perform scroll-position sync on programmatic navigation.
 */
export type ScrollNavigatorContextValue = {
  readonly scrollTo: (rawProgress: number) => void;
};

export const ScrollNavigatorContext = createContext<ScrollNavigatorContextValue | null>(null);
