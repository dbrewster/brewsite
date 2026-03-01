// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, within } from '@testing-library/react';
import { LabelItem } from '../LabelItem';
import { LabelPositionerContext } from '../../player/LabelPositionerContext';
import type { LabelResolved } from '../types';

class TrackingPositioner {
  calls: Array<{ id: string; el: HTMLElement | null }> = [];
  registerElement(id: string, el: HTMLElement | null): void {
    this.calls.push({ id, el });
  }
  setContainerSize(): void {}
}

describe('LabelItem', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders label text with default styles', () => {
    const positioner = new TrackingPositioner();
    const label: LabelResolved = {
      id: 'l1',
      text: 'Hello',
      targetPartId: 'head',
    };

    const container = document.createElement('div');
    const { unmount } = render(
      <LabelPositionerContext.Provider value={positioner as never}>
        <LabelItem label={label} />
      </LabelPositionerContext.Provider>,
      { container },
    );

    const div = within(container).getByText('Hello') as HTMLDivElement;
    expect(div).toBeDefined();
    expect(div.style.color).toBe('var(--label-color, #ffffff)');

    unmount();
    expect(positioner.calls.length).toBeGreaterThan(0);
  });

  it('applies custom styles when provided', () => {
    const positioner = new TrackingPositioner();
    const label: LabelResolved = {
      id: 'l2',
      text: 'Styled',
      targetPartId: 'head',
      style: { color: '#00ff00', fontSize: 20, labelOpacity: 0.5 },
    };

    const container = document.createElement('div');
    render(
      <LabelPositionerContext.Provider value={positioner as never}>
        <LabelItem label={label} />
      </LabelPositionerContext.Provider>,
      { container },
    );
    const div = within(container).getByText('Styled') as HTMLDivElement;
    expect(div.style.color).toBe('var(--label-color, #00ff00)');
    expect(div.style.fontSize).toBe('20px');
    expect(div.style.opacity).toBe('0.5');
  });
});
