// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { LabelItem } from '../LabelItem';
import { AnnotationPositionerContext } from '../../player/AnnotationPositionerContext';
import type { LabelResolved } from '../types';

class TrackingPositioner {
  calls: Array<{ id: string; el: HTMLElement | null }> = [];
  registerElement(id: string, el: HTMLElement | null): void {
    this.calls.push({ id, el });
  }
  setContainerSize(): void {}
}

describe('LabelItem', () => {
  it('renders label text with default styles', () => {
    const positioner = new TrackingPositioner();
    const label: LabelResolved = {
      id: 'l1',
      text: 'Hello',
      targetPartId: 'head',
    };

    const { getByText, unmount } = render(
      <AnnotationPositionerContext.Provider value={positioner as never}>
        <LabelItem label={label} />
      </AnnotationPositionerContext.Provider>,
    );

    const div = getByText('Hello') as HTMLDivElement;
    expect(div).toBeDefined();
    expect(div.style.color).toBe('rgb(255, 255, 255)');

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

    const { getByText } = render(
      <AnnotationPositionerContext.Provider value={positioner as never}>
        <LabelItem label={label} />
      </AnnotationPositionerContext.Provider>,
    );
    const div = getByText('Styled') as HTMLDivElement;
    expect(div.style.color).toBe('rgb(0, 255, 0)');
    expect(div.style.fontSize).toBe('20px');
    expect(div.style.opacity).toBe('0.5');
  });
});
