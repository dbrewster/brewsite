---
title: "@brewsite/model — Model Element DSL Reference"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## Model Element Overview

`<Model>` renders a GLTF character or object in the 3D scene. It loads the GLB declared in the asset manifest for the given `type`, positions it using NVS coordinates, and manages animation playback state per scene.

Each `<Model>` declaration in a scene sets the model's state for that scene. Between scenes, the runtime interpolates position, scale, and opacity using the default transition spec. Animation changes cross-fade with `fadeInSeconds`.

`<Model>` must have both `type` and `id` props. `type` is the manifest key (e.g. `"Robot"`). `id` is the unique widget ID used by the runtime registry — it must be stable across scenes for interpolation to work.

---

## Model Props

All props come from `ModelProps` in `packages/model/src/elements/model/dsl.tsx`. Props marked `Resolvable<T>` accept either a literal value or a transition spec.

| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | required | Asset manifest model type key. Must match a `ModelMeta.type` in the manifest. |
| `id` | `string` | required | Unique widget ID. Used by runtime registry. Must match the ID in `widgetSetup.ts` (when using factory pattern) and can be used as `targetId` in `<Camera>`. |
| `x` | `number` | `0` | NVS left edge of the model's viewport region [0..1]. |
| `y` | `number` | `0` | NVS top edge of the model's viewport region [0..1]. |
| `w` | `number` | `1` | NVS width of the model's viewport region [0..1]. |
| `h` | `number` | `1` | NVS height of the model's viewport region [0..1]. |
| `scale` | `Resolvable<number>` | from manifest | Viewport-relative scale. `scale * visibleWorldHeight` = world-space scale. A value of `0.06` = 6% of viewport height. |
| `z` | `Resolvable<number>` | `0` | World-space Z depth of the model center. |
| `rotation` | `Resolvable<[number, number, number]>` | `[0,0,0]` | Euler rotation in radians `[x, y, z]`. |
| `opacity` | `Resolvable<number>` | `1` | Global opacity [0..1]. Applied to all meshes. |
| `metalness` | `Resolvable<number>` | from manifest | Global metalness override [0..1]. Overrides all mesh materials. |
| `roughness` | `Resolvable<number>` | from manifest | Global roughness override [0..1]. Overrides all mesh materials. |
| `metalnessMultiplier` | `Resolvable<number>` | `undefined` | Multiplies existing metalness values rather than replacing them. |
| `roughnessMultiplier` | `Resolvable<number>` | `undefined` | Multiplies existing roughness values rather than replacing them. |
| `enabled` | `Resolvable<boolean>` | `true` | When `false`, the model is hidden and removed from the render scene. |
| `reset` | `Resolvable<boolean>` | `false` | When `true`, resets state back to manifest defaults before applying props. |
| `children` | `ReactNode` | — | `<Playback>`, `<BodyParts>` children. |

The NVS props `x`, `y`, `w`, `h` define the model's viewport region (its `nvsBounds`). The model's NVS center position is computed as `(x + w/2, y + h/2)`. Scale is applied relative to the visible world height.

---

## Model Positioning

NVS coordinates: `x=0` is left, `x=1` is right, `y=0` is top, `y=1` is bottom.

The `x`, `y`, `w`, `h` props define a rectangular region. The model's world-space center is placed at the center of that region. Scale is viewport-relative.

**Common layouts:**

```tsx
{/* Full-screen, centered */}
<Model type="Robot" id="robot" scale={0.06} x={0} y={0} w={1} h={1} />

{/* Center stage with margins — model fills middle 70% horizontally */}
<Model type="Robot" id="robot" scale={0.06} x={0.15} y={0} w={0.7} h={1} />

{/* Right half — model on right side, text on left */}
<Model type="Robot" id="robot" scale={0.06} x={0.5} y={0} w={0.5} h={1} />

{/* Left of center, slightly inset */}
<Model type="Robot" id="robot" scale={0.06} x={0.1} y={0.05} w={0.45} h={0.9} />
```

When a `<Model>` is nested inside a `<View>`, the NVS props are relative to the View's content bounds. A model with `x={0} y={0} w={1} h={1}` inside a View fills that View's region:

```tsx
<View id="right-panel" x={0.38} y={0} w={0.62} h={1} padding={[0.05, 0.04]}>
  <Model type="Robot" id="robot" scale={0.06} x={0} y={0} w={1} h={1} />
</View>
```

---

## Animation Playback

Animations are defined in the asset manifest's `animations` array. Each animation entry has a `clipName` (the clip name inside the GLB), `glb` URL, and `duration`. Reference animations by their `clipName`.

Use `<Playback>` and `<Animation>` as children of `<Model>`:

```tsx
<Model type="Robot" id="robot" scale={0.06} x={0.15} y={0} w={0.7} h={1}>
  <Playback>
    <Animation
      enabled
      clipName="chat-relax-f"
      weight={1}
      fadeInSeconds={0.4}
      clipRepeat
    />
  </Playback>
</Model>
```

