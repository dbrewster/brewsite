---
title: "Docs App Unified Scroll Region"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-05
---

## 1. Problem Statement

The docs app (`docs/`) has broken scroll behavior. Every page in the docs is a single continuous-scroll layout rendered inside `DocsScrollRegion`, which has `overflow-y: auto; height: 100vh`. This makes the content column an independent scroll container — it does not scroll the `window`. As a result:

- Each embedded `DocsDemo` is a wheel-capture island: it intercepts wheel events, converts them to `setRawProgress` calls on a private `DemoEngine`, and has no relationship to the page's scroll position.
- There is no single scrollable source of truth. A user scrolling the docs page and a user "scrolling" inside a demo are operating entirely independent scroll contexts.
- The intended behavior — one scroll gesture that both reveals documentation content AND advances scene transitions in the canvas — is not achievable in the current architecture.

The `DocsScrollRegion` element at `packages/docs/src/layout/DocsScrollRegion.tsx` is the root of this problem. Its `overflowY: 'auto'; height: 100vh` style creates a second scroll viewport inside the browser's window scroll viewport. Documentation content, demos, and section tracking are all trapped inside this nested scroll box.

---

## 2. Root Cause: Exact File and Line References

### Primary cause

**`packages/docs/src/layout/DocsScrollRegion.tsx`, lines 27–29:**

```tsx
style={{
  overflowY: 'auto',
  height: '100vh',
```

This is an element-level scroll container. Setting `overflow-y: auto` with a fixed `height: 100vh` on a div makes that div — not the `window` — the scroll viewport. All content inside it (all `Section` elements, all `DocsDemo` containers) scrolls within this div, not within the browser window.

**`packages/docs/src/layout/DocsApp.tsx`, line 62–67 (the IntersectionObserver setup):**

```tsx
const observer = new IntersectionObserver(
  ...,
  {
    root: scrollEl,           // <-- uses the scroll div as root
    rootMargin: '-10% 0px -80% 0px',
    threshold: 0,
  },
);
```

The `root: scrollEl` here is correct for element-scroll but it means the IntersectionObserver is tightly coupled to the scroll div. This must change when the root scroll source becomes `window`.

### Secondary cause

**`packages/docs/src/demo/DocsDemo.tsx`, line 147–157 (container style):**

Each `DocsDemo` has `overflow: 'hidden'` on a fixed-height `div`, and its content occupies that div entirely. The demo engine is driven by wheel capture (`WheelCaptureDemo`), not by page scroll position. This design is correct for the wheel-capture-island model but must change entirely in the unified scroll architecture.

### Tertiary cause

**`docs/src/style/layout.css`, lines 55–58:**

```css
.docs-scroll-region {
  overflow-y: auto;
  height: 100%;
}
```

The CSS class reinforces the nested scroll behavior.

---

## 3. Target Architecture

### 3.1 Principle

One `window` scroll drives everything. The canvas is sticky. Documentation content is inline in the normal document flow. As the user scrolls, both the scene progresses (via `ScrollCaptureSection`) and the documentation text comes into view (normal block layout flow). There are no nested scroll containers.

### 3.2 Component Tree (Target State)

```
<App>
  └─ <DocsApp nav={docsNav}>            [packages/docs/src/layout/DocsApp.tsx]
       ├─ <DocsSidebar>                 [unchanged: sticky, overflow-y: auto]
       └─ <DocsMainColumn>             [new: replaces DocsScrollRegion]
            │  no overflow-y: auto
            │  normal block flow, scrolls via window
            │
            ├─ <EngineProvider plugins={...} manifestUrl="...">
            │    │  [at DocsApp level, not per-demo]
            │    │
            │    ├─ <DocsEngineCanvas>  [new sticky canvas layer]
            │    │    └─ <ScrollCaptureSection height={TOTAL_SCROLL_PX}>
            │    │         └─ <SceneCanvas style={{width:'100%', height:'100vh'}} />
            │    │              <EngineOverlayHost />
            │    │
            │    └─ <DocsContent>       [normal block-flow children]
            │         ├─ <Section id="getting-started">...</Section>
            │         ├─ <Section id="installation">...</Section>
            │         └─ ... (all pages, all sections, inline)
            │
            (EngineProvider provides engine context to all descendants including
             the canvas AND the docs content — enabling useCurrentScene, useSceneProgress
             in any doc section if needed)
```

### 3.3 Scroll Wiring (Target State)

- `window.scrollY` is the single source of truth.
- `ScrollCaptureSection` (already in `@brewsite/core`, `packages/core/src/player/ScrollCaptureSection.tsx`) wraps the sticky canvas and computes `raw = clamp01(-outerDiv.getBoundingClientRect().top / maxScroll)`, then calls `engine.setRawProgress(raw)`.
- The outer `ScrollCaptureSection` div has `height: TOTAL_SCROLL_PX` where `TOTAL_SCROLL_PX` is the sum of all `scrollUnits` across all scenes in the docs engine.
- The sticky inner stage has `height: 100vh` (the canvas).
- Document content flows after (below) the `ScrollCaptureSection` div in normal block flow. The user scrolls past the sticky canvas as they scroll through the documentation sections.

### 3.4 The Docs Scene Engine

The docs app needs an `EngineProvider` at the app level (not per-demo). This engine provides:
- A global 3D canvas that is sticky while the user is in "scene territory" (the scroll budget)
- Scene DSL describing the backdrop/ambient state for each documentation section
- Progress driven entirely by `ScrollCaptureSection` / `window.scrollY`

The per-demo `DemoEngine` / `DocsDemo` pattern is removed entirely in this model. Demo canvases that showed mini 3D scenes per-section either become part of the single global canvas (their scenes become scenes in the global scene sequence) or are replaced with static code examples.

### 3.5 Section Tracking (Target State)

The `IntersectionObserver` in `DocsApp` changes its `root` from `scrollEl` to `null` (meaning the viewport = window). The `scrollIntoView` calls for hash navigation work against `window` scroll, which is the default behavior when the root element is `document.body` (i.e., no nested scroll container).

### 3.6 CSS Strategy (Target State)

```css
/* DocsMainColumn: no overflow, no height — it is just a block element */
.docs-main-column {
  min-width: 0;
  flex: 1;
}

/* No .docs-scroll-region class used anywhere */

/* DocsContent: padding and max-width only — no overflow, no height */
.docs-content {
  padding: 48px 48px 96px;
  max-width: calc(var(--content-max-width, 820px) + 96px);
  overflow-x: hidden;
}
```

The `html, body` elements must NOT have `overflow: hidden`. `global.css` already has `margin: 0; padding: 0` with no overflow restriction. The `#root` element already has `min-height: 100vh` with no overflow. No changes needed to `global.css` or `variables.css`.

---

## 4. Every File That Must Change

### 4.1 `packages/docs/src/layout/DocsScrollRegion.tsx` — DELETED (Phase 1)

