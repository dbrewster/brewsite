// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { HudItem } from '../HudItem';
import type { HudItemResolved } from '../types';

const item = (overrides?: Partial<HudItemResolved>): HudItemResolved => ({
  id: 'test-item',
  node: <span>Hello</span>,
  ...overrides,
});

describe('HudItem', () => {
  it('renders a div with data-hud-id', () => {
    const { container } = render(<HudItem item={item()} />);
    const div = container.querySelector('[data-hud-id="test-item"]');
    expect(div).not.toBeNull();
  });

  it('renders the node content', () => {
    const { getByText } = render(<HudItem item={item({ node: <span>World</span> })} />);
    expect(getByText('World')).toBeDefined();
  });

  it('applies className when provided', () => {
    const { container } = render(<HudItem item={item({ className: 'my-hud' })} />);
    const div = container.querySelector('[data-hud-id="test-item"]');
    expect(div?.classList.contains('my-hud')).toBe(true);
  });

  it('applies inline style when provided', () => {
    const { container } = render(
      <HudItem item={item({ style: { top: '50px' } })} />,
    );
    const div = container.querySelector('[data-hud-id="test-item"]') as HTMLElement | null;
    expect(div?.style.top).toBe('50px');
  });

  it('returns null when enabled is false', () => {
    const { container } = render(<HudItem item={item({ enabled: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when enabled is true', () => {
    const { container } = render(<HudItem item={item({ enabled: true })} />);
    expect(container.querySelector('[data-hud-id="test-item"]')).not.toBeNull();
  });

  it('renders when enabled is undefined (default on)', () => {
    const { container } = render(<HudItem item={item({ enabled: undefined })} />);
    expect(container.querySelector('[data-hud-id="test-item"]')).not.toBeNull();
  });
});
