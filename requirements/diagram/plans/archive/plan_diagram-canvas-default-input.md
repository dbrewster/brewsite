---
title: "DiagramCanvas Default Input Handlers via Theme"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-03
---

# Plan: DiagramCanvas Default Input Handlers via Theme

## Problem

Scene authors must repeat `<InputController scope="canvas">` with identical `<Action>` blocks
inside every `<Scene>` that contains a `<DiagramCanvas>`. For a seven-scene diagram sequence
this means seven identical blocks. The solution is to allow input defaults to be defined once
in `DiagramTheme.input` on the `<DiagramCanvas>` and have the engine apply them automatically
when no explicit `<InputController>` is present in a scene.

## Design (PM-agreed, 10 points — all honoured)

1. `DiagramTheme.input?: DiagramCanvasInputConfig` — authoring surface in `diagram/types.ts`
2. `DiagramCanvasInputConfig.defaultActions: ReadonlyArray<Omit<InputActionSpec, 'canvasId'>>` — canvasId auto-injected
3. `DiagramCanvasState.defaultInputActions?: ReadonlyArray<InputActionSpec>` — compiled output
4. Compile handler auto-injects `canvasId` in `handlers.ts`
5. Compiler warning `IGNORED_INPUT_CONFIG` when `theme.input` is on child `<Diagram>` (not `<DiagramCanvas>`)
6. `IInputDefaultProvider` interface in `packages/core/src/widget/types.ts`
7. `WidgetRegistry.getInputDefaultProviders()` — follows `getSceneElements()` / `getRenderables()` pattern
8. `DiagramCanvasWidget` implements `IInputDefaultProvider`; `apply()` updates `currentInputActions`
9. Player: `buildEffectiveInputSpec()` — explicit `<InputController>` wins entirely (replace-not-merge)
10. `defaultDiagramCanvasInputActions` exported constant from `@brewsite/diagram`

**Out of scope:** `diagram-canvas.dolly` InputActionType and keyboard dispatch gaps — tracked separately.

---

## Files to Modify

### 1. `packages/core/src/widget/types.ts`

**What:** Add `IInputDefaultProvider` interface.

**Where:** After the existing `IAttachmentHost` interface (≈ line 228), before `CompileExtraContext`.

**Add import** at top of file:

```typescript
import type { InputActionSpec } from '../input/types';
```

**Add interface:**

```typescript
/**
 * Widget that exposes default input actions to the player layer.
 *
 * Implemented by widgets (e.g. DiagramCanvasWidget) that carry input configuration
 * in their compiled state. The player calls getDefaultInputActions() each frame
 * after widget.apply() has been called to read the current scene's actions.
 *
 * CRITICAL: getDefaultInputActions() MUST return this.currentInputActions (a field
 * updated inside apply()), NOT a value derived from defaultState. defaultState is
 * constant after construction; currentInputActions reflects the live compiled state.
 */
export interface IInputDefaultProvider extends IWidget {
  getDefaultInputActions(): InputActionSpec[];
}
```

