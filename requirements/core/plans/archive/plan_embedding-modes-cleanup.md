---
title: "Embedding Modes Cleanup — Implementation Plan"
doc_type: plan
owner: Toolkit Architecture
status: completed
updated: 2026-03-15
---

# Embedding Modes Cleanup — Implementation Plan

This plan implements the three backlog items from [note_embedding-modes-cleanup.md](../notes/note_embedding-modes-cleanup.md):

- **P0** — Fix SceneReel prop forwarding (4 missing props)
- **P2** — Canvas Region example page
- **P3** — EngineARContainer naming audit (export alias)

---

## Work Streams & Parallelism

The plan is structured into **4 independent work streams** that can be executed in parallel by different developers. No two streams modify the same file.

| Stream | Priority | Files Modified | Depends On |
|---|---|---|---|
| **WS-1**: SceneReel props | P0 | `SceneReel.tsx`, `SceneReel.test.tsx` | None |
| **WS-2**: README update | P0 | `packages/core/README.md` | WS-1 (type names only — can start immediately using the known prop names) |
| **WS-3**: Canvas Region example | P2 | 3 new files in `apps/examples/src/canvas-region/`, plus `App.tsx` | WS-1 (uses the updated `SceneReel`) |
| **WS-4**: EngineARContainer alias | P3 | `EngineARContainer.tsx`, `player/index.ts` | Pending product authorization |

**Sequencing:** WS-1 and WS-2 have zero dependencies and can start immediately. WS-3 depends on WS-1 being merged first (it uses the new `theme` prop on `SceneReel`), but the developer can write all code before WS-1 lands — just needs WS-1 merged before the example compiles. WS-4 is gated on product authorization (see WS-4 section).

---

## WS-1: Fix SceneReel Prop Forwarding

**Priority:** P0
**Files modified:**
- `packages/core/src/player/SceneReel.tsx`
- `packages/core/src/player/__tests__/SceneReel.test.tsx`

### 1.1 Update `SceneReelProps` interface

Add four new optional props to the `SceneReelProps` interface in `SceneReel.tsx`. Insert them in the "Engine config" section (after line 31, before the Lifecycle section).

```typescript
// Add after line 31 (after sceneTheme):

/** Active theme for this engine. Supersedes deprecated sceneTheme. */
theme?: SceneEngineProps['theme'];

/**
 * Scroll source for viewport-relative context lifecycle management.
 * Forwarded to SceneEngine.
 */
scrollSource?: SceneEngineProps['scrollSource'];

/**
 * Default duration (ms) for programmatic scene transition animations.
 * Forwarded to SceneEngine. Default: 400ms.
 */
defaultTransitionDuration?: SceneEngineProps['defaultTransitionDuration'];

/**
 * Default easing for programmatic scene transition animations.
 * Forwarded to SceneEngine.
 */
defaultTransitionEasing?: SceneEngineProps['defaultTransitionEasing'];
```

**Import change:** The file already imports `SceneEngineProps` from `'./SceneEngine'` (line 7). No new imports needed — all four props use `SceneEngineProps['...']` syntax to stay DRY and type-safe.

### 1.2 Forward props to `<SceneEngine>` in JSX

In the `SceneReel` function body, add the four props to the `<SceneEngine>` JSX element (currently lines 77–91). Insert after `sceneTheme={props.sceneTheme}` (line 86):

```tsx
<SceneEngine
  id={props.id}
  plugins={props.plugins}
  timingProfile={props.timingProfile}
  primaryCameraId={props.primaryCameraId}
  primaryCanvasActionTargetId={props.primaryCanvasActionTargetId}
  cameraInteractionDefaults={props.cameraInteractionDefaults}
  invalidateCacheToken={props.invalidateCacheToken}
  maxAnimBoostPerFrame={props.maxAnimBoostPerFrame}
  sceneTheme={props.sceneTheme}
  theme={props.theme}
  scrollSource={props.scrollSource}
  defaultTransitionDuration={props.defaultTransitionDuration}
  defaultTransitionEasing={props.defaultTransitionEasing}
  onReady={props.onReady}
  onError={props.onError}
  onWidgetError={props.onWidgetError}
  onCompileWarning={props.onCompileWarning}
>
```

### 1.3 Remove DEBT comment

Delete line 13 entirely:
```
// DEBT: SceneReel does not accept or forward themeFamily, themePolarity, or scrollSource props
```

This comment is now stale — `theme` supersedes `themeFamily`/`themePolarity`, and all four missing props are now forwarded.

### 1.4 Test updates

