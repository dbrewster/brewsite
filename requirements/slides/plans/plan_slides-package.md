---
title: "Implementation Plan: @brewsite/slides Package"
doc_type: plan
owner: brewsite-architect
status: active
updated: 2026-03-05
change_history:
  - date: 2026-03-05
    author: brewsite-architect
    summary: "Initial plan authored. Resolved architectural decisions A/B/C/D. Specified 5 parallel work streams."
  - date: 2026-03-05
    author: brewsite-architect (plan debate review)
    summary: "Amended after self-review. Key fixes: (1) SlideContentWithProgress now reads sceneProgress from VariableStoreContext at render time instead of frozen prop — prevents animated bullets from staying at progress=0. (2) @brewsite/core moved from dependencies to peerDependencies to match monorepo pattern. (3) Removed empty sceneProgressMap useMemo from SlidePlayer. (4) Fixed corePlugin() call — removed non-existent onSceneChange option. (5) Clarified primitives/ directory doesn't exist — all text primitives live in dsl.tsx. (6) Added VariableStoreContext export verification note."
  - date: 2026-03-05
    author: brewsite-architect (pm-2 review response)
    summary: "10 defects fixed after pm-2 formal review: (C1) Navigation API corrected — goToScene/setControlledProgress/getProgress do not exist; replaced with scrollToProgress/setRawProgress/getGlobalProgress and cumulative-scrollUnits progress derivation. (C2+C5) VariableStoreContext not exported from @brewsite/core; replaced with useVariable hook in SlideContentWithProgress and useSlideNotes. (C4) manifestUrl='' runtime fetch failure fixed with EMPTY_MANIFEST_URL data-URL constant. (H6) Double onSlideChange fire: restored corePlugin({onSceneChange}) and removed conflicting useEffect from SlidePlayerInner. (H7) countAnimatedListItems returns 0 for two-column layout — fixed to count both columns. (H8) NavigationConfig.scope never wired — added scope-aware keyboard handler. (M9) ProgressStyle moved from SlideProgressIndicator.tsx to types.ts. (M10) captureSlideSnapshots progress fixed to use cumulative scrollUnits not i/(n-1). (+) SceneCanvas ref prop corrected from canvasRef to ref."
---

# Implementation Plan: `@brewsite/slides` Package

## Architectural Decisions

Before reading the implementation details, understand the four decisions made here that resolve the PM's open questions.

### Decision A — Bullet Animation Mechanism: **Option C chosen**

**Choice:** Add `sceneProgress?: number` as an optional field to `SceneTrackTick` in `packages/core/src/compiler/sceneTrackTypes.ts`, and populate it during the frame-allocation pass in `sceneTrackCompiler.ts`.

**Justification:** Option A (multi-scene expansion) creates a leaky abstraction: every consumer of `sceneIndex` must be patched with a logical-index layer. A 20-slide deck with 4 animated bullets each produces 100 scenes. Navigation, presenter view, progress indicators, and any future consumer all break. Option C requires a ~6-line change to two core files, is non-breaking (optional field), and keeps the invariant that one slide = one scene always.

The key insight: `sceneProgress` is semantically distinct from `blockProgress`. `blockProgress` is "position within this scene's exit transition block" — it is 0 at the moment the user arrives at a scene, and 1 at the moment they complete the exit. For a single-scene deck (one tick), the terminal tick has `blockProgress = 0` (explicitly set by the compiler). With `sceneProgress`, the terminal tick is set to `1` (user is fully "inside" the last scene). For all other ticks, `sceneProgress = blockProgress`. This gives `SlideLayoutWidget.apply()` a correct [0,1] coordinate within each scene for computing `visibleBullets`.

**Core change scope:** Two files only — `sceneTrackTypes.ts` (add field) and `sceneTrackCompiler.ts` (populate field). See §7.

### Decision B — `SlidePlayer` Internals

**Choice:** `SlidePlayer` owns its own `EngineProvider`. It renders the complete engine stack internally: `EngineProvider` → `EngineARContainer` → `EngineInputRegion` → `SceneCanvas` + `EngineOverlayHost`. No `widgetRegistry` prop is exposed. Users extend via `plugins` prop. The `SlidePlayer` does NOT call `createDefaultWidgetRegistry` — it uses the `WidgetPlugin` system via `corePlugin()` + `slidesPlugin()` + user-provided plugins.

**Justification:** Exposing a `widgetRegistry` prop would require the caller to understand `WidgetRegistry` internals. The plugin system is the right abstraction. Advanced users who need full control use `EngineProvider` + `slidesPlugin()` directly — `SlidePlayer` is the "batteries included" path only.

### Decision C — `MediaLayout` Scope

**Choice:** Confirmed deferred to v1.1. The v1.0 escape hatch is raw DSL: place `<DiagramCanvas x={0.52} y={0} w={0.48} h={1}>` directly inside a `<Slide>` (which compiles to `<Scene>`) alongside `<TextBox x={0} y={0} w={0.48} h={1}>` for the text side. `DiagramCanvasDSL` already supports `x/y/w/h` NVS props. This is documented in the API surface, not hidden.

### Decision D — `captureSlideSnapshots()` Implementation

**Choice:** On-demand, sequential, no internal cache.

**Steps:**
1. Save current global progress: `const savedProgress = engine.getGlobalProgress();` — `getGlobalProgress` is typed `() => number`; calling it returns the current value directly.
2. Seek to each slide in order: for slide index `i`, compute `targetProgress = computeSlideStartProgress(spec.slides.map(s => s.scrollUnits), i)` (cumulative scrollUnits / total — see §8). Call `engine.scrollToProgress(targetProgress)` for each slide 0..N-1.
3. After seeking, wait exactly two `requestAnimationFrame` ticks (wrapped in `Promise`) to guarantee Three.js has rendered the new frame.
4. Call `canvasRef.current.toDataURL('image/png')` where `canvasRef` is a `RefObject<HTMLCanvasElement>` passed by `SceneCanvas` via `ref` (not `canvasRef`). The canvas ref is passed from `SlidePlayer` → `SlidePlayerInner` and used by `useImperativeHandle`.
5. Store in `Map<string, string>` keyed by `slideKey` (= the `<Slide key="...">` prop value = sceneId).
6. Restore: `engine.scrollToProgress(savedProgress)`.

**Real engine API (from `UseSceneEngineResult` in `useSceneEngine.ts`):**
- `engine.scrollToProgress(p: number): void` — seeks to global progress `p` ∈ [0, 1]
- `engine.getGlobalProgress(): number` — returns the current global progress value directly (confirmed `useCallback((): number => {...})` in useSceneEngine.ts:638)
- `engine.setRawProgress(raw: number): void` — lower-level; not used for snapshot seeking

**Progress calculation:** `computeSlideStartProgress(scrollUnits, i)` = `sum(scrollUnits[0..i-1]) / sum(all scrollUnits)`. This is exact because `ProgressManager` allocates ticks proportionally to scrollUnits, so global progress is piecewise-linear in scrollUnits.

`SlidePlayer` forwards a `canvasRef` internally. The `SlidePlayerHandle.captureSlideSnapshots()` is exposed via `React.forwardRef` + `useImperativeHandle`.

---

## §1 — Package Setup

### Directory

```
packages/slides/
├── src/
│   ├── index.ts                  ← public barrel
│   ├── types.ts                  ← all type contracts
│   ├── dsl.tsx                   ← ALL DSL + text primitives in one file
│   │                               (Slide, TitleLayout, TwoColumnLayout, FullBleedLayout,
│   │                               BlankLayout, SlideContent, Heading, Body, BulletList,
│   │                               NumberedList — all in dsl.tsx; no separate primitives/ dir)
│   ├── theme.ts                  ← DeckTheme type, defaultDeckTheme, darkDeckTheme
│   ├── compiler/
│   │   ├── deckCompiler.ts       ← SlidePlayer Slide→Scene transform
│   │   ├── layoutCompiler.ts     ← NVS region math per layout variant
│   │   └── themeCompiler.ts      ← DeckTheme → SceneTheme + CSS var map
│   ├── widget/
│   │   ├── SlideMetaWidget.ts    ← publishes slide metadata to VariableStore
│   │   └── SlideNavWidget.ts     ← scene.slide-next / scene.slide-prev actions
│   ├── player/
│   │   ├── SlidePlayer.tsx       ← primary public component
│   │   ├── SlideProgressIndicator.tsx
│   │   ├── useSlideNavigation.ts
│   │   └── useSlideNotes.ts      ← fully implemented; used by v1.1 PresenterView
│   └── plugin.ts                 ← slidesPlugin() factory + SlideMetaDsl marker
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── vitest.config.ts
```

### `packages/slides/package.json`

```json
{
  "name": "@brewsite/slides",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "build:lib": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  },
  "peerDependencies": {
    "@brewsite/core": "workspace:*",
    "react": "^18 || ^19",
    "react-dom": "^18 || ^19",
    "three": "^0.183.1",
    "@brewsite/diagram": "^0.5.0",
    "@brewsite/model": "^0.5.0",
    "@brewsite/charts": "^0.5.0"
  },
  "peerDependenciesMeta": {
    "@brewsite/diagram": { "optional": true },
    "@brewsite/model": { "optional": true },
    "@brewsite/charts": { "optional": true }
  },
  "devDependencies": {
    "@brewsite/core": "workspace:*",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.183.1",
    "@vitejs/plugin-react": "^4.7.0",
    "@vitest/coverage-v8": "^2.1.9",
    "typescript": "^5.9.3",
    "vite": "^5.4.21",
    "vitest": "^2.1.9"
  }
}
```

