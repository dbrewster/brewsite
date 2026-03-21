---
title: Slide Transitions
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## SlideTransition Type

The `SlideTransition` type defines how slides animate when navigating between them. It is a string union exported from `@brewsite/slides`:

```ts
import type { SlideTransition } from '@brewsite/slides';

type SlideTransition =
  | 'dissolve'
  | 'cut'
  | 'fade'
  | 'push-left'
  | 'push-right'
  | 'push-up'
  | 'push-down'
  | 'zoom-in'
  | 'zoom-out';
```

Every `<Slide>` resolves to exactly one `SlideTransition` value at compile time. The resolution order is: per-slide `transition` prop > `SlideTemplate.defaultTransition` > `SlidePlayer` `transition` prop > `'dissolve'`.

---

## Setting the Default Transition

Set the default transition for the entire deck on `SlidePlayer`'s `transition` prop. When omitted, the default is `'dissolve'`.

```tsx
import { SlidePlayer, Slide, TitleSlide, ContentSlide } from '@brewsite/slides';

<SlidePlayer transition="push-left">
  <Slide key="intro"><TitleSlide title="Welcome" /></Slide>
  <Slide key="body"><ContentSlide title="Overview"><Body>Details here.</Body></ContentSlide></Slide>
</SlidePlayer>
```

Alternatively, set the default via `SlideTemplate.defaultTransition`. The template default is overridden by the `SlidePlayer` `transition` prop when both are present:

```ts
import type { SlideTemplate } from '@brewsite/slides';

const acmeTemplate: SlideTemplate = {
  name: 'Acme',
  defaultTransition: 'fade',
  brand: { logo: { src: '/acme-logo.svg', alt: 'Acme' } },
};
```

```tsx
<SlidePlayer template={acmeTemplate}>
  {/* All slides use 'fade' unless overridden per-slide */}
</SlidePlayer>
```

---

## Per-Slide Transition Override

Override the deck default for a specific slide by setting `transition` on the `<Slide>` element. Only that slide uses the override; all others use the deck default.

```tsx
<SlidePlayer transition="dissolve">
  <Slide key="intro"><TitleSlide title="Welcome" /></Slide>
  <Slide key="demo" transition="push-left">
    <ContentSlide title="Demo"><Body>Live demonstration.</Body></ContentSlide>
  </Slide>
  <Slide key="close"><TitleSlide title="Thank You" /></Slide>
</SlidePlayer>
```

In the compiled `DeckSpec`, each `SlideSpec.transition` holds the resolved value:
- `intro` resolves to `'dissolve'` (deck default)
- `demo` resolves to `'push-left'` (per-slide override)
- `close` resolves to `'dissolve'` (deck default)

---

## Transition Descriptions

Each `SlideTransition` variant produces a specific visual effect:

- **`dissolve`** -- Opacity crossfade. The outgoing slide fades out while the incoming slide fades in. This is the default transition.
- **`cut`** -- Instant switch with no animation. The outgoing slide is immediately replaced by the incoming slide. No CSS class is applied.
- **`fade`** -- Alias for `dissolve`. Internally resolved to `'dissolve'` by `resolveTransitionClass()`. Produces identical opacity crossfade behavior.
- **`push-left`** -- The incoming slide enters from the right edge, pushing the outgoing slide off to the left. Uses CSS `transform: translateX()`.
- **`push-right`** -- The incoming slide enters from the left edge, pushing the outgoing slide off to the right. Uses CSS `transform: translateX()`.
- **`push-up`** -- The incoming slide enters from the bottom edge, pushing the outgoing slide upward. Uses CSS `transform: translateY()`.
- **`push-down`** -- The incoming slide enters from the top edge, pushing the outgoing slide downward. Uses CSS `transform: translateY()`.
- **`zoom-in`** -- The incoming slide scales up from `scale(0.8)` to `scale(1)` while fading in. The outgoing slide scales down and fades out. Uses CSS `transform: scale()` and `opacity`.
- **`zoom-out`** -- The incoming slide scales down from `scale(1.2)` to `scale(1)` while fading in. The outgoing slide scales up and fades out. Uses CSS `transform: scale()` and `opacity`.

---

## How Transitions Work

Slide transitions are implemented as CSS transitions applied by `SlideTransitionWrapper`. Each transition type maps to a CSS class in the format `slide-transition--{type}`. When the slide becomes active, the `--active` modifier class is added (e.g., `slide-transition--dissolve--active`), triggering the CSS transition.

The transition duration is controlled by the CSS custom property `--slide-transition-duration`, which is set from `SlideTheme.timing.transitionDuration`. The default value is `300ms`. Override it via `SlideTheme`:

```ts
import { createSlideTheme } from '@brewsite/slides';

const slowTheme = createSlideTheme({
  timing: { transitionDuration: '600ms' },
});
```

The CSS classes are injected into the document head once per page lifecycle by `injectTransitionKeyframes()`. For the `'cut'` transition, no CSS class is applied -- `resolveTransitionClass('cut', true)` returns an empty string.

Three.js content between slides uses core compiled transition specs underneath. The HTML overlay transitions (CSS) and 3D transitions (engine) run in parallel during slide changes.

---

## Example with Mixed Transitions

A deck using different transitions for different slides:

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, ContentSlide, SectionSlide,
  Body, BulletList, slidesPlugin,
} from '@brewsite/slides';

function MixedTransitionDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer transition="dissolve">
        <Slide key="intro">
          <TitleSlide title="Welcome" subtitle="Product Launch 2027" />
        </Slide>
        <Slide key="agenda" transition="push-left">
          <ContentSlide title="Agenda">
            <BulletList items={['Overview', 'Demo', 'Pricing', 'Q&A']} />
          </ContentSlide>
        </Slide>
        <Slide key="demo" transition="zoom-in">
          <SectionSlide title="Live Demo" subtitle="See it in action" />
        </Slide>
        <Slide key="pricing" transition="push-up">
          <ContentSlide title="Pricing">
            <Body>Starting at $99/month for teams.</Body>
          </ContentSlide>
        </Slide>
        <Slide key="close" transition="zoom-out">
          <TitleSlide title="Thank You" subtitle="Questions?" />
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```
