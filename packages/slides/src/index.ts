// packages/slides/src/index.ts
// Public API surface for @brewsite/slides.

// ─── Primary Components ───────────────────────────────────────────────────────
export { SlidePlayer } from './player/SlidePlayer';
export type { SlidePlayerProps } from './player/SlidePlayer';

// ─── DSL Components ───────────────────────────────────────────────────────────
export {
  Slide,
  TitleLayout,
  TitleBodyLayout,
  TwoColumnLayout,
  FullBleedLayout,
  BlankLayout,
  SlideContent,
  Heading,
  Body,
  BulletList,
  NumberedList,
} from './dsl';
export type {
  SlideProps,
  TitleLayoutProps,
  TitleBodyLayoutProps,
  TwoColumnLayoutProps,
  FullBleedLayoutProps,
  HeadingProps,
  BodyProps,
  BulletListProps,
  NumberedListProps,
} from './dsl';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SlideLayout,
  SlideTransition,
  DeckTheme,
  ResolvedDeckTheme,
  SlideRegion,
  SlideSpec,
  DeckSpec,
  SlidePlayerHandle,
  PrintOptions,
  SlideNavigationConfig,
  ProgressStyle,
} from './types';

// ─── Theme ────────────────────────────────────────────────────────────────────
export { defaultDeckTheme, darkDeckTheme, createDeckTheme } from './theme';
export {
  DECK_THEME_PAIRS,
  getDeckThemeForFamily,
  createDeckThemeForFamily,
} from './themeFamily';

// ─── Plugin ───────────────────────────────────────────────────────────────────
export { slidesPlugin } from './plugin';
export type { SlidesPluginOptions } from './plugin';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export {
  useSlideNavigation,
  computeSlideStartProgress,
} from './player/useSlideNavigation';
export { useSlideNotes } from './player/useSlideNotes';
export type { SlideNavigationState } from './player/useSlideNavigation';
