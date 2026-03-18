// Tests for createCarouselSelectEvent factory — pure function, real inputs/outputs.

import { describe, it, expect } from 'vitest';
import { createCarouselSelectEvent } from '../carouselSelectTypes';

describe('createCarouselSelectEvent', () => {
  it('creates an event with all fields matching construction args', () => {
    const event = createCarouselSelectEvent(
      2,
      'view-chart',
      'showcase',
      5,
      { x: 0.5, y: 0.3 },
      'pointer',
    );

    expect(event.index).toBe(2);
    expect(event.viewId).toBe('view-chart');
    expect(event.layoutId).toBe('showcase');
    expect(event.childCount).toBe(5);
    expect(event.position).toEqual({ x: 0.5, y: 0.3 });
    expect(event.source).toBe('pointer');
  });

  it('starts with defaultPrevented false', () => {
    const event = createCarouselSelectEvent(0, 'v', 'l', 1, null, 'keyboard');
    expect(event.defaultPrevented).toBe(false);
  });

  it('sets defaultPrevented to true after preventDefault()', () => {
    const event = createCarouselSelectEvent(0, 'v', 'l', 1, null, 'keyboard');
    event.preventDefault();
    expect(event.defaultPrevented).toBe(true);
  });

  it('allows multiple preventDefault() calls without error', () => {
    const event = createCarouselSelectEvent(0, 'v', 'l', 1, null, 'programmatic');
    event.preventDefault();
    event.preventDefault();
    expect(event.defaultPrevented).toBe(true);
  });

  it('sets position to null for keyboard source', () => {
    const event = createCarouselSelectEvent(1, 'v', 'l', 3, null, 'keyboard');
    expect(event.position).toBeNull();
  });

  it('preserves position for pointer source', () => {
    const event = createCarouselSelectEvent(0, 'v', 'l', 1, { x: 0.1, y: 0.9 }, 'pointer');
    expect(event.position).toEqual({ x: 0.1, y: 0.9 });
  });
});
