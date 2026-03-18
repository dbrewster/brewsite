---
title: Camera Element DSL Reference
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-18
---

## Camera Overview

The `<Camera>` element controls the Three.js PerspectiveCamera for a scene. It sets position, look-at target, field of view, lens properties, post-processing exposure, and interactive orbit controls. There is typically one `<Camera>` per scene.

`<Camera>` is an ambient DSL element — it does not occupy an NVS slot and is not positioned with `x`/`y`/`w`/`h`. It configures the global scene camera. When `<Camera>` is absent from a scene, the camera holds its last rendered position from the previous scene — it does not reset.

Import from `@brewsite/core`:

```tsx
import { Camera } from '@brewsite/core';
```

The camera integrates with `<InputController>` actions (`camera.orbit`, `camera.zoom`, `camera.pan`, `camera.reset`). Default bindings provide Cmd/Ctrl+scroll orbit, pinch zoom, Shift+scroll pan, and R key reset with no DSL required. Custom bindings can be added via `<InputController>` in merge mode.

---

## Camera Props

`CameraProps` is a discriminated union on `mode`. Choose one of five positioning modes, then add optional lens, post, interaction, and transition props.

### mode: 'world'

Explicit world-space position and target. Most common for model and diagram scenes.

```tsx
<Camera
  mode="world"
  position={[0, 1.2, 4.5]}   // [x, y, z] world-space camera position
  target={[0, 1.0, 0]}        // world-space look-at point
  up={[0, 1, 0]}              // optional up vector, default [0, 1, 0]
  fov={45}
/>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `mode` | `'world'` | yes | Positioning mode selector |
| `position` | `Vec3` | yes | Camera position in world space |
| `target` | `Vec3` | yes | Point camera looks at |
| `up` | `Vec3` | no | Up vector. Default `[0, 1, 0]` |
| `nvsTarget` | `readonly [number, number]` | no | NVS-space look-at point override. Pins the camera's look-at X,Y to an NVS location; target Z is still taken from `target[2]` |

---

### mode: 'orbit'

Spherical coordinates around a target. Good for turntable views and rotate-around-subject transitions.

```tsx
<Camera
  mode="orbit"
  target={[0, 0, 0]}    // orbit center in world space
  azimuth={0.3}          // horizontal angle in radians (0 = +Z facing)
  polar={1.1}            // vertical angle from equator (0 = level, PI/2 = top-down)
  distance={7}           // distance from target in world units
  fov={50}
/>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `mode` | `'orbit'` | yes | |
| `target` | `Vec3` | yes | Orbit center in world space |
| `azimuth` | `number` | yes | Horizontal angle in radians. 0 = +Z axis facing. Positive = counter-clockwise |
| `polar` | `number` | yes | Vertical angle from horizontal plane. 0 = equator, PI/2 = top-down |
| `distance` | `number` | yes | Distance from target in world units |
| `up` | `Vec3` | no | Up vector. Default `[0, 1, 0]` |
| `nvsTarget` | `readonly [number, number]` | no | NVS-space look-at point override. Pins the orbit center X,Y to an NVS location; target Z is still taken from `target[2]` |

---

### mode: 'nvsViewport'

Derived camera for 2D diagram/chart scenes with no 3D models. The compiler resolves position, FOV, near, and far from two semantic parameters. Use this when you want NVS coordinates to map cleanly to world coordinates without manually computing camera Z.

```tsx
<Camera
  mode="nvsViewport"
  worldScale={10}   // world units spanning NVS height [0..1]. Default: 10
  zRange={5}        // total visible Z depth centered on z=0. Default: worldScale / 2
/>
```

With defaults (`worldScale=10`, `zRange=5`): `cameraZ ≈ 12.07`, visible world height = 10, visible world width ≈ 17.78 at 16:9.

| Prop | Type | Required | Description |
|---|---|---|---|
| `mode` | `'nvsViewport'` | yes | |
| `worldScale` | `number` | no | World units for NVS vertical span. Default: 10 |
| `zRange` | `number` | no | Visible Z depth (centered). Default: `worldScale / 2` |

---

### mode: 'fitBotHeight' (legacy)

Auto-frames a target model's height within the viewport.

