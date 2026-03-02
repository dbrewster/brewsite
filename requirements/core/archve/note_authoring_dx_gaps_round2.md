---
title: "Authoring DX Gap Analysis — Round 2 (@brewsite/core and @brewsite/diagram)"
doc_type: note
owner: brewsite-product-manager
status: active
updated: 2026-02-28
---

# Authoring DX Gap Analysis — Round 2

This note documents a second-pass review of the authoring surface of `@brewsite/core` and `@brewsite/diagram`. It covers areas not reviewed in round 1: environment/floor/background elements, diagram DSL details (edge routing, group variants, icons, themes, pipes), the screen element, the label system, the HUD animejs sub-module, camera interaction config, and compiler error message quality.

Issues already documented in `note_authoring_dx_gaps.md` are not repeated here.

---

## T4-7 — `BackgroundProps` CSS fields are untyped `string` with a confusing `position` vs `cssPosition` collision

**File:** `packages/core/src/elements/background/dsl.tsx` lines 7–16

`position?: Vec3` is the Three.js world-space position of the 3D background plane. `cssPosition?: string` is a CSS `background-position` string for the DOM fallback mode. These fields are adjacent with no comment distinguishing them. An author wanting to offset the background image will try the wrong one.

`cssSize` and `cssRepeat` are plain `string` with no hint of valid CSS values. A typo (e.g., `cssSize="strech"`) silently does nothing. The `<Background>` component has no JSDoc at all — there is no explanation of when the 3D plane mode is active vs the CSS fallback mode, or which props belong to each mode.

**Fix:** Add JSDoc to `<Background>` and `BackgroundProps` explaining the two rendering modes. Distinguish `position` (3D plane world offset) from `cssPosition` (CSS string for the DOM fallback). Note which props apply to which mode.

---

## T4-8 — `<Floor enabled>` with no surface child silently renders nothing

**File:** `packages/core/src/elements/floor/dsl.tsx` lines 7–17; `packages/core/src/elements/floor/FloorWidget.ts` lines 35–63

```tsx
<Floor enabled />
```

Compiles to `{ enabled: true, surface: undefined }`. The `FloorWidget` handler looks for a `<FloorPhysical>` or `<FloorMirror>` child and only sets `surface` when one is found. With no child, `surface` remains `undefined` and the render layer produces either a black plane or nothing visible — no error, no warning, no feedback.

`<Floor>` has no JSDoc listing the required child components. `FloorProps.children` is typed as `React.ReactNode` with no indication that only `<FloorPhysical>` and `<FloorMirror>` are meaningful.

**Fix:** Add JSDoc to `<Floor>` stating that a `<FloorPhysical>` or `<FloorMirror>` child is required for visible output. Emit `console.warn` when `enabled: true` and `surface` resolves to `undefined` after compilation.

---

## T4-9 — `<Environment enabled intensity={0.9}>` with no source child silently disables IBL lighting

**File:** `packages/core/src/elements/environment/dsl.tsx` lines 7–15

```tsx
<Environment enabled intensity={0.9} />
```

Compiles to `{ enabled: true, intensity: 0.9, source: undefined }`. The render layer does nothing — the scene has flat unlit geometry. The `intensity` prop strongly implies something is configured, making the failure particularly confusing.

`<Environment>` has no JSDoc listing its required child components (`<EnvironmentHdri>`, `<EnvironmentExr>`, `<EnvironmentCube>`). Additionally, `<EnvironmentHdri>` and `<EnvironmentExr>` both have a `background?: boolean` field with no documentation of what it does (sets the scene background to the environment map texture, rather than just using it for PBR reflections — a non-obvious Three.js distinction).

**Fix:** Add JSDoc to `<Environment>` listing the required child components. Document `background` on env source components. Emit a compile-time `console.warn` when `enabled: true` and no source child is found.

---

## T5-1 — `<DiagramEdge from/to>` with unresolvable IDs renders a stub tube to the diagram origin

**File:** `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts` lines 958–966

