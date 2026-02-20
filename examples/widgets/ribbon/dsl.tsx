import type { ReactNode } from 'react';
import type { RibbonConfig } from './types';

export type RibbonProps = {
  enabled?: boolean;
  config?: RibbonConfig | ((context: unknown) => RibbonConfig);
  children?: ReactNode;
};

export const Ribbon = (_props: RibbonProps) => null;
