---
title: "@brewsite/docs — Documentation Site Infrastructure Package"
doc_type: prd
status: current
owner: Toolkit Product
last_updated: 2026-03-17
change_history:
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "v0.1.0 initial PRD."
  - date: 2026-03-05
    author: "Toolkit Product"
    summary: "Unified-scroll architecture implemented. PRD rewritten to reflect current implementation."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Major rewrite. Reconciled entire PRD with actual codebase. Fixed defineDocsNav return type, type names, hook signatures, file structure, DocsDemo props, UI component exports. Removed non-existent useNavHighlight hook."
---

## 1. Overview

`@brewsite/docs` is a React component library for building BrewSite-powered documentation sites. It provides section layout primitives, type-safe nav infrastructure, content primitives (code blocks, callouts, prop tables), and optional unified-scroll integration that allows a single global Three.js scene to progress as the user scrolls the documentation page.

The package lives at `packages/docs/` in the monorepo and is published privately. The docs application (`apps/docs/`) consumes this library.

**Affected packages:** `packages/docs` (`@brewsite/docs`), `apps/docs`.

---

## 2. Problem Statement

The original docs architecture placed documentation content inside a `DocsScrollRegion` component with `overflow-y: auto; height: 100vh`. This created a nested scroll container — the docs page scrolled independently of `window.scrollY`. Each embedded `DocsDemo` hosted its own `DemoEngine` (a private `EngineProvider` instance), driven by wheel event interception. The result:

- No single scrollable source of truth. Page scroll and demo scroll were entirely independent contexts.
- Per-demo engines duplicated Three.js contexts, increasing GPU and memory load.
- Wheel capture per demo created unpredictable scroll UX.

The solution is a single unified window scroll that drives both the documentation content and (optionally) a single global Three.js scene.

---

## 3. Goals & Success Metrics

**Goals:**
- One scroll gesture advances both documentation content and scene transitions
- Single Three.js render context for the entire docs page — no per-demo engine instances
- Scene scroll budgets declared in the scene DSL alongside scene content, not in component props
- Type-safe section IDs: mistyped section identifiers caught at compile time
- `IntersectionObserver` targeting the window viewport (`root: null`) — not a nested scroll container

**Success Metrics:**
- Primary: Window scroll drives both content reveal and scene progress
- Primary: `pnpm typecheck` passes with zero errors
- Primary: `defineDocsNav()` generates a `SectionId` union that rejects invalid section strings at compile time
- Guardrail: Single `SceneCanvas` instance in the DOM — no per-demo canvas elements
- Guardrail: No `DocsScrollRegion`, `DemoEngine`, `DemoCaptureContext`, or `WheelCaptureDemo` references remain in the codebase

---

## 4. Non-Goals

- **Site content authoring**: `@brewsite/docs` provides layout infrastructure, not content.
- **Server-side rendering**: All components are client-only.
- **Multi-column or grid layouts beyond sidebar + content**: `DocsApp` renders a fixed two-column layout.
- **Per-demo engine instances**: The global `engineConfig` on `DocsApp` provides the single engine context.
- **Public npm publication at launch**: The package ships as a private workspace package.

---

## 5. Consumer Stories

- As a documentation page author, I want to declare my page's section structure in one place so that nav highlighting, scroll detection, and section IDs are all derived from a single source of truth.
- As a documentation page author, I want to drop a `<DocsDemo>` into my page and have it participate in the unified window scroll — without any per-demo engine setup, wheel interception, or canvas management.
- As a TypeScript developer, I want mistyped section IDs to be caught at compile time so that nav links and section refs can never fall out of sync.
- As a scene author, I want to declare each demo section's scroll budget in the scene DSL using `<ProgressManager>` so that the scene timeline and the documentation layout are co-authored in one place.

---

## 6. Functional Requirements

