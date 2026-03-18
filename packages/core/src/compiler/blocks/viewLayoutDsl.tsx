// <ViewLayout> DSL component for multi-view arrangement.
// Null-returning component consumed by the compiler.

import type { ViewLayoutKind } from '../../layout/regionTypes';
import type { CarouselSelectHandler } from '../../input/carouselSelectTypes';

export type ViewLayoutProps = {
  /** Stable layout identity. Default: auto-generated from kind + scene index. */
  id?: string;
  /** Layout policy. */
  kind: ViewLayoutKind;
  /** NVS x position [0..1] of the layout container. Default: 0. */
  x?: number;
  /** NVS y position [0..1] of the layout container. Default: 0. */
  y?: number;
  /** NVS width [0..1] of the layout container. Default: 1. */
  w?: number;
  /** NVS height [0..1] of the layout container. Default: 1. */
  h?: number;
  /** NVS gap between views. */
  gap?: number;

  // Stack-specific:
  /** Stack direction. Only used when kind='stack'. Default: 'horizontal'. */
  direction?: 'horizontal' | 'vertical';

  // Carousel-specific:
  /**
   * 0-indexed active (front) view. Only used when kind='carousel'. Default: 0.
   * @deprecated Use `focusedIndex` instead. Will be removed in the next major version.
   */
  activeIndex?: number;

  /** 0-indexed focused (front) view. Only used when kind='carousel'. Default: 0. */
  focusedIndex?: number;

  /**
   * Called when a carousel item is selected via pointer click, keyboard Enter/Space,
   * or programmatic trigger. Only used when kind='carousel'.
   *
   * The callback receives a CarouselSelectEvent with the selected item's index,
   * viewId, layoutId, pointer position (if applicable), and trigger source.
   *
   * Call event.preventDefault() to stop the event from propagating to the
   * ActionInputController's normal click dispatch waterfall.
   *
   * NOTE: This callback is extracted during compilation and stored in the
   * InteractionCallbackRegistry. It is NOT baked into the SceneTrack.
   */
  onSelect?: CarouselSelectHandler;
  /** Scale factor for inactive views. Only used when kind='carousel'. Default: 0.75. */
  inactiveScale?: number;
  /** World-space Z depth. Linear: per-position step. Loop: total front-to-back depth. Only used when kind='carousel'. Default: 0. */
  zStep?: number;
  /**
   * When true, views wrap around in an elliptical ring instead of a linear fan.
   * Only used when kind='carousel'. Default: false.
   */
  loop?: boolean;
  /**
   * Horizontal spread of the loop ellipse [0..1] as a fraction of container width.
   * When omitted, auto-computed from zStep (shallow → wider, deep → narrower).
   * Only used when kind='carousel' and loop=true.
   */
  spread?: number;
  /**
   * Minimum opacity for the farthest-back views [0..1]. 1.0 = no fade (default).
   * Only used when kind='carousel' and loop=true.
   */
  fadeMin?: number;

  /** React children — <View> elements. */
  children?: import('react').ReactNode;
};

export const ViewLayout = (_props: ViewLayoutProps): null => null;
ViewLayout.displayName = 'ViewLayout';
