import type {AssetManifest} from '../elements/model/index';
import {assertManifestValid} from '../elements/model/index';

/**
 * Represents the current loading phase of the model resource pipeline.
 *
 * Transition sequence:
 *   idle → loading-manifest → manifest-ready → loading-model → ready
 *                          ↘                                 ↗
 *                           error (from any phase)
 *
 * Scene compilation can run as soon as `manifest-ready` is reached —
 * before the GLB finishes loading.
 */
export type ResourceState =
  | { phase: 'idle' }
  | { phase: 'loading-manifest' }
  | { phase: 'manifest-ready'; manifest: AssetManifest }
  | { phase: 'loading-model'; manifest: AssetManifest }
  | { phase: 'ready'; manifest: AssetManifest }
  | { phase: 'error'; reason: string };

export type ResourcePhase = ResourceState['phase'];

type StateListener = (state: ResourceState) => void;

/**
 * Owns the resource-loading sequence for the robot model pipeline.
 *
 * Not React. Not Three.js. Pure loading sequencing.
 *
 * Loading sequence:
 * 1. `loadManifest(url)` — fetches and validates robot-metadata.json (~1 KB, fast)
 * 2. Scene compilation can now run (manifest contains clip names + bone targets)
 * 3. React/Three.js loads the GLB (slow) and calls `notifyModelLoading()` / `notifyModelReady()`
 * 4. State reaches `ready` — render loop can begin
 *
 * Consumers observe state via `subscribe()` or poll via `getState()`.
 */
export class ModelResourceManager {
  private _state: ResourceState = { phase: 'idle' };
  private _listeners = new Set<StateListener>();
  private _abortController: AbortController | null = null;

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: StateListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener(this._state);
    }
  }

  private _transition(next: ResourceState): void {
    this._state = next;
    this._notify();
  }

  getState(): ResourceState {
    return this._state;
  }

  /** Returns the manifest when available, null otherwise. */
  getManifest(): AssetManifest | null {
    const s = this._state;
    if (
      s.phase === 'manifest-ready' ||
      s.phase === 'loading-model' ||
      s.phase === 'ready'
    ) {
      return s.manifest;
    }
    return null;
  }

  /** Returns true when both manifest and model are loaded and ready. */
  isReady(): boolean {
    return this._state.phase === 'ready';
  }

  /**
   * Fetches and validates the asset manifest JSON.
   * Transitions: idle/any → loading-manifest → manifest-ready (or error).
   *
   * After this resolves, scene compilation can begin immediately —
   * without waiting for the GLB to load.
   */
  async loadManifest(manifestUrl: string): Promise<AssetManifest> {
    this._abortController?.abort();
    const controller = new AbortController();
    this._abortController = controller;
    this._transition({ phase: 'loading-manifest' });
    try {
      const response = await fetch(manifestUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(
          `[ModelResourceManager] manifest fetch failed: HTTP ${response.status} (${manifestUrl})`,
        );
      }
      const raw = (await response.json()) as unknown;
      const manifest = assertManifestValid(raw);
      this._transition({ phase: 'manifest-ready', manifest });
      return manifest;
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') throw err;
      const reason = err instanceof Error ? err.message : String(err);
      this._transition({ phase: 'error', reason });
      throw err;
    }
  }

  /**
   * Called by the Three.js/React layer when the GLB load begins.
   * Transitions: manifest-ready → loading-model.
   * No-op if manifest is not yet ready.
   */
  notifyModelLoading(): void {
    const s = this._state;
    if (s.phase === 'manifest-ready') {
      this._transition({ phase: 'loading-model', manifest: s.manifest });
    }
  }

  /**
   * Called by the Three.js/React layer when the GLB is loaded and wired.
   * Transitions: loading-model or manifest-ready → ready.
   */
  notifyModelReady(): void {
    const s = this._state;
    if (s.phase === 'loading-model' || s.phase === 'manifest-ready') {
      this._transition({ phase: 'ready', manifest: s.manifest });
    }
  }

  /**
   * Called by any layer to signal a loading error.
   * Transitions to error state regardless of current phase.
   */
  notifyError(reason: string): void {
    this._transition({ phase: 'error', reason });
  }

  /**
   * Resets to idle. Aborts any in-flight manifest fetch.
   */
  reset(): void {
    this._abortController?.abort();
    this._abortController = null;
    this._transition({ phase: 'idle' });
  }
}
