---
title: "BrewSite Core — HUD Overlay System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-02-28
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full HUD overlay system for @brewsite/core: two-tier architecture, DSL authoring surface, compiled primitives, HudPhaseContext, HudOverlay renderer, anime.js preset sub-module, contentSlots, and authoring patterns."
---

# BrewSite Core — HUD Overlay System

## 1. Overview

The HUD (Heads-Up Display) system renders DOM-based overlay content on top of the Three.js WebGL canvas. HUD items are authored declaratively inside scene DSL, compiled to per-frame primitives baked into the `SceneTrack`, and rendered as React components that synchronize to scene progress in real time. The system enables rich typographic and interactive content — headings, feature callouts, step indicators, navigation controls — to coexist with the 3D scene without any imperative state management or manual lifecycle coordination.

The HUD is distinct from the Labels system: Labels track 3D world-space positions projected to screen coordinates. HUD items are CSS-positioned and not spatially coupled to 3D geometry.

The optional `hud/animejs/` sub-module provides six scroll-driven animation presets built on anime.js for common enter/exit motion patterns.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Animated marketing scenes require on-screen text, titles, feature callouts, and step indicators that appear and disappear in synchrony with the 3D animation. Implementing this in a host application means manually tracking scene progress, managing component mount/unmount, writing enter/exit transition CSS, and ensuring correct timing with the underlying Three.js playback.

Without a toolkit-level HUD system, every consumer re-invents this coordination logic. The results are brittle, inconsistent between projects, and tightly coupled to the application's scroll infrastructure. The HUD system eliminates this redundancy by providing a first-class DSL surface for overlay content that compiles into the same `SceneTrack` as the 3D content, ensuring perfect synchronization without consumer-authored timing logic.

The secondary problem is animation ergonomics. DOM-based enter/exit animations on scroll-driven content are awkward with CSS alone: the scroll position is a progress value in `[0, 1]`, not a time value, which breaks standard CSS animation APIs. The anime.js preset sub-module solves this by scrubbing anime.js timelines to scroll progress, giving scene authors access to the full anime.js easing and sequencing API while keeping the authoring surface declarative.

---

## 3. Goals & Success Metrics

**Primary Goals:**
- A scene author can add titled callouts, step counters, and feature descriptions to any scene using only `<Hud>` and `<HudItem>` DSL components, with no React lifecycle management.
- HUD items that share the same `id` across consecutive scenes maintain stable React identity, enabling CSS transition continuity.
- Enter and exit phases are surfaced through `HudPhaseContext` so that animation presets can trigger without any scene-progress math in consumer code.
- The anime.js preset sub-module is optional — not importing it incurs zero bundle overhead.

**Success Metrics:**
- A developer can add a scroll-synced fade-in heading to a scene in under 10 minutes with no prior HUD system knowledge.
- HUD items correctly enter and exit without flicker at scene boundaries.
- The `hud/animejs/` sub-module adds less than 8 KB gzipped to consumer bundles (excluding the anime.js peer dependency itself).
- Zero consumer-visible timing math required for any of the six preset components.

**Guardrail Metrics:**
- Changing `HudItemDefinition` fields does not break existing scenes that use only `id`, `className`, and `children`.
- The anime.js sub-module import does not cause any runtime error when `anime.js` is not installed (it must fail gracefully with a clear peer dependency error at import time, not silently at runtime).

---

## 4. Non-Goals

