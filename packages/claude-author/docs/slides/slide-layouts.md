---
title: Slide Layouts
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## TitleSlide

Full-viewport title slide with optional subtitle and tagline.

```typescript
type TitleSlideProps = {
  title: string;
  subtitle?: string;
  tagline?: string;
  alignment?: 'center' | 'left';
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, TitleSlide } from '@brewsite/slides';

<Slide key="intro">
  <TitleSlide
    title="Q4 2026 Results"
    subtitle="Exceeding Expectations"
    tagline="Investor Presentation"
    alignment="center"
    entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.1 }}
  />
</Slide>
```

## SectionSlide

Section divider slide for separating major deck sections.

```typescript
type SectionSlideProps = {
  title: string;
  subtitle?: string;
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, SectionSlide } from '@brewsite/slides';

<Slide key="section-growth">
  <SectionSlide title="Growth Strategy" subtitle="2026-2028 Roadmap" />
</Slide>
```

## ContentSlide

Title bar at top with a body content region below. The most common layout for text-heavy slides.

```typescript
type ContentSlideProps = {
  title: string;
  children?: ReactNode;
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, ContentSlide, Body, BulletList } from '@brewsite/slides';

<Slide key="highlights">
  <ContentSlide title="Key Highlights">
    <Body>Our team delivered exceptional results this quarter.</Body>
    <BulletList items={['Revenue up 32%', 'New markets launched', 'Record retention']} />
  </ContentSlide>
</Slide>
```

## TwoColumnSlide

Optional title bar at top with two equal-width columns below.

```typescript
type TwoColumnSlideProps = {
  title?: string;
  left: ReactNode;
  right: ReactNode;
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, TwoColumnSlide, BulletList, StatCard } from '@brewsite/slides';

<Slide key="comparison">
  <TwoColumnSlide
    title="Before & After"
    left={<BulletList items={['Manual process', '48hr turnaround', '12% error rate']} />}
    right={<BulletList items={['Automated pipeline', '2hr turnaround', '0.3% error rate']} />}
    entrance={{ left: 'slideLeft', right: 'slideRight', stagger: 0.15 }}
  />
</Slide>
```

## ImageSlide

Image on one side with content on the other. Image fills its half via CSS `object-fit`.

```typescript
type ImageSlideProps = {
  title?: string;
  children?: ReactNode;
  imageUrl: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
  imageFit?: 'cover' | 'contain';
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, ImageSlide, Body } from '@brewsite/slides';

<Slide key="product">
  <ImageSlide
    title="New Dashboard"
    imageUrl="/screenshots/dashboard-v2.png"
    imageAlt="Dashboard screenshot"
    imagePosition="right"
    imageFit="contain"
  >
    <Body>Redesigned from the ground up with real-time analytics.</Body>
  </ImageSlide>
</Slide>
```

## FullBleedSlide

No layout constraints. The Three.js canvas is fully visible with an optional text overlay in a corner or center.

```typescript
type FullBleedSlideProps = {
  children?: ReactNode;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, FullBleedSlide, Heading } from '@brewsite/slides';

<Slide key="hero" sceneDsl={<>{/* 3D scene elements here */}</>}>
  <FullBleedSlide overlayPosition="bottom-left">
    <Heading level={1}>Immersive Experience</Heading>
  </FullBleedSlide>
</Slide>
```

## BlankSlide

Blank layout with no predefined structure. Use for fully custom content or 3D-only slides.

```typescript
type BlankSlideProps = {
  children?: ReactNode;
};
```

```tsx
import { Slide, BlankSlide } from '@brewsite/slides';

<Slide key="custom" sceneDsl={<>{/* Full 3D scene */}</>}>
  <BlankSlide />
</Slide>
```

## BigNumberSlide

Large stat cards for KPI highlights. Each stat displays a value, label, and optional trend.

