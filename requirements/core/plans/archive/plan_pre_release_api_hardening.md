---
title: "Pre-Release API Hardening: ScenePlayer Removal & Core API Cleanup"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-03
---

# Pre-Release API Hardening

## 1. Scope

This plan covers every API cleanup item that must be resolved before `@brewsite/core` is published
publicly. It is organised into six independent phases in dependency order. Each phase can be
implemented and committed separately, but all six must complete before any public release.

**This plan is complete and prescriptive.** The implementing engineer should follow it without
additional design work. File paths, TypeScript signatures, and logic are specified exactly.

---

## 2. Breaking Changes Summary

| Change | Removed symbol | Replacement |
|---|---|---|
| `ScenePlayer` component deleted | `ScenePlayer`, `ScenePlayerProps` | `EngineProvider` + `EngineInputRegion` + `SceneCanvas` + `EngineOverlayHost` + new `EngineGate` |
| `EngineScrollRegion` deleted | `EngineScrollRegion`, `EngineScrollRegionProps` | `EngineInputRegion` |
| `createDefaultWidgetRegistry()` deleted | `createDefaultWidgetRegistry`, `DefaultWidgetRegistryOptions` | `corePlugin()` + `modelPlugin()` |
| `nextSceneTrackCacheToken()` deleted | `nextSceneTrackCacheToken` | Use `invalidateCacheToken` prop directly with own counter |
| `compiler/primitives/` barrel files deleted | `@brewsite/core/compiler/primitives/*` import paths | Import directly from `@brewsite/core` (elements are already top-level exports) |
| `IAnimationController.onTick` renamed | — | No rename; see Phase 5 for documentation improvement |
| `WidgetRenderContext.extra` typed | `extra: unknown` → `extra: TExtra` | Widgets add `TExtra` generic parameter |

---

## 3. Phase 1 — Delete ScenePlayer; Add `EngineGate`

### 3.1 Why ScenePlayer is the wrong abstraction

`ScenePlayer` violates single responsibility across three unrelated concerns in one flat prop
surface:

1. **Engine configuration** — manifest, plugins, timing, quality, error callbacks. These are
   `EngineProvider` concerns.
2. **Layout decisions** — sticky scroll height, pixelsPerScene, scrollHeightMode. These vary
   per page and should be consumer-controlled.
3. **Optional dev tooling** — `timeline` boolean, `debug` boolean. These are render decorations
   that should be composed, not toggled by flag.

It also creates a false "easy path" that forces migration when consumers need any non-trivial
layout. The website app already uses `EngineProvider` directly; `ScenePlayer` is not the real
production pattern.

### 3.2 New component: `EngineGate`

`ScenePlayer` currently owns the "render placeholder until first tick" logic. This must move to a
new standalone component.

**File to create:** `packages/core/src/player/EngineGate.tsx`

```tsx
// EngineGate — renders placeholder until the engine has ticked at least once.
// Use inside EngineProvider to gate rendering on initial engine readiness.

import type { ReactElement, ReactNode } from 'react';
import { useEngineState } from './EngineStateContext';

export type EngineGateProps = {
  /** Content shown before the engine's first tick. Defaults to null. */
  placeholder?: ReactNode;
  children: ReactNode;
};

/**
 * Conditionally renders children once the engine has produced its first frame.
 * Before the first tick, renders `placeholder` (or nothing if omitted).
 *
 * Must be placed inside an `<EngineProvider>` tree.
 *
 * @example
 * <EngineProvider manifestUrl="/manifest.json" plugins={[corePlugin()]}>
 *   <Scene id="intro">...</Scene>
 *   <EngineGate placeholder={<Spinner />}>
 *     <EngineInputRegion>
 *       <SceneCanvas />
 *       <EngineOverlayHost />
 *     </EngineInputRegion>
 *   </EngineGate>
 * </EngineProvider>
 * // EngineInputRegion reads from EngineContext — no engine prop needed (see §9.2)
 */
export const EngineGate = ({ placeholder = null, children }: EngineGateProps): ReactElement => {
  const state = useEngineState();
  if (state.tickIndex < 0) return <>{placeholder}</>;
  return <>{children}</>;
};
```

### 3.3 Verify `controlledProgress` props on `EngineProvider` *(already implemented — verify only)*

> **NOTE:** These props were shipped before this plan was authored. `EngineProvider.tsx` already
> has `controlledProgress` (line 94), `onControlledProgressChange` (line 95),
> `enableKeyboardInControlledMode` (line 96), and `controlledInputMap` (line 97). They are already
> wired to `useSceneEngine`. **No code change required.** Simply verify they are present and
> exported as part of `EngineProviderProps`.

**Verification command:**
```bash
grep -n "controlledProgress\|onControlledProgressChange\|enableKeyboardInControlledMode" \
  packages/core/src/player/EngineProvider.tsx
```
Expected: at least 3 matches in `EngineProviderProps`.

### 3.4 Delete `ScenePlayer.tsx`

**File to delete:** `packages/core/src/player/ScenePlayer.tsx`

No replacement file. The canonical usage pattern is `EngineProvider` + layout primitives. See
the migration guide in Section 9.

### 3.5 Update `player/index.ts`

**File to modify:** `packages/core/src/player/index.ts`

Remove these exports:
```typescript
// DELETE these two lines:
export { ScenePlayer } from './ScenePlayer';
export type { ScenePlayerProps } from './ScenePlayer';
```

Add these exports:
```typescript
export { EngineGate } from './EngineGate';
export type { EngineGateProps } from './EngineGate';
```

### 3.6 Update `EngineProviderProps` type export

The `controlledProgress` props are already in `EngineProviderProps` (see §3.3). Removing
`ScenePlayer` makes them the sole home. Verify the types are exported from `player/index.ts` as
part of the `EngineProviderProps` type.

### 3.7 Fix `tickIndex` — two required code changes

`EngineGate` checks `state.tickIndex < 0`. `useEngineState()` returns `EngineState`. But
`EngineState` (in `engineTypes.ts`) does **not** currently include `tickIndex` — that field only
exists on `EngineFrameState`. Without these two changes, `EngineGate.tsx` will fail to compile.

**Step 1 — File to modify:** `packages/core/src/player/engineTypes.ts`

```typescript
// BEFORE:
export type EngineState = {
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
};

// AFTER:
export type EngineState = {
  /** Index of the last rendered tick. -1 before the engine's first frame. */
  tickIndex: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
};
```

**Step 2 — File to modify:** `packages/core/src/player/EngineProvider.tsx`

Find the `engineState` useMemo (currently lines 264–269). Add `tickIndex`:

```typescript
// BEFORE:
const engineState = useMemo(() => ({
  progress: engine.progress,
  sceneId: engine.frameState.sceneId,
  sceneIndex: engine.frameState.sceneIndex,
  sceneProgress: engine.frameState.sceneProgress,
}), [engine.progress, engine.frameState]);

// AFTER:
const engineState = useMemo(() => ({
  tickIndex: engine.frameState.tickIndex,
  progress: engine.progress,
  sceneId: engine.frameState.sceneId,
  sceneIndex: engine.frameState.sceneIndex,
  sceneProgress: engine.frameState.sceneProgress,
}), [engine.progress, engine.frameState]);
```

**Step 3 — File to modify:** `packages/core/src/player/EngineStateContext.ts`

Update the error message in `useEngineState()` so it no longer references the deleted component:

```typescript
// BEFORE:
throw new Error('[useEngineState] must be used inside <ScenePlayer>');
// AFTER:
throw new Error('[useEngineState] must be used inside <EngineProvider>');
```

### 3.8 Test for `EngineGate`