```tsx
<Camera
  mode="fitBotHeight"
  targetId="robot"         // widget ID of the model to frame
  targetHeight={1.0}       // model height at scale=1 in world units
  framingHeightPct={0.4}   // fraction of viewport height the model occupies. Default 0.4
  heightOffset={0}         // camera Y offset relative to target
  distanceOffset={0}       // extra distance beyond computed value
/>
```

**Limitation:** Transitioning between `fitBotHeight` and `world`/`orbit` modes produces a hard cut at the midpoint, not a smooth interpolation. The world-space position is resolved at render time, not compile time. For smooth camera transitions, use `world` or `orbit` on both ends.

---

### mode: 'fitFloorDepth' (legacy)

Auto-frames a floor depth span. Deprecated — prefer `mode: 'world'` for new scenes.

```tsx
<Camera
  mode="fitFloorDepth"
  floorY={0}
  floorZMin={-2}
  floorZMax={2}
  lookAtZ={0}
  cameraX={0}
  cameraY={1.5}
/>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `mode` | `'fitFloorDepth'` | yes | |
| `floorY` | `number` | yes | Floor Y position in world space |
| `floorZMin` | `number` | yes | Minimum Z extent of the floor |
| `floorZMax` | `number` | yes | Maximum Z extent of the floor |
| `lookAtZ` | `number` | no | Z coordinate the camera looks at |
| `cameraX` | `number` | no | Camera X position in world space |
| `cameraY` | `number` | no | Camera Y position. When omitted, derived from `floorY + (floorZMax - floorZMin) * 0.4`. **Deprecated** — supply explicitly. The auto-derived fallback is a best-effort heuristic not calibrated for 1-unit world scenes |

---

### Shared Lens Props

All modes accept these optional lens props (flat, map to `CameraLens`):

| Prop | Type | Default | Description |
|---|---|---|---|
| `fov` | `number` | 45 | Vertical field of view in degrees |
| `focalLength` | `number` | — | Focal length in mm relative to `filmGauge`. Overrides `fov` when set. 50mm on 35mm film ≈ 39.6° FOV |
| `filmGauge` | `number` | 35 | Film gauge in mm. Affects `focalLength` computation |
| `near` | `number` | 0.1 | Near clip plane in world units |
| `far` | `number` | 2000 | Far clip plane in world units |

---

### Post-Processing Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `exposure` | `number` | 1.0 | Tone-mapping exposure multiplier applied to `renderer.toneMappingExposure` |

---

### Interaction Props

`interaction?: TrackpadCameraConfig` — enables trackpad and mouse camera control. When `enabled: false` (default), all other fields are ignored.

```tsx
<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={0.5}
  polar={0.8}
  distance={6}
  interaction={{
    enabled: true,
    rotate: { speed: 0.8 },           // Ctrl/Cmd+drag to orbit. false disables
    pan: { speed: 1.0 },              // Shift+drag to pan. false disables
    zoom: { speed: 1.0 },             // Alt+drag to dolly. false disables
    wheelZoom: false,                  // Alt+wheel dolly. Default false
    damping: 0.25,                     // inertia in seconds. false = instant
    minDistance: 0.1,                  // minimum orbit radius
    maxDistance: 20,                   // maximum orbit radius
    minPolarAngle: 0,                  // radians from top
    maxPolarAngle: Math.PI,            // radians from top
    reset: { key: 'r' },              // keyboard shortcut to reset camera
    resetOnSceneChange: true,          // smooth reset when scene changes
  }}
