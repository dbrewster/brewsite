// DSL components for slide deck authoring. All return null — compiled, not rendered.

import type { ReactElement, ReactNode } from 'react';
import type { SlideTransition, SlideRegionEntrance, ComparisonCellValue } from './types';

// ─── Slide (primary authoring unit) ──────────────────────────────────────────

export type SlideProps = {
  /**
   * Stable unique identifier for this slide. Becomes the Scene id.
   * REQUIRED — declare as key="my-slide-id" on the JSX element.
   */
  children?: ReactNode;
  /** Speaker notes (plain text). Stored in VariableStore. Surfaced in PresenterView. */
  notes?: string;
  /** Slide title for accessibility and overview panel. */
  title?: string;
  /**
   * ProgressManager scroll budget override.
   * Defaults: 'title' → 100, all others → 400.
   */
  scrollUnits?: number;
  /**
   * Slide transition override. Inherits from SlidePlayer.transition when absent.
   */
  transition?: SlideTransition;
  /**
   * Additional 3D scene DSL elements injected directly into the Scene.
   * Use for <Diagram>, <BarChart>, <Camera>, <Lighting>, or any core/diagram/chart DSL.
   * These render as Three.js geometry in the canvas, behind the HTML overlay.
   */
  sceneDsl?: ReactNode;
};

/**
 * Primary slide authoring unit. One <Slide> = one <Scene>.
 * The `key` prop is required as a stable slide identifier.
 */
export const Slide = (_props: SlideProps): null => null;
Slide.displayName = 'Slide';

// ─── Legacy Layout Components (kept for deckCompiler extractLayoutInfo) ──────

export type TitleLayoutProps = {
  title: string;
  subtitle?: string;
  alignment?: 'center' | 'left';
};

/** Full-viewport title layout with optional subtitle. */
export const TitleLayout = (_props: TitleLayoutProps): null => null;
TitleLayout.displayName = 'TitleLayout';

export type TitleBodyLayoutProps = {
  title: string;
  /** Content primitives: <BulletList>, <Body>, <NumberedList>, etc. */
  children?: ReactNode;
};

/** Title bar at top, content region below. */
export const TitleBodyLayout = (_props: TitleBodyLayoutProps): null => null;
TitleBodyLayout.displayName = 'TitleBodyLayout';

export type TwoColumnLayoutProps = {
  title?: string;
  /** Left column content. */
  left: ReactNode;
  /** Right column content. */
  right: ReactNode;
};

/** Optional title bar at top; two equal-width columns below. */
export const TwoColumnLayout = (_props: TwoColumnLayoutProps): null => null;
TwoColumnLayout.displayName = 'TwoColumnLayout';

export type FullBleedLayoutProps = {
  /** Text overlay content rendered in a corner or center region. */
  children?: ReactNode;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
};

/** No layout constraints — Three.js canvas is fully visible. */
export const FullBleedLayout = (_props: FullBleedLayoutProps): null => null;
FullBleedLayout.displayName = 'FullBleedLayout';

/** Blank layout — no predefined structure. */
export const BlankLayout = (_props: { children?: ReactNode }): null => null;
BlankLayout.displayName = 'BlankLayout';

/** Escape hatch for custom slide content. */
export const SlideContent = (_props: { children?: ReactNode }): null => null;
SlideContent.displayName = 'SlideContent';

// ─── New Phase 1B Layout DSL Components ──────────────────────────────────────

export type TitleSlideProps = {
  title: string;
  subtitle?: string;
  tagline?: string;
  alignment?: 'center' | 'left';
  entrance?: SlideRegionEntrance;
};

/** Full-viewport title slide with optional subtitle and tagline. */
export const TitleSlide = (_props: TitleSlideProps): null => null;
TitleSlide.displayName = 'TitleSlide';

export type SectionSlideProps = {
  title: string;
  subtitle?: string;
  entrance?: SlideRegionEntrance;
};

/** Section divider slide. */
export const SectionSlide = (_props: SectionSlideProps): null => null;
SectionSlide.displayName = 'SectionSlide';

export type ContentSlideProps = {
  title: string;
  children?: ReactNode;
  entrance?: SlideRegionEntrance;
};

/** Title + body content slide. */
export const ContentSlide = (_props: ContentSlideProps): null => null;
ContentSlide.displayName = 'ContentSlide';

export type TwoColumnSlideProps = {
  title?: string;
  left: ReactNode;
  right: ReactNode;
  entrance?: SlideRegionEntrance;
};

/** Two-column layout slide. */
export const TwoColumnSlide = (_props: TwoColumnSlideProps): null => null;
TwoColumnSlide.displayName = 'TwoColumnSlide';

export type ImageSlideProps = {
  title?: string;
  children?: ReactNode;
  imageUrl: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
  imageFit?: 'cover' | 'contain';
  entrance?: SlideRegionEntrance;
};

/** Image + content slide. */
export const ImageSlide = (_props: ImageSlideProps): null => null;
ImageSlide.displayName = 'ImageSlide';

export type FullBleedSlideProps = {
  children?: ReactNode;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
  entrance?: SlideRegionEntrance;
};

/** Full-bleed slide with optional overlay. */
export const FullBleedSlide = (_props: FullBleedSlideProps): null => null;
FullBleedSlide.displayName = 'FullBleedSlide';

export type BlankSlideProps = {
  children?: ReactNode;
};

/** Blank slide with no predefined structure. */
export const BlankSlide = (_props: BlankSlideProps): null => null;
BlankSlide.displayName = 'BlankSlide';