Add the following tests to `packages/core/src/player/__tests__/SceneReel.test.tsx`. These verify the type interface accepts the new props without runtime errors. Since SceneEngine is not mocked (it renders the real provider tree), and the props are pass-through, the tests verify that:
1. The component accepts the new props without TypeScript errors (compile-time).
2. The component renders without throwing when the props are provided (runtime).

Add these test cases inside the existing `describe('SceneReel', ...)` block:

```typescript
it('accepts theme prop without error', () => {
  const { container } = render(
    <SceneReel height={400} plugins={[makePlugin()]} theme={{ family: 'darkGlass', polarity: 'dark' }}>
      <div />
    </SceneReel>,
  );
  expect(container.firstChild).toBeTruthy();
});

it('accepts scrollSource prop without error', () => {
  const containerRef = { current: document.createElement('div') };
  const canvasRef = { current: document.createElement('canvas') };
  const { container } = render(
    <SceneReel
      height={400}
      plugins={[makePlugin()]}
      scrollSource={{ kind: 'viewport-relative', containerRef, canvasRef }}
    >
      <div />
    </SceneReel>,
  );
  expect(container.firstChild).toBeTruthy();
});

it('accepts defaultTransitionDuration prop without error', () => {
  const { container } = render(
    <SceneReel height={400} plugins={[makePlugin()]} defaultTransitionDuration={600}>
      <div />
    </SceneReel>,
  );
  expect(container.firstChild).toBeTruthy();
});

it('accepts defaultTransitionEasing prop without error', () => {
  const { container } = render(
    <SceneReel height={400} plugins={[makePlugin()]} defaultTransitionEasing={(t: number) => t}>
      <div />
    </SceneReel>,
  );
  expect(container.firstChild).toBeTruthy();
});
```

### Acceptance Criteria — WS-1

- [ ] `SceneReelProps` interface includes `theme`, `scrollSource`, `defaultTransitionDuration`, `defaultTransitionEasing`
- [ ] All four props forwarded to `<SceneEngine>` in JSX
- [ ] DEBT comment on line 13 removed
- [ ] Four new test cases pass: `pnpm --filter @brewsite/core vitest run src/player/__tests__/SceneReel.test.tsx`
- [ ] `pnpm --filter @brewsite/core typecheck` passes
- [ ] No other files modified

---

## WS-2: README Update

**Priority:** P0
**Files modified:**
- `packages/core/README.md`

### 2.1 Update Embedded Reel example

The "Embedded reel (docs / slides)" example in `packages/core/README.md` (lines 48–62) currently shows a basic `SceneReel` with `TimeInput`. Update it to demonstrate `defaultTransitionDuration` — a key new capability for the Embedded Player mode.

Replace the existing example (lines 48–62) with:

```tsx
import { SceneReel, TimeInput, Scene, corePlugin } from '@brewsite/core';

export function DemoWidget() {
  return (
    <SceneReel
      height={400}
      plugins={[corePlugin()]}
      defaultTransitionDuration={500}
    >
      <Scene id="step1">...</Scene>
      <Scene id="step2">...</Scene>
      <TimeInput duration={4} loop pauseWhenHidden={{ y: 0.5 }} />
    </SceneReel>
  );
}
```

The only change is adding `defaultTransitionDuration={500}` to the `SceneReel` props. The surrounding markdown text does not need updating — the example already says "Embedded reel (docs / slides)" which is accurate.

### Acceptance Criteria — WS-2

- [ ] README example shows `defaultTransitionDuration` on `SceneReel`
- [ ] No other examples or sections changed
- [ ] Markdown renders correctly

---

## WS-3: Canvas Region Example Page

**Priority:** P2
**Depends on:** WS-1 (uses `theme` prop on `SceneReel`)
**Files created:**
- `apps/examples/src/canvas-region/CanvasRegionPage.tsx` (new)
- `apps/examples/src/canvas-region/scenes/viewerScene.tsx` (new)
- `apps/examples/src/canvas-region/widgetSetup.ts` (new)

**Files modified:**
- `apps/examples/src/App.tsx`

### 3.1 Directory structure

```
apps/examples/src/canvas-region/
├── CanvasRegionPage.tsx      # Page component with split layout
├── widgetSetup.ts            # Plugin factory
└── scenes/
    └── viewerScene.tsx       # Single scene DSL — 3D product viewer
```

### 3.2 `widgetSetup.ts` — Plugin factory

