---
title: "@brewsite/docs — Documentation Site Infrastructure Package"
doc_type: prd
status: current
owner: Toolkit Product
last_updated: 2026-03-05
change_history:
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "v0.1.0 initial PRD. Full API surface defined: defineDocsNav, DocsApp, Section, DocsDemo, DemoEngine, PropTable, CodeBlock, Callout, useActiveSection, useNavHighlight. DemoEngineProps explicitly excludes `id` and `scrollHeightPx` (both are internal hardcoded choices). Wheel normalization spec and boundary pass-through semantics documented. DemoCaptureContext privacy boundary established. Migration of apps/docs to @brewsite/docs-app is in scope. Package structure finalised as packages/docs with name @brewsite/docs."
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "Unified-scroll architecture implemented (commits e215c96, b04cce4, 0787b2a). Deleted: DocsScrollRegion (rogue nested scroll container), DemoEngine (per-demo EngineProvider wrapper), DemoCaptureContext (private wheel-to-engine bridge), WheelCaptureDemo (per-demo wheel interceptor). Created: DocsMainColumn (stateless column wrapper), docs-scenes.tsx (global scene DSL, 34 scenes, TOTAL_SCROLL_PX = 40800). Architecture change: single app-level EngineProvider + ScrollCaptureSection replaces per-demo engine model. All 14 demo components return null (no per-demo canvas). Single sticky global SceneCanvas is the only render surface. DocsDemo.scrollUnits deprecated and silently ignored — scroll budgets are declared in the scene DSL via ProgressManager. IntersectionObserver uses root: null (window viewport). PRD rewritten to reflect current implementation."
---

## 1. Overview

`@brewsite/docs` is a React component library for building BrewSite-powered documentation sites. It provides section layout primitives, nav infrastructure, and the unified-scroll integration that allows a single global Three.js scene to progress as the user scrolls the documentation page — with section content and live 3D animation advancing in lockstep.

The package lives at `packages/docs/` in the monorepo and is published privately, with the API surface designed for eventual public release as a companion to `@brewsite/core` and `@brewsite/diagram`. The docs application (`apps/docs/`) consumes this library.

**Affected packages:** `packages/docs` (`@brewsite/docs`), `apps/docs`.

---

## 2. Problem Statement

The original docs architecture placed documentation content inside a `DocsScrollRegion` component with `overflow-y: auto; height: 100vh`. This created a nested scroll container — the docs page scrolled independently of `window.scrollY`. Each embedded `DocsDemo` hosted its own `DemoEngine` (a private `EngineProvider` instance), driven by wheel event interception via `DemoCaptureContext`. The result:

- No single scrollable source of truth. Page scroll and demo scroll were entirely independent contexts.
- The intended behavior — one continuous scroll gesture that simultaneously reveals documentation content and advances scene transitions — was architecturally impossible.
- Per-demo engines duplicated Three.js contexts, increasing GPU and memory load proportionally with the number of visible demos.
- Wheel capture per demo created unpredictable scroll UX: users could become trapped inside a demo's scroll range.

The solution is a single unified window scroll that drives both the documentation content and a single global Three.js scene.

---

## 3. Goals & Success Metrics

**Goals:**
- One scroll gesture advances both documentation content and scene transitions
- Single Three.js render context for the entire docs page — no per-demo engine instances
- Scene scroll budgets declared in the scene DSL alongside scene content, not in component props
- Type-safe section IDs: mistyped section identifiers caught at compile time
- `IntersectionObserver` targeting the window viewport (`root: null`) — not a nested scroll container

**Success Metrics:**
- Primary: Window scroll drives both content reveal and scene progress across all 14 demo sections
- Primary: `pnpm typecheck` passes with zero errors
- Primary: `defineDocsNav()` generates a `SectionId` union that rejects invalid section strings at compile time
- Guardrail: Single `SceneCanvas` instance in the DOM — no per-demo canvas elements
- Guardrail: No `DocsScrollRegion`, `DemoEngine`, `DemoCaptureContext`, or `WheelCaptureDemo` references remain in the codebase

---

## 4. Non-Goals

- **Site content authoring**: `@brewsite/docs` provides layout infrastructure, not content. Section text, code examples, headings, and prose are consumer responsibility.
- **CodeBlock / Callout beyond re-export**: Included only as pass-through re-exports. The package does not define a new component library.
- **Server-side rendering**: All components are client-only. SSR support is not a launch criterion.
- **Multi-column or grid layouts beyond sidebar + content**: `DocsApp` renders a fixed two-column layout. Custom grid layouts remain in the consumer's application.
- **Per-demo engine instances**: Each `DocsDemo` section does not own a `EngineProvider`. The global scene DSL in `docs-scenes.tsx` defines all demo transitions. Individual demo components return `null` — they exist only as layout and scroll-budget markers.
- **Public npm publication at launch**: The package ships as a private workspace package.

