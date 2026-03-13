// Contract layer for the Screen element in @brewsite/screens. No runtime imports, no Three.js, no React.
// Screen renders a LIVE INTERACTIVE WEBSITE via a CSS3DObject placed in 3D space.
// Full 3D rotation is supported via CSS3DRenderer.
// For a static image displayed in 3D, use <ImagePanel> instead.
// For a live video or MediaStream with full WebGL depth compositing, use <MediaScreen>.

import type { BezelVariant } from '../_shared/bezelGeometry';

/** Bezel frame style for the Screen element. */
export type ScreenBezelVariant = BezelVariant;

/**
 * Fully resolved state for a Screen element.
 * The WebGL bezel and glow are driven by this state.
 * The iframe src is driven by this state.
 * Produced by compileScreen() from ScreenDSL.
 */
export interface ScreenState {
  readonly id: string;

  /**
   * URL for the iframe src attribute.
   * Must be a URL that does not send X-Frame-Options: DENY or
   * Content-Security-Policy: frame-ancestors 'none'.
   * Best used with your own product URLs or localhost dev servers.
   */
  readonly src: string;

  /**
   * NVS horizontal center position [0..1]. 0 = left edge, 1 = right edge.
   * Converted to world-space X at render time using the active camera.
   */
  readonly nvsX: number;

  /**
   * NVS vertical center position [0..1]. 0 = top edge, 1 = bottom edge.
   * Converted to world-space Y at render time (Y-flip applied in widget layer).
   */
  readonly nvsY: number;

  /**
   * World-space depth (Z) of the screen center. Default: 0.
   * Kept as world-space because it controls the 3D depth position.
   */
  readonly z: number;

  /**
   * World-space rotation in radians [x, y, z] (Euler XYZ order).
   * Full 3D rotation supported via CSS3DRenderer — suitable for carousel layouts
   * and angled perspective views. For a static image, use <ImagePanel>.
   * For a live video or MediaStream with full WebGL depth compositing, use <MediaScreen>.
   * Default: [0, 0, 0]
   */
  readonly rotation: readonly [number, number, number];

  /** Uniform scale. Applied to the WebGL bezel and to the CSS3DObject. */
  readonly scale: number;

  /**
   * NVS width fraction [0..1] — fraction of the AR container width.
   * Converted to world-space width at render time. Default: 0.625
   */
  readonly nvsWidth: number;

  /**
   * NVS height fraction [0..1] — fraction of the AR container height.
   * Converted to world-space height at render time. Default: undefined (derive from 16:9)
   */
  readonly nvsHeight: number | undefined;

  /** Bezel frame visual style. Default: 'dark' */
  readonly bezel: ScreenBezelVariant;

  /**
   * Bezel border thickness in world units.
   * Default: 0.3
   */
  readonly bezelThickness: number;

  /**
   * Opacity for the WebGL bezel and glow [0–1].
   * Also applied as CSS opacity to the iframe div — both fade together.
   * Default: 1
   */
  readonly opacity: number;

  /**
   * Whether to render a glow halo around the bezel.
   * Same implementation as ImagePanel (shared glowSprite utility).
   * Default: true
   */
  readonly glow: boolean;

  /** CSS hex glow color. Default: '#88ccff' */
  readonly glowColor: string;

  /** Glow size multiplier relative to screen size. Default: 1.4 */
  readonly glowScale: number;

  /** Glow sprite opacity [0–1]. Default: 0.35 */
  readonly glowOpacity: number;

  /**
   * Whether the screen is active. When false:
   * - WebGL bezel and glow are hidden
   * - iframe div is display:none (src does not load)
   * Default: true
   */
  readonly enabled: boolean;
}

/** Raw DSL props from <Screen> before compile.ts applies defaults. */
export interface ScreenDSL {
  readonly id: string;
  readonly src: string;
  /** NVS center X [0..1]. Default: 0.5 */
  readonly x?: number;
  /** NVS center Y [0..1]. Default: 0.5 */
  readonly y?: number;
  /** World-space depth (Z). Default: 0 */
  readonly z?: number;
  /** NVS width fraction [0..1]. Default: 0.625 */
  readonly width?: number;
  /** NVS height fraction [0..1]. Derived from 16:9 if omitted. */
  readonly height?: number;
  /**
   * World-space rotation in radians [x, y, z] (Euler XYZ order).
   * Full 3D rotation supported via CSS3DRenderer — suitable for carousel layouts
   * and angled perspective views. For a static image, use <ImagePanel>.
   * For a live video or MediaStream with full WebGL depth compositing, use <MediaScreen>.
   * Default: [0, 0, 0]
   */
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly bezel?: ScreenBezelVariant;
  readonly bezelThickness?: number;
  readonly opacity?: number;
  readonly glow?: boolean;
  readonly glowColor?: string;
  readonly glowScale?: number;
  readonly glowOpacity?: number;
  readonly enabled?: boolean;
}
