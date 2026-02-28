import { describe, expect, it } from 'vitest';
import {
  getSceneRuntimeState,
  hasRegisteredPlayer,
  setSceneRuntimeState,
  subscribeSceneRuntime,
  unregisterSceneRuntime,
} from '../ScenePlayerRegistry';

describe('ScenePlayerRegistry', () => {
  it('notifies listeners on state updates', () => {
    const id = 'player-a';
    let calls = 0;
    const unsubscribe = subscribeSceneRuntime(id, () => {
      calls += 1;
    });

    setSceneRuntimeState(id, {
      assetsReady: true,
      viewport: { width: 100, height: 50, aspectRatio: 2 },
      variables: undefined,
      numScenes: 3,
    });

    expect(calls).toBe(1);
    unsubscribe();
    unregisterSceneRuntime(id);
  });

  it('returns default state for unregistered players', () => {
    const state = getSceneRuntimeState('missing-player');
    expect(state).toEqual({
      assetsReady: false,
      viewport: { width: 1, height: 1, aspectRatio: 1 },
      variables: undefined,
      numScenes: 0,
    });
  });

  it('supports hasRegisteredPlayer lifecycle', () => {
    const id = 'player-b';
    expect(hasRegisteredPlayer(id)).toBe(false);
    setSceneRuntimeState(id, {
      assetsReady: false,
      viewport: { width: 1, height: 1, aspectRatio: 1 },
      variables: undefined,
      numScenes: 3,
    });
    expect(hasRegisteredPlayer(id)).toBe(true);
    expect(getSceneRuntimeState(id).numScenes).toBe(3);
    unregisterSceneRuntime(id);
    expect(hasRegisteredPlayer(id)).toBe(false);
  });

  it('cleans up listeners on unsubscribe', () => {
    const id = 'player-c';
    let calls = 0;
    const unsubscribe = subscribeSceneRuntime(id, () => {
      calls += 1;
    });

    unsubscribe();
    setSceneRuntimeState(id, {
      assetsReady: true,
      viewport: { width: 10, height: 10, aspectRatio: 1 },
      variables: undefined,
      numScenes: 1,
    });

    expect(calls).toBe(0);
    unregisterSceneRuntime(id);
  });
});
