---
title: "Migration Guide: Scene Unit System"
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-21
---

# Migration Guide: Scene Unit System

## What Changed and Why

### The Problem

All spatial values in BrewSite were bare `number` types interpreted as NVS fractions (0–1). This caused:

1. **Aspect ratio distortion**: `size={[0.15, 0.15]}` produced a rectangle on non-square viewports because `0.15 × viewportWidth ≠ 0.15 × viewportHeight`.
2. **No way to express intent**: Authors could not distinguish "15% of viewport width" from "a consistent visual distance" from "15% of parent container."
3. **Implicit unit semantics**: The same `number` type meant different things in different contexts (NVS position, NVS size, world units, degrees, radians).

### The Solution

BrewSite now uses a CSS-inspired unit system where DSL-authored spatial values require explicit unit strings. Bare numbers (except `0`) are illegal at the DSL authoring surface. A single unit resolution module in `@brewsite/core` converts authored string values to NVS fractions at compile time.

**Compiled state remains `number`** — the transition system and render layer never see unit strings. Only the DSL authoring surface changed.

This is a **semver major** breaking change. TypeScript's type system catches all bare-number usage at compile time — there are zero runtime surprises.

---

## How to Run the Codemod

A codemod script automates the mechanical migration of scene files:

```bash
pnpm migrate:units
```

The codemod:
- Converts NVS position/bound values (0–1) → `"%"` strings (e.g., `x={0.5}` → `x={"50%"}`)
- Converts NVS size values (0–1) → `"u"` strings (e.g., `size={[0.15, 0.08]}` → `size={["15u", "8u"]}`)
- Converts radian angle values → `"rad"` strings (e.g., `azimuth={0.3}` → `azimuth={"0.3rad"}`)
- Converts degree angle values → `"deg"` strings (e.g., `fov={45}` → `fov={"45deg"}`)
- Flags `Resolvable<>` function values with `// TODO: migrate to SceneLength` comments for manual review

**After running the codemod**, run `pnpm typecheck` to verify all files compile. Fix any remaining TypeScript errors (typically in `Resolvable<>` function bodies).

---

## Unit Reference

### Spatial Units (`SceneLength`)

| Unit | Syntax | Meaning | Use When |
|------|--------|---------|----------|
| **u** | `"15u"` | Scene unit — uniform, aspect-ratio-preserving | Sizes: `size`, `thickness`, `cornerRadius`, `gap`, `spacing` |
| **%** | `"50%"` | Percentage of parent/viewport per-axis | Positions: `x`, `y`, `w`, `h`, `position` |
| **vw** | `"15vw"` | Percentage of viewport width (both axes) | When you need width-relative on both axes |
| **vh** | `"15vh"` | Percentage of viewport height (both axes) | When you need height-relative on both axes |

**Zero** is legal without a unit: `0`, `"0%"`, `"0u"` are all equivalent.

**Key distinction**: `u` produces uniform (vmin-based) world-space values ONLY when applied to SIZE properties. For POSITION properties, `u` is equivalent to `%`.

### Angle Units (`SceneAngle`)

| Unit | Syntax | Resolution |
|------|--------|------------|
| **deg** | `"45deg"` | Converted to radians: `value × (π / 180)` |
| **rad** | `"0.78rad"` | Passthrough (already radians) |

### Compound Types

| Type | Shape | Example |
|------|-------|---------|
| `SceneSize2` | `[SceneLength, SceneLength]` | `["15u", "8u"]` |
| `ScenePosition3` | `[SceneLength, SceneLength, SceneLength]` | `["50%", "50%", "0%"]` |
| `ScenePadding` | CSS shorthand (1, 2, 3, or 4 values) | `"5u"`, `["5%", "4%"]`, `["3%", "4%", "5%", "4%"]` |

---

## Manual Migration Rules

### `Resolvable<>` Function Values

The codemod cannot automatically migrate function values inside `Resolvable<>` props. These require manual conversion:

