/**
 * Background element DSL components.
 */

import type * as React from 'react';
import type { Vec3 } from './types';

/**
 * Background configuration for either 3D-plane rendering or CSS fallback.
 *
 * 3D plane mode:
 * - Uses `imageUrl`, `opacity`, and `position`.
 * - `position` is a world-space offset for the rendered Three.js background plane.
 *
 * CSS fallback mode:
 * - Uses `imageUrl`, `opacity`, `cssPosition`, `cssSize`, and `cssRepeat`.
 * - `cssPosition`/`cssSize`/`cssRepeat` map directly to CSS background-* values.
 */
export type BackgroundProps = {
  imageUrl?: string;
  opacity?: number;
  color?: string;
  /** World-space offset for the 3D background plane mode. */
  position?: Vec3;
  /** CSS `background-position` for DOM fallback mode (for example `'center top'`). */
  cssPosition?: React.CSSProperties['backgroundPosition'];
  /** CSS `background-size` for DOM fallback mode (for example `'cover'` or `'100% auto'`). */
  cssSize?: React.CSSProperties['backgroundSize'];
  /** CSS `background-repeat` for DOM fallback mode (for example `'no-repeat'`). */
  cssRepeat?: React.CSSProperties['backgroundRepeat'];
};

/**
 * Scene background element.
 *
 * Rendering mode depends on host/runtime capabilities:
 * - 3D plane mode uses world-space `position`.
 * - DOM fallback mode uses CSS background props (`cssPosition`, `cssSize`, `cssRepeat`).
 */
export const Background = (_props: BackgroundProps) => null;

Background.displayName = 'Background';
