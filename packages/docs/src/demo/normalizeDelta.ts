// Pure wheel delta normalization for cross-browser consistency.

/** Assumed CSS line-height in pixels (standard cross-browser assumption). */
const LINE_HEIGHT_PX = 16;

/** Assumed page height in pixels (reasonable estimate for DOM_DELTA_PAGE). */
const PAGE_HEIGHT_PX = 800;

/**
 * Normalizes a WheelEvent delta to pixels, accounting for deltaMode differences.
 *
 * DOM_DELTA_PIXEL (0): delta is already in pixels — return as-is.
 * DOM_DELTA_LINE  (1): delta is in CSS lines — multiply by LINE_HEIGHT_PX (16).
 * DOM_DELTA_PAGE  (2): delta is in pages — multiply by PAGE_HEIGHT_PX (800).
 *
 * Returns a signed number in pixels. Positive = scroll down. Negative = scroll up.
 */
export function normalizeDelta(event: WheelEvent): number {
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_PIXEL:
      return event.deltaY;
    case WheelEvent.DOM_DELTA_LINE:
      return event.deltaY * LINE_HEIGHT_PX;
    case WheelEvent.DOM_DELTA_PAGE:
      return event.deltaY * PAGE_HEIGHT_PX;
    default:
      return event.deltaY;
  }
}