**Rationale:** `@brewsite/core` is a required peer dependency, matching the pattern of `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts`. All four packages declare core as a peer to avoid bundling two core instances when the consuming app also has core installed. The workspace `devDependencies` entry provides the local `tsc`/`vitest` resolution path. React, three, and diagram/model/charts remain peers. diagram/model/charts are optional peers — only needed when the deck contains their elements.

### `packages/slides/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@brewsite/core": ["../core/src/index.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

### `packages/slides/tsconfig.build.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "outDir": "./dist",
    "jsx": "react-jsx",
    "strict": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "**/__tests__/**", "**/*.test.*"]
}
```

### `packages/slides/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/index.ts', 'src/**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@brewsite/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
```

### Root `pnpm-workspace.yaml` — no change needed

`packages/*` glob already covers `packages/slides/`.

### Root `turbo.json` — no change needed

Existing `build`, `build:lib`, `typecheck`, `test`, `coverage` tasks apply automatically to `@brewsite/slides` via the `packages/*` pattern. Dependency ordering is via `dependsOn: ["^build"]` — `@brewsite/slides` will wait for `@brewsite/core` to build first.

---

## §2 — Type System (`packages/slides/src/types.ts`)

This file is the single source of truth for all type contracts in `@brewsite/slides`. No runtime imports, no Three.js, no React. Imports `SceneTheme` from `@brewsite/core`.

```typescript
// packages/slides/src/types.ts
// Type contracts for @brewsite/slides. No runtime, Three.js, or React imports.

import type { SceneTheme } from '@brewsite/core';
import type { RefObject } from 'react';

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
  /** Pre-derived SceneTheme for injection into EngineProvider.sceneTheme. */
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
```

---

## §3 — DSL Components (`packages/slides/src/dsl.tsx`)

DSL components are React components that return `null`. They are compile-time markers — walked by `deckCompiler.ts` using `React.Children` inspection, never rendered directly. Each has a stable `displayName` for identification.

```typescript
// packages/slides/src/dsl.tsx
// DSL components for slide deck authoring. All return null — compiled, not rendered.

