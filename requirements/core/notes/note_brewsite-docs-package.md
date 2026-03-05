---
title: Feature Note — @brewsite/docs Package
doc_type: note
owner: product
status: draft
updated: 2026-03-05
---

# Feature Note — @brewsite/docs Package

## Problem Statement

The current `apps/docs` is broken for its intended purpose. It is a full-screen `EngineProvider` where every documentation "page" is a BrewSite 3D scene. Written content is rendered as a `DocPanel` HUD overlay that slides up over the Three.js canvas as the user scrolls through the scene's scroll budget. The result:

- **No real HTML flow.** Written content has no natural height — it is pinned as a fixed-position overlay. There is no scrollable text area; the scroll budget is a hard-coded `scrollUnits` integer per scene.
- **No inline 3D demos.** The 3D canvas is the entire page, so there is no concept of embedding a small demo inside a text passage.
- **Two competing nav systems.** `core-nav.ts` uses React Router `path:` items. `docs-nav.ts` uses scroll-based `sceneId:` items. Neither is canonical. `routes.tsx` has been repurposed to a `flattenNav` utility — there is no React Router outlet tree.
- **No LHS sidebar that reflects HTML sections.** The current `DocsSidebar` highlights based on BrewSite engine scene state (`useSceneEngineState('docs')`), not document section intersection.

The user wants a fundamentally different architecture: a standard continuous-scroll HTML documentation site where 3D "demo" regions are embedded inline — each demo is a self-contained BrewSite scene sequence that steals scroll when the pointer hovers over it.

---

## Proposed Solution

A new `packages/docs` workspace package (`@brewsite/docs`) that provides the runtime infrastructure for building BrewSite documentation sites. It is **not a replacement for a docs generator like Docusaurus** — it is a thin React layout and scroll-coordination layer specific to the BrewSite authoring model.

The fundamental model:

```
<DocsApp nav={docsNav}>
  <GettingStartedPage />   ← a TSX file with <Section> children
  <SceneAuthoringPage />
  <ElementsPage />
  ...
</DocsApp>
```

Each page file exports a component containing `<Section>` children. Sections contain plain HTML/React content. Embedded demos use a `<DocsDemo>` component that mounts its own `DemoEngine` (a drop-in for `EngineProvider`) and captures scroll when hovered.

The sidebar reads a static manifest (`docsNav`) to know what sections exist, and uses `IntersectionObserver` on section anchors to track which one is in view.

---

## Key Design Decisions

### 1. Published npm package or private?

**Decision: design for eventual publication; ship as `"private": true` until the API is validated through one real consumer.**

"Private now, publish later" is a design trap only when the package is built with app-internal assumptions baked in — hardcoded paths, leaking `apps/docs` file conventions into the API, opaque config that only makes sense for one specific consumer. Avoiding those assumptions costs almost nothing architecturally.

The correct stance: design as if a stranger will consume it on day one. Specifically:
- No references to `apps/docs` paths, structures, or conventions inside `packages/docs` source.
- Peer deps properly scoped from the start (see Technical Constraints).
- Component APIs designed for external consumers, not ourselves — no `any`-typed escape hatches.
- The public API surface is the only way for `apps/docs` to interact with the package; no `../../` internal imports.

`"private": true` remains in `package.json` until `apps/docs` has used the package through at least one complete release cycle. At that point, if the API is stable and the experience of consuming it is demonstrably good, we flip to published with a proper semver version.

This is not "maybe public later" — it is "public from the design intent, private as a safety gate until proven." The architect must design to external-consumer standards from the start.

**Bundle size note:** the current note's claim that "bundle size is not a constraint" is only correct for the private `apps/docs` consumer. If the package is later published, tree-shaking, chunk size, and dep weight become real constraints. The architect should apply standard tree-shaking hygiene (named exports, `sideEffects: false`) from the start so this does not become a retrofit.

### 2. Multiple EngineProviders / WebGL contexts on one page

