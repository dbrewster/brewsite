// DSL prop types for the MediaScreen element. No React component function here.
import type { SceneLength, SceneAngle } from '@brewsite/core';
import type { MediaScreenBezelVariant } from './types';

/** Props for the <MediaScreen> DSL component. */
export interface MediaScreenProps {
  id: string;
  /**
   * Video file URL (mp4, webm). Mutually exclusive with `streamId`.
   * @example src="/videos/demo.mp4"
   */
  src?: string;
  /**
   * Registry key for a live MediaStream.
   * Register before scene renders: `MediaScreenWidget.registerStream('key', stream)`
   * Mutually exclusive with `src`.
   */
  streamId?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** NVS center X with explicit unit. Default: '50%' */
  x?: SceneLength;
  /** NVS center Y with explicit unit. Default: '50%' */
  y?: SceneLength;
  z?: number;
  /** NVS width with explicit unit. Default: '62.5%' */
  width?: SceneLength;
  /** NVS height with explicit unit. Derived from 16:9 if omitted. */
  height?: SceneLength;
  /** Rotation with explicit angle units [x, y, z]. Default: [0, 0, 0] */
  rotation?: [SceneAngle, SceneAngle, SceneAngle];
  scale?: number;
  bezel?: MediaScreenBezelVariant;
  bezelThickness?: number;
  opacity?: number;
  gloss?: number;
  glossRoughness?: number;
  selfIllumination?: number;
  glow?: boolean;
  glowColor?: string;
  glowScale?: number;
  glowOpacity?: number;
  enabled?: boolean;
}
