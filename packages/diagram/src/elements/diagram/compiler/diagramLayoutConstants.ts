// Canonical source for diagram layout constants shared across compiler modules.
// Import from here — never redefine locally.

/**
 * Default group padding for auto-layout in diagram units [top, right, bottom, left].
 * After normalizeToViewport() this becomes ~7.5–15% NVS per side depending on layout span.
 */
export const DEFAULT_GROUP_PADDING: readonly [number, number, number, number] = [1.5, 1.5, 1.5, 1.5];

/** Default title gap for auto-layout in diagram units. */
export const DEFAULT_TITLE_GAP: number = 1;

/** Default group padding for ManualLayout in [0..1] NVS fractions [top, right, bottom, left]. */
export const DEFAULT_MANUAL_GROUP_PADDING: readonly [number, number, number, number] = [0.025, 0.025, 0.025, 0.025];

/** Default title gap for ManualLayout in [0..1] NVS fractions. */
export const DEFAULT_MANUAL_TITLE_GAP: number = 0.025;