1. The system shall export `defineDocsNav(groups)` — a factory function that accepts an `as const` array of nav group objects and returns `{ docsNav: DocsNav<TId>; SectionId: TId }` where `TId` is the union of all section id strings.
2. A `SectionId` type derived from `defineDocsNav` shall be a string union that rejects any string not present in the source array at compile time.
3. The system shall export `DocsApp` — a React component that renders a CSS Grid layout with a sticky sidebar and a content column. When `engineConfig` is provided, it wraps content in a `SceneEngine` with a sticky `SceneCanvas` driven by window scroll via `ScrollStage`.
4. The system shall export `DocsMainColumn` — a stateless column wrapper with `forwardRef` support. No scroll context, no `overflow`, no `height` constraints.
5. The system shall export `Section<TId>` — a layout primitive that renders a `<section>` element with `id` and `data-section-id` attributes. Supports an optional `title` prop rendered as `<h2>`. Section is a presentational component — active-section tracking is driven entirely by DocsApp's IntersectionObserver.
6. The system shall export `DocsDemo` — a React component that renders a fixed-height layout region. Accepts a `title` prop for an optional heading above the container. Does not render a canvas or create an engine instance.
7. `DocsDemo` shall accept a `scrollUnits` prop for backward compatibility. The prop is silently ignored at runtime.
8. The system shall export `CodeBlock` — a syntax-highlighted code block component using prism-react-renderer with a copy-to-clipboard button.
9. The system shall export `Callout` — a tip / warning / note callout box component.
10. The system shall export `PropTable` — a tabular API reference component for documenting component props.
11. The system shall export `useActiveSectionId()` — a hook that returns the currently active section id as a `string` (empty string when no section is active or outside DocsApp context).
12. The system shall export `useDemoProgress(engineId)` — a hook that reads the current engine progress for a named demo. Returns `number | null`.

---

## 7. API Design

### 7.1 Nav Types

```typescript
// packages/docs/src/nav/types.ts

interface DocsNavSection {
  readonly id: string;
  readonly label: string;
}

interface DocsNavGroup {
  readonly title: string;
  readonly sections: readonly DocsNavSection[];
}

interface DocsNav<TId extends string = string> {
  readonly groups: readonly DocsNavGroup[];
  readonly allSectionIds: readonly TId[];
}
```

### 7.2 `defineDocsNav`

```typescript
// packages/docs/src/nav/defineDocsNav.ts

function defineDocsNav<const T extends ReadonlyArray<NavInputGroup>>(
  groups: T,
): {
  docsNav: DocsNav<ExtractSectionIds<T>>;
  /** Phantom type witness — do not access the value. Use typeof for type extraction. */
  SectionId: ExtractSectionIds<T>;
};
```

The input `NavInputGroup` type uses `sections` (not `items`):

```typescript
type NavInputGroup = {
  readonly title: string;
  readonly sections: ReadonlyArray<{ readonly id: string; readonly label: string }>;
};
```

**Usage:**
```typescript
const navDef = defineDocsNav([
  {
    title: 'Getting Started',
    sections: [
      { id: 'installation', label: 'Installation' },
      { id: 'first-scene', label: 'First Scene' },
    ],
  },
  {
    title: 'Player API',
    sections: [
      { id: 'engine-provider', label: 'EngineProvider' },
      { id: 'scene-canvas', label: 'SceneCanvas' },
    ],
  },
] as const);

export const docsNav = navDef.docsNav;
export type SectionId = typeof navDef.SectionId;
// => 'installation' | 'first-scene' | 'engine-provider' | 'scene-canvas'
```

### 7.3 `DocsApp`

```typescript
// packages/docs/src/layout/DocsApp.tsx

interface DocsAppProps {
  nav: DocsNav<string>;
  engineConfig?: {
    plugins: WidgetPlugin[];
    /** @deprecated Removed in v2. Pass manifestUrl to your model plugin instead. */
    manifestUrl?: string;
    scrollHeightPx: number;
    scenes: ReactNode;
    quality?: 'performance' | 'balanced' | 'high';
  };
  children: ReactNode;
}

function DocsApp({ nav, engineConfig, children }: DocsAppProps): ReactElement;
```

Layout: CSS Grid with `gridTemplateColumns: 'var(--sidebar-width, 260px) 1fr'`. The sidebar is a sticky `DocsSidebar`. The content column is either a plain `DocsMainColumn` or, when `engineConfig` is provided, a `SceneEngine` wrapping a `ScrollStage` with sticky `SceneCanvas` plus a `DocsMainColumn` for documentation content.

