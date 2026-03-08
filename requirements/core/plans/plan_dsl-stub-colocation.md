---
title: DSL Stub Co-location Implementation Plan
doc_type: plan
owner: architect
status: draft
updated: 2026-03-08
---

# DSL Stub Co-location Implementation Plan

## 1. Overview and Architectural Principle

Every DSL element exposes a null-returning stub function (e.g., `export const Camera = (_props: CameraProps): null => null;`) that scene authors write in JSX. Today those stubs live in `dsl.tsx`. When a developer cmd+clicks `<Camera />` in a scene, their IDE navigates to the stub in `camera/dsl.tsx` — not to `CameraWidget.ts` where the behavior lives. This is daily friction.

**The change:** move each stub function declaration from `dsl.tsx` into the corresponding widget file. Prop type interfaces stay in `dsl.tsx`. The `index.ts` barrel for each element re-exports the stub from the widget file instead of from `dsl.tsx`. `dsl.tsx` becomes a pure type module.

**Module boundary invariant preserved:** `dsl.tsx` only loses exports — it gains no new imports. No circular dependencies are introduced. Three.js confinement is maintained (stubs move INTO widget files, which already import Three.js; scene authors import through package public API, never directly from widget files).

**Zero runtime impact.** Function identity is preserved: scene authors import stubs through `index.ts` → widget file, the same reference is assigned to `DslComponent`, and the same reference is used as the `nodeRegistry` Map key. No compiled output changes. No semver bump required.

**Scope confined to element modules.** No changes are made to compiler infrastructure files (`registry.ts`, `widget/types.ts`, `WidgetRegistry.ts`) or any other shared infrastructure. All changes are strictly confined to element module files (`dsl.tsx`, widget files) and their immediate barrels (`index.ts`).

---

## 2. The Canonical Pattern — Worked Example: `Camera`

This is the template every developer follows. All other elements follow this exact pattern.

### `camera/dsl.tsx` — Before

```tsx
// (types only — already clean)
export type CameraProps = CameraDescriptorProps & { ... };

/** Camera DSL component — returns null; consumed purely by the compiler. */
export const Camera = (_props: CameraProps): null => null;

Camera.displayName = 'Camera';
```

### `camera/dsl.tsx` — After

```tsx
// Types only — no function declarations.
export type CameraProps = CameraDescriptorProps & { ... };
```

The stub declaration and `Camera.displayName` assignment are removed entirely. The file comment at the top may be updated to read `// Camera DSL prop types — pure type module.` but this is optional.

### `CameraWidget.ts` — Before (relevant imports only)

```ts
import { Camera } from './dsl';          // value import — Camera function reference
import type { CameraProps } from './dsl'; // type import

export class CameraWidget ... {
  readonly DslComponent = Camera;
  ...
}
```

### `CameraWidget.ts` — After

```ts
import type { CameraProps } from './dsl'; // type-only import; value import removed

/** Camera DSL component — returns null; consumed purely by the compiler. */
export const Camera = (_props: CameraProps): null => null;

Camera.displayName = 'Camera';

export class CameraWidget ... {
  readonly DslComponent = Camera;  // unchanged — now references the locally-defined stub
  ...
}
```

Rules for CameraWidget.ts:
1. Add the stub **before the class declaration** — at the top of the file, after all imports.
2. Copy the stub verbatim from `dsl.tsx` (including the JSDoc comment and `displayName` assignment).
3. Remove `import { Camera } from './dsl'` (the value import). The type import stays.
4. `readonly DslComponent = Camera` is unchanged — it now resolves to the locally-defined stub.

### `camera/index.ts` — Before

```ts
export { Camera } from './dsl';
export { CameraWidget } from './CameraWidget';
// ... other exports unchanged
```

### `camera/index.ts` — After

```ts
export { Camera } from './CameraWidget';  // changed: was ./dsl
export { CameraWidget } from './CameraWidget';
// ... other exports unchanged
```

Only the source of the stub re-export changes. Prop type re-exports (if any) from `./dsl` are unchanged.

---

## 3. Work Streams — Parallel Execution Plan

Five independent streams. Each touches a completely disjoint set of files.

**Parallelism safety note — Streams A and B:** Streams A and B both modify `packages/core/src/elements/` (different subdirectories, no shared files). Streams C, D, and E touch completely separate packages and are safe to run in any order simultaneously. For Streams A and B, choose one of:

- **Option 1 (recommended): Separate git worktrees.** Create two branches — one for A, one for B — so each developer's `pnpm --filter @brewsite/core typecheck` sees only their own changes. Merge both into main when complete.
- **Option 2: Sequential execution.** One developer completes Stream A entirely (typecheck passes) before another starts Stream B in the same branch.
- **Option 3: Atomic file pairs.** If running in the same branch, only run `pnpm typecheck` after completing a full file pair atomically: `dsl.tsx` (stub removed) + `{Widget}.ts` (stub added) in the same commit. Never run typecheck after removing a stub without also having added it to the widget file.

Streams C, D, and E are fully independent of each other and of A and B.

---

### Stream A — `@brewsite/core`: camera, background, floor, environment

**Package typecheck command:** `pnpm --filter @brewsite/core typecheck`
**Package test command:** `pnpm --filter @brewsite/core test`

#### File 1: `packages/core/src/elements/camera/dsl.tsx`

Remove the stub declaration and `displayName` assignment (lines 97–99 currently):

```ts
// REMOVE these two lines:
export const Camera = (_props: CameraProps): null => null;

Camera.displayName = 'Camera';
```

Leave all type declarations (`WorldCameraProps`, `OrbitCameraProps`, `FitBotHeightCameraProps`, `FitFloorDepthCameraProps`, `CameraDescriptorProps`, `CameraProps`) untouched.

#### File 2: `packages/core/src/elements/camera/CameraWidget.ts`

Step 1 — Change the import block at lines 14–15:
```ts
// Before:
import { Camera } from './dsl';
import type { CameraProps } from './dsl';

// After:
import type { CameraProps } from './dsl';
```

Step 2 — Add the stub before the `class CameraWidget` declaration. The stub is placed immediately after all import statements, before `const defaultDriverFactory`. Insert verbatim:

```ts
/** Camera DSL component — returns null; consumed purely by the compiler. */
export const Camera = (_props: CameraProps): null => null;

Camera.displayName = 'Camera';
```

The `readonly DslComponent = Camera;` inside the class body requires no change.

#### File 3: `packages/core/src/elements/camera/index.ts`

Change line 21:
```ts
// Before:
export { Camera } from './dsl';

// After:
export { Camera } from './CameraWidget';
```

---

#### File 4: `packages/core/src/elements/background/dsl.tsx`

Remove the stub and displayName (currently lines 57–59):
```ts
// REMOVE:
export const Background = (_props: BackgroundProps) => null;

Background.displayName = 'Background';
```

Leave `BackgroundProps` type declaration untouched.

#### File 5: `packages/core/src/elements/background/BackgroundWidget.ts`

Step 1 — Change line 17 (value import):
```ts
// Before:
import { Background } from './dsl';

// After (delete line):
// (line removed)
```

The type import on line 15 (`import type { BackgroundProps } from './dsl'`) stays unchanged.

Step 2 — Add stub before the `export class BackgroundWidget` declaration, after all imports. Insert verbatim:

```ts
/**
 * Scene background element. Uses CSS background props (`cssPosition`, `cssSize`, `cssRepeat`).
 */
export const Background = (_props: BackgroundProps) => null;

Background.displayName = 'Background';
```

Note: This stub uses **arrow const without explicit return type** — do not add `: null` annotation.

#### File 6: `packages/core/src/elements/background/index.ts`

Change line 2:
```ts
// Before:
export { Background } from './dsl';

// After:
export { Background } from './BackgroundWidget';
```

---

#### File 7: `packages/core/src/elements/floor/dsl.tsx`

Remove three stub declarations and their displayName assignments. The stubs appear at lines 42–44, 75–76, and 87–88 currently:

