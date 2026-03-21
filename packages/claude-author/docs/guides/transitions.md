---
title: Transitions
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-21
---

## What Transitions Are

Transitions are declarative descriptions of how state changes between scenes. You do not write animation code. You do not compute interpolated values. You describe how an element should behave as two adjacent scenes blend together, and the compiler bakes that behavior into the pre-computed `SceneTrack`.

The compiler inserts a "transition block" between every adjacent pair of scenes. Each transition block is a short sequence of ticks covering the overlap region. During that block, each widget's compiled transition spec determines how its state evolves from the Scene N value to the Scene N+1 value.

## Transition Types

There are two scene-level named transition types, plus a raw escape hatch.

### `'dissolve'` (default)

The outgoing scene holds at full opacity until `exitStart`, then fades to nothing. The incoming scene fades in symmetrically.

```tsx
// Default — dissolve with exitStart=0.8
<Scene id="scene-two">...</Scene>

// Explicit — dissolve, fade starts at 90%
<Scene id="scene-two" exitStart={0.9}>...</Scene>

// Explicit named
<Scene id="scene-two" transition="dissolve" exitStart={0.7}>...</Scene>
```

`exitStart` is the normalized block progress (0–0.99) at which the outgoing scene begins fading. Default is `0.8`. Higher values mean the outgoing scene stays opaque longer — useful for scenes with long stable holds before the cut.

### `'crossfade'`

Equal-blend. Both scenes simultaneously visible across the entire transition block. Outgoing opacity goes from 1→0 while incoming opacity goes from 0→1. They sum to 1.0 at every moment.

```tsx
<Scene id="scene-two" transition="crossfade">...</Scene>
```

When `transition="crossfade"`, the `exitStart` prop is not valid (TypeScript will error).

### Raw `TransitionWindow` escape hatch

You can pass a raw `TransitionWindow` object to override the window geometry entirely:

```tsx
<Scene id="scene-two" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
  ...
</Scene>
```

`exit` and `enter` are each `[start, end]` ranges within the block's normalized [0, 1] progress. Use this for custom overlap timing that `dissolve` and `crossfade` don't cover.

## Entry vs Exit Transitions — Critical Rule

**Entry transitions belong to the INCOMING scene. Always.**

This is the single most commonly misunderstood aspect of the BrewSite transition system. Read this carefully.

The `transition` prop on `<Scene>` configures the transition block that brings elements INTO that scene. When Scene 2 begins, it is Scene 2's `transition` prop that controls how elements fade in.

**Wrong — authoring the fade on the outgoing scene:**

```tsx
// WRONG: This configures Scene 1's exit, which doesn't exist as a separate concept.
// Scene 1 has no "outgoing transition" prop — the transition block belongs to Scene 2.
<Scene id="scene-one" transition="crossfade">
  <Model id="hero" ... />
</Scene>

<Scene id="scene-two">
  <Model id="hero" ... opacity={0} />   // wrong: model just disappears
</Scene>
```

**Correct — authoring the transition on the incoming scene:**

```tsx
<Scene id="scene-one">
  <Model id="hero" ... opacity={1} />
</Scene>

// transition="crossfade" here controls how scene-two's elements blend in
<Scene id="scene-two" transition="crossfade">
  <Model id="hero" ... opacity={1} />
</Scene>
```

The same rule applies to per-element `<Transition>` children. A `<Transition enter={{ window: [0.7, 1] }}>` placed on an element in Scene 2 controls how that element fades in when entering Scene 2.

**How to remember it:** "The incoming scene owns its own arrival."

## ProgressManager

`ProgressManager` declares per-scene scroll budget, auto-advance behavior, and animation time scale. Place it inside a `<Scene>` to override defaults.

```tsx
import { ProgressManager, Scene } from '@brewsite/core';

<Scene id="hero-scene">
  <ProgressManager
    scrollUnits={1800}
    autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
    animationTimeScale={3}
  />
  {/* ... rest of scene */}
</Scene>
```

