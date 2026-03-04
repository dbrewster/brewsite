// Interface-based stateful tests for ensureText — fontUrl layout option.

import { describe, it, expect } from 'vitest';
import { ensureText } from '../TextRenderer';
import type { TextWithLayout } from '../types';

/** Creates a minimal TextWithLayout double for testing. */
function makeText(overrides: Partial<TextWithLayout> = {}): TextWithLayout {
  return {
    text: '',
    color: '#ffffff',
    fontSize: 0.1,
    visible: true,
    sync: () => {},
    userData: {},
    ...overrides,
  };
}

describe('ensureText — fontUrl layout option', () => {
  it('sets text.font when fontUrl is provided and differs from current font', () => {
    const text = makeText();
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, {
      fontUrl: 'https://cdn.example.com/inter-msdf.ttf',
    });
    expect(text.font).toBe('https://cdn.example.com/inter-msdf.ttf');
  });

  it('does not set text.font when fontUrl is absent', () => {
    const text = makeText();
    ensureText(text, 'Hello', '#ffffff', 0.2, 1);
    expect(text.font).toBeUndefined();
  });

  it('does not change text.font when fontUrl is undefined in layout', () => {
    const text = makeText({ font: 'https://cdn.example.com/existing-msdf.ttf' });
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, {});
    expect(text.font).toBe('https://cdn.example.com/existing-msdf.ttf');
  });

  it('triggers layout sync when fontUrl changes', () => {
    let syncCount = 0;
    const text = makeText({
      sync: () => { syncCount++; },
      // First call will set font and trigger sync
    });
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, {
      fontUrl: 'https://cdn.example.com/inter-msdf.ttf',
    });
    expect(syncCount).toBeGreaterThan(0);
  });

  it('does not trigger extra sync when fontUrl is unchanged on second call', () => {
    const fontUrl = 'https://cdn.example.com/inter-msdf.ttf';
    let syncCount = 0;
    const text = makeText({ sync: () => { syncCount++; } });

    // First call — initializes all layout state including font
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, { fontUrl });
    const countAfterFirst = syncCount;

    // Second call with identical args — no layout change, no sync
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, { fontUrl });
    expect(syncCount).toBe(countAfterFirst);
  });
});
