import type { VariableStoreReader } from '../widget/VariableStore';

export type SceneRuntimeState = {
  readonly assetsReady: boolean;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly aspectRatio: number;
  };
  readonly variables: VariableStoreReader | undefined;
  readonly numScenes: number;
};

const DEFAULT_STATE: SceneRuntimeState = {
  assetsReady: false,
  viewport: { width: 1, height: 1, aspectRatio: 1 },
  variables: undefined,
  numScenes: 0,
};

/**
 * MODULE-LEVEL SINGLETON — SSR and multi-instance constraints.
 *
 * This Map lives at module scope and accumulates state across the entire JS
 * runtime lifetime (including across hot-module replacements and test runs).
 *
 * Constraints:
 * 1. SSR (Node.js): All concurrently running server requests share this Map.
 *    For stateless SSR, this is generally safe. Call unregisterSceneRuntime(id)
 *    at the end of each render to avoid memory leaks.
 * 2. Multiple SceneEngine instances on one page: each must have a unique `id`
 *    prop. If two engines share an id, the second registration overwrites the first.
 * 3. Tests: Call `clearRegistry()` from `@brewsite/core/testing` between test
 *    cases that mount SceneEngine to avoid state bleed across tests.
 *
 * Design rationale: the global registry enables useSceneEngineState(id) and
 * useSceneRuntime(id) to work from anywhere in the React tree without context
 * threading. This trade-off is intentional.
 */
const states = new Map<string, SceneRuntimeState>();
const listeners = new Map<string, Set<() => void>>();

export const setSceneRuntimeState = (id: string, state: SceneRuntimeState): void => {
  states.set(id, state);
  listeners.get(id)?.forEach((listener) => listener());
};

export const getSceneRuntimeState = (id: string): SceneRuntimeState => states.get(id) ?? DEFAULT_STATE;

export const subscribeSceneRuntime = (id: string, listener: () => void): (() => void) => {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id)!.add(listener);
  return () => {
    listeners.get(id)?.delete(listener);
    if (listeners.get(id)?.size === 0) listeners.delete(id);
  };
};

export const unregisterSceneRuntime = (id: string): void => {
  states.delete(id);
  listeners.delete(id);
  // Clean engine snapshot registry as well
  engineSnapshots.delete(id);
  engineSnapshotListeners.delete(id);
};

export const hasRegisteredPlayer = (id: string): boolean => states.has(id);

// ─── Engine Snapshot Registry ─────────────────────────────────────────────────
// Provides frame-level engine state accessible from anywhere in the React tree
// via useSceneEngineState(id) — no SceneEngine ancestor required.

export type SceneEngineSnapshot = {
  readonly sceneId: string;
  readonly sceneIndex: number;
  readonly sceneProgress: number;
  readonly progress: number;
};

const engineSnapshots = new Map<string, SceneEngineSnapshot>();
const engineSnapshotListeners = new Map<string, Set<() => void>>();

export const setEngineSnapshot = (id: string, snapshot: SceneEngineSnapshot): void => {
  engineSnapshots.set(id, snapshot);
  engineSnapshotListeners.get(id)?.forEach((fn) => fn());
};

/**
 * Returns the current engine snapshot for the given id.
 * Returns null (not a default snapshot) when the id is not registered.
 * This gives consumers a reliable "not mounted" signal distinct from a mounted engine
 * that happens to be at frame 0 with sceneId ''. The | null return type is honest.
 */
export const getEngineSnapshot = (id: string): SceneEngineSnapshot | null =>
  engineSnapshots.get(id) ?? null;

export const subscribeEngineSnapshot = (id: string, listener: () => void): (() => void) => {
  if (!engineSnapshotListeners.has(id)) engineSnapshotListeners.set(id, new Set());
  engineSnapshotListeners.get(id)!.add(listener);
  return () => {
    engineSnapshotListeners.get(id)?.delete(listener);
    if (engineSnapshotListeners.get(id)?.size === 0) engineSnapshotListeners.delete(id);
  };
};

// ─── Canvas Binding Registry ───────────────────────────────────────────────────
// Allows SceneCanvas with engineId prop to register a canvas to a named engine
// even when SceneCanvas is not a descendant of that engine in the React tree.

type CanvasBindingEntry = {
  setCanvasRef: (el: HTMLCanvasElement | null) => void;
  setViewportSize: (w: number, h: number) => void;
};

const canvasBindings = new Map<string, CanvasBindingEntry>();

/** Called by SceneEngine on mount when it has an id prop. */
export const registerCanvasBinding = (id: string, entry: CanvasBindingEntry): void => {
  canvasBindings.set(id, entry);
};

/** Called by SceneEngine on unmount. */
export const unregisterCanvasBinding = (id: string): void => {
  canvasBindings.delete(id);
};

/** Called by SceneCanvas when engineId prop is set. Returns null if engine not mounted yet. */
export const getCanvasBinding = (id: string): CanvasBindingEntry | null =>
  canvasBindings.get(id) ?? null;