`<DiagramEdge from="api" to="frontend" />` where either ID doesn't match a `<DiagramNode>` in the same `<Diagram>` emits a `console.warn` and sets the edge control points to `[[0,0,0], ...]`. The edge still renders — as a tube shooting to or from the diagram origin. The author sees a visible geometry artifact, not a missing edge, and may spend time debugging layout before finding the console warning.

The `<DiagramEdge>` JSDoc in `dsl.tsx` says `from` and `to` are "ID of the source/destination node" but does not state that the IDs must exactly match a `<DiagramNode id="...">` within the same `<Diagram>`, nor that a mismatch produces a degraded stub rather than nothing.

**Fix:** Update the `<DiagramEdge>` JSDoc to state the exact-match requirement. Consider rendering the stub with zero-length control points (invisible) rather than routing to `[0,0,0]`, eliminating the visible artifact.

---

## T5-2 — `DiagramGroupVariant` values are undocumented; `'container'` silently suppresses the border

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` line 175; `packages/diagram/src/elements/diagram/types.ts` line 235; `compile.ts` line 151

```typescript
export type DiagramGroupVariant = 'swimlane' | 'boundary' | 'cluster' | 'container';
```

There is no JSDoc on the type or on `<DiagramGroupProps>.variant` describing the visual or behavioral difference between the four values. The `'container'` variant forces `borderStyle: 'none'` in `compile.ts` with no DSL-level documentation — authors who set `borderStyle` on a container group get it silently overridden.

**Fix:** Add JSDoc to `DiagramGroupVariant` and `<DiagramGroupProps>.variant` describing each:
- `'boundary'` — outlined rectangular region
- `'cluster'` — shaded background fill
- `'swimlane'` — labeled lane with divider (`orientation` prop only applies here)
- `'container'` — borderless region (border is always suppressed; `borderStyle` is ignored)

---

## T5-3 — `<DiagramNode icon>` `custom:` prefix is undocumented; namespace list in JSDoc is incomplete

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` lines 43–49; `packages/diagram/src/elements/diagram/shapes/shapeVariants.ts` line 594

`DiagramIconVariant` includes `` `custom:${string}` `` for author-registered SVGs, but there is no documentation explaining how to register a custom icon or what API call associates a `custom:myIcon` string with an SVG. The `icon` prop JSDoc mentions `ui:*`, `aws:*`, `gcp:*`, `azure:*`, `tech:*` but omits `security:*`, `data:*`, `network:*` and the `custom:` escape hatch entirely.

**Fix:** Update the `icon` JSDoc to list all namespace prefixes exhaustively. Add documentation to the `custom:` template literal in `DiagramIconVariant` or in `<DiagramNode>.icon` explaining how to register a custom icon (which widget setup step is required, and what format the SVG must be).

---

