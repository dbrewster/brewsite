// Type contracts for @brewsite/slides. No runtime or Three.js imports.

import type { ReactNode } from 'react';
import type { SceneTheme } from '@brewsite/core';

// ─── Layout Variants ──────────────────────────────────────────────────────────

/**
 * Identifies which built-in layout template a slide uses.
 * Each variant maps to a fixed set of NVS-positioned TextBox regions.
 */
export type SlideLayout =
  | 'title'
  | 'title-body'
  | 'two-column'
  | 'full-bleed'
  | 'blank';

// ─── Transitions ─────────────────────────────────────────────────────────────

/**
 * Slide transition type. Applied to the HTML overlay layer (CSS animation).
 * Three.js content between slides uses standard compiled transition specs.
 *
 * v1.0 supports 'dissolve' and 'none'.
 * v1.1 adds 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out'.
 */
export type SlideTransition = 'dissolve' | 'none';

// ─── Theme ────────────────────────────────────────────────────────────────────

/**
 * Deck-level theme. A superset of @brewsite/core's SceneTheme.
 * SceneTheme fields are mapped 1:1 by themeCompiler.ts. Slide-specific
 * extensions use the '--slide-' CSS variable prefix to avoid collisions
 * with '--brewsite-' variables owned by EngineOverlayHost.
 */
export type DeckTheme = {
  // ── SceneTheme-mapped fields ──────────────────────────────────────────────
  /** Maps to SceneTheme.font.htmlFamily. Also used as body font if fonts.body is absent. */
  fonts: {
    heading: string;
    body?: string;
    mono?: string;
  };
  /** Maps to SceneTheme.colorMode. */
  colorMode: 'dark' | 'light';
  /** Maps to SceneTheme.accentColor. */
  accentColor?: string;

  // ── Slide-specific CSS variable extensions ────────────────────────────────
  background: {
    /** Background color for the slide canvas. Also sets the <Background> DSL color. */
    color: string;
    /** Optional CSS gradient string injected as --slide-bg-gradient. */
    gradient?: string;
  };
  colors: {
    /** --slide-color-heading */
    heading: string;
    /** --slide-color-body */
    body: string;
    /** --slide-color-surface (card/callout background) */
    surface: string;
    /** --slide-color-muted (captions, secondary text) */
    muted: string;
  };
  spacing: {
    /** --slide-padding (default: '8%') */
    slide: string;
    /** --slide-gap (default: '1.5rem') */
    stack: string;
  };
  border?: {
    /** --slide-border-radius (default: '0.5rem') */
    radius: string;
  };
};

/**
 * Resolved theme after merging with defaults. All optional fields are filled.
 * Produced by themeCompiler.ts. Never authored directly.
 */
export type ResolvedDeckTheme = Required<DeckTheme> & {
  /** Pre-derived SceneTheme for injection into SceneEngine.sceneTheme. */
  sceneTheme: SceneTheme;
  /** CSS custom property map injected into EngineOverlayHost via SlideMetaWidget. */
  cssVars: Record<string, string>;
};

// ─── Compiled Slide State ─────────────────────────────────────────────────────

/**
 * Describes one NVS-positioned content region within a compiled slide.
 * Used by the layout compiler to produce TextBox DSL props.
 */
export type SlideRegion = {
  /** Stable ID for this region within the slide. */
  id: string;
  /** NVS x-coordinate [0, 1]. */
  x: number;
  /** NVS y-coordinate [0, 1]. */
  y: number;
  /** NVS width [0, 1]. */
  w: number;
  /** NVS height [0, 1]. */
  h: number;
  /** z-index layer. Title regions are layer 1, body regions are layer 0. */
  layer: number;
};

/**
 * The compiled representation of a single slide. Produced by compileDeck()
 * and consumed by SlidePlayer to construct <Scene> children.
 *
 * This type is internal infrastructure — not part of the public API.
 */