### ProgressManager Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `scrollUnits` | `number` | `1` | Proportional scroll budget for this scene. Unitless — relative to all other scenes. A scene with `scrollUnits={2}` gets twice the scroll travel. |
| `fn` | `(localT: number) => number` | identity | Input pacing curve. Maps raw scroll progress to engine progress within this scene. Must satisfy `fn(0)=0`, `fn(1)=1`, monotonically non-decreasing. |
| `animationTimeScale` | `number` | — | Total animation-seconds when user scrolls through the scene in one pass. Animations play at 1× real-time while idle. |
| `autoAdvance` | `object` | — | Auto-advances scene progress on a wall-clock timer when user is idle. |
| `transitionDuration` | `number` | engine default (400ms) | Duration in ms for programmatic (keyboard/button) transitions from this scene. |
| `transitionEasing` | `TransitionEasing` | cubic ease-in-out | Easing for programmatic transitions from this scene. |

**Carry-forward semantics:** If a scene omits `<ProgressManager>`, it inherits the previous scene's settings. The ultimate default is `{ scrollUnits: 1, fn: identity }`.

### autoAdvance

```tsx
<ProgressManager
  autoAdvance={{
    duration: 8,         // seconds to advance from 0 to max
    max: 0.80,           // only auto-advance to 80% of this scene
    pauseOnScroll: true, // stop auto-advancing after user scrolls
  }}
/>
```

Auto-advance pauses whenever the user scrolls. Setting `pauseOnScroll: false` makes it run continuously.

## Per-Element Transition Props via `<Transition>`

The `<Transition>` DSL component is a child of renderable elements (`<Model>`, `<ImagePanel>`, `<Screen>`, `<Diagram>`, `<BarChart>`, `<LineChart>`, `<PieChart>`, `<AreaChart>`, `<ScatterPlotChart>`, `<HeatMapChart>`, etc.). It declares per-channel timing and easing for that element's transition behavior.

```tsx
import { Transition, easeOutCubic } from '@brewsite/core';

<Model id="hero" type="Robot" x={"50%"} y={"50%"} w={"60%"} h={"80%"}>
  <Transition
    enter={{ window: [0.7, 1.0], ease: easeOutCubic }}
    exit={{ window: [0.0, 0.3], ease: easeOutCubic }}
  />
</Model>
```

### TransitionProps

| Prop | Type | Description |
|---|---|---|
| `channels` | `string[]` | Channel names this group controls. Omit for default group (applies to all channels). |
| `exit` | `TransitionPhase` | When/how the element fades out as the scene exits. |
| `enter` | `TransitionPhase` | When/how the element fades in as the scene enters. |
| `interpolate` | `{ ease?: EaseFn }` | Easing for present-in-both-scenes interpolation. |

### TransitionPhase

```tsx
type TransitionPhase = {
  window?: [number, number]; // Sub-range [start, end] within block progress [0,1]
  ease?: EaseFn;             // Applied after window normalization
}
```

`window` lets you stagger elements: one element fades in during `[0.5, 0.8]` while another fades in during `[0.7, 1.0]`. Useful for choreographed arrivals.

### Channel-Specific Transitions

Use multiple `<Transition>` elements with `channels` to give different properties different timing:

```tsx
<Model id="hero" type="Robot" ...>
  {/* Opacity fades in fast */}
  <Transition
    channels={['opacity']}
    enter={{ window: [0.5, 0.8], ease: easeOutCubic }}
  />
  {/* Position slides in slower */}
  <Transition
    channels={['position']}
    enter={{ window: [0.4, 1.0], ease: easeOutExpo }}
  />
</Model>
```

A `<Transition>` without `channels` is the "default group" — it applies to all channels not claimed by a named group.

## Transition Easing

These easing functions are exported from `@brewsite/core`:

| Export | Behavior |
|---|---|
| `easeLinear` | Constant rate — `f(t) = t` |
| `easeOutCubic` | Fast start, smooth deceleration — `f(t) = 1 - (1-t)³` |
| `easeOutExpo` | Exponential deceleration, sharp snap to rest |
| `easeInOutSine` | Sinusoidal symmetric in/out |
| `easeInOutCubic` | Cubic symmetric in/out (engine default for programmatic transitions) |
| `easeInSquared` | Starts slow, accelerates — `f(t) = t²` |
| `easeOutQuart` | Smooth quartic deceleration — `f(t) = 1 - (1-t)⁴` |

```tsx
import { easeOutCubic, easeInOutSine } from '@brewsite/core';

<Model id="hero" ...>
  <Transition enter={{ window: [0.6, 1.0], ease: easeOutCubic }} />
</Model>
```

You can also supply any `(t: number) => number` function that satisfies `f(0)=0`, `f(1)=1`.
