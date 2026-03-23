---
title: "Website Implementation Plan — Technical PM Redesign"
doc_type: plan
owner: Toolkit Product
status: completed
updated: 2026-03-22
change_history:
  - date: 2026-03-22
    author: "Architect"
    summary: "Updated plan to use BrewSite's CSS-inspired unit system (SceneLength/SceneAngle). Added DSL prop interfaces for all widgets, NeonSign migration task, unit system convention section, effect preset type clarifications, CUSTOM_NODE_HANDLER resolution mappings, resolve function import paths, unit resolution test patterns, sequential phase execution constraint, and satisfies-over-as guidance. Incorporated PM review feedback."
  - date: 2026-03-21
    author: "Codex"
    summary: "Created a detailed implementation plan for the BrewSite website redesign based on the website PRDs and the brewsite-architect agent definition."
  - date: 2026-03-22
    author: "Toolkit PM"
    summary: "Marked completed and archived. All 5 phases implemented: content/structure/overlays, scene rewrites, advanced effects, PostFX/CSS, telemetry/testing/fallbacks. 139 tests passing, 14/14 packages typecheck clean. Architect verified 100% complete."
---

# Website Implementation Plan — Technical PM Redesign

## 1. Purpose

This plan translates the website strategy documents into an implementation-ready build plan for `apps/website/`.

Primary source documents:

- `requirements/website/prd/note_brand_strategy.md`
- `requirements/website/prd/prd_website_landing.md`
- `requirements/website/prd/prd_website_repositioning_technical-pm.md`

Architectural framing source:

- `.claude/agents/brewsite-architect.md`

This plan is intentionally explicit. The implementing bot should not need to invent architecture, scene structure, module boundaries, state types, styling direction, or validation strategy. The work should be executed directly from this document.

---

## 2. Outcome Definition

Deliver a new `apps/website` homepage that:

1. targets the technical PM as the primary audience
2. clearly positions BrewSite as a React storytelling system for decks, docs, sites, explainers, and demos
3. preserves the neon-sign hero mood while clarifying the category within the first screen
4. uses advanced Three.js features selectively and intentionally
5. remains mobile-first, readable, and resilient under reduced-motion and lower-performance conditions

The implementation must remain app-local unless a reusable abstraction is clearly justified. The redesign must not create accidental coupling back into published package architecture.

---

## 3. Scope

### 3.1 In scope

- `apps/website` layout, scenes, copy, styling, local widgets, local utilities, local assets
- website-local advanced effect widgets
- website-local perf/motion gating
- homepage telemetry hooks and tracking events
- website-specific fallback states and failure handling
- targeted tests for new local modules

### 3.2 Out of scope

- changes to published package APIs unless absolutely required
- new reusable framework abstractions in `packages/core` without a strong cross-app justification
- docs site redesign
- package landing subpages beyond the homepage
- CMS or server-backed content systems

---

## 4. Governing Architectural Rules

These rules are mandatory and come from the repo instructions plus the `brewsite-architect` definition.

### 4.1 App-local widget module pattern

Every new website widget must follow the same vertical slice pattern already used by `apps/website/src/widgets/neon-sign/`:

```text
types.ts
dsl.tsx
compile.ts
render.ts
{Name}Widget.ts
index.ts
```

Rules:

- `types.ts`: interface/state shapes only
- `dsl.tsx`: prop interfaces + null-returning DSL component only
- `compile.ts`: pure state defaults and transition spec only
- `render.ts`: Three.js implementation only
- `{Name}Widget.ts`: widget lifecycle and `CUSTOM_NODE_HANDLER` bridge only
- `index.ts`: re-export only

No new website-local widget may blur compile and render responsibilities.

**Unit system convention for DSL props vs compiled state:**

Every widget has two distinct type surfaces:

1. **DSL prop interfaces** (in `dsl.tsx`): Use `SceneLength` for spatial props (`x`, `y`, `w`, `h`, `size`, `spread`, `depth`, `thickness`, `gap`) and `SceneAngle` for angle props (`tilt`, `yRotation`, `azimuth`). Import from `@brewsite/core/units/types`.
2. **Compiled state types** (in `types.ts`): All fields remain `number`. The compile step resolves unit strings to NVS fractions (or radians for angles) using the core unit resolution utilities.

The `compile.ts` file in each widget is responsible for converting `SceneLength`/`SceneAngle` DSL values to `number` compiled state values. This is a pure transformation — no Three.js, no React.

Values that stay `number` in both DSL and state:
- World-space values: Camera `position`, `target`, `distance`; Lighting positions; `z` (depth)
- Dimensionless values: `opacity`, `intensity`, `scale`, `count`, `speed`, `targetBias`, `metalness`, `roughness`
- Enum/string fields: `flow`, `palette`, `kind`, `quality`

### 4.2 Dependency direction

- `apps/website` may consume `@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`, and `@brewsite/screens`
- no redesign work may require `@brewsite/core` to import website code
- local widgets stay local to `apps/website`
- common website scene helpers live under `apps/website/src/scenes/shared/`, not inside one-off scene files

### 4.3 State ownership

- scene state is owned by BrewSite's compile/runtime system
- UI state is owned locally in React only when not representable as scene state
- effect gating is owned centrally by `motionProfile` and `perfTier` utilities
- telemetry emission is owned by website-local helpers, not inline anonymous calls throughout scenes

### 4.4 Testability

All new pure modules must expose test seams that do not require WebGL.

Examples:

- messaging lookup functions
- site map metadata builders
- motion-profile resolution
- perf-tier resolution
- widget default-state and merge behavior
- compile state normalization helpers
- unit resolution from SceneLength/SceneAngle to number

### 4.5 Scene unit system convention

BrewSite uses a CSS-inspired unit system for DSL-authored spatial and angle values. This convention is mandatory for all new website widgets and scene DSL code.

**Spatial units (`SceneLength`):**

| Unit | Syntax | Meaning | Use When |
|------|--------|---------|----------|
| `u` | `"15u"` | Uniform, aspect-ratio-preserving (vmin-based for sizes) | Sizes: `size`, `thickness`, `gap`, `spacing`, `spread`, `depth` |
| `%` | `"50%"` | Percentage of parent/viewport per-axis | Positions: `x`, `y`, `w`, `h` |
| `vw` | `"15vw"` | Percentage of viewport width (both axes) | Width-relative on both axes |
| `vh` | `"15vh"` | Percentage of viewport height (both axes) | Height-relative on both axes |

**Angle units (`SceneAngle`):**

