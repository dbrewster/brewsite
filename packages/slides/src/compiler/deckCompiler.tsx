// Transforms <Slide> children into DeckSpec + <Scene> ReactElement[].
// Pure function at the DeckSpec level. Scene element construction uses React.createElement.

import React, { Children, isValidElement, type ReactElement } from 'react';
import type { DeckSpec, SlideSpec, SlideTransition, SlideLayout } from '../types';
import { compileLayout } from './layoutCompiler';
import {
  Slide,
  TitleLayout,
  TitleBodyLayout,
  TwoColumnLayout,
  FullBleedLayout,
  BlankLayout,
  SlideContent,
  BulletList,
  NumberedList,
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
} from '../dsl';
import type {
  BigNumberSlideProps,
  MetricGridSlideProps,
  ComparisonSlideProps,
  AgendaSlideProps,
} from '../dsl';
// DSL imports from @brewsite/core — used to construct <Scene> children
import { TextBox, Scene, ProgressManager, Floor, Background, Lighting, Ambient, View, Camera, getNodeHandler } from '@brewsite/core';
import { SlideMetaDsl } from '../plugin';

// ─── Internal Types ───────────────────────────────────────────────────────────

/** Two-column layout content — distinct from ReactNode so TypeScript narrows correctly. */
type TwoColumnContent = { left: React.ReactNode; right: React.ReactNode };

/** Title layout structured data. */
type TitleContent = { _kind: 'title'; title: string; subtitle?: string; tagline?: string; alignment: string };

/** Section layout structured data. */
type SectionContent = { _kind: 'section'; title: string; subtitle?: string };

/** Big-number layout structured data. */
type BigNumberContent = { _kind: 'big-number'; stats: BigNumberSlideProps['stats'] };

/** Metric-grid layout structured data. */
type MetricGridContent = { _kind: 'metric-grid'; metrics: MetricGridSlideProps['metrics'] };

/** Comparison layout structured data. */
type ComparisonContent = { _kind: 'comparison'; headers: string[]; rows: ComparisonSlideProps['rows']; highlightColumn?: number };

/** Quote layout structured data. */
type QuoteContent = { _kind: 'quote'; quote: string; attribution: string; role?: string };

/** Agenda layout structured data. */
type AgendaContent = { _kind: 'agenda'; items: AgendaSlideProps['items'] };

/** Union of possible contentChildren shapes produced by extractLayoutInfo. */
type LayoutContentChildren =
  | React.ReactNode
  | TwoColumnContent
  | TitleContent
  | SectionContent
  | BigNumberContent
  | MetricGridContent
  | ComparisonContent
  | QuoteContent
  | AgendaContent;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SCROLL_UNITS_TITLE = 100;
const DEFAULT_SCROLL_UNITS_BODY = 400;

// ─── Type Guards ──────────────────────────────────────────────────────────────

/** Returns true when content is TwoColumnContent (has left and right keys). */
function isTwoColumnContent(content: LayoutContentChildren): content is TwoColumnContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'left' in (content as object) &&
    'right' in (content as object)
  );
}

/** Returns true when content has a _kind discriminant matching the given value. */
function hasKind(content: LayoutContentChildren, kind: string): boolean {
  return typeof content === 'object' && content !== null && '_kind' in (content as object) && (content as Record<string, unknown>)['_kind'] === kind;
}

/** Returns true when content is TitleContent. */
function isTitleContent(content: LayoutContentChildren): content is TitleContent {
  return hasKind(content, 'title');
}

/** Returns true when content is SectionContent. */
function isSectionContent(content: LayoutContentChildren): content is SectionContent {
  return hasKind(content, 'section');
}

/** Returns true when content is BigNumberContent. */
function isBigNumberContent(content: LayoutContentChildren): content is BigNumberContent {
  return hasKind(content, 'big-number');
}

/** Returns true when content is MetricGridContent. */
function isMetricGridContent(content: LayoutContentChildren): content is MetricGridContent {
  return hasKind(content, 'metric-grid');
}

/** Returns true when content is ComparisonContent. */
function isComparisonContent(content: LayoutContentChildren): content is ComparisonContent {
  return hasKind(content, 'comparison');
}

