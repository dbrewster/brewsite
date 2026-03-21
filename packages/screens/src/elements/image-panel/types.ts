// Contract layer for the ImagePanel element. No runtime imports, no Three.js, no React.
// ImagePanel renders a STATIC IMAGE as a physical 3D floating frame.
// Fully WebGL — supports tilt, lighting, and MeshPhysicalMaterial gloss.
// For a live interactive website, use <Screen> instead.

import type { BezelVariant } from '../_shared/bezelGeometry';
import type { MaterialApplication, SceneLength, SceneAngle } from '@brewsite/core';

/** Bezel frame style for ImagePanel. */
export type ImagePanelBezelVariant = BezelVariant;

/**
 * Fully resolved state for an ImagePanel element.
 * A static image texture displayed on a physical 3D plane with bezel and optional glow.
 * Produced by compileImagePanel() from ImagePanelDSL.
 */
export interface ImagePanelState {
  readonly id: string;

  /**
   * Public asset URL for the image (PNG, JPG, WebP).
   * Loaded via THREE.TextureLoader at render time.
   * Examples: '/screenshots/homepage.png', '/mockups/dashboard.jpg'
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
   * World-space depth (Z) of the panel center. Default: 0.
   * Kept as world-space because it controls the 3D depth position.
   */
  readonly z: number;

  /**
   * World-space rotation in radians [x, y, z] (Euler XYZ order).
   * Supports any rotation — this is pure WebGL.
   * A Y tilt of ~0.2 radians gives a natural perspective feel.
   */
  readonly rotation: readonly [number, number, number];

  /** Uniform scale applied to both panel and bezel. Default: 1 */
  readonly scale: number;

  /**
   * NVS width fraction [0..1] — fraction of the AR container width.
   * Converted to world-space width at render time. Default: 0.6
   */
  readonly nvsWidth: number;

  /**
   * NVS height fraction [0..1] — fraction of the AR container height.
   * If undefined, derived from nvsWidth × image aspect ratio at texture load time.
   */
  readonly nvsHeight: number | undefined;

  /** Bezel frame visual style. Default: 'dark' */
  readonly bezel: ImagePanelBezelVariant;

  /**
   * Bezel border thickness in world units.
   * Default: 0.15 ('thin'), 0.35 ('dark' | 'light' | 'chrome'), 0 ('none').
   */
  readonly bezelThickness: number;

  /** Overall panel + bezel opacity [0–1]. Default: 1 */
  readonly opacity: number;

  /**
   * Screen surface gloss [0–1].
   * Implemented as THREE.MeshPhysicalMaterial clearcoat.
   * 0 = matte, 1 = mirror-like. Recommended: 0.4–0.7 for realistic screen appearance.
   * Default: 0.5
   */
  readonly gloss: number;

  /**
   * Clearcoat roughness [0–1]. Lower = sharper reflections.
   * Default: 0.05 (near-mirror clearcoat surface).
   */
  readonly glossRoughness: number;

  /**
   * Faint emissive self-illumination to simulate a lit screen.
   * Applied as MeshPhysicalMaterial.emissiveIntensity. Default: 0.15
   * Set to 0 for a non-illuminated image (e.g., a photograph, not a screen).
   */
  readonly selfIllumination: number;

  /**
   * Whether to render a glow halo around the panel edges.
   * Implemented as a THREE.Sprite with additive blending.
   * Default: true
   */
  readonly glow: boolean;

  /** CSS hex glow color. Default: '#88ccff' (cool blue-white for screen look) */
  readonly glowColor: string;

  /**
   * Glow size multiplier relative to panel size (1.0 = panel size).
   * Default: 1.4 — glow bleeds 40% beyond the panel edges.
   */
  readonly glowScale: number;

  /** Glow sprite opacity [0–1]. Default: 0.35 */
  readonly glowOpacity: number;

  /** Whether the panel is rendered. Allows hide/show via scene transitions. Default: true */
  readonly enabled: boolean;

  /**
   * When true, all size-like fields (nvsWidth, nvsHeight) use vmin (uniform) scaling
   * at render time instead of per-axis scaling. Set by compile when DSL uses `u` units.
   * Default: false (preserves existing per-axis behavior).
   */
  readonly uniformSizing: boolean;

  /** Named material preset for the bezel (e.g. 'onyx', 'steel'). Undefined = no preset. */
  readonly bezelMaterial?: string;
  /** Application controls for the bezel material preset. */
  readonly bezelMaterialApplication?: MaterialApplication;
}

/** Raw DSL props from <ImagePanel> before compile.ts applies defaults. */
export interface ImagePanelDSL {
  readonly id: string;
  readonly src: string;
  /** NVS center X with explicit unit. Default: '50%' */
  readonly x?: SceneLength;
  /** NVS center Y with explicit unit. Default: '50%' */
  readonly y?: SceneLength;
  /** World-space depth (Z). Default: 0 */
  readonly z?: number;
  /** NVS width with explicit unit. Default: '60%' */
  readonly width?: SceneLength;
  /** NVS height with explicit unit. Derived from aspect ratio if omitted. */
  readonly height?: SceneLength;
  /** Rotation with explicit angle units [x, y, z]. Default: [0, 0, 0] */
  readonly rotation?: readonly [SceneAngle, SceneAngle, SceneAngle];
  readonly scale?: number;
  readonly bezel?: ImagePanelBezelVariant;
  readonly bezelThickness?: number;
  readonly opacity?: number;
  readonly gloss?: number;
  readonly glossRoughness?: number;
  readonly selfIllumination?: number;
  readonly glow?: boolean;
  readonly glowColor?: string;
  readonly glowScale?: number;
  readonly glowOpacity?: number;
  readonly enabled?: boolean;
  readonly bezelMaterial?: string;
  readonly bezelMaterialApplication?: MaterialApplication;
}