Each `<DocsDemo>` mounts its own `DemoEngine` (which wraps `EngineProvider`) and `SceneCanvas`. This means each demo creates its own WebGL context, `RuntimeDriverImpl`, render loop, and widget registry. This is intentional and correct — demos are independent; their scenes must not share state.

**WebGL context exhaustion is a real constraint.** Browsers enforce a maximum number of simultaneous WebGL contexts per page (Chrome ~16, Safari ~8). A long doc page with many demos will exceed this limit, causing the browser to silently evict older contexts and blank out demos.

**Mitigation: lazy mount/unmount via IntersectionObserver.** `<DocsDemo>` only mounts its `DemoEngine` when the demo region is within (or near) the viewport, and unmounts it when it scrolls far out of view.

- **Mount trigger:** demo enters within `rootMargin: '200% 0px 200% 0px'` (approximately 2 viewport-heights before visible)
- **Unmount trigger:** demo exits beyond `rootMargin: '-400% 0px -400% 0px'` (approximately 4 viewport-heights away)

Implementation: `<DocsDemo>` uses a `useRef` + `IntersectionObserver` to drive an `isMounted` boolean. When `isMounted` is false, a placeholder `<div>` with the same `height` value as the mounted demo is rendered instead. **The placeholder applies the exact same `height` prop value as the mounted container — this is a correctness requirement for hash navigation** (see below).

The `height` prop accepts `number | string`. A numeric value is treated as pixels (`height={480}` → `style={{ height: '480px' }}`). A string value is passed directly as a CSS length (`height="100vh"`). Both placeholder and mounted container receive the same value, so their rendered heights are identical. **Restricting to stable CSS lengths is required:** `calc()` expressions that depend on dynamic layout context (e.g., `calc(100vh - 60px)`) are permitted as long as the same expression resolves to the same pixel height in both placeholder and mounted states — which holds true for viewport-relative units. Expressions that depend on sibling layout (e.g., `calc(100% - someOtherElement)`) are not safe and must not be used.

**Re-mount behavior:** when a demo re-mounts after eviction, it starts fresh: model loading, shader compilation, and texture uploads run again. This typically takes 500ms–2s. The accepted behavior is a brief blank canvas (no special loading state, no spinner, no screenshot capture). The 4x-viewport-height unmount threshold means this only occurs for demos that were scrolled very far from view, so the flash is imperceptible in normal use. This is the correct tradeoff: added complexity of "capture last frame" or spinner overlay does not justify the edge-case benefit.

There is **no shared context architecture** needed. The per-demo `DemoEngine` model is correct because:
- Each demo has a completely different scene configuration (different widgets, models, plugins).
- The alternative (a single global engine with per-demo "slots") would require invasive changes to the widget registry and compiler pipeline with no DX benefit.

### 3. How demo scroll-capture works technically

The core behavior: if the pointer is **over** a demo region, scroll wheel events advance the demo's scenes rather than scrolling the page. If the pointer is **not** over the demo, scroll advances the page.

**Part A — Pointer tracking.** `<DocsDemo>` maintains an `isHovered` boolean via `mouseenter`/`mouseleave` events on the demo's outer container div.

**Part B — Wheel event interception.** When `isHovered` is true, `<DocsDemo>` adds a `wheel` listener with `{ passive: false }` to the container. The listener applies the following logic:

```typescript
function handleWheel(event: WheelEvent) {
  // 1. Never intercept Ctrl+Wheel — that is browser zoom, not scroll.
  if (event.ctrlKey) return;

  // 2. Pass-through at progress boundaries:
  //    - At progress 0.0 and scrolling up: let the page scroll.
  //    - At progress 1.0 and scrolling down: let the page scroll.
  //    This handles momentum scroll correctly — once the demo is exhausted,
  //    momentum events bleed through to the page rather than freezing it.
  const delta = normalizeDelta(event);
  if (delta < 0 && currentProgress <= 0) return;
  if (delta > 0 && currentProgress >= 1) return;

  // 3. Intercept — advance the demo.
  event.preventDefault();
  const newProgress = clamp(currentProgress + delta / totalScrollUnits, 0, 1);
  engineContext.setRawProgress(newProgress);
}
```

