// Highlight — DSL child component for ViewLayout carousel highlight effects.

import type { ViewHighlightMode } from './types';
import type { HighlightVariantName } from '../../theme/types';

/**
 * Props for the `<Highlight>` DSL component.
 *
 * Place as a child of `<ViewLayout kind="carousel">` to configure per-view
 * highlight effects. Each `<Highlight>` targets either the active carousel item
 * (`active`) or a specific view by ID (`viewId`).
 *
 * A `<CarouselTray>` sibling is required for highlights to render — the tray
 * widget owns the Three.js highlight meshes. Without one, a console.warn is
 * emitted and highlights are ignored.
 *
 * All visual settings can be resolved from the theme's `highlightPalette`
 * via the `variant` prop. Explicit props override variant values.
 */
export type HighlightProps = {
  /**
   * When true, this highlight tracks the active carousel item.
   * Mutually exclusive with `viewId`.
   * Default: false.
   */
  active?: boolean;

  /**
   * Target a specific view by ID. The highlight follows this view
   * as it moves around the carousel.
   * Mutually exclusive with `active`.
   */
  viewId?: string;

  /**
   * Semantic variant name — resolves color, mode, intensity, backdrop,
   * etc. from the theme's highlightPalette.
   * Explicit props override variant values.
   *
   * @example 'primary' | 'error' | 'warning' | 'success'
   */
  variant?: HighlightVariantName;

  /**
   * Highlight mode. Default: resolved from variant, or 'glow'.
   */
  mode?: ViewHighlightMode;

  /** Highlight color. Default: resolved from variant, or accentColor. */
  color?: string;

  /** Intensity [0-1]. Default: resolved from variant, or mode default. */
  intensity?: number;

  /** Beam height in world units (holographic only). Default: 5.0. */
  beamHeight?: number;

  /** Enable smoke ring (holographic only). Default: false. */
  smoke?: boolean;

  /** Enable volumetric dust motes (holographic only). Default: false. */
  dust?: boolean;

  /** Z offset in world units. Negative = push back. Default: 0. */
  zOffset?: number;

  /** Backdrop opacity [0-1]. 0 = no backdrop. Default: from variant. */
  backdropOpacity?: number;

  /** Backdrop color. Default: from variant, or polarity default. */
  backdropColor?: string;

  /**
   * Blending mode. Auto-resolved from scene colorMode when not set.
   * 'additive' — bright glow on dark backgrounds.
   * 'normal'   — tinted overlay on light backgrounds.
   */
  blendMode?: 'additive' | 'normal';

  /**
   * Pulse oscillation period in seconds.
   * When set to a positive value, the highlight intensity breathes using a
   * cosine wave with this period. 0 or absent = no pulse.
   *
   * @example pulseSpeed={1.2}  // 1.2 second breathing cycle
   */
  pulseSpeed?: number;

  /**
   * Pulse depth [0..1].
   * Controls how far the intensity dips on the downswing of the pulse.
   * - `0` — no pulse (constant intensity, same as omitting pulseSpeed)
   * - `0.5` — intensity pulses to 50% of authored value at the trough
   * - `1` — intensity pulses all the way to 0 at the trough
   *
   * @default 0
   */
  pulseIntensity?: number;
};

/** Null-returning DSL stub. Consumed by viewLayoutHandler, not rendered directly. */
export const Highlight = (_props: HighlightProps): null => null;
Highlight.displayName = 'Highlight';