**Pure vs stateful:** The interface defines a stateful read (the widget's current runtime state).

---

### 2. `packages/core/src/widget/WidgetRegistry.ts`

**What:** Add `isInputDefaultProvider` type guard and `getInputDefaultProviders()` method.

**Add import** (extend the existing imports from `'./types'`):

```typescript
import type {
  IWidget, ISceneElement, IRenderable, ILoadable, IDslComposite,
  IAnimationController, IVariableProvider, ICameraActionTarget,
  IRendererLifecycle, IRenderContributor, IContainedRenderable, IAttachmentHost,
  ISceneLifecycle, IInputDefaultProvider,           // ← ADD IInputDefaultProvider
} from './types';
```

**Add method** to `WidgetRegistry` class, after `getAttachmentHosts()`:

```typescript
/** Returns all widgets that implement IInputDefaultProvider, in registration order. */
getInputDefaultProviders(): IInputDefaultProvider[] {
  return this.getAll().filter(isInputDefaultProvider);
}
```

**Add type guard** at the bottom of the file, in the Phase 5 type guards section (or a new section):

```typescript
export const isInputDefaultProvider = (w: IWidget): w is IInputDefaultProvider =>
  'getDefaultInputActions' in w &&
  typeof (w as IInputDefaultProvider).getDefaultInputActions === 'function';
```

**Pure vs stateful:** `getInputDefaultProviders()` is a pure projection of registry state.
The type guard is a pure predicate.

---

### 3. `packages/core/src/widget/index.ts`

**What:** Export `IInputDefaultProvider` and `isInputDefaultProvider`.

**Update exports:**

```typescript
export type {
  IWidget, ISceneElement, IRenderable, ILoadable,
  IDslComposite, IAnimationController, ICameraActionTarget, IVariableProvider,
  IRendererLifecycle, IRenderContributor, RenderContribution,
  IContainedRenderable, IAttachmentHost,
  ISceneLifecycle,
  IInputDefaultProvider,           // ← ADD
  CompileExtraContext, WidgetInitContext, WidgetRenderContext, AnimationTickContext,
  VariableStoreReader, AssetManifest,
} from './types';
export {
  WidgetRegistry,
  CUSTOM_NODE_HANDLER, hasCustomDslHandler,
  isSceneElement, isRenderable, isLoadable,
  isRendererLifecycle, isRenderContributor, isContainedRenderable, isAttachmentHost,
  isDslComposite, isAnimationController, isCameraActionTarget, isVariableProvider,
  isSceneLifecycle,
  isInputDefaultProvider,           // ← ADD
} from './WidgetRegistry';
```

---

### 4. `packages/core/src/player/effectiveInputSpec.ts` (NEW FILE)

**What:** Pure function `buildEffectiveInputSpec` that selects between explicit scene spec
and aggregated widget defaults.

**Full file content:**

```typescript
// Pure function: selects the effective SceneInputControllerSpec for the current frame.
// Explicit <InputController> spec wins entirely over widget-provided defaults.

import type { SceneInputControllerSpec } from '../input/types';
import type { IInputDefaultProvider } from '../widget/types';

/**
 * Determines the effective SceneInputControllerSpec to pass to ActionInputController.
 *
 * Resolution order (replace-not-merge):
 *   1. If tickInputSpec is non-null, it was authored via <InputController> DSL in the
 *      current scene — return it unchanged. Explicit always wins.
 *   2. Otherwise, collect all actions from IInputDefaultProvider widgets. If any
 *      actions exist, return a constructed SceneInputControllerSpec with scope='canvas'.
 *   3. If no actions, return null (no action-based input controller is attached).
 *
 * Merge is intentionally not performed. An explicit <InputController> is a full
 * authoring decision for that scene; combining it with theme defaults would produce
 * unexpected duplicate or conflicting action bindings.
 *
 * @param tickInputSpec - The compiled InputController spec for the current tick,
 *   or null/undefined if no <InputController> is present in this scene.
 * @param providers - All IInputDefaultProvider widgets from the registry.
 *   Their getDefaultInputActions() returns currentInputActions updated by apply()
 *   each frame — never defaultState.
 * @returns The effective SceneInputControllerSpec, or null if no input is configured.
 */
export function buildEffectiveInputSpec(
  tickInputSpec: SceneInputControllerSpec | null | undefined,
  providers: readonly IInputDefaultProvider[],
): SceneInputControllerSpec | null {
  // Explicit scene spec wins entirely — do not merge with provider defaults.
  if (tickInputSpec != null) return tickInputSpec;

  // Aggregate actions from all IInputDefaultProvider widgets.
  const allActions = providers.flatMap((p) => p.getDefaultInputActions());
  if (allActions.length === 0) return null;

  return {
    id: '__input_controller',
    scope: 'canvas',
    actions: allActions,
  };
}
```

**Pure vs stateful:** `buildEffectiveInputSpec` is a pure function. It reads from providers
(whose `getDefaultInputActions()` returns current runtime state), but the function itself has
no side effects and the same inputs always produce the same output.

---

### 5. `packages/core/src/player/useSceneEngine.ts`

**What:** Use `buildEffectiveInputSpec` to compute `inputControllerSpec`.

**Add import** near existing imports:

```typescript
import { buildEffectiveInputSpec } from './effectiveInputSpec';
import { isInputDefaultProvider } from '../widget/WidgetRegistry';
```

**Replace** the current `inputControllerSpec` computation at ≈ lines 534–536:

```typescript
// BEFORE:
const inputControllerSpec = frameState.tick
  ? (frameState.tick.state.widgets[INPUT_CONTROLLER_WIDGET_ID] as SceneInputControllerSpec | undefined) ?? null
  : null;

// AFTER:
const tickInputSpec = frameState.tick
  ? (frameState.tick.state.widgets[INPUT_CONTROLLER_WIDGET_ID] as SceneInputControllerSpec | undefined) ?? null
  : null;

const inputControllerSpec = buildEffectiveInputSpec(
  tickInputSpec,
  options.widgetRegistry.getInputDefaultProviders(),
);
```

No other changes to `useSceneEngine.ts`. The `hasSceneInputController` variable on ≈ line 259
already derives from `frameState.tick` and does not need updating — it is only used to
determine `inputMode` (scroll vs. direct). We do NOT change that logic: the engine remains in
scroll mode unless `hasSceneInputController` is true. **Only update `inputControllerSpec`.**

**Note on inputMode:** The `hasSceneInputController` flag is derived from whether an explicit
`<InputController>` block appears in the compiled tick. This flag drives the scroll-vs-direct
mode decision. Widget-provided defaults should NOT switch the engine to direct mode — they
only supply action handlers in an already-established direct or scroll mode. Therefore,
`hasSceneInputController` must remain tied to the tick's `INPUT_CONTROLLER_WIDGET_ID` presence
and must NOT be updated to reflect `inputControllerSpec` from `buildEffectiveInputSpec`.

This is a deliberate architectural boundary: input mode policy belongs to the scene author
(via `<InputController scope="canvas">`); default action bindings belong to the widget.

---

### 6. `packages/diagram/src/elements/diagram/types.ts`

**What:** Add `DiagramCanvasInputConfig` interface and `input?` field on `DiagramTheme`.

**Add import** at top of file:

```typescript
import type { InputActionSpec } from '@brewsite/core';
```

**Add interface** before or after `DiagramWarnFn` (≈ end of file):

```typescript
/**
 * Input handler configuration for a DiagramCanvas, defined in the theme.
 * Allows a single authoring location for per-canvas input defaults instead of
 * repeating <InputController> blocks in every scene.
 *
 * `canvasId` is intentionally absent from each action spec: the compiler
 * auto-injects it from the parent <DiagramCanvas id="..."> at compile time.
 */
export interface DiagramCanvasInputConfig {
  /**
   * Default input actions for the canvas. Omit `canvasId` on each action —
   * the compiler injects it automatically from the <DiagramCanvas id="...">.
   */
  readonly defaultActions: ReadonlyArray<Omit<InputActionSpec, 'canvasId'>>;
}
```

**Update `DiagramTheme`** (≈ line 178) — add `input?` field after `palette?`:

```typescript
export interface DiagramTheme {
  readonly node: DiagramThemeNodeConfig;
  readonly edge: DiagramThemeEdgeConfig;
  readonly group: DiagramThemeGroupConfig;
  readonly environment: DiagramThemeEnvironmentConfig;
  readonly layout?: DiagramThemeLayoutConfig;
  readonly palette?: readonly string[];
  /**
   * Optional default input handler configuration for DiagramCanvas.
   * Only effective when applied to a <DiagramCanvas theme={...}>.
   * Ignored (with a compile-time warning) when placed on a child <Diagram>.
   */
  readonly input?: DiagramCanvasInputConfig;
}
```

---

### 7. `packages/diagram/src/elements/diagram/canvas/types.ts`

**What:** Add `defaultInputActions?` to `DiagramCanvasState`.

**Add import** at top of file:

```typescript
import type { InputActionSpec } from '@brewsite/core';
```

**Update `DiagramCanvasState`** — add field after `pipes`:

```typescript
export interface DiagramCanvasState {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
  readonly diagrams: ReadonlyArray<DiagramState>;
  readonly pipes: ReadonlyArray<DiagramPipeState>;
  /**
   * Default input actions derived from theme.input at compile time.
   * canvasId has been injected by the compiler from the <DiagramCanvas id="...">.
   * Undefined when no theme.input is configured on the canvas.
   * Consumed by DiagramCanvasWidget.getDefaultInputActions() at runtime.
   */
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
}
```

---

### 8. `packages/diagram/src/elements/diagram/canvas/compile.ts`

**What:** Accept an optional `defaultInputActions` parameter in `compileCanvas` and include
it in the returned `DiagramCanvasState`.

**Add import** at top of file:

```typescript
import type { InputActionSpec } from '@brewsite/core';
```

**Update `compileCanvas` signature** (≈ line 194):

```typescript
export function compileCanvas(
  dsl: DiagramCanvasDSL,
  diagrams: ReadonlyArray<DiagramState>,
  pipes: ReadonlyArray<DiagramPipeDSL>,
  onWarn?: DiagramWarnFn,
  defaultInputActions?: ReadonlyArray<InputActionSpec>,   // ← ADD parameter
): DiagramCanvasState {
  const pipeRouting = dsl.pipeRouting ?? DEFAULT_PIPE_ROUTING;
  const pipeLanding = dsl.pipeLanding ?? DEFAULT_PIPE_LANDING;
  const compiledPipes = pipes.map((pipe, index) =>
    compilePipe(pipe, diagrams, index, pipeRouting, pipeLanding, onWarn),
  );

  return {
    id: dsl.id,
    position: dsl.position ?? [0, 0, 0],
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    focusCenter: dsl.focusCenter,
    diagrams,
    pipes: compiledPipes,
    defaultInputActions,            // ← ADD (undefined when not provided)
  };
}
```

**Pure vs stateful:** `compileCanvas` is a pure transformation function. No side effects.

---

### 9. `packages/diagram/src/compiler/handlers.ts`

**What:** Two changes:

**A.** In the `<DiagramCanvas>` handler — extract `theme.input.defaultActions`, inject `canvasId`
into each action, pass `defaultInputActions` to `compileCanvas`.

**B.** In the `<DiagramCanvas>` handler — when iterating child `<Diagram>` elements, emit
`IGNORED_INPUT_CONFIG` warning if the child diagram's theme has `input` defined.

**Add import** (extend existing type imports from `'../elements/diagram/types'`):

```typescript
import type {
  DiagramDSL,
  DiagramNodeDSL,
  DiagramEdgeDSL,
  DiagramGroupDSL,
  DiagramExitDSL,
  DiagramEnterDSL,
  DiagramPivot,
  DiagramState,
  DiagramTheme,
  DiagramWarnFn,
  LayoutDSL,
} from '../elements/diagram/types';
import type { InputActionSpec } from '@brewsite/core';   // ← ADD
```

**Update the `DiagramCanvas` `registerNode` handler** — full replacement of the existing
`registerNode(DiagramCanvas, ...)` block:

```typescript
registerNode(DiagramCanvas, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const props = node.props as Record<string, unknown>;
  const allChildren = helpers.collectChildren(node);
  const canvasTheme = props.theme as DiagramTheme | undefined;
  const canvasId = String(props.id);
  const onWarn = makeWarnFn(api);

  const diagramStates: DiagramState[] = [];
  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    if (el.type !== Diagram) continue;
    const dsl = extractDiagramDSL(el, helpers, onWarn);

    // Warn if a child <Diagram> has theme.input — this is the wrong authoring level.
    // theme.input is only effective on <DiagramCanvas>, not on its <Diagram> children.
    if (dsl.theme?.input !== undefined) {
      onWarn(
        'IGNORED_INPUT_CONFIG',
        `<Diagram id="${dsl.id}"> inside <DiagramCanvas id="${canvasId}">: ` +
          `theme.input is ignored on child <Diagram> elements. ` +
          `Move theme.input to the <DiagramCanvas theme={...}> instead.`,
      );
    }

    diagramStates.push(compileDiagram(dsl, canvasTheme, onWarn));
  }

  const pipeDSLs: DiagramPipeDSL[] = [];
  for (const child of allChildren) {
    if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
    const el = child as ReactElement;
    if (el.type !== DiagramPipe) continue;
    pipeDSLs.push(el.props as DiagramPipeDSL);
  }

  // Compile default input actions from theme.input, injecting canvasId into each action.
  let defaultInputActions: ReadonlyArray<InputActionSpec> | undefined;
  if (canvasTheme?.input?.defaultActions && canvasTheme.input.defaultActions.length > 0) {
    defaultInputActions = canvasTheme.input.defaultActions.map((action) => ({
      ...action,
      canvasId,
    }));
  }

  const canvasDSL: DiagramCanvasDSL = {
    id: canvasId,
    position: props.position as readonly [number, number, number] | undefined,
    rotation: props.rotation as readonly [number, number, number] | undefined,
    scale: props.scale as number | undefined,
    theme: canvasTheme,
    pipeRouting: props.pipeRouting as PipeRoutingAlgorithm | undefined,
    pipeLanding: props.pipeLanding as PipeLandingAlgorithm | undefined,
    focusCenter: props.focusCenter as readonly [number, number] | readonly [number, number, number] | undefined,
  };

  const canvasState = compileCanvas(canvasDSL, diagramStates, pipeDSLs, onWarn, defaultInputActions);
  api.setWidgetState(canvasId, canvasState);
});
```

**Also update the standalone `<Diagram>` handler** — add the `IGNORED_INPUT_CONFIG` warning
immediately after `extractDiagramDSL` returns, before `compileDiagram` is called:

```typescript
registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const onWarn = makeWarnFn(api);
  const dsl = extractDiagramDSL(node, helpers, onWarn);

  // Warn if standalone <Diagram> theme has input — this is the wrong authoring level.
  // theme.input is only effective on <DiagramCanvas>, not on a bare <Diagram>.
  if (dsl.theme?.input !== undefined) {
    onWarn(
      'IGNORED_INPUT_CONFIG',
      `<Diagram id="${dsl.id}"> has a theme with an "input" section. ` +
        `theme.input is only effective on <DiagramCanvas>. ` +
        `Wrap this diagram in a <DiagramCanvas theme={...}> to use input defaults.`,
    );
  }

  // ... rest of handler unchanged (compileDiagram, compileCanvas, api.setWidgetState)
});
```

The rest of the standalone handler body (compileDiagram call, compileCanvas wrapping, api.setWidgetState) is unchanged. It calls `compileCanvas` without the fifth argument, correctly omitting `defaultInputActions`.

---

### 10. `packages/diagram/src/elements/diagram/canvas/widget.ts`

**What:** Implement `IInputDefaultProvider`. Add `currentInputActions` field, update `apply()`.

**Add import** (extend existing `@brewsite/core` imports):

```typescript
import type {
  IAnimationController,
  IInputDefaultProvider,       // ← ADD
  IRenderable,
  ISceneElement,
  AnimationTickContext,
  InputActionSpec,             // ← ADD
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
```

**Update class declaration** to implement `IInputDefaultProvider`:

```typescript
export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IAnimationController,
    IInputDefaultProvider          // ← ADD
{
```

**Add private field** after existing private fields (before `constructor`):

```typescript
/**
 * Current default input actions derived from the most recently applied
 * DiagramCanvasState. Updated in apply(); never reads from defaultState.
 */
private currentInputActions: ReadonlyArray<InputActionSpec> | undefined = undefined;
```

**Update `apply()` method** — add one line at the start of the method body to update
`currentInputActions` from the incoming state:

```typescript
apply(state: DiagramCanvasState, _ctx: WidgetRenderContext): void {
  // Update currentInputActions so getDefaultInputActions() reflects current scene.
  this.currentInputActions = state.defaultInputActions;

  if (!this.scene) return;
  const effectiveState: DiagramCanvasState = {
    // ... rest of existing apply() body unchanged ...
  };
  this.lastState = effectiveState;
  this.renderer.update(effectiveState, this.scene);
}
```

**Add `getDefaultInputActions()` method** after `apply()`:

```typescript
/**
 * Returns the current scene's default input actions.
 * Returns this.currentInputActions (updated each frame in apply()), NOT defaultState.
 * Returns an empty array when no defaultInputActions are configured.
 */
getDefaultInputActions(): InputActionSpec[] {
  return this.currentInputActions ? [...this.currentInputActions] : [];
}
```

**Update `dispose()`** — add reset of `currentInputActions`:

```typescript
dispose(): void {
  // ... existing cleanup ...
  this.currentInputActions = undefined;   // ← ADD at end
}
```

**Pure vs stateful:** `getDefaultInputActions()` is stateful — it reads `currentInputActions`
which is mutable runtime state. `apply()` is the only place this field is written.

---

### 11. `packages/diagram/src/elements/diagram/canvas/defaultInputActions.ts` (NEW FILE)

**What:** Export the canonical default input actions for a `DiagramCanvas`.

Note: `diagram-canvas.dolly` is intentionally absent — that InputActionType does not yet
exist. It will be added in a separate fix ticket. Keyboard pan/rotate are similarly absent
(separate ticket). These defaults provide pointer-based move, rotate, reset, and focus.

```typescript
// Canonical default input actions for a DiagramCanvas.
// Used as the reference value for theme.input.defaultActions in scene setups that
// want pointer-driven pan/rotate with click-to-focus.

import type { InputActionSpec } from '@brewsite/core';

/**
 * Default input action set for a DiagramCanvas.
 * Provides:
 *   - Left-drag or scroll-wheel (sticky-axis) to move (pan) the canvas
 *   - Right-drag to rotate the canvas
 *   - 'R' key to reset position and rotation
 *   - Meta+left-click to focus on the nearest group or canvas center
 *     (unmodified click is reserved for node interaction)
 *
 * canvasId is intentionally absent: the compiler injects it from the
 * <DiagramCanvas id="..."> when this array is used via theme.input.defaultActions.
 *
 * Note: diagram-canvas.dolly and keyboard-based pan/rotate are not included here.
 * They require a separate InputActionType registration fix (tracked separately).
 */
export const defaultDiagramCanvasInputActions: ReadonlyArray<
  Omit<InputActionSpec, 'canvasId'>
> = [
  {
    id: 'diagram-canvas-move',
    type: 'diagram-canvas.move',
    speed: 1,
    maps: [
      { kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' },
      { kind: 'wheel', axis: 'xy', lockAxis: 'sticky' },
    ],
  },
  {
    id: 'diagram-canvas-rotate',
    type: 'diagram-canvas.rotate',
    speed: 1,
    maps: [{ kind: 'pointer', event: 'drag', button: 'right', axis: 'xy' }],
  },
  {
    id: 'diagram-canvas-reset',
    type: 'diagram-canvas.reset',
    maps: [{ kind: 'key', key: 'r' }],
  },
  {
    // meta+click: avoids conflict with node interaction clicks (unmodified left-click)
    // Matches the existing metaKey guard in DiagramCanvasWidget.handleClick().
    id: 'diagram-canvas-focus',
    type: 'diagram-canvas.focus',
    maps: [{ kind: 'pointer', event: 'click', button: 'left', modifiers: ['meta'] }],
  },
];
```

---

### 12. `packages/diagram/src/index.ts`

**What:** Export `DiagramCanvasInputConfig` type and `defaultDiagramCanvasInputActions` constant.

**Add to existing type exports** from `'./elements/diagram/types'`:

```typescript
export type {
  // ... existing exports ...
  DiagramTheme,
  DiagramCanvasInputConfig,      // ← ADD
  // ... rest ...
} from './elements/diagram/types';
```

**Add new export** (e.g. after the theme preset exports):

```typescript
export { defaultDiagramCanvasInputActions } from './elements/diagram/canvas/defaultInputActions';
```

---

## Authoring Example (scene file)

```tsx
// widgetSetup.ts — register with DiagramCanvasWidget that carries theme.input
import { defaultDiagramCanvasInputActions } from '@brewsite/diagram';

const theme: DiagramTheme = {
  ...darkGlassTheme,
  input: {
    defaultActions: defaultDiagramCanvasInputActions,
  },
};

// scene.tsx — no <InputController> needed in any scene
const getFrame = () => (
  <>
    <Scene id="scene-1">
      <DiagramCanvas id="my-canvas" theme={theme}>
        <Diagram id="infra" theme={theme}>
          {/* nodes, edges, etc */}
        </Diagram>
      </DiagramCanvas>
    </Scene>
    <Scene id="scene-2">
      {/* Same DiagramCanvas, same default input — no duplication */}
      <DiagramCanvas id="my-canvas" theme={theme}>
        <Diagram id="infra" theme={theme} />
      </DiagramCanvas>
    </Scene>
  </>
);
```

---

## Module Boundary Compliance

| File | Layer | Imports | Forbidden |
|---|---|---|---|
| `diagram/types.ts` | types | `@brewsite/core` type-only | Three.js, React, runtime |
| `canvas/types.ts` | types | `@brewsite/core` type-only, `../types` | Three.js, React, runtime |
| `canvas/compile.ts` | compile | `@brewsite/core` type-only, types | Three.js, React |
| `handlers.ts` | compiler | `@brewsite/core`, diagram types | React rendering internals |
| `canvas/widget.ts` | widget | `@brewsite/core`, types, render | Direct React rendering |
| `core/widget/types.ts` | types | `../input/types` | Three.js, React, widget runtime |
| `core/widget/WidgetRegistry.ts` | widget SDK | `./types`, Three.js (renderer) | N/A |
| `effectiveInputSpec.ts` | player | `../input/types`, `../widget/types` | Three.js, React |

Dependency direction: `@brewsite/diagram` → `@brewsite/core` (correct).
`@brewsite/core` does NOT import from `@brewsite/diagram` (maintained).

---

## Test Strategy

All tests use interface-based stateful patterns. No mocking of internal state.
No `vi.fn()` wrappers on internals. Real inputs, real output assertions.

### Test File 1: `packages/core/src/player/__tests__/effectiveInputSpec.test.ts` (NEW)

Tests the pure `buildEffectiveInputSpec` function. No mocks needed — pure function.

```typescript
import { describe, it, expect } from 'vitest';
import { buildEffectiveInputSpec } from '../effectiveInputSpec';
import type { SceneInputControllerSpec, InputActionSpec } from '../../input/types';
import type { IInputDefaultProvider } from '../../widget/types';

// A minimal IInputDefaultProvider test double.
const makeProvider = (actions: InputActionSpec[]): IInputDefaultProvider => ({
  widgetId: 'test-provider',
  getDefaultInputActions: () => actions,
});

const sampleAction: InputActionSpec = {
  id: 'test-move',
  type: 'diagram-canvas.move',
  canvasId: 'canvas-1',
  speed: 1,
  maps: [{ kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' }],
};

const sampleSpec: SceneInputControllerSpec = {
  id: '__input_controller',
  scope: 'canvas',
  actions: [sampleAction],
};

describe('buildEffectiveInputSpec', () => {
  it('returns tick spec unchanged when explicit spec is present (explicit wins)', () => {
    const result = buildEffectiveInputSpec(sampleSpec, [makeProvider([sampleAction])]);
    expect(result).toBe(sampleSpec);
  });

  it('returns null when tickInputSpec is null and no providers', () => {
    expect(buildEffectiveInputSpec(null, [])).toBeNull();
  });

  it('returns null when tickInputSpec is undefined and no providers', () => {
    expect(buildEffectiveInputSpec(undefined, [])).toBeNull();
  });

  it('returns null when providers return no actions', () => {
    const result = buildEffectiveInputSpec(null, [makeProvider([])]);
    expect(result).toBeNull();
  });

  it('constructs a spec from provider actions when no tick spec', () => {
    const result = buildEffectiveInputSpec(null, [makeProvider([sampleAction])]);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('__input_controller');
    expect(result!.scope).toBe('canvas');
    expect(result!.actions).toEqual([sampleAction]);
  });

  it('aggregates actions from multiple providers', () => {
    const a1 = { ...sampleAction, id: 'a1' };
    const a2 = { ...sampleAction, id: 'a2' };
    const result = buildEffectiveInputSpec(null, [makeProvider([a1]), makeProvider([a2])]);
    expect(result!.actions).toHaveLength(2);
    expect(result!.actions[0].id).toBe('a1');
    expect(result!.actions[1].id).toBe('a2');
  });

  it('does not merge tick spec with provider actions — explicit wins entirely', () => {
    const tickAction = { ...sampleAction, id: 'tick-action' };
    const providerAction = { ...sampleAction, id: 'provider-action' };
    const tickSpec: SceneInputControllerSpec = {
      id: '__input_controller',
      scope: 'canvas',
      actions: [tickAction],
    };
    const result = buildEffectiveInputSpec(tickSpec, [makeProvider([providerAction])]);
    expect(result!.actions).toHaveLength(1);
    expect(result!.actions[0].id).toBe('tick-action');
  });
});
```

### Test File 2: `packages/core/src/widget/__tests__/WidgetRegistry.inputDefaultProviders.test.ts` (NEW)

Tests the `getInputDefaultProviders()` method and `isInputDefaultProvider` type guard.
Uses a minimal `IInputDefaultProvider` test double — no mocks.

```typescript
import { describe, it, expect } from 'vitest';
import { WidgetRegistry, isInputDefaultProvider } from '../WidgetRegistry';
import type { IWidget, IInputDefaultProvider } from '../types';
import type { InputActionSpec } from '../../input/types';

// Minimal test double implementing IWidget only (no IInputDefaultProvider)
const makeBasicWidget = (id: string): IWidget => ({ widgetId: id });

// Minimal test double implementing IInputDefaultProvider
const makeProviderWidget = (id: string, actions: InputActionSpec[] = []): IInputDefaultProvider => ({
  widgetId: id,
  getDefaultInputActions: () => actions,
});

describe('WidgetRegistry.getInputDefaultProviders', () => {
  it('returns empty array when no widgets implement IInputDefaultProvider', () => {
    const registry = new WidgetRegistry();
    registry.register(makeBasicWidget('basic-1'));
    expect(registry.getInputDefaultProviders()).toHaveLength(0);
  });

  it('returns only widgets implementing IInputDefaultProvider', () => {
    const registry = new WidgetRegistry();
    registry.register(makeBasicWidget('basic-1'));
    registry.register(makeProviderWidget('provider-1'));
    registry.register(makeBasicWidget('basic-2'));
    const providers = registry.getInputDefaultProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]!.widgetId).toBe('provider-1');
  });

  it('returns all IInputDefaultProvider widgets when multiple registered', () => {
    const registry = new WidgetRegistry();
    registry.register(makeProviderWidget('canvas-a'));
    registry.register(makeProviderWidget('canvas-b'));
    const providers = registry.getInputDefaultProviders();
    expect(providers).toHaveLength(2);
    const ids = providers.map((p) => p.widgetId);
    expect(ids).toContain('canvas-a');
    expect(ids).toContain('canvas-b');
  });
});

describe('isInputDefaultProvider', () => {
  it('returns true for a widget with getDefaultInputActions', () => {
    expect(isInputDefaultProvider(makeProviderWidget('p'))).toBe(true);
  });

  it('returns false for a widget without getDefaultInputActions', () => {
    expect(isInputDefaultProvider(makeBasicWidget('w'))).toBe(false);
  });

  it('returns false for a widget with a non-function getDefaultInputActions property', () => {
    const bad: IWidget & { getDefaultInputActions: string } = {
      widgetId: 'bad',
      getDefaultInputActions: 'not-a-function',
    };
    expect(isInputDefaultProvider(bad)).toBe(false);
  });
});
```

### Test File 3: `packages/diagram/src/elements/diagram/canvas/__tests__/compile.test.ts` (EXISTING — extend)

Add test cases to the existing file:

```typescript
describe('compileCanvas — defaultInputActions', () => {
  const baseDSL: DiagramCanvasDSL = { id: 'canvas-1' };
  const sampleActions: InputActionSpec[] = [
    {
      id: 'move',
      type: 'diagram-canvas.move',
      canvasId: 'canvas-1',
      speed: 1,
      maps: [{ kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' }],
    },
  ];

  it('includes defaultInputActions when provided', () => {
    const state = compileCanvas(baseDSL, [], [], undefined, sampleActions);
    expect(state.defaultInputActions).toEqual(sampleActions);
  });

  it('has undefined defaultInputActions when not provided', () => {
    const state = compileCanvas(baseDSL, [], []);
    expect(state.defaultInputActions).toBeUndefined();
  });

  it('passes defaultInputActions through to state without transformation', () => {
    const state = compileCanvas(baseDSL, [], [], undefined, sampleActions);
    expect(state.defaultInputActions).toBe(sampleActions); // reference equality
  });
});
```

### Test File 4: `packages/diagram/src/compiler/__tests__/handlers.inputConfig.test.ts` (NEW)

Tests the `IGNORED_INPUT_CONFIG` warning and `canvasId` injection in the canvas handler.
Uses `resolveSceneFromDsl` + a real `WidgetRegistry` — same pattern as `warnThreading.test.ts`.

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl, WidgetRegistry } from '@brewsite/core';
import type { InputActionSpec } from '@brewsite/core';
import { registerDiagramHandlers } from '../handlers';
import { DiagramCanvas, Diagram, DiagramNode } from '../../elements/diagram/dsl';
import type { DiagramTheme } from '../../elements/diagram/types';
import { darkGlassTheme } from '../../elements/diagram/themes/darkGlass';

