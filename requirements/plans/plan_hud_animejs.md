---
title: "HUD Children API and AnimeJS Transition Sub-module"
doc_type: plan
owner: brewflow-architect
status: active
updated: 2026-02-23
---

# HUD Children API and AnimeJS Transition Sub-module

## Overview

The HUD overlay system is implemented (see `requirements/plans/archive/plan_hud_overlay.md`).
This plan makes two changes to it and adds a new sub-module.

**Change 1 — `node` → `children`.** `HudItemDefinition.node: ReactNode` is renamed to
`children: ReactNode`. The DSL `<HudItem>` accepts its content between the tags rather
than as a prop. This is idiomatic React and removes an awkward double-bracket syntax.
This is a targeted change across five files — types, renderer, DSL block, and their tests.

**Change 2 — `src/hud/animejs/` sub-module.** A new opt-in sub-module provides six
scroll-driven transition preset components (`<Fade>`, `<MidFade>`, `<SlideUp>`,
`<SlideDown>`, `<ScrollOn>`, `<ScrollOff>`) and the primitive hook (`useScrollTimeline`)
that powers them. These components are used directly as `children` of a DSL `<HudItem>`.
They require zero changes to the compiler pipeline, `HudItemDefinition`, `HudItem`,
or `HudOverlay`.

---

## How the transitions work (design rationale)

`HudItemDefinition.children` is a `ReactNode`. The DSL compiler stores it as an opaque
JS object at compile time and never traverses it. React renders it lazily when
`HudOverlay` mounts `<HudItem>`. By that point the component tree is inside
`<ScenePlayer>`, which provides `EngineStateContext`. Any component placed as `children`
— including `<SlideUp>` — can therefore call `useEngineState()` and read `sceneProgress`
at render time, driving an animejs timeline via `.seek()`.

**Critical rule:** children of `<HudItem>` are **not** traversed by the DSL compiler.
The DSL `HudItem` handler is a leaf — it captures `props.children` and does not call
`helpers.compileChildren`. Do not place widget DSL components (`<Model>`, `<Lighting>`,
etc.) inside `<HudItem>` — they will not compile.

---

## File Inventory

### Change 1: Files to MODIFY (5 files)

| Path | Change |
|------|--------|
| `src/hud/types.ts` | Rename `node` → `children` in `HudItemDefinition` and `HudItemResolved` |
| `src/hud/HudItem.tsx` | Render `item.children` instead of `item.node` |
| `src/compiler/blocks/hudBlocks.tsx` | `HudItemDslProps`: `node: ReactNode` → `children?: ReactNode`; update handler |
| `src/hud/__tests__/HudItem.test.tsx` | Update factory and prop references |
| `src/compiler/__tests__/hudBlocks.test.tsx` | Update prop syntax to children syntax |

### Change 2: Files to CREATE (5 files)

| Path | Purpose |
|------|---------|
| `src/hud/animejs/useScrollTimeline.ts` | Shared hook: build anime timeline, seek to sceneProgress |
| `src/hud/animejs/transitions.tsx` | Six preset transition components |
| `src/hud/animejs/index.ts` | Public barrel — opt-in, not re-exported from `src/hud/index.ts` |
| `src/hud/animejs/__tests__/useScrollTimeline.test.ts` | Hook contract tests |
| `src/hud/animejs/__tests__/transitions.test.tsx` | Preset component smoke tests |

---

## Section 1 — Change 1: `node` → `children`

### 1.1 `src/hud/types.ts`

Field rename only. Type stays `ReactNode`.

```typescript
// Defines the HUD item data contracts: HudItemDefinition (authored) and HudItemResolved (compiled/rendered).

import type { CSSProperties, ReactNode } from 'react';

/**
 * An authored HUD item definition. Written by scene authors inside <HudItem>.
 * Stored on SceneFrame.hudItems during compilation.
 */
export type HudItemDefinition = {
  /** Stable identifier. Used for React keying and data-hud-id DOM attribute. */
  id: string;
  /** When false, excluded from compiled output. Defaults to true. */
  enabled?: boolean;
  /** Optional CSS class applied to the root div. */
  className?: string;
  /** Optional inline styles. All positioning is CSS-owned by the consumer. */
  style?: CSSProperties;
  /**
   * React content for this HUD slot. Passed as JSX children between the tags.
   * May be any ReactNode — including animejs transition wrappers from src/hud/animejs/.
   * Stored as an opaque JS object by the compiler; rendered lazily by React inside ScenePlayer.
   */
  children: ReactNode;
};

/**
 * Compiled/resolved HUD item. Currently a pass-through of HudItemDefinition.
 * Reserved as the stable seam for future defaulting logic in hudCompiler.ts.
 */
export type HudItemResolved = HudItemDefinition;
```