**File to create:** `packages/core/src/player/__tests__/EngineGate.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EngineGate } from '../EngineGate';
import { EngineStateContext } from '../EngineStateContext';
import type { EngineState } from '../engineTypes';

// EngineState includes tickIndex after the fix in §3.7. No tick field — that is EngineFrameState.
const makeState = (tickIndex: number): EngineState => ({
  tickIndex,
  progress: 0,
  sceneId: 'scene-0',
  sceneIndex: 0,
  sceneProgress: 0,
});

describe('EngineGate', () => {
  it('renders placeholder when tickIndex < 0', () => {
    render(
      <EngineStateContext.Provider value={makeState(-1)}>
        <EngineGate placeholder={<div>loading</div>}>
          <div>content</div>
        </EngineGate>
      </EngineStateContext.Provider>,
    );
    expect(screen.queryByText('loading')).not.toBeNull();
    expect(screen.queryByText('content')).toBeNull();
  });

  it('renders children when tickIndex >= 0', () => {
    render(
      <EngineStateContext.Provider value={makeState(0)}>
        <EngineGate placeholder={<div>loading</div>}>
          <div>content</div>
        </EngineGate>
      </EngineStateContext.Provider>,
    );
    expect(screen.queryByText('content')).not.toBeNull();
    expect(screen.queryByText('loading')).toBeNull();
  });
});
```

Note: `EngineState` is updated to include `tickIndex` in §3.7 above. The test will not compile
until that change is made first.

---

## 4. Phase 2 — Dead Code Removal

### 4.1 Fix `IDENTITY_FN` boundary violation before deleting primitives/

**Problem:** Three compiler files import `IDENTITY_FN` from `player/SceneProgressMapper.ts`.
This is a layer violation: compiler importing from player. All three must be updated.

Confirmed violators (verified by grep):
- `compiler/primitives/progressManager.ts` — imports `IDENTITY_FN` from `../../player/SceneProgressMapper`
- `compiler/sceneTrackCompiler.ts` (line 19) — imports `IDENTITY_FN` from `../player/SceneProgressMapper`
- `compiler/__tests__/buildProgressProfile.test.ts` (line 3) — imports `IDENTITY_FN` from `../../player/SceneProgressMapper`

**Fix — Step 1:** Move `IDENTITY_FN` to a neutral location.

**File to create:** `packages/core/src/compiler/identityFn.ts`

```typescript
// Canonical identity function for the progress mapper system.
// Exported as a named const so reference-equality checks in buildProgressProfile
// correctly identify a scene as uniform when no fn is declared.
export const IDENTITY_FN = (t: number): number => t;
```

**Fix — Step 2:** Update `compiler/primitives/progressManager.ts`

```typescript
// Change the import:
// BEFORE:
import { IDENTITY_FN } from '../../player/SceneProgressMapper';
// AFTER:
import { IDENTITY_FN } from '../identityFn';
```

**Fix — Step 3:** Update `player/SceneProgressMapper.ts`

```typescript
// Change the import and static property:
// BEFORE (at module top):
export const IDENTITY_FN = (t: number): number => t;
// AFTER (at module top):
export { IDENTITY_FN } from '../compiler/identityFn';

// The static property on the class stays the same reference:
static readonly IDENTITY_FN = IDENTITY_FN;
```

**Fix — Step 4:** Update the two remaining production files (beyond progressManager.ts):

**File to modify:** `packages/core/src/compiler/sceneTrackCompiler.ts`
```typescript
// BEFORE (line 19):
import { IDENTITY_FN } from '../player/SceneProgressMapper';
// AFTER:
import { IDENTITY_FN } from './identityFn';
```

**File to modify:** `packages/core/src/compiler/__tests__/buildProgressProfile.test.ts`
```typescript
// BEFORE (line 3):
import { IDENTITY_FN } from '../../player/SceneProgressMapper';
// AFTER:
import { IDENTITY_FN } from '../../compiler/identityFn';
```

Verify no remaining violations:
```bash
grep -rn "IDENTITY_FN.*SceneProgressMapper\|SceneProgressMapper.*IDENTITY_FN" packages/core/src/compiler
```
Expected: zero results (only `SceneProgressMapper.ts` itself re-exports it, which is correct).

### 4.2 Delete dead `compiler/primitives/` barrel files

**Files to delete:**
- `packages/core/src/compiler/primitives/Background.tsx`
- `packages/core/src/compiler/primitives/Camera.tsx`
- `packages/core/src/compiler/primitives/Environment.tsx`
- `packages/core/src/compiler/primitives/Floor.tsx`
- `packages/core/src/compiler/primitives/Lighting.tsx`
- `packages/core/src/compiler/primitives/index.ts`

**Keep:** `packages/core/src/compiler/primitives/progressManager.ts` (active).

Verify zero remaining imports from `compiler/primitives/` (except progressManager) with:
```bash
grep -rn "from.*compiler/primitives" packages/ apps/ --include="*.ts" --include="*.tsx"
```
Expected: zero results (or only references to `progressManager`).

### 4.3 Delete `player/defaultWidgets.ts`

**File to delete:** `packages/core/src/player/defaultWidgets.ts`

**File to delete (test):** `packages/core/src/player/__tests__/defaultWidgets.test.ts`

Remove from `packages/core/src/player/index.ts`:
```typescript
// DELETE:
export { createDefaultWidgetRegistry } from './defaultWidgets';
export type { DefaultWidgetRegistryOptions } from './defaultWidgets';
```

Verify `EngineProvider.tsx` no longer references `createDefaultWidgetRegistry`. The fallback code
path in EngineProvider that called `createDefaultWidgetRegistry` when neither `plugins` nor
`widgetSetup` were provided should be replaced with: throw a clear error or use an empty
registry with a warning. The `widgetSetup` prop itself must also be removed from
`EngineProviderProps` (see Phase 6).

### 4.4 Delete `player/EngineScrollRegion.tsx`

**File to delete:** `packages/core/src/player/EngineScrollRegion.tsx`

**File to delete (test):** `packages/core/src/player/__tests__/EngineScrollRegion.test.tsx`
(if it exists)

Remove from `packages/core/src/player/index.ts`:
```typescript
// DELETE:
export { EngineScrollRegion } from './EngineScrollRegion';
export type { EngineScrollRegionProps } from './EngineScrollRegion';  // if present
```

Find all usages across apps:
```bash
grep -rn "EngineScrollRegion" apps/ --include="*.ts" --include="*.tsx"
```

> ⚠️ **Migration is NOT 1:1.** `EngineScrollRegion` rendered a `<canvas>` inline (via
> `engine.setCanvasRef`). `EngineInputRegion` does NOT render a canvas — that is `SceneCanvas`'s
> responsibility. Every migration site must add `<SceneCanvas />` as an explicit child.

**Migration pattern:**
```tsx
// BEFORE:
<EngineScrollRegion engine={engine} className={cls}>
  <MyOverlay />
</EngineScrollRegion>

// AFTER:
<EngineInputRegion className={cls}>
  <SceneCanvas />
  <MyOverlay />
</EngineInputRegion>
```

`EngineInputRegion` reads engine state from `EngineContext` internally after the refactor in
§9.2 — no `engine` prop required.

Also note: `EngineScrollRegion` had an internal `ResizeObserver` that called
`engine.setViewportSize`. That responsibility has moved to `SceneCanvas`. Verify after migration
that viewport sizing works correctly (canvas resizes on container resize).

### 4.5 Remove `nextSceneTrackCacheToken` from public API

`nextSceneTrackCacheToken` is `(prev: number): number => prev + 1` — a trivial helper that
consumers do not need exposed.

**File to modify:** `packages/core/src/player/index.ts`

