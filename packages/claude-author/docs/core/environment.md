---
title: Environment Element DSL Reference
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## Environment Overview

The `<Environment>` element loads an HDR or cube-map environment for physically-based rendering (PBR) in a scene. It populates `scene.environment` in Three.js, which means all PBR materials — GLTF model surfaces, metallic diagram nodes, floor planes — automatically reflect and pick up indirect lighting from the environment map.

This is distinct from direct lights (`<Ambient>`, `<Directional>`, etc.). The environment map provides:
- **Image-based lighting (IBL):** diffuse and specular reflections on PBR surfaces
- **Ambient occlusion interaction:** environment shadows in material crevices
- **Optional scene background:** when `background={true}`, the HDR image also replaces the CSS background layer

Without an environment map, metallic and glossy materials appear flat and unlit except for direct lights. For realistic-looking GLTF models or diagram elements, include an `<Environment>`.

Import from `@brewsite/core`:

```tsx
import { Environment, EnvironmentHdri, EnvironmentExr, EnvironmentCube } from '@brewsite/core';
```

---

## Environment Props

### `<Environment>` (container)

```tsx
<Environment enabled={true} intensity={1.0}>
  <EnvironmentHdri url="/assets/env/studio.hdr" />
</Environment>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Whether environment is active. When `false`, no environment map is applied |
| `intensity` | `number` | 1.0 | Multiplier applied to environment lighting contribution |
| `children` | `ReactNode` | — | Exactly one source child: `<EnvironmentHdri>`, `<EnvironmentExr>`, or `<EnvironmentCube>` |

---

### `<EnvironmentHdri>`

Loads an HDR (High Dynamic Range) `.hdr` file via Three.js `RGBELoader`.

```tsx
<Environment enabled intensity={0.8}>
  <EnvironmentHdri
    url="/assets/env/studio_small.hdr"
    background={false}   // when true, HDR image is also the visible background
  />
</Environment>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | yes | URL to the `.hdr` file |
| `background` | `boolean` | no | When `true`, sets the HDR as `scene.background` in addition to `scene.environment`. Default: `false` |

---

### `<EnvironmentExr>`

Loads an OpenEXR `.exr` file via Three.js `EXRLoader`.

```tsx
<Environment enabled intensity={1.0}>
  <EnvironmentExr
    url="/assets/env/studio.exr"
    background={false}
  />
</Environment>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | yes | URL to the `.exr` file |
| `background` | `boolean` | no | When `true`, sets as visible background. Default: `false` |

---

### `<EnvironmentCube>`

Loads a cube map from 6 face images: `[px, nx, py, ny, pz, nz]` (positive-X, negative-X, positive-Y, negative-Y, positive-Z, negative-Z).

```tsx
<Environment enabled>
  <EnvironmentCube
    urls={[
      '/env/px.jpg', '/env/nx.jpg',
      '/env/py.jpg', '/env/ny.jpg',
      '/env/pz.jpg', '/env/nz.jpg',
    ]}
    background={false}
  />
</Environment>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `urls` | `[string, string, string, string, string, string]` | yes | Exactly 6 face URLs in `[px, nx, py, ny, pz, nz]` order |
| `background` | `boolean` | no | When `true`, sets as visible background |

---

## Environment and Models

GLTF model materials use PBR by default. Without an environment map, metallic and glossy surfaces rely entirely on direct lights, which often produces flat or harsh results.

Adding `<Environment>` instantly improves material quality for:
- Metallic robot/product models — environment reflections appear on chrome and glossy surfaces
- Diagram elements — glass and metallic nodes pick up subtle reflections
- Floor (`variant="physical"` or `variant="mirror"`) — environment contributes to reflectivity

**When to include `<Environment>`:**
- Any scene with a GLTF model — always include it
- Diagram scenes with metallic or glass material themes — include it
- Pure 2D chart scenes — skip it (charts use flat materials, environment has no visible effect)

**When to skip `<Environment>`:**
- Scenes with only `<BarChart>`, `<LineChart>`, or similar flat chart elements
- Scenes where performance is critical and no reflective surfaces are present

**Example — model scene with environment:**

```tsx
import { Environment, EnvironmentHdri } from '@brewsite/core';

export function ModelScene() {
  return (
    <Scene id="robot-hero">
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
      <Lighting intensityScale={1.1}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
      </Lighting>
      <Background color="#030510" />
      <Environment intensity={0.6}>
        <EnvironmentHdri url="/assets/env/studio.hdr" />
      </Environment>
      <Model type="Robot" id="robot" scale={0.06} x={0.5} y={0} w={0.5} h={1} />
    </Scene>
  );
}
```

The `intensity={0.6}` keeps environment contributions subtle relative to the direct `<Directional>` lights.

---

## Environment Transitions

The environment transitions automatically when it changes between scenes:

- **`intensity`** interpolates smoothly through the transition.
- **`source`** (the `url` / type) switches at the midpoint — there is no crossfade between two different HDR files.
- **`enabled`** fades: on entry, intensity fades from 0 to target; on exit, intensity fades from target to 0.

To transition smoothly between two scenes with different environments, accept the source cut at the midpoint. The intensity tween around the cut softens the visual jump:

```tsx
// Scene A
<Environment intensity={1.0}>
  <EnvironmentHdri url="/assets/env/studio.hdr" />
</Environment>

// Scene B — source switches at midpoint; intensity interpolates
<Environment intensity={0.7}>
  <EnvironmentHdri url="/assets/env/outdoor.hdr" />
</Environment>
```

To fully disable the environment for a scene and re-enable it in the next:

```tsx
// Scene with no environment
<Environment enabled={false} />

// Next scene fades environment in from 0 to target intensity
<Environment enabled intensity={1.0}>
  <EnvironmentHdri url="/assets/env/studio.hdr" />
</Environment>
```