```ts
// REMOVE (all three stubs + displayName lines):
export const Floor = (_props: FloorProps) => null;
Floor.displayName = 'Floor';

export const FloorPhysical = (_props: FloorPhysicalProps) => null;
FloorPhysical.displayName = 'FloorPhysical';

export const FloorMirror = (_props: FloorMirrorProps) => null;
FloorMirror.displayName = 'FloorMirror';
```

Leave `FloorProps`, `FloorPhysicalProps`, `FloorMirrorProps` type declarations untouched.

#### File 8: `packages/core/src/elements/floor/FloorWidget.ts`

Step 1 — Change line 14 (combined value+type import):
```ts
// Before:
import { Floor, FloorMirror, FloorPhysical, type FloorMirrorProps, type FloorPhysicalProps, type FloorProps } from './dsl';

// After:
import type { FloorMirrorProps, FloorPhysicalProps, FloorProps } from './dsl';
```

Step 2 — Add stubs before the `export class FloorWidget` declaration, after all imports. Insert verbatim (exact style from dsl.tsx):

```ts
/**
 * Floor element.
 *
 * Visible output requires one surface child:
 * - `<FloorPhysical ... />`
 * - `<FloorMirror ... />`
 */
export const Floor = (_props: FloorProps) => null;

Floor.displayName = 'Floor';

export const FloorPhysical = (_props: FloorPhysicalProps) => null;
FloorPhysical.displayName = 'FloorPhysical';

export const FloorMirror = (_props: FloorMirrorProps) => null;
FloorMirror.displayName = 'FloorMirror';
```

The `readonly DslComponent = Floor as React.ComponentType<...>` inside the class body requires no change. The `component: FloorPhysical` and `component: FloorMirror` references in `childDslComponents` require no change — they now resolve to locally-defined stubs.

#### File 9: `packages/core/src/elements/floor/index.ts`

Change line 2:
```ts
// Before:
export { Floor, FloorPhysical, FloorMirror } from './dsl';

// After:
export { Floor, FloorPhysical, FloorMirror } from './FloorWidget';
```

---

#### File 10: `packages/core/src/elements/environment/dsl.tsx`

Remove four stub declarations and displayName assignments (Environment, EnvironmentHdri, EnvironmentExr, EnvironmentCube). These are currently at the end of the file.

```ts
// REMOVE (all four stubs + displayName lines):
export const Environment = (_props: EnvironmentProps) => null;
Environment.displayName = 'Environment';

export const EnvironmentHdri = (_props: EnvironmentHdriProps) => null;
EnvironmentHdri.displayName = 'EnvironmentHdri';

export const EnvironmentExr = (_props: EnvironmentExrProps) => null;
EnvironmentExr.displayName = 'EnvironmentExr';

export const EnvironmentCube = (_props: EnvironmentCubeProps) => null;
EnvironmentCube.displayName = 'EnvironmentCube';
```

Leave all prop type declarations untouched.

#### File 11: `packages/core/src/elements/environment/EnvironmentWidget.ts`

Step 1 — Change lines 17–25 (combined value+type import block):
```ts
// Before:
import {
  Environment,
  EnvironmentCube,
  EnvironmentExr,
  EnvironmentHdri,
  type EnvironmentCubeProps,
  type EnvironmentExrProps,
  type EnvironmentHdriProps,
  type EnvironmentProps,
} from './dsl';

// After:
import type {
  EnvironmentCubeProps,
  EnvironmentExrProps,
  EnvironmentHdriProps,
  EnvironmentProps,
} from './dsl';
```

Step 2 — Add stubs before `export class EnvironmentWidget`, after all imports. Insert verbatim:

```ts
/**
 * Environment lighting (IBL) element.
 *
 * Requires one source child to produce an environment map:
 * - `<EnvironmentHdri url="..." />`
 * - `<EnvironmentExr url="..." />`
 * - `<EnvironmentCube urls={[...]} />`
 */
export const Environment = (_props: EnvironmentProps) => null;

Environment.displayName = 'Environment';

export const EnvironmentHdri = (_props: EnvironmentHdriProps) => null;
EnvironmentHdri.displayName = 'EnvironmentHdri';

export const EnvironmentExr = (_props: EnvironmentExrProps) => null;
EnvironmentExr.displayName = 'EnvironmentExr';

export const EnvironmentCube = (_props: EnvironmentCubeProps) => null;
EnvironmentCube.displayName = 'EnvironmentCube';
```

All `component: EnvironmentHdri/EnvironmentExr/EnvironmentCube` references in `childDslComponents` require no change. `childEl.type === EnvironmentHdri` etc. in the CUSTOM_NODE_HANDLER require no change.

#### File 12: `packages/core/src/elements/environment/index.ts`

Change line 8:
```ts
// Before:
export { Environment, EnvironmentHdri, EnvironmentExr, EnvironmentCube } from './dsl';

// After:
export { Environment, EnvironmentHdri, EnvironmentExr, EnvironmentCube } from './EnvironmentWidget';
```

---

### Stream A — Test File Updates

These test files import stub functions directly from `dsl.tsx` and will fail after the stubs are removed. Update each import to point to the widget file:

**`packages/core/src/elements/background/__tests__/BackgroundCompile.test.ts`** — line 2:
```ts
// Before:
import { Background } from '../dsl';
// After:
import { Background } from '../BackgroundWidget';
```

**`packages/core/src/elements/floor/__tests__/FloorCompile.test.ts`** — line 2:
```ts
// Before:
import { Floor } from '../dsl';
// After:
import { Floor } from '../FloorWidget';
```

**`packages/core/src/elements/floor/__tests__/FloorWidget.test.ts`** — line 9:
```ts
// Before:
import { FloorPhysical, FloorMirror } from '../dsl';
// After:
import { FloorPhysical, FloorMirror } from '../FloorWidget';
```

**`packages/core/src/elements/environment/__tests__/EnvironmentCompile.test.ts`** — line 2:
```ts
// Before:
import { Environment } from '../dsl';
// After:
import { Environment } from '../EnvironmentWidget';
```

**`packages/core/src/elements/environment/__tests__/EnvironmentWidget.test.ts`** — line 9:
```ts
// Before:
import { EnvironmentHdri, EnvironmentCube } from '../dsl';
// After:
import { EnvironmentHdri, EnvironmentCube } from '../EnvironmentWidget';
```

No camera element test files import Camera directly from `../dsl` — no camera test changes needed.

Type-only imports (`import type { ... } from '../dsl'`) in any test file are unchanged.

### Stream A — Verification Checklist

- [ ] `camera/dsl.tsx`: Camera stub removed, CameraProps type intact
- [ ] `CameraWidget.ts`: Camera stub declared before class, `import { Camera }` line removed, `import type { CameraProps }` retained
- [ ] `camera/index.ts`: Camera re-exports from `./CameraWidget`
- [ ] `background/dsl.tsx`: Background stub removed, BackgroundProps type intact
- [ ] `BackgroundWidget.ts`: Background stub declared before class, value import removed, type import retained
- [ ] `background/index.ts`: Background re-exports from `./BackgroundWidget`
- [ ] `floor/dsl.tsx`: Floor, FloorPhysical, FloorMirror stubs removed; all prop types intact
- [ ] `FloorWidget.ts`: All 3 stubs declared before class; import changed from mixed value+type to type-only
- [ ] `floor/index.ts`: Floor, FloorPhysical, FloorMirror re-export from `./FloorWidget`
- [ ] `environment/dsl.tsx`: All 4 stubs removed; all prop types intact
- [ ] `EnvironmentWidget.ts`: All 4 stubs declared before class; import changed to type-only
- [ ] `environment/index.ts`: All 4 stubs re-export from `./EnvironmentWidget`
- [ ] Test file imports updated (5 test files listed above)
- [ ] `pnpm --filter @brewsite/core typecheck` passes
- [ ] `pnpm --filter @brewsite/core test` passes

---

### Stream B — `@brewsite/core`: lighting

