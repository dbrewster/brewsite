---
title: Lighting Element DSL Reference
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-21
---

## Lighting Overview

The `<Lighting>` element is an ambient DSL component that configures all light sources for a scene. It accepts child components for each light type: `<Ambient>`, `<Directional>`, `<Point>`, `<GlowPoint>`, `<Spot>`, `<LightStrand>`, and `<Panel>`.

Lighting affects GLTF model materials (PBR — specular, diffuse, shadows), diagram element surfaces, and the floor plane. The `intensityScale` prop scales all child lights' intensities by a global multiplier, making it easy to dim or brighten a scene without editing each light individually.

`<GlowPoint>` is a sprite-based pseudo-light that renders as a visible glowing orb. It does NOT illuminate surfaces, cast shadows, or participate in PBR material calculations — it is a visual effect only. For actual scene illumination, use `<Point>` instead. Only ONE `<GlowPoint>` per `<Lighting>` component is supported — the `SceneLighting` type has a singular `glowPoint?` field, not an array.

Import from `@brewsite/core`:

```tsx
import { Lighting, Ambient, Directional, Point, GlowPoint, Spot, LightStrand } from '@brewsite/core';
```

---

## Lighting Props

### `<Lighting>` (container)

```tsx
<Lighting intensityScale={1.0} color="#ffffff">
  {/* child light components */}
</Lighting>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `intensityScale` | `number` | 1.0 | Global multiplier applied to all child light intensities |
| `color` | `string` | `'#ffffff'` | Global tint applied to all lights (CSS hex or color string) |
| `children` | `ReactNode` | — | `<Ambient>`, `<Directional>`, `<Point>`, `<GlowPoint>`, `<Spot>`, `<LightStrand>`, `<Panel>` |

All prop values accept either a static value or a resolver function `(context: SceneSnapshotContext) => value`.

---

### `<Ambient>`

Uniform fill light with no direction. Affects all surfaces equally. Use low values to prevent pure-black shadows.

```tsx
<Ambient intensity={0.7} color="#d0e4ff" />
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | no | Optional stable ID for transition targeting |
| `intensity` | `number` | yes | Light intensity |
| `color` | `string` | yes | Light color (CSS hex) |

---

### `<Directional>`

Parallel rays from a direction. Position determines direction only — the actual distance from origin does not change intensity. The default `[10, 10, 10]` places a key light above-right-front.

```tsx
<Directional intensity={1.0} color="#ffffff" position={[5, 10, 6]} />
<Directional intensity={0.4} color="#b0ccff" position={[-6, 4, 8]} />
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | no | Optional stable ID |
| `intensity` | `number` | yes | Light intensity |
| `color` | `string` | yes | Light color (CSS hex) |
| `position` | `Vec3` | yes | World-space position. Only direction from origin to position matters — magnitude is irrelevant |

---

### `<Point>`

Three.js `PointLight`. Illuminates nearby geometry in all directions from a world-space position. Participates in shadow casting and PBR material interactions. More GPU-expensive than `<GlowPoint>`.

```tsx
<Point intensity={2.0} color="#ff8844" position={[2, 1.5, 1]} />
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | no | Optional stable ID |
| `intensity` | `number` | yes | Light intensity |
| `color` | `string` | yes | Light color (CSS hex) |
| `position` | `Vec3` | yes | World-space position of the light source |

---

### `<GlowPoint>`

A sprite-based pseudo-light that renders as a visible glowing orb. It does NOT illuminate surfaces, cast shadows, or participate in PBR material calculations. It is a visual effect only — a billboard sprite with a glow texture. Use for decorative light sources, UI indicators, or ambient atmosphere effects. For actual scene illumination, use `<Point>` instead.

**Limitation:** Only ONE `<GlowPoint>` per `<Lighting>` component is supported. The compiled `SceneLighting` type has a singular `glowPoint?` field. If you need multiple illuminating point lights, use `<Point>` instead.

