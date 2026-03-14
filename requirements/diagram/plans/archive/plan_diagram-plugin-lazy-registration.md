---
title: "diagramPlugin Lazy Widget Registration"
doc_type: plan
status: ready
owner: Toolkit Product
last_updated: 2026-03-14
change_history:
  - date: 2026-03-14
    author: Toolkit PM
    summary: "Initial plan. Eliminates the required diagrams[] pre-declaration from diagramPlugin() by adopting lazy DiagramWidget creation on first DSL encounter during compilation, matching the modelPlugin pattern."
---

# Plan: diagramPlugin Lazy Widget Registration

## Goal

Remove the required `diagrams: string[]` pre-declaration from `diagramPlugin()`. `DiagramWidget` instances are created on first encounter of a `<Diagram id="...">` node during compilation, so consumers call `diagramPlugin()` with no arguments.

This eliminates a DX papercut: every diagram ID in the DSL had to be manually copied into `widgetSetup.ts` and kept in sync as scenes changed. The lazy approach matches how `modelPlugin` works.

---

## Architecture Context

### The enabler: compiler registry Map.set is idempotent by overwrite

`packages/core/src/compiler/registry.ts` stores handlers in a `Map<unknown, NodeHandler>`. Calling `registerNode(component, handler)` calls `Map.set`, which silently overwrites any previously registered handler for that component. This means `registerDiagramHandlers(registry)` called in `configureRegistry()` will replace the baseline `Diagram` handler (installed at module-load time via `register.ts`) with a registry-aware version. No special deregistration is needed.

### Registry freeze timing

`WidgetRegistry.register()` is valid during compilation (before `freeze()` is called). The sequence in the engine is:

1. Plugin `createWidgets()` → widgets registered into `WidgetRegistry`
2. Plugin `configureRegistry(registry)` called (this is where we install the registry-aware handler)
3. `compileSceneTrack()` runs — `Diagram` handler fires, lazily calls `registry.register(new DiagramWidget(...))`
4. `registry.freeze()` called
5. `RuntimeDriverImpl.initialize()` called

Lazy widget creation at step 3 is therefore safe.

### Why registerTypeFactory cannot be used

`WidgetRegistry.registerTypeFactory` requires both `type` and `id` props on the DSL node. `<Diagram>` only has `id`. The Diagram handler is also custom — it calls `compileDiagram()` and `api.setWidgetState()` directly rather than going through the default shallow-merge path. The solution is to extend the existing custom handler, not replace it with a factory.

### Module-load side-effect in register.ts

`packages/diagram/src/register.ts` calls `registerDiagramHandlers()` (no registry argument) at module-load time. This installs the baseline Diagram handler and all child component handlers. When `configureRegistry(registry)` fires, it calls `registerDiagramHandlers(registry)` — the `Map.set` overwrite replaces only the `Diagram` handler with the registry-aware version. Child component handlers (DiagramNode, DiagramEdge, etc.) are re-registered with identical noop handlers — no functional change.

---

## Files to Modify

Three files change. No other files require modification.

```
packages/diagram/src/compiler/handlers.ts       — add WidgetRegistry param + lazy widget creation
packages/diagram/src/player/diagramPlugin.ts    — make options optional, empty createWidgets, wire configureRegistry
apps/examples/src/*/widgetSetup.ts              — remove diagrams arrays (7 files)
```

No changes to `register.ts`, `index.ts`, or any test file.

---

## Step 1: `packages/diagram/src/compiler/handlers.ts`

### 1a. Add imports

Add at the top of the import block, after existing imports:

```typescript
import type { WidgetRegistry } from '@brewsite/core';
import { DiagramWidget } from '../elements/diagram/widget';
import { buildThemeRenderConfig } from '../elements/diagram/compiler/themeResolver';
import { defaultDiagramTheme } from '../elements/diagram/themes';
import type { DiagramState } from '../elements/diagram/types';
```

`DiagramWidget` is already imported from `'../elements/diagram/widget'` for the DSL stub symbols. If this import already covers `DiagramWidget`, verify — the existing import imports `Diagram`, `DiagramNode`, etc. from that module. Add `DiagramWidget` to the named import list if the class is exported from that module, or add a separate import if it is not currently listed.

