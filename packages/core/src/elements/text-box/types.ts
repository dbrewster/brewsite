// TextBox element type contracts. No runtime imports, no Three.js, no React.

import type { NVSRect } from '../../layout/types';
import type React from 'react';

/**
 * Anchor mode for a TextBox.
 * 'scene'    — positioned in NVS space relative to the AR-locked container.
 * 'viewport' — positioned relative to the full browser viewport using edge + inset.
 */
export type TextBoxAnchorMode = 'scene' | 'viewport';

/**
 * Viewport edge for TextBox with anchor='viewport'.
 * The box is pinned to this edge of the browser viewport.
 */
export type TextBoxEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Compiled runtime state for one TextBox instance.
 * All layout properties are pre-compiled into this state from the DSL props.
 * The `children` field carries the React content for runtime rendering.
 *
 * Fields `x`, `y`, `w`, `h` are in NVS space [0, 1] and only meaningful
 * when anchor='scene'. When anchor='viewport', use edge + inset instead.
 */
export type TextBoxState = {
  /** NVS x-coordinate of the left edge [0, 1]. Only meaningful for anchor='scene'. */
  x: number;
  /** NVS y-coordinate of the top edge [0, 1]. Only meaningful for anchor='scene'. */
  y: number;
  /** NVS width [0, 1]. Only meaningful for anchor='scene'. */
  w: number;
  /** NVS height [0, 1]. Only meaningful for anchor='scene'. */
  h: number;
  /** Opacity of the box and its contents. Default: 1. Animatable. */
  opacity: number;
  /**
   * Positioning context.
   * 'scene'    — position relative to the AR-locked container using x/y/w/h.
   * 'viewport' — position relative to the full browser viewport using edge/inset.
   */
  anchor: TextBoxAnchorMode;
  /**
   * Viewport edge to pin to. Only meaningful for anchor='viewport'.
   * The box spans the full perpendicular dimension of the viewport.
   */
  edge?: TextBoxEdge;
  /**
   * Distance from the declared edge as a fraction of the viewport dimension.
   * Only meaningful for anchor='viewport'. Default: 0.
   */
  inset?: number;
  /**
   * Content overflow behavior for the box.
   * 'hidden'  — clips content to the box bounds (default, intentional).
   * 'visible' — allows content to extend beyond the box (opt-in).
   */
  overflow: 'hidden' | 'visible';
  /**
   * z-index layer for the box. Default: 0. Higher values render on top.
   * Use discrete integers. Do not use z-index values above 100 — reserved for
   * engine chrome (tooltips, inspect panels).
   */
  layer: number;
  /**
   * The React content to render inside this box.
   * Not compiled into the SceneTrack tick array — carried by reference.
   * The widget reads this from the compiled state and passes it to EngineOverlayHost.
   */
  children: React.ReactNode;
};

// Re-export NVSRect for consumers that need it alongside TextBoxState.
export type { NVSRect };