/** Returns true when content is QuoteContent. */
function isQuoteContent(content: LayoutContentChildren): content is QuoteContent {
  return hasKind(content, 'quote');
}

/** Returns true when content is AgendaContent. */
function isAgendaContent(content: LayoutContentChildren): content is AgendaContent {
  return hasKind(content, 'agenda');
}

/** Returns true when content is a structured data object (not ReactNode or TwoColumnContent). */
function isStructuredContent(content: LayoutContentChildren): boolean {
  return typeof content === 'object' && content !== null && '_kind' in (content as object);
}

/** Extracts ReactNode from LayoutContentChildren, returning null for structured or two-column content. */
function asReactNode(content: LayoutContentChildren): React.ReactNode {
  if (isTwoColumnContent(content) || isStructuredContent(content)) return null;
  return content as React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Counts the total number of animated list items inside a ReactNode tree.
 * Used to determine visibleBullets count range for sceneProgress-based reveals.
 */
function countAnimatedListItems(children: React.ReactNode): number {
  let total = 0;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<Record<string, unknown>>;
    if (el.type === BulletList || el.type === NumberedList) {
      if (el.props['animateEntrance'] === true) {
        const items = el.props['items'];
        if (Array.isArray(items)) total += items.length;
      }
    }
  });
  return total;
}

// ─── Content Type Classification ─────────────────────────────────────────────

type RegionContentType = 'html' | '3d' | 'mixed';

type ClassifiedContent = {
  contentType: RegionContentType;
  htmlChildren: React.ReactNode[];
  dslChildren: React.ReactNode[];
};

/**
 * Classifies region content into HTML vs 3D DSL elements.
 * 3D elements are identified by having a registered NodeHandler.
 *
 * Fragment children are expanded one level. Nested React components
 * that internally render 3D elements are NOT detected — only the
 * top-level element type is inspected.
 *
 * @param children - The ReactNode content of a layout region slot.
 * @returns Classification result with separated children arrays.
 */
export function classifyRegionContent(children: React.ReactNode): ClassifiedContent {
  const htmlChildren: React.ReactNode[] = [];
  const dslChildren: React.ReactNode[] = [];

  // Flatten one level of Fragments
  const flatChildren: React.ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === React.Fragment) {
      // Expand fragment children
      Children.forEach(
        (child.props as { children?: React.ReactNode }).children,
        (fragmentChild) => flatChildren.push(fragmentChild),
      );
    } else {
      flatChildren.push(child);
    }
  });

  for (const child of flatChildren) {
    if (isValidElement(child) && getNodeHandler(child.type) !== undefined) {
      dslChildren.push(child);
    } else {
      htmlChildren.push(child);
    }
  }

  const has3d = dslChildren.length > 0;
  const hasHtml = htmlChildren.length > 0;
  const contentType: RegionContentType =
    has3d && hasHtml ? 'mixed' :
    has3d ? '3d' :
    'html';

  return { contentType, htmlChildren, dslChildren };
}

/**
 * Returns true if the ReactNode tree contains an element of the given type
 * at the top level. Expands one level of Fragments.
 */
function hasElementOfType(node: React.ReactNode, type: unknown): boolean {
  let found = false;
  Children.forEach(node, (child) => {
    if (isValidElement(child)) {
      if (child.type === type) {
        found = true;
      } else if (child.type === React.Fragment) {
        // Expand fragment one level
        Children.forEach(
          (child.props as { children?: React.ReactNode }).children,
          (fragmentChild) => {
            if (isValidElement(fragmentChild) && fragmentChild.type === type) {
              found = true;
            }
          },
        );
      }
    }
  });
  return found;
}

/**
 * Recursively inspects layout component props to extract title string and children.
 */