/>
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Master switch. False = all interaction disabled |
| `rotate` | `boolean \| { speed?: number }` | enabled | Ctrl/Cmd+drag orbits. `false` disables |
| `pan` | `boolean \| { speed?: number }` | enabled | Shift+drag pans. `false` disables |
| `zoom` | `boolean \| { speed?: number }` | enabled | Alt+drag dollies. `false` disables |
| `wheelZoom` | `boolean` | `false` | Alt+wheel dollies. When false, unmodified wheel still navigates scenes |
| `damping` | `number \| false` | 0.25 | Inertia in seconds. `false` = instant response |
| `minDistance` | `number` | 0.1 | Minimum camera distance from orbit target |
| `maxDistance` | `number` | 50 | Maximum camera distance |
| `minPolarAngle` | `number` | 0 | Minimum polar angle (radians from top) |
| `maxPolarAngle` | `number` | Math.PI | Maximum polar angle |
| `wheelLockIdleMs` | `number` | 160 | Wheel sticky-lock idle timeout in milliseconds. After this duration of no wheel events, the axis lock resets |
| `wheelAxisDominance` | `number` | 1.2 | Axis dominance ratio for sticky wheel locking. The dominant axis delta must exceed the other by this ratio to lock |
| `wheelAxisActivationThreshold` | `number` | 10 | Total cumulative wheel delta threshold before committing to an axis lock |
| `reset` | `KeyCombo \| false` | `{ key: 'r' }` | Keyboard shortcut to reset camera to scene position. `KeyCombo` is `{ key: string; modifiers?: ModifierKey[] }` where `ModifierKey = 'alt' \| 'ctrl' \| 'meta' \| 'shift'` |
| `resetOnSceneChange` | `boolean` | `true` | Smooth reset when user navigates to a new scene |

**Modifier-key bindings summary:**
- `Ctrl + drag` → orbit
- `Cmd + drag` → orbit (macOS)
- `Cmd+Shift + drag` → orbit axis lock (horizontal OR vertical, macOS)
- `Shift + drag` → pan
- `Alt + drag` → dolly
- `Shift + wheel` → pan
- `Alt + wheel` → dolly (when `wheelZoom: true`)

---

### Transition Props

| Prop | Type | Description |
|---|---|---|
| `transitionIn` | `CameraTransitionInterpolation` | Interpolation mode for transitioning INTO this scene |

See the **Camera Transitions** section for details.

---

## Camera Positioning

Camera coordinates are world-space, not NVS. The NVS coordinate system (x=0 left, x=1 right, y=0 top, y=1 bottom) is for 2D element positioning — it does not directly apply to camera world-space coordinates.

For `mode: 'world'`, position the camera by reasoning in 3D world units. BrewSite scenes typically use a 1-unit world where model height ≈ 1 world unit and a natural camera distance is roughly 3.5–7 units.

**Common setups:**

```tsx
// Front view — straight on, slightly above center
<Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />

// 3/4 view — offset left, looking across
<Camera mode="world" position={[-1.5, 1.5, 4.0]} target={[0, 1.0, 0]} fov={45} />

// Top-down — high Y, looking straight down
<Camera mode="world" position={[0, 8, 0.01]} target={[0, 0, 0]} fov={50} />

// Close-up portrait — tight FOV
<Camera mode="world" position={[0, 1.6, 2.5]} target={[0, 1.4, 0]} fov={30} />

// Wide establishing shot
<Camera mode="world" position={[0, 2.0, 10.0]} target={[0, 0.5, 0]} fov={55} />
```

For `mode: 'orbit'`:
- `azimuth=0` → camera is on the +Z side, facing -Z
- `azimuth=Math.PI/2` → camera is on the +X side, facing -X
- `polar=0` → equator-level
- `polar=0.3` → slightly above equator (good for slight elevated hero)
- `polar=Math.PI/4` → 45° above equator

Both `WorldSpaceCamera` and `OrbitCamera` accept an optional `nvsTarget?: [x, y]` prop to override the world-space target's X,Y coordinates with an NVS-space look-at point. This pins the camera's look-at to an NVS location regardless of the world-space target value — useful for aligning the camera to the visual center of an NVS region. The target Z is always taken from `target[2]`.

---

## Camera Transitions

When the same `<Camera>` appears in consecutive scenes, the compiler auto-interpolates position, target, FOV, and other numeric properties through the transition period.

The `transitionIn` prop on the destination scene's `<Camera>` controls the interpolation type:

```tsx
// Scene B: camera slides into position with eased interpolation
<Camera
  mode="world"
  position={[2.5, 2.0, 5.0]}
  target={[0, 1.0, 0]}
  fov={40}
  transitionIn={{ type: 'eased', ease: 'easeInOut' }}
/>
```

**Available interpolation types:**

