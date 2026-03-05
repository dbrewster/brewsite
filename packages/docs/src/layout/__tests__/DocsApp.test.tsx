import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { DocsApp } from '../DocsApp';
import { defineDocsNav } from '../../nav/defineDocsNav';

// Controllable IntersectionObserver mock — recreated in beforeEach so
// vi.clearAllMocks() between tests does not clear the mockImplementation.
let capturedCallbacks: IntersectionObserverCallback[] = [];
let mockObserve: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;

beforeEach(() => {
  capturedCallbacks = [];
  mockObserve = vi.fn();
  mockDisconnect = vi.fn();

  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn().mockImplementation((callback: IntersectionObserverCallback) => {
      capturedCallbacks.push(callback);
      return { observe: mockObserve, disconnect: mockDisconnect };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const { docsNav } = defineDocsNav([
  { title: 'Getting Started', sections: [
    { id: 'installation', label: 'Installation' },
    { id: 'quick-start',  label: 'Quick Start' },
  ]},
] as const);

describe('DocsApp', () => {
  it('renders sidebar group title from nav manifest', () => {
    const { getByText } = render(<DocsApp nav={docsNav}><div /></DocsApp>);
    expect(getByText('Getting Started')).not.toBeNull();
  });

  it('renders sidebar section labels from nav manifest', () => {
    const { getAllByText } = render(<DocsApp nav={docsNav}><div /></DocsApp>);
    expect(getAllByText('Installation').length).toBeGreaterThan(0);
    expect(getAllByText('Quick Start').length).toBeGreaterThan(0);
  });

  it('renders children inside the scroll region', () => {
    const { getByTestId } = render(
      <DocsApp nav={docsNav}><div data-testid="child">content</div></DocsApp>
    );
    expect(getByTestId('child')).not.toBeNull();
  });

  it('marks the active section button with aria-current="page" when IntersectionObserver fires', () => {
    const { container } = render(
      <DocsApp nav={docsNav}>
        <div data-section-id="installation" />
        <div data-section-id="quick-start" />
      </DocsApp>
    );

    // Fire the IntersectionObserver callback with 'installation' as the intersecting entry.
    // DocsApp registers one observer; capturedCallbacks[0] is that observer's callback.
    expect(capturedCallbacks.length).toBeGreaterThan(0);
    const callback = capturedCallbacks[0]!;

    act(() => {
      callback(
        [{ isIntersecting: true, target: { getAttribute: () => 'installation' } }] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    });

    // The 'Installation' button should now have aria-current="page".
    const installBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Installation'
    );
    expect(installBtn?.getAttribute('aria-current')).toBe('page');

    // The 'Quick Start' button should NOT have aria-current.
    const quickStartBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Quick Start'
    );
    expect(quickStartBtn?.getAttribute('aria-current')).toBeNull();
  });

  it('constructs IntersectionObserver with root: null', () => {
    render(<DocsApp nav={docsNav}><div /></DocsApp>);
    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ root: null }),
    );
  });

  it('does not render a div with overflow-y: auto as the content column', () => {
    const { container } = render(<DocsApp nav={docsNav}><div>content</div></DocsApp>);
    const allDivs = Array.from(container.querySelectorAll('div'));
    const overflowDivs = allDivs.filter(
      (d) => d.style.overflowY === 'auto' || d.style.overflowY === 'scroll',
    );
    expect(overflowDivs).toHaveLength(0);
  });
});