This file is removed in Phase 1, in the same commit that updates `DocsApp.tsx` to use `DocsMainColumn`. `DocsScrollRegion` has exactly one caller (`DocsApp`). Once that caller is updated, there are zero callers. No deprecation cycle is needed for an internal layout component.

**Removal action:** Delete the file. Remove the import from `DocsApp.tsx`. Do this in the same commit as the `DocsApp.tsx` modification and the `DocsMainColumn.tsx` creation. Do not leave `DocsScrollRegion.tsx` in the repository after Phase 1 is merged.

### 4.2 `packages/docs/src/layout/DocsMainColumn.tsx` — NEW FILE

**Single responsibility:** Render the main content column in the docs grid. No scroll, no overflow. Preserves the two-div structure from `DocsScrollRegion` (outer column cell + inner content-width constraint) with the only change being the removal of `overflow-y: auto` and `height: 100vh` from the outer div.

```typescript
// packages/docs/src/layout/DocsMainColumn.tsx
// Main content column: block flow, no overflow, scrolls via window.
// Preserves the inner docs-content div for max-width and padding constraints.

import { forwardRef, type ReactNode, type ReactElement } from 'react';

interface DocsMainColumnProps {
  children: ReactNode;
}

/**
 * The main content column in the DocsApp grid.
 *
 * Two-div structure (preserved from DocsScrollRegion):
 * - Outer div: grid column cell. No overflow-y, no height — window is the scroll source.
 * - Inner div (.docs-content): max-width + padding + centering. Unchanged from DocsScrollRegion.
 *
 * The ref is forwarded to the outer div for future use (e.g., EngineProvider positioning).
 * It is NOT passed to IntersectionObserver as root — the IntersectionObserver root is null (window).
 */
export const DocsMainColumn = forwardRef<HTMLDivElement, DocsMainColumnProps>(
  ({ children }, ref): ReactElement => {
    return (
      <div
        ref={ref}
        className="docs-main-column"
        style={{
          flex: 1,
          minWidth: 0,
          // No overflow-y. No height: 100vh. Window is the scroll source.
        }}
      >
        <div
          className="docs-content"
          style={{
            maxWidth: 'var(--content-max-width, 820px)',
            padding: '48px 48px',
            margin: '0 auto',
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

DocsMainColumn.displayName = 'DocsMainColumn';
```

### 4.3 `packages/docs/src/layout/DocsApp.tsx` — MODIFIED

**Changes:**

1. Replace `DocsScrollRegion` import with `DocsMainColumn`.
2. Change `scrollRegionRef` to a ref on `DocsMainColumn` — but its purpose changes: it is no longer used as the IntersectionObserver `root`. Instead the `root` becomes `null` (window).
3. Update the `IntersectionObserver` to use `root: null` (window viewport).
4. Update `layoutStyle` to use CSS grid with `height: 100%` on the sidebar only; the main column has natural height.
5. Remove the `height: 100vh` from the `DocsMainColumn` — the column grows with content.
6. Remove the `flex: 1` grid cell constraint that made the column height-bound.

**New `DocsApp.tsx` implementation:**

```typescript
// packages/docs/src/layout/DocsApp.tsx
// Root layout: sidebar + window-scroll content column + IntersectionObserver coordination.

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { DocsNav } from '../nav/types';
import { DocsSidebar } from './DocsSidebar';
import { DocsMainColumn } from './DocsMainColumn';

/** Context provided to all descendants — allows reading the active section id. */
interface DocsAppContextValue {
  readonly activeId: string;
}

export const DocsAppContext = createContext<DocsAppContextValue>({ activeId: '' });

export interface DocsAppProps {
  nav: DocsNav<string>;
  children: ReactNode;
}

/**
 * Root docs layout component.
 *
 * Layout: CSS Grid with a fixed-width sidebar column and a content column.
 * The content column has NO overflow-y: auto — the window is the scroll source.
 * The sidebar is sticky at height: 100vh.
 *
 * Active section tracking:
 * - Mounts one IntersectionObserver watching all [data-section-id] elements.
 * - root: null → uses the window viewport as the intersection root.
 * - rootMargin: '-10% 0px -80% 0px' approximates "section is at top of viewport".
 *
 * Hash navigation:
 * - Reads window.location.hash on mount.
 * - scrollIntoView works against window scroll (no nested scroll container).
 *
 * URL hash sync:
 * - Updates window.location.hash via replaceState on activeId change.
 */
export function DocsApp({ nav, children }: DocsAppProps): ReactElement {
  const [activeId, setActiveId] = useState<string>('');
  // columnRef is kept for future use (e.g., injecting EngineProvider context)
  // but is NOT passed as the IntersectionObserver root.
  const columnRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: root: null → window viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section-id') ?? '';
            if (id) setActiveId(id);
          }
        }
      },
      {
        root: null,   // <-- window viewport, not a scroll div
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0,
      },
    );

    // Observe after a tick so that Section elements are mounted.
    const timer = setTimeout(() => {
      const targets = document.querySelectorAll('[data-section-id]');
      targets.forEach((el) => observer.observe(el));
    }, 0);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
    // Re-register if nav changes (nav is static in practice, but defensive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  // Hash navigation on initial load
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const timer = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'instant' });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // URL hash sync
  useEffect(() => {
    if (activeId) {
      history.replaceState(null, '', `#${activeId}`);
    }
  }, [activeId]);

  // Sidebar scroll-to handler — uses window scroll (scrollIntoView default)
  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const layoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'var(--sidebar-width, 260px) 1fr',
    minHeight: '100vh',
    background: 'var(--bg-page, #0d0d12)',
    alignItems: 'start',   // <-- prevent grid stretching main column
  };

  return (
    <DocsAppContext.Provider value={{ activeId }}>
      <div style={layoutStyle}>
        <DocsSidebar
          nav={nav}
          activeId={activeId}
          onSectionClick={scrollToSection}
        />
        <DocsMainColumn ref={columnRef}>
          {children}
        </DocsMainColumn>
      </div>
    </DocsAppContext.Provider>
  );
}
```

**Key diff vs current:**
- `root: null` instead of `root: scrollEl` in IntersectionObserver
- `document.querySelectorAll('[data-section-id]')` instead of `scrollEl.querySelectorAll(...)` because the observer root is now the window
- `DocsMainColumn` instead of `DocsScrollRegion`
- `alignItems: 'start'` added to the grid so the main column starts at the top and grows freely
- No `height: 100vh` or `overflow-y: auto` on the content column

### 4.4 `packages/docs/src/demo/DocsDemo.tsx` — REPLACED

The current `DocsDemo` is a self-contained wheel-capture island. In the unified scroll architecture, the `DocsDemo` component is still useful as a layout container for inline demo sections, but it no longer captures wheel events or manages its own engine. Instead it becomes a simple layout wrapper that:

1. Provides a fixed-height viewport section inline in the scroll flow
2. Contains a `ScrollCaptureSection` for its specific scroll budget
3. The engine context is provided by the app-level `EngineProvider` from `DocsApp`

However, this is a deep architectural change that impacts all 26+ page files and the global engine structure. See Section 5 (Parallelization Strategy) for the phased approach.

**Immediate change (Phase 1 of implementation):** Remove `overflow: hidden` from `DocsDemo`'s outer container. The demo container should still have `height: heightCss` but must not be a scroll container. The `WheelCaptureDemo` and `DemoCaptureContext` wiring is removed.

**New `DocsDemo.tsx` implementation (Phase 1):**

```typescript
// packages/docs/src/demo/DocsDemo.tsx
// Demo container: inline block in normal document flow. No wheel capture.