Active section tracking: a single `IntersectionObserver` with `root: null` (window viewport) and `rootMargin: '-10% 0px -80% 0px'` watches all `[data-section-id]` elements. The active section id is provided to descendants via `DocsAppContext`.

Hash navigation: reads `window.location.hash` on mount and calls `scrollIntoView`. Updates `window.location.hash` via `replaceState` on active section change.

### 7.4 `DocsMainColumn`

```typescript
// packages/docs/src/layout/DocsMainColumn.tsx

interface DocsMainColumnProps {
  children: ReactNode;
}

const DocsMainColumn = forwardRef<HTMLDivElement, DocsMainColumnProps>(
  ({ children }, ref): ReactElement => { /* ... */ }
);
```

A stateless column layout wrapper. Two-div structure: an outer grid cell div (`.docs-main-column`) with no overflow/height constraints, and an inner `.docs-content` div with `maxWidth: var(--content-max-width, 820px)` and `padding: 48px`. No `className` prop — styling is via CSS custom properties.

### 7.5 `Section`

```typescript
// packages/docs/src/section/Section.tsx

interface SectionProps<TId extends string = string> {
  id: TId;
  title?: string;
  children: ReactNode;
}

function Section<TId extends string = string>(props: SectionProps<TId>): ReactElement;
```

Renders a `<section>` element with `id` and `data-section-id` attributes. When `title` is provided, renders an `<h2>` heading. Section is a dumb presentational component — it does not register any observer. Active-section tracking is driven entirely by DocsApp's IntersectionObserver watching `[data-section-id]` elements.

Note: `SectionProps` does not include a `className` prop.

### 7.6 `DocsDemo`

```typescript
// packages/docs/src/demo/DocsDemo.tsx

interface DocsDemoProps {
  height: number | string;
  title?: string;
  children: ReactNode;
  /** @deprecated Silently ignored. Scroll budgets declared in scene DSL. */
  scrollUnits?: number;
}

function DocsDemo({ height, title, children }: DocsDemoProps): ReactElement;
```

Renders a fixed-height container (`.docs-demo`) with border, border-radius, and background styling. When `title` is provided, renders a `<p>` element above the container. The `height` prop accepts a number (treated as pixels) or a CSS length string. The component does not render a canvas, create an engine, or capture wheel events.

### 7.7 Content Primitives

#### CodeBlock

```typescript
// packages/docs/src/ui/CodeBlock.tsx

type CodeLanguage = 'tsx' | 'typescript' | 'bash' | 'json' | 'css';

interface CodeBlockProps {
  code: string;
  language?: CodeLanguage; // defaults to 'typescript'
}

function CodeBlock({ code, language }: CodeBlockProps): ReactElement;
```

Syntax-highlighted code block using `prism-react-renderer` with nightOwl theme. Includes a `CopyButton` for clipboard copy. CSS classes: `.code-block`, `.code-block__toolbar`, `.code-block__lang`.

#### Callout

```typescript
// packages/docs/src/ui/Callout.tsx

type CalloutType = 'note' | 'warning' | 'tip';

interface CalloutProps {
  type: CalloutType;
  children: ReactNode;
}

function Callout({ type, children }: CalloutProps): ReactElement;
```

Callout box rendered as an `<aside>`. CSS classes: `.callout`, `.callout--note` / `.callout--warning` / `.callout--tip`, `.callout__label`, `.callout__body`.

#### PropTable

```typescript
// packages/docs/src/ui/PropTable.tsx

interface PropRow {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string; // NOTE: field is defaultValue, not default
  description: string;
}

interface PropTableProps {
  rows: PropRow[];
}

function PropTable({ rows }: PropTableProps): ReactElement;
```

Tabular API reference. CSS class: `.prop-table`. Required props are marked with a `*` indicator.

### 7.8 Hooks

#### `useActiveSectionId`

```typescript
// packages/docs/src/hooks/useActiveSectionId.ts

function useActiveSectionId(): string;
```

Returns the id of the currently active section from `DocsAppContext`. Returns an empty string (`''`) if no section is active or if called outside a `DocsApp` tree. This is **not** a generic hook — it returns `string`, not `T | null`.

#### `useDemoProgress`

```typescript
// packages/docs/src/hooks/useDemoProgress.ts

function useDemoProgress(engineId: string): number | null;
```

