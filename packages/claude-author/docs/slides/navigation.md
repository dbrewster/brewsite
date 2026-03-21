---
title: Slide Navigation
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## Default Navigation

`SlidePlayer` pre-wires keyboard, pointer, and touch navigation with no additional configuration. Navigation is active as soon as `SlidePlayer` renders inside a `SceneEngine` context. No `<InputController>` is needed.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { SlidePlayer, Slide, TitleSlide, ContentSlide, slidesPlugin } from '@brewsite/slides';

<SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
  <SlidePlayer>
    <Slide key="intro"><TitleSlide title="Hello" /></Slide>
    <Slide key="body"><ContentSlide title="Content"><Body>Details.</Body></ContentSlide></Slide>
  </SlidePlayer>
</SceneEngine>
```

All navigation channels are enabled by default except mouse wheel. Navigation uses `engine.beginTransition()` internally, which animates through the SceneTrack's dissolve zone between scenes rather than jumping instantly.

---

## Keyboard Navigation

Keyboard navigation is window-scoped by default. The following keys are bound:

| Key | Action |
|---|---|
| `ArrowRight`, `ArrowDown`, `Space`, `Enter`, `PageDown` | Next slide |
| `ArrowLeft`, `ArrowUp`, `PageUp` | Previous slide |
| `Home` | First slide |
| `End` | Last slide |
| `F` | Toggle fullscreen |

Keyboard events are ignored when the active element is an `<input>`, `<textarea>`, or `<select>`. The handler calls `e.preventDefault()` on all matched keys.

---

## Pointer Navigation

Pointer navigation uses a transparent overlay `<div>` covering the entire `SlidePlayer` container:

- **Click** (left button) -- navigates to the next slide.
- **Right-click** (context menu) -- navigates to the previous slide. The default context menu is suppressed via `e.preventDefault()`.

---

## Touch Navigation

Touch swipe navigation listens on the `window`:

- **Swipe left** (finger moves left) -- next slide.
- **Swipe right** (finger moves right) -- previous slide.

The minimum swipe threshold is 40 pixels. Swipes shorter than 40px are ignored.

---

## Mouse Wheel

Mouse wheel navigation is **disabled by default**. Enable it via the `navigation` prop:

```tsx
<SlidePlayer navigation={{ wheel: true }}>
  <Slide key="intro"><TitleSlide title="Hello" /></Slide>
</SlidePlayer>
```

---

## SlideNavigationConfig Type

The `SlideNavigationConfig` type controls which navigation channels are active. All boolean fields default to `true` except `wheel` which defaults to `false`.

```ts
import type { SlideNavigationConfig } from '@brewsite/slides';

type SlideNavigationConfig = {
  /** Enable keyboard navigation (window-scoped). Default: true. */
  keyboard?: boolean;
  /** Enable pointer navigation (click -> next, right-click -> prev). Default: true. */
  pointer?: boolean;
  /** Enable touch swipe navigation. Default: true. */
  touch?: boolean;
  /** Enable mouse wheel navigation. Default: false. */
  wheel?: boolean;
  /** Keyboard scope. 'window' = global listener; 'canvas' = listener on the engine container. Default: 'window'. */
  scope?: 'window' | 'canvas';
};
```

Note: `scope: 'canvas'` currently falls back to `'window'` in the implementation. Both values produce window-scoped keyboard listeners.

---

## Disabling Navigation Channels

Disable specific navigation channels by setting them to `false`. Useful for embedding slides in a page where click or touch should be handled by the surrounding UI:

```tsx
<SlidePlayer navigation={{ pointer: false, touch: false }}>
  <Slide key="intro"><TitleSlide title="Keyboard Only" /></Slide>
  <Slide key="body"><ContentSlide title="Content"><Body>Navigate with arrow keys.</Body></ContentSlide></Slide>
</SlidePlayer>
```

To disable all built-in navigation and control slides programmatically:

```tsx
<SlidePlayer navigation={{ keyboard: false, pointer: false, touch: false }}>
  {/* Use SlidePlayerHandle or useSlideNavigation for programmatic control */}
</SlidePlayer>
```

---

## Progress Indicator

The `ProgressStyle` type controls the visual style of the slide progress indicator. Set it via the `progressIndicator` prop on `SlidePlayer`:

```ts
import type { ProgressStyle } from '@brewsite/slides';

type ProgressStyle = 'dots' | 'bar' | 'numbers' | 'none';
```

- **`'dots'`** -- Clickable dot per slide. Clicking a dot navigates to that slide. This is the default.
- **`'bar'`** -- Thin progress bar at the top of the player.
- **`'numbers'`** -- Text counter showing "N / total".
- **`'none'`** -- No progress indicator rendered.

```tsx
<SlidePlayer progressIndicator="bar">
  <Slide key="a"><TitleSlide title="One" /></Slide>
  <Slide key="b"><ContentSlide title="Two"><Body>Content.</Body></ContentSlide></Slide>
  <Slide key="c"><TitleSlide title="Three" /></Slide>