---

## 5. Consumer Stories

- As a documentation page author, I want to declare my page's section structure in one place so that nav highlighting, scroll detection, and section IDs are all derived from a single source of truth.
- As a documentation page author, I want to drop a `<DocsDemo>` into my page and have it participate in the unified window scroll — without any per-demo engine setup, wheel interception, or canvas management.
- As a TypeScript developer, I want mistyped section IDs to be caught at compile time so that nav links and section refs can never fall out of sync.
- As a scene author, I want to declare each demo section's scroll budget in `docs-scenes.tsx` using `<ProgressManager>` so that the scene timeline and the documentation layout are co-authored in one place.
- As a site operator, I want a single Three.js render context for the entire docs page so that GPU memory does not scale with the number of visible demo sections.

---

## 6. Functional Requirements

1. The system shall export `defineDocsNav(groups)` — a factory function that accepts an `as const` array of nav group objects and returns a typed `DocsNavSpec` with a phantom `SectionId` union type derived from the input.
2. A `SectionId` value generated by `defineDocsNav` shall be assignable to a string union that rejects any string not present in the source array at compile time.
3. The system shall export `DocsApp` — a React component that renders a fixed sidebar (accepting `DocsNavSpec`) and a content area (accepting `children`).
4. The system shall export `DocsMainColumn` — a stateless column wrapper with no scroll context. It is a layout primitive with no `overflow` or `height` constraints of its own; the window is the scroll container.
5. The system shall export `Section<TId>` — a layout primitive that accepts `id: TId` (constrained to a `SectionId` union) and acts as an `IntersectionObserver` target for nav highlighting. `IntersectionObserver` instances created by `Section` shall use `root: null` (window viewport).
6. The system shall export `DocsDemo` — a React component that renders a fixed-height layout region for a documentation demo section. `DocsDemo` shall return `null` for any canvas or engine output; it is a layout marker only.
7. `DocsDemo` shall accept a `scrollUnits` prop for backward compatibility. The prop is silently ignored at runtime. Scroll budgets for demo sections are declared in the global `docs-scenes.tsx` scene DSL via `<ProgressManager>`.
8. The global scene DSL (`docs-scenes.tsx`) shall declare all demo scene transitions in a single `EngineProvider` scene tree. This file defines `TOTAL_SCROLL_PX`, the full scroll height of the docs page.
9. The single global `SceneCanvas` shall be rendered once in `DocsApp` as a sticky element. No `<canvas>` element is rendered inside any `DocsDemo` section.
10. `ScrollCaptureSection` from `@brewsite/core` shall be the sole scroll driver. It reads `window.scrollY` and pushes progress to the global `EngineProvider`.
11. The system shall export `PropTable` — a styled table component that accepts a flat array of `PropRow` objects and renders documented prop definitions.
12. The system shall export `useActiveSection<T>()` — a hook that returns the currently intersecting section ID or `null`. Requires a `<DocsApp>` ancestor.
13. The system shall export `useNavHighlight<T>()` — a convenience wrapper around `useActiveSection` that returns `{ isActive(id: T): boolean }` for use in custom nav renderers.

---

## 7. API Design

### 7.1 `defineDocsNav`

```typescript
// packages/docs/src/defineDocsNav.ts

type NavItem = {
  readonly id: string;
  readonly label: string;
};

type NavInputGroup = {
  readonly title: string;
  readonly items: ReadonlyArray<NavItem>;
};

type DocsNavSpec<T extends string> = {
  groups: ReadonlyArray<NavInputGroup>;
  _sectionId: T; // phantom — never set at runtime
};

declare function defineDocsNav<const T extends ReadonlyArray<NavInputGroup>>(
  groups: T,
): DocsNavSpec<T[number]['items'][number]['id']>;
```

**Usage:**
```typescript
const NAV = defineDocsNav([
  {
    title: 'Getting Started',
    items: [
      { id: 'installation', label: 'Installation' },
      { id: 'first-scene', label: 'First Scene' },
    ],
  },
  {
    title: 'Player API',
    items: [
      { id: 'engine-provider', label: 'EngineProvider' },
      { id: 'scene-canvas', label: 'SceneCanvas' },
    ],
  },
] as const);

type SectionId = typeof NAV._sectionId;
// => 'installation' | 'first-scene' | 'engine-provider' | 'scene-canvas'
```

### 7.2 `DocsApp`

```typescript
// packages/docs/src/DocsApp.tsx

type DocsAppProps<T extends string> = {
  nav: DocsNavSpec<T>;
  activeSectionId: T | null;
  children: ReactNode;
};

declare function DocsApp<T extends string>(props: DocsAppProps<T>): JSX.Element;
```

