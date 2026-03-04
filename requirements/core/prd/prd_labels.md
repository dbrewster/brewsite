---
title: "BrewSite Core — 3D Label System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-04
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full 3D label system for @brewsite/core: DSL authoring surface, compiled primitives, LabelPositioner screen projection pipeline, LabelItem renderer, LabelPositionerContext, and transition behavior."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Added LabelStyle.fontFamily optional field for per-label font override. Documented CSS variable inheritance path from EngineOverlayHost --brewsite-font-family for the common case (no per-label override needed)."
---

# BrewSite Core — 3D Label System

## 1. Overview

The Labels system renders DOM text labels that track positions on 3D models. Labels are authored in scene DSL as children of `<Model>` elements, compiled to per-frame primitives baked into the `SceneTrack`, and rendered as React components whose screen positions are updated each frame by projecting 3D world coordinates through the active Three.js camera. The result is sharp, CSS-styled text that appears to attach to model geometry without any of the aliasing or scaling limitations of Three.js sprite-based text.

The system bridges two rendering layers — the Three.js scene graph and the React DOM overlay — through a `LabelPositioner` component that extracts bone world positions from the scene graph each frame and converts them to viewport-relative pixel coordinates for DOM positioning.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Marketing scenes frequently require annotated callouts that point to specific parts of a 3D model: a CPU chip on a server, a memory slot on a motherboard, a sensor on a robot arm. Pure CSS elements cannot track 3D positions because they live in a separate coordinate space from the Three.js scene. Sprite-based Three.js text lacks the typographic quality and CSS flexibility required for polished marketing output.

The gap between these two rendering systems must be bridged at the framework level. Without a toolkit-level solution, every consumer who needs labeled models implements their own 3D-to-screen projection, manages label mount/unmount in synchrony with scene transitions, and duplicates the bone-tracking and camera-projection logic. The result is fragile, hard to test, and tightly coupled to each consumer's specific model structure.

The Labels system provides this bridge as a first-class toolkit capability: scene authors declare labels in DSL, the compiler bakes them into the track, and the `LabelPositioner` handles all coordinate projection. Consumer code never touches Three.js camera math.

---

## 3. Goals & Success Metrics

**Primary Goals:**
- A scene author can attach a text label to a named bone on a model using a single DSL prop, with no Three.js projection code required.
- Labels track their target positions at 60fps without frame drops caused by DOM style mutations.
- Labels fade in and out smoothly at scene boundaries in synchrony with the model they annotate.
- The `LabelPositioner` is composable: it wraps the canvas and overlay, requiring no structural changes to the player layout beyond adding the component.

**Success Metrics:**
- Label screen-position update latency: less than 1ms per label per frame in a scene with 10 simultaneous labels.
- Zero visible position drift between label and target at any camera angle or viewport size.
- TypeScript: `LabelDefinition.id` and `LabelDefinition.text` are required; all other fields are optional with sensible defaults. The types enforce this at authoring time.
- Label visibility transitions (enter/exit) complete within the configured block duration with no pop.

**Guardrail Metrics:**
- No change to `LabelDefinition` causes a major semver bump without a documented migration path.
- Existing examples that use labels continue to render correctly after any change to the projection pipeline.

---

## 4. Non-Goals

- **Leader lines or connector geometry in Three.js** — connector lines are rendered as DOM elements (CSS borders or SVG), not as Three.js line segments. This keeps the connector in the same coordinate space as the label text.
- **Label collision avoidance** — overlapping labels are the author's responsibility. The toolkit does not implement automatic label spreading or occlusion avoidance.
- **Labels not attached to model bones** — all labels track a `targetPartId` (bone name). World-space fixed labels (e.g., a label floating at a fixed `Vec3`) are not in scope. The consumer can implement fixed labels using `HudItem` with absolute positioning.
- **Label click interaction** — labels have `pointer-events: none`. Interactive annotations are a consumer responsibility.
- **Curved or path-following label connectors** — straight connector lines only.
- **Rich text or HTML inside labels** — `LabelDefinition.text` is a plain string. Complex markup should be composed in the consuming application and passed as a custom React node via a future extensibility hook.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to attach a text label to a named bone on my model so that my product's parts are annotated without any Three.js camera math.
- As a toolkit consumer, I want labels to appear and disappear in synchrony with their parent model's scene transitions so that annotations are never visible when the model is not.
- As a toolkit consumer, I want to control the label's visual style (color, font size, line color) through DSL props so that labels match my brand identity.
- As a toolkit consumer, I want `labelOffset` to let me nudge labels away from a bone's pivot point so that the label text does not overlap the model geometry.
- As a toolkit consumer, I want labels to fade in and out smoothly so that the experience is polished rather than abrupt.
- As a toolkit consumer, I want to disable individual labels for specific scenes so that I can show only the relevant annotations per scene.

