---
title: DiagramCanvasWidget Pre-Registration Fix
doc_type: plan
owner: brewsite-architect
status: active
updated: 2026-03-02
---

# DiagramCanvasWidget Pre-Registration Fix

## Root Cause

`DiagramCanvasWidget` instances are auto-registered **during scene compilation** inside the `Diagram` and `DiagramCanvas` node handlers in `packages/diagram/src/compiler/handlers.ts`. The handlers capture a `registry` argument and call `registry.register(new DiagramCanvasWidget(...))` when they encounter a canvas ID that is not yet present in the registry.

`RuntimeDriverImpl.initialize()` (in `packages/core/src/runtime/RuntimeDriver.ts`, lines 84–115) calls `initialize()` on every widget returned by `this.widgetRegistry.getRenderables()`. This list is snapshot at `RuntimeDriverImpl` **construction time** (line 76): `this.renderables = this.widgetRegistry.getRenderables()`. The constructor runs before scene compilation. Widgets registered after construction — which includes all auto-registered `DiagramCanvasWidget` instances — are never added to `this.renderables`, so `initialize()` is never called on them.

The consequence: `DiagramCanvasWidget.initialize()` sets `this.scene` (line 77 of `canvas/widget.ts`). Without it, `this.scene` is `null`. Every call to `apply()` checks `if (!this.scene) return;` (line 159) and silently no-ops. Nothing is added to the Three.js scene graph. The canvas renders blank.

`diagramPlugin.createWidgets()` currently returns `[]`, which is the root of the problem. No `DiagramCanvasWidget` exists in the registry at construction time. The fix is to move widget creation into `createWidgets()` by requiring callers to declare their canvas IDs up front.

## Design Principle

Node handlers are pure state transformers: they read DSL props and call `api.setWidgetState()`. They must not create or register widgets as a side effect. Widget creation belongs in `createWidgets()`, which is called before the runtime is constructed and before `initialize()` runs.

## Complete Canvas ID Inventory

The following `<DiagramCanvas id="...">` values are used across the website app. These are the exact string IDs that must be passed to `diagramPlugin()`.

| Scene file | Canvas ID |
|---|---|
| `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx` | `"presentation-flow"` |
| `apps/website/src/scenes/act1_act2/scene_02_core_baked.tsx` | `"presentation-flow"` |
| `apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx` | `"simple-tech-stack"` |
| `apps/website/src/scenes/act5_act6/scene_02_arch_overview.tsx` | `"system-canvas"` |
| `apps/website/src/scenes/act5_act6/scene_03_arch_detail.tsx` | `"system-canvas"` |
| `apps/website/src/scenes/act7/scene_02_combined.tsx` | `"full-diagram"` |

Note that `"presentation-flow"` is reused across scenes 01 and 02. `"system-canvas"` is reused across scenes 02 and 03. One `DiagramCanvasWidget` per unique ID is created; it receives different compiled state on each scene tick.

The docs app (`apps/docs/src/`) has **no `DiagramCanvas` or `diagramPlugin` usage** — confirmed by grep. No changes are needed there.

---

## Changes Required

### 1. `packages/diagram/src/player/diagramPlugin.ts`

This is the primary change. The file currently looks like:

```typescript
export function diagramPlugin(): WidgetPlugin {
  return {
    createWidgets: () => [],
    registerHandlers: () => { registerDiagramHandlers(); },
    configureRegistry: (registry: WidgetRegistry) => {
      registerDiagramHandlers(registry);
    },
  };
}
```

**Replace entirely with the following shape:**