const moveAction: Omit<InputActionSpec, 'canvasId'> = {
  id: 'move',
  type: 'diagram-canvas.move',
  speed: 1,
  maps: [{ kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' }],
};

const themeWithInput: DiagramTheme = {
  ...darkGlassTheme,
  input: { defaultActions: [moveAction] },
};

const compileScene = (tree: React.ReactElement) => {
  const registry = new WidgetRegistry();
  const warnings: Array<{ code: string; message: string }> = [];
  const result = resolveSceneFromDsl(
    tree,
    { sceneIndex: 0, numScenes: 1, assetsReady: false },
    registry,
    (w) => warnings.push(w),
  );
  return { result, warnings };
};

describe('DiagramCanvas handler — IGNORED_INPUT_CONFIG warning', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  it('emits IGNORED_INPUT_CONFIG when child <Diagram> has theme.input', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        DiagramCanvas, { id: 'canvas-1' },
        React.createElement(
          Diagram, { id: 'diag-1', theme: themeWithInput },
          React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeDefined();
    expect(match!.message).toContain('diag-1');
    expect(match!.message).toContain('canvas-1');
  });

  it('does NOT emit IGNORED_INPUT_CONFIG when theme.input is on <DiagramCanvas> only', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        DiagramCanvas, { id: 'canvas-1', theme: themeWithInput },
        React.createElement(
          Diagram, { id: 'diag-1', theme: darkGlassTheme },
          React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeUndefined();
  });

  it('emits IGNORED_INPUT_CONFIG for standalone <Diagram> with theme.input', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag-1', theme: themeWithInput },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeDefined();
    expect(match!.message).toContain('diag-1');
  });
});

