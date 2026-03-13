// Utility for updating and disposing troika Text objects.

import type { TextWithLayout } from './types';

type TextLayoutOptions = {
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  textAlign?: 'left' | 'center' | 'right';
  overflowWrap?: 'normal' | 'break-word';
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-line' | 'pre-wrap';
  lineHeight?: number;
  /**
   * URL to an MSDF-encoded font for troika-three-text.
   * When changed, triggers a layout re-sync. When absent or undefined,
   * troika retains its current font (built-in default on first use).
   */
  fontUrl?: string;
  /**
   * SDF glyph size for the troika atlas tile (pixels per glyph).
   * When provided, sets text.sdfGlyphSize before the first sync.
   * Troika default is 64. When absent, troika's default is preserved.
   */
  sdfGlyphSize?: number;
};

export function ensureText(
  text: TextWithLayout,
  value: string,
  color: string,
  baseFontSize: number,
  opacity: number,
  maxWidth?: number,
  shrinkToFit: boolean = false,
  layout: TextLayoutOptions = {},
): void {
  const nextAnchorX = layout.anchorX ?? 'center';
  const nextAnchorY = layout.anchorY ?? 'middle';
  const nextAlign = layout.textAlign ?? 'center';
  const nextOverflow = layout.overflowWrap ?? 'normal';
  const nextWhiteSpace = layout.whiteSpace ?? 'nowrap';
  const nextLineHeight = layout.lineHeight ?? 1.1;

  const userData = text.userData as {
    baseFontSize?: number;
    maxWidth?: number;
    shrinkToFit?: boolean;
    fitScale?: number;
    needsFit?: boolean;
    fitRatio?: number;
  };

  // Capture change flags BEFORE mutation so we can detect what needs resetting.
  const textValueChanged = text.text !== value;
  const fontChanged = layout.fontUrl !== undefined && text.font !== layout.fontUrl;
  const baseChanged = userData.baseFontSize !== baseFontSize;
  const nextRatio = maxWidth !== undefined ? maxWidth / baseFontSize : undefined;
  const ratioChanged =
    nextRatio !== undefined &&
    (userData.fitRatio === undefined || Math.abs(nextRatio - userData.fitRatio) > 1e-3);
  const layoutChanged =
    textValueChanged ||
    text.color !== color ||
    text.anchorX !== nextAnchorX ||
    text.anchorY !== nextAnchorY ||
    text.textAlign !== nextAlign ||
    text.overflowWrap !== nextOverflow ||
    text.whiteSpace !== nextWhiteSpace ||
    text.lineHeight !== nextLineHeight ||
    baseChanged ||
    userData.maxWidth !== maxWidth ||
    userData.shrinkToFit !== shrinkToFit ||
    text.font !== (layout.fontUrl ?? text.font) ||  // font change triggers re-sync
    text.sdfGlyphSize !== (layout.sdfGlyphSize ?? text.sdfGlyphSize);  // glyph size change triggers re-sync

  // When text content or font changes and shrink-to-fit is active, the old fitScale
  // is stale — it was computed for a different string or different font metrics.
  // Reset to undefined so the hide-until-fit mechanism activates and the text is
  // re-measured at baseFontSize. Font metric changes are especially important: the
  // same text at the same fontSize can have very different widths across fonts, so a
  // fitScale calibrated to the old font would produce wrong sizing with the new font.
  const fitInvalidated = (textValueChanged || fontChanged) && shrinkToFit && maxWidth !== undefined;

  if (layoutChanged) {
    // Set font URL before sync — must happen before text.sync() call
    if (layout.fontUrl !== undefined && text.font !== layout.fontUrl) {
      text.font = layout.fontUrl;
    }
    // Set SDF glyph size before sync — changing after sync causes cache invalidation
    if (layout.sdfGlyphSize !== undefined && text.sdfGlyphSize !== layout.sdfGlyphSize) {
      text.sdfGlyphSize = layout.sdfGlyphSize;
    }
    text.text = value;
    text.color = color;

    if (fitInvalidated) {
      userData.fitScale = undefined;
    }

    if (baseChanged || fitInvalidated) {
      const initialScale = userData.fitScale ?? 1;
      text.fontSize = baseFontSize * initialScale;
    }
    text.anchorX = nextAnchorX;
    text.anchorY = nextAnchorY;
    text.textAlign = nextAlign;
    text.overflowWrap = nextOverflow;
    text.whiteSpace = nextWhiteSpace;
    text.lineHeight = nextLineHeight;
    if (maxWidth !== undefined) {
      text.maxWidth = maxWidth;
    }
    userData.baseFontSize = baseFontSize;
    userData.maxWidth = maxWidth;
    userData.shrinkToFit = shrinkToFit;
    userData.fitRatio = nextRatio;
    userData.needsFit = shrinkToFit && maxWidth !== undefined && (ratioChanged || textValueChanged || fontChanged);
    text.sync();
  }

  const hideUntilFit =
    shrinkToFit &&
    maxWidth !== undefined &&
    (userData.needsFit || layoutChanged) &&
    userData.fitScale === undefined;
  text.visible = !hideUntilFit;
  text.fillOpacity = hideUntilFit ? 0 : opacity;

  if (shrinkToFit && maxWidth !== undefined) {
    if (!userData.needsFit) return;
    // When text content or font just changed, textRenderInfo still holds stale bounds
    // from the PREVIOUS text/font. text.sync() was just called but troika's async worker
    // hasn't completed yet. Skip the bounds check this frame — the next frame will see
    // fresh bounds once troika finishes the sync.
    if (fitInvalidated && layoutChanged) return;
    const info = text.textRenderInfo as { blockBounds?: [number, number, number, number] } | undefined;
    const bounds = info?.blockBounds;
    if (bounds) {
      const width = Math.abs(bounds[2] - bounds[0]);
      if (width > 0) {
        const currentSize = text.fontSize || baseFontSize;
        const widthAtBase = width * (baseFontSize / currentSize);
        const scale = widthAtBase > maxWidth ? maxWidth / widthAtBase : 1;
        const prevScale = userData.fitScale;
        if (prevScale !== undefined && Math.abs(scale - prevScale) < 0.02) {
          userData.needsFit = false;
          return;
        }
        if (userData.fitScale !== scale) {
          userData.fitScale = scale;
          const nextSize = baseFontSize * scale;
          if (text.fontSize !== nextSize) {
            text.fontSize = nextSize;
            text.sync();
          }
        }
        userData.needsFit = false;
      }
    }
  }
}

/**
 * Properly disposes a troika Text instance by calling its `.dispose()` method,
 * which releases the SDF atlas slot, internal ShaderMaterial, and generated geometry.
 *
 * Always use this instead of manually calling `.geometry.dispose()` — troika manages
 * shared atlas resources that only its own `.dispose()` can properly release. Failing
 * to call this causes atlas slots to leak, eventually overflowing the shared glyph
 * atlas and corrupting visible text.
 */
export function disposeText(text: TextWithLayout): void {
  text.dispose();
}
