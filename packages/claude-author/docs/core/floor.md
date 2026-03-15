---
title: Floor Element DSL Reference
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## Floor Overview

The `<Floor>` element renders a horizontal plane that catches shadows from scene geometry and optionally reflects it. It grounds 3D models visually and adds depth to diagram scenes.

Three surface types are available via the `variant` prop:
- **`'grid'`** (default): Physical floor with a procedural grid pattern and shadow receiving. No reflections.
- **`'physical'`**: Plain PBR floor with full material control (color, metalness, roughness, textures).
- **`'mirror'`**: Reflective floor with real-time mirror and shadow catcher.

`<Floor>` is an ambient DSL element — it does not use NVS `x`/`y`/`w`/`h` positioning. Its position is in world-space coordinates.

Import from `@brewsite/core`:

```tsx
import { Floor, FloorPhysical, FloorMirror } from '@brewsite/core';
```

**Important:** Floor position is **not NVS**. Values are raw Three.js world-space units. To co-locate the floor with a model placed at `nvsX`/`nvsY`, call `nvsToWorldAnalytic()` from `@brewsite/core` to resolve the model's world position first, then pass that to `Floor.position`.

---

## Floor Props

### `<Floor>` (container)

```tsx
<Floor
  enabled={true}
  variant="grid"
  placement="sceneBase"
  position={[0, 0, 0]}
  scale={1}
  negativeZExtent={18}
  negativeZEdge="fade"
  negativeZFadeDistance={3}
>
  {/* optional <FloorPhysical> or <FloorMirror> child to override variant */}
</Floor>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Whether the floor renders |
| `variant` | `'grid' \| 'mirror' \| 'physical'` | `'grid'` | Quick surface preset. Overridden when a `<FloorPhysical>` or `<FloorMirror>` child is present |
| `placement` | `'origin' \| 'sceneBase'` | `'sceneBase'` | Y-origin strategy. `'origin'` uses world origin. `'sceneBase'` snaps to lowest visible geometry each frame |
| `position` | `[number, number, number]` | `[0, 0, 0]` | World-space position. Not NVS |
| `rotation` | `[number, number, number]` | — | Absolute world rotation in radians |
| `rotationRelative` | `[number, number, number]` | — | Rotation offset relative to floor baseline `[-PI/2, 0, 0]`. Use for subtle tilt |
| `scale` | `number` | 1 | Uniform scale |
| `negativeZExtent` | `number` | — | World-space depth in the negative Z direction from floor origin. When omitted, floor is unbounded |
| `negativeZEdge` | `'hard' \| 'fade'` | `'hard'` | Back-edge behavior when `negativeZExtent` is set. `'hard'` clips, `'fade'` alpha-fades |
| `negativeZFadeDistance` | `number` | internal default | World-space fade distance for `negativeZEdge='fade'` |
| `debug` | `boolean` | `false` | When `true`, renders a bright red debug line at world Z=0 |
| `theme` | `SceneTheme` | — | Optional SceneTheme to derive grid-floor tokens from |
| `children` | `ReactNode` | — | `<FloorPhysical>` or `<FloorMirror>` override |

---

### `<FloorPhysical>`

A full PBR physical floor. Accepts the same material properties as Three.js `MeshPhysicalMaterial`. When `pattern='grid'`, a procedural grid is generated as a texture overlay.

```tsx
<Floor enabled variant="physical">
  <FloorPhysical
    color="#151a24"
    roughness={0.9}
    metalness={0.1}
    opacity={1}
  />
</Floor>
```

**Grid floor (physical + pattern):**

```tsx
<Floor enabled variant="grid">
  <FloorPhysical
    pattern="grid"
    color="#111720"
    gridColor="#2a3442"
    gridMajorColor="#445468"
    gridCellSize={2}
    gridMajorEvery={5}
    gridLineOpacity={0.95}
    gridFillOpacity={0}
    roughness={0.92}
    metalness={0.08}
  />
