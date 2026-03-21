// Declarative DSL for the Screen element in @brewsite/screens. No Three.js. No compiler internals.
// Use <Screen> for live interactive websites rendered via CSS3DObject in 3D space.
// For static images, use <ImagePanel>.
// For video or live MediaStream, use <MediaScreen>.

import type { SceneLength, SceneAngle } from '@brewsite/core';
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
   * NVS horizontal center position with explicit unit.
   * Default: '50%' (horizontally centered).
   */
  x?: SceneLength;
  /**
   * NVS vertical center position with explicit unit.
   * Default: '50%' (vertically centered).
   */
  y?: SceneLength;
  /**
   * World-space depth (Z) of the screen center.
   * Default: 0
   */
  z?: number;
  /**
   * NVS width with explicit unit.
   * Default: '62.5%' (approximately 12/19.2 of typical viewport width).
   */
  width?: SceneLength;
  /**
   * NVS height with explicit unit.
   * Defaults to derive from width × 9/16 (16:9 aspect ratio).
   */
  height?: SceneLength;
  /**
   * Rotation with explicit angle units [x, y, z] (Euler XYZ order).
   * Full 3D rotation supported via CSS3DRenderer — suitable for carousel layouts
   * and angled perspective views. For a static image, use <ImagePanel>.
   * For a live video or MediaStream with full WebGL depth compositing, use <MediaScreen>.
   * Default: [0, 0, 0]
   */
  rotation?: [SceneAngle, SceneAngle, SceneAngle];
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