Check the existing import:
```typescript
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  DiagramExit,
  DiagramEnter,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  FlowLayout,
} from '../elements/diagram/widget';
```

Add `DiagramWidget` to this list:
```typescript
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  DiagramExit,
  DiagramEnter,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  FlowLayout,
  DiagramWidget,
} from '../elements/diagram/widget';
```

Also add:
```typescript
import type { WidgetRegistry } from '@brewsite/core';
import { buildThemeRenderConfig } from '../elements/diagram/compiler/themeResolver';
import { defaultDiagramTheme } from '../elements/diagram/themes';
import type { DiagramState } from '../elements/diagram/types';
```

### 1b. Add makeDefaultDiagramState helper

Add this function immediately before `registerDiagramHandlers`. It must be a module-level function, not inside `registerDiagramHandlers`, so it can be called from the handler closure without capturing scope accidentally:

```typescript
function makeDefaultDiagramState(id: string): DiagramState {
  return {
    id,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    z: 0,
    scale: 1,
    contentAspect: 1.0,
    nodes: [],
    edges: [],
    groups: [],
    exit: undefined,
    enter: undefined,
    themeConfig: buildThemeRenderConfig(defaultDiagramTheme),
  };
}
```

### 1c. Change registerDiagramHandlers signature

Change from:
```typescript
export const registerDiagramHandlers = (): void => {
```

To:
```typescript
export const registerDiagramHandlers = (registry?: WidgetRegistry): void => {
```

The `registry` parameter is optional. All existing call sites that pass no argument continue to work without change.

### 1d. Add lazy widget creation inside the Diagram handler

Inside the `registerNode(Diagram, ...)` call, add the lazy creation block immediately before `api.setWidgetState(dsl.id, diagramState)`. The insertion point is after the `if (viewOpacity < 1)` block closes.

Current tail of the handler (lines 288–301):
```typescript
    if (viewOpacity < 1) {
      diagramState = {
        ...diagramState,
        nodes: diagramState.nodes.map((n) => ({ ...n, opacity: n.opacity * viewOpacity })),
        edges: diagramState.edges.map((e) => ({ ...e, opacity: e.opacity * viewOpacity })),
        groups: diagramState.groups.map((g) => ({
          ...g,
          fillOpacity: g.fillOpacity * viewOpacity,
          borderOpacity: g.borderOpacity * viewOpacity,
        })),
      };
    }

    api.setWidgetState(dsl.id, diagramState);
```

Replace with:
```typescript
    if (viewOpacity < 1) {
      diagramState = {
        ...diagramState,
        nodes: diagramState.nodes.map((n) => ({ ...n, opacity: n.opacity * viewOpacity })),
        edges: diagramState.edges.map((e) => ({ ...e, opacity: e.opacity * viewOpacity })),
        groups: diagramState.groups.map((g) => ({
          ...g,
          fillOpacity: g.fillOpacity * viewOpacity,
          borderOpacity: g.borderOpacity * viewOpacity,
        })),
      };
    }

    // Lazily create and register a DiagramWidget when the plugin provides a registry
    // and no widget for this ID has been registered yet.
    if (registry && !registry.get(dsl.id)) {
      registry.register(new DiagramWidget(dsl.id, makeDefaultDiagramState(dsl.id)));
    }

    api.setWidgetState(dsl.id, diagramState);
```

### 1e. Complete modified registerDiagramHandlers function

For reference, the full updated function signature and the changed region only (all other lines are identical to the current file):

```typescript
export const registerDiagramHandlers = (registry?: WidgetRegistry): void => {
  // ... makeWarnFn, child noop handlers — unchanged ...

  registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
    // ... extractDiagramDSL, resolveDiagramTheme, composeBounds, composeZ,
    //     composeOpacity, compileDiagram, viewOpacity block — unchanged ...

    // NEW: lazy widget creation
    if (registry && !registry.get(dsl.id)) {
      registry.register(new DiagramWidget(dsl.id, makeDefaultDiagramState(dsl.id)));
    }

    api.setWidgetState(dsl.id, diagramState);  // unchanged position
  });
};
```

---

## Step 2: `packages/diagram/src/player/diagramPlugin.ts`

### 2a. Update imports