Remove:
```typescript
// DELETE:
export { nextSceneTrackCacheToken } from './sceneTrackCacheToken';
```

Do NOT delete `sceneTrackCacheToken.ts` — it may be used internally. Verify with grep and
delete if zero internal usages remain.

**File to delete (test, if exists):**
`packages/core/src/player/__tests__/sceneTrackCacheToken.test.ts`

If the function is used internally in `useSceneEngine.ts`, keep it as a non-exported utility.

### 4.6 Remove `SceneProgressMapper` from public API

`SceneProgressMapper` is an internal coordinate-mapping utility used by `useSceneEngine` and
`useEngineScroll`. It must not be part of the public API.

**File to modify:** `packages/core/src/player/index.ts`

Remove:
```typescript
// DELETE:
export { SceneProgressMapper } from './SceneProgressMapper';
```

The class itself stays in `player/SceneProgressMapper.ts` (it's needed internally). Only the
export is removed. The `IDENTITY_FN` export should move to `compiler/identityFn.ts` as described
in 4.1. The `SceneProgressMapper` class itself is no longer exported.

### 4.7 Remove `CameraControlPanel` and `CameraInteractionInfoDialog` from default exports

These are dev-only UI components. They should remain in the codebase but not be exported from
the main package index unless explicitly requested.

**File to modify:** `packages/core/src/player/index.ts`

Move these to a comment block marked `// Dev tools — not part of the stable public API`:
```typescript
// These are development and debugging utilities only.
// They are exported for use in dev builds but should not be considered
// stable public API.
export { CameraControlPanel } from './CameraControlPanel';
export type { CameraControlPanelProps } from './CameraControlPanel';
export { CameraInteractionInfoDialog } from './CameraInteractionInfoDialog';
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
```

These remain exported but are now documented as unstable dev utilities via JSDoc on each
component file. Add to each:
```typescript
/**
 * @internal Development-only component. Not part of the stable public API.
 * May change or be removed without a major version bump.
 */
```

### 4.8 Remove `widgetSetup` support from `EngineProvider`

**File to modify:** `packages/core/src/player/EngineProvider.tsx`

Remove from `EngineProviderProps`:
```typescript
// DELETE:
widgetSetup?: (manifest: AssetManifest) => WidgetRegistry;
```

Remove the `widgetSetup` fallback code path inside the provider (the branch that calls
`widgetSetup(manifest)` when `plugins` is absent). After removal, if neither `plugins` is
provided nor is there a registry, the provider should throw at mount time with a clear error:

```typescript
if (!plugins || plugins.length === 0) {
  console.error(
    '[BrewSite] EngineProvider requires a `plugins` prop. ' +
    'Pass plugins={[corePlugin(), ...]} to configure the engine.',
  );
}
```

Remove `defaultModelStates` from `EngineProviderProps` as well — it was a deprecated pass-through
that had no effect.

---

## 5. Phase 3 — Type System Improvements

### 5.1 Wire `TExtra` from `ISceneElement` through to `IRenderable`

**Problem:** `ISceneElement<TState, TExtra>` exposes `TExtra` via `compileExtra()`, but
`IRenderable<TState>` receives `extra: unknown` in `WidgetRenderContext`. The generic parameter is
declared but unused at the point of consumption.

**File to modify:** `packages/core/src/widget/types.ts`

#### Step 1: Parameterize `WidgetRenderContext`

```typescript
// BEFORE:
export type WidgetRenderContext = {
  clock: RealtimeClock;
  effectiveDeltaSeconds: number;
  globalProgress: number;
  variables: VariableStoreReader;
  /** Compiled extra data from ISceneElement.compileExtra(). Cast to the widget's TExtra. */
  extra: unknown;
  tick?: SceneTrackTick | null;
};

// AFTER:
export type WidgetRenderContext<TExtra = unknown> = {
  clock: RealtimeClock;
  effectiveDeltaSeconds: number;
  globalProgress: number;
  variables: VariableStoreReader;
  /**
   * Compiled extra data from ISceneElement.compileExtra().
   * Typed as TExtra when the widget implements ISceneElement<TState, TExtra>.
   * Unknown when consumed from a generic context.
   */
  extra: TExtra;
  tick?: SceneTrackTick | null;
};
```

#### Step 2: Parameterize `IRenderable`

```typescript
// BEFORE:
export interface IRenderable<TState> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext): void;
  dispose(): void;
}

// AFTER:
export interface IRenderable<TState, TExtra = unknown> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext<TExtra>): void;
  dispose(): void;
}
```

#### Step 3: Usage in widgets

Widgets that implement both interfaces now declare both generics:

```typescript
// Example: a widget with typed extra data
class ModelWidget
  implements ISceneElement<ModelState, CompiledAnimation>,
             IRenderable<ModelState, CompiledAnimation> {

  compileExtra(state: ModelState, ctx: CompileExtraContext): CompiledAnimation {
    return computeAnimationData(state);
  }

  apply(state: ModelState, ctx: WidgetRenderContext<CompiledAnimation>): void {
    const compiled = ctx.extra; // typed as CompiledAnimation — no cast needed
    applyModel(this.model, state, compiled);
  }
}
```

#### Step 4: Update RuntimeDriverImpl

In `packages/core/src/runtime/RuntimeDriver.ts`, the `apply()` call site passes `extra` as
`unknown`. This is acceptable — the runtime uses `IRenderable<unknown, unknown>` from the
registry, which is correct. No change needed to the runtime.

#### Step 5: Update isRenderable type guard

In `packages/core/src/widget/WidgetRegistry.ts`, the `isRenderable` type guard returns
`widget is IRenderable<unknown>`. Update to `widget is IRenderable<unknown, unknown>`.

### 5.2 Type-safe `CUSTOM_NODE_HANDLER`

**Problem:** The current pattern uses symbol-keyed properties with manual casts:
```typescript
(widget as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER]
```
This is invisible to TypeScript, undiscoverable, and requires ugly casts everywhere.

**File to modify:** `packages/core/src/widget/WidgetRegistry.ts`

#### Step 1: Declare a typed interface for widgets with custom handlers

Add below the `CUSTOM_NODE_HANDLER` symbol declaration:

```typescript
/**
 * Interface implemented by widgets that override the default DSL node routing.
 * When a widget implements this interface, the WidgetRegistry invokes the widget's
 * [CUSTOM_NODE_HANDLER] method instead of the default shallow-merge path.
 *
 * @example
 * class CameraWidget implements ISceneElement<SceneCamera>, IHasCustomDslHandler {
 *   readonly [CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
 *     // custom prop transformation logic
 *   };
 * }
 */
export interface IHasCustomDslHandler extends IWidget {
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler;
}

/**
 * Type guard: returns true if the widget implements IHasCustomDslHandler.
 * Use this instead of manual symbol casts to check for custom DSL handling.
 */
export const hasCustomDslHandler = (widget: IWidget): widget is IHasCustomDslHandler =>
  CUSTOM_NODE_HANDLER in widget;
```

#### Step 2: Update WidgetRegistry routing to use the type guard

Find the routing handler inside `register()` where `CUSTOM_NODE_HANDLER` is checked:

```typescript
// BEFORE:
const customHandler = (target as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER];
if (customHandler) {
  customHandler(node, api, helpers);
}

// AFTER:
if (hasCustomDslHandler(target)) {
  target[CUSTOM_NODE_HANDLER](node, api, helpers);
}
```

#### Step 3: Export from `widget/index.ts`

Add to exports:
```typescript
export { CUSTOM_NODE_HANDLER, hasCustomDslHandler };
export type { IHasCustomDslHandler };
```

#### Step 4: Update all widgets that use CUSTOM_NODE_HANDLER

Run: `grep -rn "CUSTOM_NODE_HANDLER" packages/ --include="*.ts" --include="*.tsx"`

For each widget, add `IHasCustomDslHandler` to the `implements` list and verify TypeScript
accepts the property type. The property declaration pattern does not change:
```typescript
readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => { ... };
```

### 5.3 Single-source `AssetManifest` type

**Problem:** `AssetManifest` is defined 3+ times across the codebase:
- Inline in `RuntimeDriver.ts` as a comment: `type AssetManifest = { version: number; models: unknown[]; animations: unknown[] }`
- In `widget/types.ts` (canonical location)
- Re-declared in several places

**Decision:** `widget/types.ts` is the canonical source. All other declarations are removed.

**File to modify:** `packages/core/src/runtime/RuntimeDriver.ts`

Remove the local `AssetManifest` re-declaration at the top of the file:
```typescript
// DELETE this line:
type AssetManifest = { version: number; models: unknown[]; animations: unknown[] };
```

Replace with:
```typescript
import type { AssetManifest } from '../widget/types';
```

**File to modify:** `packages/core/src/widget/types.ts`

Ensure `AssetManifest` is exported with complete JSDoc:

```typescript
/**
 * Minimal asset manifest type. Extended by @brewsite/model with model-specific fields.
 * Passed to ILoadable.load() when the manifest has been fetched.
 */
export type AssetManifest = {
  readonly version: number;
  readonly models: unknown[];
  readonly animations: unknown[];
};
```

**File to modify:** `packages/core/src/widget/index.ts`

Add to exports:
```typescript
export type { AssetManifest } from './types';
```

Search and remove all other local redeclarations: `grep -rn "AssetManifest" packages/core/src`

### 5.4 Document `ISceneElement.DslComponent: React.ComponentType<any>` intentionality

The `any` in `DslComponent` is intentional — the registry is heterogeneous and each widget's
prop safety is enforced by the widget's own DSL component type, not by the registry interface.

**File to modify:** `packages/core/src/widget/types.ts`

Update the JSDoc:

```typescript
/**
 * The React DSL component for this widget.
 *
 * Typed as `ComponentType<any>` because the registry is intentionally heterogeneous —
 * each registered widget provides a different component with different prop types.
 * Prop safety is enforced at each component's own type definition (CameraProps,
 * LightingProps, etc.), not here. Narrowing this type with a generic would propagate
 * a TProps type parameter through the entire registry without adding safety.
 */
readonly DslComponent: React.ComponentType<any>; // intentional: see JSDoc
```

---

## 6. Phase 4 — Runtime and Global State Fixes

### 6.1 Remove `clearCache()` call from `EngineProvider` unmount

**Problem:** `EngineProvider.tsx` calls `clearCache()` on unmount, which wipes the global
`sceneTrackCache` for ALL engines on the page, not just the one being unmounted.

**File to modify:** `packages/core/src/player/EngineProvider.tsx`

Find the `useEffect` cleanup that calls `clearCache()` and remove the call:

```typescript
// BEFORE (in useEffect cleanup):
return () => {
  clearCache();
  // ... other cleanup
};

// AFTER:
return () => {
  // Cache entries are keyed by content + widget registry state.
  // They are naturally invalidated when scene content or registry changes.
  // Do NOT clear the global cache on unmount — other engine instances share it.
  // ... other cleanup only
};
```

Also remove the import of `clearCache` from `EngineProvider.tsx` if it's no longer used.

### 6.2 Separate apply-errors from load-errors in `RuntimeDriverImpl`

**Problem:** `erroredWidgets` is a single Set that permanently blacklists widgets whether they
failed during `load()` (permanent — asset missing) or during `apply()` (transient — could
recover in next scene). This means a widget that errors on frame 1 of scene 1 is silently
skipped for the entire session.

**File to modify:** `packages/core/src/runtime/RuntimeDriver.ts`

Replace the single `erroredWidgets` Set with two:

```typescript
// BEFORE:
private readonly erroredWidgets = new Set<string>();

// AFTER:
/** Widgets that failed during load() or initialize() — permanent for this session. */
private readonly loadErroredWidgets = new Set<string>();
/** Widgets that failed during apply() — cleared on scene change, allows recovery. */
private readonly applyErroredWidgets = new Set<string>();
```

Update all read sites:
- In `tick()` where `erroredWidgets.has(widgetId)` is checked for renderables:
  use `this.loadErroredWidgets.has(widgetId) || this.applyErroredWidgets.has(widgetId)`
- In `tick()` where `erroredWidgets.has(widgetId)` is checked for animation controllers:
  same combined check

Update all write sites:
- In `load()` failure catch: use `this.loadErroredWidgets.add(widgetId)`
- In `apply()` failure catch: use `this.applyErroredWidgets.add(widgetId)`

Add scene-change reset in `tick()`. When `tick.sceneIndex` changes from the previous frame,
clear `applyErroredWidgets`:

```typescript
// At the start of tick(), after sampling:
const tick = this.sampler.sample(globalProgress);
if (this.currentTick && tick.sceneIndex !== this.currentTick.sceneIndex) {
  // New scene — allow widgets that failed during apply() to try again.
  this.applyErroredWidgets.clear();
}
this.currentTick = tick;
```

### 6.3 Remove `EngineProvider` direct coupling to `SceneMetaWidget`

**Problem:** `EngineProvider.tsx` contains special-case code that looks up `SceneMetaWidget`
by its literal `widgetId` string `'__scene_meta__'` and calls `setOnSceneChange()`. This is
outside the plugin contract.

**File to modify:** `packages/core/src/player/plugins.ts`

The `corePlugin()` factory accepts `onSceneChange?: (sceneId: string, sceneIndex: number) => void`
via `CorePluginOptions`. The `SceneMetaWidget` is already created inside `corePlugin()`. The
`onSceneChange` is already wired inside the plugin. This is the correct path.

**File to modify:** `packages/core/src/player/EngineProvider.tsx`

Remove the block that does:
```typescript
// DELETE this block:
const metaWidget = registry.get('__scene_meta__');
if (metaWidget && metaWidget instanceof SceneMetaWidget) {
  metaWidget.setOnSceneChange(onSceneChange);
}
```

The `onSceneChange` prop on `EngineProvider` should be passed into `corePlugin()` options
instead. Update how plugins are invoked in `EngineProvider`:

```typescript
// The consumer should wire onSceneChange via corePlugin options:
// plugins={[corePlugin({ onSceneChange }), modelPlugin(...)]}
//
// EngineProvider should NOT wire onSceneChange independently.
// Remove the onSceneChange prop from EngineProviderProps if it was passed separately.
```

If `EngineProvider` currently accepts an `onSceneChange` prop independently of plugins, remove
it. Scene change callbacks must come through `corePlugin({ onSceneChange })`.

### 6.4 Split `camera/render.ts` into two files

`packages/core/src/elements/camera/render.ts` is 526 lines containing two distinct concerns:
1. `applyCamera()` — the render function and its geometry helpers (~200 lines)
2. `CameraControlsDriver` — the interactive mode driver class (~326 lines)

**File to create:** `packages/core/src/elements/camera/CameraControlsDriver.ts`

Move the entire `CameraControlsDriver` class and the `ccInstalled` guard from `render.ts`
into this new file. Exports:

```typescript
// CameraControlsDriver.ts — interactive camera driver for scroll-to-orbit mode.
// Wraps the camera-controls npm package. One instance per CameraWidget.

import CameraControls from 'camera-controls';
import * as THREE from 'three';
import type { ICameraInteractionDriver, ... } from './types';

let ccInstalled = false;

export class CameraControlsDriver implements ICameraInteractionDriver {
  // ... all existing CameraControlsDriver code moved here verbatim
}
```

**File to modify:** `packages/core/src/elements/camera/render.ts`

After moving `CameraControlsDriver` out, `render.ts` retains only:
- `CameraRenderContext` type
- Pure geometry helpers (`degToRad`, `getTargetState`, `computeRayIntersectionZ`, `solveCameraZForFloor`)
- `applyCamera()` function

Add import at top of `render.ts`:
```typescript
// CameraControlsDriver is consumed by CameraWidget; this file does not re-export it.
```

**File to modify:** `packages/core/src/elements/camera/CameraWidget.ts`

Update import:
```typescript
// BEFORE:
import { CameraControlsDriver } from './render';
// AFTER:
import { CameraControlsDriver } from './CameraControlsDriver';
```

### 6.5 Fix `ccInstalled` global (document the known limitation)

The `ccInstalled` boolean guards `CameraControls.install(THREE)` to run exactly once per
process. This is correct when only one WebGLRenderer instance exists, but silently fails if a
second renderer is created after the first.

This is a known limitation of the `camera-controls` library. Fix with a comment in
`CameraControlsDriver.ts`:

```typescript
/**
 * Guards CameraControls.install() — must run exactly once per JS environment.
 * camera-controls requires THREE to be registered globally before first use.
 *
 * KNOWN LIMITATION: If a second WebGLRenderer is created in the same process after
 * the first CameraControlsDriver is instantiated (e.g., in tests or multi-engine pages),
 * the install is already done and this guard is correct. The library itself is the
 * constraint here, not this implementation.
 */
let ccInstalled = false;
```

This is a documentation fix, not a code change. A full fix would require `camera-controls` to
support multi-renderer operation, which is outside the scope of this plan.

---

## 7. Phase 5 — Widget SDK Contract Extensions

### 7.1 Add `ISceneLifecycle` interface

**Problem:** Widgets have no runtime notification when the active scene changes. The only
mechanism is `mergeSnapshot()`, which runs at compile time, not runtime. Widgets that need to
reset state (accumulators, Three.js animations, event listeners) on scene entry/exit have no
clean hook.

**File to modify:** `packages/core/src/widget/types.ts`

Add the new interface:

```typescript
/**
 * Optional lifecycle interface for widgets that need to respond to scene transitions
 * at runtime. Implement this to reset per-scene state, restart animations, or clean
 * up Three.js objects that should not carry between scenes.
 *
 * Both methods are called synchronously during the tick loop when the scene index changes.
 * Do not perform heavy work here — defer to the next apply() call if needed.
 *
 * @example
 * class ParticleWidget implements IRenderable<ParticleState>, ISceneLifecycle {
 *   onSceneExit(sceneId: string, sceneIndex: number): void {
 *     this.particleSystem.reset();
 *   }
 *   onSceneEnter(sceneId: string, sceneIndex: number): void {
 *     this.accumulator = 0;
 *   }
 * }
 */
export interface ISceneLifecycle extends IWidget {
  /**
   * Called when the engine transitions away from the scene with the given id.
   * Fires before onSceneEnter for the next scene.
   */
  onSceneExit(sceneId: string, sceneIndex: number): void;

  /**
   * Called when the engine transitions into the scene with the given id.
   * Fires after onSceneExit for the previous scene.
   */
  onSceneEnter(sceneId: string, sceneIndex: number): void;
}
```

**File to modify:** `packages/core/src/widget/WidgetRegistry.ts`

Add type guard:

```typescript
export const isSceneLifecycle = (widget: IWidget): widget is ISceneLifecycle =>
  typeof (widget as ISceneLifecycle).onSceneEnter === 'function' &&
  typeof (widget as ISceneLifecycle).onSceneExit === 'function';
```

Add retrieval method to `WidgetRegistry`:

```typescript
/** Returns all widgets that implement ISceneLifecycle, in registration order. */
getSceneLifecycleWidgets(): ISceneLifecycle[] {
  return this.getAll().filter(isSceneLifecycle);
}
```

**File to modify:** `packages/core/src/runtime/RuntimeDriver.ts`

Add private field:
```typescript
private readonly sceneLifecycleWidgets: ISceneLifecycle[];
```

Initialise in constructor:
```typescript
this.sceneLifecycleWidgets = widgetRegistry.getSceneLifecycleWidgets();
```

In `tick()`, after the scene-index change detection (added in 6.2), fire the lifecycle hooks:

```typescript
if (this.currentTick && tick.sceneIndex !== this.currentTick.sceneIndex) {
  const prevSceneId = this.currentTick.sceneId;
  const prevSceneIndex = this.currentTick.sceneIndex;
  const nextSceneId = tick.sceneId;
  const nextSceneIndex = tick.sceneIndex;

  // Fire onSceneExit for the departing scene
  for (const widget of this.sceneLifecycleWidgets) {
    try {
      widget.onSceneExit(prevSceneId, prevSceneIndex);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.warn(`[RuntimeDriver] onSceneExit error in widget "${widget.widgetId}":`, err);
    }
  }

  // Fire onSceneEnter for the arriving scene
  for (const widget of this.sceneLifecycleWidgets) {
    try {
      widget.onSceneEnter(nextSceneId, nextSceneIndex);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.warn(`[RuntimeDriver] onSceneEnter error in widget "${widget.widgetId}":`, err);
    }
  }

  // Reset apply-errors on scene change (added in 6.2)
  this.applyErroredWidgets.clear();
}
```

Note: Errors in `ISceneLifecycle` hooks are `console.warn` level (not added to erroredWidgets)
because lifecycle hooks are optional enhancements. A failure here must not blacklist the widget
from rendering.

**File to modify:** `packages/core/src/widget/index.ts`

Add exports:
```typescript
export type { ISceneLifecycle } from './types';
export { isSceneLifecycle } from './WidgetRegistry';
```

**Test file to create:** `packages/core/src/runtime/__tests__/SceneLifecycle.test.ts`

```typescript
// Tests for ISceneLifecycle hooks in RuntimeDriverImpl.
// Verifies onSceneExit and onSceneEnter fire at the correct tick.

import { describe, it, expect } from 'vitest';
import { RuntimeDriverImpl } from '../RuntimeDriver';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { VariableStore } from '../../widget/VariableStore';
import type { ISceneLifecycle, ISceneElement, IRenderable } from '../../widget/types';
import type { SceneTrack, SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ... (build minimal 2-scene SceneTrack, register a widget implementing ISceneLifecycle,
// drive tick() across the scene boundary, assert onSceneExit/onSceneEnter call order and args)
```

### 7.2 Document `IAnimationController` broader scope

`IAnimationController` is named for animation but used for any per-frame side effects
(physics, procedural motion, input processing). No rename — that is a breaking change without
sufficient benefit. Instead, update the JSDoc.

**File to modify:** `packages/core/src/widget/types.ts`

```typescript
/**
 * Opts a widget into the per-frame tick loop. Called once per rendered frame
 * during the animation phase, before IRenderable.apply().
 *
 * Use cases include (but are not limited to):
 * - Advancing AnimationMixer for GLTF animations
 * - Physics simulation steps
 * - Procedural motion (oscillation, spring physics)
 * - Publishing derived state to the VariableStore
 * - Per-frame input processing
 *
 * Despite the name, this interface is not limited to animation. It is the
 * general-purpose per-frame side-effect hook.
 */
export interface IAnimationController extends IWidget {
  // ...
}
```

### 7.3 Enforce `requiresTypeProp` at registration time

**Problem:** Widgets that set `requiresTypeProp: true` expect a `type` prop to route to the
correct factory instance. The `WidgetRegistry` does not validate this — a DSL node without
`type` can silently match the wrong widget.

**File to modify:** `packages/core/src/widget/WidgetRegistry.ts`

In the routing handler installed for a widget's `DslComponent`, add a guard:

```typescript
// In the routing NodeHandler installed by register():
const handler: NodeHandler = (node, api, helpers) => {
  const props = node.props as Record<string, unknown>;

  // Validate requiresTypeProp
  const sceneElement = target as ISceneElement<unknown>;
  if (sceneElement.requiresTypeProp && !props['type']) {
    console.error(
      `[WidgetRegistry] DSL component <${displayName}> requires a "type" prop. ` +
      `Found: <${displayName} id="${props['id'] ?? '?'}" /> without type. ` +
      `Provide type="..." to identify the target widget instance.`,
    );
    return; // Skip compilation for this node
  }
  // ... rest of existing routing logic
};
```

---

## 8. Phase 6 — Package API Surface Cleanup

### 8.1 Reorganize `player/index.ts`

After all deletions and additions, the `player/index.ts` exports should be grouped and ordered:

```typescript
// ─── Composition Primitives ───────────────────────────────────────────────────
export { EngineProvider } from './EngineProvider';
export type { EngineProviderProps } from './EngineProvider';
export { EngineInputRegion } from './EngineInputRegion';
export type { EngineInputRegionProps } from './EngineInputRegion';
export { SceneCanvas } from './SceneCanvas';
export type { SceneCanvasProps } from './SceneCanvas';
export { EngineOverlayHost } from './EngineOverlayHost';
export type { EngineOverlayHostProps } from './EngineOverlayHost';
export { EngineGate } from './EngineGate';
export type { EngineGateProps } from './EngineGate';
export { ScrollCaptureSection } from './ScrollCaptureSection';
export type { ScrollCaptureSectionProps } from './ScrollCaptureSection';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useSceneEngine } from './useSceneEngine';
export { useEngineScroll } from './useEngineScroll';
export type { UseEngineScrollOptions, UseEngineScrollResult } from './useEngineScroll';
export { useEngineInput } from './useEngineInput';
export type { UseEngineInputOptions, UseEngineInputResult } from './useEngineInput';
export { useEngineScrubber } from './useEngineScrubber';
export type { UseEngineScrubberOptions, UseEngineScrubberResult } from './useEngineScrubber';
export { useSceneProgress } from './useSceneProgress';
export { useCurrentScene } from './useCurrentScene';
export { useSceneRuntime } from './useSceneRuntime';
export type { SceneRuntimeState } from './ScenePlayerRegistry';
export { useEngineState } from './EngineStateContext';
export { useSceneEngineState } from './useSceneEngineState';
export type { SceneEngineSnapshot } from './ScenePlayerRegistry';
export { EngineContext, useSceneEngineContext } from './EngineContext';

// ─── Plugin System ────────────────────────────────────────────────────────────
export { corePlugin } from './plugins';
export type { CorePluginOptions } from './plugins';

// ─── Types ────────────────────────────────────────────────────────────────────
export type { EngineFrameState, EngineState } from './engineTypes';

// ─── UI Components (stable public API) ────────────────────────────────────────
// TimelineWidget is consumer-facing product surface — not a dev tool.
export { TimelineWidget } from './TimelineWidget';
export type { TimelineWidgetProps, TimelineTickStyle, TimelineTheme } from './TimelineWidgetTypes';

// ─── Dev Tools (unstable; not part of the public API contract) ────────────────
// These exist for development and debugging. They are exported but not stable.
export { CameraControlPanel } from './CameraControlPanel';
export { CameraInteractionInfoDialog } from './CameraInteractionInfoDialog';
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
```

### 8.2 Clean up `packages/core/src/index.ts`

Remove exports that should not be part of the public API:

```typescript
// REMOVE (internal utility, moved to compiler/identityFn.ts but not public):
// (no change needed — IDENTITY_FN was never in index.ts directly)

// VERIFY the following are present and correctly sourced:
export type { FunctionalTransitionSpec, ElementTransitionSpec } from './compiler/transitions/transitionTypes';
export { blendNumber, blendOpacity, blendVec3, blendColor, transitionT } from './compiler/transitions/transitionTypes';
export { registerNode } from './compiler/registry';
export { ensureText } from './text/TextRenderer';
export type { TextWithLayout } from './text/types';

// ADD (new in this plan):
export type { AssetManifest } from './widget/types';
export { hasCustomDslHandler, CUSTOM_NODE_HANDLER } from './widget/WidgetRegistry';
export type { IHasCustomDslHandler, ISceneLifecycle } from './widget/types';
export { isSceneLifecycle } from './widget/WidgetRegistry';
```

### 8.3 Add sub-entry points to `packages/core/package.json`

The build system uses `vite` in library mode with `tsc`. Sub-entry points require that each
path maps to an existing dist file. The current build produces a flat `dist/` from `src/`.

**File to modify:** `packages/core/package.json`

Add to the `"exports"` field:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  },
  "./player": {
    "types": "./dist/player/index.d.ts",
    "import": "./dist/player/index.js",
    "default": "./dist/player/index.js"
  },
  "./compiler": {
    "types": "./dist/compiler/index.d.ts",
    "import": "./dist/compiler/index.js",
    "default": "./dist/compiler/index.js"
  },
  "./widget": {
    "types": "./dist/widget/index.d.ts",
    "import": "./dist/widget/index.js",
    "default": "./dist/widget/index.js"
  },
  "./elements": {
    "types": "./dist/elements/index.d.ts",
    "import": "./dist/elements/index.js",
    "default": "./dist/elements/index.js"
  },
  "./runtime": {
    "types": "./dist/runtime/index.d.ts",
    "import": "./dist/runtime/index.js",
    "default": "./dist/runtime/index.js"
  },
  "./hud/animejs": {
    "types": "./dist/hud/animejs/index.d.ts",
    "import": "./dist/hud/animejs/index.js",
    "default": "./dist/hud/animejs/index.js"
  }
}
```

**Build system note:** Verify that `vite.config.ts` (or the tsc configuration) in
`packages/core` does not use entry-point bundling that collapses sub-directories. If using
`tsc` library mode, sub-paths should work automatically. If using Vite's `lib.entry`, multiple
entry points must be declared.

### 8.4 Add `sideEffects: false` to `package.json`

This allows bundlers to tree-shake unused code safely:

```json
"sideEffects": false
```

Caveat: Verify that no module in `packages/core/src/` has side effects at import time (module-
level code that runs when the file is imported, beyond declarations). The `clearRegistry()` call
in EngineProvider unmount being removed (Phase 4) eliminates one such concern. Check
`compiler/coreHandlers.ts` — if `registerCoreHandlers()` is called at module scope anywhere,
that is a side effect. Ensure all registration calls are explicit, not auto-executed on import.

---

## 9. Apps Migration Guide

### 9.1 `apps/website/src/`

The website already uses `EngineProvider` directly. No `ScenePlayer` usages expected. Verify:
```bash
grep -rn "ScenePlayer" apps/website/src --include="*.tsx" --include="*.ts"
```

If any exist, apply the pattern below.

### 9.2 `apps/docs/src/` — ScenePlayer → EngineProvider

The docs app has many `ScenePlayer` usages. Each must be converted.

**Before (ScenePlayer pattern):**
```tsx
<ScenePlayer
  manifestUrl="/manifest.json"
  plugins={[corePlugin(), modelPlugin(manifest)]}
  quality="balanced"
  pixelsPerScene={800}
  onSceneChange={handleSceneChange}
  placeholder={<Spinner />}
  debug={isDev}