```typescript
// widgetSetup.ts — Plugin setup for Canvas Region example.

import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin } from '@brewsite/themes';

/**
 * Creates the plugin array for the Canvas Region example.
 * Uses diagram elements for the 3D content (no model manifest needed).
 */
export function createCanvasRegionPlugins(): WidgetPlugin[] {
  return [corePlugin(), diagramPlugin(), themesPlugin()];
}
```

**Rationale for diagram over model:** Diagram elements are self-contained and don't require a model manifest or GLTF asset files. This keeps the example zero-config and demonstrates that Canvas Region works with any element type, not just models.

### 3.3 `scenes/viewerScene.tsx` — Single scene DSL

This scene declares a simple 3-node diagram with the default input spec providing orbit, zoom, pan, and reset automatically. No `<InputController>` is hand-authored — the compiler's auto-injection provides the default bindings.

```tsx
// viewerScene.tsx — Single scene for the Canvas Region product viewer example.

import type { JSX } from 'react';
import { Scene } from '@brewsite/core';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  DiagramCanvas,
} from '@brewsite/diagram';

/**
 * A simple 3-node architecture diagram used as the 3D content
 * for the Canvas Region embedding mode example.
 *
 * No <InputController> is declared — the default input spec
 * provides camera orbit, zoom, pan, and reset automatically.
 */
export function ViewerScene(): JSX.Element {
  return (
    <Scene id="viewer">
      <DiagramCanvas
        id="canvas"
        cameraDistance={6}
        cameraAngle={[25, 15]}
      />
      <Diagram
        id="arch-diagram"
        canvasId="canvas"
        theme="darkGlass"
      >
        <DiagramGroup id="backend" label="Backend Services" position={[0, 0, 0]}>
          <DiagramNode id="api" label="API Gateway" shape="roundedRect" icon="server" />
          <DiagramNode id="db" label="Database" shape="cylinder" icon="database" />
        </DiagramGroup>
        <DiagramNode id="client" label="Web Client" shape="roundedRect" icon="monitor" position={[0, 2.5, 0]} />
        <DiagramEdge from="client" to="api" label="HTTPS" />
        <DiagramEdge from="api" to="db" label="SQL" />
      </Diagram>
    </Scene>
  );
}
```

**Key design decisions:**
- Single scene, single `<Scene id="viewer">` — no scene navigation.
- `DiagramCanvas` with explicit camera angle gives a nice 3/4 perspective view.
- No `<InputController>` — relies on the compiler's auto-injection of `createDefaultInputSpec()`. This is the simplest possible Canvas Region configuration and the one we want to showcase.
- Diagram theme is `darkGlass` — matches the page's dark background.

### 3.4 `CanvasRegionPage.tsx` — Page component

The page demonstrates Canvas Region as an embedded 3D viewer within a normal page layout. Uses a CSS flexbox two-column layout: prose/description on the left, 3D canvas on the right.

```tsx
// CanvasRegionPage.tsx — Canvas Region embedding mode example.

import { type JSX, useMemo } from 'react';
import { SceneReel, InputCoordinator } from '@brewsite/core';
import { themes } from '@brewsite/themes';
import { createCanvasRegionPlugins } from './widgetSetup';
import { ViewerScene } from './scenes/viewerScene';

const PAGE_STYLES = {
  wrapper: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#0a0a1a',
    color: '#e0e0e8',
    overflow: 'hidden',
  },
  sidebar: {
    width: '360px',
    flexShrink: 0,
    padding: '2rem',
    overflowY: 'auto' as const,
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
  },
  canvasColumn: {
    flex: 1,
    position: 'relative' as const,
    minWidth: 0,
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: '1rem',
    color: '#fff',
  },
  paragraph: {
    fontSize: '0.9rem',
    lineHeight: 1.7,
    marginBottom: '1rem',
    opacity: 0.75,
  },
  hint: {
    fontSize: '0.8rem',
    lineHeight: 1.5,
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    marginTop: '1.5rem',
  },
} as const;

export default function CanvasRegionPage(): JSX.Element {
  const plugins = useMemo(() => createCanvasRegionPlugins(), []);

  return (
    <div style={PAGE_STYLES.wrapper}>
      {/* Left sidebar — prose content */}
      <aside style={PAGE_STYLES.sidebar}>
        <h1 style={PAGE_STYLES.heading}>Canvas Region</h1>
        <p style={PAGE_STYLES.paragraph}>
          This example demonstrates the <strong>Canvas Region</strong> embedding
          mode — a self-contained interactive 3D viewer embedded within a normal
          page layout.
        </p>
        <p style={PAGE_STYLES.paragraph}>
          The 3D canvas occupies only part of the page. There is no scene
          navigation — the viewer shows a single scene with full camera
          interaction.
        </p>
        <p style={PAGE_STYLES.paragraph}>
          All input bindings are provided automatically by the default input
          spec. No hand-authored <code>&lt;InputController&gt;</code> is needed.
        </p>
        <div style={PAGE_STYLES.hint}>
          <strong>Controls</strong>
          <br />
          Drag to orbit &middot; Shift+drag to pan
          <br />
          Pinch to zoom &middot; Press <kbd>R</kbd> to reset
        </div>
      </aside>

      {/* Right column — 3D canvas */}
      <div style={PAGE_STYLES.canvasColumn}>
        <SceneReel
          height="100vh"
          plugins={plugins}
          theme={themes.darkGlass.dark}
          defaultTransitionDuration={500}
        >
          <ViewerScene />
          {/* InputCoordinator processes the compiled input spec at runtime —
              without it, pointer/keyboard events are not dispatched to the
              ActionInputController and camera interaction is inert. */}
          <InputCoordinator />
        </SceneReel>
      </div>
    </div>
  );
}
```

