// Transforms <Slide> children into DeckSpec + <Scene> ReactElement[].
// Pure function at the DeckSpec level. Scene element construction uses React.createElement.

import React, { Children, isValidElement, type ReactElement } from 'react';
import type { DeckSpec, SlideSpec, SlideTransition, SlideLayout } from '../types';
import type { ResolvedDeckTheme } from '../types';
import { compileDeckTheme } from './themeCompiler';
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
} from '../dsl';
// DSL imports from @brewsite/core — used to construct <Scene> children
import { TextBox, Scene, ProgressManager, Floor, Background, Lighting, Ambient } from '@brewsite/core';
import { SlideMetaDsl } from '../plugin';

// ─── Internal Types ───────────────────────────────────────────────────────────

/** Two-column layout content — distinct from ReactNode so TypeScript narrows correctly. */
type TwoColumnContent = { left: React.ReactNode; right: React.ReactNode };

/** Union of possible contentChildren shapes produced by extractLayoutInfo. */
type LayoutContentChildren = React.ReactNode | TwoColumnContent;

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

/**
 * Recursively inspects layout component props to extract title string and children.
 */
function extractLayoutInfo(layoutElement: ReactElement<Record<string, unknown>>): {
  layout: SlideLayout;
  title: string | undefined;
  hasTitle: boolean;
  contentChildren: LayoutContentChildren;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
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
        padding: 'var(--slide-padding, 8%)',
        textAlign: alignment === 'center' ? 'center' : 'left',
      }}>
        {title && <h1 style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700, color: 'var(--slide-color-heading)', margin: 0 }}>{title}</h1>}
        {subtitle && <p style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1rem, 2.5vw, 2rem)', color: 'var(--slide-color-body)', margin: '0.75em 0 0' }}>{subtitle}</p>}
      </div>
    );
    return { layout: 'title', title, hasTitle: !!title, contentChildren: content };
  }

  if (type === TitleBodyLayout) {
    const title = typeof props['title'] === 'string' ? props['title'] : undefined;
    return { layout: 'title-body', title, hasTitle: !!title, contentChildren: props['children'] as React.ReactNode };
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
  _theme: ResolvedDeckTheme,
): SlideSpec {
  const props = slideEl.props;
  const rawKey = typeof slideEl.key === 'string'
    ? slideEl.key.startsWith('.$') ? slideEl.key.slice(2) : slideEl.key
    : `slide-${Math.random().toString(36).slice(2)}`;

  const transition: SlideTransition = (props['transition'] as SlideTransition | undefined) ?? deckTransition;
  const notes = typeof props['notes'] === 'string' ? props['notes'] : undefined;
  const title = typeof props['title'] === 'string' ? props['title'] : undefined;

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
    // Two-column layout: count animated list items in both columns.
    totalBullets = countAnimatedListItems(bodyContent.left) + countAnimatedListItems(bodyContent.right);
  } else {
    totalBullets = countAnimatedListItems(bodyContent);
  }
  const hasAnimatedList = totalBullets > 0;

  // Determine default scrollUnits
  const defaultScrollUnits = layoutInfo.layout === 'title' ? DEFAULT_SCROLL_UNITS_TITLE : DEFAULT_SCROLL_UNITS_BODY;
  const scrollUnits = typeof props['scrollUnits'] === 'number' ? props['scrollUnits'] : defaultScrollUnits;

  // Compile NVS regions
  const regions = compileLayout({
    layout: layoutInfo.layout,
    hasTitle: layoutInfo.hasTitle,
    overlayPosition: layoutInfo.overlayPosition,
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
  };
}

/**
 * Compile the full deck from <Slide> children into a DeckSpec.
 * Pure function — no React rendering, no side effects.
 */
export function compileDeck(
  slides: ReactElement<Record<string, unknown>>[],
  theme: ResolvedDeckTheme,
  deckTransition: SlideTransition,
): DeckSpec {
  const compiled = slides.map((s) => compileSlide(s, deckTransition, theme));
  return { slides: compiled, theme, transition: deckTransition };
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

    // Build TextBox children for each region
    const textBoxElements = slideSpec.regions.map((region) => {
      let regionContent: React.ReactNode = null;

      if (slideSpec.layout === 'title') {
        regionContent = isTwoColumnContent(layoutInfo.contentChildren) ? null : layoutInfo.contentChildren;
      } else if (slideSpec.layout === 'title-body') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-padding, 8%)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--slide-color-heading)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else {
          // body region — wrapped by SlidePlayer's SlideContentWithProgress for animated bullets
          const rawContent = (
            <div style={{ height: '100%', padding: '0 var(--slide-padding, 8%) var(--slide-padding, 8%)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--slide-gap, 1.5rem)' }}>
              {isTwoColumnContent(layoutInfo.contentChildren) ? null : layoutInfo.contentChildren}
            </div>
          );
          regionContent = wrapBodyContent
            ? wrapBodyContent(slideSpec.key, slideSpec.totalBullets, rawContent)
            : rawContent;
        }
      } else if (slideSpec.layout === 'two-column') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-padding, 8%)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--slide-color-heading)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else {
          const twoColContent = isTwoColumnContent(layoutInfo.contentChildren) ? layoutInfo.contentChildren : null;
          const colContent = region.id === 'left' ? twoColContent?.left : twoColContent?.right;
          regionContent = (
            <div style={{ height: '100%', padding: '0 var(--slide-padding, 8%) var(--slide-padding, 8%)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--slide-gap, 1.5rem)' }}>
              {colContent}
            </div>
          );
        }
      } else if (slideSpec.layout === 'full-bleed') {
        regionContent = (
          <div style={{ padding: 'var(--slide-padding, 8%)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {isTwoColumnContent(layoutInfo.contentChildren) ? null : layoutInfo.contentChildren}
          </div>
        );
      }

      return React.createElement(
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
      );
    });

    return React.createElement(
      Scene,
      { key: slideSpec.key, id: slideSpec.key },
      React.createElement(ProgressManager, { key: 'pm', scrollUnits: slideSpec.scrollUnits }),
      // Inject scene environment: disable floor, set background from theme, provide ambient light.
      // Without these, the default floor (enabled grid) and missing background would render
      // unwanted 3D artefacts behind the slide overlay.
      React.createElement(Floor, { key: 'floor', enabled: false }),
      React.createElement(Background, { key: 'bg', color: spec.theme.background.color }),
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
      ...textBoxElements,
    );
  });
}

// Re-export compileDeckTheme for convenience — SlidePlayer imports from here
export { compileDeckTheme };