### Animation Props (`AnimationProps`)

| Prop | Type | Default | Description |
|---|---|---|---|
| `enabled` | `Resolvable<boolean>` | required | Whether this animation is active. |
| `clipName` | `string` | — | Name of the animation clip as it appears in the GLB (from manifest). |
| `gltfUrl` | `string` | — | URL to an external GLTF for the animation (overrides manifest lookup). |
| `gltfClipName` | `string` | — | Clip name inside the external GLTF. |
| `fbxUrl` | `string` | — | URL to an FBX file for retargeted animation. |
| `fbxClipName` | `string` | — | Clip name inside the FBX. |
| `fbxRetarget` | `boolean` | `false` | Enable FBX retargeting to the model skeleton. |
| `fadeInSeconds` | `number` | — | Cross-fade duration in seconds when this animation activates. |
| `weight` | `number` | — | Blend weight [0..1]. Used for layering multiple animations. |
| `clipStart` | `number` | — | Start offset within the clip. Unit controlled by `clipRangeUnit`. |
| `clipEnd` | `number` | — | End offset within the clip. |
| `clipRangeUnit` | `'seconds' \| 'percent'` | `'seconds'` | Unit for `clipStart`/`clipEnd`. |
| `clipRepeat` | `boolean` | — | Whether the clip loops. |
| `clipStartOnce` | `number` | — | Start offset applied only the first time this animation starts. |
| `trimStartKeyframes` | `number` | — | Remove N keyframes from the clip start (e.g. to skip a T-pose frame). |
| `trimEndKeyframes` | `number` | — | Remove N keyframes from the clip end. |
| `holdStartPose` | `boolean` | — | Hold the clip's first pose rather than playing. |
| `allowRotation` | `boolean` | — | Whether to apply rotation tracks from this clip. |
| `allowScale` | `boolean` | — | Whether to apply scale tracks from this clip. |
| `reset` | `Resolvable<boolean>` | — | Reset animation state to defaults before applying these props. |

### Changing Animation Across Scenes

To change the animation when a new scene enters, simply use a different `clipName` in the next scene's `<Animation>` declaration. The `fadeInSeconds` on the new `<Animation>` controls the cross-fade.

```tsx
// Scene A — idle
<Model type="Robot" id="robot" scale={0.06} x={0.25} y={0} w={0.5} h={1}>
  <Playback>
    <Animation enabled clipName="idle" weight={1} clipRepeat />
  </Playback>
</Model>

// Scene B — talking animation, shifted left
<Model type="Robot" id="robot" scale={0.06} x={0.1} y={0} w={0.5} h={1}>
  <Playback>
    <Animation enabled clipName="chat-relax-f" weight={1} fadeInSeconds={0.4} clipRepeat />
  </Playback>
</Model>
```

The model smoothly moves from its Scene A position to Scene B position during the transition. The animation cross-fades over `fadeInSeconds`.

### Motion Commands

`<Motion>` applies real-time bone overrides using `commands` (instantaneous) or `scenes` (time-coded). These run on top of animation clips each frame.

```tsx
<Model type="Robot" id="robot" scale={0.06} x={0} y={0} w={1} h={1}>
  <Playback>
    <Animation enabled clipName="idle" clipRepeat />
    <Motion
      commands={[
        { groupId: 'head', rotate: { yawPct: 0.3, pitchPct: -0.1 } },
      ]}
    />
  </Playback>
</Model>
```

`MotionCommand` props:
- `groupId`: Named bone group from the manifest's `anchorTargets`.
- `rotate`: `{ yawPct?, pitchPct?, rollPct? }` — percentage of the group's rotation limits.
- `translate`: `{ xPct?, yPct?, zPct? }` — percentage of the group's translation limits.
- `weight`: Blend weight [0..1].
- `space`: `'local' | 'world'`.

---

## Model Transitions

Model position, scale, opacity, and rotation all interpolate automatically between scenes when the same widget ID appears in adjacent scenes. No explicit transition config is needed for smooth movement.

Entry transitions (fade in from a starting state) can be authored by setting `opacity={0}` in a scene and `opacity={1}` in the next, then using a scene-level `transition` prop:

```tsx
<Scene id="intro" transition={{ enter: [0, 0.3] }}>
  <Model type="Robot" id="robot" scale={0.06} x={0.15} y={0} w={0.7} h={1} opacity={1} />
</Scene>
```

When the model appears for the first time (no prior scene had it), it uses its manifest identity state as the base. The runtime automatically fades it in.

---

## Model Materials and Overrides

### Global Overrides

`opacity`, `metalness`, `roughness`, `metalnessMultiplier`, `roughnessMultiplier` on `<Model>` apply to all meshes uniformly.