Renders a two-column layout: a fixed-width sidebar with nav highlighting based on `activeSectionId`, and a content area containing `children`. The sidebar contains the single sticky global `SceneCanvas`. The window is the scroll container — there is no `overflow-y: auto` or `height: 100vh` wrapper inside `DocsApp`.

### 7.3 `DocsMainColumn`

```typescript
// packages/docs/src/DocsMainColumn.tsx

type DocsMainColumnProps = {
  children: ReactNode;
  className?: string;
};

declare function DocsMainColumn(props: DocsMainColumnProps): JSX.Element;
```

A stateless column layout wrapper. Applies column width and padding. Has no scroll context, no `overflow`, no `height` constraint. The window is the scroll container.

### 7.4 `Section`

```typescript
// packages/docs/src/Section.tsx

type SectionProps<T extends string> = {
  id: T;
  children: ReactNode;
  className?: string;
};

declare function Section<T extends string>(props: SectionProps<T>): JSX.Element;
```

Registers an `IntersectionObserver` on mount with `root: null` (window viewport). When the section enters the viewport, it updates a shared context that `DocsApp` reads to determine `activeSectionId`.

### 7.5 `DocsDemo`

```typescript
// packages/docs/src/DocsDemo.tsx

type DocsDemoProps = {
  height: number | string;
  children: ReactNode;
  className?: string;
  /**
   * @deprecated Silently ignored. Scroll budgets for demo sections are declared
   * in the global docs-scenes.tsx scene DSL via <ProgressManager>. This prop
   * remains in the type signature for backward compatibility only.
   */
  scrollUnits?: number;
};

declare function DocsDemo(props: DocsDemoProps): JSX.Element;
```

Renders a fixed-height layout region. `DocsDemo` does not render a `<canvas>` or create an engine instance. Its children are documentation prose and UI elements — not scene DSL or engine components. The Three.js scene advances because the global `EngineProvider` (rendered once in `DocsApp`) reads `window.scrollY` via `ScrollCaptureSection`.

### 7.6 Global Scene DSL Pattern

All demo scene transitions are declared in a single file:

```typescript
// apps/docs/src/docs-scenes.tsx

export const TOTAL_SCROLL_PX = 40800;

export function DocsScenes() {
  return (
    <>
      <Scene id="intro" /* ... */>
        <ProgressManager scrollPx={2400} />
        {/* intro scene content */}
      </Scene>

      <Scene id="installation" /* ... */>
        <ProgressManager scrollPx={1800} />
        {/* installation demo scene */}
      </Scene>

      {/* ... 32 more scenes ... */}
    </>
  );
}
```

`TOTAL_SCROLL_PX` is the sum of all `<ProgressManager scrollPx>` values across all 34 scenes. The `DocsApp` renders `<ScrollCaptureSection scrollHeightPx={TOTAL_SCROLL_PX}>` to create the scroll spacer that drives the global engine.

### 7.7 `PropTable`

```typescript
// packages/docs/src/PropTable.tsx

type PropRow = {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  description: string;
};

type PropTableProps = {
  rows: PropRow[];
};

declare function PropTable(props: PropTableProps): JSX.Element;
```

Renders a styled table documenting component or function props. The row schema is intentionally flat — no nested prop groups — to keep usage simple and the output scannable.

### 7.8 Hooks

```typescript
// packages/docs/src/hooks/useActiveSection.ts

/**
 * Returns the ID of the section currently visible in the window viewport, or null
 * if no section is intersecting. Reads from the SectionContext populated by <Section>.
 * Must be rendered inside a <DocsApp> tree.
 */
declare function useActiveSection<T extends string>(): T | null;
```

```typescript
// packages/docs/src/hooks/useNavHighlight.ts

/**
 * Returns an object with a single method: `isActive(sectionId)`.
 * Convenience wrapper around useActiveSection for use in custom nav renderers.
 * Must be rendered inside a <DocsApp> tree.
 */
declare function useNavHighlight<T extends string>(): {
  isActive: (id: T) => boolean;
};
```

---

## 8. Technical Considerations

### 8.1 Package Structure

```
packages/docs/
  src/
    defineDocsNav.ts
    DocsApp.tsx
    DocsMainColumn.tsx
    Section.tsx
    DocsDemo.tsx
    PropTable.tsx
    CodeBlock.tsx               # re-export from upstream
    Callout.tsx                 # re-export from upstream
    hooks/
      useActiveSection.ts
      useNavHighlight.ts
    index.ts                    # public barrel
  __tests__/
    DocsDemo.test.tsx
    DocsApp.test.tsx
    PropTable.test.tsx
    defineDocsNav.test.ts
  package.json                  # name: "@brewsite/docs"
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts

apps/docs/
  src/
    docs-scenes.tsx             # global scene DSL (34 scenes)
    DocsPage.tsx                # renders DocsApp + global EngineProvider
    sections/                   # per-section content components (return null for canvas)
```

