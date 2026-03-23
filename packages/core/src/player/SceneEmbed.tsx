// SceneEmbed.tsx — Self-contained embedded scene player.
// Composes SceneEngine + canvas + visibility lifecycle + progress driver
// into a single component optimized for inline page embedding.

import {
  useLayoutEffect,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { SceneEngine } from './SceneEngine';
import type { SceneEngineProps } from './SceneEngine';
import { SceneCanvas } from './SceneCanvas';
import { BackgroundLayer } from './BackgroundLayer';
import { EngineOverlayHost } from './EngineOverlayHost';
import { InputCoordinator } from './InputCoordinator';
import { useVisibilityGate } from './useVisibilityGate';
import { useAutoPlay } from './useAutoPlay';
import { useSceneEngineContext } from './EngineContext';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Explicitly picked subset of SceneEngineProps that SceneEmbed forwards.
 * Using Pick (not Omit) ensures new SceneEngineProps additions must
 * opt-in to SceneEmbed forwarding — preventing accidental API surface expansion.
 */
type ForwardedEngineProps = Pick<SceneEngineProps,
  | 'id'
  | 'plugins'
  | 'theme'
  | 'sceneTheme'
  | 'timingProfile'
  | 'loadPolicy'
  | 'defaultTransitionDuration'
  | 'defaultTransitionEasing'
  | 'primaryCameraId'
  | 'primaryCanvasActionTargetId'
  | 'cameraInteractionDefaults'
  | 'invalidateCacheToken'
  | 'maxAnimBoostPerFrame'
  | 'scrollSource'
  | 'onReady'
  | 'onError'
  | 'onWidgetError'
  | 'onCompileWarning'
>;

/** Configuration for wall-clock auto-play behavior. */
export interface AutoPlayConfig {
  /**
   * Total seconds to traverse from progress 0 to 1.
   * For multi-scene embeds, this is the total animation duration
   * across all scenes, not per-scene.
   * Default: 6.
   */
  duration?: number;
  /**
   * Loop back to progress 0 when reaching the end.
   * Default: true.
   */
  loop?: boolean;
}

/** Props for the SceneEmbed component. */
export interface SceneEmbedProps extends ForwardedEngineProps {
  // ── Layout ──────────────────────────────────────────────────────────────────
  /** CSS height of the embed container. Required. */
  height: number | string;
  /** CSS width. Default: '100%'. */
  width?: number | string;
  /** CSS class applied to the outer container div. */
  className?: string;

  // ── Auto-Play ───────────────────────────────────────────────────────────────
  /**
   * Auto-advance engine progress via wall-clock time.
   *
   * - `true` — auto-play with defaults (duration: 6s, loop: true).
   * - `AutoPlayConfig` — customize duration and loop behavior.
   * - `false` / omitted — no auto-play.
   *
   * Ignored when `progress` is provided (controlled mode takes precedence).
   * Disabled when `prefers-reduced-motion` media query matches.
   */
  autoPlay?: boolean | AutoPlayConfig;

  // ── Controlled Progress ─────────────────────────────────────────────────────
  /**
   * Externally controlled engine progress in the range [0, 1].
   *
   * When provided, overrides `autoPlay` and drives the engine directly.
   * Pass a static literal to pin to a frame. Pass a dynamic value from
   * React state for interactive scrubbing.
   */
  progress?: number;

  /**
   * Called when an internal input source (e.g., keyboard navigation)
   * requests a progress change. Only meaningful when `progress` is provided.
   * Wire to the same setState that feeds `progress`.
   */
  onProgressChange?: (progress: number) => void;

  // ── Interaction ─────────────────────────────────────────────────────────────
  /**
   * Enable pointer-based camera interaction (orbit, dolly, pan).
   * Default: false. When true, mounts an InputCoordinator inside the engine.
   */
  interactive?: boolean;

  // ── Visibility Lifecycle ────────────────────────────────────────────────────
  /**
   * Controls engine mount lifecycle and rendering behavior relative to
   * viewport visibility.
   *
   * - `'always'` — Mount immediately, run continuously. No visibility gating.
   * - `'autopause'` — Mount immediately. Pause RAF when off-screen. **Default.**
   * - `'lazy'` — Defer mount until near viewport. Unmount when far away.
   */
  visibility?: 'always' | 'autopause' | 'lazy';

  /**
   * IntersectionObserver rootMargin for visibility detection.
   * Default: '200px'. Only meaningful when visibility is 'autopause' or 'lazy'.
   */
  rootMargin?: string;

  // ── Content ─────────────────────────────────────────────────────────────────
  /**
   * Scene declarations (`<Scene>` components) and optionally EngineGate,
   * overlay content, or other engine children. SceneEmbed provides
   * SceneCanvas, BackgroundLayer, and EngineOverlayHost automatically —
   * do not include those in children.
   */
  children: ReactNode;
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Resolves the autoPlay prop to a normalized config or null.
 */
function resolveAutoPlayConfig(
  autoPlay: boolean | AutoPlayConfig | undefined,
): AutoPlayConfig | null {
  if (autoPlay === undefined || autoPlay === false) return null;
  if (autoPlay === true) return { duration: 6, loop: true };
  return {
    duration: autoPlay.duration ?? 6,
    loop: autoPlay.loop ?? true,
  };
}

// ── Internal Components ──────────────────────────────────────────────────────

interface SceneEmbedInnerProps extends ForwardedEngineProps {
  visible: boolean;
  autoPlay?: boolean | AutoPlayConfig;
  progress?: number;
  onProgressChange?: (progress: number) => void;
  interactive?: boolean;
  children: ReactNode;
}

/**
 * Bridges the autoPlay / progress props to the engine.
 * Exactly one mode is active at a time.
 */
function EmbedProgressDriver(props: {
  autoPlay?: boolean | AutoPlayConfig;
  progress?: number;
  onProgressChange?: (progress: number) => void;
  visible: boolean;
}): ReactElement | null {
  const engine = useSceneEngineContext();

  // ── Mode resolution ─────────────────────────────────────────────────────────
  // Controlled mode: progress prop takes precedence over autoPlay.
  const isControlled = props.progress !== undefined;

  // ── Controlled mode ─────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!isControlled) return;
    engine.setProgress(Math.max(0, Math.min(1, props.progress!)));
  }, [engine, isControlled, props.progress]);

  // ── Auto-play mode ──────────────────────────────────────────────────────────
  const autoPlayConfig = resolveAutoPlayConfig(props.autoPlay);
  const autoPlayActive = !isControlled && autoPlayConfig !== null && props.visible;

  useAutoPlay({
    duration: autoPlayConfig?.duration ?? 6,
    loop: autoPlayConfig?.loop ?? true,
    active: autoPlayActive,
  });

  return null;
}