import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

export interface DocsDemoProps {
  /**
   * Height of the demo container in the page flow.
   *
   * number → treated as pixels. `height={480}` → CSS `height: 480px`.
   * string → passed directly as a CSS length. `height="100vh"` or `height="50vh"`.
   */
  height: number | string;
  /** Optional title displayed above the demo canvas. */
  title?: string;
  /**
   * Demo content. The engine context is provided by the ancestor EngineProvider
   * (now at DocsApp level). No DemoEngine needed inside DocsDemo.
   */
  children: ReactNode;
  /**
   * @deprecated scrollUnits is no longer used. It was previously needed for
   * the wheel-capture island model. In the unified scroll model, scroll budgets
   * are declared via <ProgressManager scrollUnits={...}> in the scene DSL.
   * This prop is retained for a deprecation cycle to avoid immediate API breakage.
   * It is silently ignored.
   */
  scrollUnits?: number;
}

function resolveHeight(height: number | string): string {
  return typeof height === 'number' ? `${height}px` : height;
}

/**
 * Inline demo container.
 *
 * Renders a fixed-height block element in the normal document flow.
 * No wheel event capture. No independent engine. No IntersectionObserver.
 *
 * The scene engine powering demo canvases is provided by the ancestor
 * EngineProvider (mounted at the DocsApp level). Scene transitions are driven
 * by window scroll via ScrollCaptureSection.
 */
export function DocsDemo({
  height,
  title,
  children,
}: DocsDemoProps): ReactElement {
  const heightCss = resolveHeight(height);

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: heightCss,
    borderRadius: '8px',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
    margin: '20px 0',
    background: 'var(--bg-demo, #0a0a10)',
    boxShadow: 'var(--shadow-demo, 0 4px 32px rgba(0,0,0,0.5))',
    // overflow: hidden is intentionally removed — no nested scroll
  };

  return (
    <div>
      {title !== undefined && (
        <p className="docs-demo__title" style={{ marginBottom: 8, opacity: 0.7, fontSize: 13 }}>
          {title}
        </p>
      )}
      <div style={containerStyle}>
        {children}
      </div>
    </div>
  );
}
```

**`scrollUnits` prop:** Deprecated but retained with a type change to `scrollUnits?: number` (optional). Its value is silently ignored. This prevents immediate breakage of all 26 page files. The pages can be updated in a follow-on pass to remove the prop.

### 4.5 `packages/docs/src/demo/DemoEngine.tsx` — DEPRECATED (Phase 1), REMOVED (Phase 3)

In the unified scroll model, there is no per-demo engine. All demos in the docs share the app-level `EngineProvider`. The `DemoEngine` component is eventually deleted.

**Phase 1 action:** Mark `DemoEngine` with a `@deprecated` JSDoc tag and an inline code comment. Do NOT change its runtime behavior. `DemoEngine` must continue to function as a real `EngineProvider` wrapper in Phase 1, because the app-level engine (Phase 2A) does not exist yet. Making `DemoEngine` a no-op in Phase 1 would immediately break every demo page before the replacement engine is in place.

```typescript
// packages/docs/src/demo/DemoEngine.tsx
// DEPRECATED: DemoEngine will be removed in Phase 3 of the unified scroll migration.
// New code: use the DocsApp-level EngineProvider.
// Existing callsites continue to work unchanged during the Phase 1 → 2 transition.

// ... existing implementation unchanged ...

/**
 * @deprecated
 * In the unified scroll model, the engine is provided at the DocsApp level.
 * This component remains functional during the transition period and will be
 * deleted in Phase 3 (after all call sites are migrated to the global engine).
 */
export function DemoEngine({ ... }: DemoEngineProps): ReactElement {
  // ... existing implementation unchanged ...
}
```

**Phase 3 action (after Phase 2A + 2B are merged):** Delete the file entirely.

### 4.6 `packages/docs/src/demo/WheelCaptureDemo.tsx` — DELETED (Phase 2)

No longer needed. In Phase 1, leave the file but add a deprecation comment. In Phase 2, delete.

### 4.7 `packages/docs/src/demo/DemoCaptureContext.ts` — DELETED (Phase 2)

No longer needed. In Phase 1, leave the file but add a deprecation comment. In Phase 2, delete.

### 4.8 `packages/docs/src/demo/normalizeDelta.ts` — RETAINED

Keep this file. Pure utility function, no architectural coupling. Can be used if needed for future scroll tuning.

### 4.9 `packages/docs/src/layout/DocsApp.tsx` — add `EngineProvider` wiring

Once the app-level engine is established (Phase 2), `DocsApp` needs to accept engine configuration. The `DocsApp` props gain optional `engineConfig`:

```typescript
export interface DocsAppProps {
  nav: DocsNav<string>;
  /**
   * Optional engine configuration. When provided, DocsApp wraps the content
   * column in an EngineProvider and mounts a sticky SceneCanvas driven by
   * window scroll. When omitted, DocsApp renders a pure documentation layout
   * with no 3D canvas.
   */
  engineConfig?: {
    plugins: WidgetPlugin[];
    manifestUrl: string;
    /**
     * Total scroll height in pixels. Sum of all scene scrollUnits.
     * Passed to <ScrollCaptureSection height={...}> only.
     * NOT forwarded to EngineProvider.scrollHeightPx — ScrollCaptureSection
     * drives progress via setRawProgress() and does not use the engine's
     * internal scroll-height calculation.
     */
    scrollHeightPx: number;
    /** Scene DSL children (Scene elements with their DSL props). */
    scenes: ReactNode;
    quality?: 'performance' | 'balanced' | 'high';
  };
  children: ReactNode;
}
```

The actual `EngineProvider` + `ScrollCaptureSection` mounting lives inside `DocsApp` when `engineConfig` is provided:

```tsx
// Inside DocsApp render:
const mainContent = engineConfig ? (
  <EngineProvider
    plugins={engineConfig.plugins}
    manifestUrl={engineConfig.manifestUrl}
    quality={engineConfig.quality}
    // NOTE: scrollHeightPx is intentionally NOT passed to EngineProvider here.
    // ScrollCaptureSection drives progress via direct setRawProgress() calls,
    // computing normalized [0,1] progress from its own outer div geometry.
    // EngineProvider.scrollHeightPx only affects the engine's internal scroll-
    // height calculation (used by EngineScrollRegion), which is bypassed entirely
    // when ScrollCaptureSection is the scroll driver.
  >
    {/* Scene declarations — compile to SceneTrack, no DOM output */}
    {engineConfig.scenes}
    {/* Sticky canvas driven by window scroll */}
    <ScrollCaptureSection height={engineConfig.scrollHeightPx} stageHeight="100vh">
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </ScrollCaptureSection>
    {/* Documentation content flows after the scroll region */}
    <DocsMainColumn ref={columnRef}>
      {children}
    </DocsMainColumn>
  </EngineProvider>
) : (
  <DocsMainColumn ref={columnRef}>
    {children}
  </DocsMainColumn>
);
```

### 4.10 `docs/src/App.tsx` — MODIFIED (Phase 2)

Add `engineConfig` to the `DocsApp` usage:

```typescript
// docs/src/App.tsx