- **Interactive UI controls inside HUD items** — the HUD overlay uses `pointer-events: none` by default. Interactive elements (buttons, forms) inside `contentSlots` are supported, but interactivity inside `HudItem` children is not a core use case and is not tested by the toolkit.
- **CSS keyframe animation management** — the toolkit provides the phase context; CSS animation authoring is the consumer's responsibility. The anime.js preset sub-module is a convenience layer, not the exclusive animation path.
- **Z-index stacking between HUD items** — stacking order is determined by DOM order (matching DSL declaration order). The toolkit does not expose a `zIndex` prop.
- **HUD item positioning** — `HudItem` does not manage its own position within the overlay; positioning is handled via the `className` and `style` props using the consumer's CSS framework.
- **Video or canvas elements inside HUD items** — only standard DOM/React content.
- **SSR rendering of HUD content** — HUD items are client-side only; they depend on `EngineStateContext` which requires a live RuntimeDriver.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to declare overlay text items inside my scene DSL so that my headings and callouts stay synchronized with my 3D animations without manual timing code.
- As a toolkit consumer, I want HUD items to automatically receive enter and exit phase signals so that I can trigger animations at the right moment without reading scene progress values myself.
- As a toolkit consumer, I want items with the same `id` across scenes to keep a stable React identity so that CSS transitions carry through without remount.
- As a toolkit consumer, I want to use a `<SlideUp>` preset around my headline so that I get a polished entrance animation with a single DSL line.
- As a toolkit consumer, I want to place persistent UI (navigation arrows, progress dots) outside the scene lifecycle using `contentSlots` so that it always renders regardless of which scene is active.
- As a toolkit consumer, I want to disable a HUD item for a specific scene without triggering an exit animation so that I can conditionally suppress items without side effects.

---

## 6. Functional Requirements

1. The `<Hud>` DSL component shall be valid only as a direct child of a `<Scene>` component; the compiler shall emit a validation error if it is nested elsewhere.
2. Each `<Scene>` shall support at most one `<Hud>` block; the compiler shall merge multiple `<Hud>` blocks within a scene into a single item list if present.
3. The compiler shall compile `<Hud>` DSL into `HudItemDefinition[]` stored in `SceneFrame.hudPrimitives` at each frame where the scene is active.
4. `HudItem` children shall be captured as `ReactNode` by the compiler and shall not be traversed or transformed by the DSL compiler; they are opaque React content.
5. The system shall assign `phase: 'enter'` to a `HudItemDefinition` on the first frame it appears in the compiled track.
6. The system shall assign `phase: 'exit'` to a `HudItemDefinition` on the last frame it appears in the compiled track.
7. The `HudOverlay` component shall render the `hudPrimitives` array from the current `SceneTrackTick` as DOM elements inside an absolutely-positioned overlay div that covers the canvas.
8. The overlay div shall have `pointer-events: none` applied by default; individual `HudItem` renderers shall not override this without explicit consumer opt-in.
9. `HudItem` components with the same `id` across scenes shall render with the same React `key`, preserving DOM identity and CSS transition state through scene changes.
10. `HudItem` components with `enabled: false` shall not render to the DOM; they shall not emit an exit phase when disabled.
11. `HudPhaseContext` shall be available to all descendants of each rendered `HudItem` via React context.
12. The `contentSlots` prop on `ScenePlayer` shall render named `ReactNode` slots inside the HUD overlay layer, outside the `hudPrimitives` render cycle, persisting for the full lifetime of the player.
13. The anime.js preset sub-module shall be exported from a distinct sub-path (`@brewsite/core/hud/animejs`) so that it does not affect the main bundle unless explicitly imported.

---

## 7. API Design

### 7.1 DSL Components (`compiler/blocks/hudBlocks.tsx`)

```typescript
// HudItem prop types
export interface HudItemProps {
  id: string;
  enabled?: boolean;                  // default true
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

// Hud container — children must be HudItem elements
export interface HudProps {
  children: React.ReactNode;
}
```

```tsx
// Scene DSL usage
<Scene id="product-overview">
  <Camera position={[0, 1.5, 6]} />
  <Lighting ambient={{ intensity: 0.6 }} />

  <Hud>
    <HudItem id="scene-title" className="hud-title">
      <h1>Product Overview</h1>
    </HudItem>
    <HudItem id="scene-step" className="hud-step">
      <span>01 / 04</span>
    </HudItem>
  </Hud>
</Scene>
```

### 7.2 Compiled Primitives (`hud/types.ts`)

