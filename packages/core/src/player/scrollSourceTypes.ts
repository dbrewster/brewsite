// scrollSourceTypes.ts — IScrollSource interface and ScrollSourceProp union.

import type { RefObject } from 'react';

/**
 * Extension point for custom scroll position providers (Lenis, Virtual Scroll,
 * hidden native scroll regions, etc.). Implement this interface and pass it to
 * ScrollInput.source to take full control over progress production and programmatic scroll.
 */
export interface IScrollSource {
  /**
   * Subscribe to raw progress updates [0, 1].
   * Called whenever the scroll position changes.
   * Must return an unsubscribe function; called on cleanup.
   */
  subscribe(onProgress: (rawProgress: number) => void): () => void;

  /**
   * Optional. Programmatically set the scroll position by raw progress [0, 1].
   * Called by useGoToScene() when this source is active.
   * If omitted, programmatic navigation is a no-op for this source.
   */
  scrollTo?(rawProgress: number): void;
}

/**
 * The source prop accepted by ScrollInput.
 *
 * 'inertia'      — Spring-decay velocity integrator on wheel events. No DOM scroll region.
 *                  Default for SceneReel / embedded contexts.
 * 'window'       — Reads window.scrollY. Must be paired with ScrollStage.
 * { elementRef } — Reads element.scrollTop. Must be paired with ScrollStage.
 * IScrollSource  — Custom implementation; full control over progress and programmatic scroll.
 */
export type ScrollSourceProp =
  | 'inertia'
  | 'window'
  | { elementRef: RefObject<HTMLElement | null> }
  | IScrollSource;