```tsx
{/* Decorative glow orb — does NOT illuminate surfaces */}
<GlowPoint intensity={2.5} color="#ff4020" position={[4, 3, 2]} distance={8} decay={2} />
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | no | Optional stable ID |
| `intensity` | `number` | yes | Glow brightness |
| `color` | `string` | yes | Glow color |
| `position` | `Vec3` | yes | World-space position of the glow sprite |
| `distance` | `number` | no | Visual falloff distance |
| `decay` | `number` | no | Visual falloff decay rate |

**Point vs GlowPoint:**

| | `<Point>` | `<GlowPoint>` |
|---|---|---|
| Illuminates surfaces | Yes | No |
| Casts shadows | Yes | No |
| PBR interactions | Yes (specular, diffuse) | None |
| Visual appearance | Invisible (light source only) | Visible glowing orb sprite |
| GPU cost | Higher (real light) | Lower (sprite only) |
| Max per scene | Unlimited | 1 |
| Use case | Scene illumination | Decorative glow, atmosphere |

---

### `<Spot>`

Three.js `SpotLight`. Cone of light aimed at a target. Cast shadows, participate in PBR.

```tsx
<Spot
  intensity={3.0}
  color="#ffffff"
  position={[0, 6, 2]}
  target={[0, 0, 0]}
  angle={"30deg"}        // cone half-angle
  penumbra={0.2}         // softness of edge [0..1]
  distance={12}          // maximum light range
  decay={2}              // falloff rate
/>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | no | Optional stable ID for transition targeting |
| `intensity` | `number` | yes | Light intensity |
| `color` | `string` | yes | Light color |
| `position` | `Vec3` | yes | World-space spotlight source |
| `target` | `Vec3` | yes | World-space aim point |
| `angle` | `SceneAngle` | yes | Cone half-angle. Accepts `"30deg"`, `"0.52rad"`, or `0` |
| `penumbra` | `number` | yes | Edge softness [0=hard, 1=soft] |
| `distance` | `number` | no | Maximum range (0 = unlimited) |
| `decay` | `number` | no | Falloff rate |

---

### `<LightStrand>`

A strand of point lights arranged in a geometric shape. Used for decorative lighting rigs. Supply a child `<Wave>`, `<Circle>`, or `<Rectangle>` to define the shape.

```tsx
<LightStrand id="ring" count={32} intensity={1.2} color="#60a0ff" distance={3} decay={2}>
  <Circle radius={2.5} axis="xz" />
</LightStrand>

<LightStrand id="arch" count={24} intensity={0.8} color="#ff80a0" distance={2}>
  <Wave length={8} yOffset={3} z={0} waveAmplitude={1} waveFrequency={1.5}
        depthAmplitude={0.5} depthFrequency={1} depthPhase={0} />
</LightStrand>
```

**`<LightStrand>` props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Stable ID |
| `count` | `number` | yes | Number of point lights in the strand |
| `intensity` | `number` | yes | Per-light intensity |
| `color` | `string` | yes | Light color |
| `position` | `Vec3` | no | World-space offset applied to the strand's origin |
| `distance` | `number` | no | Point light range |
| `decay` | `number` | no | Falloff rate |
| `curve` | `SceneLightStrandCurve` | no | **Deprecated.** Inline wave-curve definition. Use a `<Wave>` child component instead — the child-component API is more expressive and composable. This prop will be removed in a future major version |
| `children` | `ReactNode` | no | `<Wave>`, `<Circle>`, or `<Rectangle>` shape definition |

**`<Circle>` props:** `radius` (required), `axis?: 'xy' | 'xz' | 'yz'` (default `'xz'`), `offset?: Vec3`

**`<Rectangle>` props:** `width`, `height` (required), `axis?`, `offset?`

**`<Wave>` props:** `length`, `yOffset`, `z`, `waveAmplitude`, `waveFrequency`, `depthAmplitude`, `depthFrequency`, `depthPhase` (all required)

---

### `<Panel>`

A grid of point lights. Useful for large area lighting installations.

