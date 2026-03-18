---
title: "@brewsite/model — Package Overview"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## What @brewsite/model Provides

`@brewsite/model` adds GLTF model loading, skeletal animation playback, and a 3D label system to BrewSite scenes. It extends `@brewsite/core` without modifying it.

Key capabilities:
- Load and render `.glb` files defined in an asset manifest
- Play named animation clips from the manifest, including cross-fade blending
- Apply per-frame motion commands to named bone groups (gaze, limb overrides)
- Attach HTML labels to named bones/meshes — labels project to screen space each frame and draw leader lines
- Override per-bone and per-mesh material properties (color, opacity, metalness, roughness)

The `<Model>` DSL component is the primary authoring surface. All models are referenced by a string `type` key that matches an entry in the asset manifest.

---

## Installation and Plugin Registration

```bash
pnpm add @brewsite/model
```

`@brewsite/model` requires `@brewsite/core` as a peer dependency. Register both plugins together on `<SceneEngine>`:

```tsx
import { useMemo } from 'react';
import { corePlugin, SceneEngine, ScrollStage, SceneCanvas, BackgroundLayer, EngineOverlayHost } from '@brewsite/core';
import { modelPlugin, LabelItem } from '@brewsite/model';

export default function MyPage() {
  // Create plugin instances once — stable across re-renders.
  const plugins = useMemo(() => [
    corePlugin(),
    modelPlugin({ manifestUrl: '/assets/model/manifest.json' }),
  ], []);

  return (
    <SceneEngine plugins={plugins}>
      {/* Scene declarations go here */}

      <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1000}>
        <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
        <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
        <EngineOverlayHost>
          {/* LabelItem components go here, one per label ID */}
          <LabelItem label={{ id: 'head-label', text: 'Sensor Array', targetPartId: 'Head' }} />
        </EngineOverlayHost>
      </ScrollStage>
    </SceneEngine>
  );
}
```

`modelPlugin()` accepts a `ModelPluginOptions` object:

```ts
type ModelPluginOptions = {
  // URL to fetch the asset manifest JSON (e.g. '/assets/manifest.json').
  // Mutually exclusive with `manifest`.
  manifestUrl?: string;

  // Pre-loaded AssetManifest object. Use when you've already fetched it.
  // Mutually exclusive with `manifestUrl`.
  manifest?: AssetManifest | null;

  // Per-model default state overrides keyed by widget ID.
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
};
```

Use `manifestUrl` in production — the plugin fetches and validates the manifest asynchronously on mount. Pass `manifest` directly in tests or SSR scenarios where you control asset loading.

---

## Package Exports

### DSL Components (scene authoring)

| Component | Description |
|---|---|
| `Model` | Primary model element. Declares position, scale, NVS bounds. |
| `Playback` | Container for `<Animation>` and `<Motion>` children. |
| `Animation` | Plays a named animation clip with blend controls. |
| `Motion` | Applies motion commands to named bone groups per-frame. |
| `BodyParts` | Container for `<BodyPart>` children. |
| `BodyPart` | Overrides material or pose on a named bone/mesh. |
| `Pose` | Declarative bone rotation/translation within a `<BodyPart>`. |
| `ModelPart` | Attaches a sub-model at a named anchor point. |
| `ContainedModel` | Positions a model inside a `<ModelPart>` anchor. |
| `Subpart` | Overrides visibility/material on a named sub-mesh. |
| `Label` | Attaches a label definition to a body part. Must be nested under `<BodyPart>` or `<Subpart>`. |

### Runtime / Player

| Export | Description |
|---|---|
| `LabelItem` | React component that renders one label with a leader line. Place inside `<EngineOverlayHost>`. |
| `LabelPositioner` | Service that projects bone world positions to screen coordinates each frame. Owned by `modelPlugin`. |
| `LabelPositionerContext` | React context providing the `LabelPositioner` instance. |
| `useLabelPositioner` | Hook to read the `LabelPositioner` from context. |