**Package typecheck command:** `pnpm --filter @brewsite/core typecheck`
**Package test command:** `pnpm --filter @brewsite/core test`

#### File 1: `packages/core/src/elements/lighting/dsl.tsx`

Remove the 11 stub declarations and 11 displayName assignments at the bottom of the file (currently lines 133–155):

```ts
// REMOVE all 11 stubs + 11 displayName lines:
export const Lighting = (_props: LightingProps) => null;
export const Ambient = (_props: AmbientProps) => null;
export const Directional = (_props: DirectionalProps) => null;
export const Point = (_props: PointProps) => null;
export const GlowPoint = (_props: GlowPointProps) => null;
export const Spot = (_props: SpotProps) => null;
export const LightStrand = (_props: LightStrandProps) => null;
export const Wave = (_props: WaveProps) => null;
export const Circle = (_props: CircleProps) => null;
export const Rectangle = (_props: RectangleProps) => null;
export const Panel = (_props: PanelProps) => null;

Lighting.displayName = 'Lighting';
Ambient.displayName = 'Ambient';
// ... all 11 displayName assignments
```

Leave all prop type declarations (`AmbientProps`, `DirectionalProps`, `PointProps`, `GlowPointProps`, `SpotProps`, `LightStrandProps`, `WaveProps`, `CircleProps`, `RectangleProps`, `PanelProps`, `LightingProps`) and the `Resolvable<T>` type alias untouched.

#### File 2: `packages/core/src/elements/lighting/LightingWidget.ts`

Step 1 — Replace lines 16–38 (the large mixed import block) with type-only imports:

```ts
// Before (lines 16–38):
import {
  Lighting,
  Ambient,
  Directional,
  GlowPoint,
  Point,
  Spot,
  LightStrand,
  Wave,
  Circle,
  Rectangle,
  Panel,
  type AmbientProps,
  type DirectionalProps,
  type GlowPointProps,
  type PointProps,
  type SpotProps,
  type LightStrandProps,
  type WaveProps,
  type CircleProps,
  type RectangleProps,
  type PanelProps,
  type LightingProps,
} from './dsl';

// After:
import type {
  AmbientProps,
  DirectionalProps,
  GlowPointProps,
  PointProps,
  SpotProps,
  LightStrandProps,
  WaveProps,
  CircleProps,
  RectangleProps,
  PanelProps,
  LightingProps,
} from './dsl';
```

Step 2 — Add all 11 stubs before `export class LightingWidget`, after all imports. Insert verbatim, grouped by logical unit. Note: these stubs use **arrow const without explicit return type** and have no JSDoc comments in the original.

```ts
// ─── Lighting DSL stubs ───────────────────────────────────────────────────────
export const Lighting = (_props: LightingProps) => null;
export const Ambient = (_props: AmbientProps) => null;
export const Directional = (_props: DirectionalProps) => null;
export const Point = (_props: PointProps) => null;
export const GlowPoint = (_props: GlowPointProps) => null;
export const Spot = (_props: SpotProps) => null;
export const LightStrand = (_props: LightStrandProps) => null;
export const Wave = (_props: WaveProps) => null;
export const Circle = (_props: CircleProps) => null;
export const Rectangle = (_props: RectangleProps) => null;
export const Panel = (_props: PanelProps) => null;

Lighting.displayName = 'Lighting';
Ambient.displayName = 'Ambient';
Directional.displayName = 'Directional';
Point.displayName = 'Point';
GlowPoint.displayName = 'GlowPoint';
Spot.displayName = 'Spot';
LightStrand.displayName = 'LightStrand';
Wave.displayName = 'Wave';
Circle.displayName = 'Circle';
Rectangle.displayName = 'Rectangle';
Panel.displayName = 'Panel';
```

The `readonly DslComponent = Lighting as React.ComponentType<...>` inside the class body requires no change. All `component: Ambient`, `component: Wave`, etc. in `childDslComponents` require no change. All `childEl.type === Ambient` etc. in the CUSTOM_NODE_HANDLER require no change.

#### File 3: `packages/core/src/elements/lighting/index.ts`

Change line 18:
```ts
// Before:
export { Lighting, Ambient, Directional, GlowPoint, Point, Spot, LightStrand, Wave, Circle, Rectangle, Panel } from './dsl';

// After:
export { Lighting, Ambient, Directional, GlowPoint, Point, Spot, LightStrand, Wave, Circle, Rectangle, Panel } from './LightingWidget';
```

---

### Stream B — Test File Updates

Three test files import lighting stubs directly from `../dsl`:

**`packages/core/src/elements/lighting/__tests__/LightingWidget.test.ts`** — line 11:
```ts
// Before:
import { Ambient, Directional, GlowPoint, Point, Spot, LightStrand, Wave, Panel, Lighting } from '../dsl';
// After:
import { Ambient, Directional, GlowPoint, Point, Spot, LightStrand, Wave, Panel, Lighting } from '../LightingWidget';
```

**`packages/core/src/elements/lighting/__tests__/LightingWidgetDsl.test.tsx`** — the import block from `'../dsl'`:
```ts
// Before (exact names vary — check the file):
import {
  Lighting,
  Ambient,
  Directional,
  Point,
  Spot,
  LightStrand,
  Wave,
  Panel,
} from '../dsl';
// After: same names, change source to '../LightingWidget'
import {
  Lighting,
  Ambient,
  Directional,
  Point,
  Spot,
  LightStrand,
  Wave,
  Panel,
} from '../LightingWidget';
```

**`packages/core/src/elements/lighting/__tests__/LightingCompile.test.ts`** — lines 12–21:
```ts
// Before:
import {
  Lighting,
  Ambient,
  Directional,
  Point,
  Spot,
  Panel,
  GlowPoint,
  LightStrand,
} from '../dsl';
// After:
import {
  Lighting,
  Ambient,
  Directional,
  Point,
  Spot,
  Panel,
  GlowPoint,
  LightStrand,
} from '../LightingWidget';
```

Type-only imports from `'../dsl'` in any test file are unchanged.

### Stream B — Verification Checklist

- [ ] `lighting/dsl.tsx`: All 11 stubs removed; all 11 prop types and `Resolvable<T>` intact
- [ ] `LightingWidget.ts`: All 11 stubs declared before class (with displayName); import block changed to type-only
- [ ] `lighting/index.ts`: All 11 stubs re-export from `./LightingWidget`
- [ ] Test file imports updated (3 test files listed above)
- [ ] `pnpm --filter @brewsite/core typecheck` passes
- [ ] `pnpm --filter @brewsite/core test` passes

---

### Stream C — `@brewsite/model`

**Package typecheck command:** `pnpm --filter @brewsite/model typecheck`
**Package test command:** `pnpm --filter @brewsite/model test`

**Important — two dsl.tsx files and a cross-file special case:** Stream C touches both `elements/model/dsl.tsx` (11 stubs) and `labels/dsl.tsx` (2 stubs). The `Label` and `Labels` stubs move to `ModelWidget.ts` along with all model stubs — NOT to a separate labels widget. Additionally, `handlers.ts` imports `Label` and `Labels` from `./labels/dsl` for guard handler registration; this import must be updated.

#### File 1: `packages/model/src/elements/model/dsl.tsx`

Remove all 11 stub declarations. Note: **these stubs have NO displayName assignments and NO explicit return type annotation.** The stubs appear at lines 161–171:

```ts
// REMOVE all 11 lines:
export const Model = (_props: ModelProps) => null;
export const ModelRouter = (_props: ModelProps) => null;
export const BodyParts = (_props: { children?: ReactNode }) => null;
export const BodyPart = (_props: BodyPartByIdProps) => null;
export const Pose = (_props: PoseProps) => null;
export const ModelPart = (_props: ModelPartProps) => null;
export const ContainedModel = (_props: ContainedModelProps) => null;
export const Subpart = (_props: SubpartProps) => null;
export const Playback = (_props: PlaybackProps) => null;
export const Motion = (_props: MotionProps) => null;
export const Animation = (_props: AnimationProps) => null;
```