>
  <Scene id="intro">...</Scene>
  <Scene id="detail">...</Scene>
</ScenePlayer>
```

**After (EngineProvider pattern):**
```tsx
// EngineGate and EngineInputRegion read from EngineContext internally —
// no engine prop is passed. Place them inside EngineProvider.
function MyPage() {
  return (
    <EngineProvider
      id="my-player"
      manifestUrl="/manifest.json"
      plugins={useMemo(() => [
        corePlugin({ onSceneChange: handleSceneChange }),
        modelPlugin(manifest),
      ], [handleSceneChange])}
      quality="balanced"
      pixelsPerScene={800}
    >
      <Scene id="intro">...</Scene>
      <Scene id="detail">...</Scene>

      <EngineGate placeholder={<Spinner />}>
        <EngineInputRegion>
          <SceneCanvas />
          <EngineOverlayHost />
          {isDev && <SceneInspector />}
        </EngineInputRegion>
      </EngineGate>
    </EngineProvider>
  );
}
```

**Actual canonical pattern (how EngineInputRegion works):**

`EngineInputRegion` and `SceneCanvas` use React context internally — they do NOT require the
`engine` object to be passed in from outside. Check the current `EngineInputRegion` props: if
it requires `engine: UseSceneEngineResult`, update it to read from context instead. The prop
is a footgun — it requires consumers to pull the engine object out and pass it back in.

**File to modify:** `packages/core/src/player/EngineInputRegion.tsx`

If `EngineInputRegion` currently takes `engine: UseSceneEngineResult` as a prop, refactor it
to read from `EngineContext` via `useSceneEngineContext()` internally. The component should
require no props except layout overrides:

```typescript
// BEFORE:
export type EngineInputRegionProps = {
  engine: UseSceneEngineResult;
  // ...
};