**Before:**
```tsx
<DiagramNode
  id="dynamic"
  size={({ sceneIndex }) => sceneIndex === 0 ? [0.2, 0.12] : [0.15, 0.08]}
/>
```

**After:**
```tsx
<DiagramNode
  id="dynamic"
  size={({ sceneIndex }) => sceneIndex === 0 ? ["20u", "12u"] : ["15u", "8u"]}
/>
```

Functions that return spatial values must now return `SceneLength` strings. Functions that return angle values must return `SceneAngle` strings.

### Values That Stay `number`

These categories are **not migrated** — they remain bare numbers:

| Category | Examples |
|----------|---------|
| **World-space values** | Camera `position`, `target`, `distance`; Lighting positions; Floor `position`, `scale`, `negativeZExtent`; SpotlightRig `radius`, `height`, `center` |
| **Dimensionless values** | `opacity`, `metalness`, `roughness`, `intensity`, `scale` (multiplier), `iconScale`, `glowSpread`, `flowBundleStrength` |
| **Compiled/internal values** | All `*State` types, `NVSRect`, `DiagramEdgePathCommand` coords |
| **CSS values** | `entranceDistance`, `contentPadding` (CSS strings) |

**Rule of thumb**: If the value is a ratio (0–1), a multiplier, a world-space coordinate, or an internal computed value, it stays `number`.

---

## The `uniformSizing` Behavior

### What It Does

When you use `u` units for size props (e.g., `size={["15u", "8u"]}`), the compiled state includes a `uniformSizing: true` flag. This tells the render layer to use `vmin`-based scaling (the smaller of viewport width and height) for all size-like fields, producing **aspect-ratio-preserving** dimensions.

When you use `%` units for size props, `uniformSizing` is `false` and the existing per-axis behavior applies.

### How It Affects Rendering

| Unit | `uniformSizing` | Rendering |
|------|-----------------|-----------|
| `"15u"` | `true` | Both width and height scale by `min(viewportW, viewportH)` → always square on square values |
| `"15%"` | `false` | Width scales by viewport width, height by viewport height → stretches on non-square viewports |

### Mixed-Unit Tuples

**Mixed units in a single tuple are a compile error:**

```tsx
// ❌ Compile error — cannot mix u and % in one size tuple
size={["15u", "10%"]}

// ✅ Both components use the same unit family
size={["15u", "8u"]}
size={["15%", "8%"]}
```

### Theme Defaults

Theme default sizes now use `u` units (e.g., `["15u", "8u"]` for node size). When no size prop is provided, the theme's default unit determines the `uniformSizing` flag.

---

## Before/After Examples

### DiagramNode

```tsx
// Before
<DiagramNode id="api" label="API" size={[0.15, 0.08]} thickness={0.075} cornerRadius={0.01} />

// After
<DiagramNode id="api" label="API" size={["15u", "8u"]} thickness={"7.5u"} cornerRadius={"1u"} />
```

### DiagramNode (ManualLayout position)

```tsx
// Before
<DiagramNode id="api" label="API" position={[0.5, 0.3, 0]} size={[0.15, 0.08]} />

// After
<DiagramNode id="api" label="API" position={["50%", "30%", "0%"]} size={["15u", "8u"]} />
```

### DiagramEdge

```tsx
// Before
<DiagramEdge from="a" to="b" thickness={0.012} flowTurnRadius={0.03} />

// After
<DiagramEdge from="a" to="b" thickness={"1.2u"} flowTurnRadius={"3u"} />
```

### Diagram (viewport + tilt)

```tsx
// Before
<Diagram id="arch" x={0.05} y={0.05} w={0.9} h={0.9} tilt={-0.25} />

// After
<Diagram id="arch" x={"5%"} y={"5%"} w={"90%"} h={"90%"} tilt={"-0.25rad"} />
```

### GridLayout / HierarchicalLayout

```tsx
// Before
<GridLayout columns={3} spacing={[0.06, 0.06]} groupPadding={0.035} titleGap={0.025} />

// After
<GridLayout columns={3} spacing={["6u", "6u"]} groupPadding={"3.5u"} titleGap={"2.5u"} />
```

