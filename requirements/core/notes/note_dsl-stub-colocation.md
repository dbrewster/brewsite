---
title: DSL Stub Co-location for IDE Navigation
doc_type: note
owner: pm
status: draft
updated: 2026-03-08
---

# DSL Stub Co-location for IDE Navigation

## 1. Problem Statement

Every DSL element in the toolkit is backed by a null-returning stub function in a `dsl.tsx` file:

```tsx
export const Camera = (_props: CameraProps): null => null;
Camera.displayName = 'Camera';
```

When a developer writes a scene and cmd+clicks (Go to Definition) on `<Camera />`, their IDE navigates to this null stub in `camera/dsl.tsx`. The actual implementation — `CameraWidget.ts` — is in a separate file the developer must find manually. This is a daily friction point for anyone reading or authoring scenes. The DSL surface advertises nothing about what the element actually does.

The problem is universal across four packages: `@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts`.

---

## 2. Proposed Solution

**Move the null-returning stub function declaration from `dsl.tsx` into the corresponding widget file.** Prop type interfaces and type aliases stay in `dsl.tsx`. The `index.ts` barrel for each element re-exports the stub from the widget file instead of from `dsl.tsx`. The `dsl.tsx` file becomes a pure type module.

### Before / After Example — simple case (`camera` element, 1 stub)

**Before:**

```
camera/
  types.ts           — SceneCamera, Vec3, ...
  dsl.tsx            — CameraProps (types) + Camera stub function ← cmd+click lands here
  compile.ts         — pure transform functions
  render.ts          — Three.js apply logic
  CameraWidget.ts    — class CameraWidget (actual implementation)
  index.ts           — re-exports Camera from ./dsl
```

`dsl.tsx` (before):
```tsx
export type CameraProps = CameraDescriptorProps & { ... };

/** Camera DSL component — returns null; consumed purely by the compiler. */
export const Camera = (_props: CameraProps): null => null;
Camera.displayName = 'Camera';
```

`CameraWidget.ts` (before):
```ts
import { Camera } from './dsl';          // value import — Camera function reference
import type { CameraProps } from './dsl'; // type import

export class CameraWidget implements ISceneElement<SceneCamera>, ... {
  readonly DslComponent = Camera;
  ...
}
```

**After:**

```
camera/
  types.ts           — SceneCamera, Vec3, ...
  dsl.tsx            — CameraProps (types only, no stub function)
  compile.ts         — pure transform functions
  render.ts          — Three.js apply logic
  CameraWidget.ts    — Camera stub + class CameraWidget ← cmd+click lands here
  index.ts           — re-exports Camera from ./CameraWidget
```

`dsl.tsx` (after):
```tsx
// Types only — no function declarations.
export type CameraProps = CameraDescriptorProps & { ... };
```

`CameraWidget.ts` (after):
```ts
import type { CameraProps } from './dsl'; // type-only import; value import of Camera removed

/** Camera DSL component — returns null; consumed purely by the compiler. */
export const Camera = (_props: CameraProps): null => null;
Camera.displayName = 'Camera';

export class CameraWidget implements ISceneElement<SceneCamera>, ... {
  readonly DslComponent = Camera;
  ...
}
```

`index.ts` (after):
```ts
export { Camera } from './CameraWidget';  // was: from './dsl'
export { CameraWidget } from './CameraWidget';
// prop type re-exports from ./dsl are unchanged
```

### Before / After — composite case note (`lighting` element, 11 stubs)

`LightingWidget.ts` currently has:
```ts
import {
  Lighting, Ambient, Directional, GlowPoint, Point, Spot,
  LightStrand, Wave, Circle, Rectangle, Panel,
  type AmbientProps, type DirectionalProps, ...
} from './dsl';
```

After the change, all **value imports** (the 11 stub function names) are removed. Only the **type imports** remain:
```ts
import type {
  AmbientProps, DirectionalProps, GlowPointProps, PointProps, SpotProps,
  LightStrandProps, WaveProps, CircleProps, RectangleProps, PanelProps, LightingProps,
} from './dsl';
```

All 11 stub declarations move to the top of `LightingWidget.ts` before the class, each preserving its existing declaration style. `index.ts` re-exports all 11 from `./LightingWidget` instead of `./dsl`.

---

## 3. Full Scope Inventory

### @brewsite/core (`packages/core/src/elements/`)

