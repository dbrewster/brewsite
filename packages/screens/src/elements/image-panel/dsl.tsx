// Declarative DSL for the ImagePanel element. No Three.js. No compiler internals.
// Use <ImagePanel> for static images (screenshots, mockups, photographs).
// For live interactive websites, use <Screen>.

import type { SceneLength, SceneAngle } from '@brewsite/core';
import type { ImagePanelBezelVariant } from './types';

export interface ImagePanelProps {
  /** Unique ID. Must be stable across scenes. */
  id: string;
  /** Public asset URL for the image. E.g. '/screenshots/homepage.png' */
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
   * World-space depth (Z) of the panel center.
   * Default: 0
   */
  z?: number;
  /**
   * NVS width with explicit unit.
   * Default: '60%' (60% of viewport width).
   */
  width?: SceneLength;
  /**
   * NVS height with explicit unit.
   * Computed from image aspect ratio if omitted.
   */
  height?: SceneLength;
  /**
   * Rotation with explicit angle units [x, y, z].
   * Fully supported — this is pure WebGL. Tilt freely.
   * Default: [0, 0, 0]
   */
  rotation?: [SceneAngle, SceneAngle, SceneAngle];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Bezel frame style. Default: 'dark' */
  bezel?: ImagePanelBezelVariant;
  /** Bezel thickness in world units. Default: 0.3 */
  bezelThickness?: number;
  /** Overall opacity [0–1]. Default: 1 */
  opacity?: number;
  /**
   * Surface gloss (MeshPhysicalMaterial clearcoat) [0–1].
   * Makes the image surface look like a real screen or photograph.
   * Default: 0.5
   */
  gloss?: number;
  /**
   * Clearcoat roughness [0–1]. Lower = sharper specular reflections.
   * Default: 0.05
   */
  glossRoughness?: number;
  /**
   * Faint self-illumination to simulate a lit screen [0–1].
   * Set to 0 for photographs/prints; keep at default for screen mockups.
   * Default: 0.15
   */
  selfIllumination?: number;
  /** Whether to render a glow halo. Default: true */
  glow?: boolean;
  /** Glow color (CSS hex). Default: '#88ccff' */
  glowColor?: string;
  /** Glow size multiplier relative to panel size. Default: 1.4 */
  glowScale?: number;
  /** Glow sprite opacity [0–1]. Default: 0.35 */
  glowOpacity?: number;
  /** Whether rendered. Default: true */
  enabled?: boolean;
}


