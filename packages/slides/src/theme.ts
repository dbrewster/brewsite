// SlideTheme defaults, named presets, and factory function.

import type { SlideTheme } from './types';

/** Utility type for deep-partial overrides. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ─── Default SlideTheme ──────────────────────────────────────────────────────

/** Default SlideTheme — balanced for general-purpose presentations. */
export const defaultSlideTheme: SlideTheme = {
  timing: {
    transitionDuration: '300ms',
    entranceDuration: 0.3,
    entranceDistance: '24px',
    staggerDelay: 0.08,
    countUpDuration: 0.6,
  },
  density: {
    contentPadding: '48px',
    contentGap: '16px',
    titleHeight: '18%',
    gutter: '2%',
  },
  typography: {
    headingScale: 1.2,
    bodyScale: 1.1,
    captionScale: 1.0,
  },
  components: {
    cardBorderWidth: '1px',
    timelineConnectorWidth: '2px',
    timelineDotSize: '12px',
    progressRingSize: '64px',
    progressRingThickness: '4px',
  },
};

// ─── Named Presets ───────────────────────────────────────────────────────────

/** Tight, fast. McKinsey / data-heavy decks. */
export const compactSlideTheme: SlideTheme = {
  timing: {
    transitionDuration: '200ms',
    entranceDuration: 0.2,
    entranceDistance: '16px',
    staggerDelay: 0.05,
    countUpDuration: 0.4,
  },
  density: {
    contentPadding: '32px',
    contentGap: '12px',
    titleHeight: '14%',
    gutter: '1.5%',
  },
  typography: {
    headingScale: 1.0,
    bodyScale: 1.0,
    captionScale: 0.9,
  },
  components: {
    cardBorderWidth: '1px',
    timelineConnectorWidth: '1.5px',
    timelineDotSize: '10px',
    progressRingSize: '56px',
    progressRingThickness: '3px',
  },
};

/** Spacious, slow. Apple keynote feel. */
export const cinematicSlideTheme: SlideTheme = {
  timing: {
    transitionDuration: '500ms',
    entranceDuration: 0.5,
    entranceDistance: '32px',
    staggerDelay: 0.12,
    countUpDuration: 0.8,
  },
  density: {
    contentPadding: '64px',
    contentGap: '24px',
    titleHeight: '22%',
    gutter: '3%',
  },
  typography: {
    headingScale: 1.4,
    bodyScale: 1.15,
    captionScale: 1.0,
  },
  components: {
    cardBorderWidth: '1px',
    timelineConnectorWidth: '2px',
    timelineDotSize: '14px',
    progressRingSize: '72px',
    progressRingThickness: '5px',
  },
};

/** Clean, snappy. No stagger, fast transitions. */
export const minimalSlideTheme: SlideTheme = {
  timing: {
    transitionDuration: '250ms',
    entranceDuration: 0.25,
    entranceDistance: '20px',
    staggerDelay: 0,
    countUpDuration: 0.5,
  },
  density: {
    contentPadding: '40px',
    contentGap: '14px',
    titleHeight: '16%',
    gutter: '2%',
  },
  typography: {
    headingScale: 1.1,
    bodyScale: 1.0,
    captionScale: 1.0,
  },
  components: {
    cardBorderWidth: '1px',
    timelineConnectorWidth: '2px',
    timelineDotSize: '12px',
    progressRingSize: '64px',
    progressRingThickness: '4px',
  },
};

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Creates a SlideTheme by deep-merging overrides into defaultSlideTheme. */
export function createSlideTheme(overrides: DeepPartial<SlideTheme>): SlideTheme {
  return {
    timing: { ...defaultSlideTheme.timing, ...overrides.timing },
    density: { ...defaultSlideTheme.density, ...overrides.density },
    typography: { ...defaultSlideTheme.typography, ...overrides.typography },
    components: { ...defaultSlideTheme.components, ...overrides.components },
  };
}