| Unit | Syntax | Resolution |
|------|--------|------------|
| `deg` | `"45deg"` | Converted to radians: `value × (π / 180)` |
| `rad` | `"0.78rad"` | Passthrough (already radians) |

**TypeScript types** (from `@brewsite/core/units/types`):
- `SceneLength` — `"15u"` | `"50%"` | `"10vw"` | `"20vh"` | `0`
- `SceneAngle` — `"45deg"` | `"0.78rad"` | `0`
- `SceneSize2` — `[SceneLength, SceneLength]`

**Zero** is legal without a unit: `0`, `"0%"`, `"0u"` are all equivalent.

**The critical rule:** DSL prop interfaces use `SceneLength`/`SceneAngle`. Compiled state types (`*State`) always use `number`. The `compile.ts` layer resolves units to numbers. The transition system and render layer never see unit strings.

**Quick decision table** for the implementing bot:

| Question | Answer |
|----------|--------|
| It's `x`, `y`, `w`, `h` on a spatial element DSL prop | `SceneLength` (`"%"` convention) |
| It's `size`, `thickness`, `gap`, `spread`, `depth` DSL prop | `SceneLength` (`"u"` convention) |
| It's `tilt`, `yRotation`, `azimuth`, `polar`, `fov` DSL prop | `SceneAngle` (`"deg"` or `"rad"`) |
| It's `z` (world-space depth) | `number` in both DSL and state |
| It's `opacity`, `intensity`, `count`, `speed`, `scale` | `number` in both DSL and state |
| It's any field in a `*State` type | Always `number` |

---

## 5. Deliverable Set

Implementation shall produce the following deliverables.

### 5.1 Core homepage experience

- revised hero messaging
- revised scene flow and navigation labels
- full content arc for technical PM positioning
- mobile-first overlay layout system

### 5.2 Advanced effect system

- HDR environment strategy
- signal/particle field widget
- shader surface widget
- post-processing widget
- centralized motion and performance gating

### 5.3 Operational quality

- telemetry hooks
- reduced-motion path
- failure fallbacks
- validation and tests

---

## 6. File Plan

### 6.1 Existing files to modify

- `apps/website/src/App.tsx`
- `apps/website/siteResources.ts`
- `apps/website/src/landing/LandingPage.tsx`
- `apps/website/src/landing/nav/NavMenu.tsx`
- `apps/website/src/landing/hero/hero.css`
- `apps/website/src/scenes/websiteFlow.tsx`
- `apps/website/src/scenes/act0/scene_00_hero.tsx`
- `apps/website/src/scenes/act1/scene_01_flat_world.tsx`
- `apps/website/src/scenes/act2/scene_02a_dimensional_shift.tsx`
- `apps/website/src/scenes/act2/scene_02b_beyond_diagrams.tsx`
- `apps/website/src/scenes/act3/scene_03a_the_code.tsx`
- `apps/website/src/scenes/act3/scene_03b_pipeline.tsx`
- `apps/website/src/scenes/act4/scene_04_ecosystem.tsx`
- `apps/website/src/scenes/act5/scene_05_cta.tsx`
- `apps/website/src/style.css`
- `apps/website/src/widgetSetup.ts`
- `apps/website/src/widgets/neon-sign/dsl.tsx` (migrate to SceneLength/SceneAngle)
- `apps/website/src/widgets/neon-sign/compile.ts` (add unit resolution)
- `apps/website/src/widgets/neon-sign/NeonSignWidget.ts` (update CUSTOM_NODE_HANDLER for unit resolution)

`apps/website/siteResources.ts` modification rule:

- update only if new website-local model, image, or texture assets require manifest generation support
- if no generated-asset dependency changes are introduced, leave this file untouched

### 6.2 New files to create

#### Content / metadata

- `apps/website/src/content/messaging.ts`
- `apps/website/src/content/siteMap.ts`
- `apps/website/src/content/effectPresets.ts`

#### Landing / UI

- `apps/website/src/landing/components/OverlayColumn.tsx`
- `apps/website/src/landing/components/OverlayHeadline.tsx`
- `apps/website/src/landing/components/ProofRail.tsx`
- `apps/website/src/landing/components/TrustStrip.tsx`
- `apps/website/src/landing/components/CommandCard.tsx`
- `apps/website/src/landing/components/SectionLabelRow.tsx`

#### Scene shared helpers

- `apps/website/src/scenes/shared/lighting.ts`
- `apps/website/src/scenes/shared/backgrounds.ts`
- `apps/website/src/scenes/shared/environments.ts`
- `apps/website/src/scenes/shared/overlays.tsx`
- `apps/website/src/scenes/shared/sceneTokens.ts` — if this file defines spatial constants used in DSL (e.g., standard diagram bounds, element positions), those constants must be valid `SceneLength` literals. Use `satisfies SceneLength` to get compile-time validation (e.g., `const DIAGRAM_X = "5%" satisfies SceneLength`). Do NOT use `as SceneLength` — it suppresses errors instead of validating them. Non-spatial tokens (colors, opacities, string labels) remain their current types.
- `apps/website/src/scenes/shared/viewBounds.ts` — if this file defines NVS bounding regions consumed by DSL elements, those values must be valid `SceneLength` literals validated with `satisfies`. Example: `{ x: "5%" satisfies SceneLength, y: "5%" satisfies SceneLength, w: "90%" satisfies SceneLength, h: "90%" satisfies SceneLength }`. If it only defines computed number values consumed by compile/render code, it stays `number`.

#### Motion / capability gating

- `apps/website/src/utils/motionProfile.ts`
- `apps/website/src/utils/perfTier.ts`
- `apps/website/src/utils/reducedMotion.ts`
- `apps/website/src/utils/deviceCapabilities.ts`

#### Telemetry

- `apps/website/src/telemetry/events.ts`
- `apps/website/src/telemetry/emit.ts`
- `apps/website/src/telemetry/useSectionTelemetry.ts`
- `apps/website/src/telemetry/useCommandCopyTelemetry.ts`

#### Website-local widgets

- `apps/website/src/widgets/signal-field/types.ts`
- `apps/website/src/widgets/signal-field/dsl.tsx`
- `apps/website/src/widgets/signal-field/compile.ts`
- `apps/website/src/widgets/signal-field/render.ts`
- `apps/website/src/widgets/signal-field/SignalFieldWidget.ts`
- `apps/website/src/widgets/signal-field/index.ts`

