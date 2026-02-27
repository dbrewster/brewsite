// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { UseSceneEngineResult } from '../useSceneEngine';
import { TimelineWidget } from '../TimelineWidget';

const makeEngineDouble = (overrides?: Partial<UseSceneEngineResult>): UseSceneEngineResult => ({
  frameState: {
    tickIndex: 0,
    progress: overrides?.progress ?? 0,
    sceneId: 's1',
    sceneIndex: 0,
    sceneProgress: 0,
    tick: null,
  },
  scrollRegionRef: { current: null },
  scrollRegionHeightPx: 100,
  progress: overrides?.progress ?? 0,
  scrollToProgress: overrides?.scrollToProgress ?? (() => {}),
  getGlobalProgress: overrides?.getGlobalProgress ?? (() => overrides?.progress ?? 0),
  sceneCount: overrides?.sceneCount ?? 3,
  variableStore: overrides?.variableStore as UseSceneEngineResult['variableStore'],
  setCanvasRef: () => {},
  setBackgroundRef: () => {},
  setViewportSize: () => {},
  getCamera: () => null,
  getRenderer: () => null,
  setCameraOverride: () => {},
  getCameraOverride: () => null,
  debug: { driverReady: true, assetsReady: true, sceneTrackTicks: 5, viewport: { width: 100, height: 100 } },
});

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
});

describe('TimelineWidget', () => {
  it('renders at the correct progress position', () => {
    const engineDouble = makeEngineDouble({ progress: 0.5 });
    render(<TimelineWidget engine={engineDouble} />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });

  it('calls scrollToProgress when scrubbing', () => {
    const scrollToProgress = vi.fn();
    const engineDouble = makeEngineDouble({ progress: 0.1, scrollToProgress });
    render(<TimelineWidget engine={engineDouble} />);
    const slider = screen.getByRole('slider');

    slider.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 20,
      right: 100,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);

    fireEvent.pointerDown(slider, { clientX: 50, clientY: 10, pointerId: 1 });
    expect(scrollToProgress).toHaveBeenCalled();
  });

  it('renders scene labels for each provided scene', () => {
    const engineDouble = makeEngineDouble({ progress: 0.2, sceneCount: 2 });
    render(
      <TimelineWidget
        engine={engineDouble}
        scenes={[{ id: 'scene-a' }, { id: 'scene-b' }]}
      />,
    );
    expect(screen.getByText('scene-a')).toBeTruthy();
    expect(screen.getByText('scene-b')).toBeTruthy();
  });

  it('applies dark theme colors', () => {
    const engineDouble = makeEngineDouble({ progress: 0.2 });
    const { container } = render(<TimelineWidget engine={engineDouble} theme="dark" />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.background.replace(/\s+/g, '')).toBe('rgba(0,0,0,0.35)');
  });

  it('respects scrubEnabled=false', () => {
    const scrollToProgress = vi.fn();
    const engineDouble = makeEngineDouble({ progress: 0.1, scrollToProgress });
    render(<TimelineWidget engine={engineDouble} scrubEnabled={false} />);
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, { clientX: 50, clientY: 10, pointerId: 1 });
    expect(scrollToProgress).not.toHaveBeenCalled();
  });
});
