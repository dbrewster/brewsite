import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DocsDemo } from '../DocsDemo';

describe('DocsDemo', () => {
  it('renders children immediately without IntersectionObserver trigger', () => {
    const { getByTestId } = render(
      <DocsDemo height={480}>
        <div data-testid="demo-content">Demo Content</div>
      </DocsDemo>
    );
    expect(getByTestId('demo-content')).not.toBeNull();
  });

  it('container does not have overflow: hidden', () => {
    const { container } = render(
      <DocsDemo height={480}><div>content</div></DocsDemo>
    );
    const innerContainer = container.querySelector('[style*="height: 480px"]') as HTMLElement;
    expect(innerContainer?.style.overflow).not.toBe('hidden');
  });

  it('placeholder div has height as number', () => {
    const { container } = render(
      <DocsDemo height={480}><div>content</div></DocsDemo>
    );
    const inner = container.querySelector('[style*="height"]') as HTMLElement;
    expect(inner?.style.height).toBe('480px');
  });

  it('placeholder div has height as string', () => {
    const { container } = render(
      <DocsDemo height="100vh"><div>content</div></DocsDemo>
    );
    const inner = container.querySelector('[style*="height"]') as HTMLElement;
    expect(inner?.style.height).toBe('100vh');
  });

  it('deprecated scrollUnits prop is silently ignored', () => {
    expect(() => {
      render(<DocsDemo height={480} scrollUnits={2400}><div>content</div></DocsDemo>);
    }).not.toThrow();
  });
});
