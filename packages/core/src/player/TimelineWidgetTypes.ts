// TimelineWidget prop types. No Three.js or compile pipeline imports.

import type { UseSceneEngineResult } from './useSceneEngine';

export type TimelineTickStyle = 'scene' | 'frame' | 'none';

export type TimelineTheme = 'light' | 'dark';

export type TimelineWidgetProps = {
  /** Required: the engine instance to connect to. */
  engine: UseSceneEngineResult;

  /**
   * Scene definitions, used to render scene name labels.
   * If omitted, numeric scene indices are shown.
   */
  scenes?: ReadonlyArray<{ id: string; meta?: Record<string, unknown> }>;

  /** Widget orientation. Default 'horizontal'. */
  orientation?: 'horizontal' | 'vertical';

  /**
   * Position relative to the viewport.
   * The widget should be placed inside the HUD overlay with absolute positioning.
   * Default 'bottom'.
   */
  position?: 'top' | 'bottom' | 'left' | 'right';

  /** Color theme. Default 'dark'. */
  theme?: TimelineTheme;

  /**
   * Height of the timeline bar in pixels (horizontal) or width (vertical).
   * Default 48.
   */
  thickness?: number;

  /**
   * Major tick style (at scene boundaries). Default 'scene'.
   * 'scene' = one tick per scene.
   * 'frame' = one tick per compiled frame.
   * 'none' = no major ticks.
   */
  majorTicks?: TimelineTickStyle;

  /**
   * Number of minor ticks between each pair of major ticks.
   * Default 0 (no minor ticks).
   */
  minorTicksPerScene?: number;

  /** Whether to show scene labels above/beside major ticks. Default true. */
  showSceneLabels?: boolean;

  /** Whether to render the numeric progress readout. Default false. */
  showProgress?: boolean;

  /** Whether the scrub handle is draggable. Default true. */
  scrubEnabled?: boolean;

  /** CSS class name for the outer container. */
  className?: string;

  /** Inline style for the outer container. */
  style?: React.CSSProperties;

  /** Called when the user seeks to a new progress value. */
  onSeek?: (progress: number) => void;
};