### 1.2 `src/hud/HudItem.tsx`

```tsx
// Renders a single resolved HUD item as a positioned DOM container.

import type { ReactElement } from 'react';
import type { HudItemResolved } from './types';

export type HudItemProps = {
  item: HudItemResolved;
};

/**
 * Renders a single HUD item as a div with data-hud-id, className, and style.
 * Returns null when enabled === false (defensive — compiler already filters these).
 */
export const HudItem = ({ item }: HudItemProps): ReactElement | null => {
  if (item.enabled === false) return null;
  return (
    <div
      data-hud-id={item.id}
      className={item.className}
      style={item.style}
    >
      {item.children}
    </div>
  );
};
```

### 1.3 `src/compiler/blocks/hudBlocks.tsx`

`HudItem` DSL becomes a proper JSX container — content goes between the tags.
The handler does **not** call `helpers.compileChildren`; `props.children` is captured
as-is and stored verbatim in `HudItemDefinition`.

```tsx
// DSL authoring components for the HUD overlay system.
// <Hud> compiles its children as DSL. <HudItem> is a leaf — its children are React
// content captured verbatim, not traversed by the compiler.

import type { CSSProperties, ReactNode } from 'react';
import { registerNode } from '../registry';
import type { HudItemDefinition } from '../../hud/types';
import type { CompileApi, CompileHelpers } from '../sceneDslTypes';

export type HudProps = {
  children?: ReactNode;
};

export type HudItemDslProps = {
  /** Stable identifier. Used for React keying and data-hud-id DOM attribute. */
  id: string;
  /** When false, item is excluded from compiled hudPrimitives. Defaults to true. */
  enabled?: boolean;
  /** Optional CSS class applied to the rendered HudItem container. */
  className?: string;
  /** Optional inline styles. Positioning is fully CSS-owned. */
  style?: CSSProperties;
  /**
   * React content. Passed as JSX children between the tags — not as a prop.
   * May include animejs transition wrappers. Not compiled as DSL.
   */
  children?: ReactNode;
};

/** Container DSL component. Compiles its children as DSL nodes. */
export const Hud = (_props: HudProps) => null;
Hud.displayName = 'Hud';

/**
 * Leaf DSL component for a single HUD item.
 * Place content as JSX children — captured as React content, never compiled as DSL.
 */
export const HudItem = (_props: HudItemDslProps) => null;
HudItem.displayName = 'HudItem';

registerNode(Hud, (node: import('react').ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  helpers.compileChildren(node, api);
});

registerNode(HudItem, (node: import('react').ReactElement, api: CompileApi) => {
  // Leaf: do NOT call helpers.compileChildren — children are React content, not DSL.
  const props = node.props as HudItemDslProps;
  const def: HudItemDefinition = {
    id: props.id,
    children: props.children ?? null,
  };
  if (props.enabled !== undefined) def.enabled = props.enabled;
  if (props.className !== undefined) def.className = props.className;
  if (props.style !== undefined) def.style = props.style;
  api.pushHudItem(def);
});
```

### 1.4 `src/hud/__tests__/HudItem.test.tsx` — updated factory and assertions

Replace the `item()` factory and any `node` references:

```tsx
// Replace:
const item = (overrides?: Partial<HudItemResolved>): HudItemResolved => ({
  id: 'test-item',
  node: <span>Hello</span>,
  ...overrides,
});

// With:
const item = (overrides?: Partial<HudItemResolved>): HudItemResolved => ({
  id: 'test-item',
  children: <span>Hello</span>,
  ...overrides,
});
```

All individual test overrides follow the same pattern:

```tsx
// was: item({ node: <span>World</span> })
item({ children: <span>World</span> })

// was: item({ node: null, enabled: false })
item({ children: null, enabled: false })

// was: item({ node: null, className: 'my-hud' })
item({ children: null, className: 'my-hud' })

// was: item({ node: null, style: { top: '50px' } })
item({ children: null, style: { top: '50px' } })
```

### 1.5 `src/compiler/__tests__/hudBlocks.test.tsx` — updated DSL syntax

Replace all `<HudItem ... node={...} />` with children syntax:

```tsx
// was:
<HudItem id="banner" node={<span>Hello</span>} />

// now:
<HudItem id="banner">
  <span>Hello</span>
</HudItem>

// was:
<HudItem id="a" node={null} />
<HudItem id="b" node={null} />

// now:
<HudItem id="a" />
<HudItem id="b" />

// was:
<HudItem id="x" node={null} enabled={false} className="my-cls" style={style} />

// now:
<HudItem id="x" enabled={false} className="my-cls" style={style} />
```

If any test asserts on `frame.hudItems?.[0]?.node`, update to `frame.hudItems?.[0]?.children`.

### 1.6 Updated authoring syntax

```tsx
// Before:
<HudItem id="headline" node={<h2>Our Mission</h2>} />

// After:
<HudItem id="headline">
  <h2>Our Mission</h2>
</HudItem>

// With animejs transition:
<HudItem id="headline">
  <SlideUp>
    <h2>Our Mission</h2>
  </SlideUp>
</HudItem>
```

---

## Section 2 — Change 2: `src/hud/animejs/` sub-module

### Module structure

```
src/hud/animejs/
  useScrollTimeline.ts
  transitions.tsx
  index.ts
  __tests__/
    useScrollTimeline.test.ts
    transitions.test.tsx
```

`src/hud/index.ts` does **not** re-export anything from `src/hud/animejs/`. Importing
animejs is a runtime cost and a DOM requirement — not every consumer pays it.

Dependency direction (no circular deps):
```
src/hud/animejs/ → src/hud/types.ts              (types only, no runtime dep added)
src/hud/animejs/ → src/player/EngineStateContext  (for useEngineState)
src/hud/animejs/ → animejs                        (animation library)
src/hud/ core    → (nothing from animejs/)        ✅ core stays pure
```

---

### 2.1 `src/hud/animejs/useScrollTimeline.ts`

The shared primitive. Builds an `autoplay: false` anime timeline via `useLayoutEffect`
(so the DOM ref is populated) and seeks it to `sceneProgress × totalDuration` via
`useEffect` on every engine tick. Uses a `buildRef` pattern so the builder closure
always sees current prop values without stale-closure bugs. Seeks immediately on build
to avoid a one-frame flash when a component mounts mid-scene.

```typescript
// Shared hook: builds an animejs timeline and scrubs it to the current sceneProgress.
// All preset components in transitions.tsx delegate to this hook.

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import anime from 'animejs';
import { useEngineState } from '../../player/EngineStateContext';

/** Function that constructs an autoplay:false animejs timeline for a target element. */
export type TimelineBuilder = (target: HTMLDivElement) => ReturnType<typeof anime.timeline>;

/**
 * Builds an animejs timeline on mount (and when deps change) then seeks it to
 * sceneProgress * totalDuration on every engine tick.
 *
 * @param ref           - ref to the wrapper div owned by the transition component
 * @param build         - constructs the timeline for the target element; rebuilt when deps change
 * @param totalDuration - total timeline length in ms; sceneProgress 0→1 maps to 0→totalDuration
 * @param deps          - values that should trigger a timeline rebuild (mirror what build closes over)
 */
export const useScrollTimeline = (
  ref: RefObject<HTMLDivElement | null>,
  build: TimelineBuilder,
  totalDuration: number,
  deps: readonly unknown[],
): void => {
  // Always-current ref for the build function — prevents stale closure in layout effect
  const buildRef = useRef(build);
  buildRef.current = build;

  const tlRef = useRef<ReturnType<typeof anime.timeline> | null>(null);

  const { sceneProgress } = useEngineState();

  // Always-current ref for sceneProgress — used in layout effect for immediate post-build seek
  const sceneProgressRef = useRef(sceneProgress);
  sceneProgressRef.current = sceneProgress;

  // Build (or rebuild) the timeline synchronously after the DOM is ready.
  // Immediately seek to the current sceneProgress to avoid a one-frame flash on mount.
  useLayoutEffect(() => {
    if (!ref.current) return;
    tlRef.current = buildRef.current(ref.current);
    tlRef.current.seek(sceneProgressRef.current * totalDuration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDuration, ...deps]);

  // Scrub the timeline to the current sceneProgress on every engine tick.
  useEffect(() => {
    tlRef.current?.seek(sceneProgress * totalDuration);
  }, [sceneProgress, totalDuration]);
};
```