/**
 * Pauses/resumes the engine's RAF loop based on visibility.
 */
function EmbedVisibilityPauser(props: { visible: boolean }): null {
  const engine = useSceneEngineContext();

  useEffect(() => {
    if (props.visible) {
      engine.resume();
    } else {
      engine.pause();
    }
  }, [engine, props.visible]);

  return null;
}

/**
 * Inner component that lives inside the SceneEngine context tree.
 * Separated from SceneEmbed so progress driver and visibility pauser
 * can access useSceneEngineContext().
 */
function SceneEmbedInner(props: SceneEmbedInnerProps): ReactElement {
  // ── Development-mode prop validation ────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    if (props.progress !== undefined && props.autoPlay) {
      console.warn(
        '[BrewSite] <SceneEmbed> has both `progress` and `autoPlay` props. ' +
        '`progress` takes precedence; `autoPlay` is ignored.',
      );
    }
    if (props.onProgressChange !== undefined && props.progress === undefined) {
      console.warn(
        '[BrewSite] <SceneEmbed> has `onProgressChange` without `progress`. ' +
        'onProgressChange is only meaningful in controlled mode.',
      );
    }
  }

  return (
    <SceneEngine
      id={props.id}
      plugins={props.plugins}
      theme={props.theme}
      sceneTheme={props.sceneTheme}
      timingProfile={props.timingProfile}
      loadPolicy={props.loadPolicy}
      defaultTransitionDuration={props.defaultTransitionDuration}
      defaultTransitionEasing={props.defaultTransitionEasing}
      primaryCameraId={props.primaryCameraId}
      primaryCanvasActionTargetId={props.primaryCanvasActionTargetId}
      cameraInteractionDefaults={props.cameraInteractionDefaults}
      invalidateCacheToken={props.invalidateCacheToken}
      maxAnimBoostPerFrame={props.maxAnimBoostPerFrame}
      scrollSource={props.scrollSource}
      onReady={props.onReady}
      onError={props.onError}
      onWidgetError={props.onWidgetError}
      onCompileWarning={props.onCompileWarning}
    >
      {/* Scene declarations from consumer */}
      {props.children}

      {/* Progress driver — auto-play or controlled */}
      <EmbedProgressDriver
        autoPlay={props.autoPlay}
        progress={props.progress}
        onProgressChange={props.onProgressChange}
        visible={props.visible}
      />

      {/* Visibility-based RAF pausing */}
      <EmbedVisibilityPauser visible={props.visible} />

      {/* Optional camera interaction */}
      {props.interactive === true && <InputCoordinator />}

      {/* Infrastructure — always rendered */}
      <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <SceneCanvas style={{ width: '100%', height: '100%' }} />
      </div>
      <EngineOverlayHost passthroughPointerEvents={props.interactive !== true} />
    </SceneEngine>
  );
}