```typescript
export type DiagramPluginOptions = {
  /**
   * The widgetIds of every DiagramCanvas (or standalone Diagram) used in the
   * scene DSL. A DiagramCanvasWidget is created for each ID and returned from
   * createWidgets() so the runtime can call initialize() on them before
   * scene compilation runs.
   *
   * Use the id prop value exactly as written in the JSX:
   *   <DiagramCanvas id="my-canvas"> → canvases: ['my-canvas']
   *   <Diagram id="my-diagram">      → canvases: ['my-diagram']
   */
  canvases: readonly string[];
};

/**
 * WidgetPlugin for @brewsite/diagram.
 *
 * Pass the id of every <DiagramCanvas> or standalone <Diagram> used in your
 * scene DSL. The plugin creates one DiagramCanvasWidget per ID and returns
 * them from createWidgets() so the runtime initializes them before playback.
 *
 * @example
 * plugins={[
 *   corePlugin(),
 *   modelPlugin({ manifestUrl: '...' }),
 *   diagramPlugin({ canvases: ['my-canvas', 'detail-canvas'] }),
 * ]}
 */
export function diagramPlugin(options: DiagramPluginOptions): WidgetPlugin {
  const { canvases } = options;

  return {
    createWidgets: () => {
      return canvases.map((id) => {
        const defaultState = compileCanvas({ id }, [], []);
        return new DiagramCanvasWidget(id, defaultState);
      });
    },

    registerHandlers: () => {
      registerDiagramHandlers();
    },

    configureRegistry: () => {
      // No-op. Handler registration happened in registerHandlers().
      // Auto-registration of widgets no longer happens here — widgets
      // are created in createWidgets() and are already in the registry
      // by the time configureRegistry() is called.
    },
  };
}
```

**Imports to add** (in addition to the existing `registerDiagramHandlers` import):

```typescript
import { compileCanvas } from '../elements/diagram/canvas/compile';
import { DiagramCanvasWidget } from '../elements/diagram/canvas/widget';
import type { WidgetPlugin } from '@brewsite/core';
```

The `WidgetRegistry` import is no longer needed and must be removed from the import list.

**Key behavioral changes from this file:**

- `createWidgets()` now returns one `DiagramCanvasWidget` per ID. These instances are in the registry before `RuntimeDriverImpl` is constructed, so `initialize()` is called on them at engine startup.
- `configureRegistry()` becomes a no-op (or can be removed entirely since the field is optional on `WidgetPlugin`). The old `configureRegistry` was calling `registerDiagramHandlers(registry)` to install registry-capturing handlers for auto-registration. Since auto-registration is gone, this re-invocation is unnecessary.
- `registerHandlers()` still calls `registerDiagramHandlers()` (no registry argument). This installs the handlers used during compilation. The handlers no longer perform widget creation.
- `options` is required (not optional). Callers must explicitly list their canvas IDs. If a canvas is used in DSL without a corresponding pre-registered widget, the runtime will emit a `MISSING_WIDGET` compile warning via `api.pushWarning()` (existing behavior from `WidgetRegistry.register()` routing path). This is the correct failure mode — an explicit warning rather than silent blank rendering.

### 2. `packages/diagram/src/compiler/handlers.ts`

Remove the `registry` parameter and all auto-registration blocks. The `DiagramCanvasWidget` import is no longer needed in this file.

**Change the function signature** from:

```typescript
export const registerDiagramHandlers = (registry?: WidgetRegistry): void => {
```

to:

```typescript
export const registerDiagramHandlers = (): void => {
```

**Remove the `WidgetRegistry` type import** from `@brewsite/core` (line 6). If `WidgetRegistry` is used nowhere else in the file, the entire import line is removed. Verify: `WidgetRegistry` is used only in the function signature — the import line is `import type { WidgetRegistry } from '@brewsite/core';` on line 6. Remove it.

**Remove the `DiagramCanvasWidget` import** on line 28:

```typescript
import { DiagramCanvasWidget } from '../elements/diagram/canvas/widget';
```

This import is only used in the auto-registration blocks. After removing those blocks it is unused.

**In the `Diagram` handler** (currently lines 230–258), remove the auto-registration block in its entirety:

```typescript
// REMOVE THIS BLOCK:
// Auto-register a DiagramCanvasWidget when registry is available.
// This is the Finding 3 "Option A" collapse: standalone <Diagram> routes through
// DiagramCanvasWidget, unifying the runtime path.
if (registry && !registry.get(canvasId)) {
  const initialState = compileCanvas({ id: canvasId }, [], []);
  registry.register(new DiagramCanvasWidget(canvasId, initialState));
}
```

After removal the `Diagram` handler body is:

```typescript
registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const onWarn = makeWarnFn(api);
  const dsl = extractDiagramDSL(node, helpers, onWarn);
  const diagramState = compileDiagram(dsl, undefined, onWarn);
  const canvasId = dsl.id;

  // Wrap the single diagram in a canvas state — DiagramCanvasWidget expects DiagramCanvasState.
  const canvasState = compileCanvas(
    {
      id: canvasId,
      position: dsl.position,
      rotation: dsl.rotation,
      scale: dsl.scale,
    },
    [diagramState],
    [],
    onWarn,
  );

  api.setWidgetState(canvasId, canvasState);
});
```

