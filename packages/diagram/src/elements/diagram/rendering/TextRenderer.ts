// Utility for updating troika Text objects with minimal sync() calls.

import type { TextWithLayout } from './types';

export function ensureText(
  text: TextWithLayout,
  value: string,
  color: string,
  baseFontSize: number,
  opacity: number,
  maxWidth?: number,
  shrinkToFit: boolean = false,
): void {
  const nextAnchorX = 'center';
  const nextAnchorY = 'middle';
  const nextAlign = 'center';
  const nextOverflow = 'normal';
  const nextWhiteSpace = 'nowrap';
  const nextLineHeight = 1.1;

  const userData = text.userData as {
    baseFontSize?: number;
    maxWidth?: number;
    shrinkToFit?: boolean;
    fitScale?: number;
    needsFit?: boolean;
    fitRatio?: number;
  };

  const baseChanged = userData.baseFontSize !== baseFontSize;
  const nextRatio = maxWidth !== undefined ? maxWidth / baseFontSize : undefined;
  const ratioChanged =
    nextRatio !== undefined &&
    (userData.fitRatio === undefined || Math.abs(nextRatio - userData.fitRatio) > 1e-3);
  const layoutChanged =
    text.text !== value ||
    text.color !== color ||
    text.anchorX !== nextAnchorX ||
    text.anchorY !== nextAnchorY ||
    text.textAlign !== nextAlign ||
    text.overflowWrap !== nextOverflow ||
    text.whiteSpace !== nextWhiteSpace ||
    text.lineHeight !== nextLineHeight ||
    baseChanged ||
    userData.maxWidth !== maxWidth ||
    userData.shrinkToFit !== shrinkToFit;

  if (layoutChanged) {
    text.text = value;
    text.color = color;
    if (baseChanged) {
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
    userData.needsFit = shrinkToFit && maxWidth !== undefined && ratioChanged;
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
