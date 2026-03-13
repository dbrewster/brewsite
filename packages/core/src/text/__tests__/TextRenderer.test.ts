// Interface-based stateful tests for ensureText — shrink-to-fit, fontUrl, and sdfGlyphSize.

import { describe, it, expect } from 'vitest';
import { ensureText } from '../TextRenderer';
import type { TextWithLayout } from '../types';

/** Typed access to ensureText's private userData state for test assertions. */
type FitUserData = {
  baseFontSize?: number;
  maxWidth?: number;
  shrinkToFit?: boolean;
  fitScale?: number;
  needsFit?: boolean;
  fitRatio?: number;
};

/** Creates a minimal TextWithLayout double for testing. */
function makeText(overrides: Partial<TextWithLayout> = {}): TextWithLayout {
  return {
    text: '',
    color: '#ffffff',
    fontSize: 0.1,
    visible: true,
    sync: () => {},
    dispose: () => {},
    userData: {},
    ...overrides,
  };
}

/**
 * Simulates troika completing an async sync by populating textRenderInfo
 * with blockBounds derived from the current text content and fontSize.
 * Uses a simple heuristic: width ≈ text.length × fontSize × 0.6.
 */
function simulateTroikaSync(text: TextWithLayout): void {
  const charWidth = text.fontSize * 0.6;
  const totalWidth = text.text.length * charWidth;
  const height = text.fontSize * 1.1;
  text.textRenderInfo = {
    blockBounds: [0, -height / 2, totalWidth, height / 2],
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

describe('ensureText — sdfGlyphSize layout option', () => {
  it('sets text.sdfGlyphSize when sdfGlyphSize is provided and differs from current value', () => {
    const text = makeText();
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, { sdfGlyphSize: 32 });
    expect(text.sdfGlyphSize).toBe(32);
  });

  it('does not set text.sdfGlyphSize when sdfGlyphSize is absent', () => {
    const text = makeText();
    ensureText(text, 'Hello', '#ffffff', 0.2, 1);
    expect(text.sdfGlyphSize).toBeUndefined();
  });

  it('does not change text.sdfGlyphSize when sdfGlyphSize is undefined in layout', () => {
    const text = makeText({ sdfGlyphSize: 64 });
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, {});
    expect(text.sdfGlyphSize).toBe(64);
  });

  it('triggers layout sync when sdfGlyphSize changes', () => {
    let syncCount = 0;
    const text = makeText({ sync: () => { syncCount++; } });
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, { sdfGlyphSize: 32 });
    expect(syncCount).toBeGreaterThan(0);
  });

  it('does not trigger extra sync when sdfGlyphSize is unchanged on second call', () => {
    let syncCount = 0;
    const text = makeText({ sync: () => { syncCount++; } });

    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, { sdfGlyphSize: 32 });
    const countAfterFirst = syncCount;

    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, { sdfGlyphSize: 32 });
    expect(syncCount).toBe(countAfterFirst);
  });

  it('triggers sync when sdfGlyphSize transitions from 64 to 32', () => {
    let syncCount = 0;
    const text = makeText({ sdfGlyphSize: 64, sync: () => { syncCount++; } });

    // Seed state: text has sdfGlyphSize=64 with a stable layout
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, { sdfGlyphSize: 64 });
    const countAfterFirst = syncCount;

    // Change to 32 — must trigger a sync
    ensureText(text, 'Hello', '#ffffff', 0.2, 1, undefined, false, { sdfGlyphSize: 32 });
    expect(syncCount).toBeGreaterThan(countAfterFirst);
    expect(text.sdfGlyphSize).toBe(32);
  });
});