function extractLayoutInfo(layoutElement: ReactElement<Record<string, unknown>>): {
  layout: SlideLayout;
  title: string | undefined;
  hasTitle: boolean;
  contentChildren: LayoutContentChildren;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
  imageUrl?: string;
  imageAlt?: string;
  imageFit?: string;
  imagePosition?: 'left' | 'right';
  statCount?: number;
  metricColumns?: number;
  comparisonColumns?: number;
} {
  const type = layoutElement.type;
  const props = layoutElement.props;

  if (type === TitleLayout) {
    const title = typeof props['title'] === 'string' ? props['title'] : undefined;
    const subtitle = typeof props['subtitle'] === 'string' ? props['subtitle'] : undefined;
    const alignment = (props['alignment'] as string | undefined) ?? 'center';
    const content = (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignment === 'center' ? 'center' : 'flex-start',
        justifyContent: 'center',
        height: '100%',
        padding: 'var(--slide-content-padding)',
        textAlign: alignment === 'center' ? 'center' : 'left',
      }}>
        {title && <h1 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{title}</h1>}
        {subtitle && <p style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1rem, 2.5vw, 2rem)', color: 'var(--brewsite-text-secondary)', margin: '0.75em 0 0' }}>{subtitle}</p>}
      </div>
    );
    return { layout: 'title', title, hasTitle: !!title, contentChildren: content };
  }

  if (type === TitleBodyLayout) {
    const title = typeof props['title'] === 'string' ? props['title'] : undefined;
    return { layout: 'content', title, hasTitle: !!title, contentChildren: props['children'] as React.ReactNode };
  }

  if (type === TwoColumnLayout) {
    const title = typeof props['title'] === 'string' ? props['title'] : undefined;
    return {
      layout: 'two-column', title, hasTitle: !!title,
      contentChildren: { left: props['left'] as React.ReactNode, right: props['right'] as React.ReactNode },
    };
  }

  if (type === FullBleedLayout) {
    return {
      layout: 'full-bleed', title: undefined, hasTitle: false,
      contentChildren: props['children'] as React.ReactNode,
      overlayPosition: props['overlayPosition'] as 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center' | undefined,
    };
  }

  if (type === BlankLayout || type === SlideContent) {
    return { layout: 'blank', title: undefined, hasTitle: false, contentChildren: props['children'] as React.ReactNode };
  }

  // ─── New Phase 1B Layout Components ──────────────────────────────────────

  if (type === TitleSlide) {
    const title = props['title'] as string;
    const subtitle = props['subtitle'] as string | undefined;
    const tagline = props['tagline'] as string | undefined;
    const alignment = (props['alignment'] as string | undefined) ?? 'center';
    return {
      layout: 'title', title, hasTitle: true,
      contentChildren: { _kind: 'title', title, subtitle, tagline, alignment },
    };
  }

  if (type === SectionSlide) {
    const title = props['title'] as string;
    const subtitle = props['subtitle'] as string | undefined;
    return { layout: 'section', title, hasTitle: true, contentChildren: { _kind: 'section', title, subtitle } };
  }

  if (type === ContentSlide) {
    const title = props['title'] as string;
    return { layout: 'content', title, hasTitle: true, contentChildren: props['children'] as React.ReactNode };
  }

  if (type === TwoColumnSlide) {
    const title = props['title'] as string | undefined;
    return {
      layout: 'two-column', title, hasTitle: !!title,
      contentChildren: { left: props['left'] as React.ReactNode, right: props['right'] as React.ReactNode },
    };
  }

  if (type === ImageSlide) {
    const title = props['title'] as string | undefined;
    return {
      layout: 'image', title, hasTitle: !!title,
      contentChildren: props['children'] as React.ReactNode,
      imageUrl: props['imageUrl'] as string,
      imageAlt: props['imageAlt'] as string | undefined,
      imageFit: (props['imageFit'] as string | undefined) ?? 'cover',
      imagePosition: (props['imagePosition'] as 'left' | 'right' | undefined) ?? 'left',
    };
  }

  if (type === FullBleedSlide) {
    return {
      layout: 'full-bleed', title: undefined, hasTitle: false,
      contentChildren: props['children'] as React.ReactNode,
      overlayPosition: props['overlayPosition'] as 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center' | undefined,
    };
  }

  if (type === BlankSlide) {
    return { layout: 'blank', title: undefined, hasTitle: false, contentChildren: props['children'] as React.ReactNode };
  }

  if (type === BigNumberSlide) {
    const title = props['title'] as string | undefined;
    return {
      layout: 'big-number', title, hasTitle: !!title,
      contentChildren: { _kind: 'big-number', stats: props['stats'] as BigNumberSlideProps['stats'] },
      statCount: (props['stats'] as unknown[])?.length ?? 1,
    };
  }

  if (type === MetricGridSlide) {
    const title = props['title'] as string | undefined;
    return {
      layout: 'metric-grid', title, hasTitle: !!title,
      contentChildren: { _kind: 'metric-grid', metrics: props['metrics'] as MetricGridSlideProps['metrics'] },
      metricColumns: (props['columns'] as number | undefined) ?? 3,
    };
  }

  if (type === ComparisonSlide) {
    const title = props['title'] as string | undefined;
    const headers = props['headers'] as string[];
    return {
      layout: 'comparison', title, hasTitle: !!title,
      contentChildren: {
        _kind: 'comparison',
        headers,
        rows: props['rows'] as ComparisonSlideProps['rows'],
        highlightColumn: props['highlightColumn'] as number | undefined,
      },
      comparisonColumns: headers?.length,
    };
  }

  if (type === QuoteSlide) {
    return {
      layout: 'quote', title: undefined, hasTitle: false,
      contentChildren: {
        _kind: 'quote',
        quote: props['quote'] as string,
        attribution: props['attribution'] as string,
        role: props['role'] as string | undefined,
      },
    };
  }

  if (type === AgendaSlide) {
    const title = props['title'] as string;
    return {
      layout: 'agenda', title, hasTitle: true,
      contentChildren: { _kind: 'agenda', items: props['items'] as AgendaSlideProps['items'] },
    };
  }

  // Unknown layout — treat as blank
  return { layout: 'blank', title: undefined, hasTitle: false, contentChildren: null };
}