| `dsl.tsx` file | Stub functions to move | Target widget file |
|---|---|---|
| `camera/dsl.tsx` | `Camera` (1) | `CameraWidget.ts` |
| `background/dsl.tsx` | `Background` (1) | `BackgroundWidget.ts` |
| `lighting/dsl.tsx` | `Lighting`, `Ambient`, `Directional`, `Point`, `GlowPoint`, `Spot`, `LightStrand`, `Wave`, `Circle`, `Rectangle`, `Panel` (11) | `LightingWidget.ts` |
| `floor/dsl.tsx` | `Floor`, `FloorPhysical`, `FloorMirror` (3) | `FloorWidget.ts` |
| `environment/dsl.tsx` | `Environment`, `EnvironmentHdri`, `EnvironmentExr`, `EnvironmentCube` (4) | `EnvironmentWidget.ts` |

**Not in scope:** `text-box/dsl.tsx` — `TextBox` is a rendered component (returns `ReactElement`, not `null`). It is not a compiler stub and has no widget.

### @brewsite/diagram (`packages/diagram/src/elements/`)

| `dsl.tsx` file | Stub functions to move | Target widget file |
|---|---|---|
| `diagram/dsl.tsx` | `Diagram`, `DiagramNode`, `DiagramEdge`, `DiagramGroup`, `GridLayout`, `HierarchicalLayout`, `ManualLayout`, `FlowLayout`, `DiagramExit`, `DiagramEnter` (10) | `diagram/widget.ts` (DiagramWidget) |
| `diagram/canvas/dsl.tsx` | `DiagramCanvas`, `DiagramPipe` (2) | `diagram/canvas/widget.ts` (DiagramCanvasWidget) |
| `image-panel/dsl.tsx` | `ImagePanel` (1) | `image-panel/widget.ts` (ImagePanelWidget) |
| `screen/dsl.tsx` | `Screen` (1) | `screen/widget.ts` (ScreenWidget) |

### @brewsite/model (`packages/model/src/`)

| `dsl.tsx` file | Stub functions to move | Target widget file |
|---|---|---|
| `elements/model/dsl.tsx` | `Model`, `ModelRouter`, `BodyParts`, `BodyPart`, `Pose`, `ModelPart`, `ContainedModel`, `Subpart`, `Playback`, `Motion`, `Animation` (11) | `elements/model/ModelWidget.ts` |
| `labels/dsl.tsx` | `Label`, `Labels` (2) | `elements/model/ModelWidget.ts` (see §7c) |

### @brewsite/charts (`packages/charts/src/elements/chart/`)

| `dsl.tsx` file | Stub functions to move | Target widget file |
|---|---|---|
| `chart/dsl.tsx` | `Chart`, `ChartData`, `ChartAxis`, `ChartSeries`, `ChartLegend` (5) | `ChartWidget.ts` |

**Not in scope — `@brewsite/slides`:** The slides DSL uses a fundamentally different compilation model. `Slide`, `TitleLayout`, etc. are consumed by `deckCompiler.tsx` at a macro-compilation level that transforms `<Slide>` into `<Scene>` wrappers. `SlideMetaWidget`'s `DslComponent` is the compiler-synthesized `SlideMetaDsl` (defined in `plugin.ts`), not the authored `Slide` component. There is no widget with `DslComponent = Slide`, so the "stub moves to widget file" pattern is structurally inapplicable. Slides is excluded from this feature. The rendered content primitives in `slides/dsl.tsx` (`Heading`, `Body`, `BulletList`, `NumberedList`) are also not stubs — they return `ReactElement` and are excluded on that basis.

### Totals
- Packages affected: 4 (`@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`)
- `dsl.tsx` files affected: 13
- Stub functions to relocate: **52** (core: 20, diagram: 14, model: 13, charts: 5)
- `index.ts` barrel files to update: 13

---

## 4. Module Boundary Analysis

The existing module dependency chain is:
```
types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts
```

After the change, the chain becomes:
```
types.ts → dsl.tsx (types only)
                  ↘
          {Name}Widget.ts (defines stub + implements widget) → compile.ts → render.ts
```

And `index.ts` imports stub functions from `{Name}Widget.ts` rather than from `dsl.tsx`.

### Circular import analysis

`dsl.tsx` does **not** need to import from the widget file after this change. Stub functions leave `dsl.tsx`. Consumers import them through `index.ts`, which re-exports from the widget file. No circular dependency is introduced.