---

## 6. Functional Requirements

1. The `<Label>` DSL component shall be valid only as a direct child of a `<Model>` DSL component; the compiler shall emit a validation error for labels nested elsewhere.
2. Each `<Label>` shall declare an `id` (unique within its parent model) and a `text` string; both fields are required.
3. The compiler shall extract `LabelDefinition` entries from each `<Model>`'s child elements and store them in `SceneFrame.labelPrimitives` at each frame where the model is active.
4. The `LabelPositioner` component shall receive bone world positions from the active `ModelWidget` each frame via the `RuntimeDriver`.
5. The `LabelPositioner` shall project each bone's world position through the active Three.js camera using `Vector3.project(camera)` to produce normalized device coordinates (NDC).
6. The `LabelPositioner` shall convert NDC coordinates to viewport-relative pixel coordinates using the renderer's current size.
7. The `LabelPositioner` shall distribute projected pixel coordinates to `LabelItem` consumers via `LabelPositionerContext`.
8. `LabelItem` components shall update their `style.left` and `style.top` each frame to match the projected pixel coordinates for their `id`.
9. Labels shall apply `labelOffset` as a world-space translation added to the bone's world position before projection.
10. Labels shall lerp their opacity in synchrony with the parent model's entry and exit transitions using the `LabelStyle.labelOpacity` value baked into the `SceneTrack`.
11. Labels shall render a connector line between the projected bone position and the label text element; the connector is a DOM element (not Three.js geometry).
12. The `LabelStyle.lineOpacity` field shall control the connector line's opacity independently of the label text opacity.
13. Labels with `enabled: false` shall not render their DOM element and shall not appear in `LabelPositionerContext`.
14. The `LabelPositioner` shall re-project all label positions on viewport resize events, not only on animation frames.

---

## 7. API Design

### 7.1 DSL Components (`elements/model/dsl.tsx`)

`<Label>` is authored as a child of `<Model>`:

```tsx
<Model id="server-rack" url="/models/server.glb">
  <Label
    id="memory-label"
    text="16GB DDR5"
    labelOffset={[0, 1.5, 0]}
  />
  <Label
    id="cpu-label"
    text="8-Core CPU"
    labelOffset={[0.5, 1.0, 0]}
    style={{ color: '#00ffcc', fontSize: '14px' }}
  />
  <Label
    id="storage-label"
    text="2TB NVMe"
    labelOffset={[-0.5, 0.5, 0]}
    enabled={false}
  />
</Model>
```

`<Label>` DSL prop types:

```typescript
export interface LabelProps {
  id: string;                      // required; unique within this model
  text: string;                    // required; display string
  labelOffset?: Vec3;              // world-space offset from bone position; default [0, 0, 0]
  enabled?: boolean;               // default true
  style?: LabelStyle;
}
```

### 7.2 State Types (`labels/types.ts`)

```typescript
export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export interface LabelStyle {
  color?: string;             // label text color; default '#ffffff'
  lineColor?: string;         // connector line color; default '#ffffff'
  fontSize?: string;          // CSS font-size string; default '12px'
  fontWeight?: string;        // CSS font-weight; default '400'
  lineOpacity?: number;       // connector line opacity [0, 1]; default 1
  labelOpacity?: number;      // label text opacity [0, 1]; default 1
  lineThickness?: number;     // connector line width in px; default 1
  lineLength?: number;        // connector line length in px; default 32
  /**
   * CSS font-family override for this label.
   * When absent, the label inherits font-family from its DOM ancestor.
   * If EngineOverlayHost injects --brewsite-font-family via SceneTheme,
   * labels inherit it automatically via CSS cascade — this field is not
   * needed for the common "apply theme font to all labels" case.
   * Use this field for per-label font overrides only.
   */
  fontFamily?: string;
}

export interface LabelDefinition {
  id: string;
  text: string;
  targetPartId: string;       // bone name on the parent model; set by compiler from parent Model id
  labelOffset: Vec3;          // default [0, 0, 0] if not specified
  enabled: boolean;
  style: LabelStyle;
}

// Per-frame resolved form stored in SceneFrame.labelPrimitives
export interface LabelResolved extends LabelDefinition {
  instanceId: string;              // equals `id`
  screenPosition?: Vec2;           // populated by LabelPositioner each frame
  opacity: number;                 // resolved opacity for this tick; accounts for scene transition
}
```