import { corePlugin } from '@brewsite/core';

const DOCS_SCENES = (
  <>
    <Scene key="getting-started" id="getting-started">
      <Camera mode="world" position={[0, 2, 8]} target={[0, 0, 0]} />
      <ProgressManager scrollUnits={1200} />
      <Lighting>
        <Ambient color="#ffffff" intensity={0.4} />
        <Directional color="#ffffff" intensity={1.0} position={[5, 10, 5]} />
      </Lighting>
      <Background color="#0d0d12" />
    </Scene>
    {/* ... one Scene per documentation section ... */}
  </>
);

// Total = sum of all ProgressManager scrollUnits
const TOTAL_SCROLL_PX = 36000; // example; computed from scene DSL

export default function App(): ReactElement {
  return (
    <DocsApp
      nav={docsNav}
      engineConfig={{
        plugins: [corePlugin()],
        manifestUrl: '/scene-manifest.json',
        scrollHeightPx: TOTAL_SCROLL_PX,
        scenes: DOCS_SCENES,
        quality: 'balanced',
      }}
    >
      <GettingStartedPage />
      <InstallationPage />
      {/* ... all pages ... */}
    </DocsApp>
  );
}
```

### 4.11 `packages/docs/src/style/layout.css` — MODIFIED

Remove the `.docs-scroll-region` rule. It no longer applies to any element.

```css
/* REMOVE these lines (lines 55–58 in the current file): */

