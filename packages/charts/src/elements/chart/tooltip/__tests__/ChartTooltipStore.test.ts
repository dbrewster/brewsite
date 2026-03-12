// ChartTooltipStore unit tests — subscribe/publish/clear, multi-chart isolation,
// runtime config lifecycle, host registration.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChartTooltipStoreImpl } from '../ChartTooltipStore';
import type { ChartHitInfo } from '../../../../renderers/shared/IChartRenderer';

function makeHitInfo(overrides: Partial<ChartHitInfo> = {}): ChartHitInfo {
  return {
    seriesIndex: 0,
    datumIndex: 0,
    row: { month: 'Jan', value: 100 },
    point: [0, 0.5, 0],
    ...overrides,
  };
}

describe('ChartTooltipStore', () => {
  let store: ChartTooltipStoreImpl;

  beforeEach(() => {
    store = new ChartTooltipStoreImpl();
  });

  it('getSnapshot() returns null initially', () => {
    expect(store.getSnapshot()).toBeNull();
  });

  it('publish() updates snapshot and notifies subscribers', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    const info = makeHitInfo();
    store.publish('chart-a', 100, 200, info, null);

    expect(store.getSnapshot()).toMatchObject({
      widgetId: 'chart-a',
      x: 100,
      y: 200,
      info,
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('clear() removes state for matching widgetId', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.publish('chart-a', 50, 60, makeHitInfo(), null);
    store.clear('chart-a');

    expect(store.getSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2); // once for publish, once for clear
  });

  it('clear() is a no-op when widgetId does not match active entry', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.publish('chart-a', 50, 60, makeHitInfo(), null);
    listener.mockClear();

    store.clear('chart-b'); // different chart
    expect(store.getSnapshot()?.widgetId).toBe('chart-a');
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe() returns an unsubscribe function that stops notifications', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.publish('chart-a', 10, 20, makeHitInfo(), null);
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    store.publish('chart-a', 30, 40, makeHitInfo(), null);
    expect(listener).toHaveBeenCalledOnce(); // not called again
  });

  it('most-recent publish wins (only one active tooltip at a time)', () => {
    store.publish('chart-a', 10, 20, makeHitInfo(), null);
    store.publish('chart-b', 30, 40, makeHitInfo(), null);

    expect(store.getSnapshot()?.widgetId).toBe('chart-b');
  });

  it('publish() stores tooltipTokens and format on the entry', () => {
    const info = makeHitInfo();
    store.publish('chart-a', 10, 20, info, null, '.2f');

    const snap = store.getSnapshot();
    expect(snap?.tooltipTokens).toBeNull();
    expect(snap?.format).toBe('.2f');
  });

  it('setRuntimeConfig / getRuntimeConfig / clearRuntimeConfig lifecycle', () => {
    const renderContent = vi.fn();
    store.setRuntimeConfig('chart-a', { renderContent });

    expect(store.getRuntimeConfig('chart-a')?.renderContent).toBe(renderContent);

    store.clearRuntimeConfig('chart-a');
    expect(store.getRuntimeConfig('chart-a')).toBeUndefined();
  });

  it('multiple charts have independent runtime configs', () => {
    const rcA = vi.fn();
    const rcB = vi.fn();
    store.setRuntimeConfig('a', { renderContent: rcA });
    store.setRuntimeConfig('b', { renderContent: rcB });

    expect(store.getRuntimeConfig('a')?.renderContent).toBe(rcA);
    expect(store.getRuntimeConfig('b')?.renderContent).toBe(rcB);

    store.clearRuntimeConfig('a');
    expect(store.getRuntimeConfig('a')).toBeUndefined();
    expect(store.getRuntimeConfig('b')?.renderContent).toBe(rcB);
  });

  it('registerHost() returns cleanup and tracks host count for warning suppression', () => {
    const cleanup = store.registerHost();
    expect((store as unknown as { hostCount: number }).hostCount).toBe(1);
    cleanup();
    expect((store as unknown as { hostCount: number }).hostCount).toBe(0);
  });

  it('multiple hosts increment and decrement correctly', () => {
    const cleanupA = store.registerHost();
    const cleanupB = store.registerHost();
    expect((store as unknown as { hostCount: number }).hostCount).toBe(2);
    cleanupA();
    expect((store as unknown as { hostCount: number }).hostCount).toBe(1);
    cleanupB();
    expect((store as unknown as { hostCount: number }).hostCount).toBe(0);
  });
});