The section comment `// ─── DSL Components (render as null - compilation happens in ModelWidget) ───` should be removed as well since there will be no function declarations remaining.

Leave all prop type declarations untouched.

#### File 2: `packages/model/src/elements/model/ModelWidget.ts`

**This is the most complex file in Stream C.** Proceed step by step.

Step 1 — Remove value imports from `./dsl`. Change line 37:
```ts
// Before:
import {Animation, BodyPart, BodyParts, ContainedModel, ModelPart, ModelRouter, Motion, Playback, Pose, Subpart,} from './dsl';

// After: (remove this entire line)
```

Step 2 — Remove value import of `Label` from labels/dsl. Change line 39:
```ts
// Before:
import {Label} from '../../labels/dsl';

// After: (remove this entire line)
```

The type imports on lines 36 and 38 stay unchanged:
```ts
import type {AnimationProps, BodyPartByIdProps, ContainedModelProps, ModelPartProps, ModelProps, MotionProps, PlaybackProps, PoseProps, SubpartProps,} from './dsl';
import type {LabelProps} from '../../labels/dsl';
```

**`ReactNode` check (do this before Step 3):** `Labels` requires `ReactNode` for its prop type `{ children?: ReactNode }`. Search `ModelWidget.ts` for any existing `import type { ReactNode }` or `import { ... ReactNode ... } from 'react'`. If `ReactNode` is not already imported, add it to the existing react import at the top of the imports block:
```ts
// Add ReactNode to whichever react import already exists, e.g.:
import type { ReactNode, ReactElement } from 'react';
// or: add import type { ReactNode } from 'react'; as a new line in the imports section
```
**Never place an import statement after non-import code** — all imports must stay at the top of the file.

Step 3 — Add stubs before the `export type ModelWidgetConfig` declaration (which is before the class). Place all stubs after all import lines, before the first exported type/constant. Insert verbatim:

> **Important:** `Model` stub is being **added** to this file — it was NOT previously imported by `ModelWidget.ts` (line 37 imports `ModelRouter` but not `Model`). Both `Model` and `ModelRouter` must be present in the widget file after this change.

```ts
// ─── Model DSL stubs ──────────────────────────────────────────────────────────
export const Model = (_props: ModelProps) => null;
export const ModelRouter = (_props: ModelProps) => null;
export const BodyParts = (_props: { children?: ReactNode }) => null;
export const BodyPart = (_props: BodyPartByIdProps) => null;
export const Pose = (_props: PoseProps) => null;
export const ModelPart = (_props: ModelPartProps) => null;
export const ContainedModel = (_props: ContainedModelProps) => null;
export const Subpart = (_props: SubpartProps) => null;
export const Playback = (_props: PlaybackProps) => null;
export const Motion = (_props: MotionProps) => null;
export const Animation = (_props: AnimationProps) => null;

// ─── Label DSL stubs (compiled by this widget's CUSTOM_NODE_HANDLER) ──────────
/**
 * Label attached to a model part.
 *
 * Must be nested under `<BodyPart>` or `<Subpart>`.
 * `targetPartId` is resolved automatically from the parent body-part context
 * and is not set directly on `<Label>`.
 */
export const Label = (_props: LabelProps) => null;
Label.displayName = 'Label';

export const Labels = (_props: { children?: ReactNode }) => null;
Labels.displayName = 'Labels';
```

The `readonly DslComponent = ModelRouter` inside the class body requires no change. All `isComponent(ce, BodyPart)`, `isComponent(ce, ContainedModel)`, etc. comparisons in the CUSTOM_NODE_HANDLER require no change — they now resolve to locally-defined stubs.

#### File 3: `packages/model/src/elements/model/index.ts`

Change the DSL component re-export block (lines 50–62):
```ts
// Before:
export {
  Model,
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from './dsl';

// After:
export {
  Model,
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from './ModelWidget';
```

The `export type { ModelProps, BodyPartProps, ... } from './dsl'` block (lines 63–74) is unchanged — prop types stay in `./dsl`.

#### File 4: `packages/model/src/labels/dsl.tsx`

Remove the two stub declarations and displayName assignments (currently lines 17–21):
```ts
// REMOVE:
export const Label = (_props: LabelProps) => null;
Label.displayName = 'Label';

export const Labels = (_props: { children?: ReactNode }) => null;
Labels.displayName = 'Labels';
```

Leave `LabelProps` type alias and all imports untouched. The file becomes a pure type module.

#### File 5: `packages/model/src/labels/index.ts`

Change line 2:
```ts
// Before:
export { Label, Labels } from './dsl';

// After:
export { Label, Labels } from '../elements/model/ModelWidget';
```

All other exports in `labels/index.ts` are unchanged.

#### File 6: `packages/model/src/index.ts`

Two changes required in this file:

Change 1 — Model DSL components block (lines 29–41). Change source from `./elements/model/dsl` → `./elements/model/ModelWidget`:
```ts
// Before:
export {
  Model,
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from './elements/model/dsl';

// After:
export {
  Model,
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from './elements/model/ModelWidget';
```

The `export type { ModelProps, ... } from './elements/model/dsl'` block (lines 42–53) is unchanged.

Change 2 — Label export (line 57):
```ts
// Before:
export { Label } from './labels/dsl';

// After:
export { Label } from './labels';
```

This works because `labels/index.ts` now re-exports `Label` from `../elements/model/ModelWidget`.

#### File 7: `packages/model/src/handlers.ts`

Change the import at line 4:
```ts
// Before:
import { Label, Labels } from './labels/dsl';

// After:
import { Label, Labels } from './elements/model/ModelWidget';
```

This ensures the guard handler registration uses the same function references that scene authors import through the public API — preserving the `nodeRegistry` Map key identity.

---

### Stream C — Test File Updates

Eight test files import model/label stubs from `dsl.tsx` files. All of them will break after the stubs are removed. Update each:

**`packages/model/src/elements/model/__tests__/ModelDsl.test.ts`** — line 2–13:
```ts
// Before:
import {
  Model,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from '../dsl';
// After: same names, change source to '../ModelWidget'
import {
  Model,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from '../ModelWidget';
```

**`packages/model/src/elements/model/__tests__/ModelWidgetDsl.test.tsx`** — lines 4–15:
```ts
// Before:
import {
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from '../dsl';
// After:
import {
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from '../ModelWidget';
```

**`packages/model/src/elements/model/__tests__/ModelWidget.test.ts`** — lines 10–21:
```ts
// Before (two separate imports):
import {
  Animation,
  BodyPart,
  BodyParts,
  ContainedModel,
  ModelPart,
  Motion,
  Playback,
  Pose,
  Subpart,
} from '../dsl';
import { Label } from '../../../labels/dsl';

// After: both stubs now live in ModelWidget — merge into one import:
import {
  Animation,
  BodyPart,
  BodyParts,
  ContainedModel,
  ModelPart,
  Motion,
  Playback,
  Pose,
  Subpart,
  Label,
} from '../ModelWidget';
```

**`packages/model/src/elements/model/__tests__/ModelIndex.test.ts`** — line 20 (reference-identity test):
```ts
// Before:
import { Model as DIRECT_MODEL, Playback as DIRECT_PLAYBACK } from '../dsl';
// After:
import { Model as DIRECT_MODEL, Playback as DIRECT_PLAYBACK } from '../ModelWidget';
```
This maintains the test's semantic intent (verifying that `../index` re-exports the same reference as the source file) — the source file is now `ModelWidget`, not `dsl`.

**`packages/model/src/__tests__/handlers.test.ts`** — line 5:
```ts
// Before:
import { Label } from '../labels/dsl';
// After:
import { Label } from '../elements/model/ModelWidget';
```

**`packages/model/src/labels/__tests__/LabelCompile.test.tsx`** — line 5:
```ts
// Before:
import { Label, Labels } from '../dsl';
// After:
import { Label, Labels } from '../../elements/model/ModelWidget';
```

**`packages/model/src/labels/__tests__/dsl.test.ts`** — **Decision: Option A — update import path, keep test intent.**