- `apps/website/src/widgets/shader-surface/types.ts`
- `apps/website/src/widgets/shader-surface/dsl.tsx`
- `apps/website/src/widgets/shader-surface/compile.ts`
- `apps/website/src/widgets/shader-surface/render.ts`
- `apps/website/src/widgets/shader-surface/ShaderSurfaceWidget.ts`
- `apps/website/src/widgets/shader-surface/index.ts`

- `apps/website/src/widgets/postfx/types.ts`
- `apps/website/src/widgets/postfx/dsl.tsx`
- `apps/website/src/widgets/postfx/compile.ts`
- `apps/website/src/widgets/postfx/render.ts`
- `apps/website/src/widgets/postfx/PostFxWidget.ts`
- `apps/website/src/widgets/postfx/index.ts`

#### Tests

- `apps/website/src/utils/__tests__/motionProfile.test.ts`
- `apps/website/src/utils/__tests__/perfTier.test.ts`
- `apps/website/src/widgets/neon-sign/__tests__/compile.test.ts` (new — unit resolution migration test)
- `apps/website/src/widgets/signal-field/__tests__/compile.test.ts`
- `apps/website/src/widgets/shader-surface/__tests__/compile.test.ts`
- `apps/website/src/widgets/postfx/__tests__/compile.test.ts`
- `apps/website/src/widgets/postfx/__tests__/PostFxWidget.test.ts`
- `apps/website/src/content/__tests__/messaging.test.ts`
- `apps/website/src/content/__tests__/siteMap.test.ts`

#### Public assets

- `apps/website/public/environments/hero-chamber.hdr`
- `apps/website/public/environments/warm-atrium.hdr`
- `apps/website/public/environments/systems-observatory.hdr`
- `apps/website/public/textures/noise/noise-soft.png`
- `apps/website/public/textures/noise/noise-fine.png`

---

## 7. Data and Type Design

### 7.1 Messaging model

Create `apps/website/src/content/messaging.ts`.

Required types:

```ts
export type SceneMessageKey =
  | 'hero'
  | 'recognition'
  | 'scope'
  | 'authoring'
  | 'team'
  | 'trust'
  | 'cta';

export type SceneMessage = {
  readonly eyebrow?: string;
  readonly headline: string;
  readonly support?: string;
  readonly punchline?: string;
  readonly proofRail?: readonly string[];
};
```

Rules:

- this file is the single source of truth for homepage copy
- scene files consume copy from here rather than hardcoding final strings inline
- one-off strings used only as node labels or diagram labels may remain in scene files

### 7.2 Site map / nav model

Create `apps/website/src/content/siteMap.ts`.

Required types:

```ts
export type WebsiteSectionId =
  | 'hero'
  | 'problem'
  | 'surfaces'
  | 'primitives'
  | 'authoring'
  | 'team'
  | 'trust'
  | 'cta';

export type WebsiteSectionMeta = {
  readonly id: WebsiteSectionId;
  readonly navNumber: string;
  readonly navLabel: string;
  readonly sceneId: string;
  readonly telemetryName: string;
};
```

Rules:

- `websiteFlow.tsx` and `NavMenu.tsx` derive their nav metadata from this source
- telemetry section names reuse these stable identifiers

### 7.3 Effect preset model

Create `apps/website/src/content/effectPresets.ts`.

Required types:

```ts
import type { SceneLength } from '@brewsite/core/units/types';

export type EffectPalette = 'hero' | 'violet' | 'warm' | 'aurora';

export type SignalFieldPreset = {
  readonly count: number;          // dimensionless
  readonly opacity: number;        // dimensionless [0..1]
  readonly size: SceneLength;      // spatial — particle visual size
  readonly speed: number;          // dimensionless multiplier
  readonly depth: SceneLength;     // spatial — Z-spread extent
  readonly spread: SceneLength;    // spatial — XY dispersion radius
  readonly flow: 'orbit' | 'stream' | 'assemble' | 'dissolve';
  readonly palette: EffectPalette;
  readonly targetBias: number;     // dimensionless [0..1]
};

export type PostFxPreset = {
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
  readonly vignetteStrength: number;
  readonly gradeMix: number;
};
```

Rules:

- presets are shared constants only
- scene files may override specific fields, but presets define the visual system defaults
- presets are consumed **at the DSL authoring surface** — they are spread into JSX component props, not consumed inside `compile.ts`

**Preset consumption pattern** (confirms `SceneLength` is correct for spatial fields):

```tsx
// In a scene file:
import { heroSignalPreset } from '../../content/effectPresets';

<SignalField
  {...heroSignalPreset}
  x={"10%"} y={"10%"} w={"80%"} h={"80%"}
/>
```

Since the preset fields flow directly into `SignalFieldProps`, the spatial fields (`size`, `depth`, `spread`) must be `SceneLength` to match the prop interface. The unit convention for these fields is `"u"` (e.g., `size: "2u"`, `depth: "5u"`, `spread: "15u"`).

### 7.4 Motion-profile model

Create `apps/website/src/utils/motionProfile.ts`.

Required types:

```ts
export type MotionProfile = {
  readonly reducedMotion: boolean;
  readonly allowParticles: boolean;
  readonly allowPostFx: boolean;
  readonly allowHeavyShaderDistortion: boolean;
  readonly environmentQuality: 'high' | 'medium' | 'low';
};
```

Required exported API:

```ts
export function resolveMotionProfile(input: {
  readonly reducedMotion: boolean;
  readonly perfTier: PerfTier;
  readonly isMobile: boolean;
}): MotionProfile;
```

### 7.5 Perf-tier model

Create `apps/website/src/utils/perfTier.ts`.

Required types:

```ts
export type PerfTier = 'high' | 'medium' | 'low';
```

Required exported API:

```ts
export function resolvePerfTier(input: {
  readonly hardwareConcurrency?: number;
  readonly deviceMemory?: number;
  readonly isMobile: boolean;
}): PerfTier;
```

These heuristics must be deterministic and unit-testable. No scene file should contain ad hoc capability logic.

### 7.6 Widget state types and DSL prop interfaces

Each widget defines **two** type surfaces:
1. **`*State` in `types.ts`** — compiled state, all spatial/angle fields are `number`. Used by transition specs and render layer.
2. **`*Props` in `dsl.tsx`** — DSL authoring surface, spatial fields use `SceneLength`, angle fields use `SceneAngle`. Used by scene authors.

The `compile.ts` layer resolves `SceneLength`/`SceneAngle` to `number` using `@brewsite/core` unit resolution utilities.

### Signal field

**Compiled state** (`types.ts`):