export type BigNumberSlideProps = {
  stats: Array<{
    value: string | number;
    label: string;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
  }>;
  title?: string;
  entrance?: SlideRegionEntrance;
};

/** Big number / stats highlight slide. */
export const BigNumberSlide = (_props: BigNumberSlideProps): null => null;
BigNumberSlide.displayName = 'BigNumberSlide';

export type MetricGridSlideProps = {
  metrics: Array<{
    value: string | number;
    label: string;
    icon?: ReactNode;
  }>;
  title?: string;
  columns?: 3 | 4;
  entrance?: SlideRegionEntrance;
};

/** Metric grid slide with multiple KPI cards. */
export const MetricGridSlide = (_props: MetricGridSlideProps): null => null;
MetricGridSlide.displayName = 'MetricGridSlide';

export type ComparisonSlideProps = {
  headers: string[];
  rows: Array<{
    feature: string;
    values: ComparisonCellValue[];
  }>;
  highlightColumn?: number;
  title?: string;
  entrance?: SlideRegionEntrance;
};

/** Comparison table slide. */
export const ComparisonSlide = (_props: ComparisonSlideProps): null => null;
ComparisonSlide.displayName = 'ComparisonSlide';

export type QuoteSlideProps = {
  quote: string;
  attribution: string;
  role?: string;
  entrance?: SlideRegionEntrance;
};

/** Quote / testimonial slide. */
export const QuoteSlide = (_props: QuoteSlideProps): null => null;
QuoteSlide.displayName = 'QuoteSlide';

export type AgendaSlideProps = {
  title: string;
  items: Array<{
    label: string;
    description?: string;
    icon?: ReactNode;
  }>;
  entrance?: SlideRegionEntrance;
};

/** Agenda / table of contents slide. */
export const AgendaSlide = (_props: AgendaSlideProps): null => null;
AgendaSlide.displayName = 'AgendaSlide';

// ─── Text Content Primitives ──────────────────────────────────────────────────
// NOTE: These are React components (not DSL nodes) that render inside TextBox
// children. They are in dsl.tsx for co-location but they ARE rendered by React
// (they return JSX, not null). They are passed as ReactNode to TextBox children.

export type HeadingProps = {
  level?: 1 | 2 | 3;
  children: string;
  /** Optional explicit color override. Defaults to --brewsite-text-primary. */
  color?: string;
};

/**
 * Heading text rendered as <h1>, <h2>, or <h3>. Consumes CSS variables.
 */
export const Heading = ({ level = 2, children, color }: HeadingProps): ReactElement => {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
  return (
    <Tag style={{
      fontFamily: 'var(--brewsite-font-heading)',
      fontSize: level === 1 ? 'var(--brewsite-font-size-heading)' : undefined,
      color: color ?? 'var(--brewsite-text-primary)',
      margin: 0,
      lineHeight: 1.2,
    }}>
      {children}
    </Tag>
  );
};
Heading.displayName = 'Heading';

export type BodyProps = {
  children: ReactNode;
};

/**
 * Body paragraph text. Consumes CSS variables.
 */
export const Body = ({ children }: BodyProps): ReactElement => (
  <p style={{
    fontFamily: 'var(--brewsite-font-family)',
    fontSize: 'var(--brewsite-font-size-body)',
    color: 'var(--brewsite-text-secondary)',
    margin: 0,
    lineHeight: 1.6,
  }}>
    {children}
  </p>
);
Body.displayName = 'Body';

export type BulletListProps = {
  items: string[];
  /**
   * When true, SlideMetaWidget.apply() uses sceneProgress to reveal bullets
   * one at a time as the user scrolls through the slide.
   */
  animateEntrance?: boolean;
  bulletStyle?: 'disc' | 'arrow' | 'checkmark' | 'none';
  /**
   * Used internally by SlideLayoutWidget.apply() when animateEntrance=true.
   * @internal
   */
  visibleCount?: number;
};

/**
 * Animated bullet list. When animateEntrance=true, bullets reveal as sceneProgress
 * increases. When animateEntrance=false (default), all bullets are visible immediately.
 */
export const BulletList = ({ items, animateEntrance: _a, bulletStyle = 'disc', visibleCount }: BulletListProps): ReactElement => {
  const visibleItems = visibleCount !== undefined ? items.slice(0, visibleCount) : items;
  const bullet = bulletStyle === 'arrow' ? '→' : bulletStyle === 'checkmark' ? '✓' : bulletStyle === 'none' ? '' : '•';
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--slide-content-gap, 0.75rem)' }}>
      {visibleItems.map((item, i) => (
        <li key={i} style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--brewsite-text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          {bullet && <span style={{ flexShrink: 0, color: 'var(--brewsite-accent-color)' }}>{bullet}</span>}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};
BulletList.displayName = 'BulletList';

export type NumberedListProps = {
  items: string[];
  animateEntrance?: boolean;
  /** @internal */
  visibleCount?: number;
};

/**
 * Numbered list. Same animateEntrance semantics as BulletList.
 */
export const NumberedList = ({ items, animateEntrance: _a, visibleCount }: NumberedListProps): ReactElement => {
  const visibleItems = visibleCount !== undefined ? items.slice(0, visibleCount) : items;
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--slide-content-gap, 0.75rem)', counterReset: 'slide-list' }}>
      {visibleItems.map((item, i) => (
        <li key={i} style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--brewsite-text-secondary)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--brewsite-accent-color)', minWidth: '1.5rem' }}>{i + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
};
NumberedList.displayName = 'NumberedList';
