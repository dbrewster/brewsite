// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { useEngineInput } from '../useEngineInput';

type HookResult = ReturnType<typeof useEngineInput>;

const renderHook = (options: Parameters<typeof useEngineInput>[0]) => {
  let result: HookResult | null = null;

  const Test = () => {
    result = useEngineInput(options);
    return <div />;
  };

  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(<Test />);
  });
  return { getResult: () => result!, unmount: () => root.unmount() };
};

describe('useEngineInput', () => {
  it('supports keyboard navigation in controlled mode when enabled', () => {
    const onControlledProgressChange = vi.fn();
    const scrollRegionRef = { current: document.createElement('div') } as React.RefObject<HTMLElement | null>;
    const canvasRef = { current: document.createElement('div') } as React.RefObject<HTMLElement | null>;

    const { unmount } = renderHook({
      scrollRegionRef,
      scrollRegionHeightPx: 1000,
      sceneCount: 3,
      inputMode: 'direct',
      canvasRef,
      controlledProgress: 0.2,
      onControlledProgressChange,
      enableKeyboardInControlledMode: true,
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });

    expect(onControlledProgressChange).toHaveBeenCalledWith(0.7);
    unmount();
  });

  it('does not attach keyboard navigation in controlled mode when disabled', () => {
    const onControlledProgressChange = vi.fn();
    const scrollRegionRef = { current: document.createElement('div') } as React.RefObject<HTMLElement | null>;
    const canvasRef = { current: document.createElement('div') } as React.RefObject<HTMLElement | null>;

    const { unmount } = renderHook({
      scrollRegionRef,
      scrollRegionHeightPx: 1000,
      sceneCount: 3,
      inputMode: 'direct',
      canvasRef,
      controlledProgress: 0.2,
      onControlledProgressChange,
      enableKeyboardInControlledMode: false,
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });

    expect(onControlledProgressChange).not.toHaveBeenCalled();
    unmount();
  });
});