/**
 * Compile a single <Slide> ReactElement into a SlideSpec.
 * Pure: no React rendering, no side effects.
 */
function compileSlide(
  slideEl: ReactElement<Record<string, unknown>>,
  deckTransition: SlideTransition,
): SlideSpec {
  const props = slideEl.props;
  const rawKey = typeof slideEl.key === 'string'
    ? slideEl.key.startsWith('.$') ? slideEl.key.slice(2) : slideEl.key
    : `slide-${Math.random().toString(36).slice(2)}`;

  const transition: SlideTransition = (props['transition'] as SlideTransition | undefined) ?? deckTransition;
  const notes = typeof props['notes'] === 'string' ? props['notes'] : undefined;
  const title = typeof props['title'] === 'string' ? props['title'] : undefined;
  const sceneDsl = props['sceneDsl'] as React.ReactNode | undefined;

  // Find the layout child
  const children = Children.toArray(props['children'] as React.ReactNode);
  const layoutEl = children.find((c) => isValidElement(c)) as ReactElement<Record<string, unknown>> | undefined;

  const layoutInfo = layoutEl
    ? extractLayoutInfo(layoutEl)
    : { layout: 'blank' as SlideLayout, title: undefined, hasTitle: false, contentChildren: null };

  // Count animated list items in the body content
  const bodyContent = layoutInfo.contentChildren;
  let totalBullets: number;
  if (isTwoColumnContent(bodyContent)) {
    totalBullets = countAnimatedListItems(bodyContent.left) + countAnimatedListItems(bodyContent.right);
  } else if (isStructuredContent(bodyContent)) {
    // Data-driven layouts (big-number, metric-grid, etc.) have no animated list items
    totalBullets = 0;
  } else {
    totalBullets = countAnimatedListItems(bodyContent as React.ReactNode);
  }
  const hasAnimatedList = totalBullets > 0;

  // Determine default scrollUnits
  const defaultScrollUnits = (layoutInfo.layout === 'title' || layoutInfo.layout === 'section') ? DEFAULT_SCROLL_UNITS_TITLE : DEFAULT_SCROLL_UNITS_BODY;
  const scrollUnits = typeof props['scrollUnits'] === 'number' ? props['scrollUnits'] : defaultScrollUnits;

  // Compile NVS regions
  const regions = compileLayout({
    layout: layoutInfo.layout,
    hasTitle: layoutInfo.hasTitle,
    overlayPosition: layoutInfo.overlayPosition,
    statCount: layoutInfo.statCount,
    metricColumns: layoutInfo.metricColumns,
    imagePosition: layoutInfo.imagePosition,
    comparisonColumns: layoutInfo.comparisonColumns,
  });

  return {
    key: rawKey,
    layout: layoutInfo.layout,
    transition,
    notes,
    scrollUnits,
    regions,
    title: title ?? layoutInfo.title,
    hasAnimatedList,
    totalBullets,
    sceneDsl: sceneDsl ?? undefined,
  };
}

