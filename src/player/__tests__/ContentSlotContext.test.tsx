// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { ContentSlotContext, useContentSlot } from '../ContentSlotContext';

describe('ContentSlotContext', () => {
  it('resolves slot content by id', () => {
    const { result } = renderHook(() => useContentSlot('hero'), {
      wrapper: ({ children }) => (
        <ContentSlotContext.Provider value={{ hero: 'Hello' }}>
          {children}
        </ContentSlotContext.Provider>
      ),
    });
    expect(result.current).toBe('Hello');
  });

  it('returns undefined for missing slot', () => {
    const { result } = renderHook(() => useContentSlot('missing'), {
      wrapper: ({ children }) => (
        <ContentSlotContext.Provider value={{}}>
          {children}
        </ContentSlotContext.Provider>
      ),
    });
    expect(result.current).toBeUndefined();
  });
});
