// TextBox DSL component — authored inside <Scene>, compiled by TextBoxWidget.
// Returns null; the engine renders content at runtime via EngineOverlayHost.

import { type ReactNode } from 'react';
import type { TextBoxAnchorMode, TextBoxEdge } from './types';

/**
 * Props for the <TextBox> DSL component.
 *
 * For anchor='scene' (default), place content at NVS coordinates within the
 * AR-locked container. x, y, w, h are [0, 1] ratios.
 *
 * For anchor='viewport', place content fixed relative to the browser viewport
 * using edge + inset. The box spans the full perpendicular viewport dimension.
 *
 * All numeric layout props are optional on the DSL. The compile step fills
 * defaults: x=0, y=0, w=1, h=1, opacity=1, layer=0, overflow='hidden'.
 */
export type TextBoxProps = {
  /** Unique identifier for this TextBox widget instance. */
  id: string;
  /** NVS x-coordinate of left edge [0, 1]. Default: 0. anchor='scene' only. */
  x?: number;
  /** NVS y-coordinate of top edge [0, 1]. Default: 0. anchor='scene' only. */
  y?: number;
  /** NVS width [0, 1]. Default: 1. anchor='scene' only. */
  w?: number;
  /** NVS height [0, 1]. Default: 1. anchor='scene' only. */
  h?: number;
  /** Box opacity [0, 1]. Default: 1. Animatable between scenes. */
  opacity?: number;
  /**
   * Positioning context. Default: 'scene'.
   * 'scene'    — relative to AR-locked container using x/y/w/h.
   * 'viewport' — relative to browser viewport using edge/inset.
   */
  anchor?: TextBoxAnchorMode;
  /** Viewport edge. Only used when anchor='viewport'. */
  edge?: TextBoxEdge;
  /** Inset fraction from the edge. Only used when anchor='viewport'. Default: 0. */
  inset?: number;
  /**
   * Content overflow behavior. Default: 'hidden'.
   * Use 'visible' for tooltips or dropdowns that extend beyond the box.
   */
  overflow?: 'hidden' | 'visible';
  /**
   * z-index layer. Default: 0. Higher values render on top.
   * Do not use values above 100 (reserved for engine chrome).
   */
  layer?: number;
  /**
   * The React content to render inside the box at runtime.
   * This is not compiled — it is passed through to EngineOverlayHost as-is.
   */
  children: ReactNode;
};

/**
 * DSL component for placing DOM content at an NVS position inside a scene.
 *
 * Returns null — the component is compiled by TextBoxWidget's NodeHandler,
 * never rendered directly by React.
 *
 * Usage:
 *   <TextBox id="panel-left" x={0.05} y={0.1} w={0.4} h={0.8}>
 *     <h2>Feature title</h2>
 *     <p>Description text</p>
 *   </TextBox>
 */
export const TextBox = (_props: TextBoxProps): null => null;
TextBox.displayName = 'TextBox';
