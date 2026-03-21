// Type contracts for @brewsite/slides. No runtime or Three.js imports.

import type { ReactNode } from 'react';
import type { SceneLength } from '@brewsite/core';

// ─── Layout Variants ──────────────────────────────────────────────────────────

/**
 * Identifies which built-in layout template a slide uses.
 * Each variant maps to a fixed set of NVS-positioned TextBox regions.
 */
export type SlideLayout =
  // Phase 1B Core (12 layouts)
  | 'title'
  | 'section'
  | 'content'
  | 'two-column'
  | 'image'
  | 'full-bleed'
  | 'blank'
  | 'big-number'
  | 'metric-grid'
  | 'comparison'
  | 'quote'
  | 'agenda'
  // Phase 1B+ Fast-Follow (7 layouts)
  | 'timeline'
  | 'process'
  | 'team'
  | 'closing'
  | 'bento'
  | 'dashboard'
  | 'matrix';

// ─── Slide Transitions (expanded) ────────────────────────────────────────────

/**
 * Slide transition type. Applied to the HTML overlay layer (CSS animation).
 * Three.js content between slides uses standard compiled transition specs.
 */
export type SlideTransition =
  | 'dissolve'
  | 'cut'
  | 'fade'
  | 'push-left'
  | 'push-right'
  | 'push-up'
  | 'push-down'
  | 'zoom-in'
  | 'zoom-out';

// ─── Entrance Animations ──────────────────────────────────────────────────────

/** Entrance animation type for slide region content. */
export type EntranceType =
  | 'fadeIn'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'grow'
  | 'none';

/** Per-region entrance animation configuration. */
export type SlideRegionEntrance = {
  title?: EntranceType;
  body?: EntranceType;
  left?: EntranceType;
  right?: EntranceType;
  /** Progress delay between regions, default 0. */
  stagger?: number;
};

// ─── SlideTheme ──────────────────────────────────────────────────────────────

/**
 * Presentation-specific behavioral and density tokens.
 * "How slides feel" — timing, density, typography scale, component sizing.
 * Orthogonal to SceneTheme (visual) and SlideTemplate (branding).
 */
export type SlideTheme = {
  /** Animation and transition timing. */
  readonly timing: {
    /** Slide-to-slide CSS transition duration. Default: '300ms'. */
    readonly transitionDuration: string;
    /** Default entrance animation progress window [0-1]. Default: 0.3. */
    readonly entranceDuration: number;
    /** Default fly-in / slide-up distance. Default: '24px'. */
    readonly entranceDistance: string;
    /** Default stagger delay between items [0-1]. Default: 0.08. */
    readonly staggerDelay: number;
    /** Stat card count-up progress window [0-1]. Default: 0.6. */
    readonly countUpDuration: number;
  };

  /** Content density and spacing. */
  readonly density: {
    /** Padding inside slide regions. CSS length string. Default: '48px'. */
    readonly contentPadding: string;
    /** Vertical gap between elements in a region. CSS length string. Default: '16px'. */
    readonly contentGap: string;
    /** Title bar height. Accepts SceneLength (e.g. `'18%'`). Default: `'18%'`. */
    readonly titleHeight: SceneLength;
    /** Inter-region gutter. Accepts SceneLength (e.g. `'2%'`). Default: `'2%'`. */
    readonly gutter: SceneLength;
  };

  /** Typography scale overrides (multiplied against --brewsite-font-size-*). */
  readonly typography: {
    /** Heading scale multiplier. Default: 1.2. */
    readonly headingScale: number;
    /** Body text scale multiplier. Default: 1.1. */
    readonly bodyScale: number;
    /** Caption/label scale multiplier. Default: 1.0. */
    readonly captionScale: number;
  };

  /** Graphical component sizing. */
  readonly components: {
    /** Stat card / callout box border width. Default: '1px'. */
    readonly cardBorderWidth: string;
    /** Timeline connector line thickness. Default: '2px'. */
    readonly timelineConnectorWidth: string;
    /** Timeline milestone dot diameter. Default: '12px'. */
    readonly timelineDotSize: string;
    /** Progress ring default diameter. Default: '64px'. */
    readonly progressRingSize: string;
    /** Progress ring stroke width. Default: '4px'. */
    readonly progressRingThickness: string;
  };
};

// ─── SlideTemplate (forward declaration for Phase 2) ─────────────────────────

/** Brand asset for template placement. */
export type BrandAsset = {
  readonly src: string;
  readonly alt?: string;
  readonly aspectRatio?: string;
};

/**
 * Corporate chrome template. "Whose slides these are."
 * Orthogonal to SceneTheme (visual) and SlideTheme (feel).
 */
export type SlideTemplate = {
  /** Display name for the template. */
  readonly name: string;

  /** Brand assets — logo, wordmark, icon for placement. */
  readonly brand?: {
    readonly logo?: BrandAsset;
    readonly wordmark?: BrandAsset;
    readonly icon?: BrandAsset;
  };

  /** Master slide configuration — elements appearing on every slide. */
  readonly master?: {
    readonly logo?: {
      readonly asset: 'logo' | 'wordmark' | 'icon';
      readonly position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      readonly size?: string;
      readonly opacity?: number;
      readonly excludeLayouts?: SlideLayout[];
    };
    readonly footer?: {
      readonly text?: string;
      readonly showPageNumbers?: boolean;
      readonly showDate?: boolean;
      readonly position?: 'bottom-left' | 'bottom-center' | 'bottom-right';
      readonly excludeLayouts?: SlideLayout[];
    };
    readonly watermark?: {
      readonly text?: string;
      readonly image?: string;
      readonly opacity?: number;
    };
  };

  /** Default transition for all slides (overridable per-slide). */
  readonly defaultTransition?: SlideTransition;

  /** Default progress indicator style. */
  readonly defaultProgressIndicator?: ProgressStyle;
};

// ─── Resolved Config ──────────────────────────────────────────────────────────

/**
 * Resolved slide configuration after merging SlideTheme with defaults.
 * All required fields are filled. Produced by themeCompiler.ts.
 */
export type ResolvedSlideConfig = {
  /** Fully resolved SlideTheme (all fields present). */
  readonly slideTheme: Required<SlideTheme>;
  /** CSS custom property map for --slide-* namespace. */
  readonly cssVars: Record<string, string>;
};

// ─── Compiled Slide State ─────────────────────────────────────────────────────

/**
 * Describes one NVS-positioned content region within a compiled slide.
 * Used by the layout compiler to produce TextBox DSL props.
 */
export type SlideRegion = {
  /** Stable ID for this region within the slide. */
  id: string;
  /** NVS x-coordinate. Accepts SceneLength (e.g. `'10%'`). */
  x: SceneLength;
  /** NVS y-coordinate. Accepts SceneLength. */
  y: SceneLength;
  /** NVS width. Accepts SceneLength. */
  w: SceneLength;
  /** NVS height. Accepts SceneLength. */
  h: SceneLength;
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
  transition: SlideTransition;
};

// ─── Graphics component types ──────────────────────────────────────────────

/** Discriminated cell type for ComparisonTable. */
export type ComparisonCellValue =
  | { readonly kind: 'check'; readonly value: boolean }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number };

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