// ── Public Component ─────────────────────────────────────────────────────────

/**
 * SceneEmbed — self-contained embedded scene player.
 *
 * Composes SceneEngine + SceneCanvas + BackgroundLayer + EngineOverlayHost
 * with built-in visibility lifecycle management, auto-play, and controlled
 * progress support. Designed for inline page embedding (MDX, docs, marketing).
 */
export function SceneEmbed(props: SceneEmbedProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  const visibility = props.visibility ?? 'autopause';
  const rootMargin = props.rootMargin ?? '200px';

  const { mounted, visible } = useVisibilityGate(containerRef, visibility, rootMargin);

  // ── Resolve container styles ────────────────────────────────────────────────
  const containerStyle: CSSProperties = {
    width: typeof props.width === 'number' ? `${props.width}px` : (props.width ?? '100%'),
    height: typeof props.height === 'number' ? `${props.height}px` : props.height,
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div ref={containerRef} className={props.className} style={containerStyle}>
      {mounted && (
        <SceneEmbedInner
          visible={visible}
          autoPlay={props.autoPlay}
          progress={props.progress}
          onProgressChange={props.onProgressChange}
          interactive={props.interactive}
          id={props.id}
          plugins={props.plugins}
          theme={props.theme}
          sceneTheme={props.sceneTheme}
          timingProfile={props.timingProfile}
          loadPolicy={props.loadPolicy}
          defaultTransitionDuration={props.defaultTransitionDuration}
          defaultTransitionEasing={props.defaultTransitionEasing}
          primaryCameraId={props.primaryCameraId}
          primaryCanvasActionTargetId={props.primaryCanvasActionTargetId}
          cameraInteractionDefaults={props.cameraInteractionDefaults}
          invalidateCacheToken={props.invalidateCacheToken}
          maxAnimBoostPerFrame={props.maxAnimBoostPerFrame}
          scrollSource={props.scrollSource}
          onReady={props.onReady}
          onError={props.onError}
          onWidgetError={props.onWidgetError}
          onCompileWarning={props.onCompileWarning}
        >
          {props.children}
        </SceneEmbedInner>
      )}
    </div>
  );
}