```tsx
<Panel
  id="ceiling-panel"
  origin={[-4, 5, -4]}
  rows={3}
  cols={3}
  spacing={[4, 0, 4]}
  intensity={1.5}
  distance={8}
  decay={2}
  color="#e8f0ff"
/>
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Stable ID |
| `origin` | `Vec3` | yes | World-space position of the top-left light in the grid |
| `rows` | `number` | yes | Number of rows |
| `cols` | `number` | yes | Number of columns |
| `spacing` | `Vec3` | yes | World-space step between adjacent lights |
| `intensity` | `number` | yes | Per-light intensity |
| `distance` | `number` | no | Light range |
| `decay` | `number` | no | Falloff rate |
| `color` | `string` | no | Light color |
| `matrix` | `number[]` | no | Per-light intensity multipliers (flat array, length = rows × cols) |

---

## Lighting Presets / Common Setups

### Soft professional (models, diagrams)

```tsx
<Lighting intensityScale={1.0}>
  <Ambient intensity={0.8} color="#d7e8ff" />
  <Directional intensity={0.9} color="#ffffff" position={[4, 10, 6]} />
  <Directional intensity={0.4} color="#b0ccff" position={[-6, 4, 8]} />
</Lighting>
```

Good default for GLTF models. The cool-tinted ambient (`#d7e8ff`) lifts shadow floors, and the secondary fill from the left-back creates subtle depth.

### Model showcase (the model-showcase example)

```tsx
<Lighting intensityScale={1.1}>
  <Ambient intensity={0.7} color="#d0e4ff" />
  <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
  <Directional intensity={0.3} color="#a0c0ff" position={[-5, 3, 8]} />
</Lighting>
```

### Dramatic / cinematic

```tsx
<Lighting intensityScale={1.2}>
  <Ambient intensity={0.15} color="#0a0a20" />
  <Directional intensity={2.0} color="#ff6030" position={[8, 12, 4]} />
  <Directional intensity={0.8} color="#3060ff" position={[-8, 2, 6]} />
  <GlowPoint intensity={2.5} color="#ff4020" position={[4, 3, 2]} />
</Lighting>
```

Very low ambient pushes the scene dark. Two strong, opposing-color directionals create harsh cross-lighting. The `<GlowPoint>` adds a visible glowing orb as a decorative accent — it does not illuminate surfaces. For actual fill lighting, use `<Point>` instead. Only one `<GlowPoint>` is supported per `<Lighting>`.

### Neutral/light mode

```tsx
<Lighting intensityScale={0.9}>
  <Ambient intensity={1.2} color="#f8f8f0" />
  <Directional intensity={0.8} color="#ffffff" position={[5, 10, 5]} />
  <Directional intensity={0.3} color="#e0e8ff" position={[-4, 6, 6]} />
</Lighting>
```

Higher ambient intensity softens shadows for light-polarity scenes.

---

## Lighting Transitions

The compiler auto-interpolates lighting state between scenes when the scene description changes. Numeric values (`intensity`, `intensityScale`) interpolate smoothly. Color values switch at the midpoint of the transition (discrete swap — not color lerp).

```tsx
// Scene A — warm accent
export function SceneA() {
  return (
    <Scene id="scene-a">
      <Lighting intensityScale={1.0}>
        <Ambient intensity={0.6} color="#fff0e0" />
        <Directional intensity={1.2} color="#ffe8c0" position={[5, 10, 5]} />
      </Lighting>
    </Scene>
  );
}

// Scene B — cool blue shift. intensityScale interpolates 1.0 → 1.3 through transition.
export function SceneB() {
  return (
    <Scene id="scene-b">
      <Lighting intensityScale={1.3}>
        <Ambient intensity={0.4} color="#c0d8ff" />
        <Directional intensity={0.8} color="#a0c0ff" position={[5, 10, 5]} />
      </Lighting>
    </Scene>
  );
}
```

To fade lights out on scene exit or in on scene entry, let the `<Lighting>` disappear or appear across scenes — the compiler applies automatic entry/exit transitions via `intensityScale`.