</Floor>
```

Key `<FloorPhysical>` props:

| Prop | Type | Default | Description |
|---|---|---|---|
| `pattern` | `'grid'` | — | When set, generates procedural grid overlay |
| `color` | `string` | `'#151a24'` | Base fill color |
| `gridColor` | `string` | `'#2a3442'` | Minor grid line color (when `pattern='grid'`) |
| `gridMajorColor` | `string` | `'#445468'` | Major grid line color |
| `gridCellSize` | `number` | 2 | World-unit minor cell size |
| `gridMajorEvery` | `number` | 5 | Minor cells per major line |
| `gridLineOpacity` | `number` | 0.95 | Grid line opacity [0..1] |
| `gridFillOpacity` | `number` | 0 | Grid cell fill opacity |
| `opacity` | `number` | — | Overall surface opacity |
| `metalness` | `number` | — | PBR metalness [0..1] |
| `roughness` | `number` | — | PBR roughness [0..1] |
| `reflectivity` | `number` | — | PBR reflectivity |
| `clearcoat` | `number` | — | Clearcoat layer strength |
| `clearcoatRoughness` | `number` | — | Clearcoat roughness |
| `envMapIntensity` | `number` | — | Environment map contribution (ignored when `pattern='grid'`) |
| `textureUrl` | `string` | — | Base color texture URL |
| `normalMapUrl` | `string` | — | Normal map URL |
| `roughnessMapUrl` | `string` | — | Roughness map URL |
| `metalnessMapUrl` | `string` | — | Metalness map URL |
| `aoMapUrl` | `string` | — | Ambient occlusion map URL |
| `emissive` | `string` | — | Emissive color |
| `emissiveIntensity` | `number` | — | Emissive intensity |
| `wireframe` | `boolean` | — | Render as wireframe |

---

### `<FloorMirror>`

A real-time reflection floor. Uses `MirrorMesh` (Three.js reflector geometry). Adds a shadow-catcher layer above the mirror.

```tsx
<Floor enabled variant="mirror">
  <FloorMirror
    mirrorColor="#12171f"
    mirrorOpacity={0.9}
    shadowOpacity={0.3}
    mirrorResolution={1024}
    mirrorClipBias={0.003}
    mirrorUseEnvironmentBackground={false}
    mirrorEnvironmentIntensity={1.0}
  />
</Floor>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `mirrorColor` | `string` | `'#12171f'` | Mirror tint color |
| `mirrorOpacity` | `number` | 0.9 | Mirror reflectivity opacity |
| `shadowOpacity` | `number` | 0.3 | Shadow-catcher opacity layered over the mirror |
| `mirrorResolution` | `number` | 1024 | Reflection texture resolution in pixels |
| `mirrorClipBias` | `number` | 0.003 | Clip plane bias to prevent z-fighting |
| `mirrorUseEnvironmentBackground` | `boolean` | `false` | Whether the mirror reflects the environment background |
| `mirrorEnvironmentIntensity` | `number` | 1.0 | Environment intensity multiplier for mirror reflections |

---

## Floor Transitions

Floor properties transition automatically between scenes when the floor state changes. The `enabled` flag transitions in/out (fade). Numeric surface properties on `<FloorPhysical>` interpolate smoothly where possible.

```tsx
// Scene A — grid floor at full depth
<Floor enabled variant="grid" negativeZExtent={20} negativeZEdge="fade" />

// Scene B — floor pulls back (smaller extent). negativeZExtent interpolates.
<Floor enabled variant="grid" negativeZExtent={8} negativeZEdge="fade" />
```

To hide the floor for a scene:

```tsx
<Floor enabled={false} />
```

The floor fades out on exit and fades in on entry automatically.

---

## Common Usage

### Model scene with grid floor and depth fade

```tsx
<Floor
  variant="grid"
  negativeZExtent={18}
  negativeZEdge="fade"
  negativeZFadeDistance={4}
/>
```

The `negativeZExtent` prevents the grid from stretching to the horizon behind the model. `negativeZEdge="fade"` alpha-fades the back edge for a natural look.

### Mirror floor for product showcase

```tsx
<Floor variant="mirror">
  <FloorMirror
    mirrorOpacity={0.7}
    shadowOpacity={0.4}
    mirrorResolution={512}
  />
</Floor>
```

Lower `mirrorResolution` (512 or 256) improves performance for scenes where the mirror is a secondary element.

### Shallow input scene floor

```tsx
<Floor variant="grid" negativeZExtent={12} />
```

From the `input-showcase` example — a bounded grid floor that keeps the scene grounded without extending to the far clip plane.
