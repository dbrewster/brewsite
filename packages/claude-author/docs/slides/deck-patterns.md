---
title: Common Deck Patterns
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## Standard Corporate Deck

The most common deck pattern: title slide, agenda, content slides, and a closing slide. Uses `defaultSlideTheme` or `compactSlideTheme` for dense corporate content.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, AgendaSlide, ContentSlide,
  BigNumberSlide, QuoteSlide, Body, BulletList, slidesPlugin,
  compactSlideTheme,
} from '@brewsite/slides';
import type { SlideTemplate } from '@brewsite/slides';

const acmeTemplate: SlideTemplate = {
  name: 'Acme Corp',
  brand: { logo: { src: '/acme-logo.svg', alt: 'Acme' } },
  master: {
    logo: { asset: 'logo', position: 'bottom-right', size: '32px', opacity: 0.6 },
    footer: { text: 'Acme Corporation -- Confidential', showPageNumbers: true },
  },
  defaultTransition: 'dissolve',
};

function CorporateDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer slideTheme={compactSlideTheme} template={acmeTemplate}>
        <Slide key="title">
          <TitleSlide title="Q4 Results" subtitle="Acme Corporation" />
        </Slide>
        <Slide key="agenda">
          <AgendaSlide title="Agenda" items={[
            { label: 'Revenue', description: 'Q4 performance' },
            { label: 'Growth', description: 'Market expansion' },
            { label: 'Roadmap', description: '2027 priorities' },
          ]} />
        </Slide>
        <Slide key="revenue">
          <BigNumberSlide stats={[
            { value: '$12.4M', label: 'Revenue', trend: '+18%', trendDirection: 'up' },
            { value: '847', label: 'Customers', trend: '+24%', trendDirection: 'up' },
          ]} />
        </Slide>
        <Slide key="highlights">
          <ContentSlide title="Key Highlights">
            <BulletList items={[
              'Enterprise segment grew 32% QoQ',
              'Net retention rate at 118%',
              'Launched 3 new product lines',
              'Expanded to 12 new markets',
            ]} />
          </ContentSlide>
        </Slide>
        <Slide key="testimonial">
          <QuoteSlide
            quote="Acme has transformed how we operate. The ROI was immediate."
            attribution="Jane Smith"
            role="CTO, BigCorp"
          />
        </Slide>
        <Slide key="close">
          <TitleSlide title="Thank You" subtitle="Questions?" />
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

---

## Data-Heavy Dashboard Deck

For analytics and reporting decks, use `compactSlideTheme` for tighter spacing and faster transitions. Combine `MetricGridSlide`, `BigNumberSlide`, and `ComparisonSlide` for data-dense presentations.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, ContentSlide, MetricGridSlide,
  BigNumberSlide, ComparisonSlide, Body, slidesPlugin,
  compactSlideTheme,
} from '@brewsite/slides';

function DashboardDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer slideTheme={compactSlideTheme} transition="cut">
        <Slide key="title">
          <TitleSlide title="March 2027 Dashboard" subtitle="Engineering Metrics" />
        </Slide>
        <Slide key="kpis">
          <MetricGridSlide
            title="Key Metrics"
            columns={4}
            metrics={[
              { value: '99.97%', label: 'Uptime' },
              { value: '142ms', label: 'P95 Latency' },
              { value: '2.3M', label: 'Daily Requests' },
              { value: '12', label: 'Active Incidents' },
            ]}
          />
        </Slide>
        <Slide key="growth">
          <BigNumberSlide
            title="Traffic Growth"
            stats={[
              { value: '2.3M', label: 'Requests/day', trend: '+34%', trendDirection: 'up' },
              { value: '142ms', label: 'P95 Latency', trend: '-12%', trendDirection: 'down' },
              { value: '99.97%', label: 'Uptime', trend: '+0.02%', trendDirection: 'up' },
            ]}
          />
        </Slide>
        <Slide key="comparison">
          <ComparisonSlide
            title="Platform Comparison"
            headers={['Feature', 'Us', 'Competitor A', 'Competitor B']}
            highlightColumn={1}
            rows={[
              { feature: 'Auto-scaling', values: [
                { kind: 'check', value: true },
                { kind: 'check', value: true },
                { kind: 'check', value: false },
              ]},
              { feature: 'P95 Latency', values: [
                { kind: 'text', value: '142ms' },
                { kind: 'text', value: '310ms' },
                { kind: 'text', value: '520ms' },
              ]},
              { feature: 'Regions', values: [
                { kind: 'number', value: 24 },
                { kind: 'number', value: 12 },
                { kind: 'number', value: 8 },
              ]},
            ]}
          />
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

---

## Product Launch Deck

