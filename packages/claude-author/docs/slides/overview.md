---
title: Slides Package Overview
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## What @brewsite/slides Is

`@brewsite/slides` is a slide deck presentation system built on top of `@brewsite/core`. `SlidePlayer` renders inside a parent `SceneEngine` context. Each `<Slide>` becomes one `<Scene>` in the core engine. The package provides zero-config, batteries-included authoring for corporate decks with 12 built-in layout archetypes, animated graphics components, entrance animations, and corporate chrome templates.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { SlidePlayer, Slide, TitleSlide, ContentSlide, Body, slidesPlugin } from '@brewsite/slides';

function Deck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer>
        <Slide key="intro"><TitleSlide title="Q4 Results" subtitle="Annual Review" /></Slide>
        <Slide key="body"><ContentSlide title="Highlights"><Body>Record quarter across all segments.</Body></ContentSlide></Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

`SlidePlayer` does not create its own engine. It compiles `<Slide>` children into `<Scene>` elements that the parent `SceneEngine` drives. Visual tokens (colors, fonts, spacing) come from `SceneTheme` on the engine. Behavioral tokens (timing, density) come from `SlideTheme` via `--slide-*` CSS custom properties injected on the `SlidePlayer` container.

## Installation and Plugin Registration

Peer dependencies: `@brewsite/core`, `react`, `react-dom`, `three`.

```bash
pnpm add @brewsite/slides @brewsite/core react react-dom three
```

Register `slidesPlugin()` alongside `corePlugin()` on `SceneEngine`. The plugin takes no arguments — it registers `SlideMetaWidget` and `SlideNavWidget` internally.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { SlidePlayer, Slide, TitleSlide, slidesPlugin } from '@brewsite/slides';

function Deck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer>
        <Slide key="intro"><TitleSlide title="Hello World" /></Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

## Three-Axis Customization Model

Slides use three orthogonal customization axes:

**SceneTheme** (visual) — Colors, fonts, spacing. Applied on `SceneEngine` via the core theme system. Controls `--brewsite-*` CSS variables consumed by all slide content.

**SlideTheme** (feel) — Timing, density, typography scale, component sizing. Applied on `SlidePlayer` via the `slideTheme` prop. Controls `--slide-*` CSS variables. Use `defaultSlideTheme`, `compactSlideTheme`, `cinematicSlideTheme`, `minimalSlideTheme`, or `createSlideTheme()` to customize.

**SlideTemplate** (branding) — Logos, footers, watermarks, corporate chrome. Applied on `SlidePlayer` via the `template` prop. Defines master slide elements that appear on every slide (with per-layout exclusion rules).

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { SlidePlayer, Slide, TitleSlide, cinematicSlideTheme, slidesPlugin } from '@brewsite/slides';
import type { SlideTemplate } from '@brewsite/slides';

const acmeTemplate: SlideTemplate = {
  name: 'Acme Corp',
  brand: { logo: { src: '/acme-logo.svg', alt: 'Acme' } },
  master: {
    logo: { asset: 'logo', position: 'top-right', size: '36px' },
    footer: { text: 'Confidential', showPageNumbers: true, position: 'bottom-center' },
  },
};

function Deck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer slideTheme={cinematicSlideTheme} template={acmeTemplate}>
        <Slide key="intro"><TitleSlide title="Annual Report" /></Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

## Exports Catalog

**Primary Components:**
`SlidePlayer`, `SlidePlayerProps`

**Layout DSL (new):**
`TitleSlide`, `SectionSlide`, `ContentSlide`, `TwoColumnSlide`, `ImageSlide`, `FullBleedSlide`, `BlankSlide`, `BigNumberSlide`, `MetricGridSlide`, `ComparisonSlide`, `QuoteSlide`, `AgendaSlide`

**Layout DSL (legacy):**
`TitleLayout`, `TitleBodyLayout`, `TwoColumnLayout`, `FullBleedLayout`, `BlankLayout`, `SlideContent`

**Text Primitives:**
`Heading`, `Body`, `BulletList`, `NumberedList`

**Types:**
`SlideLayout`, `SlideTransition`, `SlideTheme`, `SlideTemplate`, `BrandAsset`, `ResolvedSlideConfig`, `EntranceType`, `SlideRegionEntrance`, `ComparisonCellValue`, `SlideRegion`, `SlideSpec`, `DeckSpec`, `SlidePlayerHandle`, `PrintOptions`, `SlideNavigationConfig`, `ProgressStyle`

**Theme:**
`defaultSlideTheme`, `compactSlideTheme`, `cinematicSlideTheme`, `minimalSlideTheme`, `createSlideTheme`, `DeepPartial`

**Template:**
`resolveTemplate`, `ResolvedTemplate`

**Plugin:**
`slidesPlugin`

**Hooks:**
`useSlideNavigation`, `useSlideNotes`, `computeSlideStartProgress`, `SlideNavigationState`

**Animation:**
`useCountUp`, `useStaggeredReveal`, `useProgressWindow`, `useEntrance`, `easeOutCubic`, `easeInOutCubic`, `easeOutQuart`, `linear`

**Graphics:**
`StatCard`, `Timeline`, `ProcessSteps`, `IconGrid`, `ComparisonTable`, `ProgressRing`, `ProgressBar`, `CalloutBox`, `QuoteBlock`, `MetricRow`, `Badge`, `Divider` (plus corresponding `StatCardProps`, `TimelineProps`, `ProcessStepsProps`, `IconGridProps`, `ComparisonTableProps`, `ProgressRingProps`, `ProgressBarProps`, `CalloutBoxProps`, `QuoteBlockProps`, `MetricRowProps`, `BadgeProps`, `DividerProps`)