import type { ReactNode } from 'react';
import type { SlideLayout, SlideTransition, SlideNavigationConfig } from './types';

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
export const Heading = ({ level = 2, children, color }: HeadingProps): JSX.Element => {
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
export const Body = ({ children }: BodyProps): JSX.Element => (
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
 * increases (requires sceneProgress field on SceneTrackTick — see §7).
 * When animateEntrance=false (default), all bullets are visible immediately.
 */
export const BulletList = ({ items, animateEntrance: _a, bulletStyle = 'disc', visibleCount }: BulletListProps): JSX.Element => {
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
export const NumberedList = ({ items, animateEntrance: _a, visibleCount }: NumberedListProps): JSX.Element => {
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
```

---

## §4 — Theme System (`packages/slides/src/theme.ts` and `packages/slides/src/compiler/themeCompiler.ts`)

### `packages/slides/src/theme.ts`

```typescript
// packages/slides/src/theme.ts
// Built-in DeckTheme instances and factory function.

import type { DeckTheme } from './types';

export const defaultDeckTheme: DeckTheme = {
  fonts: {
    heading: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  colorMode: 'light',
  accentColor: '#2563eb',
  background: { color: '#ffffff' },
  colors: {
    heading: '#111111',
    body: '#374151',
    surface: '#f3f4f6',
    muted: '#9ca3af',
  },
  spacing: { slide: '8%', stack: '1.5rem' },
  border: { radius: '0.5rem' },
};

export const darkDeckTheme: DeckTheme = {
  fonts: {
    heading: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  colorMode: 'dark',
  accentColor: '#60a5fa',
  background: { color: '#0f172a' },
  colors: {
    heading: '#f8fafc',
    body: '#cbd5e1',
    surface: '#1e293b',
    muted: '#64748b',
  },
  spacing: { slide: '8%', stack: '1.5rem' },
  border: { radius: '0.5rem' },
};

/**
 * Creates a DeckTheme by merging partial overrides with the default light theme.
 * Deep-merges nested objects; top-level fields from overrides win.
 */
export function createDeckTheme(overrides: Partial<DeckTheme>): DeckTheme {
  return {
    ...defaultDeckTheme,
    ...overrides,
    fonts: { ...defaultDeckTheme.fonts, ...overrides.fonts },
    background: { ...defaultDeckTheme.background, ...overrides.background },
    colors: { ...defaultDeckTheme.colors, ...overrides.colors },
    spacing: { ...defaultDeckTheme.spacing, ...overrides.spacing },
    border: { ...defaultDeckTheme.border, ...overrides.border },
  };
}
```

### `packages/slides/src/compiler/themeCompiler.ts`

```typescript
// packages/slides/src/compiler/themeCompiler.ts
// Pure function: DeckTheme → ResolvedDeckTheme.
// No React, No Three.js, no runtime imports.

import type { DeckTheme, ResolvedDeckTheme } from '../types';
import type { SceneTheme } from '@brewsite/core';
import { defaultDeckTheme } from '../theme';

/**
 * Merges the provided DeckTheme with defaults and derives:
 *  - A SceneTheme for injection into EngineProvider.sceneTheme
 *  - A CSS variable map for the --slide-* namespace injected by SlideMetaWidget
 *
 * This function is pure: same inputs always produce the same output.
 */
export function compileDeckTheme(theme?: Partial<DeckTheme>): ResolvedDeckTheme {
  const merged: DeckTheme = {
    ...defaultDeckTheme,
    ...theme,
    fonts: { ...defaultDeckTheme.fonts, ...theme?.fonts },
    background: { ...defaultDeckTheme.background, ...theme?.background },
    colors: { ...defaultDeckTheme.colors, ...theme?.colors },
    spacing: { ...defaultDeckTheme.spacing, ...theme?.spacing },
    border: { ...defaultDeckTheme.border, ...theme?.border },
  };

  // Derive SceneTheme from DeckTheme fields (1:1 mapping)
  const sceneTheme: SceneTheme = {
    font: {
      htmlFamily: merged.fonts.heading,
    },
    fontSize: {
      heading: 2.4,   // rem multiplier
      body: 1.0,
      label: 0.875,
      caption: 0.75,
      annotation: 0.7,
    },
    colorMode: merged.colorMode,
    accentColor: merged.accentColor,
  };

  // CSS variable map for --slide-* namespace
  const cssVars: Record<string, string> = {
    '--slide-padding': merged.spacing.slide,
    '--slide-gap': merged.spacing.stack,
    '--slide-color-heading': merged.colors.heading,
    '--slide-color-body': merged.colors.body,
    '--slide-color-surface': merged.colors.surface,
    '--slide-color-muted': merged.colors.muted,
    '--slide-border-radius': merged.border?.radius ?? '0.5rem',
  };
  if (merged.fonts.body) cssVars['--slide-font-body'] = merged.fonts.body;
  if (merged.fonts.mono) cssVars['--slide-font-mono'] = merged.fonts.mono;
  if (merged.background.gradient) cssVars['--slide-bg-gradient'] = merged.background.gradient;

  return { ...merged, sceneTheme, cssVars };
}
```

---

## §5 — Compiler (`packages/slides/src/compiler/`)

### `packages/slides/src/compiler/layoutCompiler.ts`

Pure function that maps each `SlideLayout` variant to a set of `SlideRegion` descriptors in NVS space. No React, no Three.js.

```typescript
// packages/slides/src/compiler/layoutCompiler.ts
// Pure: SlideLayout + available props → SlideRegion[]. No React, no Three.js.

import type { SlideLayout, SlideRegion } from '../types';

type LayoutInput = {
  layout: SlideLayout;
  hasTitle: boolean;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
};

const TITLE_H = 0.18;   // 18% of slide height for title bar
const GUTTER = 0.02;    // 2% gutter between title and body
const COL_GAP = 0.04;   // 4% gap between two columns

/**
 * Returns the NVS region descriptors for each TextBox slot in the given layout.
 * IDs are stable (e.g. 'title', 'body', 'left', 'right') and are used as
 * TextBox widget IDs (prefixed with the slide key by deckCompiler.ts).
 *
 * Pure function: same inputs always produce the same output.
 */
export function compileLayout(input: LayoutInput): SlideRegion[] {
  const { layout, hasTitle, overlayPosition } = input;

  switch (layout) {
    case 'title': {
      return [{
        id: 'title',
        x: 0, y: 0, w: 1, h: 1,
        layer: 1,
      }];
    }

    case 'title-body': {
      const bodyY = TITLE_H + GUTTER;
      const bodyH = 1 - bodyY - GUTTER;
      return [
        { id: 'title', x: 0, y: GUTTER, w: 1, h: TITLE_H - GUTTER, layer: 1 },
        { id: 'body',  x: 0, y: bodyY,  w: 1, h: bodyH,             layer: 0 },
      ];
    }

    case 'two-column': {
      const colW = (1 - COL_GAP) / 2;
      const bodyY = hasTitle ? TITLE_H + GUTTER : GUTTER;
      const bodyH = 1 - bodyY - GUTTER;
      const regions: SlideRegion[] = [
        { id: 'left',  x: 0,             y: bodyY, w: colW, h: bodyH, layer: 0 },
        { id: 'right', x: colW + COL_GAP, y: bodyY, w: colW, h: bodyH, layer: 0 },
      ];
      if (hasTitle) {
        regions.unshift({ id: 'title', x: 0, y: GUTTER, w: 1, h: TITLE_H - GUTTER, layer: 1 });
      }
      return regions;
    }

    case 'full-bleed': {
      // Overlay text in a corner or center; small region
      const OVERLAY_W = 0.4;
      const OVERLAY_H = 0.3;
      const PAD = 0.04;
      const pos = overlayPosition ?? 'bottom-left';
      let x = 0, y = 0;
      if (pos === 'top-left')     { x = PAD; y = PAD; }
      if (pos === 'top-right')    { x = 1 - OVERLAY_W - PAD; y = PAD; }
      if (pos === 'bottom-left')  { x = PAD; y = 1 - OVERLAY_H - PAD; }
      if (pos === 'bottom-right') { x = 1 - OVERLAY_W - PAD; y = 1 - OVERLAY_H - PAD; }
      if (pos === 'center')       { x = (1 - OVERLAY_W) / 2; y = (1 - OVERLAY_H) / 2; }
      return [{ id: 'overlay', x, y, w: OVERLAY_W, h: OVERLAY_H, layer: 1 }];
    }

    case 'blank':
      return [];

    default:
      return [];
  }
}
```

### `packages/slides/src/compiler/deckCompiler.ts`

Transforms the `<SlidePlayer>` children (an array of `<Slide>` elements) into two things:
1. A `DeckSpec` (internal compiled representation)
2. A `ReactElement[]` of `<Scene>` elements to pass to `EngineProvider`

**Key design choice (resolving Q1 and Q2):** `SlidePlayer.render()` performs the transformation directly using `React.Children.map()`. It does NOT use a NodeHandler. The layout components (`<TitleBodyLayout>`, etc.) are React components, not DSL nodes — they are inspected by examining `element.type === TitleBodyLayout` via reference equality. The transform produces literal `<TextBox>` DSL elements using props extracted from the layout component props. Standard `TextBoxWidget` handles all text regions. No `SlideLayoutWidget` exists — it is not needed.

```typescript
// packages/slides/src/compiler/deckCompiler.ts
// Transforms <Slide> children into DeckSpec + <Scene> ReactElement[].
// Pure function at the DeckSpec level. Scene element construction uses React.createElement.

import React, { Children, isValidElement, type ReactElement } from 'react';
import type { DeckSpec, DeckTheme, SlideSpec, SlideTransition, SlideLayout } from '../types';
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
import { TextBox, Scene, ProgressManager } from '@brewsite/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_SCROLL_UNITS_TITLE = 100;
const DEFAULT_SCROLL_UNITS_BODY = 400;

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
  contentChildren: React.ReactNode;
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

  let layoutInfo = layoutEl
    ? extractLayoutInfo(layoutEl)
    : { layout: 'blank' as SlideLayout, title: undefined, hasTitle: false, contentChildren: null };

  // Count animated list items in the body content
  const bodyContent = layoutInfo.contentChildren;
  let totalBullets: number;
  if (typeof bodyContent === 'object' && bodyContent !== null && 'left' in bodyContent) {
    // Two-column layout: count animated list items in both columns separately.
    // Passing null (old behavior) always returned 0 — must iterate both sides.
    const twoCol = bodyContent as { left: React.ReactNode; right: React.ReactNode };
    totalBullets = countAnimatedListItems(twoCol.left) + countAnimatedListItems(twoCol.right);
  } else {
    totalBullets = countAnimatedListItems(bodyContent as React.ReactNode);
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
 * No SlideLayoutWidget exists — this approach reuses TextBoxWidget as-is.
 *
 * IMPORTANT: This function is PURE — it produces static JSX that does NOT depend
 * on runtime state (sceneProgress, engine state, etc.). The `SlideContentWithProgress`
 * component placed in the TextBox children reads sceneProgress via the `useVariable` hook
 * at render time, ensuring correct bullet reveals without recompiling the SceneTrack.
 */
export function buildSceneElements(
  slides: ReactElement<Record<string, unknown>>[],
  spec: DeckSpec,
): ReactElement[] {
  return spec.slides.map((slideSpec, i) => {
    const slideEl = slides[i]!;
    const props = slideEl.props;
    const children = Children.toArray(props['children'] as React.ReactNode);
    const layoutEl = children.find((c) => isValidElement(c)) as ReactElement<Record<string, unknown>> | undefined;
    const layoutInfo = layoutEl ? extractLayoutInfo(layoutEl) : { layout: 'blank' as SlideLayout, title: undefined, hasTitle: false, contentChildren: null };

    // Build TextBox children for each region
    const textBoxElements = slideSpec.regions.map((region) => {
      let regionContent: React.ReactNode = null;

      if (slideSpec.layout === 'title') {
        regionContent = layoutInfo.contentChildren as React.ReactNode;
      } else if (slideSpec.layout === 'title-body') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-padding, 8%)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--slide-color-heading)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else {
          // body region — SlideContentWithProgress reads sceneProgress via useVariable hook
          // at render time (NOT from a frozen prop) so animated bullet reveals work correctly.
          regionContent = (
            <div style={{ height: '100%', padding: '0 var(--slide-padding, 8%) var(--slide-padding, 8%)', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--slide-gap, 1.5rem)' }}>
              <SlideContentWithProgress slideKey={slideSpec.key} totalBullets={slideSpec.totalBullets}>
                {layoutInfo.contentChildren as React.ReactNode}
              </SlideContentWithProgress>
            </div>
          );
        }
      } else if (slideSpec.layout === 'two-column') {
        if (region.id === 'title') {
          regionContent = (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 var(--slide-padding, 8%)' }}>
              <h2 style={{ fontFamily: 'var(--brewsite-font-family)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--slide-color-heading)', margin: 0 }}>{slideSpec.title}</h2>
            </div>
          );
        } else {
          const twoColContent = layoutInfo.contentChildren as { left: React.ReactNode; right: React.ReactNode } | null;
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
            {layoutInfo.contentChildren as React.ReactNode}
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

    // Import Background and build scene children
    // NOTE: Background, Camera, Lighting imports are handled in SlidePlayer.tsx
    // where this function is called — the slide Scene is constructed there.
    return React.createElement(
      Scene,
      { key: slideSpec.key, id: slideSpec.key },
      React.createElement(ProgressManager, { key: 'pm', scrollUnits: slideSpec.scrollUnits }),
      // SlideMetaDsl is a marker that SlideMetaWidget's NodeHandler reads.
      // It carries notes, title, and logical slide index (i).
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
```

**Note:** `SlideContentWithProgress` is a React component defined in `player/SlidePlayer.tsx`. It reads `sceneProgress` via the `useVariable(SLIDE_META_NAMESPACE, slideKey + '.sceneProgress')` hook at render time, then clones `BulletList` and `NumberedList` children to inject the computed `visibleCount` prop. It does NOT accept `sceneProgress` as a prop — that would freeze the value at the time `buildSceneElements` runs. The re-render chain is: `SlideMetaWidget.apply()` writes sceneProgress to VariableStore → EngineOverlayHost re-renders (subscribed to VariableStore) → `SlideContentWithProgress` re-renders as a child, reading fresh sceneProgress via `useVariable`. `VariableStoreContext` is NOT used — it is not exported from `@brewsite/core`. See §8 for the full component definition.

`SlideMetaDsl` is a DSL marker component defined in `plugin.ts`. See §5b.

---

## §5b — SlideMetaDsl (internal DSL marker)

```typescript
// packages/slides/src/plugin.ts (partial — full file in §9)

/** Internal DSL marker node. Read by SlideMetaWidget's NodeHandler. */
export type SlideMetaDslProps = {
  id: string;
  slideKey: string;
  logicalIndex: number;
  totalSlides: number;
  notes?: string;
  title?: string;
  hasAnimatedList: boolean;
  totalBullets: number;
};

export const SlideMetaDsl = (_props: SlideMetaDslProps): null => null;
SlideMetaDsl.displayName = 'SlideMetaDsl';
```

---

## §6 — Widget Layer (`packages/slides/src/widget/`)

### `packages/slides/src/widget/SlideMetaWidget.ts`

Implements `ISceneElement<SlideMetaState>` and `IRenderable<SlideMetaState>`. On every tick, publishes slide metadata to the `VariableStore` under the `'slide:meta'` namespace.

```typescript
// packages/slides/src/widget/SlideMetaWidget.ts
// Publishes slide metadata (notes, title, logical index) to VariableStore each tick.

import type {
  IWidget,
  ISceneElement,
  IRenderable,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import type { VariableStore } from '@brewsite/core';
import { SlideMetaDsl } from '../plugin';

/** INVARIANT: same namespace used by useSlideNotes hook. */
export const SLIDE_META_NAMESPACE = 'slide:meta';

export type SlideMetaState = {
  /** The stable slide key (= Scene id). */
  slideKey: string;
  /** 0-based logical slide index. Used by progress indicator. */
  logicalIndex: number;
  /** Total logical slide count for this deck. */
  totalSlides: number;
  /** Speaker notes. Undefined when no notes were authored. */
  notes: string | undefined;
  /** Slide title. */
  title: string | undefined;
  /** Whether this slide has an animated bullet/number list. */
  hasAnimatedList: boolean;
  /** Total animated bullet count (for sceneProgress-based reveals). */
  totalBullets: number;
};

export const slideMeta_FunctionalTransitionSpec: FunctionalTransitionSpec<SlideMetaState> = {
  // Snap to toState immediately — metadata does not animate.
  exitFn: (from) => (_ctx) => from,
  enterFn: (to) => (_ctx) => to,
  interpolateFn: (_from, to) => (_ctx) => to,
};

/**
 * Publishes slide metadata to VariableStore on every tick.
 * One instance per deck (shared by all slides — the state varies per-scene).
 */
export class SlideMetaWidget
  implements IWidget, ISceneElement<SlideMetaState>, IRenderable<SlideMetaState>
{
  readonly widgetId = 'slide-meta';
  readonly DslComponent = SlideMetaDsl;
  readonly transitionSpec = slideMeta_FunctionalTransitionSpec;

  readonly defaultState: SlideMetaState = {
    slideKey: '',
    logicalIndex: 0,
    totalSlides: 1,
    notes: undefined,
    title: undefined,
    hasAnimatedList: false,
    totalBullets: 0,
  };

  initialize(_context: WidgetInitContext): void {
    // No Three.js setup.
  }

  apply(state: SlideMetaState, ctx: WidgetRenderContext): void {
    const store = ctx.variables as unknown as VariableStore;
    store.set(SLIDE_META_NAMESPACE, 'currentSlideKey', state.slideKey);
    store.set(SLIDE_META_NAMESPACE, 'currentLogicalIndex', state.logicalIndex);
    store.set(SLIDE_META_NAMESPACE, 'totalSlides', state.totalSlides);
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.notes`, state.notes ?? null);
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.title`, state.title ?? null);
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.hasAnimatedList`, state.hasAnimatedList ? 1 : 0);
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.totalBullets`, state.totalBullets);
    // sceneProgress is read from WidgetRenderContext.tick.sceneProgress (Decision A, Option C)
    // and stored so SlidePlayer can read it to inject visibleCount into BulletList.
    const sp = (ctx.tick as { sceneProgress?: number } | null | undefined)?.sceneProgress ?? 0;
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.sceneProgress`, sp);
  }

  dispose(): void {
    // No resources to release.
  }
}
```

### `packages/slides/src/widget/SlideNavWidget.ts`

`SlideNavWidget` provides the `slide.next` and `slide.prev` InputController actions. It reads `currentLogicalIndex` and `totalSlides` from VariableStore to navigate correctly even when the feature note's future multi-scene expansion is used (though with Decision A = Option C, scene count always equals logical slide count).

```typescript
// packages/slides/src/widget/SlideNavWidget.ts
// Provides slide.next and slide.prev actions by reading engine state.

import type { IWidget } from '@brewsite/core';

/**
 * SlideNavWidget is not an ISceneElement — it does not participate in the
 * SceneTrack compilation pipeline. It is registered as a plain IWidget
 * and accessed by SlidePlayer's input controller injection.
 *
 * Navigation is implemented directly in SlidePlayer.tsx via useSlideNavigation.
 * This widget class exists solely as a registry anchor for the widgetId.
 */
export class SlideNavWidget implements IWidget {
  readonly widgetId = 'slide-nav';
}
```

---

## §7 — Core Change: `sceneProgress` in `SceneTrackTick`

This is the Decision A (Option C) change. It touches exactly two files in `packages/core`.

### `packages/core/src/compiler/sceneTrackTypes.ts`

**Add one optional field to `SceneTrackTick`:**

```typescript
// In SceneTrackTick (around line 299):

export type SceneTrackTick = {
  index: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  blockProgress: number;
  /**
   * Normalized progress within this scene, [0, 1].
   *
   * At the first tick of a scene (just arrived), sceneProgress = 0.
   * At the last tick of a scene before transition completes, sceneProgress = 1.
   * For the terminal tick of the final scene, sceneProgress = 1 (user is fully inside).
   *
   * Semantics: this is identical to blockProgress for all non-terminal ticks.
   * The distinction is the terminal tick: blockProgress is reset to 0 (compiler
   * invariant), but sceneProgress is set to 1 (user has fully arrived in the scene).
   *
   * Use case: SlideLayoutWidget reads sceneProgress to compute visibleBullets
   * for animated bullet lists. DiagramCanvas and other elements may also use this
   * for within-scene progressive reveal effects.
   *
   * Optional (not present in tracks compiled before this field was added).
   * Defaults to blockProgress when absent at runtime.
   */
  sceneProgress?: number;
  state: SceneFrame;
  deltaForward: SceneFrameDelta;
  deltaBackward: SceneFrameDelta;
  widgetExtras?: Record<string, unknown>;
};
```

### `packages/core/src/compiler/sceneTrackCompiler.ts`

**Two changes:**

1. In the frame-allocation loop (Step 2, around line 394), set `sceneProgress: bp` alongside `blockProgress: bp`:

```typescript
// Change in frame-allocation Array.from():
return {
  index: globalIdx,
  progress: totalFrames > 1 ? globalIdx / (totalFrames - 1) : 0,
  sceneId: scene.id,
  sceneIndex: blockIdx,
  blockProgress: bp,
  sceneProgress: bp,   // ← ADD THIS LINE
  state: { id: scene.id, scrollProgress: bp, widgets: {} },
  deltaForward: {},
  deltaBackward: {},
};
```

2. In the terminal-tick fix (around line 413), set `sceneProgress = 1`:

```typescript
// Change in terminal-tick fix:
if (lastTick && lastScene) {
  lastTick.sceneId = lastScene.id;
  lastTick.sceneIndex = scenes.length - 1;
  lastTick.blockProgress = 0;
  lastTick.sceneProgress = 1;   // ← ADD THIS LINE (terminal tick = fully in last scene)
  lastTick.state.id = lastScene.id;
}
```

**Backward compatibility:** `sceneProgress` is optional (`?`). All existing code that does not read this field is unaffected. All existing tests pass without modification. The `sceneTrackSampler.ts` (if it exists) passes `tick` as-is, so the field is available to all widgets automatically.

---

## §8 — Player Layer (`packages/slides/src/player/`)

### `packages/slides/src/player/useSlideNavigation.ts`

```typescript
// packages/slides/src/player/useSlideNavigation.ts
// Hook for reading and controlling slide navigation state.

import { useCallback } from 'react';
import { useCurrentScene, useSceneEngineContext } from '@brewsite/core';

export type SlideNavigationState = {
  /** 0-based current logical slide index. */
  current: number;
  /** Total logical slide count. */
  total: number;
  /** Navigate to the slide at the given 0-based index. */
  goTo: (index: number) => void;
  /** Navigate to the next slide. No-op on last slide. */
  next: () => void;
  /** Navigate to the previous slide. No-op on first slide. */
  prev: () => void;
};

/**
 * Computes the normalized global progress [0, 1] for the start of the slide at `index`.
 *
 * Uses cumulative ProgressManager scrollUnits rather than i/(n-1) so that non-uniform
 * scroll budgets (e.g. a title slide with scrollUnits=100 vs body slides with 400) produce
 * correct progress values. The mapping is exact because ProgressManager allocates ticks
 * proportionally to scrollUnits, making global progress piecewise-linear in scrollUnits.
 *
 * @param scrollUnits - Array of scrollUnits per slide (one entry per slide, same order).
 * @param index - 0-based target slide index.
 */
export function computeSlideStartProgress(scrollUnits: number[], index: number): number {
  if (scrollUnits.length === 0) return 0;
  if (scrollUnits.length === 1) return 0;
  const clamped = Math.max(0, Math.min(scrollUnits.length - 1, index));
  const total = scrollUnits.reduce((s, u) => s + u, 0);
  if (total === 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < clamped; i++) {
    cumulative += scrollUnits[i] ?? 0;
  }
  return cumulative / total;
}

/**
 * Reads the current slide index and provides navigation actions.
 * Must be used inside an EngineProvider subtree.
 *
 * With Decision A = Option C, sceneIndex equals logical slide index always
 * (one scene per slide). If multi-scene expansion were ever used (Option A),
 * this hook would need to read from VariableStore instead.
 *
 * @param totalSlides - Total number of logical slides in the deck.
 * @param scrollUnits - Array of scrollUnits per slide (for correct progress mapping).
 */
export function useSlideNavigation(totalSlides: number, scrollUnits: number[]): SlideNavigationState {
  const { sceneIndex } = useCurrentScene();
  const engine = useSceneEngineContext();

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(totalSlides - 1, index));
    // scrollToProgress is the correct API on UseSceneEngineResult.
    // engine.goToScene does not exist — navigate by seeking to the global progress
    // value corresponding to the start of the target slide's scroll window.
    engine.scrollToProgress(computeSlideStartProgress(scrollUnits, clamped));
  }, [engine, totalSlides, scrollUnits]);

  const next = useCallback(() => {
    if (sceneIndex < totalSlides - 1) {
      engine.scrollToProgress(computeSlideStartProgress(scrollUnits, sceneIndex + 1));
    }
  }, [engine, sceneIndex, totalSlides, scrollUnits]);

  const prev = useCallback(() => {
    if (sceneIndex > 0) {
      engine.scrollToProgress(computeSlideStartProgress(scrollUnits, sceneIndex - 1));
    }
  }, [engine, sceneIndex, scrollUnits]);

  return { current: sceneIndex, total: totalSlides, goTo, next, prev };
}
```

### `packages/slides/src/player/useSlideNotes.ts`

```typescript
// packages/slides/src/player/useSlideNotes.ts
// Hook for reading speaker notes from VariableStore.
// Fully implemented for v1.0; used by v1.1 PresenterView.

import { useVariable } from '@brewsite/core';
// NOTE: `useVariable` is exported from @brewsite/core's widget/index.ts.
// `VariableStoreContext` is NOT exported from @brewsite/core and must NOT be used.
import { SLIDE_META_NAMESPACE } from '../widget/SlideMetaWidget';

/**
 * Reads the speaker notes for the slide with the given key.
 * Returns undefined when no notes were authored.
 *
 * Must be used inside an EngineProvider subtree.
 * Reactively re-renders when the notes value changes in VariableStore.
 */
export function useSlideNotes(slideKey: string): string | undefined {
  // useVariable(namespace, key) — subscribes to VariableStore and returns
  // the current value reactively. Returns undefined if no engine is mounted.
  const raw = useVariable(SLIDE_META_NAMESPACE, `${slideKey}.notes`);
  return typeof raw === 'string' ? raw : undefined;
}
```

### `packages/slides/src/player/SlideProgressIndicator.tsx`

```typescript
// packages/slides/src/player/SlideProgressIndicator.tsx
// Visual slide progress indicator: dots, bar, or numbers.

import type { CSSProperties } from 'react';
import type { SlideNavigationState } from './useSlideNavigation';
// ProgressStyle is defined in types.ts (single source of truth).
// Do NOT re-export or re-define it here.
import type { ProgressStyle } from '../types';

type SlideProgressIndicatorProps = {
  nav: SlideNavigationState;
  style: ProgressStyle;
};

export const SlideProgressIndicator = ({ nav, style }: SlideProgressIndicatorProps): JSX.Element | null => {
  if (style === 'none') return null;

  const { current, total, goTo } = nav;

  if (style === 'dots') {
    return (
      <div style={{ position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.5rem', zIndex: 20 }}>
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === current ? '1.25rem' : '0.625rem',
              height: '0.625rem',
              borderRadius: '0.3125rem',
              border: 'none',
              background: i === current
                ? 'var(--brewsite-accent-color, #2563eb)'
                : 'rgba(128,128,128,0.4)',
              cursor: 'pointer',
              padding: 0,
              transition: 'width 0.2s ease, background 0.2s ease',
            }}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    );
  }

  if (style === 'numbers') {
    return (
      <div style={{ position: 'absolute', bottom: '2%', right: '3%', zIndex: 20, fontFamily: 'var(--brewsite-font-family)', fontSize: '0.875rem', color: 'var(--slide-color-muted, rgba(128,128,128,0.7))' }}>
        {current + 1} / {total}
      </div>
    );
  }

  if (style === 'bar') {
    const pct = total > 1 ? ((current + 1) / total) * 100 : 100;
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', zIndex: 20, background: 'rgba(128,128,128,0.2)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brewsite-accent-color, #2563eb)', transition: 'width 0.2s ease' }} />
      </div>
    );
  }

  return null;
};
```

### `packages/slides/src/player/SlidePlayer.tsx`

This is the primary exported component. It is the most complex file in the package.

```typescript
// packages/slides/src/player/SlidePlayer.tsx
// Primary SlidePlayer component. Assembles EngineProvider + full slide stack.

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useEffect,
  Children,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type RefObject,
  type MutableRefObject,
} from 'react';
import {
  EngineProvider,
  EngineARContainer,
  EngineInputRegion,
  SceneCanvas,
  EngineOverlayHost,
  corePlugin,
  useCurrentScene,
  useSceneEngineContext,
  useVariable,
  // NOTE: VariableStoreContext is NOT exported from @brewsite/core.
  // Use the useVariable hook for reactive VariableStore reads.
} from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';
import type { DeckTheme, SlideNavigationConfig, SlidePlayerHandle, ProgressStyle } from '../types';
import { compileDeckTheme } from '../compiler/themeCompiler';
import { compileDeck, buildSceneElements } from '../compiler/deckCompiler';
import { slidesPlugin } from '../plugin';
import { useSlideNavigation } from './useSlideNavigation';
import { SlideProgressIndicator } from './SlideProgressIndicator';
import { Slide } from '../dsl';
import { defaultDeckTheme } from '../theme';
import { SLIDE_META_NAMESPACE } from '../widget/SlideMetaWidget';

// ─── SlideContentWithProgress ─────────────────────────────────────────────────

/**
 * Wraps body content and injects `visibleCount` into `BulletList`/`NumberedList`
 * children when `animateEntrance=true`.
 *
 * CRITICAL DESIGN NOTE: This component reads `sceneProgress` via `useVariable` at render
 * time — it does NOT accept sceneProgress as a prop. If it accepted a prop, the value
 * would be frozen at the time `buildSceneElements` runs (compile time), and animated
 * bullets would never advance past their initial state.
 *
 * The correct re-render chain:
 *   SlideMetaWidget.apply() → writes sceneProgress to VariableStore
 *   → EngineOverlayHost re-renders (subscribed to VariableStore changes)
 *   → SlideContentWithProgress re-renders as a child, reads fresh sceneProgress
 *   → visibleCount updates → bullets reveal correctly
 *
 * This component is stored as a static ReactElement in TextBox's childrenMap.
 * React renders it fresh on every EngineOverlayHost re-render, giving it access
 * to the current VariableStore state via context.
 */
const SlideContentWithProgress = ({
  slideKey,
  totalBullets,
  children,
}: {
  /** The slide's stable key — used to look up sceneProgress in VariableStore. */
  slideKey: string;
  totalBullets: number;
  children: ReactNode;
}): JSX.Element => {
  // Read sceneProgress reactively via useVariable (exported from @brewsite/core).
  // useVariable subscribes to VariableStore updates and triggers re-renders when
  // the value changes. This is the correct reactive read pattern.
  // VariableStoreContext is NOT exported from @brewsite/core — do not use useContext.
  const rawProgress = useVariable(SLIDE_META_NAMESPACE, `${slideKey}.sceneProgress`);
  const progress = typeof rawProgress === 'number' ? rawProgress : 0;

  const visibleCount = totalBullets > 0
    ? Math.ceil(progress * totalBullets)
    : undefined;

  const injected = visibleCount !== undefined
    ? Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<Record<string, unknown>>;
        const displayName = (el.type as { displayName?: string }).displayName;
        if (displayName === 'BulletList' || displayName === 'NumberedList') {
          if (el.props['animateEntrance'] === true) {
            return React.cloneElement(el, { visibleCount });
          }
        }
        return child;
      })
    : children;

  return <>{injected}</>;
};

// ─── SlidePlayer Props ────────────────────────────────────────────────────────

export type SlidePlayerProps = {
  /** <Slide> elements. */
  children: ReactNode;
  /** Deck-level theme. Defaults to defaultDeckTheme. */
  theme?: Partial<DeckTheme>;
  /** Default slide transition. Default: 'dissolve'. */
  transition?: 'dissolve' | 'none';
  /** Progress indicator style. Default: 'dots'. */
  progressIndicator?: 'dots' | 'bar' | 'numbers' | 'none';
  /** Optional engine ID. Required for external state access via useSceneEngineState(id). */
  id?: string;
  /** Additional plugins (e.g. diagramPlugin(), modelPlugin()). */
  plugins?: WidgetPlugin[];
  /** Canvas aspect ratio. Default: 16/9. */
  aspectRatio?: number;
  /** Navigation configuration. */
  navigation?: SlideNavigationConfig;
  /** Force fullscreen mode. */
  fullscreen?: boolean;
  /** Uncontrolled default fullscreen state. */
  defaultFullscreen?: boolean;
  /** Called when fullscreen state changes. */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** Called when the active slide changes. */
  onSlideChange?: (index: number, slideKey: string) => void;
  className?: string;
  style?: CSSProperties;
};

// ─── SlidePlayerInner ─────────────────────────────────────────────────────────
// Separated so it can use hooks (must be inside EngineProvider).

type SlidePlayerInnerProps = {
  spec: ReturnType<typeof compileDeck>;
  progressIndicator: ProgressStyle;
  canvasRef: RefObject<HTMLCanvasElement>;
  imperativeRef: MutableRefObject<SlidePlayerHandle | null>;
  navigation?: SlideNavigationConfig;
};

// Empty manifest data URL — EngineProvider requires a non-empty manifestUrl.
// fetch('') would fetch the current page (runtime failure). A data URL with an
// empty asset list is the correct zero-manifest sentinel.
const EMPTY_MANIFEST_URL = `data:application/json,${encodeURIComponent(
  JSON.stringify({ models: [], animations: [] })
)}`;

const SlidePlayerInner = ({
  spec,
  progressIndicator,
  canvasRef,
  imperativeRef,
  navigation,
}: SlidePlayerInnerProps): JSX.Element => {
  const engine = useSceneEngineContext();
  const { sceneIndex } = useCurrentScene();
  const scrollUnits = useMemo(() => spec.slides.map((s) => s.scrollUnits), [spec.slides]);
  const nav = useSlideNavigation(spec.slides.length, scrollUnits);

  // Expose imperative handle
  useImperativeHandle(imperativeRef, () => ({
    goTo: nav.goTo,
    next: nav.next,
    prev: nav.prev,
    captureSlideSnapshots: async (): Promise<Map<string, string>> => {
      const canvas = canvasRef.current;
      if (!canvas) return new Map();
      const result = new Map<string, string>();

      // Save current progress. getGlobalProgress is typed () => number — calling it
      // directly returns the current progress value.
      const savedProgress = engine.getGlobalProgress();

      for (let i = 0; i < spec.slides.length; i++) {
        const slide = spec.slides[i]!;
        // Compute exact start progress using cumulative scrollUnits (not i/(n-1),
        // which is wrong for non-uniform budgets like title=100, body=400).
        const targetProgress = computeSlideStartProgress(scrollUnits, i);
        engine.scrollToProgress(targetProgress);
        // Wait two rAF cycles for Three.js to render the new frame.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        result.set(slide.key, canvas.toDataURL('image/png'));
      }

      engine.scrollToProgress(savedProgress);
      return result;
    },
  }), [nav, canvasRef, engine, spec.slides, scrollUnits]);

  // Slide-change notification is handled by corePlugin({ onSceneChange }) — NOT here.
  // Using both corePlugin.onSceneChange and a useEffect would fire the callback twice
  // per slide change. The corePlugin path is the sole owner of onSlideChange dispatch.

  // Keyboard navigation — scope-aware: 'window' (default) or 'canvas' (containerRef).
  // Bindings: ArrowRight/ArrowDown/Space/Enter/PageDown → next; ArrowLeft/ArrowUp/PageUp → prev;
  // Home → first slide; End → last slide.
  // F-key fullscreen is handled in the outer SlidePlayer component.
  useEffect(() => {
    if (navigation?.keyboard === false) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'Enter':
        case 'PageDown':
          e.preventDefault();
          nav.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          nav.prev();
          break;
        case 'Home':
          e.preventDefault();
          nav.goTo(0);
          break;
        case 'End':
          e.preventDefault();
          nav.goTo(spec.slides.length - 1);
          break;
      }
    };
    // scope='canvas' attaches to the EngineInputRegion container div (passed via containerRef
    // forwarded from SlidePlayer). Defaults to window for global keyboard capture.
    // In v1.0, containerRef is NOT forwarded into SlidePlayerInner; scope='canvas' falls
    // back to window. The full scoped implementation is a v1.1 enhancement.
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nav, navigation, spec.slides.length]);

  // Touch swipe: track touchstart X, fire next/prev on touchend based on delta.
  useEffect(() => {
    if (navigation?.touch === false) return;
    let startX = 0;
    const MIN_SWIPE_PX = 40;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0]?.clientX ?? 0; };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = (e.changedTouches[0]?.clientX ?? 0) - startX;
      if (Math.abs(dx) < MIN_SWIPE_PX) return;
      if (dx < 0) nav.next();   // swipe left → next
      else nav.prev();           // swipe right → prev
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [nav, navigation]);

  return (
    <>
      <SlideProgressIndicator nav={nav} style={progressIndicator} />
      {/*
       * Pointer navigation overlay: click → next, right-click → prev.
       * Rendered as a full-size transparent div layered above the 3D canvas but
       * below the progress indicator (z-index: 1 vs indicator's z-index: 20).
       * Only rendered when pointer navigation is not explicitly disabled.
       *
       * NOTE: This overlay does NOT interfere with TextBox overlay interactions
       * because EngineOverlayHost uses pointer-events: none at the canvas layer.
       * For slides that need interactive DOM elements in overlays, pointer events
       * must be re-enabled at the TextBox child level.
       */}
      {navigation?.pointer !== false && (
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'pointer' }}
          onClick={() => nav.next()}
          onContextMenu={(e) => { e.preventDefault(); nav.prev(); }}
        />
      )}
    </>
  );
};

// ─── SlidePlayer ─────────────────────────────────────────────────────────────

export const SlidePlayer = forwardRef<SlidePlayerHandle, SlidePlayerProps>(function SlidePlayer(
  {
    children,
    theme,
    transition = 'dissolve',
    progressIndicator = 'dots',
    id,
    plugins = [],
    aspectRatio = 16 / 9,
    navigation,
    fullscreen,
    defaultFullscreen = false,
    onFullscreenChange,
    onSlideChange,
    className,
    style,
  }: SlidePlayerProps,
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Internal ref for imperative handle; forwarded via the outer forwardRef
  const imperativeRef = useRef<SlidePlayerHandle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
  const effectiveFullscreen = fullscreen !== undefined ? fullscreen : isFullscreen;

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => {
        setIsFullscreen(true);
        onFullscreenChange?.(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        onFullscreenChange?.(false);
      }).catch(() => {});
    }
  }, [onFullscreenChange]);

  // F key fullscreen toggle — always window-scoped regardless of navigation.scope.
  // Slide navigation keys (arrows, space, etc.) are handled inside SlidePlayerInner
  // which has access to the engine context. The F-key handler is here because
  // toggleFullscreen references containerRef which is only in this scope.
  useEffect(() => {
    if (navigation?.keyboard === false) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFullscreen, navigation]);

  // Compile theme once per theme prop change
  const resolvedTheme = useMemo(() => compileDeckTheme(theme), [theme]);

  // Collect and validate <Slide> children
  const slideElements = useMemo(() => {
    const slides: ReactElement<Record<string, unknown>>[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && (child.type === Slide)) {
        slides.push(child as ReactElement<Record<string, unknown>>);
      }
    });
    return slides;
  }, [children]);

  // Compile DeckSpec once per children change
  const spec = useMemo(
    () => compileDeck(slideElements, resolvedTheme, transition),
    [slideElements, resolvedTheme, transition],
  );

  // Build Scene elements from spec.
  // buildSceneElements is pure — it produces STATIC JSX with no runtime state dependency.
  // SlideContentWithProgress inside the JSX reads sceneProgress via useVariable
  // at render time, so animated bullet reveals work without recompiling the SceneTrack.
  const sceneElements = useMemo(
    () => buildSceneElements(slideElements, spec),
    [slideElements, spec],
  );

  // Build plugin array.
  // onSlideChange is wired through corePlugin({ onSceneChange }) — the single source
  // of slide-change notification. Using both corePlugin.onSceneChange AND a useEffect
  // inside SlidePlayerInner would fire the callback twice per scene change. Only
  // corePlugin is used; SlidePlayerInner has NO useEffect for onSlideChange.
  // Note: corePlugin's onSceneChange receives (sceneId: string, sceneIndex: number);
  // SlidePlayer's onSlideChange contract is (index: number, slideKey: string).
  const allPlugins = useMemo(() => [
    corePlugin({
      onSceneChange: onSlideChange
        ? (sceneId, sceneIndex) => onSlideChange(sceneIndex, sceneId)
        : undefined,
    }),
    slidesPlugin({ theme: resolvedTheme, navigation }),
    ...plugins,
  ], [resolvedTheme, navigation, plugins, onSlideChange]);

  // Expose the imperative handle via the forwarded ref
  useImperativeHandle(ref, () => ({
    goTo: (i) => imperativeRef.current?.goTo(i),
    next: () => imperativeRef.current?.next(),
    prev: () => imperativeRef.current?.prev(),
    captureSlideSnapshots: () => imperativeRef.current?.captureSlideSnapshots() ?? Promise.resolve(new Map()),
  }));

  const containerStyle: CSSProperties = effectiveFullscreen
    ? { position: 'fixed', inset: 0, zIndex: 9999, background: resolvedTheme.background.color }
    : { position: 'relative', width: '100%', ...style };

  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      <EngineProvider
        id={id}
        manifestUrl={EMPTY_MANIFEST_URL}
        plugins={allPlugins}
        sceneTheme={resolvedTheme.sceneTheme}
        inputModePolicy="direct"
        pixelsPerScene={600}
      >
        {/* Inject <Slide>→<Scene> expanded children into the engine's scene registration */}
        {sceneElements}

        <EngineARContainer aspectRatio={aspectRatio} scaleMode="contain">
          <EngineInputRegion fillContainer>
            {/* SceneCanvas uses forwardRef<HTMLCanvasElement> — prop is `ref`, NOT `canvasRef`. */}
            <SceneCanvas ref={canvasRef} />
            <EngineOverlayHost
              passthroughPointerEvents={false}
              overlayTransition={transition === 'none' ? { enabled: false } : { enabled: true, durationMs: 200 }}
            />
            {/* Inner component uses hooks — must be inside EngineProvider */}
            <SlidePlayerInner
              spec={spec}
              progressIndicator={progressIndicator}
              canvasRef={canvasRef}
              imperativeRef={imperativeRef}
              navigation={navigation}
            />
          </EngineInputRegion>
        </EngineARContainer>
      </EngineProvider>
    </div>
  );
});
SlidePlayer.displayName = 'SlidePlayer';
```

---

## §9 — Plugin Factory (`packages/slides/src/plugin.ts`)

```typescript
// packages/slides/src/plugin.ts
// slidesPlugin() — registers slide widgets and DSL handlers into a WidgetPlugin.

import { registerNode } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';
import { SlideMetaWidget } from './widget/SlideMetaWidget';
import { SlideNavWidget } from './widget/SlideNavWidget';
import type { ResolvedDeckTheme } from './types';
import type { SlideNavigationConfig } from './types';
import type { SlideMetaDslProps } from './plugin';

// ─── SlideMetaDsl (marker component) ─────────────────────────────────────────

export type SlideMetaDslProps = {
  id: string;
  slideKey: string;
  logicalIndex: number;
  totalSlides: number;
  notes?: string;
  title?: string;
  hasAnimatedList: boolean;
  totalBullets: number;
};

export const SlideMetaDsl = (_props: SlideMetaDslProps): null => null;
SlideMetaDsl.displayName = 'SlideMetaDsl';

// ─── Plugin options ───────────────────────────────────────────────────────────

export type SlidesPluginOptions = {
  theme: ResolvedDeckTheme;
  navigation?: SlideNavigationConfig;
};

/**
 * WidgetPlugin factory for @brewsite/slides.
 * Registers SlideMetaWidget and its DSL NodeHandler.
 *
 * Usage:
 *   plugins={[corePlugin(), slidesPlugin({ theme: resolvedTheme })]}
 */
export function slidesPlugin(options: SlidesPluginOptions): WidgetPlugin {
  const metaWidget = new SlideMetaWidget();

  return {
    createWidgets: () => [metaWidget, new SlideNavWidget()],

    registerHandlers: () => {
      registerNode(SlideMetaDsl, (node, api) => {
        const props = node.props as SlideMetaDslProps;
        api.setWidgetState(metaWidget.widgetId, {
          slideKey: props.slideKey,
          logicalIndex: props.logicalIndex,
          totalSlides: props.totalSlides,
          notes: props.notes,
          title: props.title,
          hasAnimatedList: props.hasAnimatedList,
          totalBullets: props.totalBullets,
        } satisfies import('./widget/SlideMetaWidget').SlideMetaState);
      });
    },

    configureRegistry: (_registry) => {
      // No registry configuration needed.
      //
      // ARCHITECTURE NOTE: Slide navigation (keyboard, pointer, touch) is implemented
      // at the React layer inside SlidePlayerInner via useEffect + onClick handlers
      // (see §8 SlidePlayer.tsx). It does NOT use <InputController> DSL or the 3D
      // input pipeline. Reasons:
      //
      // 1. Slide navigation is a pure React concern — it calls engine.scrollToProgress(),
      //    not a Three.js camera action.
      // 2. EngineProvider uses inputModePolicy="direct", so the engine's scroll-based
      //    scene advancement is disabled. No InputController actions needed.
      // 3. <InputController> speaks in terms of camera actions (orbit, dolly, focus).
      //    "next slide" is not a camera action — it is a React navigation callback.
      //
      // SlideNavWidget is registered as a plain IWidget (registry anchor only);
      // it does not participate in the SceneTrack pipeline.
    },
  };
}
```

---

## §10 — Public Barrel (`packages/slides/src/index.ts`)

```typescript
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

// ─── Plugin ───────────────────────────────────────────────────────────────────
export { slidesPlugin } from './plugin';
export type { SlidesPluginOptions } from './plugin';

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useSlideNavigation, computeSlideStartProgress } from './player/useSlideNavigation';
export { useSlideNotes } from './player/useSlideNotes';
export type { SlideNavigationState } from './player/useSlideNavigation';
```

---

## §11 — Test Strategy

For each module, the test file path, what is tested, test approach, and example assertions.

### `packages/slides/src/compiler/__tests__/layoutCompiler.test.ts`

**Tests:** `compileLayout()` pure function for all layout variants.

```typescript
// Test: title-body layout produces correct NVS regions
const regions = compileLayout({ layout: 'title-body', hasTitle: true });
expect(regions).toHaveLength(2);
expect(regions.find(r => r.id === 'title')).toMatchObject({ x: 0, y: expect.any(Number), w: 1 });
expect(regions.find(r => r.id === 'body')).toMatchObject({ x: 0, w: 1 });
// body.y > title.y + title.h (body is below title)
const title = regions.find(r => r.id === 'title')!;
const body  = regions.find(r => r.id === 'body')!;
expect(body.y).toBeGreaterThan(title.y + title.h);

// Test: two-column layout without title has no title region
const colsNoTitle = compileLayout({ layout: 'two-column', hasTitle: false });
expect(colsNoTitle.find(r => r.id === 'title')).toBeUndefined();
expect(colsNoTitle).toHaveLength(2);

// Test: blank layout returns empty array
expect(compileLayout({ layout: 'blank', hasTitle: false })).toHaveLength(0);
```

No mocks. Pure function with real inputs and real output assertions.

### `packages/slides/src/compiler/__tests__/themeCompiler.test.ts`

**Tests:** `compileDeckTheme()` merges defaults, derives correct SceneTheme, and produces correct CSS vars.

```typescript
const result = compileDeckTheme({ colorMode: 'dark', accentColor: '#ff0000' });
expect(result.sceneTheme.colorMode).toBe('dark');
expect(result.sceneTheme.accentColor).toBe('#ff0000');
expect(result.cssVars['--slide-padding']).toBe(defaultDeckTheme.spacing.slide);
expect(result.sceneTheme.font.htmlFamily).toBe(defaultDeckTheme.fonts.heading);

// Test: fonts.body is not set when absent
const noBodyFont = compileDeckTheme();
expect(noBodyFont.cssVars['--slide-font-body']).toBeUndefined();
```

### `packages/slides/src/compiler/__tests__/deckCompiler.test.ts`

**Tests:** `compileDeck()` produces correct DeckSpec for various slide configurations.

```typescript
import React from 'react';
import { Slide, TitleBodyLayout, BulletList } from '../../dsl';
import { compileDeck } from '../deckCompiler';
import { compileDeckTheme } from '../themeCompiler';

const theme = compileDeckTheme();

// Test: simple 2-slide deck
const slides = [
  React.createElement(Slide, { key: 'intro' },
    React.createElement(TitleBodyLayout, { title: 'Intro' },
      React.createElement(BulletList, { items: ['A', 'B'] }))),
  React.createElement(Slide, { key: 'outro' },
    React.createElement(TitleBodyLayout, { title: 'Outro' })),
];
const spec = compileDeck(slides as any, theme, 'dissolve');
expect(spec.slides).toHaveLength(2);
expect(spec.slides[0]!.key).toBe('intro');
expect(spec.slides[0]!.layout).toBe('title-body');
expect(spec.slides[0]!.hasAnimatedList).toBe(false); // animateEntrance not set
expect(spec.slides[0]!.regions).toHaveLength(2);  // title + body

// Test: slide with animateEntrance bullet list
const animatedSlides = [
  React.createElement(Slide, { key: 's1' },
    React.createElement(TitleBodyLayout, { title: 'X' },
      React.createElement(BulletList, { items: ['A', 'B', 'C'], animateEntrance: true }))),
];
const animSpec = compileDeck(animatedSlides as any, theme, 'dissolve');
expect(animSpec.slides[0]!.hasAnimatedList).toBe(true);
expect(animSpec.slides[0]!.totalBullets).toBe(3);
```

No mocks. Uses real React.createElement with real DSL components.

### `packages/slides/src/widget/__tests__/SlideMetaWidget.test.ts`

**Tests:** `SlideMetaWidget.apply()` writes correct values to VariableStore. Uses a real VariableStore instance (not a mock).

```typescript
import { VariableStore } from '@brewsite/core';
import { SlideMetaWidget, SLIDE_META_NAMESPACE } from '../SlideMetaWidget';

const widget = new SlideMetaWidget();
const store = new VariableStore();

const mockCtx = {
  clock: { wallTimeSeconds: 0, deltaSeconds: 0.016 },
  effectiveDeltaSeconds: 0.016,
  globalProgress: 0.5,
  variables: store,
  extra: undefined,
  tick: { sceneProgress: 0.75, blockProgress: 0.75, sceneIndex: 0, sceneId: 'slide-1', index: 50, progress: 0.5, state: {} as any, deltaForward: {}, deltaBackward: {} },
};

const state = {
  slideKey: 'slide-1',
  logicalIndex: 0,
  totalSlides: 3,
  notes: 'Talk point A',
  title: 'Slide One',
  hasAnimatedList: true,
  totalBullets: 3,
};

widget.apply(state, mockCtx as any);

const ns = store.getNamespace(SLIDE_META_NAMESPACE);
expect(ns['currentLogicalIndex']).toBe(0);
expect(ns['totalSlides']).toBe(3);
expect(ns['slide-1.notes']).toBe('Talk point A');
expect(ns['slide-1.sceneProgress']).toBeCloseTo(0.75);
```

No mocks — real `VariableStore` instance, real inputs, real output assertions.

### `packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts` (EXISTING FILE — EXTEND)

**Add two test cases to the existing test suite:**

```typescript
// Test: sceneProgress is present on all ticks
const track = compileSceneTrack({ scenes: [...], widgetRegistry, blockSize: 10 });
for (const tick of track.ticks) {
  expect(tick.sceneProgress).toBeDefined();
  expect(tick.sceneProgress).toBeGreaterThanOrEqual(0);
  expect(tick.sceneProgress).toBeLessThanOrEqual(1);
}

// Test: terminal tick has sceneProgress = 1
const terminal = track.ticks[track.ticks.length - 1]!;
expect(terminal.sceneProgress).toBe(1);
expect(terminal.blockProgress).toBe(0); // invariant unchanged
```

### `packages/slides/src/player/__tests__/useSlideNavigation.test.ts`

**Tests:** `computeSlideStartProgress` pure function + `useSlideNavigation` hook behavior.

**`computeSlideStartProgress` tests (pure — no mocks):**

```typescript
import { computeSlideStartProgress } from '../useSlideNavigation';

// Uniform scrollUnits: progress distributes evenly
expect(computeSlideStartProgress([400, 400, 400], 0)).toBe(0);
expect(computeSlideStartProgress([400, 400, 400], 1)).toBeCloseTo(1/3);
expect(computeSlideStartProgress([400, 400, 400], 2)).toBeCloseTo(2/3);

// Non-uniform: title=100, body=400, body=400
const units = [100, 400, 400];
expect(computeSlideStartProgress(units, 0)).toBe(0);
expect(computeSlideStartProgress(units, 1)).toBeCloseTo(100 / 900);
expect(computeSlideStartProgress(units, 2)).toBeCloseTo(500 / 900);

// Edge: single slide always returns 0
expect(computeSlideStartProgress([100], 0)).toBe(0);
```

**`useSlideNavigation` hook test:** Use `@testing-library/react` `renderHook` with a real context object wrapping a mock engine that implements `scrollToProgress` (a `vi.fn()`). Assert that `goTo(1)` calls `engine.scrollToProgress` with the correct value derived from `computeSlideStartProgress`; assert `next()` / `prev()` increment/decrement correctly. Assert no-op on boundary (first/last slide).

### `packages/slides/src/player/__tests__/SlidePlayer.test.tsx`

**Tests:** `SlidePlayer` mounts without error, renders `SlideProgressIndicator`, handles basic prop changes.

Use `@testing-library/react`. Mock `EngineProvider` to avoid Three.js initialization in node environment. Assert that the correct number of dots renders for a 3-slide deck.

---

## §12 — Parallel Work Stream Breakdown

The implementation is divided into 5 independent work streams. Streams B, C, D run concurrently after Stream A completes. Stream E runs after B, C, D are all complete.

### Stream A — Package Scaffold + Types + DSL (no dependencies)

**Owner:** Developer A
**Files (no overlap with other streams):**
- `packages/slides/package.json` — create
- `packages/slides/tsconfig.json` — create
- `packages/slides/tsconfig.build.json` — create
- `packages/slides/vitest.config.ts` — create
- `packages/slides/src/types.ts` — create (full content from §2)
- `packages/slides/src/dsl.tsx` — create (full content from §3)
- `packages/slides/src/theme.ts` — create (full content from §4)
- `packages/slides/src/index.ts` — create initial skeleton (re-exports to be filled)
- `packages/core/src/compiler/sceneTrackTypes.ts` — add `sceneProgress?: number` field (§7)
- `packages/core/src/compiler/sceneTrackCompiler.ts` — populate `sceneProgress` (§7)

**Output deliverable:** `@brewsite/core` with `sceneProgress` support; `packages/slides/src/types.ts`, `dsl.tsx`, `theme.ts` all typechecking clean.

**Test:** Extend `packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts` with `sceneProgress` assertions.

### Stream B — Compiler Layer (reads Stream A types; no file overlap with C, D, E)

**Owner:** Developer B
**Dependency:** Stream A must be complete (types.ts, dsl.tsx in place)
**Files:**
- `packages/slides/src/compiler/layoutCompiler.ts` — create (§5)
- `packages/slides/src/compiler/themeCompiler.ts` — create (§4)
- `packages/slides/src/compiler/deckCompiler.ts` — create (§5)
- `packages/slides/src/compiler/__tests__/layoutCompiler.test.ts` — create
- `packages/slides/src/compiler/__tests__/themeCompiler.test.ts` — create
- `packages/slides/src/compiler/__tests__/deckCompiler.test.ts` — create

**No overlap with C, D, or E** — compiler files are distinct from widget, player, and plugin files.

### Stream C — Widget Layer (reads Stream A types; no file overlap with B, D, E)

**Owner:** Developer C
**Dependency:** Stream A must be complete (types.ts in place)
**Files:**
- `packages/slides/src/widget/SlideMetaWidget.ts` — create (§6)
- `packages/slides/src/widget/SlideNavWidget.ts` — create (§6)
- `packages/slides/src/widget/__tests__/SlideMetaWidget.test.ts` — create
- `packages/slides/src/plugin.ts` — create (§9; defines `SlideMetaDsl` marker + `slidesPlugin()`)

**No overlap with B, D, or E.**

### Stream D — Navigation Hooks + Progress Indicator (reads Stream A types; no file overlap with B, C, E)

**Owner:** Developer D
**Dependency:** Stream A must be complete
**Files:**
- `packages/slides/src/player/useSlideNavigation.ts` — create (§8)
- `packages/slides/src/player/useSlideNotes.ts` — create (§8)
- `packages/slides/src/player/SlideProgressIndicator.tsx` — create (§8)
- `packages/slides/src/player/__tests__/useSlideNavigation.test.ts` — create

**NOTE:** There is NO `primitives/` directory. `Heading`, `Body`, `BulletList`, and `NumberedList` all live in `src/dsl.tsx` (Stream A creates them). Stream D does NOT create any separate primitive files.

**No overlap with B, C, or E.**

### Stream E — SlidePlayer + Integration (depends on B + C + D)

**Owner:** Developer E
**Dependencies:** Streams B, C, and D must all be complete
**Files:**
- `packages/slides/src/player/SlidePlayer.tsx` — create (§8; consumes compiler from B, widgets from C, hooks from D)
- `packages/slides/src/player/__tests__/SlidePlayer.test.tsx` — create
- `packages/slides/src/index.ts` — finalize all re-exports
- `apps/examples/src/slides-demo/` — create example deck (required before package ships)
  - `apps/examples/src/slides-demo/SlidesDemoPage.tsx`
  - `apps/examples/src/slides-demo/deck.tsx`

**Sequencing diagram:**

```
Stream A ──────────────────────────────────────────────────── complete ┐
                                                                        │
           ┌── Stream B (compiler) ────────────────────────── complete ─┤
           │                                                            │
           ├── Stream C (widgets + plugin) ─────────────────── complete ─┤──► Stream E (SlidePlayer + integration)
           │                                                            │
           └── Stream D (hooks + indicator) ─────────────────── complete ─┘
```

---

## §13 — v1.0 vs v1.1 Scope Boundary

### v1.0 — Ships in this plan

- `SlidePlayer` component
- `slidesPlugin()` factory
- All type definitions (`types.ts`)
- DSL components: `<Slide>`, `<TitleLayout>`, `<TitleBodyLayout>`, `<TwoColumnLayout>`, `<FullBleedLayout>`, `<BlankLayout>`, `<SlideContent>`
- Text primitives: `<Heading>`, `<Body>`, `<BulletList>` (with `animateEntrance`), `<NumberedList>`
- `DeckTheme`, `defaultDeckTheme`, `darkDeckTheme`, `createDeckTheme`
- `SlideMetaWidget` (publishes metadata + sceneProgress to VariableStore)
- `SlideNavWidget` (registry anchor)
- `useSlideNavigation`, `useSlideNotes` hooks
- `SlideProgressIndicator` (dots, bar, numbers, none)
- Fullscreen support via Fullscreen API
- Navigation: keyboard (ArrowRight/Left/Up/Down, Space, Enter, Home, End, F) + pointer (click → next, right-click → prev) + touch swipe
- `SlidePlayerHandle.captureSlideSnapshots()` (async, on-demand)
- Core change: `sceneProgress` on `SceneTrackTick`
- Examples app deck demo

### v1.1 — Defined but not in this plan

- `<MediaLayout>` — deferred. Requires stable NVS dual-constraint solution.
- `<PresenterView>` — same-tab sidebar with speaker notes + slide thumbnail
- `<SlideOverview>` — thumbnail grid panel (Escape/O/G keys)
- `<SlidePrintLayout>` — print/PDF component with `captureSlideSnapshots()` integration
- `<Code>`, `<Callout>`, `<Caption>` text primitives
- `autoAdvance` prop on `<Slide>`
- Slide transition types beyond `'dissolve'` and `'none'`
- Model and chart NVS sub-region support (requires `@brewsite/model` and `@brewsite/charts` changes)

### v1.0 Escape Hatch for Diagram-in-Slide (documented, not abstracted)

Authors needing a diagram in a slide use raw DSL inside `<SlideContent>`:

```tsx
<Slide key="arch">
  <SlideContent>
    {/* Text on the left side */}
    <TextBox id="arch-text" x={0} y={0} w={0.44} h={1}>
      <div style={{ padding: 'var(--slide-padding)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Heading level={2}>Architecture</Heading>
        <BulletList items={['Widget SDK', 'Compiler pipeline', 'Runtime']} />
      </div>
    </TextBox>
    {/* DiagramCanvas on the right side — requires diagramPlugin() in SlidePlayer.plugins */}
    <DiagramCanvas id="arch-diagram" x={0.52} y={0} w={0.48} h={1}>
      <Diagram id="d1" theme={darkGlass}>
        {/* ... nodes ... */}
      </Diagram>
    </DiagramCanvas>
  </SlideContent>
</Slide>
```

This is valid v1.0 usage. Document it in the package README.

---

## §14 — Key Constraints Checklist

- [ ] All source files pass `strict: true` TypeScript. No `any` except at documented system boundaries (`React.Children` traversal, VariableStore cast to write).
- [ ] `packages/slides` imports from `@brewsite/core`. NEVER imports from `@brewsite/diagram`, `@brewsite/model`, or `@brewsite/charts` directly (they are optional peers; type imports only via conditional blocks).
- [ ] `@brewsite/core` changes are non-breaking: `sceneProgress` is optional.
- [ ] `compiler/deckCompiler.ts` is pure: no React rendering, no Three.js, no async. `buildSceneElements()` uses `React.createElement` but is synchronous.
- [ ] All `IRenderable` implementors call `dispose()` (SlideMetaWidget has no Three.js resources; its `dispose()` is a no-op but is present).
- [ ] `slidesPlugin()` is the only module with side effects (`registerNode` calls inside `registerHandlers()`). `registerHandlers()` is idempotent per the `WidgetPlugin` contract.
- [ ] No new peer dependencies beyond `react`, `react-dom`, `three`, `@brewsite/core`.
- [ ] Build uses `tsc` only (no Vite), matching `@brewsite/diagram` and `@brewsite/model` patterns.
- [ ] All exports are named exports. `SlidePlayer` is exported as a named export (`export const SlidePlayer = forwardRef(...)`), not a default export.
- [ ] pnpm only. No npm scripts.
- [ ] `manifestUrl` MUST NOT be an empty string `""`. The empty string causes `EngineProvider` to `fetch('')`, which fetches the current page. Use `EMPTY_MANIFEST_URL` (the data URL constant defined in `SlidePlayer.tsx`).
- [ ] Navigation API: `engine.scrollToProgress(p)` is the only public navigation call. `engine.goToScene`, `engine.setControlledProgress`, and `engine.getProgress` do not exist on `UseSceneEngineResult`.
- [ ] `VariableStoreContext` is NOT exported from `@brewsite/core`. Reactive VariableStore reads use `useVariable(namespace, key)` (exported from `@brewsite/core`).
- [ ] `NavigationConfig.scope` caveat: `'canvas'` scope is a v1.1 enhancement. v1.0 always attaches keyboard handlers to `window`. Document this in the README.
- [ ] **No `<InputController>` DSL in slides.** Navigation is React-layer only (keyboard `useEffect` + pointer overlay div + touch `useEffect` in `SlidePlayerInner`). `EngineProvider` uses `inputModePolicy="direct"` — the engine's scroll-based pipeline is disabled. `<InputController>` is a camera action primitive; it does not apply to slide-level navigation.
- [ ] Pointer overlay div (`navigation?.pointer !== false`) renders at z-index 1, below `SlideProgressIndicator` (z-index 20). Click → `nav.next()`, right-click → `nav.prev()`.
- [ ] Touch swipe: 40px minimum horizontal delta; swipe left → next, swipe right → prev. Guards `navigation?.touch !== false`.
- [ ] `SceneCanvas` uses `forwardRef<HTMLCanvasElement>`. The ref prop is `ref`, not `canvasRef`.
- [ ] `onSlideChange` is dispatched exclusively via `corePlugin({ onSceneChange: ... })`. No `useEffect` in `SlidePlayerInner` for this purpose.
- [ ] `countAnimatedListItems` must be called on each column separately for `two-column` layouts.
- [ ] `ProgressStyle` is defined in `types.ts`. `SlideProgressIndicator.tsx` imports it — does not re-define it.
- [ ] Examples app deck exercise: all 5 layout variants + animated bullet list + diagram escape hatch.