The dependency directions after the change:
- `dsl.tsx → types.ts`: unchanged
- `{Name}Widget.ts → dsl.tsx`: unchanged (widget imports prop types from dsl.tsx)
- `{Name}Widget.ts → compile.ts`: unchanged
- `{Name}Widget.ts → render.ts`: unchanged
- `index.ts → {Name}Widget.ts`: NEW for stub function re-export
- `index.ts → dsl.tsx`: continues for prop type re-exports

**Module boundary invariant preserved:** `dsl.tsx` contains no Three.js, no runtime imports, and no imports from widget or render files. `dsl.tsx` only loses exports — it gains no new imports.

**Three.js confinement rule preserved:** Three.js imports remain only in `render.ts` and widget files. Moving a stub INTO a widget file does not expose Three.js to the authoring surface because scene authors import through the package public API (`@brewsite/core`), not directly from widget files.

---

## 5. Key Design Decisions

1. **Prop types stay in `dsl.tsx`.** Prop types are the authoring surface. The widget file imports them from `dsl.tsx` — this import direction is already present and does not change.

2. **Stub function moves to the widget file.** The stub is the thing developers cmd+click on; it should land at the implementation.

3. **`dsl.tsx` becomes a pure type module.** After the change, `dsl.tsx` contains only `type` and `interface` declarations — no runtime function declarations, no side effects.

4. **`displayName` assignment moves with the stub.** The `ComponentName.displayName = '...'` assignment immediately follows the stub declaration. It moves to the widget file along with the stub.

5. **`index.ts` re-export source changes from `./dsl` to the widget file.** Public package API is unchanged; only the internal re-export origin changes.

6. **Stub placement in widget file: before the class declaration.** Stubs are declared at the top of the widget file, before the widget class. Import of prop types precedes both stub and class. The stub is immediately visible when the file opens.

7. **For composite elements, all sub-component stubs move to the same widget file.** `Ambient`, `Directional`, etc. all move to `LightingWidget.ts`. `DiagramNode`, `DiagramEdge`, etc. all move to `diagram/widget.ts`. `ModelRouter`, `BodyPart`, etc. all move to `ModelWidget.ts`. This includes `Label` and `Labels` (see §7c). This maximizes IDE navigation benefit: cmd+click on any sub-component navigates to the file where its behavior is compiled.

8. **Preserve existing stub declaration style as-is.** The codebase has three styles:
   - Arrow const with explicit return type: `export const Camera = (_props: CameraProps): null => null;` (camera, background)
   - Arrow const without explicit return type: `export const Lighting = (_props: LightingProps) => null;` (lighting)
   - Function declaration: `export function DiagramNode(_props: DiagramNodeProps): null { return null; }` (diagram)

   During the move, each stub is relocated verbatim without style changes. This keeps diffs minimal and avoids conflating a structural change with a style normalization.

9. **Widget file value imports of stub functions are removed.** For widgets that currently import stub function references from `./dsl` (e.g., `import { Camera } from './dsl'`), those value imports are removed after the move since the stubs are defined locally. Only type imports remain (e.g., `import type { CameraProps } from './dsl'`). This applies to all affected widget files.

---

## 6. Compiler Constraint: Registry Map Key Identity

In `packages/core/src/compiler/registry.ts`, the node registry uses function reference as Map key:

```ts
const nodeRegistry = new Map<unknown, NodeHandler>();
registerNode(component: unknown, handler: NodeHandler): void {
  nodeRegistry.set(component, handler);
  ...
}
```

In `WidgetRegistry.register()`:
```ts
registerNode(widget.DslComponent, (node, api, helpers) => { ... });
```

And in routing:
```ts
(w as ISceneElement<unknown>).DslComponent === widget.DslComponent
```

**The constraint:** the function object appearing as `element.type` in compiled JSX must be the same object reference registered as a `nodeRegistry` key.

**This constraint is not violated.** Before: `Camera` defined in `dsl.tsx`, imported into `CameraWidget.ts`, assigned to `DslComponent`. After: `Camera` defined in `CameraWidget.ts`, assigned to `DslComponent` in the same file. Scene authors import `Camera` from `@brewsite/core` → `index.ts` → `CameraWidget.ts`. All references point to the same function object. Function identity is preserved end-to-end.

Registry has a fallback lookup by `displayName` which provides a safety net but is not relied upon here.

---

## 7. Cases That Need Special Handling

