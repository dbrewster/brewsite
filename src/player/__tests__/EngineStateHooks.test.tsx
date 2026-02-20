import { describe, it, expect } from 'vitest';
import React, { Component } from 'react';
import renderer, { act } from 'react-test-renderer';
import { EngineStateContext } from '../EngineStateContext';
import { useSceneProgress } from '../useSceneProgress';
import { useCurrentScene } from '../useCurrentScene';

class ErrorBoundary extends Component<{ onError: (error: Error) => void; children?: React.ReactNode }> {
  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  render(): React.ReactNode {
    return this.props.children;
  }
}

describe('Engine state hooks', () => {
  it('useSceneProgress reads progress from context', () => {
    let value = -1;
    const Test = () => {
      value = useSceneProgress();
      return null;
    };

    act(() => {
      renderer.create(
        <EngineStateContext.Provider value={{ progress: 0.42, sceneId: 'a', sceneIndex: 0, sceneProgress: 0.1 }}>
          <Test />
        </EngineStateContext.Provider>,
      );
    });

    expect(value).toBe(0.42);
  });

  it('useCurrentScene reads id and index from context', () => {
    let current: { id: string; index: number } | null = null;
    const Test = () => {
      current = useCurrentScene();
      return null;
    };

    act(() => {
      renderer.create(
        <EngineStateContext.Provider value={{ progress: 0.2, sceneId: 'intro', sceneIndex: 3, sceneProgress: 0.5 }}>
          <Test />
        </EngineStateContext.Provider>,
      );
    });

    expect(current).toEqual({ id: 'intro', index: 3 });
  });

  it('throws when hooks are used outside provider', () => {
    let captured: Error | null = null;
    const Test = () => {
      useSceneProgress();
      return null;
    };

    act(() => {
      renderer.create(
        <ErrorBoundary onError={(error) => { captured = error; }}>
          <Test />
        </ErrorBoundary>,
      );
    });

    const message = (captured as unknown as Error | null)?.message ?? '';
    expect(message).toBe('[useEngineState] must be used inside <ScenePlayer>');
  });
});