```typescript
export type HudPhase = 'enter' | 'exit';

export interface HudItemDefinition {
  id: string;
  enabled: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

// Per-frame resolved form stored in SceneFrame.hudPrimitives
export interface HudItemResolved extends HudItemDefinition {
  instanceId: string;          // stable identity key: same as `id` for stable items
  phase: HudPhase | undefined; // 'enter' on first appearance, 'exit' on last, undefined otherwise
  blockProgress: number;       // [0, 1] progress within the current transition block
}
```

### 7.3 HudPhaseContext (`hud/HudPhaseContext.ts`)

```typescript
export interface HudPhaseContextValue {
  phase: HudPhase | undefined;
  blockProgress: number;       // [0, 1]; direct pass-through from SceneTrackTick
}

export const HudPhaseContext = React.createContext<HudPhaseContextValue>({
  phase: undefined,
  blockProgress: 0,
});

export function useHudPhase(): HudPhaseContextValue {
  return React.useContext(HudPhaseContext);
}
```

### 7.4 HudOverlay Component (`hud/HudOverlay.tsx`)

```typescript
export interface HudOverlayProps {
  // No props — reads from EngineStateContext internally
}

export function HudOverlay(): React.ReactElement
```

Internal behavior:
- Reads `currentTick.hudPrimitives` from `EngineStateContext`.
- Renders a full-viewport `div` with `position: absolute; inset: 0; pointer-events: none`.
- Maps each `HudItemResolved` to a `<HudItemRenderer key={item.instanceId} item={item} />`.
- Items not present in `hudPrimitives` are not rendered; React handles unmounting.

### 7.5 HudItemRenderer Component (internal, `hud/HudItemRenderer.tsx`)

```typescript
interface HudItemRendererProps {
  item: HudItemResolved;
}

function HudItemRenderer({ item }: HudItemRendererProps): React.ReactElement | null
```

- Returns `null` when `item.enabled === false`.
- Renders a `div` with `item.className` and `item.style` applied.
- Provides `HudPhaseContext.Provider` wrapping `item.children`, passing `{ phase: item.phase, blockProgress: item.blockProgress }`.

### 7.6 ScenePlayer contentSlots Prop

```typescript
interface ScenePlayerProps {
  // ... existing props ...
  contentSlots?: Record<string, React.ReactNode>;
}
```

```tsx
<ScenePlayer
  sceneTrack={track}
  contentSlots={{
    navigation: <NavigationArrows />,
    progress: <ProgressDots sceneCount={4} />,
  }}
/>
```

Slots are rendered inside the overlay container, outside the `hudPrimitives` render cycle. They are keyed by slot name and persist for the player's full lifetime. Slot names are opaque strings; the toolkit provides no reserved slot names.

### 7.7 anime.js Preset Sub-Module (`hud/animejs/`)

Sub-path export: `@brewsite/core/hud/animejs`

#### Hook: `useScrollTimeline`

```typescript
import type { AnimeTimelineInstance } from 'animejs';

export function useScrollTimeline(
  timeline: AnimeTimelineInstance,
  options?: {
    reversed?: boolean;   // scrub timeline in reverse; default false
  }
): void
```

- Reads `blockProgress` from `HudPhaseContext`.
- On each render, calls `timeline.seek(blockProgress * timeline.duration)`.
- Does not start or pause the timeline; all playback is driven by `blockProgress`.

#### Preset Props (shared interface)

```typescript
export interface HudAnimationProps {
  children: React.ReactNode;
  duration?: number;           // ms; defaults to the current block's duration from HudPhaseContext
  delay?: number;              // ms start delay within the block; default 0
  easing?: string;             // anime.js easing string; default 'easeOutCubic'
}
```

#### Preset Components

