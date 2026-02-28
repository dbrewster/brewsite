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
};

export const hasRegisteredPlayer = (id: string): boolean => states.has(id);