**In the `DiagramCanvas` handler** (currently lines 260–303), remove the auto-registration block in its entirety:

```typescript
// REMOVE THIS BLOCK:
if (canvasId && registry && !registry.get(canvasId)) {
  // Auto-register a DiagramCanvasWidget with a minimal empty default state.
  // The runtime will replace this with the compiled state from the SceneTrack on the first tick.
  const initialState = compileCanvas({ id: canvasId }, [], []);
  registry.register(new DiagramCanvasWidget(canvasId, initialState));
}
```

After removal the `DiagramCanvas` handler begins:

```typescript
registerNode(DiagramCanvas, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const props = node.props as Record<string, unknown>;
  const allChildren = helpers.collectChildren(node);
  const canvasTheme = props.theme as DiagramTheme | undefined;
  const onWarn = makeWarnFn(api);

  // ... rest of the handler unchanged (DiagramState collection, compilePipe, compileCanvas, setWidgetState)
```

Note that `const canvasId = typeof props.id === 'string' ? props.id : undefined;` on the old line 262 was only used for the auto-registration guard. After the guard block is removed, `canvasId` is no longer needed at the top of the handler. The handler already uses `String(props.id)` in the `api.setWidgetState` call at the bottom. Remove the `canvasId` local variable declaration as well.

**The `makeWarnFn` helper** at the top of `registerDiagramHandlers` (lines 215–220) is still needed — it is used in all four handlers. Do not remove it.

**Remove the `compileCanvas` import** from `canvas/compile` if it is only referenced in the removed auto-registration blocks. Check: `compileCanvas` is also used in the body of the `DiagramCanvas` handler (line 301: `const canvasState = compileCanvas(canvasDSL, diagramStates, pipeDSLs, onWarn);`) and in the `Diagram` handler (the `canvasState` wrapping call). The import stays.

**Update the JSDoc comment** on `registerDiagramHandlers` (lines 207–213) to remove the mention of the `registry` parameter:

```typescript
/**
 * @internal
 * Registers all diagram DSL node handlers with the @brewsite/core compiler registry.
 * Called automatically at module-load time via packages/diagram/src/register.ts.
 * Not part of the public @brewsite/diagram API.
 * Test files that call clearRegistry() must import and re-call this directly.
 */
export const registerDiagramHandlers = (): void => {
```

### 3. `apps/website/src/widgetSetup.ts`

Pass the `canvases` option to `diagramPlugin()`. The unique canvas IDs across all website scenes are:

- `"presentation-flow"` (used in scenes 01 and 02 of act1_act2)
- `"simple-tech-stack"` (used in act5_act6 scene 01)
- `"system-canvas"` (used in act5_act6 scenes 02 and 03)
- `"full-diagram"` (used in act7 scene 02)

The updated file:

```typescript
import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import type { WidgetPlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { NeonSignWidget } from './widgets/neon-sign';

/**
 * Returns the WidgetPlugin array for the website engine.
 * Pass to EngineProvider's `plugins` prop.
 *
 * Canvas IDs must match the id prop on every <DiagramCanvas> or standalone
 * <Diagram> element used in the website scene DSL.
 */
export function createWebsitePlugins(manifestUrl: string): WidgetPlugin[] {
  return [
    corePlugin(),
    modelPlugin({ manifestUrl }),
    diagramPlugin({
      canvases: [
        'presentation-flow',
        'simple-tech-stack',
        'system-canvas',
        'full-diagram',
      ],
    }),
    {
      createWidgets: () => [
        new NeonSignWidget(),
      ],
      registerHandlers: () => {},
    },
  ];
}
```

### 4. `packages/diagram/src/index.ts`

**Export audit.** The following symbols referenced by the fix must be exported from `packages/diagram/src/index.ts`:

| Symbol | Currently exported? | Action |
|---|---|---|
| `diagramPlugin` | Yes — line 68 | No change needed |
| `DiagramCanvasWidget` | Yes — line 94 | No change needed |
| `DiagramPluginOptions` | No | Add a `export type { DiagramPluginOptions }` line adjacent to the `diagramPlugin` export on line 68 |
| `compileCanvas` | Yes — line 92 | No change needed (used internally in the plugin, not needed by callers) |

