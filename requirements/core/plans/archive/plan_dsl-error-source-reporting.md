---
title: "Design: DSL error source-reporting with file location and ancestry chain"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-05
---

# Plan: DSL Error Source Reporting

## Goal

When the compiler or runtime detects a DSL authoring error (missing key, unregistered component, invalid prop, etc.), the developer console message must include:

1. The source file and line number where the offending DSL element was written.
2. The DSL ancestry chain from `<Scene>` down to the offending element (e.g., `Scene[bfm-hero] > TextBox > div`).

This information makes it possible to locate and fix authoring errors in large scene files without reading stack traces from React internals.

---

## Available Source-Location Data

### React dev-mode `__source` and `__self`

When `@vitejs/plugin-react` (which uses Babel's JSX transform) runs with `NODE_ENV !== 'production'`, it attaches a `__source` object to every JSX element created with `React.createElement`. This object has the shape:

```ts
type JsxSource = {
  fileName: string;   // absolute path at build time
  lineNumber: number;
  columnNumber: number;
};
```

The `__source` property is placed directly on the props object of the React element. It is not visible in the TypeScript type for `ReactElement` (it is erased from the type system) but is present on the runtime value. It is only injected in development builds — the production JSX transform omits it.

In React 19, `__source` is consumed by the React DevTools and by React's own error reporting. It is not officially part of the public React API, but it is a stable and well-known convention used by the React ecosystem (Solid, Next.js, Remix all rely on it for dev-mode source attribution). It has been present since React 16.

**Availability in this codebase:** The `vite.config.ts` for `packages/core` uses `@vitejs/plugin-react` with default options, which enables `__source` injection in development builds. The apps (examples, docs) also use the same plugin via their own Vite configs. This means `__source` is available on every JSX element at dev time.

### `type.displayName` and `type.name`

Every registered DSL component sets `displayName` (e.g., `Scene.displayName = 'Scene'`, `TextBox.displayName = 'TextBox'`). This is used in `describeElementType` (line 374 of `sceneDslCompiler.ts`) for error messages. The same function can be used to build ancestry chains.

### `element.key`

The `key` prop is present on `ReactElement` as `element.key: string | null`. After `Children.toArray` processes a child list, keys are prefixed with `'.$'`. The key is useful as a disambiguator when the same component type appears multiple times.

### What is NOT available

- **Call-site file + line in production builds.** `__source` is stripped. The ancestry chain based on `displayName` still works in production, but file paths and line numbers do not.
- **Dynamic scene functions.** When `getFrame()` is a function called by the compiler (as in `sceneTrackCompiler.ts:334`), the JSX elements are created at the call site of `getFrame()`, not inside the compiler. `__source` still points to the scene file, which is correct.

---

## Where in the Compiler to Capture Source Info

### The right capture point: `expandNode` and the `compileChildren*` walkers

The compiler walks the DSL tree via `expandNode` and `collectChildren` / `compileChildrenSeparated`. These functions receive React elements and route them. They already have access to `element.type` for `displayName`. They are also the natural place to accumulate a breadcrumb chain, because they recurse depth-first.

The `NodeHandler` contract (`(node, api, helpers)`) passes the node at the current level. Each handler calls `helpers.compileChildren(node, api)` to descend. This call chain mirrors the tree structure exactly.

### Data structure: `DslBreadcrumb[]`

A breadcrumb is one entry in the ancestry chain. Each entry captures the component name and, in dev mode, the source location.

```ts
// packages/core/src/compiler/sceneTrackTypes.ts (add to existing file)

/**
 * One step in a DSL ancestry chain, captured during compilation for error reporting.
 * source is undefined in production builds (when Babel's __source injection is absent).
 */
export type DslBreadcrumb = {
  /** displayName or name of the component, or the HTML tag string. */
  componentName: string;
  /** Element key at this position, if any (post-Children.toArray prefix stripped). */
  key?: string;
  /** Source location injected by @vitejs/plugin-react in development builds. */
  source?: {
    fileName: string;
    lineNumber: number;
    columnNumber: number;
  };
};
```

### Where breadcrumbs accumulate: `CompileContext` (new internal type)

The breadcrumb chain needs to flow through the compilation walk without being part of the public `CompileApi` or `CompileHelpers` interfaces. It is an internal implementation detail of `sceneDslCompiler.ts`.

A private `CompileContext` type (internal to the module, never exported) carries the chain alongside the `api`:

```ts
// Internal to sceneDslCompiler.ts — not exported, not part of CompileApi/CompileHelpers

type CompileContext = {
  breadcrumbs: DslBreadcrumb[];
};
```

The `breadcrumbs` array is a **stack** (last element = current node). Each `compileChildren` / `expandNode` call pushes before descending and pops after. Since the compiler is synchronous and single-threaded, a mutable stack is safe.

### Threading breadcrumbs through the walk

The `CompileHelpers` interface is the seam that `NodeHandler` implementations call back into for child compilation. The breadcrumb stack can be maintained entirely inside the `helpers` closure — it does not need to be on the `CompileHelpers` type signature (which is public via `compiler/index.ts`). This preserves the existing public API.

The `helpers` object in `sceneDslCompiler.ts` is a module-level singleton (`const helpers: CompileHelpers = { ... }`). This is a problem for a mutable breadcrumb stack if compilation were ever concurrent, but since it is not (the compiler is synchronous and called once per `resolveSceneFromDsl` invocation), a stack stored in a `let` variable inside `resolveSceneFromDsl` and closed over by a locally-constructed `helpers` instance is the correct approach.

**This is the key architectural change:** replace the module-level `const helpers` singleton with a factory function `createHelpers(context: CompileContext): CompileHelpers`. Each call to `resolveSceneFromDsl` creates its own `helpers` instance with its own breadcrumb stack. The public `CompileHelpers` interface remains unchanged.

---

## Design

### New file: `packages/core/src/compiler/dslSourceInfo.ts`

Single responsibility: utilities for extracting and formatting source-location data from React elements in development mode.

```ts
// packages/core/src/compiler/dslSourceInfo.ts
// Utilities for extracting JSX source-location data from React elements (dev-mode only).

import type { ReactElement } from 'react';
import type { DslBreadcrumb } from './sceneTrackTypes';

/**
 * The shape Babel's JSX transform attaches to props.__source in development builds.
 * Not part of the public React type system — accessed via runtime type guard.
 */
type BabelJsxSource = {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
};

function isBabelJsxSource(value: unknown): value is BabelJsxSource {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>)['fileName'] === 'string' &&
    typeof (value as Record<string, unknown>)['lineNumber'] === 'number'
  );
}

/**
 * Extract the component name from a ReactElement's type, preferring displayName.
 */
export function getComponentName(element: ReactElement): string {
  const t = element.type;
  if (typeof t === 'string') return t;
  if (typeof t === 'function') {
    const fn = t as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name ?? 'Anonymous';
  }
  return 'Unknown';
}

/**
 * Extract the raw key, stripping the '.$' prefix that Children.toArray adds.
 */
export function getElementKey(element: ReactElement): string | undefined {
  const k = element.key;
  if (k === null) return undefined;
  return k.startsWith('.$') ? k.slice(2) : k;
}

/**
 * Build a DslBreadcrumb for a ReactElement.
 * source is only populated in development builds where __source is injected.
 */
export function buildBreadcrumb(element: ReactElement): DslBreadcrumb {
  const props = element.props as Record<string, unknown>;
  const rawSource = props['__source'];
  const source = isBabelJsxSource(rawSource) ? rawSource : undefined;
  return {
    componentName: getComponentName(element),
    key: getElementKey(element),
    source,
  };
}

/**
 * Format a breadcrumb chain as a human-readable ancestry string.
 * Example: "Scene[bfm-hero] (scene_hero.tsx:7) > TextBox[bfm-hero-content] (scene_hero.tsx:13)"
 */
export function formatBreadcrumbChain(breadcrumbs: readonly DslBreadcrumb[]): string {
  return breadcrumbs
    .map((b) => {
      const id = b.key ? `[${b.key}]` : '';
      const loc = b.source
        ? ` (${b.source.fileName}:${b.source.lineNumber})`
        : '';
      return `${b.componentName}${id}${loc}`;
    })
    .join(' > ');
}

/**
 * Format a single source location for inline use in a warning message.
 * Returns '' when source is absent (production builds).
 */
export function formatSourceLocation(breadcrumb: DslBreadcrumb): string {
  if (!breadcrumb.source) return '';
  return ` at ${breadcrumb.source.fileName}:${breadcrumb.source.lineNumber}`;
}
```

### Changes to `packages/core/src/compiler/sceneTrackTypes.ts`

Add `DslBreadcrumb` to the existing type file. It belongs here because it is consumed by `CompileWarning` (same file) and flows through the same pipeline.

Add `elementAncestry?: readonly DslBreadcrumb[]` to `CompileWarning`:

```ts
// In CompileWarning (existing type, extended):
export type CompileWarning = {
  code: CompileWarningCode;
  message: string;
  widgetId?: string;
  sceneIndex?: number;
  /**
   * DSL ancestry chain from the Scene root to the element that caused the warning.
   * Only populated in development builds (where React's __source is available).
   * Used by the player to emit enriched console.warn messages.
   */
  elementAncestry?: readonly DslBreadcrumb[];
};
```

Add a new warning code for key-prop issues:

```ts
export type CompileWarningCode =
  | 'MISSING_WIDGET'
  | 'DUPLICATE_WIDGET_ID'
  | 'UNRESOLVED_REFERENCE'
  | 'PROGRESS_MANAGER'
  | 'TRANSITION_TIMING'
  | 'MISSING_KEY';          // NEW
```

### Changes to `packages/core/src/compiler/sceneDslCompiler.ts`

#### 1. Replace the module-level `helpers` singleton with a factory

**Remove** `const helpers: CompileHelpers = { ... }` (currently lines 115–209).

**Add** `function createHelpers(): CompileHelpers` that closes over a `DslBreadcrumb[]` stack. The stack is mutated by `compileChildren` and `compileChildrenSeparated` as they descend.

The `createHelpers` function signature:

```ts
function createHelpers(): { helpers: CompileHelpers; getBreadcrumbs: () => readonly DslBreadcrumb[] } {
  const stack: DslBreadcrumb[] = [];
  // ... build helpers object with push/pop around recursive calls
  return { helpers, getBreadcrumbs: () => [...stack] };
}
```

The breadcrumb push/pop wraps every `compileChildren` descent:

```ts
// Inside the helpers.compileChildren implementation:
compileChildren: (node, api) => {
  const crumb = buildBreadcrumb(node);
  stack.push(crumb);
  // ... existing child walk logic ...
  stack.pop();
},
```

Each `NodeHandler` call that leads to further compilation also pushes/pops. The child-level push happens when `handler(childEl, api, helpers)` is called — so the handler itself sees the breadcrumbs for its parent, not itself. To include the current node, push before calling the handler and pop after.

#### 2. Pass the `helpers` instance and breadcrumb accessor to `resolveSceneFromDsl`

```ts
export const resolveSceneFromDsl = (
  tree: unknown,
  context: SceneSnapshotContext,
  _widgetRegistry: WidgetRegistry,
  pushWarning?: (warning: CompileWarning) => void,
): ResolvedScene => {
  ensureSceneRegistry();
  const { helpers, getBreadcrumbs } = createHelpers();
  // ... existing logic, using the local helpers instance ...
  // Pass getBreadcrumbs into createApi so pushWarning can attach ancestry:
  const api = createApi(context, pushWarning, getBreadcrumbs);
  // ...
};
```

#### 3. Attach ancestry to `CompileApi.pushWarning`

Extend `createApi` to accept `getBreadcrumbs: () => readonly DslBreadcrumb[]` and wrap the `pushWarning` call to attach `elementAncestry`:

```ts
const createApi = (
  context: SceneSnapshotContext,
  pushWarning?: (warning: CompileWarning) => void,
  getBreadcrumbs?: () => readonly DslBreadcrumb[],
): CompileApi => {
  // ...
  return {
    // ...
    pushWarning: (warning) => {
      const enriched: CompileWarning = getBreadcrumbs
        ? { ...warning, elementAncestry: getBreadcrumbs() }
        : warning;
      pushWarning?.(enriched);
    },
  };
};
```

#### 4. Detect missing keys in `compileChildrenSeparated` and emit a warning

After Fix 1 from `plan_textbox-key-prop-fix.md` is applied, `TextBox` elements will be preserved with their keys. But future overlay elements may still lack keys. Add a key-presence check inside `compileChildrenSeparated` for every node pushed to `overlayNodes`:

```ts
// When pushing an element to overlayNodes, check for a missing key:
if (process.env.NODE_ENV !== 'production' && element.key === null) {
  api.pushWarning({
    code: 'MISSING_KEY',
    message:
      `An overlay element <${getComponentName(element)}> has no key. ` +
      'Add a key prop to prevent React reconciliation warnings. ' +
      `Ancestry: ${formatBreadcrumbChain(getBreadcrumbs())}`,
    sceneIndex: api.context.sceneIndex,
  });
}
```

This is the proactive, compile-time version of the warning — it fires at compilation time, before React ever renders anything, with the full source chain available.

#### 5. Import `dslSourceInfo.ts` utilities

Add to the imports at the top of `sceneDslCompiler.ts`:

```ts
import { buildBreadcrumb, formatBreadcrumbChain, getComponentName } from './dslSourceInfo';
```

### Changes to `packages/core/src/compiler/sceneDslTypes.ts`

No changes required. `CompileHelpers` and `CompileApi` public interfaces are unchanged. The breadcrumb machinery is internal to `sceneDslCompiler.ts`.

### Changes to `packages/core/src/player/useSceneEngine.ts` (or wherever warnings are surfaced)

The player already collects `SceneTrack.warnings` and can log them. Extend the warning-display logic to include `elementAncestry` when present:

```ts
// When emitting a compile warning to the console:
if (warning.elementAncestry && warning.elementAncestry.length > 0) {
  console.warn(
    `[BrewSite] ${warning.message}\n  DSL ancestry: ${formatBreadcrumbChain(warning.elementAncestry)}`,
  );
} else {
  console.warn(`[BrewSite] ${warning.message}`);
}
```

`formatBreadcrumbChain` must be importable at the player layer. Export it from `dslSourceInfo.ts` and add a re-export path from `compiler/index.ts` under a `/internal` subpath, or import it directly from the source file (since the player imports infrastructure types directly from source files already, this is consistent with existing patterns).

### Dev-only vs. always-on

**Ancestry chain from `__source`:** Dev-only. `source` field on `DslBreadcrumb` is only populated when the Babel transform is active. The ancestry chain itself (component names and keys) is always collected, but source file paths and line numbers are dev-mode only.

**`MISSING_KEY` warning emission from `compileChildrenSeparated`:** Guarded by `process.env.NODE_ENV !== 'production'`. Vite's build process statically replaces this check, so the guard code is tree-shaken in production builds. The warning does not appear in production; the `CompileWarning` type and `DslBreadcrumb` type remain in the type system for forward compatibility.

**Breadcrumb stack allocation in `createHelpers`:** Always runs, but the stack is a lightweight array of small objects. The overhead is negligible — the DSL tree is compiled once at page load, not in a hot loop.

---

## Files Changed

| File | Change type | Description |
|---|---|---|
| `packages/core/src/compiler/dslSourceInfo.ts` | New | Source info utilities: `buildBreadcrumb`, `formatBreadcrumbChain`, `getComponentName`, `getElementKey`, `formatSourceLocation` |
| `packages/core/src/compiler/sceneTrackTypes.ts` | Extend | Add `DslBreadcrumb` type, `MISSING_KEY` warning code, `elementAncestry` field on `CompileWarning` |
| `packages/core/src/compiler/sceneDslCompiler.ts` | Refactor + extend | Replace module-level `helpers` singleton with `createHelpers()` factory; add breadcrumb push/pop around child walks; add `MISSING_KEY` detection in `compileChildrenSeparated`; extend `createApi` to accept `getBreadcrumbs` |
| `packages/core/src/compiler/sceneDslTypes.ts` | No change | Public interfaces unchanged |
| `packages/core/src/player/useSceneEngine.ts` | Extend | Enrich compile-warning console output with ancestry chain when present |

**Files NOT changed:**

- `compiler/index.ts` — `DslBreadcrumb` and `dslSourceInfo` utilities are internal compiler infrastructure. They are not part of the DSL authoring surface. Do not re-export from `compiler/index.ts`. Direct source imports are used by the player layer per existing convention.
- `compiler/registry.ts` — No change; breadcrumb logic is above the registry level.
- `EngineOverlayHost.tsx` — No change; the overlay host renders a `ReactNode`, not a list. The key-prop fix in `plan_textbox-key-prop-fix.md` removes the source of the runtime warning there.

---

## Test Strategy

### `packages/core/src/compiler/__tests__/dslSourceInfo.test.ts` (new file)

All tests are pure — no React renderer, no DOM. Tests import from `'../dslSourceInfo'` directly.

**Test 1 — `buildBreadcrumb` with `__source` present**

Construct a React element manually with `__source` injected into props:

```ts
const el = React.createElement(
  TextBox,
  { x: 0, y: 0, w: 1, h: 1, key: 'tb1', __source: { fileName: 'foo.tsx', lineNumber: 10, columnNumber: 4 } } as never,
);
const crumb = buildBreadcrumb(el);
expect(crumb.componentName).toBe('TextBox');
expect(crumb.key).toBe('tb1');
expect(crumb.source?.fileName).toBe('foo.tsx');
expect(crumb.source?.lineNumber).toBe(10);
```

**Test 2 — `buildBreadcrumb` without `__source`**

Construct without `__source`. Assert `crumb.source === undefined`.

**Test 3 — `formatBreadcrumbChain` formats correctly**

```ts
const chain: DslBreadcrumb[] = [
  { componentName: 'Scene', key: 'bfm-hero', source: { fileName: '/scenes/scene_hero.tsx', lineNumber: 7, columnNumber: 2 } },
  { componentName: 'TextBox', key: 'bfm-hero-content', source: { fileName: '/scenes/scene_hero.tsx', lineNumber: 13, columnNumber: 6 } },
];
expect(formatBreadcrumbChain(chain)).toBe(
  'Scene[bfm-hero] (/scenes/scene_hero.tsx:7) > TextBox[bfm-hero-content] (/scenes/scene_hero.tsx:13)'
);
```

**Test 4 — `formatBreadcrumbChain` without source (production simulation)**

Same as Test 3 but without `source` fields. Assert no file paths appear in output.

### `packages/core/src/compiler/__tests__/sceneDslCompiler.test.ts` (extend existing)

**Test 5 — `MISSING_KEY` warning is emitted for keyless overlay elements**

Construct a `<Scene id="test">` with a plain `<div>` child (no key). The `<div>` is a non-DSL child that enters `compileChildrenSeparated`. In development mode (`NODE_ENV=test`), a `MISSING_KEY` warning should appear in the collected warnings. Use `process.env.NODE_ENV = 'test'` (already set by Vitest).

```ts
const warnings: CompileWarning[] = [];
resolveSceneFromDsl(
  <Scene id="test"><div>hello</div></Scene>,
  { sceneIndex: 0, numScenes: 1, assetsReady: true },
  mockRegistry,
  (w) => warnings.push(w),
);
expect(warnings.some((w) => w.code === 'MISSING_KEY')).toBe(true);
```

**Test 6 — `MISSING_KEY` warning includes ancestry in `elementAncestry`**

Same setup as Test 5. Assert `warnings[0].elementAncestry` is defined and includes an entry with `componentName: 'Scene'`.

**Test 7 — `TextBox` with an id does NOT trigger `MISSING_KEY` warning**

After Fix 1 from `plan_textbox-key-prop-fix.md`, `<TextBox id="tb1" ...>` should preserve its key through `Children.toArray` as `'.$tb1'`. Assert no `MISSING_KEY` warning is emitted.

**Test 8 — `createHelpers` isolation: breadcrumbs from one compilation do not leak into another**

Call `resolveSceneFromDsl` twice in sequence. Assert that the warnings from the second call do not include ancestry from the first (the stack is reset per `createHelpers()` call).

### `packages/core/src/player/__tests__/useSceneEngine.test.ts` (extend)

**Test 9 — Player logs enriched warning when `elementAncestry` is present**

Use a mock `console.warn`. Compile a track with a `MISSING_KEY` warning that includes `elementAncestry`. Assert that `console.warn` is called with a message containing the ancestry chain string.

---

## Implementation Order

1. `sceneTrackTypes.ts` — add `DslBreadcrumb`, `MISSING_KEY` code, extend `CompileWarning`.
2. `dslSourceInfo.ts` — new utility file.
3. `sceneDslCompiler.ts` — replace `helpers` singleton with `createHelpers()` factory; wire breadcrumbs.
4. `useSceneEngine.ts` — enrich warning output.
5. Tests for each layer in the order above.

The breadcrumb plumbing (step 3) is the largest change but is entirely internal to `sceneDslCompiler.ts`. The public `CompileApi`, `CompileHelpers`, and `NodeHandler` types are not altered, so downstream consumers (widget `NodeHandler` implementations in core, diagram, model, charts) require no changes.