```typescript
// Opacity 0 → 1 over the enter block; 1 → 0 over the exit block
export function Fade(props: HudAnimationProps): React.ReactElement

// Enter block: opacity 0 → 1 in first half; Exit block: opacity 1 → 0 in second half
export function MidFade(props: HudAnimationProps): React.ReactElement

// translateY(20px) → translateY(0) + opacity 0 → 1 on enter block
export function SlideUp(props: HudAnimationProps): React.ReactElement

// translateY(0) → translateY(-20px) + opacity 1 → 0 on exit block
export function SlideDown(props: HudAnimationProps): React.ReactElement

// Opacity 0 → 1 across the full block duration (enter and steady blocks)
export function ScrollOn(props: HudAnimationProps): React.ReactElement

// Opacity 1 → 0 across the full block duration (steady and exit blocks)
export function ScrollOff(props: HudAnimationProps): React.ReactElement
```

Usage pattern:

```tsx
<HudItem id="product-headline" className="hud-headline">
  <SlideUp duration={600} easing="easeOutExpo">
    <h1>Introducing the Platform</h1>
  </SlideUp>
</HudItem>
```

Each preset creates its own anime.js timeline internally and passes it to `useScrollTimeline`. The DOM target is referenced via a `React.useRef`.

---

## 8. Technical Considerations

### 8.1 Compiler Integration

The `hudCompiler.ts` module processes `<Hud>` blocks found in the React element tree produced by scene DSL evaluation. It operates as a pure function: given the evaluated scene JSX tree, it extracts `HudItemDefinition[]` and attaches them to `SceneFrame.hudPrimitives`. The compiler does not evaluate `children` of `HudItem` — they are stored as-is as `ReactNode` references.

Phase determination is a two-pass operation:
1. Pass 1 (compile): Record each item `id` and the frame range it appears in.
2. Pass 2 (bake into SceneTrack): For each item, mark `phase: 'enter'` on the first tick and `phase: 'exit'` on the last tick within its appearance range.

This is consistent with the compiler's existing two-pass approach for transitions.

### 8.2 React Key Stability

`HudItemResolved.instanceId` is set to the item's `id` string. This means items with the same `id` across scenes share the same React key, preserving their DOM node identity. CSS transitions on opacity, transform, and other animatable properties carry through scene changes without remount. This is the intended authoring pattern for cross-scene continuity.

Items that appear in only one scene get a unique `instanceId` and are fully mounted/unmounted. The `phase: 'enter'` / `phase: 'exit'` signals allow anime.js presets or custom CSS to animate the mount/unmount.

### 8.3 EngineStateContext Coupling

`HudOverlay` reads from `EngineStateContext`, which is provided by the `ScenePlayer`. This means `HudOverlay` can only render inside a `ScenePlayer` tree. This is intentional — the HUD is not a standalone component.

### 8.4 anime.js Peer Dependency

The `hud/animejs/` sub-module declares `animejs` as a peer dependency. If the consumer has not installed `animejs`, importing `@brewsite/core/hud/animejs` will throw a module resolution error at import time. This is acceptable behavior — the error message is clear, and the peer dependency is documented in the package README.

The main `@brewsite/core` package does not list `animejs` as a peer dependency. Only the sub-path export introduces this requirement.

### 8.5 pointer-events Behavior

The overlay div uses `pointer-events: none` so that it does not block mouse events to the Three.js canvas below. `HudItem` renderers do not override this. If a consumer needs an interactive element inside a HUD item (e.g., a "Learn More" link), they must add `style={{ pointerEvents: 'auto' }}` to that specific element within their `children` ReactNode. The toolkit does not provide an `interactive` prop on `HudItem` because interactive HUD items are an uncommon case that should require explicit opt-in.

### 8.6 Bundle Isolation