describe('DiagramCanvas handler — canvasId injection', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  it('injects canvasId from <DiagramCanvas id="..."> into each default action', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        DiagramCanvas, { id: 'my-canvas', theme: themeWithInput },
        React.createElement(
          Diagram, { id: 'diag-1' },
          React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
      ),
    );
    const registry = new WidgetRegistry();
    const result = resolveSceneFromDsl(
      tree,
      { sceneIndex: 0, numScenes: 1, assetsReady: false },
      registry,
    );
    const state = result?.widgets['my-canvas'] as { defaultInputActions?: InputActionSpec[] } | undefined;
    expect(state?.defaultInputActions).toBeDefined();
    expect(state!.defaultInputActions).toHaveLength(1);
    expect(state!.defaultInputActions![0]!.canvasId).toBe('my-canvas');
    expect(state!.defaultInputActions![0]!.id).toBe('move');
  });

  it('produces undefined defaultInputActions when no theme.input on canvas', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        DiagramCanvas, { id: 'my-canvas', theme: darkGlassTheme },
        React.createElement(
          Diagram, { id: 'diag-1' },
          React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
      ),
    );
    const registry = new WidgetRegistry();
    const result = resolveSceneFromDsl(
      tree,
      { sceneIndex: 0, numScenes: 1, assetsReady: false },
      registry,
    );
    const state = result?.widgets['my-canvas'] as { defaultInputActions?: InputActionSpec[] } | undefined;
    expect(state?.defaultInputActions).toBeUndefined();
  });
});

