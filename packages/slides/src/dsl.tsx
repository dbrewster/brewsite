// DSL components for slide deck authoring. All return null — compiled, not rendered.

import type { ReactElement, ReactNode } from 'react';
import type { SlideLayout, SlideTransition } from './types';

// ─── Slide (primary authoring unit) ──────────────────────────────────────────

export type SlideProps = {
  /**
   * Stable unique identifier for this slide. Becomes the Scene id.
   * REQUIRED — declare as key="my-slide-id" on the JSX element.
   */
  children?: ReactNode;
  /** Speaker notes (plain text). Stored in VariableStore. Surfaced in v1.1 PresenterView. */
  notes?: string;
  /** Slide title for accessibility and v1.1 overview panel. */
  title?: string;
  /**
   * ProgressManager scroll budget override.
   * Defaults: 'title' → 100, all others → 400.
   */
  scrollUnits?: number;
  /**
   * Slide transition override. Inherits from SlidePlayer.transition when absent.
   * 'dissolve' = default cross-fade. 'none' = instant cut.
   */
  transition?: SlideTransition;
  /**
   * Additional 3D scene DSL elements injected directly into the Scene.
   * Use for <Diagram>, <BarChart>, <Camera>, <Lighting>, or any core/diagram/chart DSL.
   * These render as Three.js geometry in the canvas, behind the HTML overlay.
   *
   * @example
   * <Slide key="arch" sceneDsl={<>
   *   <Camera mode="world" position={[0, 1.5, 5]} target={[0, 0.3, 0]} fov={38} />
   *   <Diagram id="arch" x={0.5} y={0} w={0.5} h={1}>
   *     <FlowLayout direction="top-down" gap={1} />
   *     <DiagramNode id="api" label="API Gateway" />
   *   </Diagram>
   * </>}>
   *   <TitleBodyLayout title="Architecture">
   *     <Body>Our platform architecture.</Body>
   *   </TitleBodyLayout>
   * </Slide>
   */
  sceneDsl?: ReactNode;
};

/**
 * Primary slide authoring unit. One <Slide> = one <Scene>.
 * The `key` prop is required as a stable slide identifier.
 *
 * @example
 * <Slide key="intro" notes="Talk about the problem">
 *   <TitleLayout title="Introduction" />
 * </Slide>
 */
export const Slide = (_props: SlideProps): null => null;
Slide.displayName = 'Slide';

// ─── Layout Components ────────────────────────────────────────────────────────

export type TitleLayoutProps = {
  title: string;
  subtitle?: string;
  alignment?: 'center' | 'left';
};

/**
 * Full-viewport title layout with optional subtitle.
 * Compiles to one full-viewport TextBox with centered flex content.
 */
export const TitleLayout = (_props: TitleLayoutProps): null => null;
TitleLayout.displayName = 'TitleLayout';

export type TitleBodyLayoutProps = {
  title: string;
  /** Content primitives: <BulletList>, <Body>, <NumberedList>, etc. */
  children?: ReactNode;
};

/**
 * Title bar at top (20% height), content region below (78% height).
 * Compiles to two TextBox elements.
 */
export const TitleBodyLayout = (_props: TitleBodyLayoutProps): null => null;
TitleBodyLayout.displayName = 'TitleBodyLayout';

export type TwoColumnLayoutProps = {
  title?: string;
  /** Left column content. */
  left: ReactNode;
  /** Right column content. */
  right: ReactNode;
};

/**
 * Optional title bar at top; two equal-width columns below.
 * Compiles to 2–3 TextBox elements.
 */
export const TwoColumnLayout = (_props: TwoColumnLayoutProps): null => null;
TwoColumnLayout.displayName = 'TwoColumnLayout';

export type FullBleedLayoutProps = {
  /** Text overlay content rendered in a corner or center region. */
  children?: ReactNode;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
};

/**
 * No layout constraints — Three.js canvas is fully visible.
 * Optional text overlay anchored to a corner or center.
 */
export const FullBleedLayout = (_props: FullBleedLayoutProps): null => null;
FullBleedLayout.displayName = 'FullBleedLayout';

/**
 * Blank layout — no predefined structure. Use <SlideContent> for raw TextBox placement.
 */
export const BlankLayout = (_props: { children?: ReactNode }): null => null;
BlankLayout.displayName = 'BlankLayout';

/**
 * Escape hatch for custom slide content. Children should be <TextBox> DSL elements.
 */
export const SlideContent = (_props: { children?: ReactNode }): null => null;
SlideContent.displayName = 'SlideContent';

// ─── Text Content Primitives ──────────────────────────────────────────────────
// NOTE: These are React components (not DSL nodes) that render inside TextBox
// children. They are in dsl.tsx for co-location but they ARE rendered by React
// (they return JSX, not null). They are passed as ReactNode to TextBox children.

export type HeadingProps = {
  level?: 1 | 2 | 3;
  children: string;
  /** Optional explicit color override. Defaults to --slide-color-heading. */
  color?: string;
};

/**
 * Heading text rendered as <h1>, <h2>, or <h3>. Consumes DeckTheme CSS variables.
 * Used inside TitleLayout, TitleBodyLayout, TwoColumnLayout.
 */
export const Heading = ({ level = 2, children, color }: HeadingProps): ReactElement => {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
  return (
    <Tag style={{
      fontFamily: 'var(--brewsite-font-family)',
      fontSize: level === 1 ? 'var(--brewsite-font-size-heading)' : undefined,
      color: color ?? 'var(--slide-color-heading)',
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
 * Body paragraph text. Consumes DeckTheme CSS variables.
 */
export const Body = ({ children }: BodyProps): ReactElement => (
  <p style={{
    fontFamily: 'var(--brewsite-font-family)',
    fontSize: 'var(--brewsite-font-size-body)',
    color: 'var(--slide-color-body)',
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
   * Requires Decision A Option C (sceneProgress in SceneTrackTick).
   */
  animateEntrance?: boolean;
  bulletStyle?: 'disc' | 'arrow' | 'checkmark' | 'none';
  /**
   * Used internally by SlideLayoutWidget.apply() when animateEntrance=true.
   * The widget passes this via a React context; authors do not set it.
   * @internal
   */
  visibleCount?: number;
};

/**
 * Animated bullet list. When animateEntrance=true, bullets reveal as sceneProgress
 * increases (requires sceneProgress field on SceneTrackTick — see plan §7).
 * When animateEntrance=false (default), all bullets are visible immediately.
 */
export const BulletList = ({ items, animateEntrance: _a, bulletStyle = 'disc', visibleCount }: BulletListProps): ReactElement => {
  const visibleItems = visibleCount !== undefined ? items.slice(0, visibleCount) : items;
  const bullet = bulletStyle === 'arrow' ? '→' : bulletStyle === 'checkmark' ? '✓' : bulletStyle === 'none' ? '' : '•';
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--slide-gap, 0.75rem)' }}>
      {visibleItems.map((item, i) => (
        <li key={i} style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--slide-color-body)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          {bullet && <span style={{ flexShrink: 0, color: 'var(--brewsite-accent-color, var(--slide-color-heading))' }}>{bullet}</span>}
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
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--slide-gap, 0.75rem)', counterReset: 'slide-list' }}>
      {visibleItems.map((item, i) => (
        <li key={i} style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--slide-color-body)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--brewsite-accent-color, var(--slide-color-heading))', minWidth: '1.5rem' }}>{i + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
};
NumberedList.displayName = 'NumberedList';
