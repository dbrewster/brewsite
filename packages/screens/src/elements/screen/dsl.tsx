// Declarative DSL for the Screen element in @brewsite/screens. No Three.js. No compiler internals.
// Use <Screen> for live interactive websites rendered via CSS3DObject in 3D space.
// For static images, use <ImagePanel>.
// For video or live MediaStream, use <MediaScreen>.

import type { ScreenBezelVariant } from './types';

export interface ScreenProps {
  /** Unique ID. Must be stable across scenes. */
  id: string;
  /**
   * The URL to load in the iframe.
   * Must not have X-Frame-Options: DENY set on the target server.
   * Best for your own apps, localhost, or iframe-friendly sites.
   */
  src: string;
  /**
   * NVS horizontal center position [0..1]. 0 = left edge, 1 = right edge.
   * Default: 0.5 (horizontally centered).
   */
  x?: number;
  /**
   * NVS vertical center position [0..1]. 0 = top edge, 1 = bottom edge.
   * Default: 0.5 (vertically centered).
   */
  y?: number;
  /**
   * World-space depth (Z) of the screen center.
   * Default: 0
   */
  z?: number;
  /**
   * NVS width fraction [0..1] — fraction of the AR container width.
   * Default: 0.625 (approximately 12/19.2 of typical viewport width).
   */
  width?: number;
  /**
   * NVS height fraction [0..1] — fraction of the AR container height.
   * Defaults to derive from width × 9/16 (16:9 aspect ratio).
   */
  height?: number;
  /**
   * World-space rotation in radians [x, y, z] (Euler XYZ order).
   * Full 3D rotation supported via CSS3DRenderer — suitable for carousel layouts
   * and angled perspective views. For a static image, use <ImagePanel>.
   * For a live video or MediaStream with full WebGL depth compositing, use <MediaScreen>.
   * Default: [0, 0, 0]
   */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Bezel frame style. Default: 'dark' */
  bezel?: ScreenBezelVariant;
  /** Bezel thickness in world units. Default: 0.3 */
  bezelThickness?: number;
  /** Opacity for bezel, glow, and iframe div [0–1]. Default: 1 */
  opacity?: number;
  /** Whether to render a glow halo. Default: true */
  glow?: boolean;
  /** Glow color (CSS hex). Default: '#88ccff' */
  glowColor?: string;
  /** Glow size multiplier relative to screen size. Default: 1.4 */
  glowScale?: number;
  /** Glow sprite opacity [0–1]. Default: 0.35 */
  glowOpacity?: number;
  /** Whether rendered. When false, iframe is display:none. Default: true */
  enabled?: boolean;
}
