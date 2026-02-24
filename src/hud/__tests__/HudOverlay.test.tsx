// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { HudOverlay } from '../HudOverlay';
import type { HudItemResolved } from '../types';

const makeItem = (id: string): HudItemResolved => ({
  id,
  node: <span>{id}</span>,
});

describe('HudOverlay', () => {
  it('renders nothing for empty items array', () => {
    const { container } = render(<HudOverlay items={[]} />);
    expect(container.querySelectorAll('[data-hud-id]').length).toBe(0);
  });

  it('renders one HudItem per entry', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')];
    const { container } = render(<HudOverlay items={items} />);
    expect(container.querySelectorAll('[data-hud-id]').length).toBe(3);
  });

  it('uses item id as data-hud-id', () => {
    const items = [makeItem('my-id')];
    const { container } = render(<HudOverlay items={items} />);
    expect(container.querySelector('[data-hud-id="my-id"]')).not.toBeNull();
  });

  it('does not render disabled items', () => {
    const items: HudItemResolved[] = [
      { id: 'visible', node: <span />, enabled: true },
      { id: 'hidden', node: <span />, enabled: false },
    ];
    const { container } = render(<HudOverlay items={items} />);
    expect(container.querySelector('[data-hud-id="visible"]')).not.toBeNull();
    expect(container.querySelector('[data-hud-id="hidden"]')).toBeNull();
  });
});
