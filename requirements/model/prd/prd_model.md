---
title: "@brewsite/model — GLTF Model & Label System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-12
change_history:
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents @brewsite/model as a published extension package: ModelWidget, LabelPositioner, label compiler, modelPlugin() factory, asset manifest contract, ViewportScaleContext integration (replaces EngineARContainerContext), and the post-cleanup API surface where all types are available from the @brewsite/core main barrel (no deep sub-path imports required)."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "DSL stub co-location: dsl.tsx files are now pure type modules. DSL stub functions (Model, ModelRouter, BodyParts, BodyPart, Pose, ModelPart, ContainedModel, Subpart, Playback, Motion, Animation, Label, Labels) moved to ModelWidget.ts. Updated ModelWidget implementation pattern description accordingly."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "View/Region Architecture: documented ModelWidget CUSTOM_NODE_HANDLER composeBounds integration. ModelWidget calls api.composeBounds() to resolve absolute nvsBounds when inside a parent <View>."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Model/diagram overhaul audit: LabelStyle.fontSize documented as intentional number|string union — number values render as px via React CSSProperties; string values pass through as-is (e.g., '1.2rem', '150%'). All model sizing fields verified correct; no changes to model coordinate system or API."
---

# @brewsite/model — GLTF Model & Label System

## 1. Overview

`@brewsite/model` is a published extension package for `@brewsite/core` that adds GLTF model loading, GLTF animation playback, and a 3D-tracked label system. It is the canonical way to add animated 3D model content to a BrewSite scene. The package integrates with `@brewsite/core` exclusively through public APIs — it does not deep-import internal modules.

**Affects:** `packages/model/` (published as `@brewsite/model`). Consumers add both `@brewsite/core` and `@brewsite/model` as dependencies.

---

## 2. Problem Statement

Consumers building product marketing scenes need to display GLTF models with GLTF animation playback and overlaid HTML labels that track 3D bone positions in world space. These concerns require Three.js `GLTFLoader`, `AnimationMixer`, and per-frame 3D-to-screen projection — none of which belong in `@brewsite/core`.

Separating model/label concerns into `@brewsite/model` keeps the `@brewsite/core` bundle lean for consumers who do not use GLTF models, and avoids coupling the core runtime to Three.js GLTF infrastructure.

---

## 3. Goals & Success Metrics

**Primary metrics:**
- Consumers can load a GLTF model, author its position/rotation/scale per scene, and play back named animation clips via a simple DSL without writing Three.js code.
- Consumers can attach HTML labels to named bones; labels track the bone's world-space position in real time via CSS transforms.
- All types required to author scenes and extend the package are importable from the `@brewsite/core` and `@brewsite/model` main barrels — no sub-path imports.

**Guardrail metrics:**
- `@brewsite/model` does not import from `@brewsite/diagram`, `@brewsite/charts`, or any non-peer package not listed in its own `package.json`.
- `@brewsite/core` does not import from `@brewsite/model`.

---

## 4. Non-Goals

- Video or audio asset playback.
- Skeletal physics / ragdoll simulation.
- Real-time LOD management.
- Server-side rendering of Three.js content (labels use DOM transforms; SSR outputs empty label containers with no hydration mismatch).

---

## 5. Consumer Stories

- As a toolkit consumer, I want to declare a GLTF model in a scene DSL with position, rotation, scale, and a named animation clip so that the model renders and animates without writing Three.js code.
- As a toolkit consumer, I want to attach HTML label components to named bones so that labels track model animations in real time.
- As a toolkit consumer, I want to register the model plugin with a single `modelPlugin(manifest)` call so that I do not need to manually construct `ModelWidget` instances.

---

## 6. Functional Requirements

1. `ModelWidget` shall implement `ISceneElement`, `IRenderable`, `ILoadable`, `IAnimationController`, `INVSBounded`, and `IDslComposite` from `@brewsite/core`.
2. `ModelWidget` shall declare `readonly disableWhenAbsent = true` on `ISceneElement`. When a scene does not reference the model widget, the compiler substitutes `makeDisabledDefault(defaultState)` — the model is hidden rather than frozen at its default position.
3. `ModelWidget.load(manifest)` shall use `THREE.GLTFLoader` to load the GLTF asset specified in the asset manifest, cache the result, and set `isLoaded = true`.
4. `ModelWidget.onTick()` shall advance the `AnimationMixer` by `context.effectiveDeltaSeconds` and apply the current animation clip state from `context.resolvedState`.
5. The label system shall project bone world positions to screen space using the active `PerspectiveCamera` and update CSS `transform: translate(x, y)` on label DOM nodes each frame.
6. `LabelPositioner` shall read viewport dimensions from `ViewportScaleContext` (not `EngineARContainerContext`, which is deprecated).
7. `modelPlugin(options?)` shall be the sole registration entry point. It creates `ModelWidget` instances lazily via `WidgetRegistry.registerTypeFactory()` — one instance per `<Model type="...">` id encountered during compilation.
8. All types required to integrate `@brewsite/model` (`AnimationTrack`, `Resolvable<T>`, `getNodeHandler`, transition blend functions) shall be importable from `@brewsite/core` or `@brewsite/model` main barrels. No sub-path imports to internal core modules are required.