The only addition needed is `DiagramPluginOptions`. Callers who want to annotate the options object explicitly (e.g., in a separate `widgetConfig.ts` file) need the type available from the public API.

Update line 68 from:

```typescript
export { diagramPlugin } from './player/diagramPlugin';
```

to:

```typescript
export { diagramPlugin } from './player/diagramPlugin';
export type { DiagramPluginOptions } from './player/diagramPlugin';
```

No other exports need to change.

### 5. `packages/diagram/src/register.ts`

This file calls `registerDiagramHandlers()` at module-load time as a side effect. After the signature change to remove the optional `registry` parameter, the call site is already correct — it passes no arguments. No change required.

---

## Test Strategy

### Tests that must be updated

**`packages/diagram/src/compiler/__tests__/autoRegistration.test.ts`**

This file tests the auto-registration behavior that is being removed. All three tests in this file test `registerDiagramHandlers(registry)` auto-registering a `DiagramCanvasWidget` into the registry during `compileSceneTrack`. After the change:

- `registerDiagramHandlers` no longer accepts a `registry` argument.
- The auto-registration blocks are removed.
- These three tests now describe behavior that no longer exists and will fail to compile.

**Action:** Delete the file `packages/diagram/src/compiler/__tests__/autoRegistration.test.ts` in its entirety. The behavior it tested (auto-registration during compilation) is no longer part of the system contract. The new contract is tested by the test described below.

**`packages/diagram/src/compiler/__tests__/handlers.test.tsx`**

The fourth test in this file (`'auto-registers DiagramCanvasWidget when DiagramCanvas id is not in registry'`, lines 101–130) tests the exact auto-registration behavior being removed. It calls `registerDiagramHandlers(registry)` with a registry and asserts that after `compileSceneTrack` the registry contains a `DiagramCanvasWidget`.

**Action:** Remove the fourth test block (lines 101–130). The first three tests (`compiles diagram/image-panel/screen widgets into frame state`, `captures nested groups with parentId and node membership`, `ignores GridLayout that appears at scene top-level`) remain valid and must not be changed.

Also update the call to `registerDiagramHandlers(registry)` in the remaining three tests. Currently each test constructs a `WidgetRegistry` and passes it to `registerDiagramHandlers(registry)`. After the signature change the argument is removed. Each call site becomes `registerDiagramHandlers()`.

The three tests also construct `new WidgetRegistry()` only to pass to `registerDiagramHandlers`. After the change, `registerDiagramHandlers` no longer takes the registry, but the `resolveSceneFromDsl` calls still need it as the second argument. The `registry` variable remains in each test for that purpose. No removal of the registry construction is needed — just remove it from the `registerDiagramHandlers` call.

### New test to add

**File:** `packages/diagram/src/player/__tests__/diagramPlugin.test.ts`

This test does not yet exist. Create it. It verifies the primary fix: that `diagramPlugin()` returns `DiagramCanvasWidget` instances from `createWidgets()` with the correct IDs and default states, and that those widgets have a `scene` property available after `initialize()` is called on them (i.e., `initialize()` is now reachable because the widget exists in the registry at construction time).

The test file must cover the following cases:

**Case 1: `createWidgets()` returns one widget per canvas ID.**

Construct `diagramPlugin({ canvases: ['canvas-a', 'canvas-b'] })` and call `createWidgets()`. Assert the returned array has length 2. Assert each element is an instance of `DiagramCanvasWidget`. Assert `widget.widgetId` matches the corresponding canvas ID. Assert `widget.defaultState.id` matches the canvas ID (since `compileCanvas({ id }, [], [])` sets `id` on the state).

**Case 2: `createWidgets()` with an empty canvas list returns an empty array.**

Construct `diagramPlugin({ canvases: [] })` and call `createWidgets()`. Assert the result is an empty array.

**Case 3: `registerHandlers()` is callable without error.**

Call `registerHandlers()` and assert it does not throw. This ensures the no-arg `registerDiagramHandlers()` path is exercised. Use `beforeEach` with `clearRegistry()` and `resetCoreHandlerRegistrationForTesting()` to reset global state before each test (follow the same pattern as `autoRegistration.test.ts`).

