// Contract layer for MediaScreen. No runtime, no Three.js, no React.
import type { BezelVariant } from '../_shared/bezelGeometry';

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
}

/** DSL input interface — all fields optional except id. */
export interface MediaScreenDSL {
  readonly id: string;
  readonly src?: string;
  readonly streamId?: string;
  readonly autoPlay?: boolean;
  readonly loop?: boolean;
  readonly muted?: boolean;
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly width?: number;
  readonly height?: number;
  readonly rotation?: readonly [number, number, number];
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
}
