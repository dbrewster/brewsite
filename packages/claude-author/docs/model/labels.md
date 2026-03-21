---
title: "@brewsite/model — Label System DSL Reference"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-21
---

## Labels Overview

Labels are HTML overlays anchored to named bones or meshes in a 3D model. They project from 3D world space to screen space each frame and draw a leader line from the label text to the target point.

Labels are different from HUD (`<Hud>`) elements. HUD elements are fixed to NVS positions. Labels track moving 3D positions — as the camera orbits or the model animates, labels follow their attachment point in real time.

Primary use cases: model part callouts (e.g. "Sensor Array" pointing to the head), annotation overlays highlighting specific components, product feature callouts on a product model.

**Architecture split:** Label definitions live in scene DSL (via `<Label>` inside `<BodyPart>`). Label rendering lives in the React overlay (via `<LabelItem>` inside `<EngineOverlayHost>`). These two sides are connected by label ID.

---

## Label DSL Components

### `<Label>`

Defines a label attached to a model body part. Must be nested under `<BodyPart>` or `<Subpart>`. The `targetPartId` is resolved automatically from the parent body part context — do not set it directly on `<Label>`.

Exported from `@brewsite/model` as `Label`.

```tsx
import { BodyParts, BodyPart, Label } from '@brewsite/model';

<Model type="Robot" id="robot" ...>
  <BodyParts>
    <BodyPart id="Head">
      <Label
        id="head-label"
        text="Sensor Array"
        labelOffset={[0, 0.35, 0]}
        style={{ color: '#7ffcff', fontSize: 13 }}
      />
    </BodyPart>
  </BodyParts>
</Model>
```

`LabelProps` is `LabelDefinition & { children?: never }`.

### `LabelDefinition` type

```ts
type LabelDefinition = {
  id: string;                          // Unique label ID. Must match the id on LabelItem.
  text: string;                        // Label display text.
  labelOffset?: [number, number, number]; // World-space offset from the bone position.
  enabled?: boolean;                   // When false, label is hidden. Default: true.
  style?: LabelStyle;                  // Visual styling (see below).
};
```

All `LabelDefinition` fields are accepted as `<Label>` props.

---

## Label Positioning

Labels are positioned in world space, anchored to a named bone or mesh via the `id` prop on the parent `<BodyPart>`. The `labelOffset` prop shifts the anchor point in world space relative to the bone's position.

```tsx
<BodyPart id="Head">
  {/* Offset 0.35 units up in world space from the Head bone */}
  <Label id="head-label" text="Sensor Array" labelOffset={[0, 0.35, 0]} />
</BodyPart>
```

`labelOffset` is `[x, y, z]` in world units. A positive Y offset moves the label up. Adjust this to position the label anchor above or beside the target bone.

The `LabelPositioner` (owned by `modelPlugin`) projects this world-space anchor position through the active camera each frame, computing screen-space coordinates. It then sets CSS variables on the corresponding `LabelItem` DOM element to position both the text and the leader line.

The label text element is absolutely positioned at the projected screen coordinates. The leader line is a CSS-transformed `<span>` drawn from the label origin to the anchor point.

---

## Label Transitions

Labels appear and disappear across scenes based on which scene is active. A label is visible when the current scene includes the `<BodyPart>/<Label>` declaration with `enabled` not set to `false`.

To control label visibility per scene, toggle `enabled`:

```tsx
// Scene 1: label hidden
<BodyPart id="Head">
  <Label id="head-label" text="Sensor Array" enabled={false} />
</BodyPart>

// Scene 2: label visible
<BodyPart id="Head" color="#7ffcff">
  <Label id="head-label" text="Sensor Array" labelOffset={[0, 0.35, 0]} />
</BodyPart>
```

There is no built-in label fade animation — label visibility is binary per scene. To get a fade effect, use CSS transitions on the `<LabelItem>` wrapper or on the `EngineOverlayHost` container.

---

## Label Styling

Styling is controlled by the `style` prop on `<Label>`, which accepts a `LabelStyle` object:

```ts
type LabelStyle = {
  // Text color. Use 'target-color' to inherit the body part's override color.
  color?: LabelColor;

  // Leader line color. Use 'target-color' to inherit the body part's color.
  lineColor?: LabelColor;

  // Font size — number (px) or CSS string ('1em', '0.8rem').
  fontSize?: number | string;

  // Leader line opacity [0..1].
  lineOpacity?: number;

  // Label text opacity [0..1].
  labelOpacity?: number;

  // Leader line thickness in pixels.
  lineThickness?: number;

  // CSS font-family override. When absent, inherits from the DOM ancestor.
  fontFamily?: string;
};

type LabelColor = 'target-color' | (string & {}); // 'target-color' literal or any CSS color string
```

The special value `'target-color'` for `color` or `lineColor` causes the label to inherit the resolved color of its parent `<BodyPart>` at runtime. This is useful when the part color changes across scenes — the label stays color-matched.

```tsx
<BodyPart id="Head" color="#7ffcff">
  <Label
    id="head-label"
    text="Sensor Array"
    labelOffset={[0, 0.35, 0]}
    style={{
      color: 'target-color',    // Inherits #7ffcff from BodyPart
      lineColor: 'target-color',
      fontSize: 13,
      lineThickness: 1.5,
      lineOpacity: 0.85,
    }}
  />
</BodyPart>
```