---

### 2.2 `src/hud/animejs/transitions.tsx`

All six presets. Each component: creates a `ref`, calls `useScrollTimeline`, returns a
wrapper `<div>`. The `build` function is defined inline per component so it closes over
the resolved props; `deps` mirrors those values so the timeline rebuilds on changes.
Components that start invisible set `style={{ opacity: 0 }}` inline to prevent a flash.

```tsx
// Scroll-driven transition wrappers for use as children of DSL <HudItem> elements.
// Must be rendered inside <ScenePlayer> (EngineStateContext must be provided).

import { useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import anime from 'animejs';
import { useScrollTimeline } from './useScrollTimeline';

// ─── Shared prop type ─────────────────────────────────────────────────────────

export type TransitionProps = {
  children?: ReactNode;
  /** Total scrub duration in ms. sceneProgress 0→1 maps to 0→duration. Default varies per preset. */
  duration?: number;
  /**
   * Delay in ms before the animation begins within the timeline.
   * Use to stagger multiple items: first={delay:0}, second={delay:100}, third={delay:200}.
   */
  delay?: number;
  /** AnimeJS easing string. Defaults vary per preset. */
  easing?: string;
};

// ─── Fade ────────────────────────────────────────────────────────────────────

/**
 * Fades from opacity 0 → 1 across the full sceneProgress range.
 *
 * @example
 * <HudItem id="label"><Fade><span>Caption</span></Fade></HudItem>
 */
export const Fade = ({
  children,
  duration = 600,
  delay = 0,
  easing = 'easeInOutSine',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], duration, easing, delay }),
    duration + delay,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── MidFade ─────────────────────────────────────────────────────────────────

/**
 * Fades in during the first half of sceneProgress, holds at full opacity for the second half.
 * Replicates the mid-fade behaviour from the legacy annotation system.
 *
 * @example
 * <HudItem id="title"><MidFade><h2>Heading</h2></MidFade></HudItem>
 */
export const MidFade = ({
  children,
  duration = 1000,
  delay = 0,
  easing = 'easeOutCubic',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const active   = duration - delay;
  const fadeIn   = active * 0.5;
  const hold     = active * 0.5;

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], duration: fadeIn, easing, delay })
        .add({ targets: target, opacity: 1, duration: hold }),
    duration,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── SlideUp ─────────────────────────────────────────────────────────────────

/**
 * Slides up from below and fades in across the full sceneProgress range.
 * Use `delay` to stagger multiple items in a scene.
 *
 * @example
 * <HudItem id="line-1"><SlideUp>First</SlideUp></HudItem>
 * <HudItem id="line-2"><SlideUp delay={100}>Second</SlideUp></HudItem>
 * <HudItem id="line-3"><SlideUp delay={200}>Third</SlideUp></HudItem>
 */
export const SlideUp = ({
  children,
  duration = 600,
  delay = 0,
  easing = 'easeOutCubic',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], translateY: ['24px', '0px'], duration, easing, delay }),
    duration + delay,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── SlideDown ───────────────────────────────────────────────────────────────

/**
 * Slides down from above and fades in across the full sceneProgress range.
 *
 * @example
 * <HudItem id="nav"><SlideDown><nav>Menu</nav></SlideDown></HudItem>
 */
export const SlideDown = ({
  children,
  duration = 600,
  delay = 0,
  easing = 'easeOutCubic',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], translateY: ['-24px', '0px'], duration, easing, delay }),
    duration + delay,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── ScrollOn ────────────────────────────────────────────────────────────────

/**
 * Enters during the first 35% of sceneProgress, holds for the remainder.
 * Good for content that should be fully visible early and stay stable.
 *
 * @example
 * <HudItem id="stat"><ScrollOn><strong>247</strong> customers</ScrollOn></HudItem>
 */
export const ScrollOn = ({
  children,
  duration = 1000,
  delay = 0,
  easing = 'easeOutExpo',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const active       = duration - delay;
  const enterDuration = active * 0.35;
  const holdDuration  = active * 0.65;

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, opacity: [0, 1], translateY: ['12px', '0px'], duration: enterDuration, easing, delay })
        .add({ targets: target, opacity: 1, duration: holdDuration }),
    duration,
    [duration, delay, easing] as const,
  );

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
};

// ─── ScrollOff ───────────────────────────────────────────────────────────────

/**
 * Holds visible until the final 35% of sceneProgress, then exits upward.
 * Good for content that should remain visible while the user is scrolling away.
 *
 * @example
 * <HudItem id="cta"><ScrollOff><button>Learn more</button></ScrollOff></HudItem>
 */
export const ScrollOff = ({
  children,
  duration = 1000,
  delay = 0,
  easing = 'easeInExpo',
}: TransitionProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const active      = duration - delay;
  const holdDuration = active * 0.65;
  const exitDuration = active * 0.35;

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({ targets: target, delay, opacity: 1, duration: holdDuration })
        .add({ targets: target, opacity: [1, 0], translateY: ['0px', '-12px'], duration: exitDuration, easing }),
    duration,
    [duration, delay, easing] as const,
  );

  // ScrollOff starts visible — no opacity:0 needed
  return <div ref={ref}>{children}</div>;
};
```

