import type { ReactNode } from 'react';
import type { SceneLength, SceneAngle } from '@brewsite/core/units/types';

export type NeonSignProps = {
  enabled?: boolean;
  text?: string;
  fontUrl?: string;
  color?: string;
  emissiveColor?: string;
  intensity?: number;
  opacity?: number;
  x?: SceneLength;
  y?: SceneLength;
  w?: SceneLength;
  h?: SceneLength;
  z?: number;
  tilt?: SceneAngle;
  yRotation?: SceneAngle;
  children?: ReactNode;
};

export const NeonSign = (_props: NeonSignProps) => null;
