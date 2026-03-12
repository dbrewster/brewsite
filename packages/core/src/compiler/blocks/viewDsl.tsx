// <View> DSL component for spatial composition.
// Null-returning component consumed by the compiler.

export type ViewProps = {
  /** Stable view identity. Required. */
  id: string;
  /**
   * NVS x position [0..1]. Used for standalone views (no parent ViewLayout).
   * Ignored when inside a ViewLayout.
   */
  x?: number;
  /**
   * NVS y position [0..1]. Used for standalone views (no parent ViewLayout).
   * Ignored when inside a ViewLayout.
   */
  y?: number;
  /** NVS width [0..1]. Size hint when inside a ViewLayout. Default: auto. */
  w?: number;
  /** NVS height [0..1]. Size hint when inside a ViewLayout. Default: auto. */
  h?: number;
  /** Padding inset. */
  padding?: import('../../layout/regionTypes').RegionPadding;
  /** React children — exactly one renderable DSL element. */
  children?: import('react').ReactNode;
};

export const View = (_props: ViewProps): null => null;
View.displayName = 'View';