Reads the current engine progress for a named demo via `useEngineState` from `@brewsite/core`. Returns `null` if the engine is not mounted or the id is not registered.

### 7.9 Internal Components (Not Exported)

#### `DocsSidebar`

```typescript
// packages/docs/src/layout/DocsSidebar.tsx (internal)

interface DocsSidebarProps {
  nav: DocsNav<string>;
  activeId: string;
  onSectionClick: (id: string) => void;
}
```

Sticky sidebar rendered from the nav manifest. Highlights the active section with `aria-current="page"` and a left border accent. Click-to-jump calls `onSectionClick` which triggers `scrollIntoView({ behavior: 'smooth' })`.

#### `CopyButton`

```typescript
// packages/docs/src/ui/CopyButton.tsx (internal)
```

Copy-to-clipboard button with transient "Copied" feedback state. Used internally by `CodeBlock`.

#### `normalizeDelta`

```typescript
// packages/docs/src/demo/normalizeDelta.ts (internal)
```

Pure wheel delta normalization function for cross-browser consistency. Handles `DOM_DELTA_PIXEL`, `DOM_DELTA_LINE`, and `DOM_DELTA_PAGE` modes.

---

## 8. Technical Considerations

### 8.1 Package Structure

```
packages/docs/
  src/
    index.ts                        # public barrel
    nav/
      defineDocsNav.ts              # factory function
      types.ts                      # DocsNav, DocsNavGroup, DocsNavSection
      __tests__/
        defineDocsNav.test.ts
    layout/
      DocsApp.tsx                   # root layout + IntersectionObserver + optional engine
      DocsMainColumn.tsx            # stateless content column
      DocsSidebar.tsx               # sticky sidebar (internal)
      __tests__/
        DocsApp.test.tsx
        DocsMainColumn.test.tsx
    section/
      Section.tsx                   # section anchor primitive
      __tests__/
        Section.test.tsx
    demo/
      DocsDemo.tsx                  # inline demo container
      normalizeDelta.ts             # wheel delta normalization (internal)
      __tests__/
        DocsDemo.test.tsx
        normalizeDelta.test.ts
    ui/
      CodeBlock.tsx                 # syntax-highlighted code block
      Callout.tsx                   # note/warning/tip callout
      PropTable.tsx                 # API reference table
      CopyButton.tsx                # clipboard copy button (internal)
    hooks/
      useActiveSectionId.ts         # active section context reader
      useDemoProgress.ts            # engine progress reader
  package.json                      # name: "@brewsite/docs"
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
```

### 8.2 Public Export Surface

The barrel at `src/index.ts` exports exactly:

| Export | Kind | Source |
|--------|------|--------|
| `defineDocsNav` | function | `nav/defineDocsNav.ts` |
| `DocsNav` | type | `nav/types.ts` |
| `DocsNavGroup` | type | `nav/types.ts` |
| `DocsNavSection` | type | `nav/types.ts` |
| `DocsApp` | component | `layout/DocsApp.tsx` |
| `DocsAppProps` | type | `layout/DocsApp.tsx` |
| `DocsMainColumn` | component | `layout/DocsMainColumn.tsx` |
| `DocsMainColumnProps` | type | `layout/DocsMainColumn.tsx` |
| `Section` | component | `section/Section.tsx` |
| `SectionProps` | type | `section/Section.tsx` |
| `DocsDemo` | component | `demo/DocsDemo.tsx` |
| `DocsDemoProps` | type | `demo/DocsDemo.tsx` |
| `CodeBlock` | component | `ui/CodeBlock.tsx` |
| `CodeBlockProps` | type | `ui/CodeBlock.tsx` |
| `CodeLanguage` | type | `ui/CodeBlock.tsx` |
| `Callout` | component | `ui/Callout.tsx` |
| `CalloutProps` | type | `ui/Callout.tsx` |
| `CalloutType` | type | `ui/Callout.tsx` |
| `PropTable` | component | `ui/PropTable.tsx` |
| `PropTableProps` | type | `ui/PropTable.tsx` |
| `PropRow` | type | `ui/PropTable.tsx` |
| `useActiveSectionId` | hook | `hooks/useActiveSectionId.ts` |
| `useDemoProgress` | hook | `hooks/useDemoProgress.ts` |

