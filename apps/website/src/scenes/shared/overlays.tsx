// Shared overlay helpers for website scene DSL composition.

import type { ReactNode } from 'react';

/**
 * Standard overlay layout position within a scene.
 * Used to compose consistent overlay positioning across scenes.
 */
export type OverlayPosition = 'center' | 'bottom' | 'top';

/**
 * Props for a standard scene overlay section.
 * Consumed by scene files to wrap overlay content consistently.
 */
export type SceneOverlayProps = {
  readonly position?: OverlayPosition;
  readonly children: ReactNode;
};