```typescript
type BigNumberSlideProps = {
  stats: Array<{
    value: string | number;
    label: string;
    trend?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
  }>;
  title?: string;
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, BigNumberSlide } from '@brewsite/slides';

<Slide key="kpis">
  <BigNumberSlide
    title="Q4 Performance"
    stats={[
      { value: '$4.2M', label: 'Revenue', trend: '+32%', trendDirection: 'up' },
      { value: '98.7%', label: 'Uptime', trend: '+0.3%', trendDirection: 'up' },
      { value: '2.1s', label: 'Avg Response', trend: '-40%', trendDirection: 'down' },
    ]}
  />
</Slide>
```

## MetricGridSlide

Grid of metric cards with values, labels, and optional icons. Good for dashboards with many KPIs.

```typescript
type MetricGridSlideProps = {
  metrics: Array<{
    value: string | number;
    label: string;
    icon?: ReactNode;
  }>;
  title?: string;
  columns?: 3 | 4;
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, MetricGridSlide } from '@brewsite/slides';

<Slide key="metrics">
  <MetricGridSlide
    title="Platform Metrics"
    columns={4}
    metrics={[
      { value: '12K', label: 'Active Users' },
      { value: '99.9%', label: 'Availability' },
      { value: '450ms', label: 'P95 Latency' },
      { value: '3.2M', label: 'API Calls/Day' },
    ]}
  />
</Slide>
```

## ComparisonSlide

Feature comparison table with typed cell values and optional column highlighting.

```typescript
type ComparisonSlideProps = {
  headers: string[];
  rows: Array<{
    feature: string;
    values: ComparisonCellValue[];
  }>;
  highlightColumn?: number;
  title?: string;
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, ComparisonSlide } from '@brewsite/slides';
import type { ComparisonCellValue } from '@brewsite/slides';

<Slide key="compare">
  <ComparisonSlide
    title="Plan Comparison"
    headers={['Starter', 'Pro', 'Enterprise']}
    highlightColumn={1}
    rows={[
      { feature: 'Users', values: [{ kind: 'number', value: 5 }, { kind: 'number', value: 50 }, { kind: 'text', value: 'Unlimited' }] },
      { feature: 'SSO', values: [{ kind: 'check', value: false }, { kind: 'check', value: true }, { kind: 'check', value: true }] },
      { feature: 'SLA', values: [{ kind: 'text', value: '99%' }, { kind: 'text', value: '99.9%' }, { kind: 'text', value: '99.99%' }] },
    ]}
  />
</Slide>
```

## QuoteSlide

Testimonial or quote slide with attribution.

```typescript
type QuoteSlideProps = {
  quote: string;
  attribution: string;
  role?: string;
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, QuoteSlide } from '@brewsite/slides';

<Slide key="testimonial">
  <QuoteSlide
    quote="This platform transformed how we deliver insights to stakeholders."
    attribution="Jane Chen"
    role="VP of Engineering, Acme Corp"
    entrance={{ title: 'fadeIn' }}
  />
</Slide>
```

## AgendaSlide

Table of contents or agenda slide with labeled items and optional descriptions.

```typescript
type AgendaSlideProps = {
  title: string;
  items: Array<{
    label: string;
    description?: string;
    icon?: ReactNode;
  }>;
  entrance?: SlideRegionEntrance;
};
```

```tsx
import { Slide, AgendaSlide } from '@brewsite/slides';

<Slide key="agenda">
  <AgendaSlide
    title="Today's Agenda"
    items={[
      { label: 'Q4 Results', description: 'Revenue, growth, and key metrics' },
      { label: 'Product Roadmap', description: '2027 feature pipeline' },
      { label: 'Go-to-Market', description: 'Enterprise expansion plan' },
      { label: 'Q&A', description: 'Open discussion' },
    ]}
  />
</Slide>
```

## Fast-Follow Layouts (Not Yet Implemented)

Seven additional layout types are defined in the `SlideLayout` union type but do not have dedicated DSL components yet: `'timeline'`, `'process'`, `'team'`, `'closing'`, `'bento'`, `'dashboard'`, `'matrix'`.

To achieve these patterns today, use `ContentSlide` with graphics components:

