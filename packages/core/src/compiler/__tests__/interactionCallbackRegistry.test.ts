// Tests for InteractionCallbackRegistry — register/get/has/clear with real handler functions.

import { describe, it, expect } from 'vitest';
import { InteractionCallbackRegistry } from '../interactionCallbackRegistry';
import type { CarouselSelectEvent } from '../../input/carouselSelectTypes';

describe('InteractionCallbackRegistry', () => {
  it('starts with no handlers', () => {
    const registry = new InteractionCallbackRegistry();
    expect(registry.hasAnySelectHandlers()).toBe(false);
    expect(registry.getSelectHandler('foo')).toBeUndefined();
  });

  it('registers and retrieves a handler', () => {
    const registry = new InteractionCallbackRegistry();
    const handler = (_e: CarouselSelectEvent): void => {};
    registry.registerSelectHandler('layout-1', handler);

    expect(registry.hasAnySelectHandlers()).toBe(true);
    expect(registry.getSelectHandler('layout-1')).toBe(handler);
  });

  it('returns undefined for unregistered layout', () => {
    const registry = new InteractionCallbackRegistry();
    const handler = (_e: CarouselSelectEvent): void => {};
    registry.registerSelectHandler('layout-1', handler);

    expect(registry.getSelectHandler('other-layout')).toBeUndefined();
  });

  it('overwrites handler for the same layout', () => {
    const registry = new InteractionCallbackRegistry();
    const handler1 = (_e: CarouselSelectEvent): void => {};
    const handler2 = (_e: CarouselSelectEvent): void => {};

    registry.registerSelectHandler('layout-1', handler1);
    registry.registerSelectHandler('layout-1', handler2);

    expect(registry.getSelectHandler('layout-1')).toBe(handler2);
  });

  it('supports multiple layouts', () => {
    const registry = new InteractionCallbackRegistry();
    const h1 = (_e: CarouselSelectEvent): void => {};
    const h2 = (_e: CarouselSelectEvent): void => {};

    registry.registerSelectHandler('a', h1);
    registry.registerSelectHandler('b', h2);

    expect(registry.getSelectHandler('a')).toBe(h1);
    expect(registry.getSelectHandler('b')).toBe(h2);
    expect(registry.hasAnySelectHandlers()).toBe(true);
  });

  it('clears all handlers', () => {
    const registry = new InteractionCallbackRegistry();
    registry.registerSelectHandler('a', (_e: CarouselSelectEvent): void => {});
    registry.registerSelectHandler('b', (_e: CarouselSelectEvent): void => {});

    registry.clear();

    expect(registry.hasAnySelectHandlers()).toBe(false);
    expect(registry.getSelectHandler('a')).toBeUndefined();
    expect(registry.getSelectHandler('b')).toBeUndefined();
  });
});