### 8.3 Unified Scroll Integration

When `DocsApp` receives an `engineConfig` prop, it wraps the content column in a `SceneEngine` (from `@brewsite/core`) with the following structure:

1. `SceneEngine` with `plugins` and optional `timingProfile` from `quality` preset
2. `engineConfig.scenes` rendered as scene DSL children (no DOM output)
3. `ScrollStage` with `scrollHeightPx` and `stageHeight="100vh"` containing:
   - Sticky `SceneCanvas` at `position: absolute; inset: 0; zIndex: 1`
   - `InputCoordinator`
   - `EngineOverlayHost`
4. `DocsMainColumn` with documentation children below the scroll stage

When `engineConfig` is omitted, `DocsApp` renders a pure documentation layout with no 3D canvas.

### 8.4 Dependencies

**Runtime dependency:**
- `prism-react-renderer` ^2.4.1 — syntax highlighting for `CodeBlock`

**Peer dependencies:**
- `react` ^19
- `react-dom` ^19
- `@brewsite/core` workspace:*

`@brewsite/diagram` and `@brewsite/model` are NOT peer dependencies.

### 8.5 Build

`packages/docs` builds with `tsc` only (same pattern as `@brewsite/diagram`). No Vite bundle step. `tsconfig.build.json` excludes `__tests__` directories.

### 8.6 Turborepo Integration

`packages/docs` is a workspace member. The `build:lib` task in `turbo.json` picks it up via the generic `packages/*` glob.

---

## 9. Breaking Change Assessment

**Semver impact: none on published packages.**

`@brewsite/docs` is a private package. No published package changes its public API.

**Removed from `@brewsite/docs` public exports (non-published, no semver obligation):**
- `DemoEngine` — deleted; replaced by `engineConfig` on `DocsApp`
- `DemoCaptureContext` — deleted; was private (never exported)
- `WheelCaptureDemo` — deleted; wheel capture per demo is no longer the integration model
- `DocsScrollRegion` — deleted; replaced by `DocsMainColumn`

**Changed:**
- `DocsDemo.scrollUnits` prop — deprecated, silently ignored

---

## 10. Dependencies

- `@brewsite/core` — `SceneEngine`, `ScrollStage`, `SceneCanvas`, `InputCoordinator`, `EngineOverlayHost`, `useEngineState`, `WidgetPlugin`
- `prism-react-renderer` — syntax highlighting for `CodeBlock`
- React 19+ — `IntersectionObserver`-based lifecycle, `useRef`, `useEffect`, `createContext`, `forwardRef`

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Scene DSL grows large and hard to navigate | Split into per-section scene files imported by the scene root |
| `scrollHeightPx` falls out of sync with actual `ProgressManager` sum | Add a runtime assertion or build-time test that validates the total |
| `DocsDemo.scrollUnits` consumers silently lose scroll budget | The deprecation is silent by design; document in CHANGELOG |
| `IntersectionObserver root: null` behavior differs from a scroll-container root | The window viewport is now the canonical scroll context; section detection is accurate by definition |

---

## 12. Open Questions

None. The unified-scroll architecture is fully implemented.

---

## 13. Launch Criteria

- [x] `DocsScrollRegion`, `DemoEngine`, `DemoCaptureContext`, `WheelCaptureDemo` deleted from codebase
- [x] `DocsMainColumn` implemented as stateless column wrapper with `forwardRef`
- [x] `DocsApp` supports optional `engineConfig` for 3D-enabled docs
- [x] Single sticky `SceneCanvas` when engine is configured
- [x] `ScrollStage` is the sole scroll driver; reads `window.scrollY`
- [x] `IntersectionObserver` uses `root: null` across all section tracking
- [x] `DocsDemo.scrollUnits` deprecated in type signature with JSDoc
- [x] `CodeBlock`, `Callout`, `PropTable` implemented as first-class exports
- [x] `useActiveSectionId` and `useDemoProgress` hooks exported
- [x] `pnpm typecheck` passes with zero errors across all packages
- [x] `pnpm test` passes for `packages/docs`
- [x] `defineDocsNav` returns `{ docsNav, SectionId }` with correct phantom type