/* Scroll content region */
.docs-scroll-region {
  overflow-y: auto;
  height: 100%;
}
```

Add a replacement rule for `.docs-main-column`:

```css
/* Main content column — block flow, no scroll container */
.docs-main-column {
  min-width: 0;
}
```

### 4.12 `packages/docs/src/index.ts` — MODIFIED

Remove `DocsScrollRegion` export (if it was exported). Currently it is not in `index.ts` — confirmed by reading the file. No change needed.

Update `DocsDemo` export: retain but it now exports the simplified non-wheel-capture version.

Add new export for `DocsMainColumn` (needed only if consumers build custom layouts):

```typescript
// Add:
export { DocsMainColumn } from './layout/DocsMainColumn';
export type { DocsMainColumnProps } from './layout/DocsMainColumn';
```

### 4.13 `packages/docs/src/layout/__tests__/DocsApp.test.tsx` — MODIFIED

The IntersectionObserver test must change because `root` is now `null` (window), not the scroll element. The test currently asserts behavior via `root: scrollEl`. The new test does not require a scroll element reference.

**Updated test contract:** The test fires the IntersectionObserver callback with a mock entry for a `[data-section-id]` element and asserts that `aria-current="page"` is set on the correct nav button. The `root` argument is not observable from the test — assert on observable output only (button aria-current state).

Additionally, remove any test that directly asserts `root: scrollEl` was passed to the IntersectionObserver constructor. The new tests assert on behavioral output (nav highlighting), not on the observer configuration.

New test cases to add:
- `'does not render a scroll container div with overflow-y: auto'` — asserts the content column element does not have `overflow-y: auto` in its computed style
- `'section scrollIntoView is called on sidebar click'` — asserts `document.getElementById(id).scrollIntoView` is called (mock `document.getElementById`)

### 4.14 `packages/docs/src/demo/__tests__/DocsDemo.test.tsx` — MODIFIED

Remove tests for wheel capture behavior (they test the now-deleted `WheelCaptureDemo` integration). Retain:
- `'placeholder div has the same height as the mounted container (number)'`
- `'placeholder div has the same height as the mounted container (string)'`

Remove:
- `'renders placeholder (not children) before mount trigger'` — no longer lazy-mounted

Add:
- `'renders children directly (no lazy mount)'`
- `'container does not have overflow: hidden'` — asserts the container style does not include `overflow: hidden`
- `'deprecated scrollUnits prop is silently ignored'` — passes `scrollUnits` and asserts no error thrown

### 4.15 Demo and page file migrations — MODIFIED (Phase 2B, parallel)

Two distinct file sets require changes. They are independent of each other and can be done in parallel within Phase 2B, but both depend on Phase 2A (app-level engine) being in place.

**File counts (verified against the repository):**
- `docs/src/demos/core/` — **14** `.demo.tsx` files (the actual scene DSL + SceneCanvas components)
- `docs/src/pages/core/` — **26** `.tsx` page files (the documentation page layouts that embed `<DocsDemo>`)

**14 demo files (`docs/src/demos/core/*.demo.tsx`) — remove `DemoEngine` wrapper:**

Each demo currently has:
```tsx
<DemoEngine plugins={DEMO_PLUGINS} manifestUrl="/scene-manifest.json">
  <Scene key="s1" id="s1">...</Scene>
  <SceneCanvas style={{ width: '100%', height: '100%' }} />
</DemoEngine>
```

After Phase 2B:
```tsx
// No DemoEngine wrapper — the engine is provided at DocsApp level.
// SceneCanvas reads from the ancestor EngineProvider via EngineContext.
<>
  <SceneCanvas style={{ width: '100%', height: '100%' }} />
  <EngineOverlayHost />
</>
```

The `Scene` DSL block is moved from the demo file to the app-level `DOCS_SCENES` in `docs/src/docs-scenes.tsx`.

**Complete list of 14 demo files to migrate:**
1. `docs/src/demos/core/BackgroundDemo.demo.tsx`
2. `docs/src/demos/core/BasicSceneDemo.demo.tsx`
3. `docs/src/demos/core/CameraOrbitDemo.demo.tsx`
4. `docs/src/demos/core/CameraWorldDemo.demo.tsx`
5. `docs/src/demos/core/EnvironmentDemo.demo.tsx`
6. `docs/src/demos/core/FloorReflectionDemo.demo.tsx`
7. `docs/src/demos/core/HudOverlayDemo.demo.tsx`
8. `docs/src/demos/core/InputActionsDemo.demo.tsx`
9. `docs/src/demos/core/LightingDemo.demo.tsx`
10. `docs/src/demos/core/ModelAnimationDemo.demo.tsx`
11. `docs/src/demos/core/ModelBasicDemo.demo.tsx`
12. `docs/src/demos/core/MultiSceneDemo.demo.tsx`
13. `docs/src/demos/core/TransitionEasingDemo.demo.tsx`
14. `docs/src/demos/core/VariableStoreDemo.demo.tsx`

**26 page files (`docs/src/pages/core/*.tsx`) — remove deprecated `scrollUnits` prop:**

Each page file currently has:
```tsx
<DocsDemo scrollUnits={2400} height={480}>
  <SomeDemoComponent />
</DocsDemo>
```

After Phase 2B:
```tsx
<DocsDemo height={480}>
  <SomeDemoComponent />
</DocsDemo>
```

Remove `scrollUnits` prop from all `DocsDemo` usages (the prop is deprecated and ignored).

**Complete list of 26 page files to update:**
1. `docs/src/pages/core/Actions.tsx`
2. `docs/src/pages/core/ApiReference.tsx`
3. `docs/src/pages/core/BackgroundElement.tsx`
4. `docs/src/pages/core/CameraElement.tsx`
5. `docs/src/pages/core/Concepts.tsx`
6. `docs/src/pages/core/CoreConcepts.tsx`
7. `docs/src/pages/core/CustomWidget.tsx`
8. `docs/src/pages/core/EnvironmentElement.tsx`
9. `docs/src/pages/core/FloorElement.tsx`
10. `docs/src/pages/core/GettingStarted.tsx`
11. `docs/src/pages/core/Hooks.tsx`
12. `docs/src/pages/core/HudAnimejs.tsx`
13. `docs/src/pages/core/HudOverview.tsx`
14. `docs/src/pages/core/Installation.tsx`
15. `docs/src/pages/core/LabelSystem.tsx`
16. `docs/src/pages/core/LightingElement.tsx`
17. `docs/src/pages/core/ModelElement.tsx`
18. `docs/src/pages/core/MultiScene.tsx`
19. `docs/src/pages/core/Navigation.tsx`
20. `docs/src/pages/core/QuickStart.tsx`
21. `docs/src/pages/core/Registry.tsx`
22. `docs/src/pages/core/SceneDsl.tsx`
23. `docs/src/pages/core/ScenePlayerRef.tsx`
24. `docs/src/pages/core/TimelineApi.tsx`
25. `docs/src/pages/core/Transitions.tsx`
26. `docs/src/pages/core/VariableStore.tsx`

Example before (current):
```tsx
// BasicSceneDemo.demo.tsx
export function BasicSceneDemo(): ReactElement {
  return (
    <DemoEngine plugins={DEMO_PLUGINS} manifestUrl="/scene-manifest.json">
      <Scene key="s1" id="s1">...</Scene>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
    </DemoEngine>
  );
}
```

Example after:
```tsx
// BasicSceneDemo.demo.tsx
export function BasicSceneDemo(): ReactElement {
  return (
    // No DemoEngine wrapper — the engine is provided at DocsApp level.
    // SceneCanvas reads from the ancestor EngineProvider via EngineContext.
    <>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </>
  );
}
```

The corresponding scene DSL is moved from the demo component file to the app-level `DOCS_SCENES` declaration in `docs/src/App.tsx`.

**Note on per-section scenes:** Each existing demo shows a self-contained 2–3 scene sequence illustrating the doc section topic. In the unified model, these become scenes within the global docs engine. Each page's scenes are sequential within the global scene list, ordered to match the page order in the nav.

---

## 5. Parallelization Strategy

The work has clear dependency boundaries. The following phases can be partially parallelized:

### Phase 1: Non-breaking foundation (must be done first, all sequential)

1. **Create `DocsMainColumn.tsx`** (new file, no dependencies)
2. **Update `DocsApp.tsx`** — replace `DocsScrollRegion` import with `DocsMainColumn`, change IntersectionObserver root to `null`, change `document.querySelectorAll` to global query
3. **Delete `DocsScrollRegion.tsx`** — in the same commit as step 2. It has exactly one caller; no deprecation cycle needed.
4. **Update `layout.css`** — remove `.docs-scroll-region` rule, add `.docs-main-column` rule
5. **Simplify `DocsDemo.tsx`** — remove wheel capture, remove IntersectionObserver lifecycle, deprecate `scrollUnits` prop, keep `height` prop, keep children rendering
6. **Update `DocsApp` test** — adjust IntersectionObserver assertions to match new root behavior
7. **Update `DocsDemo` test** — remove wheel-capture tests, add non-overflow container test

Verify: `pnpm --filter @brewsite/docs test` passes. `pnpm --filter docs typecheck` passes.

### Phase 2: App-level engine (parallel tracks A and B after Phase 1 is stable)

**Track A (engine integration) — one developer:**
- Create `docs/src/docs-scenes.tsx` — define `DOCS_SCENES` ReactNode with all scene DSLs
- Define `TOTAL_SCROLL_PX` constant (sum of all scene `scrollUnits`)
- Update `DocsApp.tsx` to accept `engineConfig?` prop
- Update `docs/src/App.tsx` to pass `engineConfig` to `DocsApp`
- Test: verify `pnpm dev` starts and canvas renders in the browser

**Track B (demo file migration) — separate developer, can run in parallel with Track A after Phase 1:**
- For each of the 14 demo `.demo.tsx` files (see section 4.15 for the full list):
  - Remove `DemoEngine` wrapper
  - Remove `Scene` DSL (moved to `DOCS_SCENES`)
  - Replace with `<SceneCanvas style={{ width: '100%', height: '100%' }} />`
- For each of the 26 page `.tsx` files (see section 4.15 for the full list):
  - Remove `scrollUnits` prop from all `DocsDemo` usages
- These 40 files are all independent of each other — they can be split across multiple developers or done in a single batch

**Track A and B must ship as a single atomic merge (one PR, one commit).** They can be *developed* in parallel by two people on separate branches, but they cannot be merged independently. Merging Track B alone (SceneCanvas without ancestor EngineProvider) results in blank canvases and context errors on every demo page. Merging Track A alone (global engine without migrated demos) results in the engine running but all demo canvases still wrapped in per-demo `DemoEngine` instances, causing double-engine conflicts. Both tracks must land together.

### Phase 3: Cleanup (after Phase 2 merges)

- Delete `packages/docs/src/demo/DemoEngine.tsx`
- Delete `packages/docs/src/demo/WheelCaptureDemo.tsx`
- Delete `packages/docs/src/demo/DemoCaptureContext.ts`
- Update `packages/docs/src/index.ts` to remove deprecated exports
- Update `packages/docs/src/demo/__tests__/DemoEngine.test.tsx` — delete or replace with tests for any remaining demo-layer utilities
- Mark `prd_docs-package.md` Non-Goal "Cinematic hybrid scroll mode" as satisfied by the unified scroll model

---

## 6. Test Strategy

### 6.1 What to verify in each changed module

**`DocsMainColumn.tsx` (new):**
- Renders children
- Does NOT have `overflow-y: auto` in its inline style
- Does NOT have `height: 100vh` in its inline style
- Forwards ref correctly (`ref.current` is the outer div)

```typescript
// packages/docs/src/layout/__tests__/DocsMainColumn.test.tsx
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { DocsMainColumn } from '../DocsMainColumn';

it('renders children', () => {
  const { getByTestId } = render(
    <DocsMainColumn><div data-testid="child" /></DocsMainColumn>
  );
  expect(getByTestId('child')).not.toBeNull();
});

it('does not apply overflow-y: auto', () => {
  const { container } = render(<DocsMainColumn><div /></DocsMainColumn>);
  const el = container.firstElementChild as HTMLElement;
  expect(el.style.overflowY).not.toBe('auto');
  expect(el.style.overflowY).not.toBe('scroll');
});

it('does not apply height: 100vh', () => {
  const { container } = render(<DocsMainColumn><div /></DocsMainColumn>);
  const el = container.firstElementChild as HTMLElement;
  expect(el.style.height).toBe('');
});

it('forwards ref to the outer div', () => {
  const ref = createRef<HTMLDivElement>();
  const { container } = render(<DocsMainColumn ref={ref}><div /></DocsMainColumn>);
  expect(ref.current).toBe(container.firstElementChild);
});
```

**`DocsApp.tsx` (modified):**
- Retain all existing passing tests (sidebar rendering, active section marking via IntersectionObserver)
- Add: verify no `.docs-scroll-region` element in the rendered output
- Add: verify IntersectionObserver is constructed with `root: null`

```typescript
// In packages/docs/src/layout/__tests__/DocsApp.test.tsx — add:

it('constructs IntersectionObserver with root: null', () => {
  render(<DocsApp nav={docsNav}><div /></DocsApp>);
  // The mock captures all constructor calls.
  expect(IntersectionObserver).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({ root: null }),
  );
});

it('does not render a div with overflow-y: auto as the content column', () => {
  const { container } = render(<DocsApp nav={docsNav}><div>content</div></DocsApp>);
  const allDivs = Array.from(container.querySelectorAll('div'));
  const overflowDivs = allDivs.filter(
    (d) => d.style.overflowY === 'auto' || d.style.overflowY === 'scroll',
  );
  expect(overflowDivs).toHaveLength(0);
});
```

**`DocsDemo.tsx` (modified):**
- Remove: lazy-mount test (no longer applicable — no IntersectionObserver lifecycle)
- Retain: height rendering as number
- Retain: height rendering as string
- Add: container does not have `overflow: hidden`
- Add: children render immediately without IntersectionObserver trigger

```typescript
// In packages/docs/src/demo/__tests__/DocsDemo.test.tsx — replace:

it('renders children immediately without IntersectionObserver trigger', () => {
  const { getByTestId } = render(
    <DocsDemo height={480}>
      <div data-testid="demo-content">Demo Content</div>
    </DocsDemo>
  );
  expect(getByTestId('demo-content')).not.toBeNull();
});

it('container does not have overflow: hidden', () => {
  const { container } = render(
    <DocsDemo height={480}><div>content</div></DocsDemo>
  );
  // The inner container div (not the outer title wrapper) should not clip overflow.
  const innerContainer = container.querySelector('[style*="height: 480px"]') as HTMLElement;
  expect(innerContainer?.style.overflow).not.toBe('hidden');
});

it('placeholder div has height as number', () => {
  const { container } = render(
    <DocsDemo height={480}><div>content</div></DocsDemo>
  );
  // No placeholder div — children render directly. Assert container height.
  const inner = container.querySelector('[style*="height"]') as HTMLElement;
  expect(inner?.style.height).toBe('480px');
});

it('placeholder div has height as string', () => {
  const { container } = render(
    <DocsDemo height="100vh"><div>content</div></DocsDemo>
  );
  const inner = container.querySelector('[style*="height"]') as HTMLElement;
  expect(inner?.style.height).toBe('100vh');
});
```

### 6.2 Integration verification (manual / browser)

Because the app uses Three.js and a real WebGL context, the integration test is performed manually in the browser:

1. Run `pnpm dev` (docs app, port 5175)
2. Open the docs site. Verify the sticky canvas renders while in the scroll-budget zone
3. Scroll past the scroll budget — verify the canvas un-sticks and documentation text flows below
4. Click a sidebar link — verify `scrollIntoView` navigates correctly without a nested scroll container
5. Load the page with a hash URL (e.g., `#floor`) — verify the page jumps to the correct section
6. Verify no console errors about scroll source conflicts or IntersectionObserver root mismatches

### 6.3 Regression guard

Run the full test suite after each phase:

```bash
pnpm --filter @brewsite/docs test
pnpm --filter @brewsite/core test
pnpm --filter @brewsite/diagram test
```

Ensure zero failures in `@brewsite/core` and `@brewsite/diagram` — neither package is modified by this plan, and the changes in `@brewsite/docs` must not introduce any dependency on implementation details of those packages beyond their published interface.

---

## 7. Files Changed: Complete Reference

| File | Action | Phase |
|---|---|---|
| `packages/docs/src/layout/DocsMainColumn.tsx` | Create (new) | 1 |
| `packages/docs/src/layout/DocsScrollRegion.tsx` | Delete (same commit as DocsApp.tsx update) | 1 |
| `packages/docs/src/layout/DocsApp.tsx` | Modify: root=null, DocsMainColumn | 1 |
| `packages/docs/src/style/layout.css` | Modify: remove .docs-scroll-region, add .docs-main-column | 1 |
| `packages/docs/src/demo/DocsDemo.tsx` | Modify: remove wheel capture, deprecate scrollUnits | 1 |
| `packages/docs/src/demo/DemoEngine.tsx` | Modify: add @deprecated tag, keep functional | 1 |
| `packages/docs/src/demo/WheelCaptureDemo.tsx` | Add deprecation comment | 1 |
| `packages/docs/src/demo/DemoCaptureContext.ts` | Add deprecation comment | 1 |
| `packages/docs/src/layout/__tests__/DocsApp.test.tsx` | Modify: adjust root assertions | 1 |
| `packages/docs/src/layout/__tests__/DocsMainColumn.test.tsx` | Create (new) | 1 |
| `packages/docs/src/demo/__tests__/DocsDemo.test.tsx` | Modify: remove wheel tests | 1 |
| `packages/docs/src/index.ts` | Modify: add DocsMainColumn export | 1 |
| `docs/src/docs-scenes.tsx` | Create (new) | 2A |
| `docs/src/App.tsx` | Modify: add engineConfig | 2A |
| `packages/docs/src/layout/DocsApp.tsx` | Modify: add engineConfig prop + EngineProvider | 2A |
| All 14 `docs/src/demos/core/*.demo.tsx` | Modify: remove DemoEngine, move Scene DSL to docs-scenes.tsx | 2B |
| All 26 `docs/src/pages/core/*.tsx` | Modify: remove scrollUnits prop from DocsDemo usages | 2B |
| `packages/docs/src/demo/DemoEngine.tsx` | Delete | 3 |
| `packages/docs/src/demo/WheelCaptureDemo.tsx` | Delete | 3 |
| `packages/docs/src/demo/DemoCaptureContext.ts` | Delete | 3 |
| `packages/docs/src/demo/__tests__/DemoEngine.test.tsx` | Delete or replace | 3 |
| `packages/docs/src/demo/__tests__/WheelCaptureDemo.test.tsx` | Delete | 3 |

---

## 8. Constraints and Boundary Rules

- `@brewsite/core` is never imported from implementation files inside `@brewsite/docs` except via the published package interface (`import ... from '@brewsite/core'`). No internal imports like `@brewsite/core/src/...`.
- `@brewsite/docs` must not be imported by `@brewsite/core` (absolute constraint from the monorepo dependency graph).
- `ScrollCaptureSection` is used via its published export from `@brewsite/core`. It is already exported from `packages/core/src/player/index.ts`.
- The `EngineProvider`, `SceneCanvas`, `EngineOverlayHost`, `ScrollCaptureSection` imports in `DocsApp.tsx` all come from `@brewsite/core`.

---

## 9. What the Implementing Developer Does NOT Need to Decide

This plan is complete. The following decisions are pre-made:

- **Scroll source:** `window` scroll, not element scroll. No element-level `overflow-y: auto` on the content column.
- **IntersectionObserver root:** `null` (window viewport). Not the scroll element.
- **Engine placement:** A single `EngineProvider` at the `DocsApp` level. Not per-demo.
- **Sticky canvas pattern:** `ScrollCaptureSection` from `@brewsite/core`. Not `EngineInputRegion` in scroll mode. `ScrollCaptureSection` is simpler and correct for inline sticky within a larger document flow.
- **`EngineProvider.scrollHeightPx` is NOT used** when `ScrollCaptureSection` is the scroll driver. `ScrollCaptureSection` computes normalized `[0,1]` progress directly from its outer div geometry via `getBoundingClientRect()` and calls `engine.setRawProgress()` — it does not use the engine's internal scroll-height calculation. `EngineProvider.scrollHeightPx` only matters when `EngineScrollRegion` drives progress (which is not the case here). Pass `scrollHeightPx` only to `ScrollCaptureSection.height`.
- **`DemoEngine` fate:** Deprecated shim in Phase 1, deleted in Phase 3.
- **`scrollUnits` prop:** Deprecated (silently ignored). Retained for API compatibility for 1 release cycle.
- **Demo component structure after Phase 2:** `<SceneCanvas>` + `<EngineOverlayHost>` without any engine wrapper. Scene DSL moves to `docs/src/docs-scenes.tsx`.
- **Phase ordering:** Phase 1 is a prerequisite for Phase 2. Phase 2A and 2B are independent and can be done in parallel. Phase 3 requires Phase 2 complete.
- **Test environment:** Vitest + jsdom, same as the existing `@brewsite/docs` test setup. No new test infrastructure needed.
- **TypeScript imports in new/modified files:** Follow the module boundary table. No `any`, no `as` casts to silence errors.

---

## 10. Phase 4 — Bug Fixes (post-Phase 3)

Phase 4 corrects two implementation bugs discovered during verification of the Phase 1+2A+2B commit. Both bugs are confined to `docs/src/` — neither touches `@brewsite/docs` package source nor `@brewsite/core`.

**Prerequisite:** Phase 3 must be committed first (`fix(docs): phase 3 — delete DemoEngine and dead code`). Phase 4 ships as its own atomic commit with message: `fix(docs): phase 4 — remove wheel capture and SceneCanvas conflicts`.

---

### 10.1 Fix 1 — Remove InputController from `input-scene`

**File:** `docs/src/docs-scenes.tsx`

**Root cause:** The `input-scene` scene contains `<InputController>` with `<Action id="dolly" type="camera.dolly"><WheelMap /></Action>`. When this scene is active, `useEngineInput` creates an `ActionInputController` attached to the canvas element with `{ passive: false }` wheel listener (`packages/core/src/input/ActionInputController.ts:129`). A plain (no-modifier) wheel event on the canvas matches `<WheelMap />` → `e.preventDefault()` is called (`ActionInputController.ts:588`) → window scroll is suppressed → `ScrollCaptureSection`'s `window.scroll` listener never fires → progress freezes at scene 31/34. The user cannot scroll past `input-scene`.

Additionally, `<Camera mode="orbit" interaction={{ enabled: true }}>` enables camera-controls' internal wheel handling for that scene, which is also incompatible with the scroll-driven model.

**Change:** Replace the entire `input-scene` block (lines 448–476 in `docs/src/docs-scenes.tsx`) with the following static version. No `<InputController>`, no `interaction={{ enabled: true }}`:

```tsx
{/* ── Input Actions (Navigation / Actions) ─────────────────────────────── */}
<Scene key="input-scene" id="input-scene">
  <ProgressManager scrollUnits={SCROLL_UNITS_PER_SCENE} />
  <Camera
    mode="orbit"
    target={[0, 0, 0]}
    azimuth={0}
    polar={1.2}
    distance={6}
  />
  <Lighting>
    <Ambient color="#ffffff" intensity={0.5} />
    <Directional color="#ffffff" intensity={0.8} position={[5, 10, 5]} />
  </Lighting>
  <Floor enabled>
    <FloorPhysical opacity={0.5} metalness={0.4} roughness={0.6} />
  </Floor>
