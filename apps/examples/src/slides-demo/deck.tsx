// apps/examples/src/slides-demo/deck.tsx
// Demo deck exercising all 5 slide layout variants, animated BulletList,
// and a FullBleedLayout full-canvas escape hatch (DiagramCanvas can be
// placed here for NVS x/y/w/h override when using @brewsite/diagram).

import type { ReactElement } from 'react';
import {
  BulletList,
  Body,
  FullBleedLayout,
  Heading,
  NumberedList,
  Slide,
  TitleBodyLayout,
  TitleLayout,
  TwoColumnLayout,
  BlankLayout,
} from '@brewsite/slides';

// ─── 1. Title layout ─────────────────────────────────────────────────────────

const introSlide = (
  <Slide key="intro" title="Introduction" scrollUnits={100}>
    <TitleLayout
      title="BrewSite Slides"
      subtitle="Animated presentations powered by @brewsite/core"
      alignment="center"
    />
  </Slide>
);

// ─── 2. Title + Body layout with animated BulletList ─────────────────────────

const featuresSlide = (
  <Slide key="features" title="Key Features" scrollUnits={400}>
    <TitleBodyLayout title="What's Included">
      <BulletList
        animateEntrance
        items={[
          'Five composable slide layouts out of the box',
          'Animated bullet reveals driven by scroll progress',
          'Keyboard, touch, and pointer navigation',
          'Dot, bar, and numbers progress indicators',
          'Imperative handle for snapshot export',
        ]}
        bulletStyle="arrow"
      />
    </TitleBodyLayout>
  </Slide>
);

// ─── 3. Two-column layout ────────────────────────────────────────────────────

const comparisonSlide = (
  <Slide key="comparison" title="Before vs After" scrollUnits={300}>
    <TwoColumnLayout
      title="Authoring: Before vs After"
      left={
        <>
          <Heading level={3}>Before</Heading>
          <NumberedList
            items={[
              'Write raw CSS animations',
              'Manage Three.js lifecycle manually',
              'Coordinate scroll with IntersectionObserver',
            ]}
          />
        </>
      }
      right={
        <>
          <Heading level={3}>After</Heading>
          <NumberedList
            items={[
              'Declare slides as JSX',
              'Let the engine own Three.js',
              'ProgressManager drives scroll budget',
            ]}
          />
        </>
      }
    />
  </Slide>
);

// ─── 4. Full-bleed layout — three.js canvas escape hatch ─────────────────────
// The Three.js canvas is fully visible here. Drop in <DiagramCanvas> from
// @brewsite/diagram (with x/y/w/h NVS props) to render a live 3D diagram
// alongside the slide's TextBox overlay content.

const diagramSlide = (
  <Slide key="diagram" title="Architecture Overview" scrollUnits={400}>
    <FullBleedLayout overlayPosition="bottom-left">
      <Body>Scroll to explore the system architecture</Body>
    </FullBleedLayout>
  </Slide>
);

// ─── 5. Blank layout ─────────────────────────────────────────────────────────

const summarySlide = (
  <Slide key="summary" title="Summary" scrollUnits={200}>
    <BlankLayout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '1.5rem',
        }}
      >
        <Heading level={1}>Thank You</Heading>
        <Body>
          @brewsite/slides — declarative presentations on the BrewSite engine
        </Body>
      </div>
    </BlankLayout>
  </Slide>
);

// ─── Exported slide array ─────────────────────────────────────────────────────
// Exported as an array so SlidesDemoPage can spread them as direct JSX children
// of <SlidePlayer>. React.Children.forEach in SlidePlayer does not flatten
// Fragment wrappers, so individual elements or an array must be passed.

export const demoSlides: ReactElement[] = [
  introSlide,
  featuresSlide,
  comparisonSlide,
  diagramSlide,
  summarySlide,
];
