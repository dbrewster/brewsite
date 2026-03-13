---
title: "BrewSite Core — Model Element"
doc_type: prd
status: moved
owner: Toolkit Product
last_updated: 2026-03-13
change_history:
  - date: 2026-02-28
    author: brewsite-product-manager
    summary: "Initial PRD created. Comprehensive specification of the Model element covering state types, DSL surface, transition system, animation and motion systems, part overrides, widget interfaces, and asset manifest integration."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "API hardening update: replaced createDefaultWidgetRegistry() references with corePlugin() + modelPlugin() to reflect the plugin-based registration model."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Status changed to 'moved'. The Model element has been fully relocated to @brewsite/model. ModelWidget, all model types, the DSL surface, and the asset manifest contract now live in packages/model/src/. This document is retained as a historical reference. The authoritative PRD is requirements/model/prd/prd_model.md."
---

# BrewSite Core — Model Element

> **This feature has moved to `@brewsite/model`.**
>
> The Model element — `ModelWidget`, `SceneModelInstanceState`, `SceneModel`, `SceneAnimation`, `ScenePlayback`, `SceneMotion`, `MotionCommand`, `BodyPartOverride`, `ModelPartSpec`, `AssetManifest`, and all DSL components (`<Model>`, `<BodyPart>`, `<Animation>`, `<Motion>`, etc.) — is implemented in `packages/model/src/` and published as part of `@brewsite/model`. It is not part of `@brewsite/core`.
>
> **The authoritative PRD is:** `requirements/model/prd/prd_model.md`
>
> The content below documents the original design intent and preserves historical context for architectural decisions. Do not use it as implementation guidance.

---

## Current Package Location

| Symbol | Package | File |
|--------|---------|------|
| `ModelWidget`, `ModelWidgetConfig` | `@brewsite/model` | `packages/model/src/elements/model/ModelWidget.ts` |
| `SceneModel`, `SceneModelInstanceState`, `SceneAnimation`, `ScenePlayback`, `SceneMotion`, `MotionCommand`, `MotionScene`, `PoseGroup`, `ModelPose`, `BodyPartOverride`, `BodyPartOverrideMap`, `ModelPartSpec`, `ModelSubpartSpec`, `CustomAnimation`, `CustomAnimationContext`, `CustomAnimationOp`, `AxisRotation`, `AxisTranslation`, `ClipMeta`, `Vec3` | `@brewsite/model` | `packages/model/src/elements/model/types.ts` |
| `ModelProps`, `BodyPartByIdProps`, `PoseProps`, `AnimationProps`, `MotionProps`, `ModelPartProps`, `ContainedModelProps`, `SubpartProps`, `PlaybackProps` | `@brewsite/model` | `packages/model/src/elements/model/dsl.tsx` |
| `Model`, `ModelRouter`, `BodyParts`, `BodyPart`, `Pose`, `ModelPart`, `ContainedModel`, `Subpart`, `Playback`, `Motion`, `Animation`, `Label`, `Labels` (DSL stubs) | `@brewsite/model` | `packages/model/src/elements/model/ModelWidget.ts` |
| `modelTransitionSpec`, `playbackTransitionSpec`, `instanceTransitionSpec`, `functionalInstanceTransitionSpec`, `applyModelExit`, `applyModelEnter`, `applyModelInterpolate`, `compileAnimation`, `CompiledAnimation` | `@brewsite/model` | `packages/model/src/elements/model/compile.ts` |
| `AssetManifest`, `ModelMeta`, `AnimationEntry`, `AnchorTargetMap`, `BodyPartGroup`, `clipMetaFromManifest`, `assertManifestValid`, `findModelMeta` | `@brewsite/model` | `packages/model/src/elements/model/metadata.ts` |
| `IContainedModel` | `@brewsite/model` | `packages/model/src/widget/types.ts` |
| `modelPlugin`, `ModelPluginOptions` | `@brewsite/model` | `packages/model/src/plugin.ts` |

Import example:

```typescript
import {
  ModelWidget,
  Model,
  BodyPart,
  Animation,
  Motion,
  modelPlugin,
} from '@brewsite/model';

import type {
  SceneModel,
  SceneModelInstanceState,
  SceneAnimation,
  MotionCommand,
  AssetManifest,
} from '@brewsite/model';
```

---