</Scene>
```

**Rationale:** The docs app is purely scroll-driven. No scene should intercept wheel events. The scene still demonstrates orbit camera mode visually — the `InputController` DSL is shown in the page's `<CodeBlock>` (in `docs/src/pages/core/Actions.tsx`), not in the live engine. Remove the `InputController`, `Action`, `PointerMap`, and `WheelMap` imports from `docs-scenes.tsx` if they are no longer used after this change.

**Imports to remove from `docs/src/docs-scenes.tsx`** (if no other scene uses them after this change):
```typescript
// Remove these if unused after editing input-scene:
InputController,
Action,
PointerMap,
WheelMap,
```

Verify with TypeScript that no other scene in `docs-scenes.tsx` uses `InputController`, `Action`, `PointerMap`, or `WheelMap` before removing the imports.

---

### 10.2 Fix 2 — Remove `SceneCanvas` and `EngineOverlayHost` from all 14 demo files

**Root cause:** Phase 2B migrated the 14 demo components to render `<SceneCanvas style={{ width: '100%', height: '100%' }} />` (and `<EngineOverlayHost />`) directly. These call `engine.setCanvasRef(el)` on mount. The engine only supports one active canvas at a time. With 15 total `SceneCanvas` instances (1 global in `ScrollCaptureSection` + 14 in DocsDemo containers), the last `setCanvasRef` call overwrites all previous ones. React fires effects bottom-up, so the global canvas in `ScrollCaptureSection` (shallower in the tree) has its effect run last, but concurrent React rendering makes this non-deterministic. In practice, one of the demo canvases may capture the engine canvas ref, causing Three.js to render into a 480px hidden div instead of the 100vh sticky canvas. The `ActionInputController` also attaches to the wrong canvas element.

**Fix:** The single global `SceneCanvas` wired inside `ScrollCaptureSection` in `DocsApp` is the **only** correct rendering surface. All 14 demo components must be simplified to remove `SceneCanvas` and `EngineOverlayHost`. The sticky global canvas already provides the 3D rendering for the entire viewport.

**Rule for each demo component:** Remove `<SceneCanvas .../>` and `<EngineOverlayHost />` and their imports. If the component has no remaining content after removal, return `null`. If the component has overlay UI that reads from the engine context (e.g. `useCurrentScene()`), keep that content — it still works via the ancestor `EngineProvider`.

**Complete list of 14 files and their required final state:**

#### 1. `docs/src/demos/core/BackgroundDemo.demo.tsx`
```tsx
export function BackgroundDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 2. `docs/src/demos/core/BasicSceneDemo.demo.tsx`
```tsx
export function BasicSceneDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 3. `docs/src/demos/core/CameraOrbitDemo.demo.tsx`
```tsx
export function CameraOrbitDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 4. `docs/src/demos/core/CameraWorldDemo.demo.tsx`
```tsx
export function CameraWorldDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 5. `docs/src/demos/core/EnvironmentDemo.demo.tsx`
```tsx
export function EnvironmentDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 6. `docs/src/demos/core/FloorReflectionDemo.demo.tsx`
```tsx
export function FloorReflectionDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 7. `docs/src/demos/core/HudOverlayDemo.demo.tsx`
```tsx
export function HudOverlayDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 8. `docs/src/demos/core/InputActionsDemo.demo.tsx`
```tsx
export function InputActionsDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 9. `docs/src/demos/core/LightingDemo.demo.tsx`
```tsx
export function LightingDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 10. `docs/src/demos/core/ModelAnimationDemo.demo.tsx`
```tsx
export function ModelAnimationDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 11. `docs/src/demos/core/ModelBasicDemo.demo.tsx`
```tsx
export function ModelBasicDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 12. `docs/src/demos/core/MultiSceneDemo.demo.tsx`
```tsx
export function MultiSceneDemo(): null {
  return null;
}
```
Remove: `import { SceneCanvas, EngineOverlayHost } from '@brewsite/core';`

