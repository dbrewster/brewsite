// String parsing for scene unit values — converts authored strings to typed parsed values.

import type { ParsedAngle, ParsedLength, SceneAngle, SceneLength } from './types';

/** Valid spatial unit suffixes. */
const LENGTH_UNITS = ['vw', 'vh', 'u', '%'] as const;

/** Valid angle unit suffixes. */
const ANGLE_UNITS = ['deg', 'rad'] as const;

/**
 * Regex for a valid numeric prefix: optional minus, digits with optional decimal point.
 * Rejects scientific notation (e.g., "1e2"), leading/trailing whitespace, and bare dots without digits.
 */
const NUMERIC_RE = /^-?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Parses a SceneLength string into its numeric value and unit.
 *
 * Valid forms: "0.15u", "50%", "15vw", "15vh", 0, "0u", "0%", "0vw", "0vh".
 * Rejects: bare number strings, unknown units, whitespace, scientific notation, empty strings.
 *
 * @throws {Error} If the value cannot be parsed.
 */
export function parseLength(value: SceneLength): ParsedLength {
  // Literal zero
  if (value === 0) {
    return { value: 0, unit: 'u' };
  }

  const str = value as string;

  if (str.length === 0) {
    throw new Error('Invalid SceneLength: empty string');
  }

  // Try each unit suffix, longest first (vw/vh before u/%)
  for (const unit of LENGTH_UNITS) {
    if (str.endsWith(unit)) {
      const numStr = str.slice(0, -unit.length);
      if (!NUMERIC_RE.test(numStr)) {
        throw new Error(`Invalid SceneLength: "${str}" — invalid numeric value "${numStr}"`);
      }
      return { value: Number(numStr), unit };
    }
  }

  throw new Error(`Invalid SceneLength: "${str}" — must end with one of: u, %, vw, vh`);
}

/**
 * Parses a SceneAngle string into its numeric value and unit.
 *
 * Valid forms: "45deg", "0.78rad", 0, "0deg", "0rad".
 * Rejects: bare number strings, unknown units, whitespace, scientific notation.
 *
 * @throws {Error} If the value cannot be parsed.
 */
export function parseAngle(value: SceneAngle): ParsedAngle {
  // Literal zero
  if (value === 0) {
    return { value: 0, unit: 'deg' };
  }

  const str = value as string;

  if (str.length === 0) {
    throw new Error('Invalid SceneAngle: empty string');
  }

  for (const unit of ANGLE_UNITS) {
    if (str.endsWith(unit)) {
      const numStr = str.slice(0, -unit.length);
      if (!NUMERIC_RE.test(numStr)) {
        throw new Error(`Invalid SceneAngle: "${str}" — invalid numeric value "${numStr}"`);
      }
      return { value: Number(numStr), unit };
    }
  }

  throw new Error(`Invalid SceneAngle: "${str}" — must end with one of: deg, rad`);
}