// AFTER:
export type EngineInputRegionProps = {
  className?: string;
  fillContainer?: boolean;
  children?: ReactNode;
};
// EngineInputRegion reads engine state from EngineContext internally.
```

This change means the component no longer needs to be called with `engine={engine}` at the
call site, simplifying all consumer code.

### 9.3 `apps/docs/src/` — Remove `createDefaultWidgetRegistry` / `widgetSetup`

Run:
```bash
grep -rn "createDefaultWidgetRegistry\|widgetSetup" apps/ --include="*.ts" --include="*.tsx"
```

Known usages requiring migration:
- `apps/docs/src/demos/shared/DemoScene.tsx` — uses `widgetSetup` pattern with `useMemo` for stability
- `apps/docs/src/components/demo/InlineDemo.tsx` — uses `createDefaultWidgetRegistry` directly

For each usage, replace with `plugins={[corePlugin(), modelPlugin(...)]}`.

**Note on DemoScene.tsx:** It uses `widgetSetup` with a stable-reference pattern (`useMemo`). The
migration must preserve stability — pass a stable `plugins` array created at module scope or via
`useMemo`. The `DemoScene` component's prop type must change from
`widgetSetup?: (m: AssetManifest) => WidgetRegistry` to `plugins?: WidgetPlugin[]`.

### 9.4 `apps/docs/src/` — Replace `EngineScrollRegion` with `EngineInputRegion`

Run:
```bash
grep -rn "EngineScrollRegion" apps/ --include="*.ts" --include="*.tsx"
```

Replace each usage using the migration pattern in §4.4 — include `<SceneCanvas />` as a child.

### 9.5 `apps/docs/src/` — Migrate `onSceneChange` to `corePlugin`

`onSceneChange` will be removed from `EngineProviderProps` in Phase 4. It must move to
`corePlugin({ onSceneChange })`. Known usages:

```bash
grep -rn "onSceneChange" apps/ --include="*.ts" --include="*.tsx"
```

Confirmed file requiring migration:
- `apps/docs/src/components/layout/DocsApp.tsx:79` — passes `onSceneChange` directly on `<EngineProvider>`

> ⚠️ **Stability requirement:** When `onSceneChange` moves into `corePlugin`, the entire
> `plugins` array prop must be stable (the same reference across renders). An unstable array
> recreates the widget registry on every render, restarting asset loading.
>
> Correct pattern:
> ```tsx
> // Module-level — stable across renders:
> const PLUGINS = [corePlugin({ onSceneChange: myStableCallback })];
>
> // Or via useMemo if callback is a prop/state:
> const plugins = useMemo(
>   () => [corePlugin({ onSceneChange: handleSceneChange }), modelPlugin(...)],
>   [handleSceneChange],
> );
> ```
>
> If `handleSceneChange` is defined inline in the render function, wrap it in `useCallback` first.

### 9.6 `apps/examples/src/` — Migrate `ScenePlayer` usages

Run:
```bash
grep -rn "ScenePlayer\|createDefaultWidgetRegistry\|widgetSetup" apps/examples/ --include="*.ts" --include="*.tsx"
```

Known file requiring migration:
- `apps/examples/src/chart/ChartDemoPage.tsx:3,19` — uses `ScenePlayer`

Apply the EngineProvider pattern from §9.2. The chart demo uses
`plugins={[...chartPlugins]}` so no `widgetSetup` migration is needed — just change
the component from `<ScenePlayer>` to the `<EngineProvider>` + `<EngineGate>` + `<EngineInputRegion>` composition.

### 9.7 Docs content pages — Update code sample strings

The following pages contain ScenePlayer usage in **template-literal code samples** shown in
the docs UI. These are strings, not runtime JSX — they will not cause TypeScript errors but
the docs will show outdated API examples and should be updated.

Run:
```bash
grep -rn "ScenePlayer" apps/docs/src --include="*.tsx"
```

Known content files with code samples to update:
- `apps/docs/src/scenes/content/getting-started/sceneQuickStart.tsx`
- `apps/docs/src/scenes/content/player-hooks/scenePlayer.tsx`
- `apps/docs/src/scenes/content/scene-authoring/sceneMultiScene.tsx`

Update the code samples to show the `EngineProvider` pattern. Also update the `scenePlayer.tsx`
content page title and description to reflect that `ScenePlayer` is removed.

---

## 10. Testing Strategy

### Per-Phase Tests

| Phase | New test file(s) | What is tested |
|---|---|---|
| 1 | `player/__tests__/EngineGate.test.tsx` | Placeholder shown before tick; children shown after tick |
| 2 | No new tests; delete test files for deleted code | n/a |
| 3 | `widget/__tests__/ISceneElementTExtra.test.ts` | TExtra flows correctly from compileExtra to apply context |
| 3 | `widget/__tests__/CustomDslHandler.test.ts` | hasCustomDslHandler type guard; routing invokes handler |
| 4 | `runtime/__tests__/ErrorRecovery.test.ts` | applyErroredWidgets cleared on scene change; loadErroredWidgets persists |
| 5 | `runtime/__tests__/SceneLifecycle.test.ts` | onSceneExit/onSceneEnter fire in correct order at scene boundaries |
| 5 | `widget/__tests__/requiresTypeProp.test.ts` | console.error fired when type prop missing on requiresTypeProp widget |
| 6 | Run existing test suite after exports change | No regressions |

### Pre-commit Checklist

Before marking this plan complete:

1. `pnpm typecheck` passes with zero errors across all packages
2. `pnpm test` passes across all packages
3. `grep -rn "ScenePlayer" packages/core/src` returns zero results (except test files that are being deleted)
4. `grep -rn "EngineScrollRegion" packages/core/src` returns zero results
5. `grep -rn "createDefaultWidgetRegistry" packages/core/src` returns zero results
6. `grep -rn "from.*compiler/primitives" packages/ apps/` returns zero results (except progressManager)
7. `grep -rn "clearCache()" packages/core/src` returns zero results
8. `grep -rn "IDENTITY_FN.*SceneProgressMapper\|SceneProgressMapper.*IDENTITY_FN" packages/core/src/compiler` returns zero results (boundary violation fixed)
9. The `apps/docs` build succeeds with no TypeScript errors
10. The `apps/website` build succeeds with no TypeScript errors
11. The `apps/examples` build succeeds with no TypeScript errors
12. Apps migration complete: `grep -rn "ScenePlayer\|EngineScrollRegion\|createDefaultWidgetRegistry\|widgetSetup" apps/ --include="*.ts" --include="*.tsx"` returns zero results for runtime component usages (code-sample strings in docs content are acceptable, but must be updated separately — see §9.7)
13. **CHANGELOG.md** updated in `packages/core/` with a complete breaking changes section listing all removed symbols, their replacements, and migration paths. *(PM-authored artifact)*
14. **README.md** updated in `packages/core/` with the new canonical `EngineProvider` + `corePlugin()` quickstart example. *(PM-authored artifact)*

### Regression Surface

The highest regression risk areas are:

1. **EngineInputRegion refactor (Section 9.2)** — removing the `engine` prop and reading from
   context is a behaviour change. If `EngineInputRegion` is used outside `EngineProvider`, it
   will now throw instead of accepting an injected engine. Verify all usages are inside a
   provider.

2. **erroredWidgets split (Section 6.2)** — widgets that previously failed and were permanently
   blacklisted will now be retried on scene change. This is intentional but could surface
   previously suppressed errors. Watch the error callbacks during test runs.

3. **Cache clearance removal (Section 6.1)** — the first run after any EngineProvider unmount
   will now keep stale cache entries. This is safe because cache keys include content hashes,
   but memory usage should be monitored in the docs app (many engines, many scenes).

---

## 11. Implementation Order

Execute phases in this order within a single feature branch:

1. **Phase 2 (Dead code)** first — zero risk, no dependencies
2. **Phase 1 (ScenePlayer deletion + EngineGate)** — depends on nothing being alive that ScenePlayer references
3. **Phase 4 (Runtime/state fixes)** — independent of type changes
4. **Phase 3 (Type system)** — after runtime stable; type changes will surface errors to fix
5. **Phase 5 (Widget SDK)** — extends Phase 3 contracts
6. **Phase 6 (Package surface)** — last, after all internals are stable

Each phase should typecheck before moving to the next.

---

## 12. Parallel Developer Workstreams

The phases can be parallelized across three independent streams. **No two streams touch the same file.** Stream A must complete before Stream D begins; Stream B must complete before Stream E begins.

### Stream A — Dead Code + ScenePlayer/EngineGate (Phases 2 & 1)

Files owned exclusively by this stream:
- `player/ScenePlayer.tsx` (DELETE)
- `player/EngineGate.tsx` (CREATE)
- `player/__tests__/EngineGate.test.tsx` (CREATE)
- `player/engineTypes.ts` (MODIFY — add tickIndex to EngineState)
- `player/EngineStateContext.ts` (MODIFY — fix error message)
- `player/EngineScrollRegion.tsx` (DELETE)
- `player/defaultWidgets.ts` (DELETE)
- `compiler/identityFn.ts` (CREATE)
- `compiler/primitives/progressManager.ts` (MODIFY — IDENTITY_FN import)
- `compiler/sceneTrackCompiler.ts` (MODIFY — IDENTITY_FN import)
- `compiler/__tests__/buildProgressProfile.test.ts` (MODIFY — IDENTITY_FN import)
- `compiler/primitives/Background.tsx` et al (DELETE 5 files + index.ts)
- `player/SceneProgressMapper.ts` (MODIFY — re-export IDENTITY_FN)

**Touches `player/index.ts` and `player/EngineProvider.tsx`** — these are multi-stream files
that Stream A must edit first. Stream D continues editing them later.

### Stream B — Type System (Phase 3)

Files owned exclusively by this stream:
- `widget/types.ts` (MODIFY — TExtra, AssetManifest canonical, ISceneElement docs)
- `widget/WidgetRegistry.ts` (MODIFY — IHasCustomDslHandler, hasCustomDslHandler, isRenderable guard)
- `widget/index.ts` (MODIFY — add exports)
- `runtime/RuntimeDriver.ts` (MODIFY — remove local AssetManifest, import from widget/types)
- `widget/__tests__/ISceneElementTExtra.test.ts` (CREATE)
- `widget/__tests__/CustomDslHandler.test.ts` (CREATE)
- All widget files implementing CUSTOM_NODE_HANDLER (add `implements IHasCustomDslHandler`)

**Does not touch EngineProvider, index.ts, or camera files.**

### Stream C — Camera Split (Phase 4, camera files only)

Files owned exclusively by this stream:
- `elements/camera/render.ts` (MODIFY — remove CameraControlsDriver class)
- `elements/camera/CameraControlsDriver.ts` (CREATE)
- `elements/camera/CameraWidget.ts` (MODIFY — update import path)

**Fully independent. No dependencies on Streams A or B.**

### Stream D — EngineProvider Cleanup + Runtime Fixes (Phase 4, non-camera)

**Gate: Stream A must complete first** (Stream A leaves `EngineProvider.tsx` in a consistent
state after removing `defaultWidgets` and `widgetSetup`).

Files owned by this stream (continuing from Stream A's EngineProvider edits):
- `player/EngineProvider.tsx` (MODIFY — remove clearCache, remove SceneMetaWidget direct coupling)
- `runtime/RuntimeDriver.ts` (MODIFY — split erroredWidgets, add applyErroredWidgets.clear() on scene change)
- `runtime/__tests__/ErrorRecovery.test.ts` (CREATE)

**Does not conflict with Stream B's RuntimeDriver changes** — Stream B removes a local type
declaration; Stream D adds the error set split. These are different parts of the file and can
be merged, or coordinated by sequencing Stream B before Stream D.

### Stream E — Widget SDK Extensions (Phase 5)

**Gate: Stream B must complete first** (Stream E extends the types Stream B establishes).

Files owned by this stream:
- `widget/types.ts` (MODIFY — ISceneLifecycle, IAnimationController JSDoc)
- `widget/WidgetRegistry.ts` (MODIFY — isSceneLifecycle, getSceneLifecycleWidgets, requiresTypeProp guard)
- `widget/index.ts` (MODIFY — add ISceneLifecycle exports)
- `runtime/RuntimeDriver.ts` (MODIFY — sceneLifecycleWidgets field, tick() lifecycle hooks)
- `runtime/__tests__/SceneLifecycle.test.ts` (CREATE)
- `widget/__tests__/requiresTypeProp.test.ts` (CREATE)

### Stream F — Package Surface (Phase 6)

**Gate: All other streams must complete first.**

Files owned by this stream:
- `player/index.ts` (MODIFY — full reorganization into stable groups)
- `core/src/index.ts` (MODIFY — add/remove exports)
- `core/package.json` (MODIFY — exports sub-paths, sideEffects: false)
- All apps migration files (Sections 9.2–9.7)

### Sequencing Summary

```
Stream A ──────────────────────────────────────────────────► Stream D ──────────────► Stream F
Stream B ──────────────────────────────────────────────────► Stream E ──────────────► (gates F)
Stream C ──────────────────────────────────────────────────────────────────────────► (gates F)
```

Streams A, B, and C can run in parallel from the start. Stream D gates on A. Stream E gates on
B. Stream F gates on all five completing and typecheck passing.
