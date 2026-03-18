// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EngineGate } from '../EngineGate';
import { EngineStateContext } from '../EngineStateContext';
import type { EngineFrameState } from '../engineTypes';

// EngineFrameState includes tickIndex after the fix in §3.7. No tick field — that is EngineFrameState.
const makeState = (tickIndex: number): EngineFrameState => ({
  tickIndex,
  progress: 0,
  sceneId: 'scene-0',
  sceneIndex: 0,
  sceneProgress: 0,
});

afterEach(() => cleanup());

describe('EngineGate', () => {
  it('renders placeholder when tickIndex < 0', () => {
    render(
      <EngineStateContext.Provider value={makeState(-1)}>
        <EngineGate placeholder={<div>loading</div>}>
          <div>content</div>
        </EngineGate>
      </EngineStateContext.Provider>,
    );
    expect(screen.queryByText('loading')).not.toBeNull();
    expect(screen.queryByText('content')).toBeNull();
  });

  it('renders children when tickIndex >= 0', () => {
    render(
      <EngineStateContext.Provider value={makeState(0)}>
        <EngineGate placeholder={<div>loading</div>}>
          <div>content</div>
        </EngineGate>
      </EngineStateContext.Provider>,
    );
    expect(screen.queryByText('content')).not.toBeNull();
    expect(screen.queryByText('loading')).toBeNull();
  });
});