/**
 * Compile the full deck from <Slide> children into a DeckSpec.
 * Pure function — no React rendering, no side effects.
 */
export function compileDeck(
  slides: ReactElement<Record<string, unknown>>[],
  deckTransition: SlideTransition,
): DeckSpec {
  const compiled = slides.map((s) => compileSlide(s, deckTransition));
  return { slides: compiled, transition: deckTransition };
}

/**
 * Transforms compiled DeckSpec + original <Slide> children into <Scene> ReactElement[].
 *
 * For each SlideSpec, produces a <Scene id="{key}"> containing:
 * - <ProgressManager scrollUnits={N} />
 * - <SlideMetaDsl> (internal marker read by SlideMetaWidget's NodeHandler)
 * - One <TextBox id="{key}-{region.id}" ...> per region, with appropriate ReactNode children
 *
 * The layout's React content (headings, bullet lists, etc.) is placed directly
 * into each TextBox's children prop. Standard TextBoxWidget handles the rest.
 *
 * IMPORTANT: This function produces static JSX that does NOT depend on runtime state
 * (sceneProgress, engine state, etc.). The SlideContentWithProgress component placed in
 * TextBox children reads sceneProgress via the useVariable hook at render time, ensuring
 * correct bullet reveals without recompiling the SceneTrack.
 */