### Plugin Factory and Registration

| Export | Description |
|---|---|
| `modelPlugin(options)` | Creates the `WidgetPlugin` instance. Call once per `<SceneEngine>`. |
| `registerModelHandlers()` | Registers model DSL node handlers into the compiler registry. Called internally by `modelPlugin`. |
| `ModelRouter` | Model routing utility for resolving model types to widget instances. |

### Widget Configuration

| Export | Description |
|---|---|
| `ModelWidgetConfig` | Configuration type for model widget instances. |
| `IContainedModel` | Interface for models that attach to a named anchor point on a parent model. |

### Types

| Type | Description |
|---|---|
| `ModelPluginOptions` | Options for `modelPlugin()`. |
| `SceneModel` | Compiled state shape for one model instance. |
| `SceneModelInstanceState` | Full instance state including playback and labels. |
| `SceneAnimation` | Animation clip playback state. |
| `ScenePlayback` | Combined motion + animation state. |
| `BodyPartOverride` | Per-bone/mesh material + pose override. |
| `BodyPartOverrideMap` | Map of body part IDs to overrides. |
| `ModelPartSpec` / `ModelSubpartSpec` | Attached sub-model specs. |
| `MotionCommand` / `MotionScene` | Procedural bone motion types. |
| `CustomAnimation` | Per-frame custom animation function. |
| `AssetManifest` / `ModelMeta` / `AnimationEntry` | Manifest schema types. |
| `ClipMeta` | Single animation clip metadata. |
| `Vec3` | `[number, number, number]` tuple (re-exported from `@brewsite/core`). |
| `NVSRect` | `{ x, y, w, h }` NVS region (re-exported from `@brewsite/core`). |

### Metadata Helpers

| Export | Description |
|---|---|
| `clipMetaFromManifest(manifest)` | Converts manifest animations to `ClipMeta[]`. |
| `assertManifestValid(raw)` | Validates raw JSON against manifest schema. Throws on mismatch. |
| `findModelMeta(manifest, type)` | Finds a `ModelMeta` by model type string. |

---

## Model Assets

Models are referenced by a `type` string key. That key must exist in the asset manifest's `models` array.

### Asset Manifest Format

The manifest is a JSON file at version 2. Its schema:

```ts
type AssetManifest = {
  version: 2;
  models: ModelMeta[];       // Each GLB model's metadata
  animations: AnimationEntry[]; // Each animation clip's metadata
};

type ModelMeta = {
  type: string;              // DSL key, e.g. "Robot"
  glb: string;               // URL path to the .glb file
  bones: string[];           // All bone node names in the GLB
  meshes: string[];          // All mesh node names in the GLB
  anchorTargets: Record<string, string>; // anchor key → bone node name
  bodyParts?: string[];
  bodyPartGroups?: BodyPartGroup[];
  identity: SceneModelInstanceState; // Default state derived from GLB
};

type AnimationEntry = {
  type: string;              // Matches ModelMeta.type
  glb: string;               // URL to the animation GLB
  clipName: string;          // Clip name inside the GLB
  duration: number;          // Duration in seconds
};
```

### Supported Formats

- **Primary**: `.glb` (binary GLTF). KTX2 compressed textures are supported via the built-in `KTX2Loader`.
- **Animation retargeting**: External `.fbx` animation files can be loaded per-clip via `<Animation fbxUrl="..." fbxClipName="..." />`. This requires `fbxRetarget={true}`.

### Where to Put Model Files

Place model files in your app's `public/` directory so they are served as static assets. Reference them via absolute URL paths in the manifest:

```
public/
  assets/
    model/
      manifest.json
      my-character.glb
      animations/
        walk.glb
        idle.glb
```

Generate the manifest using the repo script:

```bash
pnpm --filter @brewsite/examples gen:scene-dsl
```

For custom apps, run `scripts/extract-model-metadata.mjs` to extract metadata from a GLTF at build time and populate your manifest.