The `hud/animejs/` sub-module must be a separate entry point in the package's `exports` map so that bundlers can tree-shake it out of the main bundle:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./hud/animejs": "./dist/hud/animejs/index.js"
  }
}
```

This ensures that consumers who do not use anime.js presets pay zero bundle cost for the sub-module.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** for initial introduction.

No existing public API is modified. `<Hud>` and `<HudItem>` are new named exports from `compiler/index.ts`. `HudOverlay`, `HudPhaseContext`, `useHudPhase`, `HudItemDefinition`, `HudItemResolved`, and `HudPhase` are new named exports from the main package index.

`contentSlots` is a new optional prop on `ScenePlayerProps`. Adding an optional prop to an interface is a backward-compatible minor change.

Future breaking change risk: `HudItemResolved.instanceId` equals `HudItemDefinition.id`. If a future design requires multiple instances of the same item within a single scene, `instanceId` would need to diverge from `id`, which could affect consumers who read `instanceId` directly. This is a low-probability scenario given the one-item-per-id authoring model.

---

## 10. Dependencies

- **React** (peer dependency): `React.createContext`, `React.useContext`, `React.useRef`, `React.ReactNode`.
- **anime.js** (optional peer dependency, sub-path only): `AnimeTimelineInstance`, `anime.timeline()`, `timeline.seek()`.
- **@brewsite/core internal**: `EngineStateContext`, `SceneTrackTick`, `SceneFrame`, compiler node handler registry, `hudCompiler.ts`.
- **No new external runtime dependencies** in the main package entry point.

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `children` captured as ReactNode becomes stale if scene re-evaluates | HUD items show outdated content | Scene DSL is evaluated once at compile time; ReactNode references are stable |
| anime.js timeline `seek()` called on every frame at 60fps | CPU pressure from anime.js internals | `seek()` on a paused timeline is a cheap O(1) operation in anime.js v3+; benchmark to confirm |
| `pointer-events: none` on overlay blocks consumer interactive elements | Interactive HUD content is broken silently | Document the requirement to add `pointer-events: auto` on interactive children; no toolkit-level workaround |
| Two `HudItem` elements with the same `id` in the same `<Hud>` block | Duplicate React keys, rendering glitch | Compiler validation pass: emit an error for duplicate `id` values within a single scene's Hud block |
| anime.js not installed; consumer imports main package | Unclear error if sub-module import is tree-shaken in unexpectedly | Maintain strict sub-path export separation; add CI check that main bundle does not contain anime.js imports |
| HUD overlay z-index below canvas | HUD items are invisible | Set `z-index: 1` on the overlay div; canvas wrapper should use `z-index: 0` |

---

## 12. Open Questions

- Should `HudItem` support a `position` prop (absolute CSS coordinates) as a convenience, or should all positioning be delegated to `className` and `style`? Current position: no `position` prop — CSS frameworks and utility classes are better suited than toolkit-managed inline styles.
- Should `HudPhaseContext` expose `sceneIndex` so that presets can branch logic based on which scene is active? Current position: no — phase and blockProgress are sufficient; scene index is an application concern.
- Should the anime.js sub-module expose a `useScrollProgress` hook directly (without requiring a timeline) for consumers who want to drive arbitrary animations from blockProgress? This would be additive and could be added in a future minor release.
- Should `contentSlots` render slots inside or outside the `HudOverlay` React tree? Currently inside the overlay container. If slots need to render above or below the canvas independently, a separate `<ContentSlot>` component API may be warranted.

---

## 13. Launch Criteria

- `hudCompiler.ts` has unit tests covering: `HudItem` extraction from DSL, phase assignment on first and last appearance, `enabled: false` items excluded from output, and duplicate `id` validation error.
- `HudOverlay` has a React Testing Library test verifying: correct render of items from a mock `EngineStateContext`, stable key identity for shared-id items across ticks, and null render for disabled items.
- `HudPhaseContext` value is verified in a test to update correctly when `blockProgress` changes.
- At least one example scene in `apps/examples/` demonstrates `<Hud>` with two `<HudItem>` elements using different preset animations.
- `useScrollTimeline`, `Fade`, `MidFade`, `SlideUp`, `SlideDown`, `ScrollOn`, and `ScrollOff` are all exported from the `hud/animejs` sub-path.
- `packages/core/README.md` documents the HUD DSL with a complete usage example.
- `CHANGELOG.md` entry written for the release.
- `pnpm build:lib` passes with zero TypeScript errors.
- `pnpm test` passes for `@brewsite/core` with coverage targets met for `hud/` and `compiler/hudCompiler.ts`.
- The `hud/animejs` sub-path is correctly listed in `package.json` `exports` and verified by a bundle size audit.