**Design decisions:**
- Two-column flex layout: sidebar (360px fixed) + canvas (flex: 1). This is the canonical "embedded region within a normal page" pattern described in the note.
- `SceneReel` is the composition surface — demonstrates the convenience wrapper for Canvas Region mode.
- `<InputCoordinator />` is required as a child of `SceneReel`. `SceneReel` renders `SceneCanvas`, `BackgroundLayer`, and `EngineOverlayHost` automatically, but it does NOT include `InputCoordinator`. Without it, the default input spec compiles into the `SceneTrack` but nothing processes it at runtime — pointer/keyboard events are never dispatched.
- `height="100vh"` fills the right column. Width defaults to 100%.
- `theme={themes.darkGlass.dark}` uses the new `theme` prop (requires WS-1). Imported directly in the page component (rather than `widgetSetup.ts`) to make the `theme` prop visible at the composition site — this is a teaching example.
- `defaultTransitionDuration={500}` demonstrates the prop even though there's only one scene — it's a teaching example.
- No `InputHud` — the note explicitly says it ships separately (stub returning null).
- Static inline styles — follows the pattern of other example pages (no CSS modules, no Tailwind).

### 3.5 Wire into `App.tsx` routing

Modify `apps/examples/src/App.tsx` to add the new route:

**Add lazy import** (after the existing lazy imports, before the `Loading` function):
```typescript
const CanvasRegionPage = lazy(() => import('./canvas-region/CanvasRegionPage'));
```

**Add route** (inside `<Routes>`, after the model-showcase route):
```tsx
<Route path="/canvas-region" element={<CanvasRegionPage />} />
```

