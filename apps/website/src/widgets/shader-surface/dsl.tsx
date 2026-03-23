// DSL component and prop interface for the shader surface widget.

import type { ReactNode } from 'react';
import type { SceneLength } from '@brewsite/core/units/types';

/** DSL props for the ShaderSurface component. Spatial fields use SceneLength. */
export type ShaderSurfaceProps = {
  enabled?: boolean;
  kind?: 'plane' | 'ribbon' | 'shell';
  x?: SceneLength;          // NVS position — use "%"
  y?: SceneLength;          // NVS position — use "%"
  w?: SceneLength;          // NVS extent — use "%"
  h?: SceneLength;          // NVS extent — use "%"
  z?: number;               // world-space depth — stays number
  opacity?: number;         // dimensionless [0..1]
  palette?: 'hero' | 'violet' | 'warm' | 'aurora';
  edgeGlow?: number;        // dimensionless
  distortion?: number;      // dimensionless
  scanStrength?: number;    // dimensionless
  reveal?: number;          // dimensionless [0..1]
  children?: ReactNode;
};

/** DSL component for the shader surface element. Returns null — compilation only. */
export const ShaderSurface = (_props: ShaderSurfaceProps) => null;