This test verifies stub behavior: `Label` and `Labels` return null and have the correct `displayName`. That behavior remains valid after the move — the stubs are functionally identical, just defined in a different file. Update the import and keep the test as-is:
```ts
// Before:
import { Label, Labels } from '../dsl';
// After:
import { Label, Labels } from '../../elements/model/ModelWidget';
```
Renaming the file (e.g., from `dsl.test.ts` to `LabelStubs.test.ts`) is optional but recommended to avoid confusion about what it tests. The plan does not require the rename, but the developer may choose to do it.

**`packages/model/src/labels/__tests__/index.test.ts`** — line 8 (reference-identity test):
```ts
// Before:
import { Label as DirectLabel, Labels as DirectLabels } from '../dsl';
// After:
import { Label as DirectLabel, Labels as DirectLabels } from '../../elements/model/ModelWidget';
```

Type-only imports (`import type { ... }`) from any `dsl` file in test files are unchanged.

### Stream C — Verification Checklist

- [ ] `elements/model/dsl.tsx`: All 11 stubs removed; all prop types intact; section comment removed
- [ ] `ModelWidget.ts`: All 11 model stubs declared before class (no displayName — stubs had none originally); Label and Labels stubs declared before class (with displayName); all value imports from `./dsl` removed; value import of Label from `../../labels/dsl` removed; type imports retained; `ReactNode` added to imports block if not already present
- [ ] `elements/model/index.ts`: All 11 model DSL stubs re-export from `./ModelWidget`
- [ ] `labels/dsl.tsx`: Label and Labels stubs removed; LabelProps type intact
- [ ] `labels/index.ts`: Label and Labels re-export from `../elements/model/ModelWidget`
- [ ] `model/src/index.ts`: Model DSL components re-export from `./elements/model/ModelWidget`; Label re-exports via `./labels`
- [ ] `handlers.ts`: Label and Labels imported from `./elements/model/ModelWidget`
- [ ] Test file imports updated (8 test files listed above)
- [ ] `pnpm --filter @brewsite/model typecheck` passes
- [ ] `pnpm --filter @brewsite/model test` passes

---

### Stream D — `@brewsite/diagram`

**Package typecheck command:** `pnpm --filter @brewsite/diagram typecheck`
**Package test command:** `pnpm --filter @brewsite/diagram test`

**Important — two index files for diagram stubs:** `diagram/elements/diagram/index.ts` exports 9 of the 10 diagram stubs. `diagram/src/index.ts` exports all 10 (including `FlowLayout` which is absent from the element-level barrel). Both index files must be updated.

#### File 1: `packages/diagram/src/elements/diagram/dsl.tsx`

Remove all 10 stub declarations. These stubs use **function declarations** (not arrow consts) with explicit `: null` return type. No displayName assignments in this file.

```ts
// REMOVE all 10 function declarations:
export function DiagramNode(_props: DiagramNodeProps): null {
  return null;
}

export function DiagramEdge(_props: DiagramEdgeProps): null {
  return null;
}

export function DiagramGroup(_props: DiagramGroupProps): null {
  return null;
}

export function GridLayout(_props: GridLayoutProps): null {
  return null;
}

export function HierarchicalLayout(_props: HierarchicalLayoutProps): null {
  return null;
}

export function ManualLayout(_props: ManualLayoutProps): null {
  return null;
}

export function FlowLayout(_props: FlowLayoutProps): null {
  return null;
}

export function Diagram(_props: DiagramProps): null {
  return null;
}

export function DiagramExit(_props: DiagramExitProps): null {
  return null;
}

export function DiagramEnter(_props: DiagramEnterProps): null {
  return null;
}
```

Leave all interface declarations (`DiagramNodeProps`, `DiagramEdgeProps`, etc.) untouched. Also leave the `import React from 'react'` and all other imports untouched unless they were only needed by the removed stubs.