### Per-Part Overrides with `<BodyPart>`

`<BodyPart>` overrides material and pose properties on a named bone or mesh. Nest them inside `<BodyParts>`:

```tsx
<Model type="Robot" id="robot" scale={0.06} x={0} y={0} w={1} h={1}>
  <BodyParts>
    {/* Highlight the head with an accent color */}
    <BodyPart id="Head" color="#7ffcff" opacity={1}>
      {/* Labels go here */}
    </BodyPart>

    {/* Dim the torso */}
    <BodyPart id="Spine" opacity={0.4} />
  </BodyParts>
</Model>
```

`BodyPart` props (`BodyPartByIdProps`):

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Required. Bone or mesh ID from the manifest's `bodyParts` or `meshes` array. |
| `opacity` | `Resolvable<number>` | Per-part opacity [0..1]. |
| `color` | `Resolvable<string>` | Material color override (hex or CSS color). |
| `metalness` | `Resolvable<number>` | Material metalness override [0..1]. |
| `roughness` | `Resolvable<number>` | Material roughness override [0..1]. |
| `targetKind` | `'bone' \| 'mesh'` | Forces lookup to bone or mesh. Auto-detected when absent. |
| `pose` | `PoseGroup` | Declarative bone rotation/translation for this part. `PoseGroup = { rotate?: AxisRotation; translate?: AxisTranslation; reset?: boolean }`. |
| `boneId` | `string` | Use this bone ID for pose lookups (when different from `id`). |
| `meshId` | `string` | Use this mesh ID for material lookups (when different from `id`). |
| `reset` | `Resolvable<boolean>` | Reset this part to defaults before applying overrides. |

### Subparts

`<Subpart>` targets named sub-meshes inside model parts:

```tsx
<Subpart id="visor" opacity={0.8} color="#00ffff" />
```

---

## Complete Model Example

A 3-scene sequence where a robot fades in, starts an animation, and shifts position.

```tsx
// widgetSetup.ts
import { modelPlugin } from '@brewsite/model';

export const myPlugin = modelPlugin({
  manifestUrl: '/assets/model/manifest.json',
});

// MyPage.tsx
import { useMemo } from 'react';
import {
  corePlugin, SceneEngine, Scene, ProgressManager, Camera,
  Lighting, Ambient, Directional, Background,
  ScrollStage, SceneCanvas, BackgroundLayer, EngineOverlayHost,
} from '@brewsite/core';
import { Model, Playback, Animation, BodyParts, BodyPart, Label, LabelItem } from '@brewsite/model';
import { myPlugin } from './widgetSetup';

// Scene 1: Robot fades in, idle, centered
function SceneIntro() {
  return (
    <Scene id="intro">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
      <Lighting intensityScale={1.1}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
      </Lighting>
      <Background color="#030510" />
      <Model
        type="Robot"
        id="robot"
        scale={0.06}
        x={0.15} y={0} w={0.7} h={1}
        opacity={1}
      />
    </Scene>
  );
}

// Scene 2: Robot plays animation, shifts right
function SceneAnimation() {
  return (
    <Scene id="animation">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
      <Lighting intensityScale={1.1}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
      </Lighting>
      <Background color="#030510" />
      <Model
        type="Robot"
        id="robot"
        scale={0.06}
        x={0.25} y={0} w={0.5} h={1}
        opacity={1}
      >
        <Playback>
          <Animation
            enabled
            clipName="chat-relax-f"
            weight={1}
            fadeInSeconds={0.4}
            clipRepeat
          />
        </Playback>
      </Model>
    </Scene>
  );
}

// Scene 3: Robot centered, head highlighted with label
function SceneLabels() {
  return (
    <Scene id="labels">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
      <Lighting intensityScale={1.1}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
      </Lighting>
      <Background color="#030510" />
      <Model
        type="Robot"
        id="robot"
        scale={0.06}
        x={0.1} y={0} w={0.8} h={1}
        opacity={1}
      >
        <Playback>
          <Animation enabled clipName="chat-relax-f" weight={0.6} clipRepeat />
        </Playback>
        <BodyParts>
          <BodyPart id="Head" color="#7ffcff" opacity={1}>
            <Label
              id="head-label"
              text="Sensor Array"
              labelOffset={[0, 0.35, 0]}
            />
          </BodyPart>
        </BodyParts>
      </Model>
    </Scene>
  );
}

// Page component
export default function MyPage() {
  const plugins = useMemo(() => [corePlugin(), myPlugin], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#030510' }}>
      <SceneEngine plugins={plugins}>
        <SceneIntro />
        <SceneAnimation />
        <SceneLabels />

        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1000}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost>
            {/* LabelItem must be here, not inside the scene declaration */}
            <LabelItem label={{ id: 'head-label', text: 'Sensor Array', targetPartId: 'Head' }} />
          </EngineOverlayHost>
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
```
