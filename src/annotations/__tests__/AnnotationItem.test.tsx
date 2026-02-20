// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { AnnotationItem } from '../AnnotationItem';
import { AnnotationPositionerContext } from '../../player/AnnotationPositionerContext';
import { ContentSlotContext } from '../../player/ContentSlotContext';
import type { AnnotationResolved } from '../annotationTypes';

class TrackingPositioner {
  calls: Array<{ id: string; el: HTMLElement | null }> = [];
  registerElement(id: string, el: HTMLElement | null): void {
    this.calls.push({ id, el });
  }
  setContainerSize(): void {}
}

describe('AnnotationItem', () => {
  it('renders label text and resolves slot content', () => {
    const positioner = new TrackingPositioner();
    const annotation: AnnotationResolved = {
      id: 'a1',
      label: 'Fallback',
      enabled: true,
      placement: { mode: 'fixed', reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } },
      style: { color: '#fff' },
      content: { contentId: 'slot-1' },
    };

    const { getByLabelText, getByText, unmount } = render(
      <AnnotationPositionerContext.Provider value={positioner as never}>
        <ContentSlotContext.Provider value={{ 'slot-1': <span>Slot</span> }}>
          <AnnotationItem annotation={annotation} />
        </ContentSlotContext.Provider>
      </AnnotationPositionerContext.Provider>,
    );

    const div = getByLabelText('Fallback') as HTMLDivElement;
    expect(div.style.color).toBe('rgb(255, 255, 255)');
    expect(getByText('Slot')).toBeDefined();

    unmount();
    expect(positioner.calls.length).toBeGreaterThan(0);
  });

  it('uses inline node content when provided', () => {
    const positioner = new TrackingPositioner();
    const annotation: AnnotationResolved = {
      id: 'a2',
      label: 'Ignored',
      enabled: true,
      placement: { mode: 'fixed', reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } },
      style: {},
      content: { node: <strong>Inline</strong> },
    };

    const { getByText } = render(
      <AnnotationPositionerContext.Provider value={positioner as never}>
        <ContentSlotContext.Provider value={{}}>
          <AnnotationItem annotation={annotation} />
        </ContentSlotContext.Provider>
      </AnnotationPositionerContext.Provider>,
    );
    expect(getByText('Inline')).toBeDefined();
  });
});
