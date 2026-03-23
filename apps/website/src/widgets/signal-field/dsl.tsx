// DSL component and prop interface for the signal field widget.

import type { ReactNode } from 'react';
import type { SceneLength } from '@brewsite/core/units/types';

/** DSL props for the SignalField component. Spatial fields use SceneLength. */
export type SignalFieldProps = {
  enabled?: boolean;
  x?: SceneLength;          // NVS position — use "%"
  y?: SceneLength;          // NVS position — use "%"
  w?: SceneLength;          // NVS extent — use "%"
  h?: SceneLength;          // NVS extent — use "%"
  z?: number;               // world-space depth — stays number
  count?: number;           // dimensionless
  opacity?: number;         // dimensionless [0..1]
  size?: SceneLength;       // particle visual size — use "u"
  speed?: number;           // dimensionless multiplier
  depth?: SceneLength;      // Z-spread extent — use "u"
  spread?: SceneLength;     // XY dispersion radius — use "u"
  flow?: 'orbit' | 'stream' | 'assemble' | 'dissolve';
  palette?: 'hero' | 'violet' | 'warm' | 'aurora';
  targetBias?: number;      // dimensionless [0..1]
  children?: ReactNode;
};

/** DSL component for the signal field particle system. Returns null — compilation only. */
export const SignalField = (_props: SignalFieldProps) => null;