</SlidePlayer>
```

The progress indicator style can also be set via `SlideTemplate.defaultProgressIndicator`, which is overridden by the `progressIndicator` prop when both are present.

---

## useSlideNavigation Hook

The `useSlideNavigation` hook returns reactive navigation state. It must be called inside a `SceneEngine` context (i.e., inside a component rendered as a descendant of `SceneEngine`).

```ts
import { useSlideNavigation } from '@brewsite/slides';
import type { SlideNavigationState } from '@brewsite/slides';

type SlideNavigationState = {
  /** 0-based current logical slide index. */
  current: number;
  /** Total logical slide count. */
  total: number;
  /** Navigate to the slide at the given 0-based index. */
  goTo: (index: number) => void;
  /** Navigate to the next slide. No-op on last slide. */
  next: () => void;
  /** Navigate to the previous slide. No-op on first slide. */
  prev: () => void;
};
```

Usage inside a custom navigation component:

```tsx
import { useSlideNavigation } from '@brewsite/slides';

function CustomNav({ totalSlides, scrollUnits }: { totalSlides: number; scrollUnits: number[] }) {
  const nav = useSlideNavigation(totalSlides, scrollUnits);
  return (
    <div>
      <span>Slide {nav.current + 1} of {nav.total}</span>
      <button onClick={nav.prev}>Prev</button>
      <button onClick={nav.next}>Next</button>
    </div>
  );
}
```

Navigation internally uses engine-space progress (`index / (totalSlides - 1)`) and `engine.beginTransition()` so that transition animations play correctly.

---

## computeSlideStartProgress

A pure utility function that computes the normalized scroll-space progress `[0, 1]` for the start of a slide at a given index. Useful when syncing a custom scroll source with slide positions.

```ts
import { computeSlideStartProgress } from '@brewsite/slides';

function computeSlideStartProgress(scrollUnits: number[], index: number): number;
```

```ts
const scrollUnits = [100, 400, 400, 100]; // 4 slides
const startOfSlide2 = computeSlideStartProgress(scrollUnits, 2);
// startOfSlide2 = (100 + 400) / (100 + 400 + 400 + 100) = 0.5
```

Note: this returns raw scroll-space progress, not engine-space progress. For programmatic navigation via `engine.beginTransition()`, use `index / (totalSlides - 1)` directly.

---

## Fullscreen

`SlidePlayer` supports fullscreen mode via the Fullscreen API:

- **Controlled**: set `fullscreen={true}` to force fullscreen. Use `onFullscreenChange` to track state.
- **Uncontrolled**: set `defaultFullscreen={true}` for initial fullscreen on mount.
- **Keyboard**: press `F` to toggle fullscreen (requires `keyboard` navigation to be enabled).

```tsx
import { useState } from 'react';

function FullscreenDeck() {
  const [fs, setFs] = useState(false);
  return (
    <>
      <button onClick={() => setFs(!fs)}>{fs ? 'Exit' : 'Fullscreen'}</button>
      <SlidePlayer fullscreen={fs} onFullscreenChange={setFs}>
        <Slide key="a"><TitleSlide title="Fullscreen Demo" /></Slide>
      </SlidePlayer>
    </>
  );
}
```

When fullscreen is active, the container is positioned with `position: fixed; inset: 0; z-index: 9999`.

---

## Imperative Handle

`SlidePlayer` exposes a `SlidePlayerHandle` via `React.forwardRef`. Use it for programmatic navigation and canvas snapshot capture.

```ts
import type { SlidePlayerHandle } from '@brewsite/slides';

interface SlidePlayerHandle {
  goTo(index: number): void;
  next(): void;
  prev(): void;
  captureSlideSnapshots(): Promise<Map<string, string>>;
}
```

Usage:

```tsx
import { useRef } from 'react';
import type { SlidePlayerHandle } from '@brewsite/slides';
import { SlidePlayer, Slide, TitleSlide, ContentSlide } from '@brewsite/slides';

function ControlledDeck() {
  const ref = useRef<SlidePlayerHandle>(null);

  return (
    <>
      <button onClick={() => ref.current?.goTo(0)}>First Slide</button>
      <button onClick={() => ref.current?.prev()}>Prev</button>
      <button onClick={() => ref.current?.next()}>Next</button>

      <SlidePlayer ref={ref} navigation={{ pointer: false }}>
        <Slide key="intro"><TitleSlide title="Intro" /></Slide>
        <Slide key="body"><ContentSlide title="Body"><Body>Content here.</Body></ContentSlide></Slide>
        <Slide key="close"><TitleSlide title="End" /></Slide>
      </SlidePlayer>
    </>
  );
}
```

The `onSlideChange` callback fires when the active slide changes, providing the 0-based index and slide key:

```tsx
<SlidePlayer onSlideChange={(index, slideKey) => console.log(`Now on slide ${index}: ${slideKey}`)}>
  ...
</SlidePlayer>
```