#### 13. `docs/src/demos/core/TransitionEasingDemo.demo.tsx`

This file has `useState` for tab selection, but the tab state is no longer connected to the engine (the scene DSL is static in `docs-scenes.tsx`). Simplify to `null`:

```tsx
// TransitionEasingDemo: the global SceneCanvas in ScrollCaptureSection provides rendering.
// The transition-easing scene is defined in docs-scenes.tsx (transition-start / transition-end).
import type { ReactElement } from 'react';

export const CODE = `
// The transition prop on <Scene> controls the timing of the animated transition.
// ...
`.trim(); // Keep the CODE export — it is used by the page's CodeBlock.

export function TransitionEasingDemo(): null {
  return null;
}
```
Remove: `import { useState, type ReactElement } from 'react'` → replace with `import type { ReactElement } from 'react'` (only if ReactElement is needed elsewhere in the file; otherwise remove the React import entirely since the function returns null with no JSX).
Remove: `import { type TransitionWindow, type SceneTransitionProp, SceneCanvas, EngineOverlayHost } from '@brewsite/core';`
Remove: The `WINDOW_OPTIONS` constant, `selected` state, and the button tab UI — they are non-functional without being wired to the global engine.

Note: The `CODE` constant export must be preserved as-is — it is imported and rendered in a `<CodeBlock>` by the transitions page.