---

## 7. API Design

### Plugin Entry Point

```typescript
// packages/model/src/plugin.ts

export interface ModelPluginOptions {
  /** Arbitrary props merged into every ModelWidget constructor. */
  widgetDefaults?: Partial<ModelWidgetOptions>;
}

export function modelPlugin(options?: ModelPluginOptions): IWidgetPlugin;
```

Register via `EngineProvider.plugins`:

```tsx
<EngineProvider plugins={[corePlugin(), modelPlugin()]}>
  {/* scenes */}
</EngineProvider>
```

The `modelPlugin()` factory:
- Registers a `ModelWidget` type factory under `<Model>` DSL component.
- Creates and mounts a `LabelPositionerSyncer` React component inside the provider tree. This component reads `ViewportScaleContext` and forwards `containerWidth`/`containerHeight` to `LabelPositioner` on every resize.
- Exposes `LabelPositionerContext` to the subtree so label components can register themselves.

### DSL Components

```tsx
// Model DSL — one per GLTF asset per scene
<Model
  type="robot"          // Required: maps to manifest entry; produces ModelWidget id='robot'
  position={[0, 0, 0]}
  rotation={[0, 0, 0]}
  scale={1}
  animationClip="idle"  // Named GLTF animation clip to play
  visible={true}
/>

// Label DSL — attached to a bone
<LabelItem
  id="label-head"
  target="head_bone"    // Bone name in the GLTF rig
  offsetPx={[0, -20]}
/>
```

### ViewportScaleContext Integration

`LabelPositionerSyncer` reads viewport dimensions from `ViewportScaleContext`:

```typescript
import { ViewportScaleContext } from '@brewsite/core';

const LabelPositionerSyncer = (): ReactElement | null => {
  const { containerWidth, containerHeight } = useContext(ViewportScaleContext);
  // Forward to LabelPositioner for 3D-to-screen projection
  labelPositioner.setViewport(containerWidth, containerHeight);
  return null;
};
```

`EngineARContainerContext` is deprecated and aliased to `ViewportScaleContext`. All new `@brewsite/model` code imports from `ViewportScaleContext`.

---

## 8. Technical Considerations

### Package Boundary

`@brewsite/model` imports from `@brewsite/core` exclusively through the main barrel (`@brewsite/core`). After the 2026-03-07 cleanup, the following types that previously required sub-path imports are now available from the main barrel:
- `AnimationTrack` — animation timing track type
- `Resolvable<T>` — lazy/eager value wrapper
- `getNodeHandler` — compiler node handler lookup

No deep sub-path imports (`@brewsite/core/runtime/types`, `@brewsite/core/compiler/sceneTypes`, etc.) are required or permitted.

### ModelWidget Implementation Pattern

`ModelWidget` follows the element module pattern:
```
types.ts → dsl.tsx → compile.ts → render.ts → ModelWidget.ts → index.ts
```

`dsl.tsx` contains only prop type interfaces. DSL stub functions (`Model`, `ModelRouter`, `BodyParts`, `BodyPart`, `Pose`, `ModelPart`, `ContainedModel`, `Subpart`, `Playback`, `Motion`, `Animation`, `Label`, `Labels`) are defined in `ModelWidget.ts`. Three.js is confined to `render.ts` and `ModelWidget.ts` (which calls render layer methods). The compiler layer (`compile.ts`) is pure TypeScript with no Three.js imports.

### LabelStyle.fontSize Type

`LabelStyle.fontSize` is typed as `number | string`. This is intentional — not a type error or oversight:

- **`number`**: Rendered as pixels by React's CSS-in-JS handling (e.g., `14` → `14px`). Equivalent to `React.CSSProperties.fontSize` numeric behavior.
- **`string`**: Any valid CSS font-size value passed through as-is (e.g., `"1.2rem"`, `"150%"`, `"0.875em"`).

Default: `12` (px). Narrowing to `number` would remove valid functionality for consumers using relative font sizes.

### View/Region Composition (composeBounds)

`ModelWidget` uses `CUSTOM_NODE_HANDLER` to control its own compilation. Inside the custom handler, it calls `api.composeBounds(localBounds)` to resolve the model's absolute NVS bounds when placed inside a `<View>`:

```typescript
// Inside ModelWidget's CUSTOM_NODE_HANDLER:
const localBounds: NVSRect = {
  x: props.x ?? 0,
  y: props.y ?? 0,
  w: props.w ?? 1,
  h: props.h ?? 1,
};
// api.composeBounds maps local [0..1] into parent view's content bounds if inside a <View>.
// Returns localBounds unchanged at the root level (identity).
const nvsBounds = api.composeBounds(localBounds);
```

This allows `<Model>` elements to be placed inside a `<View>` without any changes to the model DSL. The model author writes local [0..1] NVS coordinates; the view's `composeBounds` maps them into the view's absolute viewport region automatically. The resulting `nvsBounds` is stored on `ModelState` and used by `ModelWidget.apply()` at render time.

### disableWhenAbsent

`ModelWidget` declares `readonly disableWhenAbsent = true`. This means the compiler calls `makeDisabledDefault(defaultState)` for scenes that omit the model — effectively hiding the model (setting `enabled: false`) rather than using the raw `defaultState` (which would leave it visible at its default position). This is the correct behavior for consumer models that should only appear in scenes that explicitly reference them.

### Animation Track Mapping

GLTF clip names are mapped to `AnimationTrack` entries via `animationTrackMapping.ts` during the `compileExtra` pass. This mapping is stored in `SceneTrackTick.widgetExtras[widgetId]` and read by `ModelWidget.onTick()` to select the correct `AnimationAction` from the `AnimationMixer` without re-computing the mapping every frame.

### Label Positioning

`LabelPositioner` is a stateful class that:
1. Maintains a `Map<string, HTMLElement>` of registered label DOM nodes.
2. Each animation frame, receives bone world positions from `RuntimeDriver.getBoneWorldPositions()`.
3. Projects each bone position through the current `PerspectiveCamera` matrix to normalized device coordinates, then maps to pixel offsets.
4. Updates `transform: translate(x, y)` directly on the DOM node (not via React state) to avoid React re-renders on every frame.

Viewport dimensions for the projection come from `ViewportScaleContext`. This context is provided by `EngineARContainer` — labels only project correctly when the engine is mounted inside an `EngineARContainer`. Consumers using a custom layout must provide `ViewportScaleContext` themselves.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** for initial formal documentation.

The `disableWhenAbsent = true` field replaces the duck-typed `useDefaultStateWhenAbsent = false` on `ModelWidget`. The compiler behavior is identical — this is a rename to the formal interface property. Consumers who tested against `widget.useDefaultStateWhenAbsent` directly (unlikely) must update to `widget.disableWhenAbsent`. No change to compiled SceneTrack output.

The `ViewportScaleContext` import path (`@brewsite/core`) is unchanged from the previous `EngineARContainerContext` import path — `EngineARContainerContext` is now a deprecated alias to `ViewportScaleContext`. No migration needed unless the consumer was using `EngineARContainerContextValue` by name (rename to `ViewportScaleContextValue`).

---

## 10. Dependencies

- `@brewsite/core` (peer): `ISceneElement`, `IRenderable`, `ILoadable`, `IAnimationController`, `INVSBounded`, `IDslComposite`, `IAttachmentHost`, `IRenderContributor`, `CUSTOM_NODE_HANDLER`, `ViewportScaleContext`, `AnimationTrack`, `Resolvable`, `getNodeHandler`, `WidgetRegistry`, and related context/hook types.
- `three` (peer): `GLTFLoader`, `AnimationMixer`, `AnimationAction`, `PerspectiveCamera`.
- `react` (peer): context, hooks, element creation.

---

## 11. Risks & Mitigations

**Risk: LabelPositioner projects incorrectly when ViewportScaleContext is absent.**
**Mitigation:** `LabelPositionerSyncer` reads from `ViewportScaleContext`. If the context is missing (no `EngineARContainer` ancestor), dimensions default to `containerWidth: 0` — labels render at origin. A console warning is emitted in development mode.

**Risk: AnimationTrack availability from core barrel.**
**Mitigation:** `AnimationTrack` is now explicitly exported from `@brewsite/core`'s main barrel as of the 2026-03-07 cleanup. The deep import is removed.

---

## 12. Open Questions

None. All design decisions are resolved in the current implementation.

---

## 13. Launch Criteria

- `modelPlugin()` registers `ModelWidget` instances and mounts `LabelPositionerSyncer` correctly.
- All types are importable from `@brewsite/core` or `@brewsite/model` main barrels.
- Tests pass: `ModelWidget` unit tests, `LabelPositioner` unit tests, `AnimationTrackMapping` tests.
- `apps/examples/` contains at least one scene using `modelPlugin()` with a GLTF model and labels.