**Note:** After stub removal, `import React from 'react'` may be unused in `dsl.tsx` (it was only needed if JSX was used in the stubs, which for null-returning functions it isn't). Check whether `React` is referenced in any remaining prop type. In `DiagramGroupProps` and `DiagramProps`, `children?: React.ReactNode` IS used, so the `React` import must stay.

#### File 2: `packages/diagram/src/elements/diagram/widget.ts`

Step 1 — Change lines 16–27 (value import block):
```ts
// Before:
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
} from './dsl';

// After: (remove entire block)
```

There are no type imports from `./dsl` in `widget.ts` (it imports from `./types` and other files). After removing the block, verify the file still compiles.

Step 2 — Add all 10 stubs before `export class DiagramWidget`, after all imports. Copy verbatim from `dsl.tsx` — function declaration style, exact JSDoc comments:

```ts
/** Declares a diagram node (shape with label). ... */
export function DiagramNode(_props: DiagramNodeProps): null {
  return null;
}

/** Declares a directed connector between two diagram nodes. ... */
export function DiagramEdge(_props: DiagramEdgeProps): null {
  return null;
}

/** Declares a visual grouping container. ... */
export function DiagramGroup(_props: DiagramGroupProps): null {
  return null;
}

/** Declares a grid auto-layout. ... */
export function GridLayout(_props: GridLayoutProps): null {
  return null;
}

/** Declares a topological auto-layout. ... */
export function HierarchicalLayout(_props: HierarchicalLayoutProps): null {
  return null;
}

/** Declares that all node positions are manually specified. ... */
export function ManualLayout(_props: ManualLayoutProps): null {
  return null;
}

/** Declares a sequential flow auto-layout. ... */
export function FlowLayout(_props: FlowLayoutProps): null {
  return null;
}

/** A standalone 3D diagram element with nodes, edges, groups, and layout. ... */
export function Diagram(_props: DiagramProps): null {
  return null;
}

/** Declares exit animation for the parent <Diagram>. ... */
export function DiagramExit(_props: DiagramExitProps): null {
  return null;
}

/** Declares enter animation for the parent <Diagram>. ... */
export function DiagramEnter(_props: DiagramEnterProps): null {
  return null;
}
```

Copy the full JSDoc comments verbatim — do not truncate. The prop type imports (interfaces like `DiagramNodeProps`) must be resolvable. The types are currently declared in `dsl.tsx` and remain there. `widget.ts` needs to import them:

Add type imports from `./dsl` at the top of `widget.ts`:
```ts
import type {
  DiagramNodeProps,
  DiagramEdgeProps,
  DiagramGroupProps,
  GridLayoutProps,
  HierarchicalLayoutProps,
  ManualLayoutProps,
  FlowLayoutProps,
  DiagramProps,
  DiagramExitProps,
  DiagramEnterProps,
} from './dsl';
```

The `readonly DslComponent = Diagram` inside `DiagramWidget` class requires no change. All `component: DiagramNode` etc. references in `childDslComponents` require no change.

#### File 3: `packages/diagram/src/elements/diagram/index.ts`

Change lines 56–65 (9 stubs — FlowLayout is NOT exported from this barrel):
```ts
// Before:
export {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  DiagramExit,
  DiagramEnter,
} from './dsl';

// After:
export {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  DiagramExit,
  DiagramEnter,
} from './widget';
```

The `export type { DiagramExitProps, DiagramEnterProps, GridLayoutProps, ... } from './dsl'` block (lines 66–72) is unchanged — prop types stay in `./dsl`.

#### File 4: `packages/diagram/src/index.ts`

Change line 60 (which exports all 10 stubs including FlowLayout):
```ts
// Before:
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup, DiagramExit, DiagramEnter, GridLayout, HierarchicalLayout, ManualLayout, FlowLayout } from './elements/diagram/dsl';

// After:
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup, DiagramExit, DiagramEnter, GridLayout, HierarchicalLayout, ManualLayout, FlowLayout } from './elements/diagram/widget';
```

Line 61 (`export type { DiagramExitProps, ..., FlowLayoutProps } from './elements/diagram/dsl'`) is unchanged.

---

#### File 5: `packages/diagram/src/elements/diagram/canvas/dsl.tsx`

Remove two stub declarations. These use **function declaration** style with explicit `: null` return type:

```ts
// REMOVE:
export function DiagramCanvas(_props: DiagramCanvasProps): null {
  return null;
}

export function DiagramPipe(_props: DiagramPipeProps): null {
  return null;
}
```

Leave all interface declarations (`DiagramCanvasProps`, `DiagramPipeProps`) and imports untouched.

#### File 6: `packages/diagram/src/elements/diagram/canvas/widget.ts`

Step 1 — Change line 18 (value import):
```ts
// Before:
import { DiagramCanvas } from './dsl';

// After: (remove this line)
```

`DiagramPipe` is NOT imported in `widget.ts` (it is not used in DiagramCanvasWidget). No other import of `DiagramPipe` exists in the file.

Step 2 — Add type imports from `./dsl`. Currently there are **no type imports from `./dsl` in `canvas/widget.ts`** — only the value import of `DiagramCanvas`. After removing that value import, add this new import line at the top of the file with the other imports:
```ts
import type { DiagramCanvasProps, DiagramPipeProps } from './dsl';
```

Step 3 — Add stubs before `export function computeNdcForNvs` (the first export in the file, before the class). Insert verbatim:

```ts
/**
 * Root container for a multi-diagram composition.
 * ...
 */
export function DiagramCanvas(_props: DiagramCanvasProps): null {
  return null;
}

/**
 * Declares a tube connector between nodes in two different <Diagram> elements
 * inside the same <DiagramCanvas>.
 * ...
 */
export function DiagramPipe(_props: DiagramPipeProps): null {
  return null;
}
```

Copy full JSDoc comments verbatim from `canvas/dsl.tsx`.

The `readonly DslComponent = DiagramCanvas` inside `DiagramCanvasWidget` class requires no change.

#### File 7: `packages/diagram/src/elements/diagram/canvas/index.ts`

Change line 4:
```ts
// Before:
export { DiagramCanvas, DiagramPipe } from './dsl';

// After:
export { DiagramCanvas, DiagramPipe } from './widget';
```

Line 5 (`export type { DiagramCanvasProps, DiagramPipeProps } from './dsl'`) is unchanged.

---

#### File 8: `packages/diagram/src/elements/image-panel/dsl.tsx`

Remove the one stub declaration. Uses **function declaration** style:

```ts
// REMOVE:
export function ImagePanel(_props: ImagePanelProps): null {
  return null;
}
```

Leave `ImagePanelProps` interface and imports untouched.

#### File 9: `packages/diagram/src/elements/image-panel/widget.ts`

Step 1 — Change line 7:
```ts
// Before:
import { ImagePanel } from './dsl';

// After:
import type { ImagePanelProps } from './dsl';
```

If `ImagePanelProps` is already imported as a type elsewhere in the file, merge the import. Otherwise this becomes the new import from `./dsl`.

Step 2 — Add stub before `export class ImagePanelWidget`, after all imports. Insert verbatim:

```ts
/**
 * Renders a static image as a physical 3D floating panel in world space.
 * The image is a WebGL texture — fully supports tilt, lighting, and reflections.
 * For a live interactive website, use <Screen>.
 */
export function ImagePanel(_props: ImagePanelProps): null {
  return null;
}
```

The `readonly DslComponent = ImagePanel` inside the class requires no change.

#### File 10: `packages/diagram/src/elements/image-panel/index.ts`

Change line 4:
```ts
// Before:
export { ImagePanel } from './dsl';

// After:
export { ImagePanel } from './widget';
```

---

#### File 11: `packages/diagram/src/elements/screen/dsl.tsx`

Remove the one stub declaration:

```ts
// REMOVE:
export function Screen(_props: ScreenProps): null {
  return null;
}
```

Leave `ScreenProps` interface and imports untouched.

#### File 12: `packages/diagram/src/elements/screen/widget.ts`

Step 1 — Change line 7:
```ts
// Before:
import { Screen } from './dsl';

// After:
import type { ScreenProps } from './dsl';
```

Step 2 — Add stub before `export class ScreenWidget`, after all imports. Insert verbatim:

```ts
/**
 * Renders a live interactive website inside a physical 3D bezel frame.
 * The website is a real <iframe> — click, scroll, and interact normally.
 * The bezel and glow are WebGL objects that track the screen position.
 * The 3D scene renders behind the screen. The iframe faces the camera.
 * For a static image, use <ImagePanel> instead.
 */
export function Screen(_props: ScreenProps): null {
  return null;
}
```

The `readonly DslComponent = Screen` inside the class requires no change.

#### File 13: `packages/diagram/src/elements/screen/index.ts`

Change line 4:
```ts
// Before:
export { Screen } from './dsl';

// After:
export { Screen } from './widget';
```

---

### Stream D — Test File Updates

Six test files import diagram stubs directly from `dsl.tsx` files:

**`packages/diagram/src/__tests__/warnThreading.test.ts`** — line 12:
```ts
// Before:
import { Diagram, DiagramNode, DiagramGroup, DiagramEnter } from '../elements/diagram/dsl';
// After:
import { Diagram, DiagramNode, DiagramGroup, DiagramEnter } from '../elements/diagram/widget';
```

**`packages/diagram/src/player/__tests__/diagramPlugin.test.ts`** — lines 12–13:
```ts
// Before:
import { DiagramCanvas } from '../../elements/diagram/canvas/dsl';
import { Diagram, DiagramNode, ManualLayout } from '../../elements/diagram/dsl';
// After:
import { DiagramCanvas } from '../../elements/diagram/canvas/widget';
import { Diagram, DiagramNode, ManualLayout } from '../../elements/diagram/widget';
```

**`packages/diagram/src/compiler/__tests__/handlers.test.tsx`** — lines 5–8:
```ts
// Before:
import { Diagram, DiagramEdge, DiagramGroup, DiagramNode, GridLayout, ManualLayout } from '../../elements/diagram/dsl';
import { DiagramCanvas } from '../../elements/diagram/canvas/dsl';
import { ImagePanel } from '../../elements/image-panel/dsl';
import { Screen } from '../../elements/screen/dsl';
// After:
import { Diagram, DiagramEdge, DiagramGroup, DiagramNode, GridLayout, ManualLayout } from '../../elements/diagram/widget';
import { DiagramCanvas } from '../../elements/diagram/canvas/widget';
import { ImagePanel } from '../../elements/image-panel/widget';
import { Screen } from '../../elements/screen/widget';
```

**`packages/diagram/src/compiler/__tests__/layoutRegistration.test.ts`** — line 18:
```ts
// Before:
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  GridLayout,
  FlowLayout,
  HierarchicalLayout,
  ManualLayout,
} from '../../elements/diagram/dsl';
// After:
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  GridLayout,
  FlowLayout,
  HierarchicalLayout,
  ManualLayout,
} from '../../elements/diagram/widget';
```

**`packages/diagram/src/compiler/__tests__/handlers.inputConfig.test.ts`** — lines 6–7:
```ts
// Before:
import { DiagramCanvas, DiagramPipe } from '../../elements/diagram/canvas/dsl';
import { Diagram, DiagramNode } from '../../elements/diagram/dsl';
// After:
import { DiagramCanvas, DiagramPipe } from '../../elements/diagram/canvas/widget';
import { Diagram, DiagramNode } from '../../elements/diagram/widget';
```

**`packages/diagram/src/elements/diagram/__tests__/dsl.test.tsx`** — **Decision: Option A — update import path, keep test intent.**

This test verifies that diagram stub functions return null when called. That behavior is unchanged — the stubs are moving files, not changing behavior. Update the import to point to `'../widget'`:
```ts
// Before:
import {
  Diagram,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  DiagramEnter,
  DiagramExit,
} from '../dsl';
// After:
import {
  Diagram,
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  DiagramEnter,
  DiagramExit,
} from '../widget';
```
Renaming the file (e.g., from `dsl.test.tsx` to `DiagramStubs.test.tsx`) is optional. The plan does not require it.

Type-only imports from any `dsl` file are unchanged.

### Stream D — Verification Checklist

- [ ] `diagram/dsl.tsx`: All 10 stubs removed; all prop interfaces intact; `React` import retained (needed for `React.ReactNode`)
- [ ] `diagram/widget.ts`: All 10 stubs declared before class (function declaration style, full JSDoc); import block from `./dsl` removed; new `import type` block for prop types added
- [ ] `diagram/index.ts`: 9 stubs re-export from `./widget`; `FlowLayout` was NOT exported here (unchanged)
- [ ] `diagram/src/index.ts`: All 10 stubs re-export from `./elements/diagram/widget` (including FlowLayout)
- [ ] `canvas/dsl.tsx`: DiagramCanvas and DiagramPipe stubs removed; prop interfaces intact
- [ ] `canvas/widget.ts`: DiagramCanvas and DiagramPipe stubs declared before exports; value import removed; type import added
- [ ] `canvas/index.ts`: DiagramCanvas and DiagramPipe re-export from `./widget`
- [ ] `image-panel/dsl.tsx`: ImagePanel stub removed; ImagePanelProps intact
- [ ] `image-panel/widget.ts`: ImagePanel stub declared before class; import updated
- [ ] `image-panel/index.ts`: ImagePanel re-exports from `./widget`
- [ ] `screen/dsl.tsx`: Screen stub removed; ScreenProps intact
- [ ] `screen/widget.ts`: Screen stub declared before class; import updated
- [ ] `screen/index.ts`: Screen re-exports from `./widget`
- [ ] Test file imports updated (6 test files listed above)
- [ ] `pnpm --filter @brewsite/diagram typecheck` passes
- [ ] `pnpm --filter @brewsite/diagram test` passes

---

### Stream E — `@brewsite/charts`

**Package typecheck command:** `pnpm --filter @brewsite/charts typecheck`
**Package test command:** `pnpm --filter @brewsite/charts test`

#### File 1: `packages/charts/src/elements/chart/dsl.tsx`

Remove all 5 stub declarations and displayName assignments. These stubs use **function declaration** style with `displayName` assignments:

```ts
// REMOVE all 5 stubs + 5 displayName lines:
export function Chart(_props: ChartProps): null { return null; }
Chart.displayName = 'Chart';

export function ChartData(_props: ChartDataProps): null { return null; }
ChartData.displayName = 'ChartData';

export function ChartAxis(_props: ChartAxisProps): null { return null; }
ChartAxis.displayName = 'ChartAxis';

export function ChartSeries(_props: ChartSeriesProps): null { return null; }
ChartSeries.displayName = 'ChartSeries';

export function ChartLegend(_props: ChartLegendProps): null { return null; }
ChartLegend.displayName = 'ChartLegend';
```

Leave prop type declarations (`ChartProps`, `ChartDataProps`, `ChartAxisProps`, `ChartSeriesProps`, `ChartLegendProps`) and all imports untouched.

**Note on `import React from 'react'`:** `dsl.tsx` imports `React` from 'react'. Check whether `React` is used in any remaining prop type definition. `ChartProps` has `children?: React.ReactNode` — so `React` import must stay. Do not remove it.

#### File 2: `packages/charts/src/elements/chart/ChartWidget.ts`

Step 1 — Change line 6 (value import):
```ts
// Before:
import { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './dsl';

// After:
import type { ChartProps, ChartDataProps, ChartAxisProps, ChartSeriesProps, ChartLegendProps } from './dsl';
```

**Note:** `ChartProps`, etc. may already be imported elsewhere in `ChartWidget.ts` as type imports. If so, merge the type imports rather than duplicating. Verify the full existing import list before making changes.

Step 2 — Add stubs before `export class ChartWidget`, after all imports. Insert verbatim (function declaration style with displayName):

```ts
/**
 * Declares a 3D chart element.
 * Compiled by chartPlugin().configureRegistry() — never rendered to DOM.
 */
export function Chart(_props: ChartProps): null { return null; }
Chart.displayName = 'Chart';

/**
 * Declares the data source for a <Chart>.
 * Must be a direct child of <Chart>.
 */
export function ChartData(_props: ChartDataProps): null { return null; }
ChartData.displayName = 'ChartData';

/**
 * Declares one axis configuration for a <Chart>.
 * Must be a direct child of <Chart>.
 */
export function ChartAxis(_props: ChartAxisProps): null { return null; }
ChartAxis.displayName = 'ChartAxis';

/**
 * Declares one data series for a <Chart>.
 * Must be a direct child of <Chart>.
 * Multiple <ChartSeries> children yield a multi-series chart.
 */
export function ChartSeries(_props: ChartSeriesProps): null { return null; }
ChartSeries.displayName = 'ChartSeries';

/**
 * Configures the chart legend.
 * Must be a direct child of <Chart>.
 */
export function ChartLegend(_props: ChartLegendProps): null { return null; }
ChartLegend.displayName = 'ChartLegend';
```

#### File 3: `packages/charts/src/elements/chart/index.ts`

Change line 2:
```ts
// Before:
export { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './dsl';

// After:
export { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './ChartWidget';
```

Line 3 (`export type { ChartProps, ... } from './dsl'`) is unchanged.

#### File 4: `packages/charts/src/index.ts`

Change line 4:
```ts
// Before:
export { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './elements/chart/dsl';

// After:
export { Chart, ChartData, ChartAxis, ChartSeries, ChartLegend } from './elements/chart/ChartWidget';
```

Lines 5–11 (`export type { ChartProps, ... } from './elements/chart/dsl'`) are unchanged.

---

### Stream E — Test File Updates

One test file imports chart stubs directly from `dsl.tsx`:

**`packages/charts/src/compiler/__tests__/handlers.test.ts`** — line 3:
```ts
// Before:
import { ChartData, ChartAxis, ChartSeries, ChartLegend } from '../../elements/chart/dsl';
// After:
import { ChartData, ChartAxis, ChartSeries, ChartLegend } from '../../elements/chart/ChartWidget';
```

### Stream E — Verification Checklist

- [ ] `chart/dsl.tsx`: All 5 stubs removed; all prop types and `React` import intact
- [ ] `ChartWidget.ts`: All 5 stubs declared before class (function declaration style with displayName); value import removed; type imports added/merged
- [ ] `elements/chart/index.ts`: All 5 stubs re-export from `./ChartWidget`
- [ ] `charts/src/index.ts`: All 5 stubs re-export from `./elements/chart/ChartWidget`
- [ ] Test file imports updated (1 test file listed above)
- [ ] `pnpm --filter @brewsite/charts typecheck` passes
- [ ] `pnpm --filter @brewsite/charts test` passes

---

## 4. Special Cases — Full Instructions

### 4a. Diagram sub-components (no per-component widget file)

`diagram/dsl.tsx` has 10 stubs. Only `Diagram` has a `DslComponent = Diagram` in `DiagramWidget`. The remaining 9 (`DiagramNode`, `DiagramEdge`, `DiagramGroup`, `GridLayout`, `HierarchicalLayout`, `ManualLayout`, `FlowLayout`, `DiagramExit`, `DiagramEnter`) are compiled inside `DiagramWidget`'s `CUSTOM_NODE_HANDLER` and `childDslComponents`.

**Instruction:** All 10 stubs move to `diagram/widget.ts`. `DiagramWidget` already imports all of them from `./dsl`; after the move they are defined locally. Cmd+click on `<DiagramNode>` navigates to `widget.ts` — the correct file where `DiagramWidget` processes it.

### 4b. `DiagramCanvas` / `DiagramPipe`

`DiagramCanvas` has `DslComponent = DiagramCanvas` in `DiagramCanvasWidget`. `DiagramPipe` is a sub-component not imported by `DiagramCanvasWidget` directly.

**Instruction:** Both stubs move to `canvas/widget.ts`. Only `DiagramCanvas` requires removal of a value import from `canvas/widget.ts`. `DiagramPipe` currently has no value import in `widget.ts` — just add the stub. Add type import for both `DiagramCanvasProps` and `DiagramPipeProps`.

### 4c. `Label` and `Labels` → `ModelWidget.ts`

There is no `LabelWidget.ts`. `Label` and `Labels` are registered as top-level guard handlers in `handlers.ts`. `Label` is also compiled by `ModelWidget`'s CUSTOM_NODE_HANDLER inside `<BodyPart>` and `<Subpart>` children. `Labels` throws an error at top-level.

**Decision:** Both `Label` and `Labels` move to `ModelWidget.ts` — the file where label compilation happens. This is not an instance of the widget having `DslComponent = Label`; it is about routing cmd+click to the most relevant implementation file.

After the move:
- `labels/dsl.tsx` becomes types-only (LabelProps stays).
- `ModelWidget.ts` defines both stubs with their `displayName` assignments.
- `labels/index.ts` re-exports `Label, Labels` from `../elements/model/ModelWidget`.
- `handlers.ts` imports `Label, Labels` from `./elements/model/ModelWidget`.

### 4d. `Model` vs `ModelRouter` — DslComponent is `ModelRouter`, not `Model`

**Critical:** `ModelWidget.DslComponent = ModelRouter` (line 375 of ModelWidget.ts). `Model` is the factory routing key used by `registerTypeFactory` at the plugin level. `ModelWidget` does NOT currently import `Model` from `./dsl`.

After the move:
- Both `Model` and `ModelRouter` stubs are defined in `ModelWidget.ts`.
- `ModelWidget.DslComponent = ModelRouter` is unchanged.
- The `registerTypeFactory(Model, factory)` call in `plugin.ts` imports `Model` from the package public API (`@brewsite/model` → `model/src/index.ts` → `./elements/model/ModelWidget`). This import path is unchanged in behavior — only the re-export source changes.

### 4e. Model stubs have no `displayName` assignments

`packages/model/src/elements/model/dsl.tsx` stubs do NOT have `displayName` assignments. Do not add them when moving stubs to `ModelWidget.ts`. The model element uses the `isComponent()` helper which checks both reference equality AND `displayName`/`name` string match for robustness — but the original stubs had no `displayName`, so none should be added. Copy verbatim.

### 4f. `LightingWidget.ts` — 11 stubs, large file

`LightingWidget.ts` is currently ~347 lines. Adding 11 stubs (~11 lines) and 11 `displayName` assignments (~11 lines) brings it to ~369 lines. This is acceptable. Group all stubs together before the class declaration with a single section header comment. Do not interleave stubs with other code.

### 4g. `FlowLayout` is not in `diagram/elements/diagram/index.ts`

`FlowLayout` is exported from `diagram/src/index.ts` (re-exported directly from `./elements/diagram/dsl`) but is NOT in `diagram/elements/diagram/index.ts`. After the move, the developer must update `diagram/src/index.ts` to re-export `FlowLayout` from `./elements/diagram/widget` (Stream D, File 4). The developer does NOT add `FlowLayout` to `diagram/elements/diagram/index.ts` — it was absent before and remains absent.

---

## 5. Import Change Rules

These rules are exhaustive. Apply them mechanically to each widget file.

| Situation | Action |
|---|---|
| `import { StubFn } from './dsl'` — value import of a stub | DELETE the line (stub is now defined locally in this file) |
| `import type { PropType } from './dsl'` — type-only import | KEEP unchanged |
| `import { StubFn, type PropType } from './dsl'` — mixed import | SPLIT: remove `StubFn` from the value imports; convert to `import type { PropType } from './dsl'` |
| `import { StubA, StubB, type PropA, type PropB } from './dsl'` — all values are stubs | Replace entire import with `import type { PropA, PropB } from './dsl'` |
| `export { StubFn } from './dsl'` in `index.ts` | Change to `export { StubFn } from './WidgetFileName'` |
| `export { StubFn, type PropType } from './dsl'` in `index.ts` | Split: stubs go to `./WidgetFileName`, types stay in `./dsl` |
| Import of `Label` from `../../labels/dsl` in `ModelWidget.ts` | DELETE (Label stub is now local) |
| Import of `Label, Labels` from `./labels/dsl` in `handlers.ts` | Change to `./elements/model/ModelWidget` |

---

## 6. Stub Style Preservation

Copy every stub verbatim. Do not reformat, rename, change the style, or add annotations. Three styles exist in this codebase:

**Style 1: Arrow const with explicit return type** (used by: Camera)
```ts
export const Camera = (_props: CameraProps): null => null;
```

**Style 2: Arrow const without explicit return type** (used by: Background, Floor, Environment, Lighting, Model)
```ts
export const Background = (_props: BackgroundProps) => null;
```

**Style 3: Function declaration with explicit return type** (used by: Diagram, DiagramCanvas, ImagePanel, Screen, Chart)
```ts
export function Diagram(_props: DiagramProps): null {
  return null;
}
```

Match the style of each stub exactly when copying. Do not normalize Style 1 → Style 2 or any other cross-style conversion.

**`displayName` assignment style:** All elements except `@brewsite/model` stubs have `displayName` assignments. Model stubs (from `elements/model/dsl.tsx`) have NO `displayName`. Labels stubs (from `labels/dsl.tsx`) DO have `displayName`. Match exactly.

---

## 7. Global Verification Checklist (run after all streams complete)

Run this before reporting done:

```bash
# Run all package typechecks
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/diagram typecheck
pnpm --filter @brewsite/model typecheck
pnpm --filter @brewsite/charts typecheck

# Run all tests
pnpm --filter @brewsite/core test
pnpm --filter @brewsite/diagram test
pnpm --filter @brewsite/model test
pnpm --filter @brewsite/charts test

# Optionally run full build to catch any barrel re-export issues
pnpm build:lib
```

For each package, verify:
- [ ] All stub functions removed from every `dsl.tsx` in scope (only prop types and imports remain)
- [ ] All stub functions present in the corresponding widget file (before the class declaration)
- [ ] All value imports of stub functions removed from widget files where stubs are now local
- [ ] All `index.ts` re-exports updated to point to the widget file for stub functions
- [ ] All type-only imports of prop types remain in place (unchanged)
- [ ] No new imports added to `dsl.tsx` files (they only lose exports)
- [ ] Typecheck passes for each affected package
- [ ] Tests pass for each affected package

---

## 8. File Count Summary

| Stream | Package | dsl.tsx files | widget files | index.ts files | other files |
|---|---|---|---|---|---|
| A | core | 4 (camera, bg, floor, env) | 4 | 4 | — |
| B | core | 1 (lighting) | 1 | 1 | — |
| C | model | 2 (model, labels) | 1 | 3 (model/index, labels/index, pkg/index) | 1 (handlers.ts) |
| D | diagram | 4 (diagram, canvas, panel, screen) | 4 | 5 (4 element-level + pkg/index) | — |
| E | charts | 1 (chart) | 1 | 2 (element-level + pkg/index) | — |
| **Total** | | **12** | **11** | **15** | **1** |

---

## 9. Out of Scope

The following are explicitly excluded from this plan:

- **`@brewsite/slides`** — its DSL compilation model is structurally incompatible with the stub-to-widget pattern. `SlideMetaWidget.DslComponent` is the compiler-synthesized `SlideMetaDsl`, not the authored `Slide` component. No changes to slides.
- **JSDoc `@see` links** — no `@see DiagramWidget` annotations are added to prop types. The IDE navigation fix is sufficient.
- **File deletions** — no `dsl.tsx` files are deleted. They become thin type modules and that is acceptable.
- **File renames** — no files are renamed.
- **Style normalization** — stubs are copied verbatim. No Style 1 → Style 2 conversions.
- **`text-box/dsl.tsx`** — `TextBox` returns `ReactElement`, not `null`. It is a rendered component, not a compiler stub. No changes.
- **`@brewsite/core` compiler primitives** — `compiler/primitives/` contains some legacy background/camera/lighting files that are dead code pending removal. These are not touched by this plan.