#### 14. `docs/src/demos/core/VariableStoreDemo.demo.tsx`

This file has `SceneInfoOverlay` which reads `useCurrentScene()` from the ancestor `EngineProvider`. This is still meaningful — it shows the currently-active scene ID as the user scrolls past the var-intro / var-detail scenes. Keep `SceneInfoOverlay` but remove `SceneCanvas` and `EngineOverlayHost`.

The `SceneInfoOverlay` renders `position: absolute; top: 16; right: 16`. The `DocsDemo` container has `position: relative` (from `containerStyle`). This positioning works correctly — the overlay floats in the top-right of the demo container and updates as the global engine advances.

```tsx
// VariableStoreDemo: reads scene state via useCurrentScene using the ancestor EngineProvider.
import type { ReactElement } from 'react';
import { useCurrentScene } from '@brewsite/core';

export const CODE = `...`.trim(); // Keep unchanged

function SceneInfoOverlay(): ReactElement {
  const { id, index } = useCurrentScene();
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      background: 'rgba(0,0,0,0.5)',
      padding: '8px 14px',
      borderRadius: 6,
      color: '#fff',
      fontSize: 13,
      fontFamily: 'monospace',
    }}>
      scene: {id} ({index})
    </div>
  );
}

// No SceneCanvas — the global SceneCanvas in ScrollCaptureSection provides rendering.
// SceneInfoOverlay reads useCurrentScene() from the ancestor EngineProvider.
export function VariableStoreDemo(): ReactElement {
  return <SceneInfoOverlay />;
}
```
Remove: `SceneCanvas`, `EngineOverlayHost` from the `@brewsite/core` import line.

---

### 10.3 Files Changed in Phase 4

| File | Action |
|---|---|
| `docs/src/docs-scenes.tsx` | Modify: replace `input-scene` block, remove `InputController`/`Action`/`PointerMap`/`WheelMap` imports if unused |
| `docs/src/demos/core/BackgroundDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/BasicSceneDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/CameraOrbitDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/CameraWorldDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/EnvironmentDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/FloorReflectionDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/HudOverlayDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/InputActionsDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/LightingDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/ModelAnimationDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/ModelBasicDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/MultiSceneDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; return null |
| `docs/src/demos/core/TransitionEasingDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`, `useState`, tab UI; return null; keep `CODE` export |
| `docs/src/demos/core/VariableStoreDemo.demo.tsx` | Modify: remove `SceneCanvas`, `EngineOverlayHost`; keep `SceneInfoOverlay` + `useCurrentScene` |

**No changes to `@brewsite/docs` package source.** No changes to `@brewsite/core`. No new test files needed — existing `pnpm --filter @brewsite/docs test` suite remains valid and must still pass after Phase 4.

---

### 10.4 Verification After Phase 4

1. `pnpm --filter @brewsite/docs typecheck` — zero errors
2. `pnpm --filter @brewsite/docs test` — all tests pass (21/21)
3. `pnpm --filter @brewsite/core typecheck` — zero errors (Phase 4 makes no core changes; verify no regressions)
4. In the browser (`pnpm dev`): scroll through the full 40,800px scroll budget without any wheel capture interruption — the sticky canvas must advance smoothly from scene 1 through scene 34
5. Specifically: scroll to scene 31 (`input-scene`) — verify the window continues to scroll past it without freezing
6. Verify the sticky canvas is rendering (not blank) — Three.js output should appear in the viewport canvas, not in a hidden demo div