For product launches and keynotes, use `cinematicSlideTheme` for spacious layouts with slow, dramatic transitions. Combine `ImageSlide` and `FullBleedSlide` with `sceneDsl` for 3D product visuals.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { Camera, Lighting, Ambient, Directional, Background } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, SectionSlide, ContentSlide,
  ImageSlide, FullBleedSlide, Body, slidesPlugin,
  cinematicSlideTheme,
} from '@brewsite/slides';
import { modelPlugin } from '@brewsite/model';
import { Model } from '@brewsite/model';

function ProductLaunchDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin(), modelPlugin()]}>
      <SlidePlayer slideTheme={cinematicSlideTheme} transition="zoom-in">
        <Slide key="hero">
          <TitleSlide title="Introducing Nova" subtitle="The future of personal computing" tagline="Available March 2027" />
        </Slide>
        <Slide key="design" transition="dissolve">
          <ImageSlide
            title="Crafted for You"
            imageUrl="/images/nova-design.jpg"
            imageAlt="Nova device"
            imagePosition="right"
            imageFit="cover"
          >
            <Body>Every curve, every material chosen with intention.</Body>
          </ImageSlide>
        </Slide>
        <Slide key="3d-view" transition="zoom-out" sceneDsl={
          <>
            <Camera mode="world" position={[0, 1.5, 4]} target={[0, 0.8, 0]} />
            <Lighting>
              <Ambient intensity={0.9} />
              <Directional intensity={0.7} position={[5, 5, 5]} />
            </Lighting>
            <Background color="#0c0c1a" />
            <Model id="nova" src="/models/nova.glb" x={0.2} y={0.1} w={0.6} h={0.8} />
          </>
        }>
          <FullBleedSlide overlayPosition="bottom-left">
            <Body>360-degree product view.</Body>
          </FullBleedSlide>
        </Slide>
        <Slide key="specs">
          <ContentSlide title="Specifications">
            <Body>M4 Ultra chip. 128GB unified memory. 48-hour battery life.</Body>
          </ContentSlide>
        </Slide>
        <Slide key="close">
          <TitleSlide title="Pre-order Today" subtitle="Starting at $1,299" />
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

---

## Technical Architecture Deck

Use `ContentSlide` with `sceneDsl` to pair technical diagrams with explanatory text. Each slide can embed a different 3D diagram showing a different part of the system.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import { Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, ContentSlide, SectionSlide,
  Body, BulletList, slidesPlugin,
} from '@brewsite/slides';
import { diagramPlugin, Diagram, DiagramNode, DiagramEdge, FlowLayout } from '@brewsite/diagram';

function ArchitectureDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin(), diagramPlugin()]}>
      <SlidePlayer transition="push-left">
        <Slide key="title">
          <TitleSlide title="System Architecture" subtitle="Platform Engineering -- March 2027" />
        </Slide>
        <Slide key="overview" sceneDsl={
          <>
            <Camera mode="world" position={[0, 1.5, 5]} target={[0, 0.5, 0]} />
            <Lighting><Ambient intensity={0.8} /><Directional intensity={0.6} position={[5, 5, 5]} /></Lighting>
            <Diagram id="overview" x={0.05} y={0.05} w={0.9} h={0.6}>
              <FlowLayout direction="left-right" gap={0.1} />
              <DiagramNode id="client" label="Client" size={[0.12, 0.06]} />
              <DiagramNode id="gateway" label="API Gateway" size={[0.12, 0.06]} />
              <DiagramNode id="services" label="Services" size={[0.12, 0.06]} />
              <DiagramNode id="database" label="Database" size={[0.12, 0.06]} />
              <DiagramEdge from="client" to="gateway" />
              <DiagramEdge from="gateway" to="services" />
              <DiagramEdge from="services" to="database" />
            </Diagram>
          </>
        }>
          <ContentSlide title="High-Level Overview">
            <Body>Request flow: Client to API Gateway to Services to Database.</Body>
          </ContentSlide>
        </Slide>
        <Slide key="details">
          <ContentSlide title="Service Layer">
            <BulletList items={[
              'gRPC between services, REST at the edge',
              'Circuit breaker pattern on all downstream calls',
              'Horizontal auto-scaling based on queue depth',
            ]} />
          </ContentSlide>
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

---

## Animated Reveal Deck

Use `BulletList` with `animateEntrance` to reveal bullets one at a time as the user navigates through the slide. Combine with `useCountUp` for animated stat numbers on `BigNumberSlide`.

`BulletList` and `NumberedList` accept `animateEntrance` which uses `sceneProgress` to reveal items incrementally. The `SlideContentWithProgress` wrapper inside `SlidePlayer` reads `sceneProgress` from the `VariableStore` and injects `visibleCount` into lists with `animateEntrance=true`.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, ContentSlide, BigNumberSlide,
  Body, BulletList, NumberedList, slidesPlugin,
  cinematicSlideTheme,
} from '@brewsite/slides';

function AnimatedRevealDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer slideTheme={cinematicSlideTheme} transition="dissolve">
        <Slide key="intro">
          <TitleSlide title="Strategic Plan" subtitle="2027 Roadmap" />
        </Slide>
        <Slide key="priorities" scrollUnits={600}>
          <ContentSlide title="Top Priorities" entrance={{ title: 'fadeIn', body: 'slideUp', stagger: 0.1 }}>
            <BulletList
              animateEntrance
              bulletStyle="arrow"
              items={[
                'Expand to European markets',
                'Launch enterprise tier',
                'Achieve SOC 2 compliance',
                'Hire 50 engineers',
              ]}
            />
          </ContentSlide>
        </Slide>
        <Slide key="milestones">
          <ContentSlide title="Key Milestones" entrance={{ title: 'fadeIn', body: 'slideUp' }}>
            <NumberedList
              animateEntrance
              items={[
                'Q1: Beta launch in 3 EU markets',
                'Q2: Enterprise tier GA',
                'Q3: SOC 2 Type II certification',
                'Q4: Series C close',
              ]}
            />
          </ContentSlide>
        </Slide>
        <Slide key="metrics">
          <BigNumberSlide stats={[
            { value: '$50M', label: 'ARR Target', trend: '+120%', trendDirection: 'up' },
            { value: '200', label: 'Headcount', trend: '+67%', trendDirection: 'up' },
          ]} />
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

For custom animated numbers, use the `useCountUp` hook inside a component rendered within a slide:

```tsx
import { useCountUp } from '@brewsite/slides';

function AnimatedRevenue() {
  const value = useCountUp(12.4, { start: 0, delay: 0.1, duration: 0.6, decimals: 1 });
  return (
    <div style={{ fontSize: 'var(--brewsite-font-size-heading)', fontWeight: 700, color: 'var(--brewsite-text-primary)' }}>
      ${value}M
    </div>
  );
}
```

`useCountUp` reads `sceneProgress` via `useSceneProgress()` from `@brewsite/core` and interpolates from `start` to `target` using `easeOutCubic` by default.

---

## Section-Divided Deck

Use `SectionSlide` to visually divide a deck into distinct topic groups. Vary transitions between sections for visual rhythm.

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, SectionSlide, ContentSlide,
  BigNumberSlide, QuoteSlide, Body, BulletList, slidesPlugin,
} from '@brewsite/slides';

function SectionDividedDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer transition="dissolve">
        <Slide key="title">
          <TitleSlide title="Annual Review" subtitle="FY 2026" />
        </Slide>

        {/* Section 1: Financial */}
        <Slide key="section-finance" transition="push-left">
          <SectionSlide title="Financial Results" subtitle="Revenue, margins, and growth" />
        </Slide>
        <Slide key="revenue">
          <BigNumberSlide stats={[
            { value: '$48M', label: 'Revenue', trend: '+42%', trendDirection: 'up' },
            { value: '72%', label: 'Gross Margin', trend: '+5%', trendDirection: 'up' },
          ]} />
        </Slide>
        <Slide key="finance-detail">
          <ContentSlide title="Financial Highlights">
            <BulletList items={[
              'Crossed $4M MRR in November',
              'Enterprise ACV up 38% to $120K',
              'Cash flow positive since Q3',
            ]} />
          </ContentSlide>
        </Slide>

        {/* Section 2: Product */}
        <Slide key="section-product" transition="push-left">
          <SectionSlide title="Product" subtitle="Launches, adoption, and roadmap" />
        </Slide>
        <Slide key="product-wins">
          <ContentSlide title="Product Wins">
            <BulletList items={[
              'Launched v3.0 with AI-powered search',
              'Mobile app reached 100K downloads',
              'NPS improved from 42 to 61',
            ]} />
          </ContentSlide>
        </Slide>

        {/* Section 3: Team */}
        <Slide key="section-team" transition="push-left">
          <SectionSlide title="Team" subtitle="Growth and culture" />
        </Slide>
        <Slide key="team-quote">
          <QuoteSlide
            quote="This was the year we went from startup to scale-up."
            attribution="Alex Chen"
            role="CEO"
          />
        </Slide>

        <Slide key="close" transition="zoom-in">
          <TitleSlide title="Onward" subtitle="2027 will be our biggest year yet" />
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

The pattern uses `SectionSlide` with a `push-left` transition to signal topic changes, while content slides within each section use the default `dissolve`. The closing slide uses `zoom-in` for a dramatic finish.