```ts
// Compiled state — all numbers. No unit strings.
export type SignalFieldState = {
  readonly enabled: boolean;
  readonly x: number;       // NVS fraction
  readonly y: number;       // NVS fraction
  readonly w: number;       // NVS fraction
  readonly h: number;       // NVS fraction
  readonly z: number;       // world-space depth
  readonly count: number;   // dimensionless
  readonly opacity: number; // dimensionless [0..1]
  readonly size: number;    // resolved spatial size
  readonly speed: number;   // dimensionless multiplier
  readonly depth: number;   // resolved spatial extent
  readonly spread: number;  // resolved spatial radius
  readonly flow: 'orbit' | 'stream' | 'assemble' | 'dissolve';
  readonly palette: 'hero' | 'violet' | 'warm' | 'aurora';
  readonly targetBias: number; // dimensionless [0..1]
};
```

**DSL props** (`dsl.tsx`):

```ts
import type { SceneLength } from '@brewsite/core/units/types';

export type SignalFieldProps = {
  enabled?: boolean;
  x?: SceneLength;          // NVS position — use "%"
  y?: SceneLength;          // NVS position — use "%"
  w?: SceneLength;          // NVS extent — use "%"
  h?: SceneLength;          // NVS extent — use "%"
  z?: number;               // world-space depth — stays number
  count?: number;           // dimensionless
  opacity?: number;         // dimensionless [0..1]
  size?: SceneLength;       // particle visual size — use "u"
  speed?: number;           // dimensionless multiplier
  depth?: SceneLength;      // Z-spread extent — use "u"
  spread?: SceneLength;     // XY dispersion radius — use "u"
  flow?: 'orbit' | 'stream' | 'assemble' | 'dissolve';
  palette?: 'hero' | 'violet' | 'warm' | 'aurora';
  targetBias?: number;      // dimensionless [0..1]
  children?: React.ReactNode;
};

export const SignalField = (_props: SignalFieldProps) => null;
```

**DSL usage example:**

```tsx
<SignalField
  x={"10%"} y={"10%"} w={"80%"} h={"80%"} z={0}
  count={200} opacity={0.6} size={"2u"} speed={0.8}
  depth={"5u"} spread={"15u"} flow="orbit" palette="hero"
/>
```

**CUSTOM_NODE_HANDLER unit resolution mapping** — the handler in `SignalFieldWidget.ts` must resolve `SceneLength` props to `number` after `helpers.resolveObjectValues()`:

```ts
import { resolveToNVS } from '@brewsite/core/units/resolve';

// Inside CUSTOM_NODE_HANDLER:
const next: SignalFieldState = {
  ...base,
  enabled: props.enabled ?? base.enabled,
  x: props.x != null ? resolveToNVS(props.x) : base.x,
  y: props.y != null ? resolveToNVS(props.y) : base.y,
  w: props.w != null ? resolveToNVS(props.w) : base.w,
  h: props.h != null ? resolveToNVS(props.h) : base.h,
  z: props.z ?? base.z,                                      // world-space, stays number
  count: props.count ?? base.count,                           // dimensionless
  opacity: props.opacity ?? base.opacity,                     // dimensionless
  size: props.size != null ? resolveToNVS(props.size) : base.size,
  speed: props.speed ?? base.speed,                           // dimensionless
  depth: props.depth != null ? resolveToNVS(props.depth) : base.depth,
  spread: props.spread != null ? resolveToNVS(props.spread) : base.spread,
  flow: props.flow ?? base.flow,
  palette: props.palette ?? base.palette,
  targetBias: props.targetBias ?? base.targetBias,            // dimensionless
};
```

**Note:** `helpers.resolveObjectValues()` resolves `Resolvable<SceneLength>` function props first (evaluating them with the scene context). After resolution, `SceneLength` props are string values ready for `resolveToNVS()` conversion.

### Shader surface

**Compiled state** (`types.ts`):

```ts
// Compiled state — all numbers. No unit strings.
export type ShaderSurfaceState = {
  readonly enabled: boolean;
  readonly kind: 'plane' | 'ribbon' | 'shell';
  readonly x: number;          // NVS fraction
  readonly y: number;          // NVS fraction
  readonly w: number;          // NVS fraction
  readonly h: number;          // NVS fraction
  readonly z: number;          // world-space depth
  readonly opacity: number;    // dimensionless [0..1]
  readonly palette: 'hero' | 'violet' | 'warm' | 'aurora';
  readonly edgeGlow: number;   // dimensionless
  readonly distortion: number; // dimensionless
  readonly scanStrength: number; // dimensionless
  readonly reveal: number;     // dimensionless [0..1]
};
```

**DSL props** (`dsl.tsx`):

```ts
import type { SceneLength } from '@brewsite/core/units/types';

export type ShaderSurfaceProps = {
  enabled?: boolean;
  kind?: 'plane' | 'ribbon' | 'shell';
  x?: SceneLength;          // NVS position — use "%"
  y?: SceneLength;          // NVS position — use "%"
  w?: SceneLength;          // NVS extent — use "%"
  h?: SceneLength;          // NVS extent — use "%"
  z?: number;               // world-space depth — stays number
  opacity?: number;         // dimensionless [0..1]
  palette?: 'hero' | 'violet' | 'warm' | 'aurora';
  edgeGlow?: number;        // dimensionless
  distortion?: number;      // dimensionless
  scanStrength?: number;    // dimensionless
  reveal?: number;          // dimensionless [0..1]
  children?: React.ReactNode;
};

export const ShaderSurface = (_props: ShaderSurfaceProps) => null;
```

**DSL usage example:**

```tsx
<ShaderSurface
  kind="plane" x={"20%"} y={"30%"} w={"60%"} h={"40%"} z={0.5}
  opacity={0.4} palette="hero" edgeGlow={0.3} distortion={0.2}
/>
```

**CUSTOM_NODE_HANDLER unit resolution mapping** — ShaderSurface only has 4 SceneLength fields (`x`, `y`, `w`, `h`). All other fields are dimensionless `number`:

```ts
import { resolveToNVS } from '@brewsite/core/units/resolve';

// Inside CUSTOM_NODE_HANDLER:
const next: ShaderSurfaceState = {
  ...base,
  enabled: props.enabled ?? base.enabled,
  kind: props.kind ?? base.kind,
  x: props.x != null ? resolveToNVS(props.x) : base.x,
  y: props.y != null ? resolveToNVS(props.y) : base.y,
  w: props.w != null ? resolveToNVS(props.w) : base.w,
  h: props.h != null ? resolveToNVS(props.h) : base.h,
  z: props.z ?? base.z,                                      // world-space, stays number
  opacity: props.opacity ?? base.opacity,
  palette: props.palette ?? base.palette,
  edgeGlow: props.edgeGlow ?? base.edgeGlow,
  distortion: props.distortion ?? base.distortion,
  scanStrength: props.scanStrength ?? base.scanStrength,
  reveal: props.reveal ?? base.reveal,
};
```