Remove imports that move to `handlers.ts`:
- `buildThemeRenderConfig` from `'../elements/diagram/compiler/themeResolver'`
- `defaultDiagramTheme` from `'../elements/diagram/themes'`
- `DiagramState` type from `'../elements/diagram/types'`

Add `WidgetRegistry` to the core import:
```typescript
import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
```

Final import block:
```typescript
import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../compiler/handlers';
import { DiagramWidget } from '../elements/diagram/widget';
```

### 2b. Update DiagramPluginOptions

Replace the current type definition:
```typescript
export type DiagramPluginOptions = {
  /**
   * The widget IDs of every <Diagram> used in the scene DSL.
   * A DiagramWidget is created for each ID.
   *
   * Use the id prop value exactly as written in the JSX:
   *   <Diagram id="my-diagram"> → diagrams: ['my-diagram']
   */
  diagrams: readonly string[];
};
```

With:
```typescript
export type DiagramPluginOptions = {
  /**
   * @deprecated Since v0.x. DiagramWidget instances are now created lazily on
   * first DSL encounter during compilation. This field is no longer needed and
   * will be removed in a future major release.
   *
   * Remove the `diagrams` array from your diagramPlugin() call:
   *   Before: diagramPlugin({ diagrams: ['my-diagram'] })
   *   After:  diagramPlugin()
   */
  diagrams?: readonly string[];
};
```

### 2c. Make options parameter optional

Change the function signature from:
```typescript
export function diagramPlugin(options: DiagramPluginOptions): WidgetPlugin {
```

To:
```typescript
export function diagramPlugin(options: DiagramPluginOptions = {}): WidgetPlugin {
```

### 2d. Add deprecation warning at the start of the function body

Add immediately after the opening brace of `diagramPlugin`:
```typescript
  if (options.diagrams && options.diagrams.length > 0) {
    console.warn(
      '[diagramPlugin] The `diagrams` option is deprecated and no longer needed. ' +
        'DiagramWidget instances are now created automatically on first DSL encounter. ' +
        'Remove the `diagrams` array from your diagramPlugin() call.',
    );
  }
```

### 2e. Replace createWidgets

Replace:
```typescript
    createWidgets(): DiagramWidget[] {
      return options.diagrams.map((id) => {
        const defaultState = makeDefaultDiagramState(id);
        return new DiagramWidget(id, defaultState);
      });
    },
```

With:
```typescript
    createWidgets(): DiagramWidget[] {
      // DiagramWidget instances are created lazily via the Diagram node handler
      // in configureRegistry(). No pre-declaration of diagram IDs is required.
      return [];
    },
```

### 2f. Keep registerHandlers unchanged

`registerHandlers()` stays as-is:
```typescript
    registerHandlers(): void {
      registerDiagramHandlers(); // baseline handler + child component handlers, no registry
    },
```

### 2g. Replace configureRegistry

Replace:
```typescript
    configureRegistry(): void {
      // No-op. Handler registration happened in registerHandlers().
      // Widgets are created in createWidgets() and already in the registry.
    },
```

With:
```typescript
    configureRegistry(registry: WidgetRegistry): void {
      // Re-register the Diagram handler with registry access for lazy widget creation.
      // registerNode() overwrites the baseline handler installed by registerHandlers()
      // (or register.ts side-effect) with this registry-aware version.
      registerDiagramHandlers(registry);
    },
```

### 2h. Remove makeDefaultDiagramState

Delete the entire `makeDefaultDiagramState` function from this file (lines 99–114 in the current file). It moves to `handlers.ts`.

### 2i. Complete resulting file

For verification, the full resulting `diagramPlugin.ts` after all changes:

