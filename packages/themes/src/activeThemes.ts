// Pre-built ActiveTheme object literals for all families and polarities.
// These are plain const objects — no runtime computation.

import type { ActiveTheme } from '@brewsite/core';

/** A pair of ActiveTheme selectors for dark and light polarities of a single family. */
export type ActiveThemeSelector = {
  readonly dark: ActiveTheme;
  readonly light: ActiveTheme;
};

/** ActiveTheme selectors for the enterprise family. */
export const enterprise = {
  dark:  { family: 'enterprise',   polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'enterprise',   polarity: 'light' } as const satisfies ActiveTheme,
};

/** ActiveTheme selectors for the darkGlass family. */
export const darkGlass = {
  dark:  { family: 'darkGlass',    polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'darkGlass',    polarity: 'light' } as const satisfies ActiveTheme,
};

/** ActiveTheme selectors for the midnight family. */
export const midnight = {
  dark:  { family: 'midnight',     polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'midnight',     polarity: 'light' } as const satisfies ActiveTheme,
};

/** ActiveTheme selectors for the neonCyber family. */
export const neonCyber = {
  dark:  { family: 'neonCyber',    polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'neonCyber',    polarity: 'light' } as const satisfies ActiveTheme,
};

/** ActiveTheme selectors for the lightCanvas family. */
export const lightCanvas = {
  dark:  { family: 'lightCanvas',  polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'lightCanvas',  polarity: 'light' } as const satisfies ActiveTheme,
};

/** ActiveTheme selectors for the lightMinimal family. */
export const lightMinimal = {
  dark:  { family: 'lightMinimal', polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'lightMinimal', polarity: 'light' } as const satisfies ActiveTheme,
};

/** ActiveTheme selectors for the default (enterprise) family. */
export const defaultTheme = {
  dark:  { family: 'default',      polarity: 'dark'  } as const satisfies ActiveTheme,
  light: { family: 'default',      polarity: 'light' } as const satisfies ActiveTheme,
};