---

### 2.3 `src/hud/animejs/index.ts`

```typescript
// Public barrel for the HUD AnimeJS transition sub-module.
// This module is NOT re-exported from src/hud/index.ts — it is an explicit opt-in.

export { useScrollTimeline } from './useScrollTimeline';
export type { TimelineBuilder } from './useScrollTimeline';

export { Fade, MidFade, SlideUp, SlideDown, ScrollOn, ScrollOff } from './transitions';
export type { TransitionProps } from './transitions';
```

---

### 2.4 Full authoring example

```tsx
import { Scene } from '../compiler';
import { Hud, HudItem } from '../compiler/blocks/hudBlocks';
import { Fade, MidFade, SlideUp, ScrollOn, ScrollOff } from '../hud/animejs';

export const scene02_mission = {
  id: 'scene-02',
  index: 1,
  getFrame: () => (
    <Scene id="scene-02">
      <Hud>
        <HudItem id="eyebrow" className="hud-eyebrow">
          <Fade duration={400}>
            <span>Our Mission</span>
          </Fade>
        </HudItem>

        <HudItem id="headline" className="hud-headline">
          <SlideUp delay={80}>
            <h2>Building the future of robotics</h2>
          </SlideUp>
        </HudItem>

        <HudItem id="body" className="hud-body">
          <MidFade delay={160}>
            <p>We believe in human–robot collaboration.</p>
          </MidFade>
        </HudItem>

        <HudItem id="stat" className="hud-stat">
          <ScrollOn>
            <strong>247</strong> customers worldwide
          </ScrollOn>
        </HudItem>

        <HudItem id="cta" className="hud-cta">
          <ScrollOff>
            <button type="button">Learn more</button>
          </ScrollOff>
        </HudItem>
      </Hud>
    </Scene>
  ),
};
```

---

## Section 3 — Custom Animation Guide

`useScrollTimeline` and `useEngineState` are exported from `src/hud/animejs/index.ts`.
Any component can import them to build transitions not covered by the six presets. All
custom components follow the same rules as the presets: render inside `<ScenePlayer>`,
wrap children in a div with a ref, set initial CSS to match animation start state.

### Pattern A — Custom scroll-driven transition (`useScrollTimeline`)

Use when the animation should scrub directly with scroll position.