**Delta normalization** (`normalizeDelta`): `WheelEvent.deltaMode` must be normalized across pixel (0), line (1), and page (2) modes. This is a known cross-browser footgun. The normalizer:

```typescript
const LINE_HEIGHT_PX = 16;   // standard CSS line-height assumption
const PAGE_HEIGHT_PX = 800;  // reasonable page height estimate

function normalizeDelta(event: WheelEvent): number {
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_PIXEL: return event.deltaY;
    case WheelEvent.DOM_DELTA_LINE:  return event.deltaY * LINE_HEIGHT_PX;
    case WheelEvent.DOM_DELTA_PAGE:  return event.deltaY * PAGE_HEIGHT_PX;
    default: return event.deltaY;
  }
}
```

**The `ScrollCaptureSection` primitive in `@brewsite/core` does not fit this use case** — it listens to `window.scroll` and maps element position to progress. For demos, we need hover-triggered wheel-delta accumulation, not position-based mapping. A new internal `WheelCaptureDemo` primitive handles this in `@brewsite/docs`.

**Progress accumulation convention:** treat `1px` of normalized `deltaY` as `1` scroll unit. This mirrors the convention established in `docs-nav.ts` where `scrollUnits === pixels`.

### 4. Is lazy loading doc sections worth it?

**No for content sections.** HTML sections are cheap — they are static React trees with no Three.js. Lazy-mounting HTML content would add layout-shift risk, IntersectionObserver registration ordering complexity, and sidebar registration race conditions, with no meaningful performance benefit. All `<Section>` content mounts eagerly in a single scrollable div.

**Yes for demo `DemoEngine` instances.** Demo lazy-mounting is a correctness requirement (WebGL context exhaustion), not an optimization choice. See Decision 2.

**Do not lazy-load entire page files via React.lazy().** The doc site is a single-page app assembled at startup. Code-splitting at the page level would create jarring layout shifts because the total scroll height is not knowable until all pages are rendered. All page components mount eagerly.

### 5. What does a developer write to build a doc site?

A developer builds three files:

**A navigation manifest** (static TypeScript):
```typescript
// docs-nav.ts
import { defineDocsNav } from '@brewsite/docs';

export const { docsNav, SectionId } = defineDocsNav([
  {
    title: 'Getting Started',
    sections: [
      { id: 'what-is-brewsite', label: 'What is BrewSite?' },
      { id: 'installation',     label: 'Installation' },
      { id: 'quick-start',      label: 'Quick Start' },
    ],
  },
  {
    title: 'Scene Authoring',
    sections: [
      { id: 'scene-dsl',    label: 'Scene DSL' },
      { id: 'multi-scene',  label: 'Multi-Scene Sequences' },
    ],
  },
] as const);

// SectionId is the derived union type:
// 'what-is-brewsite' | 'installation' | 'quick-start' | 'scene-dsl' | 'multi-scene'
export type { SectionId };
```

`defineDocsNav` is a factory function that accepts a `const` array literal and returns the typed nav structure plus the derived `SectionId` union. The `<Section>` component's `id` prop is typed as `SectionId`, not `string` — a mismatch is a TypeScript compile error.

**Page TSX files** with `<Section>` children:
```tsx
// pages/GettingStarted.tsx
import { Section, DocsDemo } from '@brewsite/docs';
import type { SectionId } from '../docs-nav';
import { MyDemo } from '../demos/MyDemo';

export function GettingStartedPage() {
  return (
    <>
      <Section<SectionId> id="what-is-brewsite" title="What is BrewSite?">
        <p>BrewSite is a TypeScript + React + Three.js framework...</p>
        <DocsDemo title="Three scenes, one ScenePlayer" scrollUnits={3200} height={480}>
          {/* height: number → px; height: string → CSS value (e.g. "100vh") */}
          <MyDemo />
        </DocsDemo>
      </Section>

      <Section<SectionId> id="installation" title="Installation">
        <p>Install via npm:</p>
        <CodeBlock code="npm install @brewsite/core three react react-dom" />
      </Section>
    </>
  );
}
```

