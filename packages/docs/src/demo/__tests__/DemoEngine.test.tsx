import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DemoCaptureContext, type DemoCaptureContextValue } from '../DemoCaptureContext';
import { DemoEngine } from '../DemoEngine';

// Mock @brewsite/core so no Three.js WebGL context is created in jsdom.
// The mock EngineProvider renders children directly; useSceneEngineContext
// returns a stub with a controllable setRawProgress.
const mockSetRawProgress = vi.fn();
vi.mock('@brewsite/core', () => {
  const React = require('react');
  return {
    EngineProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useSceneEngineContext: () => ({ setRawProgress: mockSetRawProgress }),
    InputController: () => null,
    Scene: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

function makeCaptureCtx(): DemoCaptureContextValue & {
  registerEngine: ReturnType<typeof vi.fn>;
} {
  const cleanup = vi.fn();
  return {
    registerEngine: vi.fn().mockReturnValue(cleanup),
    onWheelDelta: vi.fn(),
    getProgress: () => 0,
    scrollUnits: 2400,
    _cleanup: cleanup,
  } as unknown as DemoCaptureContextValue & { registerEngine: ReturnType<typeof vi.fn> };
}

describe('DemoEngine', () => {
  beforeEach(() => {
    mockSetRawProgress.mockClear();
  });

  it('calls registerEngine with setRawProgress on mount', () => {
    const ctx = makeCaptureCtx();
    render(
      <DemoCaptureContext.Provider value={ctx}>
        <DemoEngine manifestUrl="/scene-manifest.json">
          {/* No <Scene> children needed for this registration test */}
        </DemoEngine>
      </DemoCaptureContext.Provider>
    );
    expect(ctx.registerEngine).toHaveBeenCalledTimes(1);
    expect(ctx.registerEngine).toHaveBeenCalledWith(mockSetRawProgress);
  });

  it('calls cleanup returned by registerEngine on unmount', () => {
    const ctx = makeCaptureCtx();
    const cleanup = (ctx as unknown as { _cleanup: ReturnType<typeof vi.fn> })._cleanup;
    const { unmount } = render(
      <DemoCaptureContext.Provider value={ctx}>
        <DemoEngine manifestUrl="/scene-manifest.json" />
      </DemoCaptureContext.Provider>
    );
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not call registerEngine when rendered outside DemoCaptureContext', () => {
    const ctx = makeCaptureCtx();
    // No DemoCaptureContext.Provider — context value is null.
    render(<DemoEngine manifestUrl="/scene-manifest.json" />);
    expect(ctx.registerEngine).not.toHaveBeenCalled();
  });
});