### CSS Custom Properties

`LabelItem` renders with CSS custom properties that can be overridden at the container level:

- `--label-color` — overrides the text color
- `--label-line-color` — overrides the line color
- `--label-line-origin-x` / `--label-line-origin-y` — set by `LabelPositioner` each frame
- `--label-line-length` / `--label-line-angle` — set by `LabelPositioner` each frame
- `--label-line-thickness` — overrides line thickness

The `--brewsite-font-family` CSS variable (set by `EngineOverlayHost` via `SceneTheme`) is automatically inherited by label text because `font-family` is a CSS inherited property. Per-label `fontFamily` in `LabelStyle` overrides this.

---

## `<LabelItem>` Render Component

`LabelItem` is the React component that renders one label's DOM. Place it inside `<EngineOverlayHost>`, outside the scene declaration tree.

```tsx
import { LabelItem } from '@brewsite/model';

<EngineOverlayHost>
  <LabelItem label={{ id: 'head-label', text: 'Sensor Array', targetPartId: 'Head' }} />
</EngineOverlayHost>
```

`LabelItem` accepts a `label` prop of type `LabelResolved`:

```ts
type LabelResolved = LabelDefinition & {
  targetPartId: string;   // The body part ID to track (e.g. 'Head')
  screenPosition?: { x: number; y: number }; // Set by LabelPositioner each frame
};
```

`targetPartId` must match the `id` on the parent `<BodyPart>` in the scene DSL. `LabelItem` registers itself with the `LabelPositioner` via `useLabelPositioner()` on mount and deregisters on unmount.

The `text` on `LabelItem` can differ from the `text` on `<Label>` in the scene — the `<Label>` text is what gets compiled into scene state, while the `LabelItem` text is what renders in the DOM. Keep them consistent unless you have a specific reason to differ.

---

## Complete Labels Example

A scene sequence with a model and multiple labels pointing to different parts.

```tsx
// widgetSetup.ts
import { modelPlugin } from '@brewsite/model';
export const myPlugin = modelPlugin({ manifestUrl: '/assets/model/manifest.json' });

// scenes.tsx
import { Scene, ProgressManager, Camera, Lighting, Ambient, Directional, Background } from '@brewsite/core';
import { Model, Playback, Animation, BodyParts, BodyPart, Label } from '@brewsite/model';

export function SceneWithLabels() {
  return (
    <Scene id="model-callouts">
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
        x={"10%"} y={"0%"} w={"80%"} h={"100%"}
        opacity={1}
      >
        <Playback>
          <Animation enabled clipName="chat-relax-f" weight={0.6} clipRepeat />
        </Playback>

        <BodyParts>
          {/* Head — accent color + label above */}
          <BodyPart id="Head" color="#7ffcff" opacity={1}>
            <Label
              id="head-label"
              text="Sensor Array"
              labelOffset={[0, 0.35, 0]}
              style={{
                color: 'target-color',
                lineColor: 'target-color',
                fontSize: 13,
                lineThickness: 1.5,
              }}
            />
          </BodyPart>

          {/* Left hand — different color */}
          <BodyPart id="CC_Base_L_Hand" color="#ff9966" opacity={1}>
            <Label
              id="hand-label"
              text="Haptic Interface"
              labelOffset={[0.15, 0.1, 0]}
              style={{ color: '#ff9966', lineColor: '#ff9966', fontSize: 12 }}
            />
          </BodyPart>

          {/* Torso — dimmed, no label */}
          <BodyPart id="Spine" opacity={0.5} />
        </BodyParts>
      </Model>
    </Scene>
  );
}

// MyPage.tsx
import { useMemo } from 'react';
import {
  corePlugin, SceneEngine,
  ScrollStage, SceneCanvas, BackgroundLayer, EngineOverlayHost,
} from '@brewsite/core';
import { LabelItem } from '@brewsite/model';
import { myPlugin } from './widgetSetup';
import { SceneWithLabels } from './scenes';

export default function MyPage() {
  const plugins = useMemo(() => [corePlugin(), myPlugin], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#030510' }}>
      <SceneEngine plugins={plugins}>
        <SceneWithLabels />

        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1000}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost>
            {/*
              LabelItem components live here — outside the scene declaration.
              One LabelItem per label ID. The targetPartId must match the
              BodyPart id from the scene DSL.
            */}
            <LabelItem
              label={{
                id: 'head-label',
                text: 'Sensor Array',
                targetPartId: 'Head',
                style: { color: '#7ffcff', lineColor: '#7ffcff', fontSize: 13 },
              }}
            />
            <LabelItem
              label={{
                id: 'hand-label',
                text: 'Haptic Interface',
                targetPartId: 'CC_Base_L_Hand',
                style: { color: '#ff9966', lineColor: '#ff9966', fontSize: 12 },
              }}
            />
          </EngineOverlayHost>
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
```

**Key rules:**
1. `<Label>` in the scene DSL declares that a label exists and defines its compiled state.
2. `<LabelItem>` in `<EngineOverlayHost>` renders the actual DOM element.
3. The `id` on `<Label>` and the `id` in `LabelItem`'s `label` prop must match.
4. The `targetPartId` on `LabelItem` must match the `id` on the parent `<BodyPart>`.
5. `<Label>` must be a direct child of `<BodyPart>` or `<Subpart>`. Using it elsewhere throws.