### FlowLayout

```tsx
// Before
<FlowLayout direction="top-down" gap={0.06} />

// After
<FlowLayout direction="top-down" gap={"6u"} />
```

### Chart

```tsx
// Before
<BarChart id="rev" x={0.1} y={0.1} w={0.8} h={0.8} rotation={[0, 0, 0]} />

// After
<BarChart id="rev" x={"10%"} y={"10%"} w={"80%"} h={"80%"} rotation={[0, 0, 0]} />
```

### Screen / ImagePanel / MediaScreen

```tsx
// Before
<ImagePanel id="screenshot" src="/img.png" x={0.5} y={0.5} width={0.6} rotation={[0, -0.25, 0]} />

// After
<ImagePanel id="screenshot" src="/img.png" x={"50%"} y={"50%"} width={"60%"} rotation={[0, "-0.25rad", 0]} />
```

### Model

```tsx
// Before
<Model type="Robot" id="robot" x={0.15} y={0} w={0.7} h={1} scale={0.06} rotation={[0, 0.5, 0]} />

// After
<Model type="Robot" id="robot" x={"15%"} y={"0%"} w={"70%"} h={"100%"} scale={0.06} rotation={[0, "0.5rad", 0]} />
```

Note: `scale` stays `number` (dimensionless multiplier). `z` stays `number` (world-space).

### Camera (orbit mode)

```tsx
// Before
<Camera mode="orbit" azimuth={0.3} polar={1.1} distance={7} fov={50} />

// After
<Camera mode="orbit" azimuth={"0.3rad"} polar={"63deg"} distance={7} fov={"50deg"} />
```

Note: `distance`, `position`, `target` stay `number`/`Vec3` (world-space).

### Camera (interaction polar limits)

```tsx
// Before
<Camera mode="orbit" ... interaction={{ enabled: true, minPolarAngle: 0, maxPolarAngle: Math.PI }} />

// After
<Camera mode="orbit" ... interaction={{ enabled: true, minPolarAngle: 0, maxPolarAngle: "180deg" }} />
```

### Floor (rotation)

```tsx
// Before
<Floor rotation={[-Math.PI / 2, 0, 0]} textureRotation={0.5} />

// After
<Floor rotation={["-90deg", 0, 0]} textureRotation={"0.5rad"} />
```

Note: `position`, `scale`, `negativeZExtent` stay `number` (world-space).

### View / ViewLayout

```tsx
// Before
<View id="panel" x={0.4} y={0} w={0.6} h={1} padding={[0.05, 0.04]} />
<ViewLayout kind="stack" direction="horizontal" gap={0.02} />

// After
<View id="panel" x={"40%"} y={"0%"} w={"60%"} h={"100%"} padding={["5%", "4%"]} />
<ViewLayout kind="stack" direction="horizontal" gap={"2%"} />
```

### Slides (SlideRegion)

```tsx
// Before — theme density values
createSlideTheme({ density: { titleHeight: 0.15, gutter: 0.04 } })

// After
createSlideTheme({ density: { titleHeight: "15%", gutter: "4%" } })
```

---

## Quick Decision Table

| "Should I add units to this prop?" | Answer |
|-------------------------------------|--------|
| It's `x`, `y`, `w`, `h` on a spatial element | **Yes** → `SceneLength` (`"%"` for positions) |
| It's `size`, `thickness`, `gap`, `spacing`, `padding` | **Yes** → `SceneLength` (`"u"` for sizes) |
| It's `azimuth`, `polar`, `fov`, `tilt`, `rotation`, `angle` | **Yes** → `SceneAngle` (`"deg"` or `"rad"`) |
| It's `position` on Camera/Lighting/Floor | **No** — world-space `Vec3` |
| It's `distance`, `near`, `far`, `scale` (multiplier) | **No** — world-space or dimensionless `number` |
| It's `opacity`, `metalness`, `roughness`, `intensity` | **No** — dimensionless `number` |
| It's inside a `*State` type (compiled state) | **No** — always `number` |
