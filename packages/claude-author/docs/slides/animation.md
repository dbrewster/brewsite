---
title: Slide Animation Hooks
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## How Slide Animation Works

All animation hooks internally call `useSceneProgress()` from `@brewsite/core`. Scene progress is a number from 0 to 1 representing the current position within a single slide. As the user scrolls or navigates, scene progress advances and the hooks re-render with updated values.

`SlideTheme.timing` values control default animation windows:
- `entranceDuration` (default 0.3) — the scene progress window for entrance animations
- `staggerDelay` (default 0.08) — delay between sequentially revealed items
- `countUpDuration` (default 0.6) — progress window for number count-up animations
- `entranceDistance` (default `'24px'`) — fly-in distance for slide/grow entrances

These defaults can be overridden per-hook via the `options` parameter, or globally via `SlideTheme` on `SlidePlayer`.

## useCountUp

Animates a number from a start value to a target value, driven by scene progress with easing.

```typescript
function useCountUp(
  target: number,
  options?: {
    start?: number;       // default: 0
    delay?: number;       // scene progress at which count begins, default: 0
    duration?: number;    // scene progress window length, default: 0.6
    easing?: (t: number) => number; // default: easeOutCubic
    decimals?: number;    // decimal places to round to, default: 0
  },
): number;
```

Returns the current animated value (rounded to `decimals` places). Before `delay`, returns `start`. After `delay + duration`, returns `target`.

```tsx
import { Slide, BigNumberSlide, useCountUp } from '@brewsite/slides';

function RevenueSlide() {
  const revenue = useCountUp(4200000, { decimals: 0, duration: 0.5 });
  const growth = useCountUp(32, { delay: 0.2, decimals: 1 });

  return (
    <Slide key="revenue">
      <BigNumberSlide
        title="Q4 Revenue"
        stats={[
          { value: `$${(revenue / 1000000).toFixed(1)}M`, label: 'Total Revenue', trend: `+${growth}%`, trendDirection: 'up' },
        ]}
      />
    </Slide>
  );
}
```

## useStaggeredReveal

Reveals items sequentially as scene progress advances. Returns visibility state and CSS properties for smooth fade+slide animation.

```typescript
function useStaggeredReveal(
  index: number,    // 0-based index of this item
  total: number,    // total number of items
  options?: {
    staggerDelay?: number;     // progress delay between items, default: 0.6 / total
    fadeInDuration?: number;   // progress window for each item's fade, default: 0.15
    startAfter?: number;       // scene progress before first item starts, default: 0
  },
): { visible: boolean; style: CSSProperties };
```

The returned `style` includes `opacity` and `transform: translateY(...)` for a smooth upward fade-in. Apply it directly to the item's container element.

```tsx
import { Slide, ContentSlide, useStaggeredReveal } from '@brewsite/slides';

function FeatureList() {
  const features = ['Real-time sync', 'End-to-end encryption', 'Offline support', 'API access'];

  return (
    <Slide key="features">
      <ContentSlide title="Platform Features">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {features.map((feature, i) => {
            const { style } = useStaggeredReveal(i, features.length, { startAfter: 0.1 });
            return <div key={i} style={style}>{feature}</div>;
          })}
        </div>
      </ContentSlide>
    </Slide>
  );
}
```

## useProgressWindow

Returns a progress value (0 to 1) clamped and optionally eased within a sub-window of scene progress. Use this to drive any custom animation or to feed the `progress` prop on graphics components.

```typescript
function useProgressWindow(
  start: number,    // scene progress at which this window begins
  end: number,      // scene progress at which this window is complete
  options?: {
    easing?: (t: number) => number;  // default: linear (no easing)
  },
): number;
```

Returns 0 when `sceneProgress <= start`, 1 when `sceneProgress >= end`, and an interpolated value between.

