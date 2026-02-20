/**
 * Background element DSL components.
 */

import type { Vec3 } from './types';

export type BackgroundProps = {
  imageUrl?: string;
  opacity?: number;
  position?: Vec3;
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
};

export const Background = (_props: BackgroundProps) => null;

Background.displayName = 'Background';
