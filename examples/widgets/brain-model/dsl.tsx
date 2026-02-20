import type { ReactNode } from 'react';

export type BrainProps = {
  enabled?: boolean;
  opacity?: number;
  children?: ReactNode;
};

export type SubpartProps = {
  id: string;
  enabled?: boolean;
  opacity?: number;
};

export const Brain = (_props: BrainProps) => null;
export const Subpart = (_props: SubpartProps) => null;