**Case 4: DSL compilation writes `DiagramCanvasState` keyed by canvas ID.**

After calling `registerHandlers()`, compile a minimal scene using `compileSceneTrack` that contains `<DiagramCanvas id="canvas-a">`. Pre-register a `DiagramCanvasWidget('canvas-a', ...)` into the registry (as `createWidgets()` would do). Assert that the compiled `SceneTrack` ticks have `state.widgets['canvas-a']` present and that its `diagrams` array is populated from the DSL. This confirms the handler correctly writes state even without auto-registration.

Import pattern for the new test file:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetRegistry } from '@brewsite/core';
import { clearRegistry } from '../../../../core/src/compiler/registry';
import { resetCoreHandlerRegistrationForTesting } from '../../../../core/src/compiler/coreHandlers';
import { diagramPlugin } from '../diagramPlugin';
import { DiagramCanvasWidget } from '../../elements/diagram/canvas/widget';
```

The test file lives at `packages/diagram/src/player/__tests__/diagramPlugin.test.ts`. Create the `__tests__` directory under `packages/diagram/src/player/` if it does not already exist.

---

## Execution Order for the Implementing Developer

Implement changes in this exact order to keep the build valid at each step:

1. **`handlers.ts`** — Remove the `registry` parameter, the `WidgetRegistry` import, the `DiagramCanvasWidget` import, and both auto-registration blocks. The function now takes no arguments. All existing call sites that pass `registry` will immediately produce TypeScript errors, which guides the next steps.

2. **`register.ts`** — Already calls `registerDiagramHandlers()` with no argument. No change needed. Verify the file still compiles.

3. **`diagramPlugin.ts`** — Replace the entire file body with the new implementation. Add imports for `compileCanvas` and `DiagramCanvasWidget`. Remove the `WidgetRegistry` import. Implement `createWidgets()` to construct widgets from `options.canvases`.

4. **`packages/diagram/src/index.ts`** — Add the `DiagramPluginOptions` type export adjacent to the `diagramPlugin` export.

5. **`apps/website/src/widgetSetup.ts`** — Pass the `canvases` array to `diagramPlugin()`.

6. **Test file deletions and updates** — Delete `autoRegistration.test.ts`. Update `handlers.test.tsx` as described above (remove the fourth test, remove the `registry` argument from `registerDiagramHandlers` call sites in the remaining three tests).

7. **New test file** — Create `packages/diagram/src/player/__tests__/diagramPlugin.test.ts` with the four cases described above.

8. **Run the full test suite** for `@brewsite/diagram`:
   ```
   pnpm --filter @brewsite/diagram test
   ```
   All tests must pass. TypeScript strict mode must pass:
   ```
   pnpm --filter @brewsite/diagram typecheck
   ```

---

## What Must NOT Change

- The `extractDiagramDSL` function in `handlers.ts` is unchanged.
- The `ImagePanel` and `Screen` handlers in `handlers.ts` are unchanged. They do not auto-register widgets and are unaffected.
- The `DiagramCanvasWidget` class itself is unchanged. No modifications to `canvas/widget.ts`.
- The `compileCanvas` function signature is unchanged.
- The `DiagramWidget` class (`elements/diagram/widget.ts`) is unchanged and continues to exist. It is not used in the website flow (the `DiagramCanvasWidget` is the unified path) but it remains available for callers who register it directly.
- `packages/diagram/src/register.ts` is unchanged.
- `packages/core/src/runtime/RuntimeDriver.ts` is unchanged. The fix works by ensuring widgets exist in the registry before `RuntimeDriverImpl` is constructed, not by changing when `initialize()` is called.
- The docs app (`apps/docs/`) does not use `DiagramCanvas` and requires no changes.

---

## Migration Note for Future Callers

Any application that adds a new `<DiagramCanvas id="...">` or standalone `<Diagram id="...">` to its scene DSL must also add that ID to the `canvases` array in its `diagramPlugin()` call. If the ID is missing, the engine will emit a `MISSING_WIDGET` compile warning and the canvas will render blank. The warning message (already implemented in `WidgetRegistry`) is:

```
No registered widget found for DSL element with id="<canvas-id>".
Ensure a widget with this ID is registered in widgetSetup.ts before this scene compiles.
```

This is a developer-time failure with a clear error message, which is preferable to the current silent blank canvas.