```typescript
// Factory for the @brewsite/diagram WidgetPlugin.
// DiagramWidget instances are created lazily on first DSL encounter during compilation.

import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../compiler/handlers';
import { DiagramWidget } from '../elements/diagram/widget';

/**
 * Options for the @brewsite/diagram WidgetPlugin.
 */
export type DiagramPluginOptions = {
  /**
   * @deprecated Since v0.x. DiagramWidget instances are now created lazily on
   * first DSL encounter during compilation. This field is no longer needed and
   * will be removed in a future major release.
   *
   * Remove the `diagrams` array from your diagramPlugin() call:
   *   Before: diagramPlugin({ diagrams: ['my-diagram'] })
   *   After:  diagramPlugin()
   */
  diagrams?: readonly string[];
};

/**
 * WidgetPlugin for @brewsite/diagram.
 *
 * No configuration required. DiagramWidget instances are created automatically
 * for each <Diagram id="..."> encountered in the scene DSL during compilation.
 *
 * @example
 * plugins={[
 *   corePlugin(),
 *   modelPlugin({ manifestUrl: '...' }),
 *   diagramPlugin(),
 * ]}
 */
export function diagramPlugin(options: DiagramPluginOptions = {}): WidgetPlugin {
  if (options.diagrams && options.diagrams.length > 0) {
    console.warn(
      '[diagramPlugin] The `diagrams` option is deprecated and no longer needed. ' +
        'DiagramWidget instances are now created automatically on first DSL encounter. ' +
        'Remove the `diagrams` array from your diagramPlugin() call.',
    );
  }

  return {
    createWidgets(): DiagramWidget[] {
      // DiagramWidget instances are created lazily via the Diagram node handler
      // in configureRegistry(). No pre-declaration of diagram IDs is required.
      return [];
    },

    registerHandlers(): void {
      registerDiagramHandlers(); // baseline handler + child component handlers, no registry
    },

    configureRegistry(registry: WidgetRegistry): void {
      // Re-register the Diagram handler with registry access for lazy widget creation.
      // registerNode() overwrites the baseline handler installed by registerHandlers()
      // (or register.ts side-effect) with this registry-aware version.
      registerDiagramHandlers(registry);
    },

    getActionInputExtension(registry) {
      return {
        onUnknownAction: (type, canvasId, _event, extra) => {
          if (!canvasId) return;
          const widget = registry.get(canvasId);
          if (!widget || !('applyCanvasAction' in widget)) return;

          const dx = (extra['dx'] as number) ?? 0;
          const dy = (extra['dy'] as number) ?? 0;
          const speed = (extra['speed'] as number) ?? 1;

          switch (type) {
            case 'diagram-canvas.move':
              (widget as DiagramWidget).applyCanvasAction('move', dx, dy, speed);
              break;
            case 'diagram-canvas.rotate':
              (widget as DiagramWidget).applyCanvasAction('rotate', dx, dy, speed);
              break;
            case 'diagram-canvas.focus':
              (widget as DiagramWidget).applyCanvasAction(
                'focus', 0, 0, 1,
                extra['focusCenter'] as [number, number] | undefined,
              );
              break;
            case 'diagram-canvas.reset':
              (widget as DiagramWidget).applyCanvasAction('reset', 0, 0, 1);
              break;
          }
        },
      };
    },
  };
}
```

---

## Step 3: Consumer widgetSetup files

Update each of the seven `widgetSetup.ts` files that pass a `diagrams` array. In every case the change is identical: replace `diagramPlugin({ diagrams: [...] })` with `diagramPlugin()` and remove all elements of the `diagrams` array.

### 3a. `apps/examples/src/architecture/widgetSetup.ts`

```typescript
// Before:
diagramPlugin({
  diagrams: ['arch-content'],
}),

// After:
diagramPlugin(),
```

### 3b. `apps/examples/src/brewflow-comparison/widgetSetup.ts`

```typescript
// Before:
diagramPlugin({
  diagrams: [
    'cf-overview',
    'bf-overview',
    'audit-cf',
    'learn-diagram',
    'ctx-diagram',
    'coord-diagram',
    'restart-diagram',
    'gate-diagram',
    'safety-diagram',
    'mature-diagram',
  ],
}),

// After:
diagramPlugin(),
```

### 3c. `apps/examples/src/brewflow-memory/widgetSetup.ts`

```typescript
// Before:
diagramPlugin({
  diagrams: [
    'cls-diagram',
    'episodic-diagram',
    'somno-diagram',
    'neo-types',
    'neo-lifecycle',
    'inject-diagram',
    'loop-diagram',
    'guard-diagram',
  ],
}),

// After:
diagramPlugin(),
```

### 3d. `apps/examples/src/brewflow-multiuser/widgetSetup.ts`

