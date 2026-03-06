// TextBox — simple React component for positioning DOM overlays in NVS coordinates.
// Renders a position:absolute div at the given NVS x/y/w/h percentages.

import { type ReactElement, type ReactNode } from 'react';

export interface TextBoxProps {
  /** NVS x position [0=left edge, 1=right edge] */
  x: number;
  /** NVS y position [0=top edge, 1=bottom edge] */
  y: number;
  /** NVS width [0..1] */
  w: number;
  /** NVS height [0..1] */
  h: number;
  /** z-index layer (default 0) */
  layer?: number;
  /** Whether content clips to box bounds (default 'hidden') */
  overflow?: 'hidden' | 'visible';
  /** Optional id for React key */
  id?: string;
  children?: ReactNode;
}

/**
 * TextBox — positions a DOM overlay at NVS coordinates within the engine container.
 * Renders as a position:absolute div. Use inside Scene overlay content.
 * Content inside is position:relative by default and lays out normally.
 */
export const TextBox = ({
  x, y, w, h,
  layer = 0,
  overflow = 'hidden',
  children,
}: TextBoxProps): ReactElement => (
  <div
    style={{
      position: 'absolute',
      left: `${x * 100}%`,
      top: `${y * 100}%`,
      width: `${w * 100}%`,
      height: `${h * 100}%`,
      zIndex: layer,
      overflow,
      boxSizing: 'border-box',
    }}
  >
    {children}
  </div>
);

TextBox.displayName = 'TextBox';
