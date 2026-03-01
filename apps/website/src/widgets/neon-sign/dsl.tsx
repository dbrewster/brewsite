import type { ReactNode } from 'react';
import type { Vec3 } from './types';

export type NeonSignProps = {
  enabled?: boolean;
  text?: string;
  fontUrl?: string;
  color?: string;
  emissiveColor?: string;
  intensity?: number;
  opacity?: number;
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
  children?: ReactNode;
};

export const NeonSign = (_props: NeonSignProps) => null;