describe('ensureText — shrink-to-fit re-measurement on text content change', () => {
  const baseFontSize = 1.0;
  const maxWidth = 3.0;

  it('hides text until fit is computed on first call with shrinkToFit', () => {
    const text = makeText();
    ensureText(text, 'Hello', '#ffffff', baseFontSize, 1, maxWidth, true);

    // Text should be hidden while waiting for troika to measure
    const ud = text.userData as FitUserData;
    expect(ud.needsFit).toBe(true);
    expect(ud.fitScale).toBeUndefined();
    expect(text.visible).toBe(false);
  });

  it('computes fitScale and reveals text once troika sync completes', () => {
    const text = makeText();

    // Frame 1: initial call — triggers sync, text hidden
    ensureText(text, 'Hello', '#ffffff', baseFontSize, 1, maxWidth, true);
    expect(text.visible).toBe(false);

    // Simulate troika completing the async sync
    simulateTroikaSync(text);

    // Frame 2: same params — layoutChanged=false but needsFit=true, picks up bounds
    ensureText(text, 'Hello', '#ffffff', baseFontSize, 1, maxWidth, true);
    const ud = text.userData as FitUserData;
    expect(ud.fitScale).toBeDefined();
    expect(ud.needsFit).toBe(false);
  });

  it('resets fitScale and re-measures when text content changes', () => {
    const text = makeText();

    // Frame 1: short text — fits within maxWidth, fitScale should be 1
    ensureText(text, 'Hi', '#ffffff', baseFontSize, 1, maxWidth, true);
    simulateTroikaSync(text);
    ensureText(text, 'Hi', '#ffffff', baseFontSize, 1, maxWidth, true);
    const ud = text.userData as FitUserData;
    expect(ud.fitScale).toBe(1); // 'Hi' easily fits

    // Frame 2: change to much longer text — must re-measure
    ensureText(text, 'A Much Longer Label That Should Shrink', '#ffffff', baseFontSize, 1, maxWidth, true);

    // fitScale should be reset to undefined (stale for old text)
    expect(ud.fitScale).toBeUndefined();
    // needsFit should be true — triggers re-measurement
    expect(ud.needsFit).toBe(true);
    // Text should be hidden during re-measurement
    expect(text.visible).toBe(false);
  });

  it('correctly shrinks long text after re-measurement', () => {
    const text = makeText();

    // Establish fit for short text
    ensureText(text, 'Hi', '#ffffff', baseFontSize, 1, maxWidth, true);
    simulateTroikaSync(text);
    ensureText(text, 'Hi', '#ffffff', baseFontSize, 1, maxWidth, true);

    // Switch to long text — triggers re-measurement
    ensureText(text, 'A Much Longer Label That Should Shrink', '#ffffff', baseFontSize, 1, maxWidth, true);
    // Simulate troika measuring the NEW text content
    simulateTroikaSync(text);

    // Frame N: picks up new bounds and computes fitScale (visibility set BEFORE bounds check)
    ensureText(text, 'A Much Longer Label That Should Shrink', '#ffffff', baseFontSize, 1, maxWidth, true);
    const ud = text.userData as FitUserData;
    expect(ud.fitScale).toBeDefined();
    expect(ud.fitScale).toBeLessThan(1); // long text must shrink
    expect(ud.needsFit).toBe(false);

    // Frame N+1: fitScale is now defined → hideUntilFit=false → text revealed
    ensureText(text, 'A Much Longer Label That Should Shrink', '#ffffff', baseFontSize, 1, maxWidth, true);
    expect(text.visible).toBe(true);
    expect(text.fontSize).toBeLessThan(baseFontSize);
  });

  it('re-measures when switching from long text to short text', () => {
    const text = makeText();

    // Establish fit for long text — should be shrunk
    ensureText(text, 'A Very Long Label', '#ffffff', baseFontSize, 1, maxWidth, true);
    simulateTroikaSync(text);
    ensureText(text, 'A Very Long Label', '#ffffff', baseFontSize, 1, maxWidth, true);
    const ud = text.userData as FitUserData;
    const longScale = ud.fitScale;
    expect(longScale).toBeDefined();
    expect(longScale!).toBeLessThan(1);

    // Switch to short text — should re-measure and get scale=1
    ensureText(text, 'OK', '#ffffff', baseFontSize, 1, maxWidth, true);
    expect(ud.fitScale).toBeUndefined(); // reset for re-measurement
    simulateTroikaSync(text);
    ensureText(text, 'OK', '#ffffff', baseFontSize, 1, maxWidth, true);
    expect(ud.fitScale).toBe(1); // short text fits without shrinking
  });

  it('does not reset fitScale when text content is unchanged', () => {
    const text = makeText();

    // Establish stable fit
    ensureText(text, 'Hello World', '#ffffff', baseFontSize, 1, maxWidth, true);
    simulateTroikaSync(text);
    ensureText(text, 'Hello World', '#ffffff', baseFontSize, 1, maxWidth, true);
    const ud = text.userData as FitUserData;
    const stableScale = ud.fitScale;

    // Call again with same text — fitScale must not change
    ensureText(text, 'Hello World', '#ffffff', baseFontSize, 1, maxWidth, true);
    expect(ud.fitScale).toBe(stableScale);
    expect(ud.needsFit).toBe(false);
  });

  it('fontSize is set to baseFontSize when fitScale is reset for re-measurement', () => {
    const text = makeText();

    // Establish a small fitScale for long text
    ensureText(text, 'Extremely Long Label That Must Be Very Small', '#ffffff', baseFontSize, 1, maxWidth, true);
    simulateTroikaSync(text);
    ensureText(text, 'Extremely Long Label That Must Be Very Small', '#ffffff', baseFontSize, 1, maxWidth, true);
    const smallSize = text.fontSize;
    expect(smallSize).toBeLessThan(baseFontSize);

    // Change text — fontSize should reset to baseFontSize for fresh measurement
    ensureText(text, 'New', '#ffffff', baseFontSize, 1, maxWidth, true);
    expect(text.fontSize).toBe(baseFontSize);
  });

  it('resets fitScale when fontUrl changes (font metric invalidation)', () => {
    const text = makeText();

    // Establish fit with default font
    ensureText(text, 'Hello World', '#ffffff', baseFontSize, 1, maxWidth, true);
    simulateTroikaSync(text);
    ensureText(text, 'Hello World', '#ffffff', baseFontSize, 1, maxWidth, true);
    const ud = text.userData as FitUserData;
    expect(ud.fitScale).toBeDefined();

    // Change fontUrl — fitScale must be invalidated because different fonts
    // produce different glyph widths at the same fontSize
    ensureText(text, 'Hello World', '#ffffff', baseFontSize, 1, maxWidth, true, {
      fontUrl: 'https://cdn.example.com/custom-msdf.ttf',
    });
    expect(ud.fitScale).toBeUndefined();
    expect(ud.needsFit).toBe(true);
    // Text hidden during re-measurement
    expect(text.visible).toBe(false);
  });
});