### PostFX

**Compiled state** (`types.ts`):

```ts
// Compiled state — all numbers. No unit strings.
export type PostFxState = {
  readonly enabled: boolean;
  readonly bloomStrength: number;    // dimensionless
  readonly bloomRadius: number;      // dimensionless
  readonly bloomThreshold: number;   // dimensionless
  readonly vignetteStrength: number; // dimensionless
  readonly gradeMix: number;         // dimensionless
  readonly quality: 'high' | 'medium' | 'off';
};
```

**DSL props** (`dsl.tsx`):

```ts
// PostFX has NO spatial or angle props — all fields are dimensionless.
// No SceneLength/SceneAngle imports needed.
export type PostFxProps = {
  enabled?: boolean;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  vignetteStrength?: number;
  gradeMix?: number;
  quality?: 'high' | 'medium' | 'off';
  children?: React.ReactNode;
};

export const PostFx = (_props: PostFxProps) => null;
```

**Note:** PostFX has no spatial or angle props. All fields are dimensionless scalars. No unit system migration is needed for this widget's DSL surface.

All compiled state types must live in `types.ts` and remain free of Three.js imports. All DSL prop interfaces must live in `dsl.tsx` and import `SceneLength`/`SceneAngle` from `@brewsite/core/units/types` when spatial or angle props are present.

### 7.7 NeonSign widget migration to unit system

The existing NeonSign widget at `apps/website/src/widgets/neon-sign/` predates the unit system and uses bare `number` for all spatial and angle DSL props. It must be migrated as part of this plan.

**Current state** (unmigrated):
- `types.ts`: `NeonSignState` — all `number`. **This stays as-is.** Compiled state never changes.
- `dsl.tsx`: `NeonSignProps` — bare `number` for `x`, `y`, `w`, `h`, `tilt`, `yRotation`. **Must migrate.**
- `compile.ts`: `DEFAULT_NEON_SIGN_STATE` uses bare numbers (e.g. `x: 0.5`). **Default state stays `number`.** But the compile step must add unit resolution.

**Migration tasks:**

1. **`dsl.tsx`** — Update `NeonSignProps`:

```ts
import type { SceneLength, SceneAngle } from '@brewsite/core/units/types';

export type NeonSignProps = {
  enabled?: boolean;
  text?: string;
  fontUrl?: string;
  color?: string;
  emissiveColor?: string;
  intensity?: number;       // dimensionless
  opacity?: number;         // dimensionless [0..1]
  x?: SceneLength;          // NVS position — use "%"
  y?: SceneLength;          // NVS position — use "%"
  w?: SceneLength;          // NVS extent — use "%"
  h?: SceneLength;          // NVS extent — use "%"
  z?: number;               // world-space depth — stays number
  tilt?: SceneAngle;        // X-axis rotation — use "deg" or "rad"
  yRotation?: SceneAngle;   // Y-axis rotation — use "deg" or "rad"
  children?: ReactNode;
};
```

