// TextBox — simple React component for positioning DOM overlays in NVS coordinates.
// Renders a position:absolute div at the given NVS x/y/w/h percentages.

import { type ReactElement, type ReactNode } from 'react';
import type { SceneLength } from '../../units/types';
import { resolveToNVS } from '../../units/resolve';

export interface TextBoxProps {
  /** NVS x position. Use unit strings: "50%" = 50% from left edge. */
  x: SceneLength;
  /** NVS y position. Use unit strings: "50%" = 50% from top edge. */
  y: SceneLength;
  /** NVS width. Use unit strings: "100%" = full viewport width. */
  w: SceneLength;
  /** NVS height. Use unit strings: "100%" = full viewport height. */
  h: SceneLength;
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
}: TextBoxProps): ReactElement => {
  const nvsX = resolveToNVS(x);
  const nvsY = resolveToNVS(y);
  const nvsW = resolveToNVS(w);
  const nvsH = resolveToNVS(h);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${nvsX * 100}%`,
        top: `${nvsY * 100}%`,
        width: `${nvsW * 100}%`,
        height: `${nvsH * 100}%`,
        zIndex: layer,
        overflow,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
};

TextBox.displayName = 'TextBox';
