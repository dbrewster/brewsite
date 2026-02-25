// Contract layer for the Screen element. No runtime imports, no Three.js, no React.
// Screen renders a LIVE INTERACTIVE WEBSITE via a DOM <iframe> overlaid on the WebGL canvas.
// The iframe is projected to screen-space every frame to align with the WebGL bezel.
// Does NOT support significant tilt — the iframe is always a flat 2D rectangle.
// For a static image displayed in 3D, use <ImagePanel> instead.

/**
 * Bezel frame style for the Screen element.
 * Identical union to ImagePanelBezelVariant and BezelVariant in _shared/bezelGeometry.ts.
 * Typed separately here to keep screen/types.ts self-contained (no cross-element imports).
 */
export type ScreenBezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

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

  /** World-space position of the screen center [x, y, z]. Default: [0, 0, 0] */
  readonly position: readonly [number, number, number];

  /**
   * World-space rotation in radians [x, y, z].
   * IMPORTANT: The iframe is a flat 2D DOM rectangle. Rotation values above ~0.1
   * radians on any axis will cause the iframe to visibly misalign with the bezel.
   * compile.ts emits a console.warn if |rotation[i]| > 0.15 for any axis.
   * For tilted image content, use <ImagePanel> instead.
   * Default: [0, 0, 0]
   */
  readonly rotation: readonly [number, number, number];

  /** Uniform scale. Applied to the WebGL bezel and to the iframe CSS dimensions. */
  readonly scale: number;

  /**
   * Screen content width in world units.
   * The iframe CSS width is derived from this via the camera projection.
   * Default: 12
   */
  readonly width: number;

  /**
   * Screen content height in world units.
   * The iframe CSS height is derived from this via the camera projection.
   * Default: 7.5 (16:9 aspect ratio at default width of 12)
   */
  readonly height: number;

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
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly width?: number;
  readonly height?: number;
  readonly bezel?: ScreenBezelVariant;
  readonly bezelThickness?: number;
  readonly opacity?: number;
  readonly glow?: boolean;
  readonly glowColor?: string;
  readonly glowScale?: number;
  readonly glowOpacity?: number;
  readonly enabled?: boolean;
}
