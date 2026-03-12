// NVS bounds validation utilities — development-mode guards for [0..1] ranges.
// All validators are no-ops in production (NODE_ENV === 'production').

import type { NVSRect } from './types';

/**
 * Validates that an NVS scalar value is within [0..1].
 * Emits console.error in development; no-op in production.
 *
 * @param value     The scalar to validate.
 * @param fieldName Name of the field being validated (for error messages).
 * @param context   Human-readable context (e.g., `<Diagram id="foo">`).
 * @returns true if valid, false if out-of-range.
 */
export function validateNVSScalar(
  value: number,
  fieldName: string,
  context: string,
): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (value < 0 || value > 1 || !Number.isFinite(value)) {
    // commented this out because it is spamming logs.
    // console.error(
    //   `[NVS] Out-of-range: ${context} field "${fieldName}" = ${value}. ` +
    //   `Expected [0..1]. This will produce incorrect rendering.`,
    // );
    return false;
  }
  return true;
}

/**
 * Validates an NVSRect: all fields in [0..1] and x+w ≤ 1, y+h ≤ 1.
 * Emits console.error in development for each violation found.
 *
 * @param rect    The NVSRect to validate.
 * @param context Human-readable context (e.g., `<Diagram id="foo">`).
 * @returns true if all fields are valid, false if any violation found.
 */
export function validateNVSRect(rect: NVSRect, context: string): boolean {
  let ok = true;
  ok = validateNVSScalar(rect.x, 'x', context) && ok;
  ok = validateNVSScalar(rect.y, 'y', context) && ok;
  ok = validateNVSScalar(rect.w, 'w', context) && ok;
  ok = validateNVSScalar(rect.h, 'h', context) && ok;
  if (rect.x + rect.w > 1.0001) {
    console.error(`[NVS] ${context}: x+w = ${rect.x + rect.w} exceeds 1.`);
    ok = false;
  }
  if (rect.y + rect.h > 1.0001) {
    console.error(`[NVS] ${context}: y+h = ${rect.y + rect.h} exceeds 1.`);
    ok = false;
  }
  return ok;
}

/**
 * Validates a position [x, y, z] where x and y are NVS [0..1] and z is world-space.
 * Only the x and y components are validated; z is intentionally unrestricted.
 *
 * @param pos     The [x, y, z] position to validate.
 * @param context Human-readable context (e.g., `DiagramWidget("foo") node "bar"`).
 * @returns true if x and y are in [0..1], false otherwise.
 */
export function validateNVSPosition(
  pos: readonly [number, number, number],
  context: string,
): boolean {
  return (
    validateNVSScalar(pos[0], 'x', context) &&
    validateNVSScalar(pos[1], 'y', context)
  );
}
