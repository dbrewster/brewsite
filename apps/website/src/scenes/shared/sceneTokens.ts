// Scene design tokens for consistent spatial and visual constants across website scenes.

import type { SceneLength } from '@brewsite/core/units/types';

/** Standard content region insets from viewport edges. */
export const CONTENT_INSET_X = '5%' satisfies SceneLength;
export const CONTENT_INSET_Y = '5%' satisfies SceneLength;

/** Standard content region dimensions. */
export const CONTENT_WIDTH = '90%' satisfies SceneLength;
export const CONTENT_HEIGHT = '90%' satisfies SceneLength;

/** Standard diagram region bounds. */
export const DIAGRAM_X = '5%' satisfies SceneLength;
export const DIAGRAM_Y = '10%' satisfies SceneLength;
export const DIAGRAM_W = '90%' satisfies SceneLength;
export const DIAGRAM_H = '80%' satisfies SceneLength;

/** Standard element spacing unit. */
export const ELEMENT_GAP = '2u' satisfies SceneLength;

/** Standard element sizes. */
export const SMALL_ELEMENT_SIZE = '4u' satisfies SceneLength;
export const MEDIUM_ELEMENT_SIZE = '8u' satisfies SceneLength;
export const LARGE_ELEMENT_SIZE = '12u' satisfies SceneLength;

/** Color tokens for scene elements. */
export const SCENE_COLOR_COOL_PRIMARY = '#00d8ff';
export const SCENE_COLOR_COOL_SECONDARY = '#0088cc';
export const SCENE_COLOR_WARM_PRIMARY = '#ff9933';
export const SCENE_COLOR_WARM_SECONDARY = '#cc6600';
export const SCENE_COLOR_VIOLET = '#8b5cf6';
export const SCENE_COLOR_AURORA = '#22c55e';

/** Opacity tokens. */
export const OPACITY_FULL = 1;
export const OPACITY_SUBTLE = 0.6;
export const OPACITY_FAINT = 0.3;
export const OPACITY_HIDDEN = 0;