## T5-4 — `<Diagram theme>` has no documentation of the four built-in theme constants or their import path

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` lines 303–309

`theme?: DiagramTheme` notes the package default (`darkGlassTheme`) but doesn't mention `neonCyberTheme`, `enterpriseTheme`, or `lightMinimalTheme`, nor their import path from `@brewsite/diagram`. An author who wants a light theme must search the package source.

The same omission exists on `<DiagramCanvasProps>.theme`.

**Fix:** Add a `@see` or `@example` to both `theme` props:
```typescript
// import { darkGlassTheme, lightMinimalTheme, enterpriseTheme, neonCyberTheme } from '@brewsite/diagram';
```

---

## T5-5 — `<DiagramPipe>` default `color` in JSDoc (`'#667788'`) differs from actual implementation (`'#3d5a9a'`)

**File:** `packages/diagram/src/elements/diagram/canvas/dsl.tsx` line 89; `canvas/compile.ts` line 26

The JSDoc on `<DiagramPipeProps>.color` documents `Default: '#667788'`. `PIPE_DEFAULTS.color` in `compile.ts` is `'#3d5a9a'`. These are visually distinct colors. An author relying on the documented default to match a color scheme will get the wrong value.

**Fix:** Correct the JSDoc to match `PIPE_DEFAULTS.color`. Better: define `PIPE_DEFAULTS.color` as a shared named constant referenced by both the JSDoc and the compile function so they cannot diverge again.

---

## T5-6 — `<Screen rotation>` warning threshold in JSDoc (`0.15`) is inconsistent with the prose guidance (`~0.1`)

**File:** `packages/diagram/src/elements/screen/dsl.tsx` lines 21–25

The JSDoc states: "compile.ts emits `console.warn` if `|rotation[i]| > 0.15`" but also "Values above ~0.1 rad will visibly misalign the iframe with the bezel." The threshold (0.15) and the prose guidance (~0.1) are inconsistent. Additionally, the compile-time warning fires during `compileSceneTrack` — in an SSR or CI build pipeline context it may go entirely unnoticed by the author.

**Fix:** Align the prose threshold and the actual implementation threshold. Consider emitting the warning at render time (browser devtools) in addition to compile time so it is always visible to the author.

---

## T6-1 — `<Label>` nesting requirement is undocumented and `'target-color'` is an invisible magic string

**File:** `packages/core/src/labels/dsl.tsx` line 8; `packages/core/src/labels/types.ts` lines 14–25

`targetPartId` exists only on `LabelResolved`, not on `LabelDefinition` (the DSL type). An author who writes `<Label targetPartId="bone_head" />` gets a TypeScript error. The `targetPartId` is resolved implicitly when `<Label>` is nested inside `<BodyPart>` or `<Subpart>` — but this nesting requirement is nowhere documented in the DSL. If `<Label>` is placed at the scene top level it throws a cryptic runtime error.

`LabelStyle.color` and `LabelStyle.lineColor` accept a magic string `'target-color'` that reads the bone's material color at runtime. The type is plain `string` with no documentation of this value anywhere. An author who wants label color to track the bone's material color has no way to discover this.

**Fix:** Add JSDoc to `<Label>` explaining: "Must be nested inside `<BodyPart>` or `<Subpart>`. The `targetPartId` is resolved automatically from the parent element." Add `'target-color'` as an explicit documented literal (or a separate string union) in `LabelStyle.color` and `.lineColor`, with a comment explaining its effect.

---

## T6-2 — `useScrollTimeline` and animejs presets are not exported from `@brewsite/core` and have no discoverable import path

**File:** `packages/core/src/hud/animejs/index.ts`; `packages/core/package.json`

`@brewsite/core`'s `package.json` exports only `"."` — no subpath exports. The `hud/animejs` sub-module is not re-exported from `src/index.ts` or `src/hud/index.ts`. The only import path is a deep internal path (`@brewsite/core/hud/animejs` or `@brewsite/core/dist/hud/animejs/index.js`) that is undocumented anywhere — not in `HudItem`'s JSDoc, not in the animejs components themselves.

Consumers using `moduleResolution: bundler` (Next.js, modern Vite configs with strict package exports) will get a module resolution error at build time. There is no `"./hud/animejs"` entry in `exports`.

**Fix:** Add a `"./hud/animejs"` subpath export to `package.json` with `types` and `import` fields. Add a `@see` reference on `<HudItem>` pointing to the animejs presets module and its import path.

---

## T6-3 — `Fade` is the only phase-aware animejs preset (auto-reverses in exit phase) — undocumented

**File:** `packages/core/src/hud/animejs/transitions.tsx` lines 33–91

`Fade` checks `useHudPhase()` and reverses its animation when `phase === 'exit'` — it produces a fade-out automatically without the author needing to do anything. None of the other five presets (`MidFade`, `SlideUp`, `SlideDown`, `ScrollOn`, `ScrollOff`) have this behavior. An author using `SlideUp` inside an exit-phase `<HudItem>` gets a slide-in instead of a slide-out.

Additionally, default `duration` values differ across presets (`Fade`/`SlideUp`/`SlideDown` = 600ms; `MidFade`/`ScrollOn`/`ScrollOff` = 1000ms) with no documentation on the `duration` prop JSDoc, which just says "Default varies per preset."

**Fix:** Add JSDoc to `Fade` stating it is the only phase-aware preset and auto-reverses in exit phase. Document per-preset default durations explicitly on the `duration` prop of each component. Add a note to the other presets that they are enter-only and will not reverse in exit phase.

---

## T6-4 — `TrackpadCameraConfig.enabled: false` silently suppresses all other config fields with no warning

**File:** `packages/core/src/elements/camera/types.ts` line 165

`rotate`, `pan`, and `zoom` default to enabled (per JSDoc), but `TrackpadCameraConfig.enabled` defaults to `false`. Writing:

```tsx
<Camera interaction={{ enabled: false, rotate: { speed: 2 } }} />
```

configures rotation speed but silently ignores it because the master switch is off. No warning is emitted. There is no note in the `enabled` JSDoc that `false` suppresses all other fields.

**Fix:** Add JSDoc to `TrackpadCameraConfig.enabled`: "Setting this to `false` disables interaction entirely, ignoring all other fields in this config." Consider making `enabled` optional with `@default false`.

---

## T6-5 — Compiler error messages are not actionable for new authors

**File:** `packages/core/src/compiler/sceneDslCompiler.ts` lines 252–259; `packages/core/src/compiler/sceneTrackCompiler.ts` lines 128–131

Three throw messages lack enough context:

| Current message | Problem |
|---|---|
| `'Scene DSL must return a JSX element.'` | Doesn't say what was returned or suggest checking the return statement |
| `'Scene DSL root must be <Scene>.'` | Doesn't include the actual element type that was found |
| `'Scene at index N getFrame() must return a JSX element or SceneFrame (got: undefined)'` | Reasonable, but missing an actionable suggestion |

**Fix:**
```
'Scene DSL must return a JSX element (got: ${typeof tree}). Ensure getFrame() has a return statement returning <Scene>.'