---

## Pure vs Stateful Summary

| Module/Function | Classification | Reason |
|---|---|---|
| `buildEffectiveInputSpec()` | **Pure function** | Deterministic: same inputs → same output; no side effects |
| `compileCanvas()` changes | **Pure function** | New parameter passed through to output; no side effects |
| `DiagramCanvasInputConfig` extraction in `handlers.ts` | **Pure transformation** | Simple map + spread on array of input actions |
| `IInputDefaultProvider.getDefaultInputActions()` | **Stateful read** | Returns `currentInputActions` — mutable runtime field |
| `DiagramCanvasWidget.apply()` change | **Stateful write** | Updates `currentInputActions` from compiled state |
| `WidgetRegistry.getInputDefaultProviders()` | **Pure projection** | Filters registered widgets; no state mutation |
| `useSceneEngine` `inputControllerSpec` update | **Stateful** | Reads live widget state via `getInputDefaultProviders()` per render |

---

## Dependency Direction Verification

- `packages/core` does NOT import from `packages/diagram` at any point. ✓
- New imports in `packages/diagram` → `@brewsite/core` follow the correct direction. ✓
- `IInputDefaultProvider` is in `@brewsite/core` (not `@brewsite/diagram`), so the core
  player layer can call `getInputDefaultProviders()` without a package boundary violation. ✓
- `DiagramCanvasWidget` imports `IInputDefaultProvider` from `@brewsite/core`. ✓

---

## Rollout / Migration Notes

- Existing scenes with `<InputController>` blocks are **unaffected**. The explicit spec wins
  entirely — `buildEffectiveInputSpec` returns it unchanged.
- Existing scenes without `<InputController>` and no `theme.input` are unaffected:
  `getInputDefaultProviders()` returns `[]` → `buildEffectiveInputSpec` returns `null` →
  same behavior as before.
- No breaking changes to `DiagramTheme` (new optional field).
- No breaking changes to `DiagramCanvasState` (new optional field).
- No breaking changes to `compileCanvas` signature (new trailing optional parameter).
- `defaultDiagramCanvasInputActions` is a new export — additive only.
