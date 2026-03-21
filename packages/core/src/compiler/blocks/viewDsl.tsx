// <View> DSL component for spatial composition.
// Null-returning component consumed by the compiler.

import type { SceneLength } from '../../units/types';

export type ViewProps = {
  /** Stable view identity. Required. */
  id: string;
  /**
   * NVS x position. Use unit strings: "0%" = left edge. Used for standalone views (no parent ViewLayout).
   * Ignored when inside a ViewLayout.
   */
  x?: SceneLength;
  /**
   * NVS y position. Use unit strings: "0%" = top edge. Used for standalone views (no parent ViewLayout).
   * Ignored when inside a ViewLayout.
   */
  y?: SceneLength;
  /** NVS width. Use unit strings: "100%" = full viewport width. Size hint when inside a ViewLayout. Default: auto. */
  w?: SceneLength;
  /** NVS height. Use unit strings: "100%" = full viewport height. Size hint when inside a ViewLayout. Default: auto. */
  h?: SceneLength;
  /** Padding inset. */
  padding?: import('../../layout/regionTypes').RegionPadding;
  /** React children — exactly one renderable DSL element. */
  children?: import('react').ReactNode;
};

export const View = (_props: ViewProps): null => null;
View.displayName = 'View';