### 7.3 Label Compilation (`labels/labelCompiler.ts`)

```typescript
// Pure function — no Three.js, no React
export function compileLabelPrimitives(
  modelDslNode: ModelDslNode,
  sceneProgress: number
): LabelResolved[]
```

The compiler extracts `<Label>` children from each `<Model>` node. Each resolved label has its `targetPartId` set to the bone name (derived from the model's part map), its `opacity` lerped based on the model's current scene entry/exit progress, and its `labelOffset` interpolated if it differs between scenes (Vec3 lerp).

### 7.4 LabelPositionerContext (`labels/LabelPositionerContext.ts`)

```typescript
export interface ScreenPosition {
  x: number;                   // pixels from left edge of canvas
  y: number;                   // pixels from top edge of canvas
  visible: boolean;            // false if projected behind camera
}

export interface LabelPositionerContextValue {
  getScreenPosition(labelId: string): ScreenPosition | undefined;
  subscribe(
    labelId: string,
    callback: (position: ScreenPosition) => void
  ): () => void;               // returns unsubscribe function
}

export const LabelPositionerContext =
  React.createContext<LabelPositionerContextValue | null>(null);

export function useLabelPosition(labelId: string): ScreenPosition | undefined
```

### 7.5 LabelPositioner Component (`labels/LabelPositioner.tsx`)

```typescript
export interface LabelPositionerProps {
  children: React.ReactNode;
}

export function LabelPositioner(props: LabelPositionerProps): React.ReactElement
```

`LabelPositioner` is a wrapper component. It:
1. Reads the current `LabelResolved[]` from `EngineStateContext` each frame.
2. Calls `ModelWidget.getBoneWorldPosition(labelId)` via the `RuntimeDriver` for each active label.
3. Applies the label's `labelOffset` as a `Vector3.add()` in world space.
4. Projects the world position using `camera.project(worldPosition)`.
5. Converts NDC `[-1, 1]` to canvas pixel coordinates.
6. Calls `subscribers[labelId](screenPosition)` for each label, notifying `LabelItem` instances.

The component renders its `children` directly; it contributes no DOM structure of its own. The `LabelPositioner` should wrap both the canvas and the label overlay so that both live in the same coordinate context.

Integration pattern in the player:

```tsx
<LabelPositioner>
  <canvas ref={canvasRef} />
  <div className="label-overlay">
    {activeLabelIds.map(id => (
      <LabelItem key={id} id={id} />
    ))}
  </div>
</LabelPositioner>
```

### 7.6 LabelItem Component (`labels/LabelItem.tsx`)

```typescript
export interface LabelItemProps {
  id: string;                      // matches LabelDefinition.id
  className?: string;
  style?: React.CSSProperties;     // merged with resolved LabelStyle from context
}

export function LabelItem(props: LabelItemProps): React.ReactElement | null
```

`LabelItem` uses `useLabelPosition(id)` to subscribe to screen position updates. On each position update, it applies `style.left` and `style.top` to an absolutely positioned `div`. When `screenPosition.visible` is `false`, the item renders with `visibility: hidden` (not `display: none`, to avoid layout recalculation).

Connector line rendering: a second `div` is rendered as the connector, positioned between the bone projection point and the label text div, rotated to the correct angle using CSS `transform: rotate()`. Its length is derived from `LabelStyle.lineLength`.

### 7.7 Bone Position Interface on ModelWidget

```typescript
// Exposed by ModelWidget for the LabelPositioner
export interface IBonePositionProvider {
  getBoneWorldPosition(boneName: string): THREE.Vector3 | undefined;
}
```

`ModelWidget` implements `IBonePositionProvider`. The `LabelPositioner` queries the `WidgetRegistry` for widgets that implement `IBonePositionProvider` and collects bone positions from them. This decouples the `LabelPositioner` from the concrete `ModelWidget` class.

---

## 8. Technical Considerations

### 8.1 Frame Synchronization

DOM mutations from label position updates must occur synchronously after the Three.js render call and before the next frame's `requestAnimationFrame`. The `RuntimeDriverImpl` tick order is:

1. Sample `SceneTrack` at current progress → `SceneTrackTick`.
2. Dispatch tick to all widgets (Three.js scene updated).
3. Notify `LabelPositioner` via a post-tick callback.
4. `LabelPositioner` projects all positions and updates `LabelPositionerContext`.
5. React re-renders triggered by context updates.
6. Three.js `renderer.render(scene, camera)` called.

This order ensures labels are positioned against the same camera state as the current Three.js frame, preventing one-frame position lag.

### 8.2 DOM Mutation Strategy

Calling `setState` in React on every animation frame for every label is expensive when there are many labels. The `LabelPositioner` uses a subscription model (`subscribe(labelId, callback)`) instead of React state. Each `LabelItem` holds a `useRef` to its DOM node and applies `style.left`/`style.top` via direct DOM mutation (`element.style.left = ...`) inside the subscription callback. This bypasses React's reconciler for position updates, keeping the hot path at O(n_labels) DOM mutations per frame with no React overhead.

React state is used only for `visible` toggling and `opacity` changes, which are infrequent.

### 8.3 Coordinate System

Three.js NDC space is `[-1, 1]` on both axes, with `y` positive upward. Canvas pixel space has `y` positive downward. The conversion is:

```typescript
const x = (ndc.x + 1) * 0.5 * canvasWidth;
const y = (1 - ndc.y) * 0.5 * canvasHeight;
```

The `LabelPositioner` must use the renderer's current pixel dimensions (not CSS dimensions) for this calculation. On high-DPI displays, `renderer.getPixelRatio()` adjusts the physical pixel count; CSS positioning uses logical pixels. The `LabelPositioner` uses the canvas's `getBoundingClientRect()` for CSS pixel dimensions to ensure correct positioning on all display densities.

### 8.4 Behind-Camera Culling

If a label's projected NDC `z` value is greater than `1.0`, the bone is behind the camera's near plane. The `LabelPositioner` sets `screenPosition.visible = false` in this case. Labels that project outside the viewport `(x < 0 || x > width || y < 0 || y > height)` are similarly marked `visible: false` and hidden.

### 8.5 Resize Handling

On `ResizeObserver` events for the canvas element, the `LabelPositioner` immediately re-projects all active label positions without waiting for the next animation frame. This prevents label position stutter during window resize interactions.

### 8.6 `targetPartId` Resolution

The `targetPartId` in `LabelDefinition` must match a named bone in the model's skeleton. The compiler sets `targetPartId` from the `<Label>` element's position in the `<Model>` DSL. At runtime, if `getBoneWorldPosition(targetPartId)` returns `undefined` (bone not found in model), the label is hidden with a development-mode console warning: `[BrewSite] Label "${id}": bone "${targetPartId}" not found in model "${modelId}".`

### 8.7 Module Placement

The `LabelPositioner`, `LabelItem`, `LabelPositionerContext`, and `useLabelPosition` are exported from `packages/core/src/labels/`. The `labelCompiler.ts` module lives in `packages/core/src/compiler/` alongside `hudCompiler.ts`. `LabelDefinition` and `LabelResolved` types live in `packages/core/src/labels/types.ts`. The `IBonePositionProvider` interface lives in `packages/core/src/elements/model/types.ts`.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** for initial introduction.

No existing public API is modified. `<Label>`, `LabelPositioner`, `LabelItem`, `useLabelPosition`, `LabelPositionerContext`, `LabelDefinition`, `LabelResolved`, and `LabelStyle` are all new named exports.

Future breaking change risk: the `targetPartId` field in `LabelDefinition` uses the model's bone name directly. If the model's skeleton changes (consumer re-exports their GLTF), label declarations in DSL would need updating. This is an authoring friction issue, not a toolkit API issue — the toolkit has no mechanism to warn about stale bone names at DSL authoring time (only at runtime). A future tooling improvement (model metadata extraction) could address this.

The `IBonePositionProvider` interface is an internal widget capability interface. Changes to it constitute a breaking change for consumers who have implemented custom widgets that provide bone positions. This risk is low: `IBonePositionProvider` is a niche extension point.

---

## 10. Dependencies

- **Three.js** (peer dependency): `Vector3.project(camera)`, `Camera`, `WebGLRenderer`. No new Three.js modules.
- **React** (peer dependency): `React.createContext`, `React.useContext`, `React.useRef`, `ResizeObserver`.
- **@brewsite/core internal**: `EngineStateContext`, `SceneTrackTick`, `SceneFrame`, `RuntimeDriver`, `WidgetRegistry`, `ModelWidget`, `IBonePositionProvider`, `labelCompiler.ts`.
- **No new external dependencies.**

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Direct DOM mutation bypasses React reconciler | Label position changes invisible to React DevTools | Document the intentional bypass in source; expose a `debugPositions` flag in dev mode that uses setState for observability |
| Label flicker on first frame before LabelPositioner has projected positions | Labels appear at (0, 0) before tracking | Initialize all label positions as `visible: false`; only show once first projection completes |
| Multiple models with identical bone names | Wrong label tracks wrong model | `targetPartId` namespace is scoped to model `id`; LabelPositioner queries each ModelWidget independently |
| High DPI displays cause CSS/pixel coordinate mismatch | Labels offset from model parts | Use `getBoundingClientRect()` for CSS positioning; use `renderer.getSize()` for NDC conversion only |
| `requestAnimationFrame` and `ResizeObserver` fire in different order | One stale frame after resize | Force re-projection in `ResizeObserver` callback synchronously; do not defer to next RAF |
| Labels visible during model load before geometry appears | Annotation without target visible | Gate label visibility on `ModelWidget.isLoaded()` status; hide all labels until their parent model is fully loaded |

---

## 12. Open Questions

- Should `LabelDefinition.targetPartId` support a path notation (e.g., `"chassis/motherboard/cpu_socket"`) for deeply nested bone hierarchies, or is a flat bone name sufficient? Current position: flat bone name only; deep path notation is deferred.
- Should the connector line be rendered as an SVG `<line>` element (better antialiasing, supports stroke-dasharray) rather than a CSS-transformed `div`? SVG rendering has slightly more DOM overhead but better visual quality. This is a rendering implementation detail that does not affect the public API.
- Should `LabelItem` support a `children` prop for custom label content (replacing the default `text` string rendering)? This would enable rich label markup. Deferred — adds significant complexity to the projection model for a niche case.
- Should the `LabelPositioner` be merged with the `HudOverlay` component into a single overlay layer? They serve different concerns (3D-tracked vs. CSS-positioned) and have different update paths. Current position: keep them separate.

---

## 13. Launch Criteria

- `labelCompiler.ts` has unit tests covering: `LabelDefinition` extraction from `<Model>` DSL, `targetPartId` assignment, `labelOffset` default application, and `enabled: false` exclusion.
- `LabelPositioner` has a test verifying: NDC-to-pixel conversion correctness for known input values, `visible: false` output for behind-camera bones, and re-projection on simulated resize.
- `LabelItem` has a React Testing Library test verifying: DOM position update via direct mutation, `visibility: hidden` when `visible: false`, and correct `opacity` applied from resolved style.
- `IBonePositionProvider` is implemented and tested on `ModelWidget`.
- At least one example scene in `apps/examples/` demonstrates a model with two or more labels that track bones through a scene transition.
- `LabelPositioner`, `LabelItem`, `useLabelPosition`, `LabelDefinition`, `LabelResolved`, and `LabelStyle` are all exported from `packages/core/src/index.ts`.
- `packages/core/README.md` documents the Labels system with a usage example.
- `CHANGELOG.md` entry written for the release.
- `pnpm build:lib` passes with zero TypeScript errors.
- `pnpm test` passes for `@brewsite/core` with coverage targets met for all files in `src/labels/` and `src/compiler/labelCompiler.ts`.