```tsx
// Linear (default)
transitionIn={{ type: 'linear' }}

// Eased — smooth acceleration/deceleration
transitionIn={{ type: 'eased', ease: 'easeInOut' }}
// ease values: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'smoothstep'

// Bezier path — position follows a cubic bezier curve through world space
transitionIn={{ type: 'bezier', cp1: [1, 3, 6], cp2: [2, 2, 5] }}

// Orbit arc — camera orbits around target while interpolating
transitionIn={{ type: 'orbit', ease: 'easeInOut' }}

// Spline path — camera follows a CatmullRom spline through waypoints
transitionIn={{ type: 'path', waypoints: [[0, 3, 8], [2, 2, 6]] }}
```

**Complete camera-move-between-scenes example:**

```tsx
// Scene A — wide establishing shot
export function SceneA() {
  return (
    <Scene id="hero">
      <Camera mode="world" position={[0, 2.0, 8.0]} target={[0, 1.0, 0]} fov={50} />
    </Scene>
  );
}

// Scene B — camera pushes in and shifts right, eased
export function SceneB() {
  return (
    <Scene id="detail">
      <Camera
        mode="world"
        position={[1.5, 1.5, 4.0]}
        target={[0.5, 1.2, 0]}
        fov={38}
        transitionIn={{ type: 'eased', ease: 'easeInOut' }}
      />
    </Scene>
  );
}
```

The compiler detects that both scenes have a `camera` widget and bakes the interpolation into the `SceneTrack`. No animation code needed in the scene author.

---

## Camera with InputController

Default input bindings provide Cmd/Ctrl+scroll orbit, pinch zoom, Shift+scroll pan, and R key reset for every scene automatically. Most scenes need no `<InputController>` at all.

To add custom camera bindings (e.g., left-drag orbit) on top of the defaults, use `<InputController>` in merge mode. The `<InputController>` must be a sibling of `<Camera>` inside the same `<Scene>`.

```tsx
import { Camera, InputController, Action, PointerMap, KeyMap } from '@brewsite/core';

export function InteractiveScene() {
  return (
    <Scene id="interactive">
      <Camera mode="world" position={[0, 1.5, 7]} target={[0, 0, 0]} fov={48} />

      {/* Merge mode (default) — add left-drag orbit on top of all defaults */}
      <InputController scope="canvas">
        <Action id="drag-orbit" type="camera.orbit">
          <PointerMap event="drag" button="left" axis="xy" />
        </Action>
        {/* Meta+click reset (in addition to default R key reset) */}
        <Action id="meta-reset" type="camera.reset">
          <PointerMap event="click" modifiers={['meta']} />
        </Action>
      </InputController>
    </Scene>
  );
}
```

`scope="canvas"` means pointer/wheel events only fire when over the canvas area, and keyboard events are focus-gated to the `ScrollStage` container.

The `<SceneEngine>` must have `primaryCameraId` set to the camera widget ID if there are multiple cameras:

```tsx
<SceneEngine plugins={plugins} primaryCameraId="camera">
```

The `camera` widget ID is the default — this prop is usually omitted.

---

## Common Camera Patterns

### Static camera for a hero shot

```tsx
<Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
```

### Camera that pushes in on scene change

```tsx
// Scene 1 — back, wide
<Camera mode="world" position={[0, 1.5, 7.0]} target={[0, 1.0, 0]} fov={50} />

// Scene 2 — forward, tighter, eased in
<Camera
  mode="world"
  position={[0, 1.3, 3.5]}
  target={[0, 1.0, 0]}
  fov={38}
  transitionIn={{ type: 'eased', ease: 'easeInOut' }}
/>
```

### Orbit camera with interaction enabled

```tsx
<Camera
  mode="orbit"
  target={[0, 0.5, 0]}
  azimuth={0.4}
  polar={0.6}
  distance={5}
  fov={45}
  interaction={{
    enabled: true,
    damping: 0.2,
    minDistance: 1.5,
    maxDistance: 15,
    reset: { key: 'r' },
    resetOnSceneChange: true,
  }}
/>
```

### Diagram/chart scene with NVS-aligned camera

```tsx
<Camera mode="nvsViewport" worldScale={10} />
```

This places the camera so that the NVS region [0..1] × [0..1] maps cleanly to world coordinates without any manual calculation.
