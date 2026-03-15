import type { ReactNode } from 'react';

export type NeonSignProps = {
  enabled?: boolean;
  text?: string;
  fontUrl?: string;
  color?: string;
  emissiveColor?: string;
  intensity?: number;
  opacity?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  z?: number;
  tilt?: number;
  yRotation?: number;
  children?: ReactNode;
};

export const NeonSign = (_props: NeonSignProps) => null;
