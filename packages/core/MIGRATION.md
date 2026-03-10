# @brewsite/core v1 → v2 Migration Guide

This guide documents all breaking changes in `@brewsite/core` v2.0.0 and provides
direct migration patterns for every removed or changed API.

---

## Overview of Changes

v2 replaces the monolithic `EngineProvider` + `EngineInputRegion` pattern with a set
of composable primitives:

| v1 | v2 |
|---|---|
| `EngineProvider` | `SceneEngine` |
| `EngineInputRegion` (scroll mode) | `ScrollStage` + `ScrollInput source="window"` |
| `EngineInputRegion` (direct mode) | `SceneReel` + `ControlledInput` |
| `ScrollCaptureSection` | `ScrollStage` + `ScrollInput source="window"` |
| `useEngineScroll` | `ScrollInput` (internalized) |
| `useEngineInput` | `ScrollInput` + `KeyboardInput` (internalized) |
| `InputModePolicy` | Explicit: which input components you render determines input mode |
| `ScrollSource` | `IScrollSource`, `ScrollSourceProp` |
| `useSceneEngineState(id)` | `useEngineState(id)` (unified hook) |
| `engine.scrollToProgress(p)` | `engine.setProgress(p)` |

---

## Component Migration

### `EngineProvider` → `SceneEngine`

`SceneEngine` is a pure React context provider with zero DOM output. It no longer
accepts scroll/input-related props; those move to the new input components.

```tsx
// BEFORE (v1):
<EngineProvider
  plugins={plugins}
  pixelsPerScene={1400}
  inputModePolicy="prefer-scroll"
  onError={handleError}
>
  {scenes}
  <EngineInputRegion>
    <SceneCanvas />
    <EngineOverlayHost />
  </EngineInputRegion>
</EngineProvider>

// AFTER (v2):
<SceneEngine plugins={plugins} onError={handleError}>
  {scenes}
  <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
    <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
    <SceneCanvas />
    <ScrollInput source="window" />
    <KeyboardInput />
    <EngineOverlayHost />
  </ScrollStage>
</SceneEngine>
```

**Removed props from `EngineProvider`** (do not exist on `SceneEngine`):
- `scrollSource` → use `<ScrollInput source={...} />`
- `scrollHeightMode` → use `<ScrollStage scrollHeightMode="..." />`
- `pixelsPerScrollUnit` → use `<ScrollStage pixelsPerScrollUnit={...} />`
- `pixelsPerScene` → use `<ScrollStage pixelsPerScene={...} />`
- `scrollHeightPx` → use `<ScrollStage scrollHeightPx={...} />`
- `inputModePolicy` → render appropriate `<...Input>` components explicitly
- `inputMap` → pass to `<KeyboardInput inputMap={...} />`
- `controlledProgress` → use `<ControlledInput value={...} />`
- `onControlledProgressChange` → use `<ControlledInput onChange={...} />`
- `enableKeyboardInControlledMode` → add `<KeyboardInput />` alongside `<ControlledInput />`
- `controlledInputMap` → pass to `<KeyboardInput inputMap={...} />`
- `quality` / `fpsCap` / `framesPerTick` → use `timingProfile` object:
  ```tsx
  // BEFORE: quality="high" fpsCap={60} framesPerTick={4}
  // AFTER:  timingProfile={{ qualityPreset: 'high', fpsCap: 60, blockSize: 4 }}
  ```

---

### `EngineInputRegion` → `ScrollStage` (scroll mode)

```tsx
// BEFORE (v1) — scroll mode:
<EngineInputRegion>
  <SceneCanvas />
  <EngineOverlayHost />
</EngineInputRegion>

// AFTER (v2):
<ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
  <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
  <SceneCanvas />
  <ScrollInput source="window" />
  <KeyboardInput />
  <EngineOverlayHost />
</ScrollStage>
```

For scroll-units mode:
```tsx
<ScrollStage scrollHeightMode="scroll-units" pixelsPerScrollUnit={1}>
  ...
</ScrollStage>
```

For exact pixel height:
```tsx
<ScrollStage scrollHeightPx={TOTAL_SCROLL_HEIGHT}>
  ...
</ScrollStage>
```

---

### `EngineInputRegion fillContainer` → `SceneReel` (embedded mode)

```tsx
// BEFORE (v1) — controlled/fill-container mode:
const [progress, setProgress] = useState(0);
<EngineProvider plugins={plugins} controlledProgress={progress} onControlledProgressChange={setProgress}>
  {children}
  <EngineInputRegion fillContainer>
    <SceneCanvas />
    <EngineOverlayHost />
  </EngineInputRegion>
</EngineProvider>

// AFTER (v2):
const [progress, setProgress] = useState(0);
<SceneReel height={400} plugins={plugins}>
  {children}
  <ControlledInput value={progress} onChange={setProgress} />
</SceneReel>
```

