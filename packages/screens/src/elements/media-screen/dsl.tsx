// DSL prop types for the MediaScreen element. No React component function here.
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
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
  rotation?: [number, number, number];
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