### 7a. Diagram sub-components (no per-component widget file)

`diagram/dsl.tsx` defines 10 stubs. `Diagram` has `DslComponent = Diagram` in `DiagramWidget`. The remaining 9 (`DiagramNode`, `DiagramEdge`, `DiagramGroup`, `GridLayout`, `HierarchicalLayout`, `ManualLayout`, `FlowLayout`, `DiagramExit`, `DiagramEnter`) are sub-components compiled inside `DiagramWidget`'s `CUSTOM_NODE_HANDLER`.

All 10 move to `diagram/widget.ts`. `DiagramWidget.ts` already imports all of them from `./dsl` and processes them in `childDslComponents` and the node handler. Cmd+click on `<DiagramNode>` navigates to `widget.ts` — the correct file where DiagramWidget processes it.

### 7b. `DiagramCanvas` / `DiagramPipe` (canvas sub-dsl)

`DiagramCanvas` has `DslComponent = DiagramCanvas` in `DiagramCanvasWidget`. `DiagramPipe` is a sub-component. Both move to `canvas/widget.ts`.

### 7c. `Label` and `Labels` from `model/labels/dsl.tsx`

**Decision: move to `ModelWidget.ts`.**

There is no `LabelWidget.ts`. `Label` and `Labels` are compiled by `ModelWidget.ts`'s `CUSTOM_NODE_HANDLER`, which already imports them from `../../labels/dsl`. The correct cmd+click destination for `<Label>` is `ModelWidget.ts` — that is where label compilation happens.

After the move: `labels/dsl.tsx` becomes types-only. `ModelWidget.ts` defines `Label` and `Labels` stubs before the class. The import in `ModelWidget.ts` changes from a value import to type-only:
```ts
// Before
import { Label } from '../../labels/dsl';
import type { LabelProps } from '../../labels/dsl';

// After
import type { LabelProps } from '../../labels/dsl';
// Label stub defined locally in this file
```

The `labels/index.ts` (if one exists) updates its re-export source for `Label` and `Labels` to point to `ModelWidget.ts`. If `labels/` has no `index.ts`, the primary model package index handles re-exports.

### 7d. `Model` and `ModelRouter` — `registerTypeFactory` pattern

`ModelWidget` uses `registerTypeFactory(Model, factory)` rather than `register()`. `Model` is the factory routing key; `ModelWidget.DslComponent = Model`. `ModelRouter` is a second stub in the same file, also imported by `ModelWidget`.

Both `Model` and `ModelRouter` move to `ModelWidget.ts` per Design Decision 7. The `registerTypeFactory(Model, ...)` call site imports `Model` from the package public API — unchanged after this refactor.

### 7e. `LightingWidget.ts` file size

`LightingWidget.ts` is currently 347 lines. Adding 11 stub declarations (~22 lines) and 11 `displayName` assignments (~11 lines) adds ~33 lines. This is acceptable — the stubs are trivial one-liners and the file remains navigable.

---

## 8. Open Questions

1. **Do composite element sub-component prop types need `@see` JSDoc links?**
   - When `DiagramNode` stub moves to `widget.ts`, the `DiagramNodeProps` interface stays in `dsl.tsx`. Should `DiagramNodeProps` gain a `@see DiagramWidget` comment to point developers to the implementation?
   - Low priority — the IDE navigation fix solves the discovery problem directly. Leave this for a follow-up if desired.

2. **Should `dsl.tsx` files be deleted after migration if they become very thin?**
   - Files like `background/dsl.tsx` (one prop type, `BackgroundProps`) become very thin but are still valid TypeScript type modules.
   - Retain them. Deletion risks breaking any internal consumers that import prop types directly from `./dsl`. The thin file is harmless.

3. **Does the `labels/` package need its own `index.ts` updated?**
   - Depends on whether `packages/model/src/labels/` has a public barrel that re-exports `Label` and `Labels`. Verify during implementation.

---

## 9. Summary

This is a pure developer experience improvement with zero runtime impact. No compiled output changes. No API surface changes. No semver bump required.

**Scope:** 13 `dsl.tsx` files and 13 `index.ts` files across 4 packages. 52 stub functions relocated. `@brewsite/slides` is excluded — its DSL compilation model is structurally incompatible with the stub-to-widget pattern.

**Result:** cmd+click on any DSL element navigates directly to the widget class that implements it. `dsl.tsx` files become pure type modules. Module boundary invariants are fully preserved.