```tsx
// WipeIn — content revealed left-to-right via clip-path as the user scrolls.

import { useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import anime from 'animejs';
import { useScrollTimeline } from '../hud/animejs';

type WipeInProps = { children?: ReactNode; duration?: number };

export const WipeIn = ({ children, duration = 800 }: WipeInProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);

  useScrollTimeline(
    ref,
    (target) =>
      anime.timeline({ autoplay: false })
        .add({
          targets: target,
          clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'],
          duration,
          easing: 'easeInOutQuart',
        }),
    duration,
    [duration] as const,
  );

  return (
    <div ref={ref} style={{ clipPath: 'inset(0 100% 0 0)' }}>
      {children}
    </div>
  );
};
```

**The contract for any `useScrollTimeline` component:**

1. Create a `ref` pointing to the wrapper `<div>`.
2. Define `build`: takes `target: HTMLDivElement`, returns an `autoplay: false` anime
   timeline whose total duration equals the `totalDuration` argument.
3. Call `useScrollTimeline(ref, build, totalDuration, deps)`.
   `deps` should list every value from outside `build`'s scope that could change.
4. Set initial CSS to match the animation start state to prevent a pre-seek flash.

### Pattern B — Autoplay on scene entry (`useEngineState` directly)

Use when the animation plays at its own pace after the scene becomes active, rather
than scrubbing. Common for spring physics or sequences that feel wrong when scrubbed.

```tsx
// SpringPop — element springs into place when the scene becomes active.

import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import anime from 'animejs';
import { useEngineState } from '../../player/EngineStateContext';

type SpringPopProps = { children?: ReactNode; delay?: number };

export const SpringPop = ({ children, delay = 0 }: SpringPopProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const { sceneIndex } = useEngineState();

  useEffect(() => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      scale: [0.75, 1],
      opacity: [0, 1],
      delay,
      duration: 800,
      easing: 'spring(1, 80, 10, 0)',
    });
  }, [sceneIndex, delay]);

  return (
    <div ref={ref} style={{ opacity: 0, transform: 'scale(0.75)' }}>
      {children}
    </div>
  );
};
```

`sceneIndex` (not `sceneProgress`) triggers the effect. The animation plays at anime's
own pace via its RAF loop — it is not scrubbed and does not synchronise with scroll
speed. Appropriate for micro-interactions and decorative motion.

### Pattern C — Data-driven counter (anime object animation)

Anime can animate arbitrary JS object properties. Use for numerical UI that counts
up with scroll.

```tsx
// CountUp — animates a number from 0 to `target` as sceneProgress goes 0→1.

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import anime from 'animejs';
import { useEngineState } from '../../player/EngineStateContext';

type CountUpProps = {
  target: number;
  suffix?: string;
  duration?: number;
  easing?: string;
};

export const CountUp = ({
  target,
  suffix = '',
  duration = 1000,
  easing = 'easeOutCubic',
}: CountUpProps): ReactElement => {
  const spanRef    = useRef<HTMLSpanElement>(null);
  const animObj    = useRef({ val: 0 });
  const tlRef      = useRef<ReturnType<typeof anime.timeline> | null>(null);
  const { sceneProgress } = useEngineState();
  const progressRef = useRef(sceneProgress);
  progressRef.current = sceneProgress;

  useLayoutEffect(() => {
    animObj.current = { val: 0 };
    tlRef.current = anime.timeline({ autoplay: false })
      .add({
        targets: animObj.current,
        val: target,
        duration,
        easing,
        round: 1,
        update: () => {
          if (spanRef.current) {
            spanRef.current.textContent = `${animObj.current.val}${suffix}`;
          }
        },
      });
    tlRef.current.seek(progressRef.current * duration);
  }, [target, suffix, duration, easing]);

  useEffect(() => {
    tlRef.current?.seek(sceneProgress * duration);
  }, [sceneProgress, duration]);

  return <span ref={spanRef}>0{suffix}</span>;
};
```

Usage — composable inside any preset:
```tsx
<HudItem id="stat">
  <SlideUp>
    <CountUp target={247} suffix=" customers" />
  </SlideUp>
</HudItem>
```

### Pattern D — Composing presets

Presets compose freely. Each component owns an independent timeline driven by the same
`sceneProgress`. Outer controls the group; inner controls individual items.

