/**
 * Background element DSL components.
 */

import type * as React from 'react';
import type { SceneTheme } from '../../theme/types';

/**
 * Background configuration for CSS DOM rendering.
 *
 * Fill hierarchy (first non-undefined wins):
 *   1. gradient prop (explicit gradient string)
 *   2. imageUrl prop (image URL)
 *   3. color prop (solid color)
 *   4. theme.background.fill (derived from SceneTheme)
 *
 * Effects hierarchy (explicit prop wins over theme-derived):
 *   cssFilter, overlayGradient, backdropFilter (explicit > theme.background.effects)
 *
 * CSS fallback mode:
 * - Uses `imageUrl`, `opacity`, `cssPosition`, `cssSize`, and `cssRepeat`.
 * - `cssPosition`/`cssSize`/`cssRepeat` map directly to CSS background-* values.
 */
export type BackgroundProps = {
  imageUrl?: string;
  opacity?: number;
  color?: string;
  /** CSS gradient string. Mutually exclusive with color/imageUrl (gradient takes precedence). */
  gradient?: string;
  /** CSS `background-position` for DOM fallback mode (for example `'center top'`). */
  cssPosition?: React.CSSProperties['backgroundPosition'];
  /** CSS `background-size` for DOM fallback mode (for example `'cover'` or `'100% auto'`). */
  cssSize?: React.CSSProperties['backgroundSize'];
  /** CSS `background-repeat` for DOM fallback mode (for example `'no-repeat'`). */
  cssRepeat?: React.CSSProperties['backgroundRepeat'];
  /** CSS filter applied to the background element. e.g. 'blur(4px) brightness(0.8)' */
  cssFilter?: string;
  /**
   * CSS gradient string for an overlay element above the background, below scene content.
   * @example 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)'
   */
  overlayGradient?: string;
  /** CSS backdrop-filter on the overlay element. e.g. 'blur(12px)' */
  backdropFilter?: string;
  /**
   * Optional SceneTheme to derive background fill and effects from.
   * Per-element explicit props (color, gradient, cssFilter, etc.) override
   * theme-derived values. NOT stored in compiled SceneBackground — resolved
   * at compile time by BackgroundWidget's CUSTOM_NODE_HANDLER.
   */
  theme?: SceneTheme;
};