export function buildSceneElements(
  slides: ReactElement<Record<string, unknown>>[],
  spec: DeckSpec,
  /**
   * Optional wrapper for body content — used by SlidePlayer to inject
   * SlideContentWithProgress around animated bullet lists.
   * When absent, raw content is used directly.
   */
  wrapBodyContent?: (slideKey: string, totalBullets: number, content: React.ReactNode) => React.ReactNode,
): ReactElement[] {
  return spec.slides.map((slideSpec, i) => {
    const slideEl = slides[i]!;
    const props = slideEl.props;
    const children = Children.toArray(props['children'] as React.ReactNode);
    const layoutEl = children.find((c) => isValidElement(c)) as ReactElement<Record<string, unknown>> | undefined;
    const layoutInfo = layoutEl
      ? extractLayoutInfo(layoutEl)
      : { layout: 'blank' as SlideLayout, title: undefined, hasTitle: false, contentChildren: null };

    // Build region elements — smart routing classifies content as HTML, 3D, or mixed.
    // Track whether any region emits a routed 3D View (used for default Camera injection).
    let hasRouted3D = false;

    const regionElements = slideSpec.regions.flatMap((region) => {
      let regionContent: React.ReactNode = null;
      // Content that should be classified for smart routing (set by classifiable paths)
      let classifiableContent: React.ReactNode | null = null;
      const data = layoutInfo.contentChildren;

      if (slideSpec.layout === 'title') {
        // TitleSlide (structured data) or legacy TitleLayout (pre-rendered JSX)
        if (isTitleContent(data)) {
          regionContent = (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: data.alignment === 'center' ? 'center' : 'flex-start',
              justifyContent: 'center', height: '100%',
              padding: 'var(--slide-content-padding)',
              textAlign: data.alignment === 'center' ? 'center' : 'left',
            }}>
              <h1 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{data.title}</h1>
              {data.subtitle && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1rem, 2.5vw, 2rem)', color: 'var(--brewsite-text-secondary)', margin: '0.75em 0 0' }}>{data.subtitle}</p>}
              {data.tagline && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)', color: 'var(--brewsite-text-muted)', margin: '0.5em 0 0' }}>{data.tagline}</p>}
            </div>
          );
        } else {
          // Legacy TitleLayout — contentChildren is pre-rendered JSX
          regionContent = asReactNode(data);
        }
      } else if (slideSpec.layout === 'section') {
        if (isSectionContent(data)) {
          regionContent = (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%',
              padding: 'var(--slide-content-padding)', textAlign: 'center',
            }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.75rem, 4vw, 3.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{data.title}</h2>
              {data.subtitle && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1rem, 2vw, 1.5rem)', color: 'var(--brewsite-text-secondary)', margin: '0.75em 0 0' }}>{data.subtitle}</p>}
            </div>
          );
        }
      } else if (slideSpec.layout === 'content') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-content-padding)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else {
          // body region — classifiable for smart routing
          classifiableContent = asReactNode(data);
        }
      } else if (slideSpec.layout === 'two-column') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-content-padding)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else {
          // left/right regions — classifiable for smart routing
          const twoColContent = isTwoColumnContent(data) ? data : null;
          classifiableContent = region.id === 'left' ? twoColContent?.left : twoColContent?.right;
        }
      } else if (slideSpec.layout === 'image') {
        if (region.id === 'image') {
          regionContent = (
            <img
              src={layoutInfo.imageUrl ?? ''}
              alt={layoutInfo.imageAlt ?? ''}
              style={{ width: '100%', height: '100%', objectFit: (layoutInfo.imageFit as 'cover' | 'contain') ?? 'cover' }}
            />
          );
        } else if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-content-padding)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else {
          // body region — classifiable for smart routing
          classifiableContent = asReactNode(data);
        }
      } else if (slideSpec.layout === 'full-bleed') {
        // overlay region — classifiable for smart routing
        classifiableContent = asReactNode(data);
      } else if (slideSpec.layout === 'blank') {
        // body region — classifiable for smart routing
        classifiableContent = asReactNode(data);
      } else if (slideSpec.layout === 'big-number') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-content-padding)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else if (isBigNumberContent(data)) {
          // stat-N regions
          const statMatch = region.id.match(/^stat-(\d+)$/);
          const statIndex = statMatch ? parseInt(statMatch[1], 10) : 0;
          const stat = data.stats[statIndex];
          if (stat) {
            regionContent = (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', textAlign: 'center',
                padding: 'var(--brewsite-spacing-md)',
              }}>
                <span style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(2rem, 6vw, 4.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', lineHeight: 1.1 }}>{stat.value}</span>
                <span style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--brewsite-text-secondary)', marginTop: 'var(--brewsite-spacing-sm)' }}>{stat.label}</span>
                {stat.trend && (
                  <span style={{
                    fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-caption)',
                    color: stat.trendDirection === 'up' ? 'var(--brewsite-color-success)'
                         : stat.trendDirection === 'down' ? 'var(--brewsite-color-error)'
                         : 'var(--brewsite-text-muted)',
                    marginTop: 'var(--brewsite-spacing-xs)',
                  }}>{stat.trend}</span>
                )}
              </div>
            );
          }
        }
      } else if (slideSpec.layout === 'metric-grid') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-content-padding)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else if (isMetricGridContent(data)) {
          const metricMatch = region.id.match(/^metric-(\d+)$/);
          const metricIndex = metricMatch ? parseInt(metricMatch[1], 10) : 0;
          const metric = data.metrics[metricIndex];
          if (metric) {
            regionContent = (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', textAlign: 'center',
                padding: 'var(--brewsite-spacing-md)',
                background: 'var(--brewsite-surface-elevated)',
                borderRadius: 'var(--brewsite-radius-md)',
                border: '1px solid var(--brewsite-border-subtle)',
              }}>
                {metric.icon && <div style={{ marginBottom: 'var(--brewsite-spacing-sm)', fontSize: '1.5rem' }}>{metric.icon}</div>}
                <span style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)' }}>{metric.value}</span>
                <span style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-caption)', color: 'var(--brewsite-text-secondary)', marginTop: 'var(--brewsite-spacing-xs)' }}>{metric.label}</span>
              </div>
            );
          }
        }
      } else if (slideSpec.layout === 'comparison') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-content-padding)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else if (isComparisonContent(data)) {
          regionContent = (
            <div style={{ height: '100%', padding: 'var(--slide-content-padding)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--brewsite-font-family)' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 'var(--brewsite-spacing-sm) var(--brewsite-spacing-md)', color: 'var(--brewsite-text-muted)', fontSize: 'var(--brewsite-font-size-caption)', borderBottom: '1px solid var(--brewsite-border-subtle)' }}></th>
                    {data.headers.map((h: string, hi: number) => (
                      <th key={hi} style={{
                        textAlign: 'center', padding: 'var(--brewsite-spacing-sm) var(--brewsite-spacing-md)',
                        color: hi === data.highlightColumn ? 'var(--brewsite-accent-color)' : 'var(--brewsite-text-primary)',
                        fontSize: 'var(--brewsite-font-size-body)', fontWeight: 600,
                        borderBottom: '1px solid var(--brewsite-border-subtle)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, ri: number) => (
                    <tr key={ri}>
                      <td style={{ padding: 'var(--brewsite-spacing-sm) var(--brewsite-spacing-md)', color: 'var(--brewsite-text-primary)', fontSize: 'var(--brewsite-font-size-body)' }}>{row.feature}</td>
                      {row.values.map((cell, ci: number) => (
                        <td key={ci} style={{
                          textAlign: 'center', padding: 'var(--brewsite-spacing-sm) var(--brewsite-spacing-md)',
                          color: ci === data.highlightColumn ? 'var(--brewsite-accent-color)' : 'var(--brewsite-text-secondary)',
                        }}>
                          {cell.kind === 'check' ? (cell.value ? '\u2713' : '\u2717') : String(cell.value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      } else if (slideSpec.layout === 'quote') {
        if (isQuoteContent(data)) {
          if (region.id === 'quote') {
            regionContent = (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', padding: 'var(--slide-content-padding)', textAlign: 'center',
              }}>
                <blockquote style={{
                  fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.25rem, 2.5vw, 2rem)',
                  fontWeight: 400, fontStyle: 'italic', color: 'var(--brewsite-text-primary)',
                  margin: 0, lineHeight: 1.5, position: 'relative',
                  paddingLeft: '1.5em', borderLeft: '3px solid var(--brewsite-accent-color)',
                }}>
                  {data.quote}
                </blockquote>
              </div>
            );
          } else if (region.id === 'attribution') {
            regionContent = (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: '100%' }}>
                <span style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--brewsite-text-secondary)' }}>
                  — {data.attribution}{data.role ? `, ${data.role}` : ''}
                </span>
              </div>
            );
          }
        }
      } else if (slideSpec.layout === 'agenda') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-content-padding)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brewsite-text-primary)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else if (isAgendaContent(data)) {
          regionContent = (
            <div style={{
              height: '100%', padding: 'var(--slide-content-padding)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              gap: 'var(--slide-content-gap)',
            }}>
              {data.items.map((item, ai: number) => (
                <div key={ai} style={{ display: 'flex', gap: 'var(--brewsite-spacing-md)', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--brewsite-font-heading)', fontSize: 'var(--brewsite-font-size-body)', fontWeight: 600, color: 'var(--brewsite-accent-color)', minWidth: '2rem' }}>{ai + 1}.</span>
                  <div>
                    <span style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-body)', color: 'var(--brewsite-text-primary)', fontWeight: 500 }}>{item.label}</span>
                    {item.description && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'var(--brewsite-font-size-caption)', color: 'var(--brewsite-text-secondary)', margin: '0.25em 0 0' }}>{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          );
        }
      }

      // ─── Smart Content Routing ───────────────────────────────────────────────
      // If this region has classifiable content, route 3D vs HTML elements.
      // Non-classifiable regions (title, structured data) always emit TextBox.
      if (classifiableContent !== null) {
        const classified = classifyRegionContent(classifiableContent);

        if (classified.contentType === '3d') {
          hasRouted3D = true;
          return [React.createElement(
            View,
            {
              key: `${slideSpec.key}-${region.id}-view`,
              id: `slide-view-${slideSpec.key}-${region.id}`,
              x: region.x, y: region.y, w: region.w, h: region.h,
            },
            ...classified.dslChildren,
          )];
        } else if (classified.contentType === 'mixed') {
          hasRouted3D = true;
          return [
            React.createElement(
              View,
              {
                key: `${slideSpec.key}-${region.id}-view`,
                id: `slide-view-${slideSpec.key}-${region.id}`,
                x: region.x, y: region.y, w: region.w, h: region.h,
              },
              ...classified.dslChildren,
            ),
            React.createElement(
              TextBox,
              {
                key: `${slideSpec.key}-${region.id}-text`,
                id: `${slideSpec.key}-${region.id}`,
                x: region.x, y: region.y, w: region.w, h: region.h,
                layer: region.layer,
              },
              ...classified.htmlChildren,
            ),
          ];
        }

        // contentType === 'html' — fall through to wrap in body styling + TextBox below
        const isBodyRegion = slideSpec.layout === 'content' || slideSpec.layout === 'image';
        if (isBodyRegion && region.id !== 'title') {
          const rawContent = (
            <div style={{ height: '100%', padding: '0 var(--slide-content-padding) var(--slide-content-padding)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--slide-content-gap)' }}>
              {classifiableContent}
            </div>
          );
          regionContent = wrapBodyContent
            ? wrapBodyContent(slideSpec.key, slideSpec.totalBullets, rawContent)
            : rawContent;
        } else if (slideSpec.layout === 'two-column') {
          regionContent = (
            <div style={{ height: '100%', padding: '0 var(--slide-content-padding) var(--slide-content-padding)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--slide-content-gap)' }}>
              {classifiableContent}
            </div>
          );
        } else if (slideSpec.layout === 'full-bleed') {
          regionContent = (
            <div style={{ padding: 'var(--slide-content-padding)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {classifiableContent}
            </div>
          );
        } else if (slideSpec.layout === 'blank') {
          regionContent = classifiableContent;
        }
      }

      return [React.createElement(
        TextBox,
        {
          key: `${slideSpec.key}-${region.id}`,
          id: `${slideSpec.key}-${region.id}`,
          x: region.x,
          y: region.y,
          w: region.w,
          h: region.h,
          layer: region.layer,
        },
        regionContent,
      )];
    });

    // Determine if the author's sceneDsl already provides a Camera
    const sceneDslHasCamera = slideSpec.sceneDsl
      ? hasElementOfType(slideSpec.sceneDsl, Camera)
      : false;

    // Inject a default camera for slides with routed 3D content (unless author provides one)
    const defaultCameraElement = (hasRouted3D && !sceneDslHasCamera)
      ? React.createElement(Camera, {
          key: 'slide-default-cam',
          mode: 'world' as const,
          position: [0, 1.5, 5] as [number, number, number],
          target: [0, 0, 0] as [number, number, number],
          fov: '42deg',
        })
      : null;

    return React.createElement(
      Scene,
      { key: slideSpec.key, id: slideSpec.key },
      React.createElement(ProgressManager, { key: 'pm', scrollUnits: slideSpec.scrollUnits }),
      // Inject scene environment: disable floor, set theme-driven background, provide ambient light.
      // Background with no color prop is a no-op — BackgroundLayer handles SceneTheme-driven backgrounds.
      React.createElement(Floor, { key: 'floor', enabled: false }),
      React.createElement(Background, { key: 'bg' }),
      React.createElement(Lighting, { key: 'lighting' },
        React.createElement(Ambient, { key: 'ambient', intensity: 1, color: '#ffffff' }),
      ),
      React.createElement(SlideMetaDsl, {
        key: `meta-${slideSpec.key}`,
        id: `slide-meta-${slideSpec.key}`,
        slideKey: slideSpec.key,
        logicalIndex: i,
        totalSlides: spec.slides.length,
        notes: slideSpec.notes,
        title: slideSpec.title,
        hasAnimatedList: slideSpec.hasAnimatedList,
        totalBullets: slideSpec.totalBullets,
      }),
      ...(defaultCameraElement ? [defaultCameraElement] : []),
      ...regionElements,
      // Inject author's 3D scene DSL (Diagram, Chart, Camera overrides, etc.)
      ...(slideSpec.sceneDsl
        ? [React.createElement(
            View,
            {
              key: `scenedsl-view-${slideSpec.key}`,
              id: `slide-3d-${slideSpec.key}`,
              x: 0,
              y: 0,
              w: '100%',
              h: '100%',
            },
            slideSpec.sceneDsl,
          )]
        : []),
    );
  });
}
