// Declarative DSL for the Screen element. No Three.js. No compiler internals.
// Use <Screen> for live interactive websites rendered via a DOM <iframe>.
// For static images, use <ImagePanel>.

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
  /** World-space position [x, y, z]. Default: [0, 0, 0] */
  position?: [number, number, number];
  /**
   * World-space rotation in radians [x, y, z].
   * Keep near [0, 0, 0] — the iframe is a flat DOM rect and cannot tilt.
   * Values above ~0.1 rad will visibly misalign the iframe with the bezel.
   * compile.ts emits console.warn if |rotation[i]| > 0.1.
   * Default: [0, 0, 0]
   */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Screen content width in world units. Default: 12 */
  width?: number;
  /** Screen content height in world units. Default: 7.5 (16:9 at width 12) */
  height?: number;
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

/**
 * Renders a live interactive website inside a physical 3D bezel frame.
 * The website is a real <iframe> — click, scroll, and interact normally.
 * The bezel and glow are WebGL objects that track the screen position.
 * The 3D scene renders behind the screen. The iframe faces the camera.
 * For a static image, use <ImagePanel> instead.
 */
export function Screen(_props: ScreenProps): null {
  return null;
}
