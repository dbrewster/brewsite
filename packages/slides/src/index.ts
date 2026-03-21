// packages/slides/src/index.ts
// Public API surface for @brewsite/slides.

// ─── Primary Components ───────────────────────────────────────────────────────
export { SlidePlayer } from './player/SlidePlayer';
export type { SlidePlayerProps } from './player/SlidePlayer';

// ─── DSL Components (legacy + new) ───────────────────────────────────────────
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

// ─── New Phase 1B Layout DSL Components ──────────────────────────────────────
export {
  TitleSlide,
  SectionSlide,
  ContentSlide,
  TwoColumnSlide,
  ImageSlide,
  FullBleedSlide,
  BlankSlide,
  BigNumberSlide,
  MetricGridSlide,
  ComparisonSlide,
  QuoteSlide,
  AgendaSlide,
} from './dsl';
export type {
  TitleSlideProps,
  SectionSlideProps,
  ContentSlideProps,
  TwoColumnSlideProps,
  ImageSlideProps,
  FullBleedSlideProps,
  BlankSlideProps,
  BigNumberSlideProps,
  MetricGridSlideProps,
  ComparisonSlideProps,
  QuoteSlideProps,
  AgendaSlideProps,
} from './dsl';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SlideLayout,
  SlideTransition,
  SlideTheme,
  SlideTemplate,
  BrandAsset,
  ResolvedSlideConfig,
  EntranceType,
  SlideRegionEntrance,
  ComparisonCellValue,
  SlideRegion,
  SlideSpec,
  DeckSpec,
  SlidePlayerHandle,
  PrintOptions,
  SlideNavigationConfig,
  ProgressStyle,
} from './types';

// ─── Theme ────────────────────────────────────────────────────────────────────
export {
  defaultSlideTheme,
  compactSlideTheme,
  cinematicSlideTheme,
  minimalSlideTheme,
  createSlideTheme,
} from './theme';
export type { DeepPartial } from './theme';

// ─── Template ─────────────────────────────────────────────────────────────────
export { resolveTemplate } from './template';
export type { ResolvedTemplate } from './template';

// ─── Plugin ───────────────────────────────────────────────────────────────────
export { slidesPlugin } from './plugin';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export {
  useSlideNavigation,
  computeSlideStartProgress,
} from './player/useSlideNavigation';
export { useSlideNotes } from './player/useSlideNotes';
export type { SlideNavigationState } from './player/useSlideNavigation';

// ─── Animation hooks ─────────────────────────────────────────────────────────
export { useCountUp, useStaggeredReveal, useProgressWindow, useEntrance } from './animation';
export { easeOutCubic, easeInOutCubic, easeOutQuart, linear } from './animation';

// ─── Graphics components ─────────────────────────────────────────────────────
export {
  StatCard, Timeline, ProcessSteps, IconGrid, ComparisonTable,
  ProgressRing, ProgressBar, CalloutBox, QuoteBlock, MetricRow,
  Badge, Divider,
} from './graphics';
export type {
  StatCardProps, TimelineProps, ProcessStepsProps, IconGridProps,
  ComparisonTableProps, ProgressRingProps, ProgressBarProps,
  CalloutBoxProps, QuoteBlockProps, MetricRowProps, BadgeProps, DividerProps,
} from './graphics';
