// Contract layer for MediaScreen. No runtime, no Three.js, no React.
import type { BezelVariant } from '../_shared/bezelGeometry';
import type { MaterialApplication, SceneLength, SceneAngle } from '@brewsite/core';

/** Bezel variant type alias for MediaScreen. */
export type MediaScreenBezelVariant = BezelVariant;

/** How the video source is resolved — from a URL or a live MediaStream. */
export type MediaScreenSourceKind = 'video' | 'stream';

/** Fully-resolved state for a single MediaScreen widget. All fields are defined. */
export interface MediaScreenState {
  readonly id: string;
  readonly sourceKind: MediaScreenSourceKind;
  readonly src: string | undefined;
  readonly streamId: string | undefined;
  readonly autoPlay: boolean;
  readonly loop: boolean;
  readonly muted: boolean;
  readonly nvsX: number;
  readonly nvsY: number;
  readonly z: number;
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly nvsWidth: number;
  readonly nvsHeight: number | undefined;
  readonly bezel: MediaScreenBezelVariant;
  readonly bezelThickness: number;
  readonly opacity: number;
  readonly gloss: number;
  readonly glossRoughness: number;
  readonly selfIllumination: number;
  readonly glow: boolean;
  readonly glowColor: string;
  readonly glowScale: number;
  readonly glowOpacity: number;
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

/** DSL input interface — all fields optional except id. */
export interface MediaScreenDSL {
  readonly id: string;
  readonly src?: string;
  readonly streamId?: string;
  readonly autoPlay?: boolean;
  readonly loop?: boolean;
  readonly muted?: boolean;
  /** NVS center X with explicit unit. Default: '50%' */
  readonly x?: SceneLength;
  /** NVS center Y with explicit unit. Default: '50%' */
  readonly y?: SceneLength;
  readonly z?: number;
  /** NVS width with explicit unit. Default: '62.5%' */
  readonly width?: SceneLength;
  /** NVS height with explicit unit. Derived from 16:9 if omitted. */
  readonly height?: SceneLength;
  /** Rotation with explicit angle units [x, y, z]. Default: [0, 0, 0] */
  readonly rotation?: readonly [SceneAngle, SceneAngle, SceneAngle];
  readonly scale?: number;
  readonly bezel?: MediaScreenBezelVariant;
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
