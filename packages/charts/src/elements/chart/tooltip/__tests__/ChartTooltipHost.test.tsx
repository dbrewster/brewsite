// @vitest-environment jsdom
// ChartTooltipHost unit tests — renders tooltip, edge-flip, null state.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import React from 'react';
import { ChartTooltipHost } from '../ChartTooltipHost';
import { ChartTooltipStoreImpl } from '../ChartTooltipStore';
import type { ChartHitInfo } from '../../../../renderers/shared/IChartRenderer';

function makeHitInfo(): ChartHitInfo {
  return {
    seriesIndex: 0,
    datumIndex: 0,
    row: { month: 'Jan', value: 100 },
    point: [0, 0.5, 0],
    meta: { kind: 'bar', seriesLabel: 'Revenue', segmentValue: 100 },
  };
}

describe('ChartTooltipHost', () => {
  let testStore: ChartTooltipStoreImpl;

  beforeEach(() => {
    testStore = new ChartTooltipStoreImpl();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when store state is null', () => {
    const { container } = render(<ChartTooltipHost _store={testStore} />);
    // No tooltip card rendered — only the always-mounted wrapper div
    const tooltipCards = container.querySelectorAll('[style*="position: absolute"][style*="z-index"]');
    expect(tooltipCards.length).toBe(0);
  });

  it('renders tooltip card when store has active entry', async () => {
    const { rerender } = render(<ChartTooltipHost _store={testStore} />);

    act(() => {
      testStore.publish('chart-a', 100, 200, makeHitInfo(), null);
    });

    // Re-render to pick up the store change reflected in useSyncExternalStore
    rerender(<ChartTooltipHost _store={testStore} />);

    // With bar meta: seriesLabel should appear
    expect(screen.getByText('Revenue')).toBeDefined();
  });

  it('renders custom renderContent when registered', () => {
    testStore.setRuntimeConfig('chart-a', {
      renderContent: () => <div>Custom Content</div>,
    });

    act(() => {
      testStore.publish('chart-a', 100, 200, makeHitInfo(), null);
    });

    render(<ChartTooltipHost _store={testStore} />);
    expect(screen.getByText('Custom Content')).toBeDefined();
  });

  it('host registers and deregisters with store on mount/unmount', () => {
    const { unmount } = render(<ChartTooltipHost _store={testStore} />);
    expect((testStore as unknown as { hostCount: number }).hostCount).toBe(1);
    unmount();
    expect((testStore as unknown as { hostCount: number }).hostCount).toBe(0);
  });

  it('renders default bar content with series label and value', () => {
    act(() => {
      testStore.publish('chart-a', 100, 200, makeHitInfo(), null);
    });

    render(<ChartTooltipHost _store={testStore} />);

    expect(screen.getByText('Revenue')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
  });

  it('renders nothing for null entry after clear', () => {
    act(() => {
      testStore.publish('chart-a', 100, 200, makeHitInfo(), null);
    });

    const { rerender } = render(<ChartTooltipHost _store={testStore} />);

    act(() => {
      testStore.clear('chart-a');
    });

    rerender(<ChartTooltipHost _store={testStore} />);

    expect(screen.queryByText('Revenue')).toBeNull();
  });

  it('renders a positioned tooltip card when store has an active entry', () => {
    act(() => {
      testStore.publish('chart-a', 50, 50, makeHitInfo(), null);
    });

    const { container } = render(<ChartTooltipHost _store={testStore} />);

    // Tooltip card must be present with absolute positioning and high z-index
    const cards = container.querySelectorAll<HTMLElement>('div[style]');
    const card = Array.from(cards).find(el => el.style.position === 'absolute' && el.style.zIndex === '9999');
    expect(card).toBeDefined();
    // Card must have numeric left/top values (exact values depend on container dimensions)
    expect(card?.style.left).toBeTruthy();
    expect(card?.style.top).toBeTruthy();
  });
});