```tsx
import { ContentSlide, ProgressRing, useProgressWindow, easeOutCubic } from '@brewsite/slides';

function HealthDashboard() {
  const ringProgress = useProgressWindow(0.1, 0.6, { easing: easeOutCubic });

  return (
    <ContentSlide title="System Health">
      <div style={{ display: 'flex', gap: '24px' }}>
        <ProgressRing value={95} label="CPU" progress={ringProgress} />
        <ProgressRing value={72} label="Memory" progress={ringProgress} />
        <ProgressRing value={88} label="Disk" progress={ringProgress} />
      </div>
    </ContentSlide>
  );
}
```

## useEntrance

Returns CSS properties that animate an element's entrance using a named entrance type. Driven by scene progress.

```typescript
function useEntrance(
  type: EntranceType,
  options?: {
    delay?: number;      // scene progress at which entrance begins, default: 0
    duration?: number;   // scene progress window length, default: 0.3
    distance?: string;   // fly-in distance for slide types, default: '24px'
    easing?: (t: number) => number; // default: easeOutCubic
  },
): CSSProperties;
```

`EntranceType` is `'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'grow' | 'none'`.

Returns an empty object (`{}`) when the entrance is complete or when `type` is `'none'`. During animation, returns `opacity` and `transform` properties.

```tsx
import { Slide, ContentSlide, Body, useEntrance } from '@brewsite/slides';

function AnimatedContent() {
  const titleStyle = useEntrance('fadeIn', { duration: 0.2 });
  const bodyStyle = useEntrance('slideUp', { delay: 0.15, duration: 0.3 });

  return (
    <Slide key="animated">
      <ContentSlide title="Welcome">
        <div style={titleStyle}>
          <Body>This fades in immediately.</Body>
        </div>
        <div style={bodyStyle}>
          <Body>This slides up after a short delay.</Body>
        </div>
      </ContentSlide>
    </Slide>
  );
}
```

Entrance behaviors:
- `fadeIn` — opacity 0 to 1
- `slideUp` — opacity 0 to 1 + translateY(distance) to translateY(0)
- `slideDown` — opacity 0 to 1 + translateY(-distance) to translateY(0)
- `slideLeft` — opacity 0 to 1 + translateX(distance) to translateX(0)
- `slideRight` — opacity 0 to 1 + translateX(-distance) to translateX(0)
- `grow` — opacity 0 to 1 + scale(0.8) to scale(1)
- `none` — no animation, returns `{}`

## Easing Functions

Four easing functions are exported for use with animation hooks.

```typescript
function easeOutCubic(t: number): number;    // 1 - (1 - t)^3
function easeInOutCubic(t: number): number;  // symmetric cubic ease
function easeOutQuart(t: number): number;    // 1 - (1 - t)^4
function linear(t: number): number;          // t (identity)
```

All take a normalized input `t` in [0, 1] and return a normalized output in [0, 1].

```tsx
import { useCountUp, easeOutQuart } from '@brewsite/slides';

const value = useCountUp(1000, { easing: easeOutQuart, duration: 0.8 });
```

`easeOutCubic` is the default for `useCountUp` and `useEntrance`. `linear` (no easing) is the default for `useProgressWindow`.

## BulletList animateEntrance

`BulletList` and `NumberedList` have a built-in animated entrance that does not require any hooks. Set `animateEntrance={true}` and bullets reveal one at a time as the user scrolls through the slide.

```tsx
import { Slide, ContentSlide, BulletList } from '@brewsite/slides';

<Slide key="features">
  <ContentSlide title="Key Features">
    <BulletList
      animateEntrance={true}
      items={['Real-time collaboration', 'End-to-end encryption', 'Offline-first architecture']}
    />
  </ContentSlide>
</Slide>
```

This works via `SlideMetaWidget` writing `sceneProgress` to the `VariableStore`, which the `SlideContentWithProgress` wrapper reads reactively. The `visibleCount` is computed as `Math.ceil(sceneProgress * totalBullets)`, revealing bullets progressively as the user scrolls.

`BulletList` also accepts a `bulletStyle` prop: `'disc'` (default), `'arrow'`, `'checkmark'`, or `'none'`.

```tsx
<BulletList
  animateEntrance={true}
  bulletStyle="checkmark"
  items={['Requirement met', 'Tests passing', 'Deployed to prod']}
/>
```