### 8.2 Unified Scroll Integration

The `DocsApp` renders a single `EngineProvider` wrapping the entire page. `ScrollCaptureSection` (from `@brewsite/core`) is the scroll driver — it creates the scroll spacer at `TOTAL_SCROLL_PX` height and reads `window.scrollY` to push raw progress into the engine. `SceneCanvas` is rendered once as a sticky element in the sidebar. No `DocsDemo` section renders its own canvas.

`IntersectionObserver` instances used for nav section highlighting use `root: null` (window viewport), not a scroll container element ref.

### 8.3 Scene Scroll Budgets

Each demo section's scroll budget is declared via `<ProgressManager scrollPx={N}>` inside the corresponding `<Scene>` in `docs-scenes.tsx`. The pacing curve, scroll allocation, and transition timing are co-authored with the scene content — not scattered across component props. `DocsDemo.scrollUnits` is deprecated and silently ignored.

### 8.4 Peer Dependencies

```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0",
    "@brewsite/core": "workspace:*"
  }
}
```

`@brewsite/diagram` and `@brewsite/model` are NOT peer dependencies.

### 8.5 Build

`packages/docs` builds with `tsc` only (same pattern as `@brewsite/diagram`). No Vite bundle step. `tsconfig.build.json` excludes `__tests__` directories.

### 8.6 Turborepo Integration

`packages/docs` is a workspace member. The `build:lib` task in `turbo.json` picks it up via the generic `packages/*` glob.

---

## 9. Breaking Change Assessment

**Semver impact: none on published packages.**

`@brewsite/docs` is a private package. No published package (`@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`) changes its public API.

**Removed from `@brewsite/docs` public exports (non-published, no semver obligation):**
- `DemoEngine` — deleted; replaced by the global `EngineProvider` + `docs-scenes.tsx` pattern
- `DemoCaptureContext` — deleted; was private (never exported)
- `WheelCaptureDemo` — deleted; wheel capture per demo is no longer the integration model
- `DocsScrollRegion` — deleted; replaced by `DocsMainColumn` (stateless, no scroll context)

**Added:**
- `DocsMainColumn` — new stateless column wrapper export

**Changed:**
- `DocsDemo.scrollUnits` prop — deprecated, silently ignored

---

## 10. Dependencies

- `@brewsite/core` — `EngineProvider`, `ScrollCaptureSection`, `SceneCanvas`, `EngineARContainer`, `EngineOverlayHost`, `EngineInputRegion`
- React 18+ — `IntersectionObserver`-based lifecycle, `useRef`, `useEffect`, `createContext`
- No new external library dependencies

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Scene DSL in `docs-scenes.tsx` grows large and hard to navigate | Split into per-section scene files imported by `docs-scenes.tsx`; use consistent naming conventions |
| `TOTAL_SCROLL_PX` falls out of sync with actual `ProgressManager` sum | Add a runtime assertion or build-time test that sums `scrollPx` values from compiled `SceneTrack` and compares to `TOTAL_SCROLL_PX` |
| `DocsDemo.scrollUnits` consumers silently lose scroll budget without error | The deprecation is silent by design — the old prop had no effect in the new architecture. Document in CHANGELOG. |
| `IntersectionObserver root: null` behavior differs from a scroll-container root | The window viewport is now the canonical scroll context; section detection is accurate by definition |

---

## 12. Open Questions

None. The unified-scroll architecture is fully implemented and verified across all 14 demo sections.

---

## 13. Launch Criteria

- [x] `DocsScrollRegion`, `DemoEngine`, `DemoCaptureContext`, `WheelCaptureDemo` deleted from codebase
- [x] `DocsMainColumn` implemented as stateless column wrapper
- [x] `docs-scenes.tsx` authored with 34 scenes and correct `TOTAL_SCROLL_PX`
- [x] All 14 demo components return `null` for canvas output
- [x] Single sticky `SceneCanvas` renders in `DocsApp` sidebar
- [x] `ScrollCaptureSection` is the sole scroll driver; reads `window.scrollY`
- [x] `IntersectionObserver` uses `root: null` across all `Section` components
- [x] `DocsDemo.scrollUnits` deprecated in type signature with JSDoc
- [x] `pnpm typecheck` passes with zero errors across all packages
- [x] `pnpm test` passes for `packages/docs`
- [ ] `PropTable`, `useActiveSection`, `useNavHighlight` have unit test coverage
- [ ] `defineDocsNav` TypeScript compile test asserts invalid section IDs are rejected at the type level