2. **`compile.ts`** — The `DEFAULT_NEON_SIGN_STATE` stays `number` (it's the compiled default). The `neonSignTransitionSpec` requires **no changes** because it operates on compiled `NeonSignState` (all `number`). The `blendNumber()` calls in `interpolateFn` are unaffected — they blend between compiled number values, which is exactly how they worked before.

3. **`NeonSignWidget.ts`** — Update the `CUSTOM_NODE_HANDLER` to use unit resolution utilities to convert DSL prop values.

   **Import path for resolution functions:**
   ```ts
   import { resolveToNVS, resolveAngle } from '@brewsite/core/units/resolve';
   ```

   **Resolution mapping** — after `helpers.resolveObjectValues()` resolves any `Resolvable<>` function values, the resulting props are `SceneLength`/`SceneAngle` strings (or `undefined`). Apply resolution before writing to compiled state:

   ```ts
   const next: NeonSignState = {
     ...base,
     enabled: props.enabled ?? base.enabled,
     text: props.text ?? base.text,
     fontUrl: props.fontUrl ?? base.fontUrl,
     color: props.color ?? base.color,
     emissiveColor: props.emissiveColor ?? base.emissiveColor,
     intensity: props.intensity ?? base.intensity,
     opacity: props.opacity ?? base.opacity,
     x: props.x != null ? resolveToNVS(props.x) : base.x,
     y: props.y != null ? resolveToNVS(props.y) : base.y,
     w: props.w != null ? resolveToNVS(props.w) : base.w,
     h: props.h != null ? resolveToNVS(props.h) : base.h,
     z: props.z ?? base.z,                                    // world-space, stays number
     tilt: props.tilt != null ? resolveAngle(props.tilt) : base.tilt,
     yRotation: props.yRotation != null ? resolveAngle(props.yRotation) : base.yRotation,
   };
   ```

   **`Resolvable<SceneLength>` handling:** `helpers.resolveObjectValues()` resolves any `Resolvable<>` function props first (evaluating them with the scene context). After resolution, all `SceneLength`/`SceneAngle` props are string values (e.g., `"50%"`, `"-0.15rad"`), which then need `resolveToNVS()` / `resolveAngle()` conversion to `number`. The resolution order is: `Resolvable<SceneLength>` → evaluate function → `SceneLength` string → `resolveToNVS()` → `number`.

4. **`types.ts`** — No changes. `NeonSignState` remains all `number`.

5. **Scene files** — Exactly two files use `<NeonSign>` and must be updated:

   - `apps/website/src/scenes/act0/scene_00_hero.tsx`
   - `apps/website/src/scenes/act5/scene_05_cta.tsx`

   Before/after pattern:

   ```tsx
   // Before (bare numbers):
   <NeonSign x={0.5} y={0.5} w={0.6} h={0.3} tilt={-0.15} yRotation={0} />

   // After (unit strings):
   <NeonSign x={"50%"} y={"50%"} w={"60%"} h={"30%"} tilt={"-0.15rad"} yRotation={0} />
   ```

   Note: `yRotation={0}` stays as bare `0` — zero is valid without a unit for both `SceneLength` and `SceneAngle`.

6. **Test** — Create `apps/website/src/widgets/neon-sign/__tests__/compile.test.ts` to verify unit resolution:
   - Input `SceneLength` prop values → output correct NVS fractions in compiled state
   - Input `SceneAngle` prop values → output correct radian values in compiled state
   - Input `undefined` props → fallback to default state values

**Phase placement:** This migration belongs in Phase 2 (Scene rewrite), since scenes are being rewritten anyway and the DSL type changes must be in place before scenes can typecheck.

---

## 8. Homepage Messaging Implementation

### 8.1 Final homepage message hierarchy

The site shall use this messaging hierarchy.

### Hero

- Eyebrow: `React toolkit for technical storytelling`
- Headline: `Turn product thinking into decks, docs, sites, and demos.`
- Support: `Author diagrams, models, charts, screens, and slides in JSX. Compile once. Play smoothly.`

### Recognition

- Headline: `You rebuild the same story too many times.`
- Support: `Deck for the review. Doc for engineering. Site for launch. Screenshot for everyone else.`
- Punchline: `Same product. Flattened five ways.`

### Scope / surfaces

- Headline: `One story. Many surfaces.`
- Support: `Ship the launch site. Present the deck. Publish the explainer. Keep the system thinking intact.`

### Authoring

- Headline: `Write scenes in JSX.`
- Support: `BrewSite compiles snapshots into a baked runtime track so the browser plays the story instead of inventing it on the fly.`

### Team

- Headline: `PM frames it. Dev ships it. Marketing reuses it.`
- Support: `BrewSite is strongest when one story needs to survive across product, engineering, launch, and presentation surfaces.`

### Trust

- Headline: `Built like software, not a one-off demo.`
- Support: `TypeScript. React. Published packages. Starter CLI. AI-assisted docs search.`

### CTA

- Primary command: `npm create brewsite`
- Secondary action: `View on GitHub`

### 8.2 Copy implementation rules

1. Section copy shall be driven from `messaging.ts`.
2. Scene punchlines may remain short and cinematic.
3. Longer explanatory strings belong only in recognition, authoring, and trust acts.
4. No section may introduce new strategic terminology absent from the PRDs.
5. The site shall never imply BrewSite is slides-only.

---

## 9. UI Layout Implementation

### 9.1 Overlay column system

Create reusable overlay primitives rather than repeating anonymous `div` trees inside each scene.

### `OverlayColumn.tsx`

Responsibility:

- render the centered mobile-first content column used by scene overlays

Props:

```ts
type OverlayColumnProps = {
  readonly align?: 'center' | 'left';
  readonly vertical?: 'center' | 'bottom' | 'top';
  readonly tone?: 'cool' | 'warm';
  readonly children: React.ReactNode;
};
```

Behavior:

- width constrained with responsive max-width
- content centered on mobile
- left-aligned text allowed in authoring / trust acts
- pointer events enabled only where required

### `OverlayHeadline.tsx`

Responsibility:

- render a consistent eyebrow/headline/support cluster

Props:

```ts
type OverlayHeadlineProps = {
  readonly eyebrow?: string;
  readonly headline: string;
  readonly support?: string;
  readonly tone?: 'cool' | 'warm';
};
```

### `ProofRail.tsx`

Responsibility:

- render proof chips or short labels such as `Diagrams`, `Slides`, `Docs`

### `TrustStrip.tsx`

Responsibility:

- render technical trust facts in a compact row

### `CommandCard.tsx`

Responsibility:

- render the CTA command block
- own copy-to-clipboard behavior
- emit command-copy telemetry

### 9.2 Layout rules

- all major scene overlays use the same centered-column geometry
- hero is the only act allowed to break the standard overlay pattern
- bottom-aligned acts should still use the centered column, not arbitrary right/left placement
- desktop side gutters should expose scene atmosphere, not hold primary content

### 9.3 CSS implementation direction

Modify `apps/website/src/style.css` to add:

- site-wide tokens for:
  - cool / warm text
  - surface glass fills
  - border alpha variants
  - glow intensity variants
  - column widths
  - spacing scale
- section overlay primitives:
  - `.scene-shell`
  - `.scene-shell--bottom`
  - `.overlay-column`
  - `.overlay-column--left`
  - `.overlay-column--warm`
  - `.proof-rail`
  - `.trust-strip`
  - `.command-card`
- reduced-motion modifiers:
  - `.bw-reduced-motion`

Modify `apps/website/src/landing/hero/hero.css` to:

- preserve the neon-sign and bezel vibe
- update hero typography to match final category-first copy
- support the proof rail under the support line
- improve badge wrapping and statement spacing on phone widths

No inline style blocks should hold final design values unless the value is inherently scene-specific and not reusable.

---

## 10. Scene Architecture

### 10.1 Scene flow definition

Update `apps/website/src/scenes/websiteFlow.tsx`.

New section model:

```ts
hero
problem
surfaces
primitives
authoring
team
trust
cta
```

Implementation note:

- the actual scene file count may remain eight, but the naming and nav labels must match the new information architecture
- if the existing scene filenames remain, nav labels and scene copy must still reflect the new structure

### 10.2 Scene-by-scene plan

### Scene 00 — Hero / Signal Chamber

File:

- `apps/website/src/scenes/act0/scene_00_hero.tsx`

Objectives:

- keep the neon sign
- introduce the category-first hero copy
- establish the immersive chamber world
- add restrained atmospheric depth

Implementation:

- retain `NeonSign`
- add `ShaderSurface` support planes or shell surfaces behind/in front of the sign
- optionally add a low-density `SignalField`
- use the hero HDR environment
- keep floor mirror subtle

Overlay:

- hero message from `messaging.ts`
- proof rail beneath support line
- package badges may remain but should not compete with the primary message

### Scene 01 — Problem / Flattened world

File:

- `apps/website/src/scenes/act1/scene_01_flat_world.tsx`

Objectives:

- make the PM pain legible
- deliberately lower the environmental richness

Implementation:

- maintain a flat diagram
- disable expensive or cinematic effects here
- use simpler lighting and little/no particles

Overlay:

- recognition copy

### Scene 02 — Surfaces / One story many surfaces

Files:

- `apps/website/src/scenes/act2/scene_02a_dimensional_shift.tsx`
- `apps/website/src/scenes/act2/scene_02b_beyond_diagrams.tsx`

Objectives:

- Scene 02a: dramatize flat -> spatial transformation
- Scene 02b: broaden beyond diagrams into surfaces and outputs

Implementation:

- Scene 02a uses the strongest transition effects:
  - particles
  - shader ribbons
  - richer floor / environment
- Scene 02b must explicitly visualize multiple outputs:
  - slides
  - docs
  - site/screen
  - charts / diagrams

Important correction:

- `scene_02b_beyond_diagrams.tsx` must not read like package inventory only
- it should read like "content surfaces from one story"

### Scene 03 — Authoring / JSX and pipeline

Files:

- `apps/website/src/scenes/act3/scene_03a_the_code.tsx`
- `apps/website/src/scenes/act3/scene_03b_pipeline.tsx`

Objectives:

- demystify
- make the authoring model easy to repeat verbally

Implementation:

- code block cleaned up and made more realistic
- pipeline visual retained but should support the authoring story instead of merely diagramming the engine
- postfx should be cleaner here than in the transformation acts

### Scene 04 — Team + Trust / Ecosystem

File:

- `apps/website/src/scenes/act4/scene_04_ecosystem.tsx`

Objectives:

- combine team framing and ecosystem trust without turning into a package dump

Implementation:

- show `core` as the hub
- outer ring covers real packages
- overlay copy adds the team and trust meaning

Overlay:

- team headline
- trust support line
- technical trust strip

### Scene 05 — CTA

File:

- `apps/website/src/scenes/act5/scene_05_cta.tsx`

Objectives:

- return to the hero vibe with warmer resolution
- make `npm create brewsite` the dominant action

Implementation:

- keep neon bookend
- reduce visual noise versus the transformation acts
- `CommandCard` owns copy behavior and telemetry

---

## 11. Advanced Three.js Implementation

### 11.1 HDR environments

Implementation:

- environment files live in `apps/website/public/environments/`
- create `scenes/shared/environments.ts` with environment descriptors

Required API:

```ts
export type WebsiteEnvironmentKey =
  | 'heroChamber'
  | 'warmAtrium'
  | 'systemsObservatory';

export type WebsiteEnvironmentSpec = {
  readonly key: WebsiteEnvironmentKey;
  readonly url: string;
  readonly fallbackColor: string;
};
```

Rules:

- adjacent scenes should reuse environments where possible
- fallback colors must exist for every environment
- missing environment assets must not break scene render

### 11.2 Signal field widget

Directory:

- `apps/website/src/widgets/signal-field/`

Purpose:

- directed narrative particle motion only

Renderer guidance:

- `THREE.BufferGeometry`
- `THREE.Points`
- one material path initially
- no multiple particle systems in v1

Compile guidance:

- default state in `compile.ts`
- functional transition spec preferred if it keeps transitions simple

Render guidance:

- internal typed arrays for positions, seeds, and per-point phase
- motion driven by wall clock plus authored state
- maintain one root `THREE.Points` object

### 11.3 Shader surface widget

Directory:

- `apps/website/src/widgets/shader-surface/`

Purpose:

- signature surface language for glass, ribbons, and reveal planes

Renderer guidance:

- `THREE.ShaderMaterial`
- small set of uniforms:
  - time
  - opacity
  - reveal
  - distortion
  - palette colors

Geometry guidance:

- plane geometry for most cases
- ribbon or shell variants only where visually justified

### 11.4 PostFX widget

Directory:

- `apps/website/src/widgets/postfx/`

Purpose:

- website-local post-processing only

Interfaces:

- `IRendererLifecycle`
- `IExtraRenderPass`

Behavior:

- create composer on renderer init
- rebuild size on viewport change
- no-op safely when disabled
- dispose every composer/pass/material on teardown

Important:

- because `IExtraRenderPass` is intentionally reserved in core for future use, the implementation should stay local to the website and not force new SDK work

### 11.5 Feature gating

All advanced effects must be gated by:

- reduced motion
- perf tier
- scene importance

Policy matrix:

### High

- HDR on
- particles on
- shader distortion on
- restrained bloom on

### Medium

- HDR on or simplified
- particles reduced
- shader distortion reduced
- bloom minimal

### Low

- no particles
- shader surfaces mostly static
- postfx off
- environment simplified

### Reduced motion

- particles off unless used as a near-static field
- no pulsing bloom
- minimal time-based distortion
- transitions rely on crossfades / spatial state changes instead of constant ambient motion

---

## 12. Widget Registration and DSL Integration

Modify `apps/website/src/widgetSetup.ts`.

Required final shape:

```ts
return [
  corePlugin(),
  modelPlugin({ manifestUrl }),
  diagramPlugin(),
  {
    createWidgets: () => [
      new NeonSignWidget(),
      new SignalFieldWidget(),
      new ShaderSurfaceWidget(),
      new PostFxWidget(),
    ],
    registerHandlers: () => {},
  },
];
```

Implementation rule:

- all website-local widgets must be registered in one place
- do not spread widget registration across multiple modules

DSL rule:

- local widget DSL components should be imported only in scene files or scene shared helpers
- scene files must remain readable; move large effect prop bundles into presets/helpers

---

## 13. Error Handling and Fallbacks

### 13.1 WebGL / engine failure

`LandingPage.tsx` must continue to surface:

- engine load error state
- loading state

New requirements:

- render a readable HTML fallback shell when the engine errors hard
- keep primary CTA visible in fallback mode

### 13.2 Asset failure

Failure classes:

- HDR asset missing
- font asset missing
- noise texture missing
- postfx init failure

Handling policy:

- log once
- disable the failing local feature
- continue rendering the scene

### 13.3 Reduced-motion fallback

The page must:

- detect reduced motion centrally
- add a body/root class for CSS adjustments
- reduce or disable non-essential effect widgets
- preserve message order and readability

---

## 14. Telemetry Plan

Create `apps/website/src/telemetry/events.ts`.

Required event names:

```ts
type WebsiteTelemetryEvent =
  | 'section_view'
  | 'nav_open'
  | 'nav_select'
  | 'cta_copy_command'
  | 'cta_github_click'
  | 'reduced_motion_detected'
  | 'webgl_error';
```

Required payload shapes:

```ts
type SectionViewPayload = {
  readonly sectionId: string;
  readonly sceneId: string;
};

type NavSelectPayload = {
  readonly sectionId: string;
  readonly sceneId: string;
};

type CommandCopyPayload = {
  readonly command: string;
};
```

Implementation guidance:

- `emit.ts` should be a thin abstraction so analytics vendor choice stays swappable
- if no analytics backend exists yet, default to a structured `console.info` shim behind a feature flag

Telemetry hooks:

- `useSectionTelemetry.ts`: emit when current scene changes
- `useCommandCopyTelemetry.ts`: emit on command-copy success

---

## 15. Testing Strategy

### 15.1 Automated tests

Run at minimum:

- pure utility tests
- pure compile/default-state tests for each new widget
- **unit resolution tests for every widget with `SceneLength`/`SceneAngle` DSL props** (NeonSign, SignalField, ShaderSurface)
- lifecycle/fallback test for `PostFxWidget`
- messaging/site map integrity tests

Test rules:

- no WebGL-dependent snapshot tests for shader visuals
- test contracts, not internals
- prefer deterministic state assertions

**Unit resolution test pattern** — every `compile.test.ts` for a widget with `SceneLength`/`SceneAngle` props must verify:

1. **SceneLength → NVS fraction:** Given `x={"50%"}`, assert compiled state `x === 0.5`. Given `size={"15u"}`, assert compiled state `size === 0.15`.
2. **SceneAngle → radians:** Given `tilt={"90deg"}`, assert compiled state `tilt === Math.PI / 2`. Given `tilt={"0.5rad"}`, assert compiled state `tilt === 0.5`.
3. **Zero passthrough:** Given `x={0}`, assert compiled state `x === 0`.
4. **Undefined fallback:** Given `x` not provided, assert compiled state falls back to `defaultState.x`.

These are pure function tests — real inputs, real outputs, no mocks.

### 15.2 Manual QA matrix

Manual test surfaces:

- iPhone-width viewport
- tablet-width viewport
- desktop

Manual checks:

1. hero readability
2. nav open/close behavior
3. scene progression and copy sequencing
4. reduced-motion behavior
5. CTA copy and GitHub action
6. low-tier behavior with heavy effects disabled
7. engine error fallback

### 15.3 Lighthouse / browser review

The redesign must be reviewed with:

- Lighthouse Performance
- Lighthouse Accessibility
- Lighthouse Best Practices

Browser verification:

- Safari mobile
- Chrome mobile
- Chrome desktop

---

## 16. Validation Commands

Use these commands during implementation and before final verification:

```bash
pnpm --filter @brewsite/apps gen:scene-dsl:website
pnpm --filter @brewsite/apps typecheck
pnpm --filter @brewsite/apps test
pnpm --filter @brewsite/apps dev
pnpm --filter @brewsite/apps build
pnpm typecheck
pnpm test
```

If a narrower command is needed for website-local tests, use the app-level scripts first. Add new scripts only if the existing `@brewsite/apps` commands are insufficient.

Developer workflow notes:

- use `rg` / `rg --files` for file discovery
- do not use git operations as part of execution
- do not move archived requirements files

---

## 17. Execution Phases

**Phases 2–5 must execute strictly sequentially. No parallel execution across phases.** Phase 2 rewrites all scene files. Phase 3 adds new widget DSL into the same scene files. If phases overlap, the same files will be modified concurrently, causing merge conflicts. Phase 1 may run independently since it creates new files that don't conflict.

### Phase 1 — Content and structure

Deliver:

- `messaging.ts`
- `siteMap.ts`
- nav label rewrite
- hero copy rewrite
- overlay component system

Exit criteria:

- homepage message sequence is correct without advanced effects

### Phase 2 — Scene rewrite

Deliver:

- all scenes updated to match the new information architecture
- trust/team/ecosystem story corrected
- CTA unified
- NeonSign widget migrated to unit system (dsl.tsx → SceneLength/SceneAngle, compile.ts → unit resolution)
- all scene DSL code uses unit string syntax (`"%"` for positions, `"u"` for sizes, `"deg"`/`"rad"` for angles)

Exit criteria:

- the narrative reads correctly across all eight scenes
- all DSL props use the unit system — no bare numbers for spatial/angle values (except `z` and dimensionless fields)

### Phase 3 — Advanced effects foundation

Deliver:

- environments
- perf tier
- motion profile
- signal-field widget (DSL props use SceneLength per section 7.6; compiled state stays number)
- shader-surface widget (DSL props use SceneLength per section 7.6; compiled state stays number)

Exit criteria:

- hero and transformation acts gain controlled visual depth without harming readability
- new widget DSL props use SceneLength/SceneAngle where specified in section 7.6

### Phase 4 — PostFX and polish

Deliver:

- PostFxWidget
- restrained bloom/vignette/color grade
- final CSS and mobile tuning

Exit criteria:

- postfx improves mood without becoming required for comprehension

### Phase 5 — Telemetry, testing, fallback hardening

Deliver:

- telemetry helpers
- tests
- error paths
- reduced-motion verification

Exit criteria:

- site is shippable and operationally legible

---

## 18. Completion Criteria

This plan is complete only when implementation satisfies all of the following:

1. the homepage clearly states what BrewSite is for within the hero and next section
2. slides are explicit but not the category umbrella
3. technical PM language is visible throughout the story
4. advanced effects exist but remain subordinate to message clarity
5. app-local widget modules are cleanly separated and testable
6. reduced-motion and lower-performance paths are real, not aspirational
7. telemetry and validation are present

---

## 19. Implementation Instructions For The Coding Bot

The coding bot shall follow these constraints while implementing:

- design code to be modular and testable
- keep coupling minimal
- create clear seams for unit tests
- do not leave module boundaries, data types, CSS direction, state ownership, telemetry, or error handling to follow-up design
- prefer app-local abstractions over changing published packages unless reuse is obvious and defensible
- preserve the current dirty working tree and build on top of it carefully
- **unit system is mandatory**: all DSL prop interfaces for spatial values must use `SceneLength` (from `@brewsite/core/units/types`), all DSL prop interfaces for angle values must use `SceneAngle`. Compiled state types (`*State`) stay `number`. The compile step resolves units. See section 4.5 for the full convention.
- **no bare numbers for spatial/angle DSL props**: scene DSL code must use unit strings (`"50%"`, `"15u"`, `"45deg"`, `"0.78rad"`). Bare `number` is only valid for world-space depth (`z`), dimensionless values (`opacity`, `intensity`, `count`, `speed`, `scale`, `targetBias`), and enum/string fields.
- **type import path**: `SceneLength`, `SceneAngle`, `SceneSize2` are imported from `@brewsite/core/units/types`
- **resolution function import path**: `resolveToNVS`, `resolveAngle`, `isUniformUnit` are imported from `@brewsite/core/units/resolve`. These are used in `CUSTOM_NODE_HANDLER` implementations to convert DSL prop values to compiled state numbers.
