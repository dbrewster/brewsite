// Normalized Viewport Space (NVS) type contracts.
// No runtime imports, no Three.js, no React.

/**
 * A rectangle in Normalized Viewport Space.
 * All values are ratios in [0, 1] relative to the AR-locked container.
 *
 * Origin is the top-left corner of the container.
 * x=0 is the left edge; x=1 is the right edge.
 * y=0 is the top edge; y=1 is the bottom edge.
 *
 * A fullscreen rect is { x: 0, y: 0, w: 1, h: 1 }.
 */
export interface NVSRect {
  /** Left edge in [0, 1]. */
  x: number;
  /** Top edge in [0, 1]. */
  y: number;
  /** Width in [0, 1]. */
  w: number;
  /** Height in [0, 1]. */
  h: number;
}

/**
 * A point in Normalized Viewport Space.
 * x=0 is the left edge; x=1 is the right edge.
 * y=0 is the top edge; y=1 is the bottom edge.
 */
export interface NVSPosition {
  x: number;
  y: number;
}

/**
 * Widget SDK interface for widgets that declare an NVS bounds.
 * Implemented by DiagramCanvasWidget, ChartWidget, and ModelWidget.
 *
 * The engine uses this to:
 * - Auto-frame Three.js cameras to fill the declared NVS region
 * - Allow authoring tools to query what occupies a given screen region
 * - Detect NVS bound conflicts at development time
 *
 * `nvsBounds` must return a non-nullable NVSRect. Widgets that have not
 * yet received a compiled state should return the fullscreen default
 * { x: 0, y: 0, w: 1, h: 1 }.
 */
export interface INVSBounded {
  readonly nvsBounds: NVSRect;
}