'Scene DSL root must be <Scene> (got: <${elementTypeName}>). Wrap your content in <Scene key="...">.`
```

---

## Issue Count Summary

| ID Range | Count | Area |
|----------|-------|------|
| T4-7 to T4-9 | 3 | Core elements (Background, Floor, Environment) |
| T5-1 to T5-6 | 6 | @brewsite/diagram DSL |
| T6-1 to T6-5 | 5 | Labels, HUD animejs, camera interaction, compiler errors |
| **Total (round 2)** | **14** | |

Combined with round 1 (29 issues), the full tracked count is **43 issues**.

---

## Architect Work Items from Round 2

Most round 2 issues are JSDoc improvements, one-line fixes, or warning additions that do not require architectural design. The following two are exceptions:

---

### A8 — `hud/animejs` subpath export and package.json exports map

**Covers:** T6-2

**Scope:** `packages/core/package.json`, `packages/core/src/hud/animejs/index.ts`

**Design questions for architect:**
- The `hud/animejs` module is intentionally opt-in (it depends on `animejs`, which is a peer dependency). The architect should confirm that adding `"./hud/animejs"` to the `exports` map does not pull `animejs` into the main bundle for consumers who never use the presets.
- The exports entry needs both `"types"` (pointing to `.d.ts`) and `"import"` (pointing to the ESM output). Confirm the current build pipeline produces a compatible output for this path given the existing `tsup` or `tsc` setup.
- Verify that `animejs` is listed as a `peerDependency` (not a direct dependency) in `packages/core/package.json`, so consumers who don't use the presets don't install it.

**Files affected:**
- `packages/core/package.json` — add `"./hud/animejs"` subpath export
- `packages/core/src/hud/` — `index.ts` (add `@see` reference to animejs sub-module)
- `packages/core/src/compiler/blocks/hudBlocks.tsx` — add `@see` reference on `<HudItem>` JSDoc

---

### A9 — Canonical `LabelStyle` type with `'target-color'` documented

**Covers:** T6-1

**Scope:** `packages/core/src/labels/types.ts`

**Design questions for architect:**
- `'target-color'` is currently an undocumented magic string read by `LabelPositioner` and `LabelItem`. Should it be a string literal union (`color?: string | 'target-color'`) or a separate type alias? The union is more discoverable but requires TypeScript to allow both `string` and the literal (which it does via `string | 'target-color'` — the literal is subsumed but still shows in autocomplete).
- The `targetPartId` placement issue (T6-1 first half) requires no architectural decision — it is a JSDoc fix. Confirm the fix is only in `dsl.tsx` and does not require changes to `types.ts`.
