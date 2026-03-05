import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { DocsDemo } from '../DocsDemo';

// jsdom does not implement IntersectionObserver — provide a mock.
// Mocks are created fresh in beforeEach because vi.restoreAllMocks() in afterEach
// resets vi.fn() implementations; recreating avoids stale-implementation failures.
let mockObserve: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockObserve = vi.fn();
  mockDisconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn().mockImplementation(() => ({
      observe: mockObserve,
      disconnect: mockDisconnect,
    })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DocsDemo', () => {
  it('renders placeholder (not children) before mount trigger', () => {
    const { queryByTestId } = render(
      <DocsDemo scrollUnits={2400} height={480}>
        <div data-testid="demo-content">Demo Content</div>
      </DocsDemo>
    );
    // Before IntersectionObserver fires, content should not be mounted.
    expect(queryByTestId('demo-content')).toBeNull();
  });

  it('placeholder div has the same height as the mounted container (number)', () => {
    const { container } = render(
      <DocsDemo scrollUnits={2400} height={480}><div>content</div></DocsDemo>
    );
    const placeholder = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(placeholder?.style.height).toBe('480px');
  });

  it('placeholder div has the same height as the mounted container (string)', () => {
    const { container } = render(
      <DocsDemo scrollUnits={2400} height="100vh"><div>content</div></DocsDemo>
    );
    const placeholder = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(placeholder?.style.height).toBe('100vh');
  });
});