```tsx
// Group fade + staggered slide for individual lines
<HudItem id="card">
  <Fade duration={300}>
    <div className="card">
      <SlideUp delay={0}><h3>Title</h3></SlideUp>
      <SlideUp delay={80}><p>Body</p></SlideUp>
      <SlideUp delay={160}><a href="#">Link</a></SlideUp>
    </div>
  </Fade>
</HudItem>
```

```tsx
// ScrollOn brings in the group; MidFade handles internal emphasis
<HudItem id="feature">
  <ScrollOn duration={800}>
    <figure>
      <MidFade duration={600} delay={200}>
        <img src="/icon.svg" alt="" />
      </MidFade>
      <figcaption>Feature caption</figcaption>
    </figure>
  </ScrollOn>
</HudItem>
```

### Rules for custom transition components

| Rule | Reason |
|------|--------|
| Must render inside `<ScenePlayer>` | `useEngineState()` requires `EngineStateContext` |
| Wrap children in `<div ref={ref}>` | animejs needs a stable, non-null DOM target |
| Set initial CSS to match animation start state | prevents flash before first seek fires |
| Pass `deps` that mirror what `build` closes over | prevents stale timeline after prop changes |
| Use `useScrollTimeline` for scroll-scrubbed animations | correct `seek`-on-progress behaviour |
| Use `useEffect([sceneIndex])` for autoplay animations | triggers once per scene entry |
| Never import from `src/compiler/` | wrong dependency direction |
| Never import Three.js | transitions are pure DOM |

---

## Section 4 — Tests

### 4.1 `src/hud/animejs/__tests__/useScrollTimeline.test.ts`

Tests the hook contract: `seek` is called with `sceneProgress * totalDuration` when
`sceneProgress` changes. AnimeJS is mocked (returns a `seek` spy) since jsdom has
limited CSS support. `EngineStateContext` is provided with real values — not mocked —
per the project's interface-based test philosophy.

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';

// ── AnimeJS mock ──────────────────────────────────────────────────────────────
const seekFn = vi.fn();
vi.mock('animejs', () => ({
  default: {
    timeline: vi.fn(() => ({
      add:  vi.fn().mockReturnThis(),
      seek: seekFn,
    })),
  },
}));

// ── Real EngineStateContext — no mock ─────────────────────────────────────────
import { EngineStateContext } from '../../../player/EngineStateContext';

const engineState = (sceneProgress: number) => ({
  progress: sceneProgress,
  sceneId: 'test',
  sceneIndex: 0,
  sceneProgress,
});

// ── Subject ───────────────────────────────────────────────────────────────────
import { useScrollTimeline } from '../useScrollTimeline';