```tsx
import { Slide, ContentSlide, Timeline, ProcessSteps } from '@brewsite/slides';

// Timeline pattern using ContentSlide + Timeline graphic
<Slide key="roadmap">
  <ContentSlide title="Product Roadmap">
    <Timeline items={[
      { label: 'Q1 2027', description: 'Beta launch', active: true },
      { label: 'Q2 2027', description: 'GA release' },
      { label: 'Q3 2027', description: 'Enterprise tier' },
    ]} />
  </ContentSlide>
</Slide>

// Process pattern using ContentSlide + ProcessSteps graphic
<Slide key="onboarding">
  <ContentSlide title="Onboarding Flow">
    <ProcessSteps
      steps={[
        { title: 'Sign Up', description: 'Create account' },
        { title: 'Configure', description: 'Set preferences' },
        { title: 'Launch', description: 'Go live' },
      ]}
      activeStep={1}
    />
  </ContentSlide>
</Slide>
```

## Slide Props

Every `<Slide>` element accepts these props. The `key` prop is required as a stable slide identifier (becomes the Scene id).

```typescript
type SlideProps = {
  children?: ReactNode;
  notes?: string;
  title?: string;
  scrollUnits?: number;
  transition?: SlideTransition;
  sceneDsl?: ReactNode;
};
```

- `key` (required) — Stable unique identifier. Becomes the Scene id.
- `notes` — Speaker notes (plain text). Stored in VariableStore, surfaced in PresenterView.
- `title` — Slide title for accessibility and overview panel.
- `scrollUnits` — ProgressManager scroll budget override. Defaults: `'title'` layout = 100, all others = 400.
- `transition` — Per-slide transition override. Inherits from `SlidePlayer.transition` when absent.
- `sceneDsl` — Additional 3D scene DSL elements (`<Diagram>`, `<BarChart>`, `<Camera>`, `<Lighting>`, etc.) injected into the Scene behind the HTML overlay.

`SlideTransition` values: `'dissolve'` | `'cut'` | `'fade'` | `'push-left'` | `'push-right'` | `'push-up'` | `'push-down'` | `'zoom-in'` | `'zoom-out'`.

## EntranceType

Controls how individual slide regions animate in as the slide becomes active.

```typescript
type EntranceType = 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'grow' | 'none';
```

## SlideRegionEntrance

Per-region entrance animation configuration. Each layout component accepts an `entrance` prop of this type.

```typescript
type SlideRegionEntrance = {
  title?: EntranceType;
  body?: EntranceType;
  left?: EntranceType;
  right?: EntranceType;
  stagger?: number; // progress delay between regions, default 0
};
```

```tsx
<ContentSlide
  title="Animated Entry"
  entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.1 }}
>
  <Body>This content slides up after the title fades in.</Body>
</ContentSlide>
```

## When to Use Which Layout

| Goal | Layout |
|---|---|
| Opening or closing slide | `TitleSlide` |
| Section separator | `SectionSlide` |
| Text content with title | `ContentSlide` |
| Side-by-side comparison | `TwoColumnSlide` |
| Product screenshot + description | `ImageSlide` |
| 3D scene with minimal overlay | `FullBleedSlide` |
| Pure 3D, no text | `BlankSlide` |
| 1-3 big KPI stats | `BigNumberSlide` |
| 4+ metric cards | `MetricGridSlide` |
| Feature comparison table | `ComparisonSlide` |
| Customer testimonial | `QuoteSlide` |
| Meeting agenda / TOC | `AgendaSlide` |

## Legacy Layout Components

The following legacy components are still exported for backward compatibility. New decks should use the Phase 1B components above.

- `TitleLayout` — equivalent to `TitleSlide` (props: `title`, `subtitle?`, `alignment?`)
- `TitleBodyLayout` — equivalent to `ContentSlide` (props: `title`, `children?`)
- `TwoColumnLayout` — equivalent to `TwoColumnSlide` (props: `title?`, `left`, `right`)
- `FullBleedLayout` — equivalent to `FullBleedSlide` (props: `children?`, `overlayPosition?`)
- `BlankLayout` — equivalent to `BlankSlide` (props: `children?`)
- `SlideContent` — escape hatch for custom slide content (props: `children?`)