**`DocsDemo` props (relevant subset):**
```typescript
export interface DemoDemoProps {
  /**
   * Scroll budget for the demo in scroll units (1 unit = 1px by convention).
   * Determines how much wheel delta it takes to advance from progress 0→1.
   */
  scrollUnits: number;
  /**
   * Height of the demo container in the page flow.
   * number → treated as pixels (e.g. height={480} → '480px')
   * string → passed as a CSS length (e.g. height="100vh", height="50vh")
   * Must be a stable CSS length. Dynamic calc() expressions that depend on
   * sibling layout are not safe — they may resolve differently for the
   * placeholder div vs. the mounted container.
   */
  height: number | string;
  title?: string;
  children: ReactNode;
}
```

**The root app**:
```tsx
// App.tsx
import { DocsApp } from '@brewsite/docs';
import { docsNav } from './docs-nav';
import { GettingStartedPage } from './pages/GettingStarted';
import { SceneAuthoringPage } from './pages/SceneAuthoring';

export default function App() {
  return (
    <DocsApp nav={docsNav}>
      <GettingStartedPage />
      <SceneAuthoringPage />
    </DocsApp>
  );
}
```

`DocsApp` renders the sidebar, the content scroll area, and coordinates section intersection tracking. It has no knowledge of BrewSite engine internals — those live entirely inside `<DocsDemo>` children.

### 6. How `Section` is declared inside a page

`<Section>` is a typed layout primitive. It renders a `<section>` element with:
- An `id` attribute matching the nav manifest entry (enables `#anchor` linking)
- A `data-section-id` attribute for `IntersectionObserver` targeting
- An `<h2>` heading rendered from the `title` prop (omitted if not provided)
- `children` rendered directly inside — no scroll, no engine, no special behavior

```typescript
export interface SectionProps<TId extends string = string> {
  id: TId;              // typed as SectionId from the manifest — mismatch is a TS error
  title?: string;       // rendered as h2 if provided
  children: ReactNode;
}

export function Section<TId extends string = string>(
  props: SectionProps<TId>
): ReactElement;
```

**Why static manifest over dynamic registration:** Dynamic registration (each `<Section>` pushing itself into a context on mount) requires waiting for mount to build the nav (sidebar renders blank initially), creates ordering problems when sections are conditional, and makes the nav structure invisible to static analysis and bots. The static manifest is knowable before any component mounts. The type-safety argument for dynamic registration is also weaker — it achieves presence-at-mount, not compile-time correctness.

### 7. How the sidebar knows about all sections

**Static manifest only.** The `docsNav` prop on `<DocsApp>` is the complete, authoritative list of sections. The sidebar renders from this manifest directly.

Active-section highlighting uses `IntersectionObserver`:
- `DocsApp` mounts one `IntersectionObserver` watching all `[data-section-id]` elements.
- Options: `{ threshold: 0, rootMargin: '-10% 0px -80% 0px' }` — approximates "this section is at the top of the viewport."
- Whichever section is currently intersecting becomes `activeId`.
- The sidebar maps `activeId` → highlighted nav item.

Click-to-jump: `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })`.

**Hash navigation on initial load:** `DocsApp` reads `window.location.hash` on mount and calls `document.getElementById(hash)?.scrollIntoView({ behavior: 'instant' })` after a `0ms` setTimeout. This works correctly because all `<Section>` elements and their placeholder `<DocsDemo>` divs are mounted eagerly — the full page layout height is stable before any scrolling occurs. **The correctness requirement is that `<DocsDemo>` placeholder divs render at exactly the same height as their mounted counterpart** (controlled by the explicit `height` prop). Without this, hash navigation to sections below a lazy-demounted demo lands at the wrong scroll position.

