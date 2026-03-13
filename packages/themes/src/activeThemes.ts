// Pre-built theme selector object literals for all families and polarities.
// These are plain const objects — no runtime computation.

import type { ThemeFamily, ThemePolarity } from '@brewsite/core';

/** A theme family + polarity selector. */
export type ActiveThemeSelector = {
  readonly family: ThemeFamily;
  readonly polarity: ThemePolarity;
};

/** ActiveTheme selectors for the enterprise family. */
export const enterprise = {
  dark:  { family: 'enterprise',   polarity: 'dark'  } as const satisfies ActiveThemeSelector,
  light: { family: 'enterprise',   polarity: 'light' } as const satisfies ActiveThemeSelector,
};

/** ActiveTheme selectors for the darkGlass family. */
export const darkGlass = {
  dark:  { family: 'darkGlass',    polarity: 'dark'  } as const satisfies ActiveThemeSelector,
  light: { family: 'darkGlass',    polarity: 'light' } as const satisfies ActiveThemeSelector,
};

/** ActiveTheme selectors for the midnight family. */
export const midnight = {
  dark:  { family: 'midnight',     polarity: 'dark'  } as const satisfies ActiveThemeSelector,
  light: { family: 'midnight',     polarity: 'light' } as const satisfies ActiveThemeSelector,
};

/** ActiveTheme selectors for the neonCyber family. */
export const neonCyber = {
  dark:  { family: 'neonCyber',    polarity: 'dark'  } as const satisfies ActiveThemeSelector,
  light: { family: 'neonCyber',    polarity: 'light' } as const satisfies ActiveThemeSelector,
};

/** ActiveTheme selectors for the lightCanvas family. */
export const lightCanvas = {
  dark:  { family: 'lightCanvas',  polarity: 'dark'  } as const satisfies ActiveThemeSelector,
  light: { family: 'lightCanvas',  polarity: 'light' } as const satisfies ActiveThemeSelector,
};

/** ActiveTheme selectors for the lightMinimal family. */
export const lightMinimal = {
  dark:  { family: 'lightMinimal', polarity: 'dark'  } as const satisfies ActiveThemeSelector,
  light: { family: 'lightMinimal', polarity: 'light' } as const satisfies ActiveThemeSelector,
};