const TestComponent = ({ duration }: { duration: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollTimeline(
    ref,
    (_target) => ({ add: vi.fn().mockReturnThis(), seek: seekFn } as never),
    duration,
    [duration] as const,
  );
  return <div ref={ref} />;
};

const wrap = (sceneProgress: number, duration: number) => (
  <EngineStateContext.Provider value={engineState(sceneProgress)}>
    <TestComponent duration={duration} />
  </EngineStateContext.Provider>
);

describe('useScrollTimeline', () => {
  beforeEach(() => seekFn.mockClear());

  it('seeks to 0 on mount when sceneProgress is 0', () => {
    render(wrap(0, 1000));
    expect(seekFn).toHaveBeenCalledWith(0);
  });

  it('seeks to totalDuration when sceneProgress is 1', () => {
    render(wrap(1, 1000));
    expect(seekFn).toHaveBeenCalledWith(1000);
  });

  it('seeks to sceneProgress * totalDuration on context update', () => {
    const { rerender } = render(wrap(0, 800));
    seekFn.mockClear();
    act(() => { rerender(wrap(0.5, 800)); });
    expect(seekFn).toHaveBeenCalledWith(400);
  });

  it('rebuilds and re-seeks when totalDuration changes', () => {
    const { rerender } = render(wrap(0, 500));
    const before = seekFn.mock.calls.length;
    act(() => { rerender(wrap(0, 1000)); });
    expect(seekFn.mock.calls.length).toBeGreaterThan(before);
  });
});
```

### 4.2 `src/hud/animejs/__tests__/transitions.test.tsx`

Smoke tests: each preset renders a div, starts with the correct initial opacity, and
does not throw. Composition (nesting two presets) is also verified. Uses a real
`EngineStateContext` at `sceneProgress = 0`.

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { EngineStateContext } from '../../../player/EngineStateContext';
import { Fade, MidFade, SlideUp, SlideDown, ScrollOn, ScrollOff } from '../transitions';

vi.mock('animejs', () => ({
  default: {
    timeline: vi.fn(() => ({
      add:  vi.fn().mockReturnThis(),
      seek: vi.fn(),
    })),
  },
}));

const zeroState = { progress: 0, sceneId: 'test', sceneIndex: 0, sceneProgress: 0 };
const wrap = (node: React.ReactElement) => (
  <EngineStateContext.Provider value={zeroState}>{node}</EngineStateContext.Provider>
);

const PRESETS = [
  { name: 'Fade',      C: Fade,      startsHidden: true  },
  { name: 'MidFade',   C: MidFade,   startsHidden: true  },
  { name: 'SlideUp',   C: SlideUp,   startsHidden: true  },
  { name: 'SlideDown', C: SlideDown, startsHidden: true  },
  { name: 'ScrollOn',  C: ScrollOn,  startsHidden: true  },
  { name: 'ScrollOff', C: ScrollOff, startsHidden: false },
] as const;

describe('transition presets', () => {
  for (const { name, C, startsHidden } of PRESETS) {
    it(`${name}: renders children inside a div`, () => {
      const { getByText } = render(wrap(<C><span>content</span></C>));
      expect(getByText('content')).toBeDefined();
    });

    if (startsHidden) {
      it(`${name}: initial opacity is 0`, () => {
        const { container } = render(wrap(<C><span /></C>));
        const div = container.firstElementChild as HTMLElement;
        expect(div?.style.opacity).toBe('0');
      });
    }

    it(`${name}: does not throw`, () => {
      expect(() => render(wrap(<C><span /></C>))).not.toThrow();
    });
  }

  it('presets compose without error', () => {
    expect(() =>
      render(wrap(
        <Fade><SlideUp delay={100}><span>nested</span></SlideUp></Fade>
      ))
    ).not.toThrow();
  });

  it('SlideUp stagger via delay prop does not throw', () => {
    expect(() =>
      render(wrap(
        <>
          <SlideUp delay={0}><span>a</span></SlideUp>
          <SlideUp delay={100}><span>b</span></SlideUp>
          <SlideUp delay={200}><span>c</span></SlideUp>
        </>
      ))
    ).not.toThrow();
  });
});
```

---

## Section 5 — Implementation Order

### Step 1 — Apply the `node` → `children` change

1. Edit `src/hud/types.ts` (Section 1.1)
2. Edit `src/hud/HudItem.tsx` (Section 1.2)
3. Edit `src/compiler/blocks/hudBlocks.tsx` (Section 1.3)
4. Edit `src/hud/__tests__/HudItem.test.tsx` (Section 1.4)
5. Edit `src/compiler/__tests__/hudBlocks.test.tsx` (Section 1.5)
6. `pnpm typecheck` → zero errors
7. `pnpm test src/hud src/compiler/__tests__/hudBlocks.test.tsx` → all pass

### Step 2 — Create `src/hud/animejs/` sub-module

1. Create `src/hud/animejs/useScrollTimeline.ts` (Section 2.1)
2. Create `src/hud/animejs/transitions.tsx` (Section 2.2)
3. Create `src/hud/animejs/index.ts` (Section 2.3)
4. Create `src/hud/animejs/__tests__/useScrollTimeline.test.ts` (Section 4.1)
5. Create `src/hud/animejs/__tests__/transitions.test.tsx` (Section 4.2)
6. `pnpm typecheck` → zero errors
7. `pnpm test src/hud/animejs` → all pass

### Step 3 — Verify `src/hud/index.ts` is unchanged

Confirm the core barrel has no import from `./animejs`:
```typescript
export type { HudItemDefinition, HudItemResolved } from './types';
export { HudItem } from './HudItem';
export type { HudItemProps } from './HudItem';
export { HudOverlay } from './HudOverlay';
export type { HudOverlayProps } from './HudOverlay';
```

### Step 4 — Final verification

```bash
pnpm typecheck   # zero errors
pnpm test        # full suite passes
pnpm build       # clean production build
```