### 8. Cinematic 3D experience track alongside HTML docs?

**Decision: No separate cinematic experience track in v1. Full-viewport `<DocsDemo>` handles all immersive needs.**

The current `apps/docs` cinematic experience (full-screen hero, act-header transitions) is precisely what we're replacing. A hybrid scroll model — engine-driven scroll for hero + CSS scroll for content — would require:
- A non-standard `DocsApp` layout that switches scroll models mid-page
- Coordination between the CSS scroll position and the engine's `rawProgress`
- A seam where the user transitions from "engine controls scroll" to "browser controls scroll"

This complexity is unjustified when the same visual quality is achievable with the standard model:
- A full-screen hero is a `<DocsDemo>` with `height="100vh"` and a large `scrollUnits` budget, placed before the first `<Section>`.
- Act-header separators between content groups are `<DocsDemo>` instances with a short, cinematic single scene.

These are content decisions for `apps/docs` authors, not architectural decisions for `@brewsite/docs`. `DocsApp` has a single, simple layout: fixed sidebar + continuous scroll content area. No hybrid scroll model.

### 9. `DemoEngine` API shape

`DemoEngine` is the component that demo authors use inside their demo components. It is a drop-in replacement for `EngineProvider` that integrates with the parent `<DocsDemo>` scroll-capture context.

```typescript
// DemoEngine accepts all EngineProvider props except scrollHeightPx
// (which is derived from DocsDemo's scrollUnits) and id (assigned automatically).
export interface DemoEngineProps extends Omit<EngineProviderProps, 'scrollHeightPx' | 'id'> {
  // No additional props — all EngineProvider props (plugins, quality, manifestUrl, etc.)
  // are forwarded directly.
}

export function DemoEngine(props: DemoEngineProps): ReactElement;
```

**Wiring between `DocsDemo` and `DemoEngine`:**

`<DocsDemo>` provides a `DemoCaptureContext` to its children:

```typescript
interface DemoCaptureContextValue {
  /** Called by DemoEngine on each wheel delta event forwarded from DocsDemo. */
  onWheelDelta: (normalizedDelta: number) => void;
  /** Called by DemoEngine on mount to register setRawProgress. */
  registerEngine: (setRawProgress: (progress: number) => void) => void;
}
```

`DocsDemo` creates this context, intercepts wheel events (when hovered), and calls `onWheelDelta`. `DemoEngine` reads the context on mount, calls `registerEngine` with its `setRawProgress` function, and listens for `onWheelDelta` calls to update its internal progress.

This avoids imperative ref-forwarding. Neither component needs a direct reference to the other — they communicate through the context seam. A demo author never sees `DemoCaptureContext`; it is a private implementation detail of `@brewsite/docs`.

**Demo usage:**
```tsx
// demos/MyDemo.tsx
import { DemoEngine } from '@brewsite/docs';
import { corePlugin } from '@brewsite/core';

export function MyDemo() {
  return (
    <DemoEngine plugins={[corePlugin()]} quality="balanced">
      <SceneFoo />
      <SceneBar />
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </DemoEngine>
  );
}
```

### 10. Migration scope

**The migration of `apps/docs` is in-scope for this feature.** On completion:
- `apps/docs` uses `@brewsite/docs` exclusively
- All dead code listed in Technical Constraints is deleted
- No side-by-side period with the old architecture

Delivering `packages/docs` without migrating `apps/docs` produces an untested abstraction. `apps/docs` must be the first consumer that validates the API. An unconsumed package is not a complete feature.

---

## Technical Constraints

### Peer dependencies

`@brewsite/docs` peer dependencies:
- `react ^19`
- `react-dom ^19`
- `@brewsite/core workspace:*` — for `EngineProvider`, `EngineProviderProps`, `SceneCanvas`, `EngineOverlayHost`, `corePlugin`, `useSceneEngineContext`

