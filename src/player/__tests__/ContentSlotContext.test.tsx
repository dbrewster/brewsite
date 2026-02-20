import { describe, it, expect } from 'vitest';
import renderer, { act } from 'react-test-renderer';
import { ContentSlotContext, useContentSlot } from '../ContentSlotContext';

describe('ContentSlotContext', () => {
  it('resolves slot content by id', () => {
    let resolved: unknown;
    const Test = () => {
      resolved = useContentSlot('hero');
      return null;
    };

    act(() => {
      renderer.create(
        <ContentSlotContext.Provider value={{ hero: 'Hello' }}>
          <Test />
        </ContentSlotContext.Provider>,
      );
    });

    expect(resolved).toBe('Hello');
  });

  it('returns undefined for missing slot', () => {
    let resolved: unknown = 'init';
    const Test = () => {
      resolved = useContentSlot('missing');
      return null;
    };

    act(() => {
      renderer.create(
        <ContentSlotContext.Provider value={{}}>
          <Test />
        </ContentSlotContext.Provider>,
      );
    });

    expect(resolved).toBeUndefined();
  });
});
