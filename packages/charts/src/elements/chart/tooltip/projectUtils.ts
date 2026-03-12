// projectUtils — 3D world → 2D screen coordinate projection utilities.

import type { NVSRect } from '@brewsite/core';

/**
 * Projects NDC coordinates to pixel offsets within the NVS sub-region of
 * the AR-locked container.
 * Extracted from ChartTooltipOverlay.tsx — shared with ChartWidget.
 *
 * @param ndcX - Normalized device coordinate X in [-1, 1].
 * @param ndcY - Normalized device coordinate Y in [-1, 1].
 * @param containerW - Full AR-locked container width in pixels.
 * @param containerH - Full AR-locked container height in pixels.
 * @param nvsBounds - The NVS sub-region the chart occupies.
 * @returns Pixel position relative to the AR container top-left.
 */
export function projectNdcToNvsPixels(
  ndcX: number,
  ndcY: number,
  containerW: number,
  containerH: number,
  nvsBounds: NVSRect,
): { x: number; y: number } {
  const regionX = nvsBounds.x * containerW;
  const regionY = nvsBounds.y * containerH;
  const regionW = nvsBounds.w * containerW;
  const regionH = nvsBounds.h * containerH;

  return {
    x: regionX + ((ndcX + 1) / 2) * regionW,
    y: regionY + ((-ndcY + 1) / 2) * regionH,
  };
}