---

### `ScrollCaptureSection` → `ScrollStage`

`ScrollCaptureSection` is deleted. Use `ScrollStage` directly:

```tsx
// BEFORE: <ScrollCaptureSection scrollHeightPx={N}>...</ScrollCaptureSection>
// AFTER:  <ScrollStage scrollHeightPx={N}>...</ScrollStage>
```

---

## Hook Migration

### `useSceneEngineState(id)` → `useEngineState(id)`

The separate `useSceneEngineState(id)` hook is deleted. Use the unified `useEngineState(id)`:

```tsx
// BEFORE (v1):
import { useSceneEngineState } from '@brewsite/core';
const state = useSceneEngineState('my-engine');

// AFTER (v2):
import { useEngineState } from '@brewsite/core';
const state = useEngineState('my-engine'); // same behavior; returns null when not mounted
```

The no-argument form is unchanged:
```tsx
// Unchanged — reads from nearest ancestor SceneEngine:
const state = useEngineState();
```

---

### `engine.scrollToProgress(p)` → `engine.setProgress(p)`

`scrollToProgress` is deleted from the engine context. Use `setProgress` or `useGoToScene`:

```tsx
// BEFORE:
engine.scrollToProgress(0.5);

// AFTER — for direct progress writes:
engine.setProgress(0.5);

// AFTER — for programmatic scene navigation (recommended; syncs scroll source):
const goToScene = useGoToScene();
goToScene('scene-id');      // by scene id
goToScene(2);               // by scene index
```

---

### `useEngineScrubber`

The options object has been removed. The hook now reads the engine context directly
and requires no arguments. Call it as a plain hook inside a `<SceneEngine>` descendant.

#### Before (v1)
```typescript
const engine = useSceneEngineContext();
const { isScrubbing, startScrub, stopScrub, setProgress } = useEngineScrubber({
  scrollToProgress: (p) => { engine.scrollToProgress(p); },
  getGlobalProgress: () => engine.progress,
});
```

#### After (v2)
```typescript
// No options — hook reads engine context automatically.
// Must be called inside a <SceneEngine> tree.
const { isScrubbing, startScrub, stopScrub, setProgress } = useEngineScrubber();
// setProgress(p) calls engine.setProgress(p) internally.
```

**Note:** The `progress` field has been removed from `UseEngineScrubberResult`.
Read `engine.progress` from `useSceneEngineContext()` directly instead.

---

## Type Migration

### `InputModePolicy` → deleted

`InputModePolicy` ('prefer-scroll' | 'direct') is deleted. The input mode is now
determined by which input components you render — there is no type for this concept.

### `ScrollSource` → `IScrollSource`, `ScrollSourceProp`

`ScrollSource` is deleted. Replace with:
- `IScrollSource` — interface for custom scroll source implementations
- `ScrollSourceProp` — union type for the `source` prop on `<ScrollInput>`

---

## New Patterns

### Full-page marketing scroll

```tsx
<SceneEngine plugins={plugins}>
  {scenes}
  <EngineARContainer aspectRatio={16/9}>
    <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
      <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <ScrollInput source="window" />
      <KeyboardInput />
      <EngineOverlayHost />
    </ScrollStage>
  </EngineARContainer>
</SceneEngine>
```

### Embedded reel (docs/slides)

```tsx
<SceneReel height={400} plugins={plugins}>
  <Scene id="demo">...</Scene>
  <TimeInput duration={4} loop pauseWhenHidden={{ y: 0.5 }} />
</SceneReel>
```

### Slide deck (keyboard navigation)

```tsx
<SceneReel height={600} plugins={plugins}>
  {slides}
  <KeyboardInput />
</SceneReel>
```

### Complex layout with sidebar nav

```tsx
<SceneEngine plugins={plugins}>
  {scenes}
  <div style={{ display: 'flex' }}>
    <Sidebar />  {/* calls useGoToScene() */}
    <SceneCanvas style={{ flex: 1 }} />
  </div>
  <ScrollInput source="inertia" />
</SceneEngine>
```

### App-level plugin hoisting (root zero-scene mode)

```tsx
// Root layout: provides plugins for all nested reels
<SceneEngine plugins={[corePlugin(), modelPlugin({ manifestUrl }), diagramPlugin()]}>
  <App />  {/* contains multiple SceneReel children — all inherit plugins */}
</SceneEngine>

// Anywhere nested (plugins inherited automatically):
<SceneReel height={400}>
  <Scene id="demo">...</Scene>
  <TimeInput duration={4} loop />
</SceneReel>
```