```typescript
// Before:
diagramPlugin({
  diagrams: [
    'prob-diagram',
    'sess-diagram',
    'ep-diagram',
    'neo-diagram',
    'dream-diagram',
    'exp-diagram',
    'deb-diagram',
    'conv-diagram',
    'frac-diagram',
    'cross-diagram',
    'conf-diagram',
  ],
}),

// After:
diagramPlugin(),
```

### 3e. `apps/examples/src/brewflow-sidecar/widgetSetup.ts`

```typescript
// Before:
diagramPlugin({
  diagrams: [
    'surfaces-diagram',
    'bf-arch-cf',
    'bf-arch-sidecar',
    'mcp-tools',
    'seq-normal',
    'seq-fail',
    'dreamer-flow',
    'levels-diagram',
  ],
}),

// After:
diagramPlugin(),
```

### 3f. `apps/examples/src/whiteboard-arch/widgetSetup.ts`

```typescript
// Before:
diagramPlugin({
  diagrams: ['whiteboard-arch-diagram'],
}),

// After:
diagramPlugin(),
```

### 3g. `apps/examples/src/core-showcase/widgetSetup.ts`

```typescript
// Before:
diagramPlugin({
  diagrams: [
    'cs-overview-diagram',
    'cs-scene-dsl-diagram',
    'cs-compiler-diagram',
  ],
}),

// After:
diagramPlugin(),
```

In each file, after removing the `diagrams` array, also check whether the `diagramPlugin` import is still used. It will be — the call `diagramPlugin()` remains. No import changes are needed in the consumer files.

---

## Testing

No test files require modification. All existing tests call `registerDiagramHandlers()` with no arguments; the optional parameter is backward-compatible.

### Verification steps

1. Run the diagram package test suite:
   ```
   pnpm --filter @brewsite/diagram test
   ```
   All existing tests must pass without modification.

2. Run typecheck across the monorepo:
   ```
   pnpm typecheck
   ```
   No type errors. The `configureRegistry(registry: WidgetRegistry)` signature is compatible with the `WidgetPlugin` interface definition in `packages/core/src/widget/WidgetPlugin.ts`, which declares `configureRegistry?(registry: WidgetRegistry, manifest: AssetManifest | null): void`. Verify that the manifest parameter being absent from the implementation does not cause a TypeScript error — if it does, add `_manifest?: unknown` as an ignored second parameter.

3. Run the dev server and exercise at least one diagram scene end-to-end:
   ```
   pnpm dev
   ```
   Navigate to a diagram scene. Confirm the diagram renders correctly and no console errors appear.

4. Verify the deprecation warning fires when `diagrams` is passed: temporarily add a `diagrams` array back to one widgetSetup and confirm the `[diagramPlugin] The diagrams option is deprecated` message appears in the browser console.

### Regarding configureRegistry signature compatibility

The `WidgetPlugin` interface declares:
```typescript
configureRegistry?(registry: WidgetRegistry, manifest: AssetManifest | null): void;
```

The implementation in `diagramPlugin.ts` only uses `registry`. TypeScript allows implementing an interface method with fewer parameters — this is structurally valid. No change to the interface or the implementation signature is required.

---

## Rollback

If a regression is found post-merge:

1. Revert `handlers.ts` to the signature with no parameter and remove the lazy creation block.
2. Revert `diagramPlugin.ts` to the eager `createWidgets()` pattern.
3. Revert the consumer `widgetSetup.ts` files.

The consumer API change (`diagramPlugin()` with no args) is backward-compatible with the pre-change call (`diagramPlugin({ diagrams: [...] })`) because `diagrams` becomes optional, not removed. A rollback of just the library packages — without reverting the app call sites — is safe.

---

## What Does Not Change

- `packages/diagram/src/register.ts` — no change
- `packages/diagram/src/index.ts` — no change
- `packages/diagram/src/compiler/__tests__/handlers.inputConfig.test.ts` — no change
- `packages/diagram/src/compiler/__tests__/layoutRegistration.test.ts` — no change
- `packages/diagram/src/__tests__/warnThreading.test.ts` — no change
- All other `widgetSetup.ts` files not listed above — no change
- The `WidgetPlugin` interface in `@brewsite/core` — no change
- `WidgetRegistry` — no change
