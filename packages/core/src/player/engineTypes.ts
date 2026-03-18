import type { ReactElement, RefObject } from 'react';
import type { SceneTrackTick } from '../compiler/sceneTrackTypes';

export type EngineFrameState = {
  tickIndex: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  /** Current tick snapshot. Null before the engine's first frame. */
  tick?: SceneTrackTick | null;
};

// Re-export CameraInteractionDefaults from canonical location (elements/camera/types).
// useSceneEngine.ts and SceneEngine.tsx import this from './engineTypes' — the re-export
// keeps those imports working without modification.
export type { CameraInteractionDefaults } from '../elements/camera/types';

/**
 * Internal scene spec linking a scene registration key to its compiled content.
 * Shared between ScenePlayer, SceneEngine, and useSceneEngine.
 */
export type InternalSceneSpec = {
  readonly sceneKey: string;
  readonly contentKey: string;
  readonly element: ReactElement;
};

export type EngineTimingProfile = {
  blockSize?: number;
  qualityPreset?: 'performance' | 'balanced' | 'high';
  fpsCap?: number;
};

/**
 * Viewport-relative scroll source configuration.
 * When used as SceneEngine's scrollSource, the engine computes progress
 * from how far the user has scrolled through the containerRef element,
 * and manages WebGL context acquisition/release via IntersectionObserver.
 */
export type ViewportRelativeScrollSource = {
  readonly kind: 'viewport-relative';
  /**
   * Ref to the outer container element of the ScenePanel.
   * offsetHeight and getBoundingClientRect() are called on this element
   * on every window scroll event to compute progress.
   */
  readonly containerRef: RefObject<HTMLElement | null>;
  /**
   * Ref to the <canvas> element managed by SceneCanvas inside this panel.
   * Used to acquire/release the WEBGL_lose_context extension for GPU budget
   * management as the panel enters and exits the viewport.
   */
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
};

/**
 * Scroll source configuration for SceneEngine.
 * 'window' — tracks window.scrollY relative to a scroll-height container.
 * { kind: 'element' } — tracks a scrollable element's scrollTop.
 * ViewportRelativeScrollSource — tracks scroll through an inline panel.
 */
export type ScrollSource =
  | 'window'
  | { kind: 'element'; elementRef: RefObject<HTMLElement | null> }
  | ViewportRelativeScrollSource;

/**
 * Subset of ScrollSource that useSceneEngine and useEngineScroll understand.
 * ViewportRelativeScrollSource is intercepted by SceneEngine before being
 * passed to useSceneEngine — useSceneEngine never sees it.
 */
export type EngineInternalScrollSource = Exclude<ScrollSource, ViewportRelativeScrollSource>;
