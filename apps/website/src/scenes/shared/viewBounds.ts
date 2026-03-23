// View bounds helpers for defining standard NVS bounding regions in website scenes.

import type { SceneLength } from '@brewsite/core/units/types';

/**
 * An NVS bounding region defined with SceneLength values.
 * Used in DSL scene code to position elements within standard viewport regions.
 */
export type ViewBoundsRegion = {
  readonly x: SceneLength;
  readonly y: SceneLength;
  readonly w: SceneLength;
  readonly h: SceneLength;
};

/** Full viewport region. */
export const fullViewport: ViewBoundsRegion = {
  x: '0%' satisfies SceneLength,
  y: '0%' satisfies SceneLength,
  w: '100%' satisfies SceneLength,
  h: '100%' satisfies SceneLength,
};

/** Standard content-safe region with insets. */
export const contentRegion: ViewBoundsRegion = {
  x: '5%' satisfies SceneLength,
  y: '5%' satisfies SceneLength,
  w: '90%' satisfies SceneLength,
  h: '90%' satisfies SceneLength,
};

/** Upper portion of the viewport for hero-style layouts. */
export const upperRegion: ViewBoundsRegion = {
  x: '5%' satisfies SceneLength,
  y: '5%' satisfies SceneLength,
  w: '90%' satisfies SceneLength,
  h: '45%' satisfies SceneLength,
};

/** Lower portion of the viewport for bottom-anchored content. */
export const lowerRegion: ViewBoundsRegion = {
  x: '5%' satisfies SceneLength,
  y: '50%' satisfies SceneLength,
  w: '90%' satisfies SceneLength,
  h: '45%' satisfies SceneLength,
};

/** Center-focused region for diagrams and focal content. */
export const focalRegion: ViewBoundsRegion = {
  x: '10%' satisfies SceneLength,
  y: '10%' satisfies SceneLength,
  w: '80%' satisfies SceneLength,
  h: '80%' satisfies SceneLength,
};