`three` is only needed transitively through `@brewsite/core` — `@brewsite/docs` has no direct Three.js imports and must not list `three` as a peer.

No additional runtime dependencies. The layout, sidebar, and scroll logic are pure React + DOM APIs.

### Bundle size

For the immediate private consumer (`apps/docs`), bundle size is not a practical constraint. However, because the package is designed for eventual publication, the architect must apply standard tree-shaking hygiene from day one: named exports, `sideEffects: false` in `package.json`, no barrel imports that pull in Three.js transitively. A published `@brewsite/docs` consumed by a team that does not use demos should not pay a Three.js weight penalty.

### Build pipeline

`packages/docs` uses `tsc -p tsconfig.build.json` (same as diagram, model, charts). Pure TypeScript/JSX — no Vite asset bundling needed.

### SSR / Static generation

Explicitly out of scope. `apps/docs` is a Vite SPA. `IntersectionObserver`, `document.getElementById`, and `window.location` are browser-only APIs and are used directly without guards.

### Dead code in `apps/docs`

The following files are dead code to be deleted as part of this feature's migration:
- `apps/docs/src/components/layout/DocLayout.tsx` — React Router `<Outlet>` layout
- `apps/docs/src/components/layout/DocSidebar.tsx` — Route-based `<NavLink>` sidebar
- `apps/docs/src/nav/core-nav.ts` — Route-based nav manifest
- `apps/docs/src/routes.tsx` — Repurposed `flattenNav` utility; React Router is not used
- All files in `apps/docs/src/pages/core/` — Route-based page components
- `apps/docs/src/scenes/` — 3D scenes used as content; replaced by HTML `<Section>` content with embedded `<DocsDemo>` components
- `apps/docs/src/nav/docs-nav.ts` — Scene-based scroll manifest; replaced by the new static section manifest

---

## Open Questions

1. **Should `DocsDemo` require an explicit `scrollUnits` prop, or derive it from the scene declarations inside?** Explicit is simpler — no compiler invocation at render time. Lean toward explicit with a documented default (`scrollUnits={2400}`). Deriving it requires running the compiler before first paint — do not do this.

2. **Sidebar section groups: optional anchor?** `DocsNavSection.title` is a group label in the sidebar. Should it be linkable (clicking the group title scrolls to the first section in the group)? Low cost to add but needs a UX decision.

3. **Code block syntax highlighting.** Resolved by Decision 1: because `@brewsite/docs` is designed for external consumers from day one, `CodeBlock` and `Callout` are included in the package as first-class content primitives. External teams consuming `@brewsite/docs` should get the full content authoring set — layout primitives only is insufficient for a doc site framework. The existing `apps/docs` implementations migrate into `packages/docs/src/content/`.

4. **Mobile / touch.** Wheel-capture model does not map to touch. Explicitly out of scope for v1. On touch devices, demos render their initial state as a static 3D canvas; scroll passes through natively.

---

## Constraints Summary

| Constraint | Detail |
|---|---|
| Max simultaneous WebGL contexts | ~8–16 browser limit → `DemoEngine` must lazy-mount |
| Placeholder height must match mounted height | `height: number \| string`; both placeholder and container receive same value; no dynamic `calc()` depending on siblings |
| No SSR | Browser-only APIs used directly |
| No React Router | Single-page scroll navigation only |
| No dynamic section registration | Static manifest; `<Section>` is a dumb presentational component |
| Designed for eventual publication | No app-internal assumptions; external-consumer API standards from day 1 |
| `"private": true` until validated | One real release cycle through `apps/docs` before flipping |
| `three` is not a direct peer | Only accessed transitively via `@brewsite/core` |
| Tree-shaking hygiene required | Named exports, `sideEffects: false`, no Three.js in barrel imports |
| Mobile is out of scope v1 | Wheel-capture model; desktop-first |
| Migration is in-scope | `apps/docs` fully migrated, dead code deleted, no side-by-side period |
