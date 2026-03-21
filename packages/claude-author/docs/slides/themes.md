---
title: Slide Theme System
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## Three-Axis Customization

Slides use three independent customization axes that compose without conflict:

**SceneTheme** (visual) — Applied on `SceneEngine`. Controls colors, fonts, spacing via `--brewsite-*` CSS variables. This is the core visual identity shared by all BrewSite elements.

**SlideTheme** (feel) — Applied on `SlidePlayer` via the `slideTheme` prop. Controls timing, density, typography scale, and component sizing via `--slide-*` CSS variables. Determines "how slides feel."

**SlideTemplate** (branding) — Applied on `SlidePlayer` via the `template` prop. Controls corporate chrome: logos, footers, watermarks. Determines "whose slides these are."

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { SlidePlayer, Slide, TitleSlide, compactSlideTheme, slidesPlugin } from '@brewsite/slides';

<SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
  <SlidePlayer slideTheme={compactSlideTheme}>
    <Slide key="intro"><TitleSlide title="Data-Dense Deck" /></Slide>
  </SlidePlayer>
</SceneEngine>
```

## SlideTheme Type

The full `SlideTheme` type with all fields and their defaults from `defaultSlideTheme`:

```typescript
type SlideTheme = {
  readonly timing: {
    readonly transitionDuration: string;   // '300ms' — CSS transition duration between slides
    readonly entranceDuration: number;     // 0.3 — default entrance progress window [0-1]
    readonly entranceDistance: string;      // '24px' — fly-in distance for slide/grow entrances
    readonly staggerDelay: number;         // 0.08 — stagger delay between items [0-1]
    readonly countUpDuration: number;      // 0.6 — count-up animation progress window [0-1]
  };

  readonly density: {
    readonly contentPadding: string;       // '48px' — padding inside slide regions
    readonly contentGap: string;           // '16px' — vertical gap between elements in a region
    readonly titleHeight: number;          // 0.18 — title bar height as NVS fraction [0-1]
    readonly gutter: number;               // 0.02 — inter-region gutter as NVS fraction [0-1]
  };

  readonly typography: {
    readonly headingScale: number;         // 1.2 — heading size multiplier
    readonly bodyScale: number;            // 1.1 — body text size multiplier
    readonly captionScale: number;         // 1.0 — caption/label size multiplier
  };

  readonly components: {
    readonly cardBorderWidth: string;      // '1px' — StatCard/CalloutBox border width
    readonly timelineConnectorWidth: string; // '2px' — Timeline connector line thickness
    readonly timelineDotSize: string;      // '12px' — Timeline milestone dot diameter
    readonly progressRingSize: string;     // '64px' — ProgressRing default diameter
    readonly progressRingThickness: string; // '4px' — ProgressRing stroke width
  };
};
```

## Built-In Presets

Four named presets are exported, each a complete `SlideTheme` object:

**`defaultSlideTheme`** — Balanced for general-purpose presentations. The base from which all other presets and custom themes diverge.

**`compactSlideTheme`** — Tight spacing, fast transitions. For data-heavy / McKinsey-style decks.
- `transitionDuration: '200ms'`, `entranceDuration: 0.2`, `entranceDistance: '16px'`
- `contentPadding: '32px'`, `contentGap: '12px'`, `titleHeight: 0.14`
- `headingScale: 1.0`, `bodyScale: 1.0`
- `staggerDelay: 0.05`, `countUpDuration: 0.4`

**`cinematicSlideTheme`** — Spacious, slow. Apple keynote feel.
- `transitionDuration: '500ms'`, `entranceDuration: 0.5`, `entranceDistance: '32px'`
- `contentPadding: '64px'`, `contentGap: '24px'`, `titleHeight: 0.22`
- `headingScale: 1.4`, `bodyScale: 1.15`
- `staggerDelay: 0.12`, `countUpDuration: 0.8`

**`minimalSlideTheme`** — Clean, snappy. No stagger delay, fast transitions.
- `transitionDuration: '250ms'`, `entranceDuration: 0.25`, `entranceDistance: '20px'`
- `contentPadding: '40px'`, `contentGap: '14px'`, `titleHeight: 0.16`
- `headingScale: 1.1`, `bodyScale: 1.0`
- `staggerDelay: 0` (no stagger), `countUpDuration: 0.5`

```tsx
import { SlidePlayer, cinematicSlideTheme } from '@brewsite/slides';

<SlidePlayer slideTheme={cinematicSlideTheme}>
  {/* slides */}
</SlidePlayer>
```

## Creating Custom Themes

`createSlideTheme` deep-merges partial overrides into `defaultSlideTheme`. Only specify the fields you want to change.

```typescript
function createSlideTheme(overrides: DeepPartial<SlideTheme>): SlideTheme;
```

```tsx
import { SlidePlayer, createSlideTheme } from '@brewsite/slides';

const brandTheme = createSlideTheme({
  timing: {
    transitionDuration: '400ms',
    entranceDuration: 0.4,
    staggerDelay: 0.1,
  },
  density: {
    contentPadding: '56px',
    titleHeight: 0.2,
  },
  typography: {
    headingScale: 1.3,
  },
});

<SlidePlayer slideTheme={brandTheme}>
  {/* slides */}
</SlidePlayer>
```

The `DeepPartial<T>` utility type makes every nested field optional:

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

## CSS Variable Reference

`resolveSlideConfig` (called internally by `SlidePlayer`) converts a `SlideTheme` into CSS custom properties injected on the player container. All graphics components and layout regions consume these variables.

**Timing:**
- `--slide-transition-duration` — CSS transition duration between slides
- `--slide-entrance-duration` — default entrance progress window (unitless 0-1)
- `--slide-entrance-distance` — fly-in distance (CSS length)
- `--slide-stagger-delay` — stagger delay between items (unitless 0-1)
- `--slide-count-up-duration` — count-up animation window (unitless 0-1)

**Density:**
- `--slide-content-padding` — padding inside slide regions (CSS length)
- `--slide-content-gap` — gap between elements in a region (CSS length)
- `--slide-title-height` — title bar height as NVS fraction (unitless 0-1)
- `--slide-gutter` — inter-region gutter as NVS fraction (unitless 0-1)

**Typography:**
- `--slide-heading-scale` — heading size multiplier (unitless)
- `--slide-body-scale` — body text size multiplier (unitless)
- `--slide-caption-scale` — caption/label size multiplier (unitless)

**Components:**
- `--slide-card-border-width` — border width for cards and table cells (CSS length)
- `--slide-timeline-connector-width` — Timeline connector line thickness (CSS length)
- `--slide-timeline-dot-size` — Timeline milestone dot diameter (CSS length)
- `--slide-progress-ring-size` — ProgressRing default diameter (CSS length)
- `--slide-progress-ring-thickness` — ProgressRing stroke width (CSS length)