export type SlideSpec = {
  /** The stable key from the <Slide key="..."> prop. Also becomes the Scene id. */
  key: string;
  layout: SlideLayout;
  transition: SlideTransition;
  notes: string | undefined;
  scrollUnits: number;
  /** NVS regions computed by layoutCompiler.ts. */
  regions: SlideRegion[];
  /** The title string for this slide (used in metadata + accessibility). */
  title: string | undefined;
  /** Whether any BulletList/NumberedList in this slide has animateEntrance=true. */
  hasAnimatedList: boolean;
  /** If hasAnimatedList, the total bullet count (for sceneProgress-based reveals). */
  totalBullets: number;
  /**
   * Optional additional Scene DSL children (3D elements, camera overrides, lighting overrides).
   * Injected as siblings of the auto-generated TextBox/environment elements.
   */
  sceneDsl?: ReactNode;
  /**
   * Where within the scene [0..1] navigation should land when transitioning TO this slide.
   * 0 = scene start (default). 0.5 = halfway through the scene's blockProgress range.
   *
   * Use this to let entry animations (e.g. chart animateEntry) play during the transition.
   * A value of 0.5 means the transition animates progress from the previous scene to 50%
   * through this scene, giving blockProgress-driven animations time to complete.
   */
  restProgress?: number;
};

/**
 * The compiled representation of a full deck. Produced by compileDeck().
 * Contains all slides in declaration order.
 */
export type DeckSpec = {
  slides: SlideSpec[];
  theme: ResolvedDeckTheme;
  transition: SlideTransition;
};

// ─── Imperative Handle ────────────────────────────────────────────────────────

/**
 * Imperative handle exposed by SlidePlayer via React.forwardRef.
 * Use for programmatic navigation and WebGL canvas snapshot capture (for print).
 */
export interface SlidePlayerHandle {
  /** Navigate to the slide at the given 0-based logical index. */
  goTo(index: number): void;
  /** Navigate to the next logical slide. No-ops on the last slide. */
  next(): void;
  /** Navigate to the previous logical slide. No-ops on the first slide. */
  prev(): void;
  /**
   * Seeks the engine to each slide sequentially, captures the WebGL canvas
   * as a PNG data URL, then restores the original slide.
   *
   * IMPORTANT: This is async and must be awaited before calling window.print().
   * Used by the v1.1 SlidePrintLayout component and by authors building custom
   * print flows.
   *
   * @returns Map from slideKey (= Scene id) to PNG data URL string.
   */
  captureSlideSnapshots(): Promise<Map<string, string>>;
}

// ─── Print ───────────────────────────────────────────────────────────────────

/**
 * Options for the v1.1 SlidePrintLayout component.
 * Defined here in v1.0 so the type is stable when v1.1 implements it.
 */
export type PrintOptions = {
  /** Page size for @page CSS rule. Default: '16x9' (16in × 9in landscape). */
  pageSize: 'letter' | 'a4' | '16x9';
  /** When true, renders speaker notes below each slide. Default: false. */
  includeNotes: boolean;
};

// ─── Progress Indicator ───────────────────────────────────────────────────────

/**
 * Visual style for the SlideProgressIndicator.
 * - 'dots': clickable dot per slide (default)
 * - 'bar': thin progress bar at top
 * - 'numbers': "N / total" counter
 * - 'none': no indicator
 */
export type ProgressStyle = 'dots' | 'bar' | 'numbers' | 'none';

// ─── Navigation Config ────────────────────────────────────────────────────────

/**
 * Optional navigation configuration for SlidePlayer.
 * All fields default to true (navigation enabled).
 */
export type SlideNavigationConfig = {
  /** Enable keyboard navigation (window-scoped). Default: true. */
  keyboard?: boolean;
  /** Enable pointer navigation (click → next, right-click → prev). Default: true. */
  pointer?: boolean;
  /** Enable touch swipe navigation. Default: true. */
  touch?: boolean;
  /** Enable mouse wheel navigation. Default: false. */
  wheel?: boolean;
  /** Keyboard scope. 'window' = global listener; 'canvas' = listener on the engine container. Default: 'window'. */
  scope?: 'window' | 'canvas';
};