**Add link** (inside the index route's `<ul>`, after the model-showcase link):
```tsx
<li><a href="/examples/canvas-region">Canvas Region — Embedded 3D Viewer</a></li>
```

### Acceptance Criteria — WS-3

- [ ] `apps/examples/src/canvas-region/` directory exists with 3 files
- [ ] Page renders at `/examples/canvas-region` with sidebar + 3D canvas layout
- [ ] 3D diagram renders with interactive camera (orbit, zoom, pan, reset)
- [ ] No `<InputController>` in the scene DSL — all bindings from default input spec
- [ ] No `<InputHud>` present
- [ ] `pnpm dev` serves the page without errors
- [ ] `pnpm typecheck` passes

---

## WS-4: EngineARContainer Export Alias

**Priority:** P3
**Status:** Pending product authorization. The finalized note (P3) lists three options and explicitly defers the decision to "v1.0 milestone planning session when breaking changes can be batched." This work stream implements option 1 (additive alias, non-breaking) proactively because it is zero-risk (minor version, no removals, aligns with already-shipped `ViewportScaleContext` naming). **However, a developer should not begin this stream until the team lead or PM confirms authorization.**

**Files modified:**
- `packages/core/src/player/EngineARContainer.tsx`
- `packages/core/src/player/index.ts`

**If authorized**, also update the note: change P3 status from "Low urgency" to "Authorized — shipping additive alias `ViewportScaleContainer` in current release" in `requirements/core/notes/note_embedding-modes-cleanup.md`.

### 4.1 Add `ViewportScaleContainer` alias in `EngineARContainer.tsx`

Add a named export alias at the bottom of `EngineARContainer.tsx`, after the `EngineARContainer` component definition (after line 278):

```typescript
/**
 * Alias for EngineARContainer. Provides a clearer name for the component's
 * purpose: a container that manages viewport scaling, aspect ratio locking,
 * and --scene-scale CSS variable injection.
 *
 * Use whichever name is clearer in your context. Both names are stable.
 */
export const ViewportScaleContainer = EngineARContainer;

/** Props for ViewportScaleContainer (alias of EngineARContainerProps). */
export type ViewportScaleContainerProps = EngineARContainerProps;
```

**Rationale for `ViewportScaleContainer`:** Aligns with the already-shipped `ViewportScaleContext` and `ViewportScaleContextValue` names. The naming family becomes `ViewportScale{Context, ContextValue, Container, ContainerProps}` — internally consistent and descriptive.

### 4.2 Export alias from `player/index.ts`

Add the new exports to `packages/core/src/player/index.ts`. Modify the existing EngineARContainer export block (lines 36–41):

Replace:
```typescript
export { EngineARContainer } from './EngineARContainer';
export type {
  EngineARContainerProps, ScaleMode, ViewportScaleContextValue, EngineARContainerContextValue,
} from './EngineARContainer';
export { ViewportScaleContext, EngineARContainerContext } from './EngineARContainer';
export { computeContainerDims } from './EngineARContainer';
```

With:
```typescript
export { EngineARContainer, ViewportScaleContainer } from './EngineARContainer';
export type {
  EngineARContainerProps, ViewportScaleContainerProps,
  ScaleMode, ViewportScaleContextValue, EngineARContainerContextValue,
} from './EngineARContainer';
export { ViewportScaleContext, EngineARContainerContext } from './EngineARContainer';
export { computeContainerDims } from './EngineARContainer';
```

**No deprecation on `EngineARContainer`.** This is a cosmetic alias — both names remain stable. Deprecation is deferred to v3 planning.

### 4.3 No test changes

The alias is a `const` assignment pointing to the same function reference. `ViewportScaleContainer === EngineARContainer` is true at runtime. No behavioral change, no new test needed. The existing `EngineARContainer.test.tsx` covers the component's functionality.

**Optional verification:** A developer may add a one-line assertion if desired:
```typescript
it('ViewportScaleContainer is the same component as EngineARContainer', () => {
  expect(ViewportScaleContainer).toBe(EngineARContainer);
});
```

### Acceptance Criteria — WS-4

- [ ] `ViewportScaleContainer` exported from `@brewsite/core` (player index)
- [ ] `ViewportScaleContainerProps` type exported from `@brewsite/core`
- [ ] `EngineARContainer` remains exported (no removal, no deprecation)
- [ ] `pnpm --filter @brewsite/core typecheck` passes
- [ ] `pnpm --filter @brewsite/core vitest run src/player/__tests__/EngineARContainer.test.tsx` passes (existing tests unaffected)

---

## Full File Change Summary

| File | Stream | Action |
|---|---|---|
| `packages/core/src/player/SceneReel.tsx` | WS-1 | Modify: add 4 props, forward to SceneEngine, remove DEBT comment |
| `packages/core/src/player/__tests__/SceneReel.test.tsx` | WS-1 | Modify: add 4 new test cases |
| `packages/core/README.md` | WS-2 | Modify: update embedded reel example |
| `apps/examples/src/canvas-region/widgetSetup.ts` | WS-3 | Create |
| `apps/examples/src/canvas-region/scenes/viewerScene.tsx` | WS-3 | Create |
| `apps/examples/src/canvas-region/CanvasRegionPage.tsx` | WS-3 | Create |
| `apps/examples/src/App.tsx` | WS-3 | Modify: add route + link |
| `packages/core/src/player/EngineARContainer.tsx` | WS-4 | Modify: add alias export |
| `packages/core/src/player/index.ts` | WS-4 | Modify: add alias re-exports |

**Total:** 6 files modified, 3 files created. No file is touched by more than one work stream.

---

## Verification Commands

After all streams are complete:

```bash
# Type-check all packages
pnpm typecheck

# Run affected tests
pnpm --filter @brewsite/core vitest run src/player/__tests__/SceneReel.test.tsx
pnpm --filter @brewsite/core vitest run src/player/__tests__/EngineARContainer.test.tsx

# Full test suite
pnpm test

# Dev server smoke test
pnpm dev
# → Navigate to /examples/canvas-region and verify:
#   - Sidebar renders with prose content
#   - 3D diagram renders in the right column
#   - Drag to orbit works
#   - Shift+drag to pan works
#   - Pinch to zoom works (on trackpad/mobile)
#   - 'R' key resets camera
```
