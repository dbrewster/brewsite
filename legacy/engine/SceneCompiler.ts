/**
 * SceneCompiler — standalone, non-React compilation lifecycle manager.
 *
 * Owns the full compile lifecycle. The first compile (from idle state) runs
 * synchronously — matching the old useMemo behavior for initial renders.
 * Subsequent compiles with a different cache key (quality/option upgrades)
 * are deferred via requestIdleCallback / setTimeout(0) to avoid jank.
 *
 * React observes it via useSceneCompilerState; React never drives it.
 */
import type {AssetManifest, ClipMeta} from '../elements/model/index';
import {clipMetaFromManifest} from '../elements/model/index';
import type {RobotTimeline} from '../robotTimeline';
import {createQualityTimeline} from '../robotTimeline';
import type {SceneTrack} from '../runtime/compiler/sceneTrackTypes';
import type {SceneTrackSampler} from '../runtime/compiler/sceneTrackSampler';
import type {SceneFrameContext, SceneSource} from '../runtime/compiler/sceneTypes';
import {buildClipMetaKey, buildSceneTrackKey, getOrCompileSceneTrack} from '../runtime/compiler/sceneTrackCache';

// ─── Public types ─────────────────────────────────────────────────────────────

export type SceneCompilerState =
  | { phase: 'idle' }
  | { phase: 'compiling' }
  | { phase: 'ready'; track: SceneTrack; sampler: SceneTrackSampler }
  | { phase: 'error'; reason: string };

export type SceneCompilerOptions = {
  scenes: SceneSource[];
  timeline: RobotTimeline;
  assetsReady: boolean;
  availableClips?: ClipMeta[];
  manifest?: AssetManifest;
  prefersReducedMotion: boolean;
  subTicks: number;
  ui?: SceneFrameContext['ui'];
  uiKey?: string;
};

type StateListener = (state: SceneCompilerState) => void;

// ─── SceneCompiler ────────────────────────────────────────────────────────────

export class SceneCompiler {
  private _state: SceneCompilerState = { phase: 'idle' };
  private _listeners = new Set<StateListener>();
  private _cancelBuild: (() => void) | null = null;
  private _lastCacheKey: string | null = null;

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: StateListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  getState(): SceneCompilerState {
    return this._state;
  }

  /**
   * Schedules (or immediately runs) a compilation with the given options.
   *
   * - If the cache key matches the last successful compile: no-op (already ready).
   * - If the compiler is in 'idle' state (first call): compiles synchronously.
   *   This matches the old useMemo behavior and ensures no null on first render.
   * - Otherwise (quality/option upgrade from 'ready' state): cancels any
   *   in-flight build and defers via requestIdleCallback / setTimeout(0).
   */
  compile(options: SceneCompilerOptions): void {
    const resolvedClips = options.manifest
      ? clipMetaFromManifest(options.manifest)
      : (options.availableClips ?? []);
    const clipKey = buildClipMetaKey(resolvedClips);
    const qualityTimeline = createQualityTimeline(options.timeline, options.subTicks);
    const cacheKey = buildSceneTrackKey({
      scenes: options.scenes,
      timeline: qualityTimeline,
      clipKey,
      prefersReducedMotion: options.prefersReducedMotion,
      assetsReady: options.assetsReady,
      uiKey: options.uiKey,
    });

    // No-op: same key as last successful build and already ready
    if (cacheKey === this._lastCacheKey && this._state.phase === 'ready') {
      return;
    }

    // Cancel any in-flight build
    this._cancelBuild?.();
    this._cancelBuild = null;

    const compileOptions = {
      scenes: options.scenes,
      timeline: qualityTimeline,
      assetsReady: options.assetsReady,
      manifest: options.manifest,
      availableClips: resolvedClips,
      prefersReducedMotion: options.prefersReducedMotion,
      ui: options.ui,
      uiKey: options.uiKey,
    };

    const doBuild = () => {
      try {
        const entry = getOrCompileSceneTrack(compileOptions);
        this._lastCacheKey = cacheKey;
        this._transition({
          phase: 'ready',
          track: entry.track,
          sampler: entry.sampler,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this._transition({ phase: 'error', reason });
      }
      this._cancelBuild = null;
    };

    // First compile (idle state): run synchronously to avoid null on first render.
    // This matches the old useMemo behavior where the initial track was always available.
    if (this._state.phase === 'idle') {
      doBuild();
      return;
    }

    // Quality/option upgrade: defer to avoid blocking the main thread.
    // Only emit 'compiling' if not already in that phase (idempotent — prevents
    // setState loops when the caller re-invokes compile() on every render).
    if (this._state.phase !== 'compiling') {
      this._transition({ phase: 'compiling' });
    }

    if (typeof globalThis !== 'undefined' && 'requestIdleCallback' in globalThis) {
      const ric = globalThis as typeof globalThis & {
        requestIdleCallback: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
        cancelIdleCallback: (id: number) => void;
      };
      let cancelled = false;
      const handle = ric.requestIdleCallback(
        () => {
          if (!cancelled) doBuild();
        },
        { timeout: 1200 },
      );
      this._cancelBuild = () => {
        cancelled = true;
        ric.cancelIdleCallback(handle);
      };
    } else {
      let cancelled = false;
      const handle = typeof globalThis !== 'undefined'
        ? globalThis.setTimeout(() => {
            if (!cancelled) doBuild();
          }, 0)
        : null;
      this._cancelBuild = () => {
        cancelled = true;
        if (handle !== null && typeof globalThis !== 'undefined') {
          globalThis.clearTimeout(handle);
        }
      };
    }
  }

  /**
   * Cancels any in-flight build and clears all listeners.
   * Call when the compiler is no longer needed (e.g. component unmount).
   */
  dispose(): void {
    this._cancelBuild?.();
    this._cancelBuild = null;
    this._listeners.clear();
  }

  private _transition(next: SceneCompilerState): void {
    this._state = next;
    for (const listener of this._listeners) {
      listener(this._state);
    }
  }
}