## Key Design Changes Since Initial Spec

The following decisions changed between the initial design (documented below) and the final implementation in `@brewsite/model`:

1. **`SceneModel.position` removed** — `SceneModel` does not have a `position: Vec3` field. Instead it uses `nvsX: number`, `nvsY: number`, and `z: number`. `nvsX`/`nvsY` are NVS-space scalars ([0..1]) representing the model's center; `z` is world-space depth. World-space conversion happens in `ModelWidget.apply()` via `context.coords.toWorld(nvsX, nvsY, z)`.

2. **`SceneModel.scale` is `number`, not `Vec3`** — Uniform scale only. There is no per-axis scale on the model root.

3. **`MotionCommand` shape** — The discriminated union with `type: 'axis-rotate' | 'axis-translate' | 'pose'` was replaced. `MotionCommand` is now a single object type: `{ groupId: string; rotate?: AxisRotation; translate?: AxisTranslation; weight?: number; space?: 'local' | 'world' }`.

4. **`MotionScene.sceneIndex` replaced by `id`** — `MotionScene` uses `id: string` for identification (not a numeric index). `start` and `end` are progress values for the time-coded sequence.

5. **`SceneAnimation` greatly expanded** — Many new fields beyond the original spec: `gltfClipName`, `fbxUrl`, `fbxClipName`, `fbxRetarget`, `clipStart`, `clipEnd`, `clipRangeUnit`, `clipRepeat`, `clipStartOnce`, `trimStartKeyframes`, `trimEndKeyframes`, `holdStartPose`, `allowRotation`, `allowScale`, `reset`. The simple `fadeOutSeconds` and `loop` fields from the original spec do not exist in the final implementation.

6. **`ModelPartSpec` shape** — Significantly expanded from the original `MaterialOverride`-based design. `ModelPartSpec` has `anchor`, `space`, `position`, `rotation`, `scale`, `containedPosition`, `containedRotation`, `containedScale`, `modelId`, `subparts`, etc. The `MaterialOverride` type does not exist separately — material fields are inline on `BodyPartOverride`.

7. **`BodyPartOverride` replaces `ModelPartSpec` for material overrides** — Material overrides (opacity, color, metalness, roughness) on body parts use `BodyPartOverride`, keyed in `BodyPartOverrideMap`. This is separate from `ModelPartSpec`, which handles sub-model attachment geometry.

8. **`IContainedModel` is model-specific** — It extends `IContainedRenderable` from `@brewsite/core` (the generic attachment interface) and additionally requires `IRenderable<TState>`. The `anchorModelId`/`anchorKey` fields are defined on `IContainedRenderable` in core.

9. **`ModelWidget` implements `IHasCustomDslHandler`** — Not mentioned in the original spec. The `CUSTOM_NODE_HANDLER` symbol (from core) is the mechanism by which `ModelWidget` registers its own DSL node handler in its constructor, handling all child DSL traversal (BodyPart, ModelPart, Animation, Motion, Label, etc.).

10. **`ModelWidget` implements `IRenderContributor`** — Contributes `namedPositions` (bone world positions) and `targetColors` to the render loop each frame, which are consumed by `LabelPositioner` for label tracking.

11. **`ModelWidget.DslComponent = ModelRouter`** — The widget's DSL component is `ModelRouter` (not `Model`). `ModelRouter` is the routing stub that the `WidgetRegistry.registerTypeFactory()` watches for. `Model` is the public authoring component that scenes use; the plugin's `configureRegistry` wires `ModelRouter` to create `ModelWidget` instances by `type` prop.

12. **`functionalInstanceTransitionSpec` is the preferred transition spec** — `instanceTransitionSpec` (the original frame-baking spec) is deprecated but retained for backward compatibility.

13. **`ModelPluginOptions.widgetDefaults` does not exist** — The option is named `defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>`, keyed by widget ID.

14. **`ModelPluginOptions.manifestUrl` added** — The plugin can accept a URL and fetch the manifest asynchronously, in addition to accepting a pre-loaded `manifest` object.

---

## Historical Specification

The remainder of this document preserves the original specification for historical reference. Do not use it as implementation guidance — use `requirements/model/prd/prd_model.md` instead.

*(Original sections 1–13 omitted to avoid confusion with the current implementation. The current implementation is fully documented in the model PRD.)*
